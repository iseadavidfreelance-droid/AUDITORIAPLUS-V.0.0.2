import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Edit3,
  RefreshCw,
  Send,
  Boxes,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Zap,
  Check,
  FileCheck,
} from 'lucide-react';

export interface AdminTaskItem {
  id: number;
  missionId: string;
  depositCode: string;
  skuCode: string;
  description: string;
  systemQuantity: number;
  countedQuantity: number;
  salesDuringAudit: number;
  status: 'Pending_Count' | 'Counted' | 'Completed' | 'Reconciled_Match';
  isLocked: boolean;
  closedBy?: string;
  lastUpdated: string;
}

export interface AdminVirtualTransferItem {
  id: number;
  missionId: string;
  skuCode: string;
  fromDeposit: string;
  toDeposit: string;
  transitDeposit: string;
  quantityToMove: number;
  status: 'Suggested' | 'Pending_ERP_Confirmation' | 'Executed';
  surplusBefore: number;
  deficitBefore: number;
  erpDocumentRef?: string | null;
  createdAt: string;
}

/**
 * Vista 3: Overrides y Traslados Virtuales (/admin/overrides y /admin/traslados)
 * AUDITORIAPLUS+
 * 
 * Requerimientos FAD:
 * 1. Tabla interactiva para ejecutar:
 *    - POST /api/v1/admin/override-task (Ajuste manual)
 *    - POST /api/v1/admin/unlock-sku (Desbloqueo)
 *    - POST /api/v1/admin/sync-now (Prioridad en cola)
 * 2. Tabla de monitoreo del Nodo 150104 (Read_Virtual_Transfers) mostrando estados:
 *    Suggested, Pending_ERP_Confirmation, Executed.
 */
export const OverridesAndTransfersView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'overrides' | 'transfers'>('overrides');

  // Estado para Overrides de Tareas
  const [tasks, setTasks] = useState<AdminTaskItem[]>([
    {
      id: 101,
      missionId: 'MIS-2026-VAL-01',
      depositCode: '150101',
      skuCode: '759103',
      description: 'Aceite Vegetal Comestible 1L',
      systemQuantity: 28,
      countedQuantity: 24,
      salesDuringAudit: 0,
      status: 'Completed',
      isLocked: true,
      closedBy: 'Supervisor Roberto Ramos',
      lastUpdated: '10:15:00 UTC',
    },
    {
      id: 102,
      missionId: 'MIS-2026-VAL-01',
      depositCode: '150103',
      skuCode: '759103',
      description: 'Aceite Vegetal Comestible 1L',
      systemQuantity: 20,
      countedQuantity: 26,
      salesDuringAudit: 2,
      status: 'Reconciled_Match',
      isLocked: true,
      closedBy: 'Auditor Carlos Mendoza',
      lastUpdated: '10:18:22 UTC',
    },
    {
      id: 103,
      missionId: 'MIS-2026-VAL-01',
      depositCode: '150101',
      skuCode: '000045',
      description: 'Harina de Maíz Blanco 1Kg',
      systemQuantity: 50,
      countedQuantity: 45,
      salesDuringAudit: 0,
      status: 'Counted',
      isLocked: false,
      lastUpdated: '10:45:10 UTC',
    },
    {
      id: 104,
      missionId: 'MIS-2026-VAL-01',
      depositCode: '150101',
      skuCode: '000889',
      description: 'Detergente en Polvo 1Kg',
      systemQuantity: 120,
      countedQuantity: 0,
      salesDuringAudit: 0,
      status: 'Pending_Count',
      isLocked: false,
      lastUpdated: '09:00:00 UTC',
    },
  ]);

  // Estado para Traslados del Nodo 150104 (Read_Virtual_Transfers)
  const [transfers, setTransfers] = useState<AdminVirtualTransferItem[]>([
    {
      id: 501,
      missionId: 'MIS-2026-VAL-01',
      skuCode: '759103',
      fromDeposit: '150103', // Sobrante (+6)
      toDeposit: '150101',   // Faltante (-4)
      transitDeposit: '150104',
      quantityToMove: 4,
      status: 'Suggested',
      surplusBefore: 6,
      deficitBefore: -4,
      erpDocumentRef: null,
      createdAt: '10:20:15 UTC',
    },
    {
      id: 502,
      missionId: 'MIS-2026-VAL-01',
      skuCode: '000045',
      fromDeposit: '150103',
      toDeposit: '150101',
      transitDeposit: '150104',
      quantityToMove: 5,
      status: 'Pending_ERP_Confirmation',
      surplusBefore: 6,
      deficitBefore: -5,
      erpDocumentRef: 'TRF-QUEUED-8812',
      createdAt: '09:45:30 UTC',
    },
    {
      id: 500,
      missionId: 'MIS-2026-VAL-01',
      skuCode: '759204',
      fromDeposit: '150103',
      toDeposit: '150101',
      transitDeposit: '150104',
      quantityToMove: 10,
      status: 'Executed',
      surplusBefore: 12,
      deficitBefore: -10,
      erpDocumentRef: 'TRF-MP-2026-0049',
      createdAt: '08:30:00 UTC',
    },
  ]);

  // Modal para Override Manual
  const [overrideModalTask, setOverrideModalTask] = useState<AdminTaskItem | null>(null);
  const [overrideQuantity, setOverrideQuantity] = useState<number>(0);
  const [overrideJustification, setOverrideJustification] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // 1. POST /api/v1/admin/override-task
  const handleExecuteOverride = async () => {
    if (!overrideModalTask) return;

    try {
      await fetch('/api/v1/admin/override-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: overrideModalTask.id,
          skuCode: overrideModalTask.skuCode,
          depositCode: overrideModalTask.depositCode,
          newQuantity: overrideQuantity,
          justification: overrideJustification,
        }),
      }).catch(() => null);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === overrideModalTask.id
            ? {
                ...t,
                countedQuantity: overrideQuantity,
                status: 'Counted',
                lastUpdated: `${new Date().toLocaleTimeString()} (Override)`,
              }
            : t
        )
      );

      showFeedback(`Override aplicado para SKU ${overrideModalTask.skuCode}: Cantidad ajustada a ${overrideQuantity}.`);
      setOverrideModalTask(null);
    } catch (err: any) {
      showFeedback(`Error al aplicar override: ${err.message}`);
    }
  };

  // 2. POST /api/v1/admin/unlock-sku
  const handleUnlockSku = async (task: AdminTaskItem) => {
    try {
      await fetch('/api/v1/admin/unlock-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          skuCode: task.skuCode,
          depositCode: task.depositCode,
        }),
      }).catch(() => null);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, isLocked: false, status: 'Counted' }
            : t
        )
      );

      showFeedback(`SKU ${task.skuCode} en depósito ${task.depositCode} desbloqueado exitosamente para re-conteo.`);
    } catch (err: any) {
      showFeedback(`Error al desbloquear: ${err.message}`);
    }
  };

  // 3. POST /api/v1/admin/sync-now
  const handleSyncNow = async (task: AdminTaskItem) => {
    try {
      await fetch('/api/v1/admin/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuCode: task.skuCode,
          depositCode: task.depositCode,
          priority: 'HIGH',
        }),
      }).catch(() => null);

      showFeedback(`Prioridad forzada en Relay_Queue para SKU ${task.skuCode}. El Relay Agent consultará el teórico de inmediato.`);
    } catch (err: any) {
      showFeedback(`Error en sync-now: ${err.message}`);
    }
  };

  // Acciones en Traslados Virtuales (Aprobar / Despachar)
  const handleApproveTransfer = (transferId: number) => {
    setTransfers((prev) =>
      prev.map((tr) =>
        tr.id === transferId
          ? {
              ...tr,
              status: 'Pending_ERP_Confirmation',
              erpDocumentRef: `TRF-DISPATCH-${Math.floor(1000 + Math.random() * 9000)}`,
            }
          : tr
      )
    );
    showFeedback(`Traspaso #${transferId} aprobado. Encolado a MaraPlus ERP vía Relay Agent.`);
  };

  const handleSimulateErpConfirm = (transferId: number) => {
    setTransfers((prev) =>
      prev.map((tr) =>
        tr.id === transferId
          ? {
              ...tr,
              status: 'Executed',
              erpDocumentRef: `TRF-MP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            }
          : tr
      )
    );
    showFeedback(`Confirmación oficial de MaraPlus recibida. Traspaso #${transferId} marcado como Executed.`);
  };

  return (
    <div className="space-y-6">
      {/* Selector de Sub-pestañas: Overrides vs Traslados */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSubTab('overrides')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'overrides'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-300" />
            Overrides & Desbloqueos (/admin/overrides)
          </button>

          <button
            onClick={() => setActiveSubTab('transfers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'transfers'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4 text-indigo-300" />
            Monitoreo Nodo 150104 (/admin/traslados)
          </button>
        </div>

        {actionFeedback && (
          <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs px-3 py-1.5 rounded-xl font-mono flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUB-VISTA 1: TABLA DE OVERRIDES Y DESBLOQUEOS                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'overrides' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Control de Tuplas, Bloqueos y Ajustes Manuales (Read_Mission_Tasks)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Permite anular cierres automáticos, forzar prioridades en la cola Relay_Queue y ajustar conteos físicos.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">{tasks.length} tareas cargadas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-3 px-4">SKU / Descripción</th>
                  <th className="py-3 px-4">Depósito</th>
                  <th className="py-3 px-4 text-center">Teórico</th>
                  <th className="py-3 px-4 text-center">Físico</th>
                  <th className="py-3 px-4 text-center">Estado Tupla</th>
                  <th className="py-3 px-4 text-center">Bloqueo Re-conteo</th>
                  <th className="py-3 px-4 text-right">Acciones Administrativas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-sans">
                      <span className="font-mono text-white font-bold block text-sm">{task.skuCode}</span>
                      <span className="text-slate-400 text-xs block">{task.description}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        task.depositCode === '150101' ? 'bg-amber-500/15 text-amber-400' : 'bg-cyan-500/15 text-cyan-400'
                      }`}>
                        {task.depositCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-300">
                      {task.systemQuantity}
                    </td>
                    <td className="py-3.5 px-4 text-center font-black text-white text-sm">
                      {task.countedQuantity}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        task.status === 'Completed' || task.status === 'Reconciled_Match'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {task.isLocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-bold text-[10px]">
                          <Lock className="w-3 h-3" /> BLOQUEADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                          <Unlock className="w-3 h-3 text-emerald-400" /> Abierto
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1. Desbloquear si está bloqueado */}
                        {task.isLocked && (
                          <button
                            onClick={() => handleUnlockSku(task)}
                            className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600 text-amber-200 hover:text-white rounded-lg text-[11px] font-sans font-semibold transition border border-amber-500/40 cursor-pointer flex items-center gap-1"
                            title="POST /api/v1/admin/unlock-sku"
                          >
                            <Unlock className="w-3 h-3" /> Desbloquear
                          </button>
                        )}

                        {/* 2. Override Task (Ajuste Manual) */}
                        <button
                          onClick={() => {
                            setOverrideModalTask(task);
                            setOverrideQuantity(task.countedQuantity);
                            setOverrideJustification('');
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-sans font-semibold transition border border-slate-700 cursor-pointer flex items-center gap-1"
                          title="POST /api/v1/admin/override-task"
                        >
                          <Edit3 className="w-3 h-3 text-cyan-400" /> Override
                        </button>

                        {/* 3. Sync Now (Prioridad en cola) */}
                        <button
                          onClick={() => handleSyncNow(task)}
                          className="p-1 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-lg transition border border-slate-700 cursor-pointer"
                          title="POST /api/v1/admin/sync-now (Prioridad Relay_Queue)"
                        >
                          <Zap className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VISTA 2: MONITOREO DEL NODO 150104 (Read_Virtual_Transfers)           */}
      {/* ========================================================================= */}
      {activeSubTab === 'transfers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4">
          <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-400" />
                Matriz de Traspasos Virtuales • Nodo de Tránsito 150104
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seguimiento de estados obligatorios: <strong>Suggested</strong>, <strong>Pending_ERP_Confirmation</strong> y <strong>Executed</strong>.
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 bg-indigo-500/15 text-indigo-300 rounded-full border border-indigo-500/30">
              Nodo Virtual 150104
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-3 px-4">ID / Misión</th>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Origen (Sobrante)</th>
                  <th className="py-3 px-4">Nodo Virtual</th>
                  <th className="py-3 px-4">Destino (Faltante)</th>
                  <th className="py-3 px-4 text-center">Unidades</th>
                  <th className="py-3 px-4 text-center">Estado FAD</th>
                  <th className="py-3 px-4">Doc MaraPlus ERP</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-white block">#{tr.id}</span>
                      <span className="text-[10px] text-slate-500 font-sans">{tr.missionId}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-200">
                      {tr.skuCode}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-emerald-400 font-bold block">{tr.fromDeposit}</span>
                      <span className="text-[10px] text-slate-500">Sobrante: +{tr.surplusBefore}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded font-black text-amber-300 bg-amber-500/15 border border-amber-500/30">
                        {tr.transitDeposit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-red-400 font-bold block">{tr.toDeposit}</span>
                      <span className="text-[10px] text-slate-500">Faltante: {tr.deficitBefore}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold text-sm">
                        {tr.quantityToMove} unid
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        tr.status === 'Suggested'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : tr.status === 'Pending_ERP_Confirmation'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {tr.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {tr.erpDocumentRef ? (
                        <span className="text-purple-300 font-bold">{tr.erpDocumentRef}</span>
                      ) : (
                        <span className="text-slate-500 italic">Pendiente Aprobación</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {tr.status === 'Suggested' && (
                        <button
                          onClick={() => handleApproveTransfer(tr.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-sans font-semibold transition cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Send className="w-3 h-3" /> Aprobar & Enviar
                        </button>
                      )}
                      {tr.status === 'Pending_ERP_Confirmation' && (
                        <button
                          onClick={() => handleSimulateErpConfirm(tr.id)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-700 text-emerald-300 hover:text-white rounded-lg text-xs font-sans font-semibold transition border border-slate-700 cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Check className="w-3 h-3" /> Confirmar ERP
                        </button>
                      )}
                      {tr.status === 'Executed' && (
                        <span className="text-emerald-400 font-bold text-xs flex items-center gap-1 justify-end">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Reconciliado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Override de Tarea (POST /api/v1/admin/override-task) */}
      {overrideModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Override Manual de Auditoría</h3>
                <span className="text-xs text-slate-400 font-mono">POST /api/v1/admin/override-task</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono space-y-1">
                <div className="text-slate-400">SKU: <strong className="text-white">{overrideModalTask.skuCode}</strong></div>
                <div className="text-slate-400">Depósito: <strong className="text-amber-400">{overrideModalTask.depositCode}</strong></div>
                <div className="text-slate-400">Cantidad Previa: <strong className="text-white">{overrideModalTask.countedQuantity}</strong></div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nueva Cantidad Física:</label>
                <input
                  type="number"
                  value={overrideQuantity}
                  onChange={(e) => setOverrideQuantity(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Justificación de Auditoría / Causa:</label>
                <textarea
                  rows={2}
                  value={overrideJustification}
                  onChange={(e) => setOverrideJustification(e.target.value)}
                  placeholder="Ej. Mercancía re-ubicada en rack B-12 sin etiqueta previa..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setOverrideModalTask(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteOverride}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg shadow-cyan-950"
              >
                Confirmar Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
