import React from 'react';
import { ShieldAlert, Lock, UserCheck, Clock, Layers, AlertTriangle } from 'lucide-react';

export interface BlockedReconteoData {
  missionId: string;
  depositCode: string;
  skuCode: string;
  status: 'Completed' | 'Reconciled_Match';
  auditorName: string;
  closedAt: string;
  finalQuantity: number;
}

interface ModalReconteoBloqueadoProps {
  isOpen: boolean;
  data: BlockedReconteoData | null;
  onClose: () => void;
  onRequestSupervisorOverride?: (data: BlockedReconteoData) => void;
}

/**
 * Modal A (Bloqueo Re-conteo) - AUDITORIAPLUS+
 * 
 * Regla FAD:
 * Despliega un overlay Ámbar (#F59E0B) si la tupla (MissionId + DepositCode + SkuCode)
 * tiene estado Completed o Reconciled_Match. Muestra el nombre del auditor, hora de
 * cierre y cantidad bloqueando inputs.
 */
export const ModalReconteoBloqueado: React.FC<ModalReconteoBloqueadoProps> = ({
  isOpen,
  data,
  onClose,
  onRequestSupervisorOverride,
}) => {
  if (!isOpen || !data) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Contenedor con borde y sombra estilizada en Ámbar (#F59E0B) */}
      <div className="w-full max-w-md bg-slate-900 border-2 border-[#F59E0B] rounded-2xl shadow-2xl shadow-[#F59E0B]/20 overflow-hidden">
        {/* Cabecera Ámbar (#F59E0B) */}
        <div className="bg-[#F59E0B] px-5 py-4 text-slate-950 flex items-center gap-3">
          <div className="p-2 bg-slate-950/15 rounded-xl text-slate-950">
            <Lock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-900 block">
              Excepción de Auditoría • Modal A
            </span>
            <h2 className="text-base font-black tracking-tight leading-tight">
              Bloqueo de Re-conteo (Línea Cerrada)
            </h2>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 space-y-4">
          {/* Mensaje de Restricción */}
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200 leading-relaxed font-medium">
              Esta tupla ya fue finalizada y reconciliada. No se permiten entradas adicionales de conteo físico para este SKU en este depósito sin anulación de supervisor.
            </p>
          </div>

          {/* Ficha de Información de la Tupla Bloqueada */}
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400 font-sans">SKU Bloqueado:</span>
              <span className="text-white font-bold text-sm bg-slate-800 px-2 py-0.5 rounded">
                {data.skuCode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pb-2 border-b border-slate-800">
              <div>
                <span className="text-slate-500 font-sans block">Misión:</span>
                <span className="text-slate-200 font-bold">{data.missionId}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block">Depósito:</span>
                <span className="text-amber-400 font-bold">{data.depositCode}</span>
              </div>
            </div>

            {/* Metadatos Clave Requeridos: Auditor, Hora de Cierre y Cantidad */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Auditor que cerró:
                </span>
                <span className="text-white font-semibold">{data.auditorName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Hora de Cierre:
                </span>
                <span className="text-cyan-300 font-semibold">{data.closedAt}</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400 font-sans flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Cantidad Registrada:
                </span>
                <span className="text-base text-[#F59E0B] font-black">
                  {data.finalQuantity} unidades
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-sans">Estado de Tupla:</span>
                <span className="px-2 py-0.5 bg-[#F59E0B]/20 text-[#F59E0B] rounded font-bold uppercase">
                  {data.status}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#F59E0B]/25 active:scale-[0.98] cursor-pointer"
            >
              Entendido (Cerrar Aviso)
            </button>

            {onRequestSupervisorOverride && (
              <button
                type="button"
                onClick={() => onRequestSupervisorOverride(data)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-medium text-xs rounded-xl border border-slate-700 transition active:scale-[0.98] cursor-pointer"
              >
                Solicitar Override de Supervisor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
