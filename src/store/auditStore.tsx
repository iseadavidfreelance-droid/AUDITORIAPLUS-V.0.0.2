/**
 * AUDITORIAPLUS+ Global State Engine
 * React Context & Custom Hooks for Session, Connectivity & Offline Queue Management
 * 
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

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  getActiveQueueCount,
  enqueueOfflineCountEvent,
  OfflineCountEvent,
  seedLocalSkuMaster,
  cacheMission,
  LocalSkuMaster,
} from '../offline/db';
import {
  flushOfflineQueue,
  SyncResult,
  FlushOptions,
  registerOnlineSyncListener,
} from '../offline/syncEngine';
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
  // Estado Global
  currentMissionId: string | null;
  currentDepositCode: string | null;
  userAuth: UserAuth | null;
  isOffline: boolean;
  activeQueueCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  isSimulatedOffline: boolean;

  // Acciones Requeridas
  setSession: (params: SetSessionParams) => void;
  syncOfflineEvents: (options?: FlushOptions) => Promise<SyncResult>;

  // Acciones Auxiliares de Terreno
  recordCount: (skuCode: string, quantity: number) => Promise<OfflineCountEvent>;
  toggleSimulatedOffline: (force?: boolean) => void;
  refreshQueueCount: () => Promise<number>;
}

const AuditStoreContext = createContext<AuditStoreContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'auditoriaplus_session_v1';

export const AuditStoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Estado de Sesión y Autenticación
  const [currentMissionId, setCurrentMissionId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved).currentMissionId || 'MIS-2026-VAL-01';
    } catch {}
    return 'MIS-2026-VAL-01';
  });

  const [currentDepositCode, setCurrentDepositCode] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) return JSON.parse(saved).currentDepositCode || '150101';
    } catch {}
    return '150101';
  });

  const [userAuth, setUserAuth] = useState<UserAuth | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved && JSON.parse(saved).userAuth) return JSON.parse(saved).userAuth;
    } catch {}
    return {
      userId: 'USR-AUD-8821',
      email: 'auditor.principal@auditoriaplus.com',
      token: 'jwt-auth-auditor-session-token-v2',
      role: 'Auditor_Lider',
      fullName: 'Carlos Mendoza (Auditor MaraPlus)',
    };
  });

  // 2. Estado de Red y Conectividad
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);

  // isOffline es true si el navegador perdió red o si el usuario activó la simulación
  const isOffline = !browserOnline || isSimulatedOffline;

  // 3. Conteo de la Cola Offline
  const [activeQueueCount, setActiveQueueCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<number | boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const isSyncingRef = useRef(false);

  // Refrescar conteo de cola desde IndexedDB
  const refreshQueueCount = useCallback(async (): Promise<number> => {
    const count = await getActiveQueueCount();
    setActiveQueueCount(count);
    return count;
  }, []);

  // 4. Acción Requerida: setSession()
  const setSession = useCallback((params: SetSessionParams) => {
    setCurrentMissionId(params.missionId);
    setCurrentDepositCode(params.depositCode);

    let updatedUser = userAuth;
    if (params.user) {
      updatedUser = params.user;
      setUserAuth(params.user);
    }

    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          currentMissionId: params.missionId,
          currentDepositCode: params.depositCode,
          userAuth: updatedUser,
        })
      );
    } catch (err) {
      console.warn('[AuditStore] No se pudo guardar sesión en localStorage:', err);
    }

    console.log(`[AuditStore] Sesión actualizada: Misión ${params.missionId} | Depósito ${params.depositCode}`);
  }, [userAuth]);

  // 5. Acción Requerida: syncOfflineEvents()
  const syncOfflineEvents = useCallback(async (options: FlushOptions = {}): Promise<SyncResult> => {
    if (isSyncingRef.current) {
      console.log('[AuditStore] Sincronización en curso, omitiendo llamada duplicada.');
      return {
        total: activeQueueCount,
        processed: 0,
        synced: 0,
        rejected: 0,
        failedDueToNetwork: false,
        errors: ['Already syncing'],
      };
    }

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const mergedOptions: FlushOptions = {
        authToken: userAuth?.token,
        simulateNetworkFail: isSimulatedOffline,
        ...options,
      };

      const result = await flushOfflineQueue(mergedOptions);
      setLastSyncResult(result);
      await refreshQueueCount();
      return result;
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [activeQueueCount, isSimulatedOffline, refreshQueueCount, userAuth?.token]);

  // 6. Acción de Terreno: recordCount() (Registra un conteo físico offline)
  const recordCount = useCallback(async (skuCode: string, quantity: number): Promise<OfflineCountEvent> => {
    if (!currentMissionId || !currentDepositCode) {
      throw new Error('Debe configurar una sesión activa (Misión y Depósito) antes de registrar conteos.');
    }

    const event = await enqueueOfflineCountEvent({
      mission_id: currentMissionId,
      deposit_code: currentDepositCode,
      sku_code: skuCode,
      counted_quantity: quantity,
      user_id: userAuth?.userId || 'ANON_AUDITOR',
      user_name: userAuth?.fullName || 'Auditor Offline',
    });

    await refreshQueueCount();

    // Si tenemos conexión real y no estamos en simulación offline, intentamos sincronización inmediata
    if (!isOffline) {
      // Disparar sincronización en background
      syncOfflineEvents().catch((err) =>
        console.warn('[AuditStore] Auto-sync falló, quedará en cola IndexedDB:', err)
      );
    } else {
      // Registrar Background Sync en Service Worker para cuando regrese la red
      requestBackgroundSync().catch(() => {});
    }

    return event;
  }, [currentMissionId, currentDepositCode, userAuth, isOffline, refreshQueueCount, syncOfflineEvents]);

  // Conmutar simulación de desconexión (para auditorías bajo sótano / pruebas)
  const toggleSimulatedOffline = useCallback((force?: boolean) => {
    setIsSimulatedOffline((prev) => {
      const next = force !== undefined ? force : !prev;
      console.log(`[AuditStore] Modo Offline Simulado: ${next ? 'ACTIVADO (Sin Red)' : 'DESACTIVADO (Conectado)'}`);
      return next;
    });
  }, []);

  // Listeners de Red del Navegador (online / offline)
  useEffect(() => {
    const handleBrowserOnline = () => {
      console.log('[AuditStore] Navegador reconectado a Internet (Evento online).');
      setBrowserOnline(true);
      if (!isSimulatedOffline) {
        syncOfflineEvents().catch(console.error);
      }
    };

    const handleBrowserOffline = () => {
      console.log('[AuditStore] Navegador perdió conexión a Internet (Evento offline).');
      setBrowserOnline(false);
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    // Escuchar eventos de actualización de cola emitidos por el syncEngine
    const handleQueueCustomEvent = () => {
      refreshQueueCount();
    };

    window.addEventListener('auditoriaplus:queue_updated', handleQueueCustomEvent);

    // Registrar sincronizador automático global online
    const unregisterSyncListener = registerOnlineSyncListener({
      authToken: userAuth?.token,
    });

    // Carga inicial de conteo de cola y datos de prueba en IndexedDB
    refreshQueueCount();
    seedInitialDemoData();

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('auditoriaplus:queue_updated', handleQueueCustomEvent);
      unregisterSyncListener();
    };
  }, [isSimulatedOffline, refreshQueueCount, syncOfflineEvents, userAuth?.token]);

  const value: AuditStoreContextValue = {
    currentMissionId,
    currentDepositCode,
    userAuth,
    isOffline,
    activeQueueCount,
    isSyncing: Boolean(isSyncing),
    lastSyncResult,
    isSimulatedOffline,
    setSession,
    syncOfflineEvents,
    recordCount,
    toggleSimulatedOffline,
    refreshQueueCount,
  };

  return <AuditStoreContext.Provider value={value}>{children}</AuditStoreContext.Provider>;
};

/**
 * Hook de acceso al store global de AUDITORIAPLUS+
 */
export function useAuditStore(): AuditStoreContextValue {
  const context = useContext(AuditStoreContext);
  if (!context) {
    throw new Error('useAuditStore debe usarse dentro de un <AuditStoreProvider>');
  }
  return context;
}

/**
 * Semilla de demostración para missions_cache y sku_master_local
 */
async function seedInitialDemoData() {
  try {
    // 1. Cachear misión activa
    await cacheMission({
      mission_id: 'MIS-2026-VAL-01',
      title: 'Auditoría Mensual Retail Valencia - Depósitos 150101 & 150103',
      deposit_codes: ['150101', '150103', '150104'],
      status: 'In_Progress',
      cached_at: new Date().toISOString(),
      theoretical_items_count: 420,
    });

    // 2. Sembrar maestro de SKUs para escaneo offline
    const demoSkus: LocalSkuMaster[] = [
      {
        sku_code: '759103100245',
        barcode: '759103100245',
        description: 'Aceite de Oliva Extra Virgen 500ml',
        category: 'Alimentos & Abarrotes',
        unit_of_measure: 'UND',
        deposit_code: '150101',
        reference_price: 6.5,
        expected_theoretical: 50,
        updated_at: new Date().toISOString(),
      },
      {
        sku_code: '759204200889',
        barcode: '759204200889',
        description: 'Detergente Líquido Multiuso 1L',
        category: 'Limpieza del Hogar',
        unit_of_measure: 'UND',
        deposit_code: '150101',
        reference_price: 3.2,
        expected_theoretical: 100,
        updated_at: new Date().toISOString(),
      },
      {
        sku_code: '759305300112',
        barcode: '759305300112',
        description: 'Arroz Blanco Grado Especial 1kg',
        category: 'Granos',
        unit_of_measure: 'UND',
        deposit_code: '150103',
        reference_price: 1.45,
        expected_theoretical: 200,
        updated_at: new Date().toISOString(),
      },
    ];

    await seedLocalSkuMaster(demoSkus);
  } catch (err) {
    console.warn('[AuditStore] Falló seed inicial de IndexedDB:', err);
  }
}
