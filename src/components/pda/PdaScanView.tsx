/**
 * Vista V1: Interfaz de Escaneo Operativa para PDAs (/misiones/:id/escaneo)
 * AUDITORIAPLUS+
 * 
 * Cumple estrictamente con el Documento de Arquitectura Funcional (FAD):
 * 1. Header Superior en Azul Marino (#263988) con Misión y Depósito del estado global.
 * 2. Input persistente con 'autoFocus' para escáneres láser por hardware (Wedge HID).
 * 3. Viewport de video HTML5 con API nativa BarcodeDetector.
 * 4. Normalización obligatoria LPAD(input, 6, '0') antes de procesar o enviar al estado global.
 * 5. Widget de Gamificación inferior con Rango, XP Totales y Racha (1.4x para 150101, 1.0x para 150103).
 * 6. Modal A: Bloqueo de Re-conteo (Ámbar #F59E0B) para tuplas Completed o Reconciled_Match.
 * 7. Modal B: Ficha Incompleta con formulario y CTA Verde (#009045) emitiendo SkuFichaCompleted.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuditStore } from '../../store/auditStore';
import { lpad } from '../../utils/lpad';
import { BarcodeScannerViewport } from './BarcodeScannerViewport';
import { GamificationWidget } from './GamificationWidget';
import { ModalReconteoBloqueado, BlockedReconteoData } from './ModalReconteoBloqueado';
import { ModalFichaIncompleta, SkuFichaCompletedPayload } from './ModalFichaIncompleta';
import {
  Barcode,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  History,
  Layers,
  Sparkles,
  Wifi,
  WifiOff,
  CloudUpload,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface AuditItemRecord {
  skuCode: string;
  normalizedSku: string;
  description: string;
  department: string;
  group: string;
  quantity: number;
  isFichaComplete: boolean;
  status: 'Pending_Count' | 'Counted' | 'Completed' | 'Reconciled_Match';
  closedBy?: string;
  closedAt?: string;
  lastCountedAt: string;
}

export const PdaScanView: React.FC = () => {
  const {
    currentMissionId,
    currentDepositCode,
    isOffline,
    activeQueueCount,
    recordCount,
    setSession,
  } = useAuditStore();

  // Estados de Entrada del Escáner
  const [scannerInputValue, setScannerInputValue] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [lastScannedResult, setLastScannedResult] = useState<{
    raw: string;
    normalized: string;
    time: string;
    success: boolean;
  } | null>(null);

  // Gamificación
  const [totalXp, setTotalXp] = useState<number>(1850);
  const [activeStreak, setActiveStreak] = useState<number>(12);
  const [totalItemsAudited, setTotalItemsAudited] = useState<number>(47);

  // Modales de Excepción FAD
  const [modalABlockedData, setModalABlockedData] = useState<BlockedReconteoData | null>(null);
  const [isModalAOpen, setIsModalAOpen] = useState<boolean>(false);

  const [modalBIncompleteSku, setModalBIncompleteSku] = useState<string | null>(null);
  const [isModalBOpen, setIsModalBOpen] = useState<boolean>(false);

  // Base Local de Items para la Misión (simulación reactiva ligada al almacén)
  const [localAuditItems, setLocalAuditItems] = useState<Record<string, AuditItemRecord>>({
    '000045': {
      skuCode: '45',
      normalizedSku: '000045',
      description: 'Harina de Maíz Blanco 1Kg',
      department: 'Abarrotes y Alimentos',
      group: 'Harinas y Pastas',
      quantity: 45,
      isFichaComplete: true,
      status: 'Counted',
      lastCountedAt: '10:45:10',
    },
    '759103': {
      skuCode: '759103',
      normalizedSku: '759103',
      description: 'Aceite Vegetal Comestible 1L',
      department: 'Abarrotes y Alimentos',
      group: 'Alimentos Secos',
      quantity: 24,
      isFichaComplete: true,
      status: 'Completed', // CERRADO: Provoca Modal A
      closedBy: 'Roberto Ramos (Supervisor Almacén)',
      closedAt: '2026-09-29 10:15:00 UTC',
      lastCountedAt: '10:15:00',
    },
    '000889': {
      skuCode: '889',
      normalizedSku: '000889',
      description: '',
      department: '',
      group: '',
      quantity: 0,
      isFichaComplete: false, // INCOMPLETO: Provoca Modal B
      status: 'Pending_Count',
      lastCountedAt: '-',
    },
  });

  // Historial de escaneos recientes en la PDA
  const [recentScans, setRecentScans] = useState<
    Array<{
      id: string;
      rawInput: string;
      normalized: string;
      quantity: number;
      timestamp: string;
      xpGained: number;
    }>
  >([]);

  // Referencia al Input persistente con AutoFocus para Escáneres Láser
  const hardwareInputRef = useRef<HTMLInputElement | null>(null);

  // Multiplicador por depósito: 1.4x para 150101 (Almacén), 1.0x para 150103 (Piso)
  const depositMultiplier = currentDepositCode === '150101' ? 1.4 : 1.0;

  // Persistir Focus en el input hardware láser
  const ensureHardwareFocus = useCallback(() => {
    if (isModalAOpen || isModalBOpen) return;
    if (hardwareInputRef.current && document.activeElement !== hardwareInputRef.current) {
      hardwareInputRef.current.focus();
    }
  }, [isModalAOpen, isModalBOpen]);

  useEffect(() => {
    ensureHardwareFocus();
    const interval = setInterval(ensureHardwareFocus, 2000);
    return () => clearInterval(interval);
  }, [ensureHardwareFocus]);

  // =========================================================================
  // NÚCLEO FAD: Procesamiento de Escaneo & Regla LPAD(input, 6, '0')
  // =========================================================================
  const processScannedInput = useCallback(
    async (rawCode: string, qty = quantityInput) => {
      if (!rawCode || !rawCode.trim()) return;

      // REGLA DE NEGOCIO: Normalización obligatoria con LPAD(input, 6, '0')
      const normalizedSku = lpad(rawCode, 6, '0');
      console.log(`[FAD Scan] Raw: "${rawCode}" -> LPAD Normalizado: "${normalizedSku}"`);

      // 1. Verificar MODAL A: ¿Está la tupla cerrada (Completed o Reconciled_Match)?
      const existingItem = localAuditItems[normalizedSku];
      if (
        existingItem &&
        (existingItem.status === 'Completed' || existingItem.status === 'Reconciled_Match')
      ) {
        setModalABlockedData({
          missionId: currentMissionId || 'MIS-2026-VAL-01',
          depositCode: currentDepositCode || '150101',
          skuCode: normalizedSku,
          status: existingItem.status,
          auditorName: existingItem.closedBy || 'Supervisor de Auditoría',
          closedAt: existingItem.closedAt || new Date().toISOString(),
          finalQuantity: existingItem.quantity,
        });
        setIsModalAOpen(true);
        setScannerInputValue('');
        return;
      }

      // 2. Verificar MODAL B: ¿Es ficha incompleta (IsFichaComplete = false)?
      if (existingItem && !existingItem.isFichaComplete) {
        setModalBIncompleteSku(normalizedSku);
        setIsModalBOpen(true);
        setScannerInputValue('');
        return;
      }

      // 3. Procesar Conteo Válido: Enviar al Estado Global & Persistencia
      try {
        await recordCount(normalizedSku, qty);

        // Feedback de Gamificación
        const baseXP = 15;
        const xpEarned = Math.round(baseXP * depositMultiplier * (1 + activeStreak * 0.05));
        setTotalXp((prev) => prev + xpEarned);
        setActiveStreak((prev) => prev + 1);
        setTotalItemsAudited((prev) => prev + qty);

        // Actualizar tabla local
        setLocalAuditItems((prev) => {
          const current = prev[normalizedSku] || {
            skuCode: rawCode,
            normalizedSku,
            description: `Artículo ${normalizedSku}`,
            department: 'General',
            group: 'General',
            quantity: 0,
            isFichaComplete: true,
            status: 'Counted',
            lastCountedAt: new Date().toLocaleTimeString(),
          };
          return {
            ...prev,
            [normalizedSku]: {
              ...current,
              quantity: current.quantity + qty,
              status: 'Counted',
              lastCountedAt: new Date().toLocaleTimeString(),
            },
          };
        });

        // Registrar en historial reciente
        setRecentScans((prev) => [
          {
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            rawInput: rawCode,
            normalized: normalizedSku,
            quantity: qty,
            timestamp: new Date().toLocaleTimeString(),
            xpGained: xpEarned,
          },
          ...prev.slice(0, 9),
        ]);

        setLastScannedResult({
          raw: rawCode,
          normalized: normalizedSku,
          time: new Date().toLocaleTimeString(),
          success: true,
        });
      } catch (err) {
        console.error('[PDA Scan Error]', err);
      } finally {
        setScannerInputValue('');
        ensureHardwareFocus();
      }
    },
    [
      quantityInput,
      localAuditItems,
      currentMissionId,
      currentDepositCode,
      recordCount,
      depositMultiplier,
      activeStreak,
      ensureHardwareFocus,
    ]
  );

  // Manejador del Input Láser por Teclado
  const handleHardwareInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processScannedInput(scannerInputValue);
    }
  };

  // Callback emitido por Modal B (SkuFichaCompleted)
  const handleSkuFichaCompleted = (payload: SkuFichaCompletedPayload) => {
    setLocalAuditItems((prev) => ({
      ...prev,
      [payload.skuCode]: {
        ...(prev[payload.skuCode] || {
          skuCode: payload.skuCode,
          normalizedSku: payload.skuCode,
          quantity: 0,
          status: 'Counted',
          lastCountedAt: new Date().toLocaleTimeString(),
        }),
        description: payload.description,
        department: payload.department,
        group: payload.group,
        isFichaComplete: true,
      },
    }));

    setIsModalBOpen(false);
    setModalBIncompleteSku(null);

    // Conteo posterior inmediato tras completar la ficha
    processScannedInput(payload.skuCode, quantityInput);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* ========================================================================= */}
      {/* 1. HEADER SUPERIOR AZUL MARINO (#263988)                                  */}
      {/* ========================================================================= */}
      <header className="bg-[#263988] text-white shadow-xl border-b border-indigo-950 sticky top-0 z-30">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Misión y Depósito Actual del Estado Global */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono tracking-wider uppercase bg-white/15 px-2 py-0.5 rounded font-extrabold text-indigo-100">
                PDA OPERATIVA
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isOffline ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                {isOffline ? 'OFFLINE' : 'ONLINE'}
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-2 truncate">
              <h1 className="text-sm font-black tracking-tight text-white truncate">
                {currentMissionId || 'MIS-2026-VAL-01'}
              </h1>
              <span className="text-indigo-200 text-xs font-mono">/</span>
              <span className="text-xs font-mono font-bold text-amber-300 bg-black/25 px-1.5 py-0.5 rounded">
                DEP: {currentDepositCode || '150101'}
              </span>
            </div>
          </div>

          {/* Cola Activa y Conmutador de Depósito Demo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-indigo-200 block font-mono">
                Cola Sync
              </span>
              <span className="text-xs font-mono font-bold text-white flex items-center justify-end gap-1">
                <CloudUpload className="w-3 h-3 text-cyan-300" />
                {activeQueueCount}
              </span>
            </div>

            {/* Selector rápido de depósito para probar multiplicadores 1.4x vs 1.0x */}
            <button
              onClick={() => {
                const nextDep = currentDepositCode === '150101' ? '150103' : '150101';
                setSession({
                  missionId: currentMissionId || 'MIS-2026-VAL-01',
                  depositCode: nextDep,
                });
              }}
              title="Alternar entre Almacén (150101 - 1.4x) y Piso (150103 - 1.0x)"
              className="px-2 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-mono font-semibold transition border border-white/15 cursor-pointer"
            >
              ⇄ {currentDepositCode === '150101' ? 'A: 150101' : 'P: 150103'}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CUERPO PRINCIPAL DE LA VISTA OPERATIVA                                    */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4 space-y-4">
        {/* Banner de Ayuda Rápida para Pruebas de Modales FAD */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Códigos Demo para Probar Modales FAD:
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => processScannedInput('45')}
              className="p-1.5 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 text-left text-emerald-400 cursor-pointer"
            >
              <span className="block font-bold">"45" ➔ Normal</span>
              <span className="text-[9px] text-slate-500">LPAD: 000045</span>
            </button>
            <button
              type="button"
              onClick={() => processScannedInput('759103')}
              className="p-1.5 bg-amber-950/40 hover:bg-amber-900/50 rounded border border-[#F59E0B]/50 text-left text-amber-300 cursor-pointer"
            >
              <span className="block font-bold">"759103" ➔ Modal A</span>
              <span className="text-[9px] text-amber-400/80">Bloqueo Re-conteo</span>
            </button>
            <button
              type="button"
              onClick={() => processScannedInput('889')}
              className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/50 rounded border border-[#009045]/50 text-left text-emerald-300 cursor-pointer"
            >
              <span className="block font-bold">"889" ➔ Modal B</span>
              <span className="text-[9px] text-emerald-400/80">Ficha Incompleta</span>
            </button>
          </div>
        </div>

        {/* 2. VIEWPORT DE VIDEO HTML5 CON API BarcodeDetector */}
        <BarcodeScannerViewport
          onDetected={(code) => processScannedInput(code)}
          isScanningActive={!isModalAOpen && !isModalBOpen}
        />

        {/* 3. INPUT PERSISTENTE CON AUTOFOCUS PARA ESCÁNERES LÁSER WEDGE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-indigo-400" />
              Lector Láser de Hardware (Auto-Focus Activo)
            </label>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              LPAD(6) ACTIVO
            </span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={hardwareInputRef}
                type="text"
                autoFocus
                value={scannerInputValue}
                onChange={(e) => setScannerInputValue(e.target.value)}
                onKeyDown={handleHardwareInputKeyDown}
                onBlur={() => {
                  // Refocus inmediato para no perder la lectura de la pistola láser
                  setTimeout(ensureHardwareFocus, 80);
                }}
                placeholder="Apunta el láser o escribe SKU..."
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-[#263988] focus:ring-2 focus:ring-[#263988]/50 rounded-xl px-3.5 py-3 text-sm font-mono text-white placeholder-slate-500 transition-all outline-none"
              />
            </div>

            {/* Selector de Cantidad a Sumar */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-1">
              <button
                type="button"
                onClick={() => setQuantityInput((prev) => Math.max(1, prev - 1))}
                className="p-2 text-slate-400 hover:text-white transition cursor-pointer"
                title="Restar 1"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs font-bold px-1.5 min-w-[28px] text-center text-amber-300">
                +{quantityInput}
              </span>
              <button
                type="button"
                onClick={() => setQuantityInput((prev) => prev + 1)}
                className="p-2 text-slate-400 hover:text-white transition cursor-pointer"
                title="Sumar 1"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => processScannedInput(scannerInputValue)}
              className="px-4 py-3 bg-[#263988] hover:bg-indigo-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition active:scale-95 shadow-md shadow-[#263988]/30 cursor-pointer"
            >
              OK
            </button>
          </div>

          {/* Feedback de Último Escaneo con Regla LPAD */}
          {lastScannedResult && (
            <div className="bg-slate-950/70 rounded-xl p-2.5 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">
                Input: <strong className="text-slate-200">"{lastScannedResult.raw}"</strong> ➔ LPAD(6):{' '}
                <strong className="text-emerald-400">"{lastScannedResult.normalized}"</strong>
              </span>
              <span className="text-slate-500 text-[10px]">{lastScannedResult.time}</span>
            </div>
          )}
        </div>

        {/* 4. HISTORIAL DE ESCANEOS RECIENTES EN LA PDA */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              Últimos Escaneos en la Misión
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Total contados: {totalItemsAudited}
            </span>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
            {recentScans.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Ningún escaneo registrado aún. Utiliza el lector láser de la PDA.
              </div>
            ) : (
              recentScans.map((scan) => (
                <div key={scan.id} className="p-3 flex items-center justify-between hover:bg-slate-800/30 transition">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">
                        {scan.normalized}
                      </span>
                      {scan.rawInput !== scan.normalized && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          (raw: {scan.rawInput})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {localAuditItems[scan.normalized]?.description || 'Artículo auditado'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-black text-emerald-400 block">
                      +{scan.quantity}
                    </span>
                    <span className="text-[9px] text-amber-400 font-mono">
                      +{scan.xpGained} XP
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 5. WIDGET DE GAMIFICACIÓN INFERIOR                                        */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 inset-x-0 z-30">
        <GamificationWidget
          depositCode={currentDepositCode || '150101'}
          totalXp={totalXp}
          activeStreak={activeStreak}
          itemsAuditedCount={totalItemsAudited}
        />
      </div>

      {/* ========================================================================= */}
      {/* 6. MODALES DE EXCEPCIÓN OBLIGATORIOS (FAD)                                */}
      {/* ========================================================================= */}
      {/* Modal A: Bloqueo de Re-conteo (Ámbar #F59E0B) */}
      <ModalReconteoBloqueado
        isOpen={isModalAOpen}
        data={modalABlockedData}
        onClose={() => {
          setIsModalAOpen(false);
          setModalABlockedData(null);
          setTimeout(ensureHardwareFocus, 80);
        }}
        onRequestSupervisorOverride={(data) => {
          alert(`Solicitud de override enviada al supervisor para SKU ${data.skuCode}`);
          setIsModalAOpen(false);
        }}
      />

      {/* Modal B: Ficha Incompleta (Verde #009045) */}
      <ModalFichaIncompleta
        isOpen={isModalBOpen}
        skuCode={modalBIncompleteSku || ''}
        initialDescription={modalBIncompleteSku ? localAuditItems[modalBIncompleteSku]?.description : ''}
        onClose={() => {
          setIsModalBOpen(false);
          setModalBIncompleteSku(null);
          setTimeout(ensureHardwareFocus, 80);
        }}
        onSkuFichaCompleted={handleSkuFichaCompleted}
      />
    </div>
  );
};
