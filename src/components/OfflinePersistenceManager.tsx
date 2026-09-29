import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ScanLine,
  Layers,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  User,
  Boxes,
  Plus,
  ArrowDownUp,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { useAuditStore, SetSessionParams } from '../store/auditStore';
import {
  getAllQueueEvents,
  OfflineCountEvent,
  getOfflineDB,
  LocalSkuMaster,
  CachedMission,
  lookupLocalSku,
} from '../offline/db';

export const OfflinePersistenceManager: React.FC = () => {
  const {
    currentMissionId,
    currentDepositCode,
    userAuth,
    isOffline,
    activeQueueCount,
    isSyncing,
    lastSyncResult,
    isSimulatedOffline,
    setSession,
    syncOfflineEvents,
    recordCount,
    toggleSimulatedOffline,
    refreshQueueCount,
  } = useAuditStore();

  // Estados locales para entrada de conteo
  const [skuInput, setSkuInput] = useState('759103100245');
  const [quantityInput, setQuantityInput] = useState(1);
  const [detectedSku, setDetectedSku] = useState<LocalSkuMaster | null>(null);

  // Estados locales para modal de sesión
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [tempMissionId, setTempMissionId] = useState(currentMissionId || 'MIS-2026-VAL-01');
  const [tempDepositCode, setTempDepositCode] = useState(currentDepositCode || '150101');
  const [tempAuditorName, setTempAuditorName] = useState(userAuth?.fullName || '');

  // Simulación de prueba para HTTP 409 Override Conflict
  const [simulate409ForSku, setSimulate409ForSku] = useState(true);
  const conflictTestSku = '759204200889'; // SKU de prueba para provocar 409

  // Inspector de IndexedDB
  const [activeStoreTab, setActiveStoreTab] = useState<'queue' | 'skus' | 'missions'>('queue');
  const [queueEvents, setQueueEvents] = useState<OfflineCountEvent[]>([]);
  const [cachedSkus, setCachedSkus] = useState<LocalSkuMaster[]>([]);
  const [cachedMissions, setCachedMissions] = useState<CachedMission[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Recargar datos desde IndexedDB
  const reloadFromDb = async () => {
    setLoadingDb(true);
    try {
      const db = await getOfflineDB();
      const events = await getAllQueueEvents();
      setQueueEvents(events);

      const skus = await db.getAll('sku_master_local');
      setCachedSkus(skus);

      const missions = await db.getAll('missions_cache');
      setCachedMissions(missions);

      await refreshQueueCount();
    } catch (err) {
      console.warn('Error leyendo IndexedDB:', err);
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    reloadFromDb();
  }, [activeQueueCount, isSyncing]);

  // Búsqueda en vivo de SKU en sku_master_local (IndexedDB)
  useEffect(() => {
    let active = true;
    lookupLocalSku(skuInput).then((res) => {
      if (active) setDetectedSku(res);
    });
    return () => {
      active = false;
    };
  }, [skuInput]);

  // Manejador para registrar un conteo físico
  const handleRecordCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skuInput.trim() || quantityInput <= 0) return;

    try {
      const event = await recordCount(skuInput.trim(), quantityInput);
      setStatusMessage(
        `✓ Conteo encolado en IndexedDB: Seq #${event.sequence_number} (${event.sku_code} x ${event.counted_quantity}u).`
      );
      setQuantityInput(1);
      await reloadFromDb();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      const error = err as Error;
      setStatusMessage(`Error: ${error.message}`);
    }
  };

  // Manejador para guardar sesión
  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    const params: SetSessionParams = {
      missionId: tempMissionId.trim(),
      depositCode: tempDepositCode.trim(),
    };
    if (tempAuditorName.trim() && userAuth) {
      params.user = {
        ...userAuth,
        fullName: tempAuditorName.trim(),
      };
    }
    setSession(params);
    setSessionModalOpen(false);
    setStatusMessage(`✓ Sesión actualizada: ${tempMissionId} - Depósito ${tempDepositCode}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Manejador de sincronización manual
  const handleManualSync = async () => {
    setStatusMessage('Sincronizando eventos offline con /api/v1/audit/register-count...');
    const result = await syncOfflineEvents({
      simulateConflictSkus: simulate409ForSku ? [conflictTestSku] : [],
    });

    await reloadFromDb();

    if (result.failedDueToNetwork) {
      setStatusMessage(`⚠️ Pausa por fallo de red: Se preservó el orden cronológico estricto.`);
    } else {
      setStatusMessage(
        `✓ Sincronización completada: ${result.synced} exitosos, ${result.rejected} rechazados por 409.`
      );
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header de Estado Global (AUDITORIAPLUS+ State Engine) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                IndexedDB Store Activo (idb v1)
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                  isOffline
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {isOffline ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                    MODO OFFLINE (Sin Conexión)
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    ONLINE (Conectado a Cloud)
                  </>
                )}
              </span>
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Motor de Estado & Persistencia Offline AUDITORIAPLUS+
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Garantiza auditorías ininterrumpidas en zonas sin cobertura celular mediante colas transaccionales en IndexedDB y ráfagas cronológicas estrictas.
            </p>
          </div>

          {/* Botones de Control de Sesión y Red */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => toggleSimulatedOffline()}
              className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition border cursor-pointer ${
                isSimulatedOffline
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isSimulatedOffline ? <WifiOff className="w-4 h-4 text-amber-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
              {isSimulatedOffline ? 'Simulando Offline: ON' : 'Simular Corte de Red'}
            </button>

            <button
              onClick={() => setSessionModalOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              setSession()
            </button>

            <button
              onClick={handleManualSync}
              disabled={isSyncing || activeQueueCount === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center gap-2 shadow-lg shadow-emerald-950 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              syncOfflineEvents()
              {activeQueueCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-800 text-[10px] font-bold">
                  {activeQueueCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tarjetas de Sesión Activa */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block">currentMissionId</span>
            <span className="font-mono text-xs font-bold text-emerald-400 truncate block mt-0.5">
              {currentMissionId || 'NO_SET'}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block">currentDepositCode</span>
            <span className="font-mono text-xs font-bold text-cyan-400 truncate block mt-0.5">
              {currentDepositCode || 'NO_SET'}
            </span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block">userAuth (Auditor)</span>
            <span className="text-xs font-semibold text-white truncate block mt-0.5">
              {userAuth?.fullName?.split(' ')[0] || 'Anónimo'} ({userAuth?.role || 'Líder'})
            </span>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">activeQueueCount</span>
              <span className="font-mono text-sm font-bold text-amber-300 block mt-0.5">
                {activeQueueCount} en cola
              </span>
            </div>
            <div className={`w-3 h-3 rounded-full ${activeQueueCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-slate-700'}`} />
          </div>
        </div>
      </div>

      {/* Banner de Mensaje de Estado / Feedback */}
      {statusMessage && (
        <div className="bg-indigo-950/70 border border-indigo-500/40 rounded-xl px-4 py-2.5 text-xs text-indigo-200 flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Grid: Registro de Conteo en Terreno & Opciones de Prueba */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel Izquierdo: Escáner y Registro de Conteo Físico */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Captura Física de Conteo</h3>
          </div>
          <p className="text-xs text-slate-400">
            Los conteos se guardan instantáneamente en <code className="text-emerald-300 font-mono">offline_events_queue</code> con secuencia monotónica estricta.
          </p>

          <form onSubmit={handleRecordCount} className="space-y-3.5">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                Código SKU o Barra (EAN-13):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  placeholder="Escanee o digite SKU..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Ficha rápida SKU detectado en sku_master_local */}
            {detectedSku ? (
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span className="truncate">{detectedSku.description}</span>
                  <span className="text-[10px] text-emerald-400 font-mono">EN LOCAL</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Categoría: {detectedSku.category}</span>
                  <span>Teórico: {detectedSku.expected_theoretical}u</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60 text-[11px] text-slate-500 italic">
                SKU nuevo o no presente en el catálogo local. Se creará conteo libre.
              </div>
            )}

            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                Cantidad Contada:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantityInput((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(parseInt(e.target.value || '1', 10))}
                  className="flex-1 text-center bg-slate-950 border border-slate-800 rounded-lg py-1.5 text-sm font-bold font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setQuantityInput((q) => q + 1)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-emerald-950"
            >
              <Plus className="w-4 h-4" />
              Registrar Conteo en Cola
            </button>
          </form>

          {/* Toggle de Simulación HTTP 409 (Conflicto Override) */}
          <div className="pt-3 border-t border-slate-800 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={simulate409ForSku}
                onChange={(e) => setSimulate409ForSku(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-slate-300 text-[11px] leading-relaxed">
                Simular <strong>HTTP 409 (Conflicto por Override)</strong> para el SKU <code className="text-amber-300 font-mono">{conflictTestSku}</code> al sincronizar.
              </span>
            </label>
          </div>
        </div>

        {/* Panel Derecho: Visor e Inspector de los 3 Stores de IndexedDB */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          {/* Pestañas de Stores */}
          <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveStoreTab('queue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeStoreTab === 'queue'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                offline_events_queue ({queueEvents.length})
              </button>

              <button
                onClick={() => setActiveStoreTab('skus')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeStoreTab === 'skus'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-cyan-400" />
                sku_master_local ({cachedSkus.length})
              </button>

              <button
                onClick={() => setActiveStoreTab('missions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeStoreTab === 'missions'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                missions_cache ({cachedMissions.length})
              </button>
            </div>

            <button
              onClick={reloadFromDb}
              disabled={loadingDb}
              className="text-slate-400 hover:text-white p-1 rounded transition"
              title="Refrescar vista de IndexedDB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDb ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Contenido del Store Seleccionado */}
          <div className="flex-1 p-4 overflow-x-auto min-h-[300px]">
            {activeStoreTab === 'queue' && (
              <div className="space-y-3">
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Índices obligatorios: <code className="text-emerald-400 font-mono">idx_mission_deposit</code>, <code className="text-emerald-400 font-mono">idx_sequence</code>, <code className="text-emerald-400 font-mono">idx_status</code></span>
                  <span>Orden: timestamp_utc original (FIFO)</span>
                </div>

                {queueEvents.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No hay eventos registrados en <code className="text-slate-400">offline_events_queue</code>. Utiliza el panel de captura para encolar conteos.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-slate-500 border-b border-slate-800 uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Seq #</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3">Misión / Depósito</th>
                        <th className="py-2 px-3 text-center">Cantidad</th>
                        <th className="py-2 px-3 text-center">Status</th>
                        <th className="py-2 px-3">Timestamp UTC</th>
                        <th className="py-2 px-3">Detalle / Rechazo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {queueEvents.map((evt) => (
                        <tr key={evt.event_id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-bold text-white">#{evt.sequence_number}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-300">{evt.sku_code}</td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-400">
                            {evt.mission_id} <span className="text-cyan-400 font-bold">({evt.deposit_code})</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-white">
                            <span className="px-2 py-0.5 bg-slate-800 rounded">{evt.counted_quantity}u</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                evt.status === 'pending'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : evt.status === 'synced'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : evt.status === 'rejected'
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {evt.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-400">
                            {new Date(evt.timestamp_utc).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 text-[10px]">
                            {evt.rejection_reason ? (
                              <span className="text-red-400 font-semibold" title={evt.rejection_reason}>
                                {evt.rejection_reason}
                              </span>
                            ) : evt.synced_at ? (
                              <span className="text-emerald-400">Sync OK</span>
                            ) : evt.retry_count > 0 ? (
                              <span className="text-amber-400">Reintentos: {evt.retry_count}</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeStoreTab === 'skus' && (
              <div className="space-y-3">
                <div className="text-[11px] text-slate-400">
                  Store: <code className="text-cyan-400 font-mono">sku_master_local</code> (Catálogo maestro cacheado para validación sin red)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cachedSkus.map((sku) => (
                    <div key={sku.sku_code} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex justify-between font-mono font-bold text-white">
                        <span className="text-emerald-400">{sku.sku_code}</span>
                        <span className="text-cyan-400 font-normal">Depósito: {sku.deposit_code}</span>
                      </div>
                      <div className="font-semibold text-slate-300 truncate">{sku.description}</div>
                      <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                        <span>Categoría: {sku.category}</span>
                        <span>Teórico: {sku.expected_theoretical} {sku.unit_of_measure}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeStoreTab === 'missions' && (
              <div className="space-y-3">
                <div className="text-[11px] text-slate-400">
                  Store: <code className="text-emerald-400 font-mono">missions_cache</code> (Metadatos de misiones cacheadas)
                </div>
                {cachedMissions.map((m) => (
                  <div key={m.mission_id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-white text-sm">{m.mission_id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                        {m.status}
                      </span>
                    </div>
                    <div className="text-slate-300">{m.title}</div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                      <span>Depósitos vinculados: <strong className="text-cyan-300">{m.deposit_codes.join(', ')}</strong></span>
                      <span>•</span>
                      <span>Ítems teóricos: {m.theoretical_items_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Configuración de Sesión (setSession) */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-400" />
                Configurar Sesión Activa — setSession()
              </h3>
              <button
                onClick={() => setSessionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">ID de Misión (currentMissionId):</label>
                <input
                  type="text"
                  value={tempMissionId}
                  onChange={(e) => setTempMissionId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Código de Depósito (currentDepositCode):</label>
                <input
                  type="text"
                  value={tempDepositCode}
                  onChange={(e) => setTempDepositCode(e.target.value)}
                  placeholder="ej. 150101, 150103"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Nombre del Auditor (userAuth.fullName):</label>
                <input
                  type="text"
                  value={tempAuditorName}
                  onChange={(e) => setTempAuditorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                >
                  Guardar Sesión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
