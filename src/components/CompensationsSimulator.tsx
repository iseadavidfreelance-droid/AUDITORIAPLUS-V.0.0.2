import React, { useState } from 'react';
import {
  ArrowRight,
  Sparkles,
  RefreshCw,
  Clock,
  Send,
  Building2,
  Boxes,
  HelpCircle,
} from 'lucide-react';

interface MockTask {
  id: number;
  missionId: string;
  skuCode: string;
  depositCode: string;
  depositName: string;
  systemQuantity: number;
  salesDuringAudit: number;
  countedQuantity: number;
  status: 'Pending_Count' | 'Counted' | 'Discrepancy' | 'Reconciled';
}

interface MockTransfer {
  id: number;
  missionId: string;
  skuCode: string;
  fromDeposit: string;
  toDeposit: string;
  transitDeposit: string;
  quantityToMove: number;
  status: 'Suggested' | 'Approved' | 'Pending_ERP_Sync' | 'Applied_ERP';
  surplusBefore: number;
  deficitBefore: number;
  erpDocumentRef?: string;
  createdAt: string;
}

export const CompensationsSimulator: React.FC = () => {
  const [missionId, setMissionId] = useState('MIS-2026-VAL-01');
  const [skuCode, setSkuCode] = useState('759103100245');

  // Initial scenario as requested:
  // Almacén 150101: System 50, Sales 0, Counted 45 -> -5 (Faltante)
  // Piso 150103: System 20, Sales 2, Counted 24 -> Teórico 18 -> +6 (Sobrante)
  const [tasks, setTasks] = useState<MockTask[]>([
    {
      id: 1,
      missionId: 'MIS-2026-VAL-01',
      skuCode: '759103100245',
      depositCode: '150101',
      depositName: 'Almacén Principal',
      systemQuantity: 50,
      salesDuringAudit: 0,
      countedQuantity: 45,
      status: 'Counted',
    },
    {
      id: 2,
      missionId: 'MIS-2026-VAL-01',
      skuCode: '759103100245',
      depositCode: '150103',
      depositName: 'Piso de Ventas (Retail)',
      systemQuantity: 20,
      salesDuringAudit: 2,
      countedQuantity: 24,
      status: 'Counted',
    },
    {
      id: 3,
      missionId: 'MIS-2026-VAL-01',
      skuCode: '759204200889',
      depositCode: '150101',
      depositName: 'Almacén Principal',
      systemQuantity: 100,
      salesDuringAudit: 0,
      countedQuantity: 0,
      status: 'Pending_Count',
    },
  ]);

  const [transfers, setTransfers] = useState<MockTransfer[]>([]);
  const [activeWorker, setActiveWorker] = useState<string | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([
    'Sistema listo. Tareas cargadas en Read_Mission_Tasks con discrepancia cruzada.',
  ]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setExecutionLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 15)]);
  };

  // 1. Ejecutar Algoritmo de Compensación Virtual
  const runCompensationAlgorithm = () => {
    setActiveWorker('compensations');
    addLog(`Ejecutando evaluateVirtualCompensations("${missionId}", "${skuCode}")...`);

    setTimeout(() => {
      // Filtrar tareas del SKU y misión
      const targetTasks = tasks.filter(
        (t) => t.missionId === missionId && t.skuCode === skuCode
      );

      const balances = targetTasks.map((t) => {
        const effectiveTheorical = Math.max(0, t.systemQuantity - t.salesDuringAudit);
        const variance = t.countedQuantity - effectiveTheorical;
        return {
          ...t,
          effectiveTheorical,
          variance,
        };
      });

      const surpluses = balances.filter((b) => b.variance > 0);
      const deficits = balances.filter((b) => b.variance < 0);

      if (surpluses.length === 0 || deficits.length === 0) {
        addLog(`No se encontraron faltantes y sobrantes simultáneos para el SKU ${skuCode}.`);
        setActiveWorker(null);
        return;
      }

      const generated: MockTransfer[] = [];

      for (const def of deficits) {
        for (const sur of surpluses) {
          const needed = Math.abs(def.variance);
          const available = sur.variance;
          const toMove = Math.min(needed, available);

          if (toMove > 0) {
            generated.push({
              id: Date.now() + Math.floor(Math.random() * 1000),
              missionId,
              skuCode,
              fromDeposit: sur.depositCode,     // 150103
              toDeposit: def.depositCode,       // 150101
              transitDeposit: '150104',         // Nodo Tránsito Virtual
              quantityToMove: toMove,           // 5
              status: 'Suggested',
              surplusBefore: sur.variance,      // +6
              deficitBefore: def.variance,      // -5
              createdAt: new Date().toLocaleTimeString(),
            });

            addLog(
              `MATCH DETECTADO: Sobrante en ${sur.depositCode} (+${sur.variance}) cubre Faltante en ${def.depositCode} (${def.variance}).`
            );
            addLog(
              `GENERADO Read_Virtual_Transfers: ${sur.depositCode} -> ${def.depositCode} | Cantidad: ${toMove} unid. vía Nodo 150104.`
            );
          }
        }
      }

      setTransfers(generated);
      setActiveWorker(null);
    }, 600);
  };

  // 2. Simular Worker 1: Sondeo de 1 Hora (Actualización de Teóricos)
  const runWorker1 = () => {
    setActiveWorker('worker1');
    addLog(`[WORKER 1] Buscando tareas en 'Pending_Count' en Read_Mission_Tasks...`);

    setTimeout(() => {
      const pending = tasks.filter((t) => t.status === 'Pending_Count');
      addLog(`[WORKER 1] Se encontraron ${pending.length} tareas pendientes.`);
      addLog(`[WORKER 1] Encolando ${pending.length} registros en Relay_Queue con Status = 'Pending'...`);

      setTimeout(() => {
        addLog(`[RELAY AGENT] Procesando peticiones en MaraPlus (300ms inter-petición)...`);
        
        setTimeout(() => {
          // Reconciliar teóricos simulados
          setTasks((prev) =>
            prev.map((t) =>
              t.status === 'Pending_Count'
                ? {
                    ...t,
                    systemQuantity: 115,
                    salesDuringAudit: 1,
                    status: 'Counted',
                    countedQuantity: 114,
                  }
                : t
            )
          );
          addLog(`[WORKER 1] Teóricos actualizados en Read_Mission_Tasks: SystemQuantity=115, Sales=1.`);
          setActiveWorker(null);
        }, 800);
      }, 600);
    }, 500);
  };

  // 3. Simular Worker 2: Sondeo de 15 Minutos (Confirmación ERP)
  const runWorker2 = () => {
    setActiveWorker('worker2');
    addLog(`[WORKER 2] Sondeo de 15 Minutos: Consultando transferencias en estado 'Approved'...`);

    setTimeout(() => {
      // Auto-aprobar si están en Suggested para demostrar el ciclo
      setTransfers((prev) =>
        prev.map((t) => ({
          ...t,
          status: 'Pending_ERP_Sync',
          erpDocumentRef: `TRF-MARA-${Math.floor(10000 + Math.random() * 90000)}`,
        }))
      );
      addLog(`[WORKER 2] Generando orden de traspaso contable en MaraPlus vía Relay_Queue...`);

      setTimeout(() => {
        setTransfers((prev) =>
          prev.map((t) => ({
            ...t,
            status: 'Applied_ERP',
          }))
        );

        setTasks((prev) =>
          prev.map((t) =>
            t.skuCode === skuCode ? { ...t, status: 'Reconciled' } : t
          )
        );

        addLog(`[WORKER 2] Confirmación ERP recibida. Status = 'Applied_ERP'. Tareas marcadas como 'Reconciled'.`);
        setActiveWorker(null);
      }, 900);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Banner Explicativo del Caso Requerido */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-blue-950/40 border border-emerald-500/30 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400 shrink-0">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                Simulador del Algoritmo de Compensación & Nodo de Tránsito (150104)
                <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded font-mono border border-emerald-500/30">
                  Deno / TypeScript Edge Engine
                </span>
              </h3>
              <p className="text-sm text-slate-300 mt-1">
                Demuestra el caso solicitado: Almacén <code className="text-emerald-300 font-mono">150101</code> con faltante de <strong>-5 unidades</strong> y Piso de Ventas <code className="text-emerald-300 font-mono">150103</code> con sobrante de <strong>+6 unidades</strong>. El algoritmo compensa exactamente <strong>5 unidades</strong> hacia el Nodo Virtual <code className="text-amber-300 font-mono font-bold">150104</code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={runCompensationAlgorithm}
              disabled={activeWorker !== null}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium flex items-center gap-2 transition-all shadow-md shadow-emerald-950 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Evaluar Compensación
            </button>
            <button
              onClick={runWorker1}
              disabled={activeWorker !== null}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Worker 1 (1 Hora)
            </button>
            <button
              onClick={runWorker2}
              disabled={activeWorker !== null || transfers.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-purple-400" />
              Worker 2 (15 Min ERP)
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Tareas Actuales en Read_Mission_Tasks y Compensación Visual */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Depósito 150101 (Almacén Faltante) */}
        <div className="bg-slate-900 border border-red-500/30 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-400" />
              <span className="font-mono text-sm font-bold text-red-400">150101</span>
              <span className="text-xs text-slate-400">Almacén Central</span>
            </div>
            <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-300 rounded font-semibold">
              Faltante: -5 unid
            </span>
          </div>

          <div className="space-y-2 text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>SystemQuantity (Teórico):</span>
              <span className="font-mono text-slate-200 font-semibold">50</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>SalesDuringAudit (Ventas Día):</span>
              <span className="font-mono text-slate-200">0</span>
            </div>
            <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1.5">
              <span>Teórico Efectivo (50 - 0):</span>
              <span className="font-mono text-slate-200">50</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>CountedQuantity (Físico Real):</span>
              <span className="font-mono text-white font-bold">45</span>
            </div>
            <div className="flex justify-between font-bold text-red-400 border-t border-red-500/30 pt-1.5 text-sm">
              <span>Discrepancia:</span>
              <span>-5 unidades</span>
            </div>
          </div>
        </div>

        {/* NODO DE TRÁNSITO VIRTUAL (150104) */}
        <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-sm font-bold text-amber-400">150104</span>
                <span className="text-xs text-slate-400">Nodo Tránsito Virtual</span>
              </div>
              <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-300 rounded font-semibold">
                Puente Contable
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              Las unidades compensadas entre almacenes se asignan a este nodo virtual de auditoría para neutralizar la varianza total sin alterar el stock consolidado del ERP MaraPlus.
            </p>

            {transfers.length > 0 ? (
              <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-lg text-center animate-pulse">
                <span className="text-xs text-amber-300 uppercase tracking-wider block font-semibold">
                  Unidades en Tránsito Virtual
                </span>
                <span className="text-2xl font-mono font-bold text-amber-200">
                  +5 unidades
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  150103 ➔ [150104] ➔ 150101
                </span>
              </div>
            ) : (
              <div className="bg-slate-950/50 border border-slate-800 p-3 rounded-lg text-center text-xs text-slate-500">
                Presiona "Evaluar Compensación" para calcular las unidades en tránsito.
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 mt-2 text-center">
            Status: {transfers[0]?.status || 'Inactivo'}
          </div>
        </div>

        {/* Depósito 150103 (Piso de Ventas Sobrante) */}
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-sm font-bold text-emerald-400">150103</span>
              <span className="text-xs text-slate-400">Piso de Ventas</span>
            </div>
            <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-300 rounded font-semibold">
              Sobrante: +6 unid
            </span>
          </div>

          <div className="space-y-2 text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between text-slate-400">
              <span>SystemQuantity (Teórico):</span>
              <span className="font-mono text-slate-200 font-semibold">20</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>SalesDuringAudit (Ventas Día):</span>
              <span className="font-mono text-amber-300 font-semibold">-2</span>
            </div>
            <div className="flex justify-between text-slate-400 border-t border-slate-800 pt-1.5">
              <span>Teórico Efectivo (20 - 2):</span>
              <span className="font-mono text-slate-200">18</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>CountedQuantity (Físico Real):</span>
              <span className="font-mono text-white font-bold">24</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-400 border-t border-emerald-500/30 pt-1.5 text-sm">
              <span>Discrepancia:</span>
              <span>+6 unidades</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Registros en Read_Virtual_Transfers */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">
              Registros Generados en <code className="text-emerald-300 font-mono">Read_Virtual_Transfers</code>
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {transfers.length} {transfers.length === 1 ? 'compensación activa' : 'compensaciones activas'}
          </span>
        </div>

        {transfers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No se han generado compensaciones virtuales aún. Haz clic en "Evaluar Compensación" arriba para ejecutar el algoritmo.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-2.5 px-4">Misión / SKU</th>
                  <th className="py-2.5 px-4">FromDeposit (Sobrante)</th>
                  <th className="py-2.5 px-4">Nodo Tránsito</th>
                  <th className="py-2.5 px-4">ToDeposit (Faltante)</th>
                  <th className="py-2.5 px-4 text-center">QuantityToMove</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4">Doc ERP MaraPlus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <span className="text-white font-semibold block">{tr.skuCode}</span>
                      <span className="text-[11px] text-slate-500">{tr.missionId}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-400 font-bold block">{tr.fromDeposit}</span>
                      <span className="text-[11px] text-slate-400">Piso (+{tr.surplusBefore})</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-amber-400 font-bold px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                        {tr.transitDeposit}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-red-400 font-bold block">{tr.toDeposit}</span>
                      <span className="text-[11px] text-slate-400">Almacén ({tr.deficitBefore})</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-white text-sm">
                      <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded border border-cyan-800">
                        {tr.quantityToMove} unid
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          tr.status === 'Suggested'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : tr.status === 'Applied_ERP'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {tr.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {tr.erpDocumentRef ? (
                        <span className="text-purple-300 font-bold">{tr.erpDocumentRef}</span>
                      ) : (
                        <span className="text-slate-500 italic">Pendiente Worker 2</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Terminal de Eventos en Tiempo Real */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs">
        <div className="flex items-center justify-between text-slate-400 mb-2 border-b border-slate-800 pb-2">
          <span className="flex items-center gap-2 text-slate-300 font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${activeWorker ? 'animate-spin text-emerald-400' : 'text-slate-500'}`} />
            Consola de Ejecución Edge Functions (Supabase Logs)
          </span>
          <span className="text-[11px] text-slate-500">Últimos eventos del motor</span>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-2">
          {executionLog.map((logLine, idx) => (
            <div key={idx} className="text-slate-300 leading-relaxed font-mono">
              {logLine.includes('[WORKER 1]') ? (
                <span className="text-cyan-400">{logLine}</span>
              ) : logLine.includes('[WORKER 2]') ? (
                <span className="text-purple-400">{logLine}</span>
              ) : logLine.includes('MATCH DETECTADO') || logLine.includes('GENERADO') ? (
                <span className="text-emerald-400 font-semibold">{logLine}</span>
              ) : (
                <span>{logLine}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
