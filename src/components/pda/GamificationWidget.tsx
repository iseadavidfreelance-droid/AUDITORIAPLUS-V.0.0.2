import React from 'react';
import { Flame, Trophy, Award, Zap, TrendingUp } from 'lucide-react';

interface GamificationWidgetProps {
  depositCode: string;
  totalXp: number;
  activeStreak: number;
  itemsAuditedCount?: number;
}

/**
 * Widget de Gamificación Inferior para PDAs - AUDITORIAPLUS+
 * 
 * Regla FAD:
 * Muestra:
 *  - Título de Rango
 *  - XP Totales
 *  - Racha Activa con multiplicador dinámico:
 *      * 1.4x para depósito 150101 (Almacén Principal)
 *      * 1.0x para depósito 150103 (Piso de Ventas)
 */
export const GamificationWidget: React.FC<GamificationWidgetProps> = ({
  depositCode,
  totalXp,
  activeStreak,
  itemsAuditedCount = 0,
}) => {
  // Determinación de Multiplicador según el depósito
  const isAlmacen = depositCode === '150101';
  const multiplier = isAlmacen ? 1.4 : 1.0;

  // Cálculo del Rango según XP
  const getRank = (xp: number) => {
    if (xp >= 5000) return { title: 'Auditor Maestro Legendario', color: 'text-amber-400', level: 5 };
    if (xp >= 3000) return { title: 'Auditor Senior MaraPlus', color: 'text-purple-400', level: 4 };
    if (xp >= 1500) return { title: 'Auditor Élite de Terreno', color: 'text-cyan-400', level: 3 };
    if (xp >= 500) return { title: 'Auditor Certificado', color: 'text-emerald-400', level: 2 };
    return { title: 'Auditor Aspirante', color: 'text-slate-300', level: 1 };
  };

  const rank = getRank(totalXp);
  const nextLevelXp = rank.level === 1 ? 500 : rank.level === 2 ? 1500 : rank.level === 3 ? 3000 : 5000;
  const prevLevelXp = rank.level === 1 ? 0 : rank.level === 2 ? 500 : rank.level === 3 ? 1500 : 3000;
  const progressPercent = Math.min(100, Math.max(0, ((totalXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));

  return (
    <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-2.5 shadow-2xl backdrop-blur-md">
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        {/* 1. Título de Rango */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-indigo-600/30 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">
              Rango PDA
            </span>
            <div className={`text-xs font-bold truncate ${rank.color}`}>
              {rank.title}
            </div>
          </div>
        </div>

        {/* 2. Racha Activa & Multiplicador */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800">
          <div className={`p-1 rounded-lg ${activeStreak > 0 ? 'bg-orange-500/20 text-orange-400 animate-pulse' : 'text-slate-600'}`}>
            <Flame className="w-4 h-4" />
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span className="text-xs font-mono font-black text-white">
                {activeStreak}
              </span>
              <span className="text-[10px] text-slate-400">racha</span>
            </div>
            <div className="flex items-center gap-1 justify-end">
              <span
                className={`text-[9px] font-mono font-bold px-1 rounded ${
                  isAlmacen
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {multiplier.toFixed(1)}x {isAlmacen ? 'Almacén' : 'Piso'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. XP Totales */}
        <div className="text-right shrink-0">
          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono block">
            XP Totales
          </span>
          <div className="flex items-center justify-end gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-xs font-mono font-extrabold text-amber-300">
              {totalXp.toLocaleString()} XP
            </span>
          </div>
        </div>
      </div>

      {/* Barra de progreso sutil hacia el siguiente rango */}
      <div className="max-w-md mx-auto mt-1.5 flex items-center gap-2">
        <div className="flex-1 bg-slate-950 h-1 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-[#263988] via-indigo-500 to-[#009045] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-slate-500">
          {Math.round(progressPercent)}%
        </span>
      </div>
    </div>
  );
};
