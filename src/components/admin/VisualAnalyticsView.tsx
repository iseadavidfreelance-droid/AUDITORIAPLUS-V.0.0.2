import React, { useState } from 'react';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Layers,
  Calendar,
  Download,
  Filter,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';

/**
 * Vista 4: Analítica Visual (/admin/analitica)
 * AUDITORIAPLUS+
 * 
 * Requerimientos FAD:
 * 1. Curva S de Avance (Líneas Teórico vs Real vs Reconciliado).
 * 2. Heatmap/Treemap de Discrepancias Financieras ($ USD).
 * 3. Histograma Divergente de Errores (Varianza -10 a +10).
 * 4. Rendimiento Operativo vs Latencia (Escaneos/min vs Latencia ms).
 */
export const VisualAnalyticsView: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'current_shift' | 'full_mission'>('current_shift');
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 1. Datos para Curva S de Avance
  // ---------------------------------------------------------------------------
  const sCurveData = [
    { time: '08:00', planned: 5, actual: 4, reconciled: 0 },
    { time: '10:00', planned: 20, actual: 18, reconciled: 10 },
    { time: '12:00', planned: 45, actual: 42, reconciled: 32 },
    { time: '14:00', planned: 70, actual: 68, reconciled: 55 },
    { time: '16:00', planned: 88, actual: 85, reconciled: 78 },
    { time: '18:00', planned: 96, actual: 94, reconciled: 90 },
    { time: '20:00', planned: 100, actual: 98, reconciled: 96 },
  ];

  // ---------------------------------------------------------------------------
  // 2. Datos para Heatmap/Treemap de Discrepancias Financieras ($ USD)
  // ---------------------------------------------------------------------------
  const treemapData = [
    { name: 'Abarrotes y Alimentos', deposit: '150101', impactUsd: -640.50, units: -28, type: 'deficit', color: 'from-red-950/80 to-red-900/60 border-red-500/40 text-red-200' },
    { name: 'Abarrotes (Retail)', deposit: '150103', impactUsd: +480.00, units: +22, type: 'surplus', color: 'from-emerald-950/80 to-emerald-900/60 border-emerald-500/40 text-emerald-200' },
    { name: 'Farmacia y Salud', deposit: '150101', impactUsd: -310.20, units: -8, type: 'deficit', color: 'from-red-950/70 to-red-900/50 border-red-500/30 text-red-300' },
    { name: 'Cuidado Personal', deposit: '150103', impactUsd: +245.50, units: +14, type: 'surplus', color: 'from-teal-950/70 to-teal-900/50 border-teal-500/30 text-teal-200' },
    { name: 'Limpieza y Hogar', deposit: '150101', impactUsd: -180.00, units: -12, type: 'deficit', color: 'from-amber-950/70 to-amber-900/50 border-amber-500/30 text-amber-200' },
    { name: 'Perecederos', deposit: '150103', impactUsd: +115.00, units: +6, type: 'surplus', color: 'from-cyan-950/70 to-cyan-900/50 border-cyan-500/30 text-cyan-200' },
  ];

  // ---------------------------------------------------------------------------
  // 3. Datos para Histograma Divergente (-10 a +10)
  // ---------------------------------------------------------------------------
  const divergentHistogram = [
    { variance: -10, count: 2, label: '-10+' },
    { variance: -8, count: 4, label: '-8' },
    { variance: -6, count: 7, label: '-6' },
    { variance: -5, count: 12, label: '-5' },
    { variance: -4, count: 16, label: '-4' },
    { variance: -3, count: 24, label: '-3' },
    { variance: -2, count: 42, label: '-2' },
    { variance: -1, count: 85, label: '-1' },
    { variance: 0, count: 460, label: '0 Exacto' }, // Exact Match
    { variance: 1, count: 78, label: '+1' },
    { variance: 2, count: 38, label: '+2' },
    { variance: 3, count: 20, label: '+3' },
    { variance: 4, count: 14, label: '+4' },
    { variance: 5, count: 10, label: '+5' },
    { variance: 6, count: 8, label: '+6' },
    { variance: 8, count: 5, label: '+8' },
    { variance: 10, count: 3, label: '+10+' },
  ];

  // ---------------------------------------------------------------------------
  // 4. Datos de Rendimiento Operativo vs Latencia
  // ---------------------------------------------------------------------------
  const performanceLatencyData = [
    { hour: '08:00', scansPerMin: 14, latencyMs: 95 },
    { hour: '09:00', scansPerMin: 28, latencyMs: 110 },
    { hour: '10:00', scansPerMin: 52, latencyMs: 148 },
    { hour: '11:00', scansPerMin: 68, latencyMs: 182 },
    { hour: '12:00', scansPerMin: 45, latencyMs: 135 },
    { hour: '13:00', scansPerMin: 30, latencyMs: 105 },
    { hour: '14:00', scansPerMin: 64, latencyMs: 175 },
    { hour: '15:00', scansPerMin: 58, latencyMs: 160 },
    { hour: '16:00', scansPerMin: 38, latencyMs: 125 },
  ];

  return (
    <div className="space-y-8">
      {/* Cabecera de Analítica */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              AUDITORIAPLUS+ ANALYTICS ENGINE
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              4 GRÁFICOS OBLIGATORIOS FAD
            </span>
          </div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            Analítica Visual de Misión (/admin/analitica)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Métricas de avance, dispersión de discrepancias en almacenes, errores divergentes y salud del canal ERP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 text-xs font-mono rounded-xl px-3 py-2 text-slate-200 focus:outline-none"
          >
            <option value="current_shift">Turno Actual (Hoy)</option>
            <option value="full_mission">Misión Completa (MIS-2026-VAL-01)</option>
          </select>
        </div>
      </div>

      {/* Grid 2x2 para los 4 Gráficos Obligatorios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================================= */}
        {/* GRÁFICO 1: CURVA S DE AVANCE                                              */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-bold text-white">1. Curva S de Avance Operativo</h3>
                <span className="text-[10px] text-slate-400 font-mono">Teórico vs Real vs Reconciliado</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-0.5 bg-slate-500 rounded" /> Teórico
              </span>
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2.5 h-0.5 bg-cyan-400 rounded" /> Real (Contado)
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-0.5 bg-emerald-400 rounded" /> Reconciliado
              </span>
            </div>
          </div>

          {/* Renderizado SVG Responsivo de la Curva S */}
          <div className="h-64 w-full relative pt-2">
            <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
              {/* Líneas Guía Horizontales */}
              {[0, 25, 50, 75, 100].map((val) => {
                const y = 180 - (val / 100) * 160;
                return (
                  <g key={val}>
                    <line x1="40" y1={y} x2="490" y2={y} stroke="#334155" strokeDasharray="3 3" strokeWidth="0.8" />
                    <text x="32" y={y + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* Curva 1: Teórico Programado (Gris/Slate) */}
              <path
                d="M 50 172 Q 180 150 250 110 T 480 20"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              {/* Curva 2: Avance Real Contado (Cian) */}
              <path
                d="M 50 174 Q 180 155 250 115 T 480 24"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="3"
                className="drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]"
              />

              {/* Curva 3: Reconciliado con Nodo 150104 (Verde) */}
              <path
                d="M 50 180 Q 180 168 250 135 T 480 27"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                className="drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
              />

              {/* Puntos Clave */}
              {sCurveData.map((pt, i) => {
                const x = 50 + (i / (sCurveData.length - 1)) * 430;
                const yReal = 180 - (pt.actual / 100) * 160;
                return (
                  <g key={i}>
                    <circle cx={x} cy={yReal} r="4" fill="#22d3ee" stroke="#0f172a" strokeWidth="2" />
                    <text x={x} y="195" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="monospace">
                      {pt.time}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span>Meta de Cierre: <strong>20:00 (100%)</strong></span>
            <span className="text-emerald-400 font-bold">Avance dentro de tolerancia (+1.8% vs plan)</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* GRÁFICO 2: HEATMAP / TREEMAP DE DISCREPANCIAS FINANCIERAS                */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">2. Heatmap de Discrepancias Financieras</h3>
                <span className="text-[10px] text-slate-400 font-mono">Impacto en $ USD por Departamento / Depósito</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              Neto: -$530.25 USD
            </span>
          </div>

          {/* Cuadrícula Treemap Proporcional */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 h-64">
            {treemapData.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl border bg-gradient-to-br ${item.color} flex flex-col justify-between transition hover:scale-[1.02] shadow-md`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold uppercase tracking-wider">{item.deposit}</span>
                    <span className="px-1.5 py-0.2 rounded bg-black/30 font-black">
                      {item.units > 0 ? `+${item.units}` : item.units} u
                    </span>
                  </div>
                  <h4 className="text-xs font-bold mt-1 text-white leading-tight">
                    {item.name}
                  </h4>
                </div>

                <div className="mt-2 text-right">
                  <span className="text-sm font-mono font-black block">
                    {item.impactUsd > 0 ? `+$${item.impactUsd.toFixed(2)}` : `-$${Math.abs(item.impactUsd).toFixed(2)}`}
                  </span>
                  <span className="text-[9px] uppercase font-mono tracking-wider opacity-80">
                    {item.type === 'deficit' ? 'Faltante Neto' : 'Sobrante Neto'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Faltantes Almacén
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sobrantes Retail
            </span>
            <span className="text-amber-300 font-bold">Compensables vía 150104: 82%</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* GRÁFICO 3: HISTOGRAMA DIVERGENTE DE ERRORES (-10 a +10)                   */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-sm font-bold text-white">3. Histograma Divergente de Errores</h3>
                <span className="text-[10px] text-slate-400 font-mono">Dispersión de Varianza (-10 a +10 unidades)</span>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Exact Match: 460 SKUs (58.4%)
            </span>
          </div>

          {/* Gráfico de Barras Divergente SVG */}
          <div className="h-64 w-full relative pt-2">
            <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
              {/* Eje Cero Central */}
              <line x1="250" y1="10" x2="250" y2="175" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />

              {divergentHistogram.map((item, index) => {
                const maxCount = 460;
                const barHeight = Math.max(4, (item.count / maxCount) * 150);
                const x = 30 + index * 26;
                const y = 170 - barHeight;

                // Color según sea faltante (-), exacto (0) o sobrante (+)
                const barFill =
                  item.variance < 0 ? '#ef4444' : item.variance === 0 ? '#10b981' : '#3b82f6';

                return (
                  <g key={index} className="hover:opacity-80 transition cursor-pointer">
                    <rect
                      x={x}
                      y={y}
                      width="18"
                      height={barHeight}
                      rx="3"
                      fill={barFill}
                      opacity={item.variance === 0 ? 0.95 : 0.8}
                    />
                    <text
                      x={x + 9}
                      y="185"
                      fill="#94a3b8"
                      fontSize="7"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {item.variance === 0 ? '0' : item.variance}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-red-400">◄ Faltantes (-10 a -1)</span>
            <span className="text-emerald-400 font-bold">Exactos: 0</span>
            <span className="text-blue-400">Sobrantes (+1 a +10) ►</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* GRÁFICO 4: RENDIMIENTO OPERATIVO VS LATENCIA                             */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">4. Rendimiento Operativo vs Latencia</h3>
                <span className="text-[10px] text-slate-400 font-mono">Escaneos / Minuto vs Latencia MaraPlus (ms)</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-indigo-400">
                <span className="w-2 h-2 rounded bg-indigo-500" /> Escaneos/min
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-0.5 bg-amber-400 rounded" /> Latencia (ms)
              </span>
            </div>
          </div>

          {/* Gráfico Combinado SVG: Barras (Escaneos) + Línea (Latencia) */}
          <div className="h-64 w-full relative pt-2">
            <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible">
              {/* Eje de Fondo */}
              <line x1="30" y1="170" x2="490" y2="170" stroke="#334155" strokeWidth="1" />

              {/* Barras de Escaneos / Minuto */}
              {performanceLatencyData.map((pt, i) => {
                const x = 45 + i * 48;
                const barHeight = (pt.scansPerMin / 80) * 140;
                const y = 170 - barHeight;

                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y}
                      width="20"
                      height={barHeight}
                      rx="4"
                      fill="#6366f1"
                      opacity="0.85"
                    />
                    <text x={x + 10} y="185" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                      {pt.hour}
                    </text>
                  </g>
                );
              })}

              {/* Línea de Latencia (Ámbar) */}
              <path
                d="M 55 125 L 103 118 L 151 90 L 199 65 L 247 100 L 295 120 L 343 70 L 391 80 L 439 105"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                className="drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
              />

              {/* Puntos de Latencia */}
              {performanceLatencyData.map((pt, i) => {
                const x = 55 + i * 48;
                const yLat = 170 - (pt.latencyMs / 220) * 140;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={yLat}
                    r="3.5"
                    fill="#f59e0b"
                    stroke="#0f172a"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span>Pico: <strong>68 escaneos/min (11:00)</strong></span>
            <span className="text-amber-400">Latencia media estable: 142 ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};
