import React, { useState, useEffect } from 'react';
import { Header, TabType } from './components/Header';
import { CodeViewer } from './components/CodeViewer';
import { LiveSimulator } from './components/LiveSimulator';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { CompensationsSimulator } from './components/CompensationsSimulator';
import { OfflinePersistenceManager } from './components/OfflinePersistenceManager';
import { PdaScanView } from './components/pda/PdaScanView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AuditStoreProvider } from './store/auditStore';
import { registerServiceWorker } from './offline/serviceWorker';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('pda');

  // Registrar Service Worker para soporte PWA y Background Sync
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <AuditStoreProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-white">
        {/* Top Navigation & Status */}
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content Area */}
        <main className={`flex-1 w-full mx-auto ${activeTab === 'pda' ? 'p-0 sm:py-6 max-w-lg' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8'}`}>
          {activeTab === 'pda' && <PdaScanView />}
          {activeTab === 'admin' && <AdminDashboard />}
          {activeTab === 'offline' && <OfflinePersistenceManager />}
          {activeTab === 'compensations' && <CompensationsSimulator />}
          {activeTab === 'simulator' && <LiveSimulator />}
          {activeTab === 'artifacts' && <CodeViewer />}
          {activeTab === 'guide' && <ArchitectureGuide />}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>AUDITORIAPLUS+ Architecture Suite • Offline-First PWA & MaraPlus ERP</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-slate-400">
              <span>IndexedDB (missions_cache, sku_master, offline_events)</span>
              <span>•</span>
              <span>flushOfflineQueue (FIFO)</span>
              <span>•</span>
              <span>Nodo Tránsito 150104</span>
              <span>•</span>
              <span>Relay Daemon (300ms / 2s lote)</span>
            </div>
          </div>
        </footer>
      </div>
    </AuditStoreProvider>
  );
}
