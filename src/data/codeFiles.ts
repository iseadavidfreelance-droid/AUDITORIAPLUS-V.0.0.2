export interface CodeFile {
  id: string;
  name: string;
  path: string;
  category: 'pwa-store' | 'indexeddb' | 'sync-engine' | 'edge-worker' | 'compensations' | 'relay' | 'database' | 'pda-views' | 'admin-views';
  language: string;
  description: string;
  badge?: string;
  content: string;
}

export const CODE_FILES: CodeFile[] = [
  {
    id: 'pda-scan-view',
    name: 'PdaScanView.tsx',
    path: 'src/components/pda/PdaScanView.tsx',
    category: 'pwa-store',
    language: 'typescript',
    description: 'Vista V1 Operativa PDA (/misiones/:id/escaneo): Header #263988, Input autoFocus persistente, BarcodeDetector, LPAD(6), Gamificación y Modales FAD.',
    badge: 'Vista V1 FAD',
    content: `// Ver implementación completa en src/components/pda/PdaScanView.tsx
// Header #263988, autofocus persistente, video BarcodeDetector, normalización LPAD(6)
// y orquestación de Modal A (Bloqueo Re-conteo) y Modal B (Ficha Incompleta).`,
  },
  {
    id: 'modal-a-reconteo',
    name: 'ModalReconteoBloqueado.tsx',
    path: 'src/components/pda/ModalReconteoBloqueado.tsx',
    category: 'pwa-store',
    language: 'typescript',
    description: 'Modal A (Bloqueo Re-conteo): Overlay Ámbar (#F59E0B) para tuplas Completed o Reconciled_Match. Muestra auditor, hora de cierre y cantidad.',
    badge: 'Modal A (Ámbar)',
    content: `// Ver implementación completa en src/components/pda/ModalReconteoBloqueado.tsx
// Overlay Ámbar #F59E0B bloqueando inputs con nombre de auditor, timestamp de cierre y cantidad.`,
  },
  {
    id: 'modal-b-ficha',
    name: 'ModalFichaIncompleta.tsx',
    path: 'src/components/pda/ModalFichaIncompleta.tsx',
    category: 'pwa-store',
    language: 'typescript',
    description: 'Modal B (Ficha Incompleta): Activo si IsFichaComplete = false. Descripción, Departamento, Grupo, Código adicional y CTA Verde (#009045).',
    badge: 'Modal B (Verde)',
    content: `// Ver implementación completa en src/components/pda/ModalFichaIncompleta.tsx
// Formulario de catalogación de terreno con CTA Verde #009045 emitiendo SkuFichaCompleted.`,
  },
  {
    id: 'lpad-helper',
    name: 'lpad.ts',
    path: 'src/utils/lpad.ts',
    category: 'pwa-store',
    language: 'typescript',
    description: 'Función de normalización obligatoria LPAD(input, 6, "0") antes de enviar al estado global.',
    badge: 'LPAD(6)',
    content: `export function lpad(input: string | number, length = 6, padChar = '0'): string {
  const str = String(input ?? '').trim();
  if (str.length >= length) return str;
  return str.padStart(length, padChar);
}`,
  },
  {
    id: 'audit-store',
    name: 'auditStore.tsx',
    path: 'src/store/auditStore.tsx',
    category: 'pwa-store',
    language: 'typescript',
    description: 'Estado Global AUDITORIAPLUS+: currentMissionId, currentDepositCode, userAuth, isOffline, activeQueueCount y acciones setSession(), syncOfflineEvents().',
    badge: 'Global Store',
    content: `/**
 * AUDITORIAPLUS+ Global State Engine (React Context & Hooks)
 * Cumple estrictamente con:
 * - currentMissionId: string | null
 * - currentDepositCode: string | null
 * - userAuth: UserAuth | null
 * - isOffline: boolean
 * - activeQueueCount: number
 * Acciones:
 * - setSession(params: { missionId: string; depositCode: string; user?: UserAuth })
 * - syncOfflineEvents(options?: FlushOptions)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getActiveQueueCount, enqueueOfflineCountEvent, OfflineCountEvent } from '../offline/db';
import { flushOfflineQueue, SyncResult, FlushOptions, registerOnlineSyncListener } from '../offline/syncEngine';
import { requestBackgroundSync } from '../offline/serviceWorker';

export interface UserAuth {
  userId: string;
  email: string;
  token: string;
  role: string;
  fullName: string;
}

export interface SetSessionParams {
  missionId: string;
  depositCode: string;
  user?: UserAuth;
}

export interface AuditStoreContextValue {
  currentMissionId: string | null;
  currentDepositCode: string | null;
  userAuth: UserAuth | null;
  isOffline: boolean;
  activeQueueCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  setSession: (params: SetSessionParams) => void;
  syncOfflineEvents: (options?: FlushOptions) => Promise<SyncResult>;
  recordCount: (skuCode: string, quantity: number) => Promise<OfflineCountEvent>;
  toggleSimulatedOffline: (force?: boolean) => void;
}

const AuditStoreContext = createContext<AuditStoreContextValue | undefined>(undefined);

export const AuditStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentMissionId, setCurrentMissionId] = useState<string | null>('MIS-2026-VAL-01');
  const [currentDepositCode, setCurrentDepositCode] = useState<string | null>('150101');
  const [userAuth, setUserAuth] = useState<UserAuth | null>({
    userId: 'USR-AUD-8821',
    email: 'auditor.principal@auditoriaplus.com',
    token: 'jwt-auth-session-v2',
    role: 'Auditor_Lider',
    fullName: 'Carlos Mendoza (Auditor MaraPlus)',
  });

  const [browserOnline, setBrowserOnline] = useState<boolean>(navigator.onLine);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const isOffline = !browserOnline || isSimulatedOffline;

  const [activeQueueCount, setActiveQueueCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Acción: setSession()
  const setSession = useCallback((params: SetSessionParams) => {
    setCurrentMissionId(params.missionId);
    setCurrentDepositCode(params.depositCode);
    if (params.user) setUserAuth(params.user);
    console.log(\`[AuditStore] Sesión: Misión \${params.missionId}, Depósito \${params.depositCode}\`);
  }, []);

  // Acción: syncOfflineEvents()
  const syncOfflineEvents = useCallback(async (options: FlushOptions = {}): Promise<SyncResult> => {
    setIsSyncing(true);
    try {
      const res = await flushOfflineQueue({ authToken: userAuth?.token, ...options });
      setLastSyncResult(res);
      const count = await getActiveQueueCount();
      setActiveQueueCount(count);
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [userAuth?.token]);

  return (
    <AuditStoreContext.Provider
      value={{
        currentMissionId,
        currentDepositCode,
        userAuth,
        isOffline,
        activeQueueCount,
        isSyncing,
        lastSyncResult,
        setSession,
        syncOfflineEvents,
        recordCount: async (sku, qty) => {
          const evt = await enqueueOfflineCountEvent({
            mission_id: currentMissionId || '',
            deposit_code: currentDepositCode || '',
            sku_code: sku,
            counted_quantity: qty,
            user_id: userAuth?.userId || 'ANON',
          });
          const c = await getActiveQueueCount();
          setActiveQueueCount(c);
          if (!isOffline) syncOfflineEvents().catch(() => {});
          return evt;
        },
        toggleSimulatedOffline: () => setIsSimulatedOffline((prev) => !prev),
      }}
    >
      {children}
    </AuditStoreContext.Provider>
  );
};

export const useAuditStore = () => useContext(AuditStoreContext)!;`,
  },
  {
    id: 'offline-db',
    name: 'db.ts (IndexedDB con idb)',
    path: 'src/offline/db.ts',
    category: 'indexeddb',
    language: 'typescript',
    description: 'Resiliencia Offline en IndexedDB con idb: missions_cache, sku_master_local y offline_events_queue (idx_mission_deposit, idx_sequence, idx_status).',
    badge: 'IndexedDB (idb)',
    content: `/**
 * AUDITORIAPLUS+ Offline Persistence Layer con 'idb'
 * 3 Stores requeridos:
 * 1. missions_cache (key: mission_id)
 * 2. sku_master_local (key: sku_code, idx_barcode, idx_deposit)
 * 3. offline_events_queue (key: event_id)
 *    Índices obligatorios:
 *    - idx_mission_deposit: ['mission_id', 'deposit_code']
 *    - idx_sequence: 'sequence_number'
 *    - idx_status: 'status'
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface OfflineCountEvent {
  event_id: string;
  sequence_number: number;
  mission_id: string;
  deposit_code: string;
  sku_code: string;
  counted_quantity: number;
  timestamp_utc: string;
  status: 'pending' | 'processing' | 'synced' | 'rejected' | 'failed';
  user_id: string;
  retry_count: number;
  last_error?: string | null;
  rejection_reason?: string | null;
  synced_at?: string | null;
}

export interface AuditoriaPlusDBSchema extends DBSchema {
  missions_cache: {
    key: string;
    value: { mission_id: string; title: string; deposit_codes: string[]; cached_at: string };
  };
  sku_master_local: {
    key: string;
    value: { sku_code: string; barcode: string; description: string; deposit_code: string };
    indexes: { idx_barcode: string; idx_deposit: string };
  };
  offline_events_queue: {
    key: string;
    value: OfflineCountEvent;
    indexes: {
      idx_mission_deposit: [string, string]; // Índice compuesto obligatorio
      idx_sequence: number;                  // Índice obligatorio de secuencia
      idx_status: string;                    // Índice obligatorio de estado
      idx_timestamp: string;
    };
  };
}

export function getOfflineDB() {
  return openDB<AuditoriaPlusDBSchema>('AUDITORIAPLUS_OFFLINE_DB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('missions_cache')) {
        db.createObjectStore('missions_cache', { keyPath: 'mission_id' });
      }
      if (!db.objectStoreNames.contains('sku_master_local')) {
        const s = db.createObjectStore('sku_master_local', { keyPath: 'sku_code' });
        s.createIndex('idx_barcode', 'barcode');
        s.createIndex('idx_deposit', 'deposit_code');
      }
      if (!db.objectStoreNames.contains('offline_events_queue')) {
        const q = db.createObjectStore('offline_events_queue', { keyPath: 'event_id' });
        q.createIndex('idx_mission_deposit', ['mission_id', 'deposit_code']);
        q.createIndex('idx_sequence', 'sequence_number');
        q.createIndex('idx_status', 'status');
        q.createIndex('idx_timestamp', 'timestamp_utc');
      }
    },
  });
}`,
  },
  {
    id: 'sync-engine',
    name: 'syncEngine.ts (flushOfflineQueue)',
    path: 'src/offline/syncEngine.ts',
    category: 'sync-engine',
    language: 'typescript',
    description: 'Sincronizador flushOfflineQueue: Orden estricto timestamp_utc (FIFO), ráfaga secuencial a /api/v1/audit/register-count, HTTP 409 -> rejected, fallo red -> pausa orden.',
    badge: 'Sync Engine',
    content: `/**
 * Sincronizador flushOfflineQueue
 * - Extrae offline_events_queue con status 'pending'
 * - Orden estricto por timestamp_utc original (FIFO)
 * - Ráfaga secuencial a /api/v1/audit/register-count
 * - HTTP 409 (Conflicto por Override) -> status = 'rejected'
 * - Fallo de red -> Detiene ráfaga y reintenta respetando el orden
 */

import { getPendingEventsChronological, updateEventStatus } from './db';

export async function flushOfflineQueue(options = {}) {
  const pendingEvents = await getPendingEventsChronological();
  const endpoint = '/api/v1/audit/register-count';

  for (const event of pendingEvents) {
    await updateEventStatus(event.event_id, { status: 'processing' });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': event.event_id },
        body: JSON.stringify(event),
      });

      if (response.status === 200 || response.status === 201) {
        // Éxito: Marcar como 'synced'
        await updateEventStatus(event.event_id, { status: 'synced', synced_at: new Date().toISOString() });
      } else if (response.status === 409) {
        // Conflicto por Override: Marcar como 'rejected' en la base local
        await updateEventStatus(event.event_id, {
          status: 'rejected',
          rejection_reason: 'HTTP 409: Conflicto por Override (conteo o misión bloqueada)',
        });
      } else {
        throw new Error(\`HTTP \${response.status}\`);
      }
    } catch (networkError) {
      // Fallo de red: devolver a pending, incrementar reintento y DETENER ráfaga
      await updateEventStatus(event.event_id, { status: 'pending', incrementRetry: true });
      console.warn('[SyncEngine] Ráfaga detenida por fallo de red para respetar orden.');
      break;
    }
  }
}`,
  },
  {
    id: 'worker1',
    name: 'sync-theoricals-worker/index.ts',
    path: 'supabase/functions/sync-theoricals-worker/index.ts',
    category: 'edge-worker',
    language: 'typescript',
    description: 'Worker 1 (Sondeo 1 Hora): Selecciona Pending_Count, inserta en Relay_Queue y concilia teóricos.',
    badge: 'Worker 1',
    content: `// Ver implementación completa en supabase/functions/sync-theoricals-worker/index.ts`,
  },
  {
    id: 'compensations-algo',
    name: 'evaluateVirtualCompensations.ts',
    path: 'supabase/functions/compensations-engine/evaluateVirtualCompensations.ts',
    category: 'compensations',
    language: 'typescript',
    description: 'Algoritmo de Compensación Virtual y Nodo de Tránsito (150104) para faltantes y sobrantes cruzados.',
    badge: 'Nodo 150104',
    content: `// Ver implementación completa en supabase/functions/compensations-engine/evaluateVirtualCompensations.ts`,
  },
  {
    id: 'worker2',
    name: 'erp-confirmation-worker/index.ts',
    path: 'supabase/functions/erp-confirmation-worker/index.ts',
    category: 'edge-worker',
    language: 'typescript',
    description: 'Worker 2 (Sondeo 15 Minutos): Confirmación y conciliación contable de traspasos en MaraPlus ERP.',
    badge: 'Worker 2',
    content: `// Ver implementación completa en supabase/functions/erp-confirmation-worker/index.ts`,
  },
  {
    id: 'schema-sql',
    name: 'schema-auditoriaplus.sql',
    path: 'supabase/schema-auditoriaplus.sql',
    category: 'database',
    language: 'sql',
    description: 'Definición DDL completa de Read_Mission_Tasks, Read_Virtual_Transfers, Relay_Queue y Realtime.',
    badge: 'PostgreSQL',
    content: `// Ver schema en supabase/schema-auditoriaplus.sql`,
  },
  {
    id: 'relay-index',
    name: 'index.js (On-Premise Agent)',
    path: 'relay-agent/index.js',
    category: 'relay',
    language: 'javascript',
    description: 'Agente local dockerizado en Node.js con Realtime, FIFO, Rate Limiting (300ms / 2s lote de 10) y 3 reintentos.',
    badge: 'Daemon',
    content: `// Ver archivo en relay-agent/index.js`,
  },
  {
    id: 'admin-live-control',
    name: 'LiveControlPanel.tsx',
    path: 'src/components/admin/LiveControlPanel.tsx',
    category: 'admin-views',
    language: 'typescript',
    description: 'Vista 1 (/admin/live-control): Métricas globales, Avance %, SKUs, Latencia ms, Impacto $ USD y Slider RateLimit 200-2000ms.',
    badge: 'Live Control',
    content: `// Ver implementación completa en src/components/admin/LiveControlPanel.tsx
// Consume GET /api/v1/admin/live-control y emite POST /api/v1/admin/config/rate-limit`,
  },
  {
    id: 'admin-ingesta',
    name: 'FileIngestionView.tsx',
    path: 'src/components/admin/FileIngestionView.tsx',
    category: 'admin-views',
    language: 'typescript',
    description: 'Vista 2 (/admin/ingesta): Drag & Drop Excel A (Taxonomía) y Excel B (Costos) con hash criptográfico SHA-256 nativo.',
    badge: 'SHA-256 Ingesta',
    content: `// Ver implementación completa en src/components/admin/FileIngestionView.tsx
// Hashing SHA-256 criptográfico con window.crypto.subtle.digest y parseo de columnas FAD.`,
  },
  {
    id: 'admin-overrides',
    name: 'OverridesAndTransfersView.tsx',
    path: 'src/components/admin/OverridesAndTransfersView.tsx',
    category: 'admin-views',
    language: 'typescript',
    description: 'Vista 3 (/admin/overrides y /admin/traslados): Overrides manuales, desbloqueo de SKUs, sync-now y monitoreo Nodo 150104.',
    badge: 'Overrides & 150104',
    content: `// Ver implementación completa en src/components/admin/OverridesAndTransfersView.tsx
// Endpoints POST override-task, unlock-sku, sync-now y tabla de estados Suggested/Pending/Executed.`,
  },
  {
    id: 'admin-analitica',
    name: 'VisualAnalyticsView.tsx',
    path: 'src/components/admin/VisualAnalyticsView.tsx',
    category: 'admin-views',
    language: 'typescript',
    description: 'Vista 4 (/admin/analitica): Curva S de avance, Treemap financiero USD, Histograma divergente (-10 a +10) y Rendimiento vs Latencia.',
    badge: '4 Gráficos FAD',
    content: `// Ver implementación completa en src/components/admin/VisualAnalyticsView.tsx
// 4 visualizaciones analíticas de alto rendimiento con Tailwind y SVG vectoriales interactivos.`,
  },
];
