/**
 * AUDITORIAPLUS+ Offline Persistence Layer
 * IndexedDB Schema & Database Operations with 'idb'
 * 
 * Cumple estrictamente con los 3 stores requeridos:
 * 1. missions_cache: Misiones y depósitos cacheados para operación sin conexión.
 * 2. sku_master_local: Catálogo maestro de SKUs para escaneo y validación offline rápida.
 * 3. offline_events_queue: Cola transaccional de conteos realizados offline.
 *    Índices obligatorios:
 *    - idx_mission_deposit: ['mission_id', 'deposit_code']
 *    - idx_sequence: 'sequence_number'
 *    - idx_status: 'status'
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export const DB_NAME = 'AUDITORIAPLUS_OFFLINE_DB';
export const DB_VERSION = 1;

// Tipos de Estado de los Eventos Offline
export type OfflineEventStatus = 'pending' | 'processing' | 'synced' | 'rejected' | 'failed';

// Estructura de un Evento de Conteo Físico Offline
export interface OfflineCountEvent {
  event_id: string;               // UUID v4 único
  sequence_number: number;        // Secuencia monotónica para orden estricto
  mission_id: string;            // ID de la Misión activa
  deposit_code: string;          // Código del depósito (ej. 150101, 150103)
  sku_code: string;              // Código SKU o Código de Barras
  counted_quantity: number;      // Cantidad física contada
  timestamp_utc: string;         // ISO 8601 UTC original del conteo
  status: OfflineEventStatus;    // 'pending' | 'processing' | 'synced' | 'rejected' | 'failed'
  user_id: string;               // ID del auditor
  user_name?: string;
  retry_count: number;           // Número de reintentos ejecutados
  last_error?: string | null;    // Mensaje de error o 409
  rejection_reason?: string | null; // Causa del rechazo (ej. HTTP 409 Override Conflict)
  synced_at?: string | null;     // Timestamp de sincronización exitosa
}

// Estructura del Caché de Misiones
export interface CachedMission {
  mission_id: string;
  title: string;
  deposit_codes: string[];
  status: 'In_Progress' | 'Completed' | 'Pending_Verification';
  cached_at: string;
  theoretical_items_count: number;
  metadata?: Record<string, unknown>;
}

// Estructura del Maestro Local de SKUs
export interface LocalSkuMaster {
  sku_code: string;
  barcode: string;
  description: string;
  category: string;
  unit_of_measure: string;
  deposit_code: string;
  reference_price?: number;
  expected_theoretical?: number;
  updated_at: string;
}

// Interfaz del Esquema Tipado para 'idb'
export interface AuditoriaPlusDBSchema extends DBSchema {
  missions_cache: {
    key: string;
    value: CachedMission;
  };
  sku_master_local: {
    key: string;
    value: LocalSkuMaster;
    indexes: {
      idx_barcode: string;
      idx_deposit: string;
    };
  };
  offline_events_queue: {
    key: string;
    value: OfflineCountEvent;
    indexes: {
      idx_mission_deposit: [string, string]; // Índice compuesto obligatorio
      idx_sequence: number;                  // Índice obligatorio de secuencia
      idx_status: string;                    // Índice obligatorio de estado
      idx_timestamp: string;                 // Índice para orden cronológico estricto
    };
  };
}

let dbPromise: Promise<IDBPDatabase<AuditoriaPlusDBSchema>> | null = null;

/**
 * Obtiene la conexión singleton a IndexedDB inicializando stores e índices
 */
export function getOfflineDB(): Promise<IDBPDatabase<AuditoriaPlusDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AuditoriaPlusDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[IndexedDB] Inicializando ${DB_NAME} (v${oldVersion} -> v${newVersion})...`);

        // 1. Store: missions_cache
        if (!db.objectStoreNames.contains('missions_cache')) {
          db.createObjectStore('missions_cache', { keyPath: 'mission_id' });
          console.log('[IndexedDB] Store "missions_cache" creado.');
        }

        // 2. Store: sku_master_local
        if (!db.objectStoreNames.contains('sku_master_local')) {
          const skuStore = db.createObjectStore('sku_master_local', { keyPath: 'sku_code' });
          skuStore.createIndex('idx_barcode', 'barcode', { unique: false });
          skuStore.createIndex('idx_deposit', 'deposit_code', { unique: false });
          console.log('[IndexedDB] Store "sku_master_local" creado con índices.');
        }

        // 3. Store: offline_events_queue (con índices requeridos estrictos)
        if (!db.objectStoreNames.contains('offline_events_queue')) {
          const queueStore = db.createObjectStore('offline_events_queue', { keyPath: 'event_id' });
          
          // Índices obligatorios según requerimientos técnicos
          queueStore.createIndex('idx_mission_deposit', ['mission_id', 'deposit_code'], { unique: false });
          queueStore.createIndex('idx_sequence', 'sequence_number', { unique: false });
          queueStore.createIndex('idx_status', 'status', { unique: false });
          queueStore.createIndex('idx_timestamp', 'timestamp_utc', { unique: false });
          
          console.log('[IndexedDB] Store "offline_events_queue" creado con idx_mission_deposit, idx_sequence, idx_status.');
        }
      },
      blocked() {
        console.warn('[IndexedDB] Acceso a BD bloqueado por otra pestaña.');
      },
      blocking() {
        console.warn('[IndexedDB] BD desactualizada en esta pestaña; cerrando conexión para permitir upgrade.');
        if (dbPromise) {
          dbPromise.then((db) => db.close());
          dbPromise = null;
        }
      },
      terminated() {
        console.error('[IndexedDB] Conexión cerrada de forma anormal.');
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

// ==============================================================================
// OPERACIONES SOBRE LA COLA DE EVENTOS OFFLINE (offline_events_queue)
// ==============================================================================

/**
 * Encola un nuevo evento de conteo físico en IndexedDB con incremento de secuencia
 */
export async function enqueueOfflineCountEvent(params: {
  mission_id: string;
  deposit_code: string;
  sku_code: string;
  counted_quantity: number;
  user_id: string;
  user_name?: string;
}): Promise<OfflineCountEvent> {
  const db = await getOfflineDB();

  // Obtener la secuencia más alta para orden monotónico estricto
  const tx = db.transaction('offline_events_queue', 'readwrite');
  const store = tx.objectStore('offline_events_queue');
  const seqIndex = store.index('idx_sequence');
  
  // Abrir cursor inverso para encontrar el último sequence_number
  const cursor = await seqIndex.openCursor(null, 'prev');
  const nextSequence = cursor ? cursor.value.sequence_number + 1 : 1;

  const event: OfflineCountEvent = {
    event_id: crypto.randomUUID ? crypto.randomUUID() : `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    sequence_number: nextSequence,
    mission_id: params.mission_id,
    deposit_code: params.deposit_code,
    sku_code: params.sku_code.trim(),
    counted_quantity: params.counted_quantity,
    timestamp_utc: new Date().toISOString(),
    status: 'pending',
    user_id: params.user_id,
    user_name: params.user_name || 'Auditor Offline',
    retry_count: 0,
    last_error: null,
    rejection_reason: null,
  };

  await store.put(event);
  await tx.done;

  console.log(`[IndexedDB] Encolado evento #${event.sequence_number} (${event.sku_code}: ${event.counted_quantity}u) con status 'pending'`);
  return event;
}

/**
 * Obtiene los eventos en estado 'pending' ordenados estrictamente por timestamp_utc
 */
export async function getPendingEventsChronological(): Promise<OfflineCountEvent[]> {
  const db = await getOfflineDB();
  const tx = db.transaction('offline_events_queue', 'readonly');
  const store = tx.objectStore('offline_events_queue');
  const statusIndex = store.index('idx_status');

  // Recuperar todos los registros con status = 'pending'
  const pendingEvents = await statusIndex.getAll('pending');

  // Orden estricto por timestamp_utc original (y secuencia secundaria)
  return pendingEvents.sort((a, b) => {
    const timeA = new Date(a.timestamp_utc).getTime();
    const timeB = new Date(b.timestamp_utc).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.sequence_number - b.sequence_number;
  });
}

/**
 * Actualiza el estado de un evento en IndexedDB
 */
export async function updateEventStatus(
  eventId: string,
  update: {
    status: OfflineEventStatus;
    last_error?: string | null;
    rejection_reason?: string | null;
    synced_at?: string | null;
    incrementRetry?: boolean;
  }
): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction('offline_events_queue', 'readwrite');
  const store = tx.objectStore('offline_events_queue');
  const existing = await store.get(eventId);

  if (existing) {
    existing.status = update.status;
    if (update.last_error !== undefined) existing.last_error = update.last_error;
    if (update.rejection_reason !== undefined) existing.rejection_reason = update.rejection_reason;
    if (update.synced_at !== undefined) existing.synced_at = update.synced_at;
    if (update.incrementRetry) existing.retry_count = (existing.retry_count || 0) + 1;

    await store.put(existing);
  }
  await tx.done;
}

/**
 * Cuenta cuántos eventos están pendientes en la cola
 */
export async function getActiveQueueCount(): Promise<number> {
  try {
    const db = await getOfflineDB();
    const count = await db.countFromIndex('offline_events_queue', 'idx_status', 'pending');
    return count;
  } catch (err) {
    console.warn('[IndexedDB] Error contando eventos pendientes:', err);
    return 0;
  }
}

/**
 * Obtiene todos los eventos de la cola para depuración e interfaz visual
 */
export async function getAllQueueEvents(): Promise<OfflineCountEvent[]> {
  const db = await getOfflineDB();
  const events = await db.getAll('offline_events_queue');
  return events.sort((a, b) => b.sequence_number - a.sequence_number);
}

// ==============================================================================
// OPERACIONES SOBRE EL MAESTRO LOCAL (sku_master_local) Y MISIONES
// ==============================================================================

/**
 * Guarda o actualiza items en el maestro local de SKUs
 */
export async function seedLocalSkuMaster(items: LocalSkuMaster[]): Promise<void> {
  const db = await getOfflineDB();
  const tx = db.transaction('sku_master_local', 'readwrite');
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

/**
 * Busca un SKU por código exacto o código de barras en el almacenamiento local
 */
export async function lookupLocalSku(query: string): Promise<LocalSkuMaster | null> {
  const clean = query.trim();
  const db = await getOfflineDB();
  
  // Búsqueda por clave primaria (sku_code)
  const byCode = await db.get('sku_master_local', clean);
  if (byCode) return byCode;

  // Búsqueda por índice de código de barras
  const byBarcode = await db.getFromIndex('sku_master_local', 'idx_barcode', clean);
  return byBarcode || null;
}

/**
 * Cachea los datos de una misión
 */
export async function cacheMission(mission: CachedMission): Promise<void> {
  const db = await getOfflineDB();
  await db.put('missions_cache', mission);
}

/**
 * Obtiene una misión cacheada
 */
export async function getCachedMission(missionId: string): Promise<CachedMission | undefined> {
  const db = await getOfflineDB();
  return db.get('missions_cache', missionId);
}
