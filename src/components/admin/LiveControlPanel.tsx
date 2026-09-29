import React, { useState, useEffect } from 'react';
import {
  Activity,
  Sliders,
  RefreshCw,
  Server,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Boxes,
  Zap,
  Clock,
  CheckCircle2,
  Database,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

export interface LiveControlMetrics {
  globalProgressPct: number;
  skusTotal: number;
  skusCounted: number;
  skusPending: number;
  skusDiscrepancy: number;
  apiLatencyMs: number;
  financialImpact: {
    deficitUsd: number;  // Faltantes (-)
    surplusUsd: number;  // Sobrantes (+)
    netVarianceUsd: number; // Neto
    currency: string;
  };
  rateLimitDelayMs: number;
  relayAgentStatus: 'ONLINE' | 'THROTTLED' | 'PAUSED' | 'OFFLINE';
  lastUpdatedAt: string;
}

/**
 * Vista 1: Live Control Panel (/admin/live-control)
 * AUDITORIAPLUS+
 * 
 * Requerimientos FAD:
 * 1. Consume GET /api/v1/admin/live-control (con mock fallback resiliente).
 * 2. Tarjetas de métricas: Avance Global (%), SKUs Totales/Contados/Pendientes,
 *    Latencia API (ms), Impacto Financiero Faltante/Sobrante ($ USD).
 * 3. Slider para ajustar RateLimitDelayMs (200ms a 2000ms) que emita
 *    POST /api/v1/admin/config/rate-limit.
 */
export const LiveControlPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<LiveControlMetrics>({
    globalProgressPct: 78.4,
    skusTotal: 1240,
    skusCounted: 972,
    skusPending: 268,
    skusDiscrepancy: 34,
    apiLatencyMs: 142,
    financialImpact: {
      deficitUsd: 1420.50,
      surplusUsd: 890.25,
      netVarianceUsd: -530.25,
      currency: 'USD',
    },
    rateLimitDelayMs: 300,
    relayAgentStatus: 'ONLINE',
    lastUpdatedAt: new Date().toLocaleTimeString(),
  });

  const [sliderValue, setSliderValue] = useState<number>(300);
  const [isSavingSlider, setIsSavingSlider] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [sliderFeedback, setSliderFeedback] = useState<string | null>(null);

  // Consumir GET /api/v1/admin/live-control
  const fetchLiveMetrics = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/v1/admin/live-control', {
        headers: { 'Accept': 'application/json' },
      }).catch(() => null);

      if (res && res.ok) {
        const data = await res.json();
        setMetrics(data);
        setSliderValue(data.rateLimitDelayMs);
      } else {
        // Fallback dinámico con ligera variación estocástica en vivo
        setMetrics((prev) => ({
          ...prev,
          apiLatencyMs: Math.floor(120 + Math.random() * 45),
          lastUpdatedAt: new Date().toLocaleTimeString(),
        }));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveMetrics();
    const interval = setInterval(fetchLiveMetrics, 6000);
    return () => clearInterval(interval);
  }, []);

  // Emitir POST /api/v1/admin/config/rate-limit
  const handleRateLimitChange = async (newDelay: number) => {
    setSliderValue(newDelay);
    setIsSavingSlider(true);
    setSliderFeedback(null);

    try {
      const res = await fetch('/api/v1/admin/config/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateLimitDelayMs: newDelay }),
      }).catch(() => null);

      if (res && res.ok) {
        setSliderFeedback(`Rate Limit actualizado a ${newDelay}ms en Supabase & Relay Daemon.`);
      } else {
        setSliderFeedback(`Configuración aplicada localmente: ${newDelay}ms (Simulado Relay Agent).`);
      }

      setMetrics((prev) => ({ ...prev, rateLimitDelayMs: newDelay }));
    } finally {
      setIsSavingSlider(false);
      setTimeout(() => setSliderFeedback(null), 3500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Control Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Panel de Control en Vivo (Live Control)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                LIVE POLLING 6s
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Monitoreo continuo de ráfagas, avance y estrangulamiento de la cola física Relay_Queue.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">
            Última sync: <strong className="text-slate-200">{metrics.lastUpdatedAt}</strong>
          </span>
          <button
            onClick={fetchLiveMetrics}
            disabled={isRefreshing}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Refrescar métricas ahora"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid de Tarjetas de Métricas Requeridas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Avance Global (%) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Avance Global Misión</span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
              Meta 100%
            </span>
          </div>
          <div className="text-3xl font-black font-mono text-white mb-2">
            {metrics.globalProgressPct.toFixed(1)}%
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${metrics.globalProgressPct}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block font-mono">
            {metrics.skusCounted} de {metrics.skusTotal} SKUs auditados
          </span>
        </div>

        {/* 2. SKUs Totales / Contados / Pendientes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Distribución de SKUs</span>
            <Boxes className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center my-1 font-mono">
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-sans">Total</span>
              <span className="text-base font-bold text-white">{metrics.skusTotal}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-emerald-400 block uppercase font-sans">Contados</span>
              <span className="text-base font-bold text-emerald-400">{metrics.skusCounted}</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-amber-400 block uppercase font-sans">Pend.</span>
              <span className="text-base font-bold text-amber-300">{metrics.skusPending}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
            <span>Con discrepancia preliminar:</span>
            <span className="font-mono font-bold text-amber-400">{metrics.skusDiscrepancy}</span>
          </div>
        </div>

        {/* 3. Latencia API (ms) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Latencia API MaraPlus</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-[10px] font-mono">
              <Zap className="w-3 h-3 text-indigo-400" />
              192.168.15.225
            </div>
          </div>
          <div className="text-3xl font-black font-mono text-cyan-400 mb-1 flex items-baseline gap-1">
            {metrics.apiLatencyMs}
            <span className="text-sm font-sans text-slate-400">ms</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2 font-mono">
            <span>Estado Relay Daemon:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold text-[10px]">
              {metrics.relayAgentStatus}
            </span>
          </div>
        </div>

        {/* 4. Impacto Financiero Faltante / Sobrante ($ USD) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Impacto Financiero</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-red-400 flex items-center gap-1">
                <ArrowDownRight className="w-3.5 h-3.5" /> Faltantes:
              </span>
              <span className="font-bold text-red-300">
                -${metrics.financialImpact.deficitUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> Sobrantes:
              </span>
              <span className="font-bold text-emerald-300">
                +${metrics.financialImpact.surplusUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-1 text-[11px]">
              <span className="text-slate-400">Varianza Neta:</span>
              <span className={`font-black ${metrics.financialImpact.netVarianceUsd < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                ${metrics.financialImpact.netVarianceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Slider para RateLimitDelayMs (200ms a 2000ms) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Ajuste Dinámico de Rate Limit (Relay Daemon)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  POST /api/v1/admin/config/rate-limit
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Controla el retraso entre peticiones consecutivas enviadas al ERP local MaraPlus para evitar saturación del servidor on-premise.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-xs text-slate-400">Delay Actual:</span>
            <span className="text-xl font-black text-purple-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
              {sliderValue} ms
            </span>
          </div>
        </div>

        {/* Slider Input */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>200 ms (Rápido / Servidor Holgado)</span>
            <span>1000 ms</span>
            <span>2000 ms (Conservador / Alta Carga)</span>
          </div>

          <input
            type="range"
            min={200}
            max={2000}
            step={50}
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            onMouseUp={() => handleRateLimitChange(sliderValue)}
            onTouchEnd={() => handleRateLimitChange(sliderValue)}
            className="w-full h-3 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-purple-500 border border-slate-800 focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRateLimitChange(sliderValue)}
                disabled={isSavingSlider}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {isSavingSlider ? 'Guardando en Supabase...' : 'Aplicar Configuración'}
              </button>
              {sliderFeedback && (
                <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {sliderFeedback}
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              Tope por Lote: 10 peticiones | Pausa Inter-Lote: 2,000 ms
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
