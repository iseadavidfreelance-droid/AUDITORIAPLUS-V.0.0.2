import React, { useState } from 'react';
import {
  Sliders,
  UploadCloud,
  Layers,
  BarChart3,
  Shield,
  Activity,
  Boxes,
  Database,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { LiveControlPanel } from './LiveControlPanel';
import { FileIngestionView } from './FileIngestionView';
import { OverridesAndTransfersView } from './OverridesAndTransfersView';
import { VisualAnalyticsView } from './VisualAnalyticsView';

export type AdminSubView = 'live-control' | 'ingesta' | 'overrides' | 'analitica';

export const AdminDashboard: React.FC = () => {
  const [activeSubView, setActiveSubView] = useState<AdminSubView>('live-control');

  return (
    <div className="space-y-6">
      {/* Top Banner Módulo de Administración */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Shield className="w-3 h-3 text-indigo-400" />
                CENTRO DE CONTROL ADMINISTRATIVO
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AUDITORIAPLUS+ BACKOFFICE
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Módulo de Administración y Control Central
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Monitoreo en tiempo real de misiones de inventario, calibración de latencia y rate-limiting,
              ingesta criptográfica SHA-256 de catálogos y costos, gestión de overrides y traslados
              virtuales hacia el Nodo 150104, y analítica de discrepancias financieras.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-right">
              <div className="text-[10px] text-slate-400 font-medium">Misión Activa</div>
              <div className="text-xs font-mono font-bold text-cyan-400">MIS-2026-VAL-01</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-right">
              <div className="text-[10px] text-slate-400 font-medium">Estado del Relay</div>
              <div className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                CONECTADO
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Navegación de las 4 Vistas Administrativas */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-slate-800/80">
          <button
            onClick={() => setActiveSubView('live-control')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeSubView === 'live-control'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-300" />
            <span>1. Live Control Panel</span>
            <span className="text-[10px] font-mono opacity-70">(/admin/live-control)</span>
          </button>

          <button
            onClick={() => setActiveSubView('ingesta')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeSubView === 'ingesta'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-indigo-300" />
            <span>2. Ingesta Criptográfica</span>
            <span className="text-[10px] font-mono opacity-70">(/admin/ingesta)</span>
          </button>

          <button
            onClick={() => setActiveSubView('overrides')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeSubView === 'overrides'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-300" />
            <span>3. Overrides & Nodo 150104</span>
            <span className="text-[10px] font-mono opacity-70">(/admin/overrides)</span>
          </button>

          <button
            onClick={() => setActiveSubView('analitica')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
              activeSubView === 'analitica'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/40'
                : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-300" />
            <span>4. Analítica Visual (4 Gráficos)</span>
            <span className="text-[10px] font-mono opacity-70">(/admin/analitica)</span>
          </button>
        </div>
      </div>

      {/* Renderizado de la Sub-Vista Seleccionada */}
      <div>
        {activeSubView === 'live-control' && <LiveControlPanel />}
        {activeSubView === 'ingesta' && <FileIngestionView />}
        {activeSubView === 'overrides' && <OverridesAndTransfersView />}
        {activeSubView === 'analitica' && <VisualAnalyticsView />}
      </div>
    </div>
  );
};
