/**
 * AUDITORIAPLUS+ Service Worker
 * Background Sync & Offline Network Interception
 */

const CACHE_NAME = 'auditoriaplus-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-cacheando assets del shell PWA...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] No se pudieron cachear todos los assets iniciales:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purgando caché antiguo:', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Escuchar peticiones de sincronización en segundo plano (Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync:flush-offline-queue' || event.tag === 'audit-sync') {
    console.log('[SW Background Sync] Evento de sincronización en segundo plano recibido:', event.tag);
    event.waitUntil(notifyClientsToFlush());
  }
});

// Notificar a todas las ventanas abiertas para que ejecuten flushOfflineQueue
async function notifyClientsToFlush() {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clients) {
    client.postMessage({
      type: 'SW_TRIGGER_FLUSH',
      source: 'background_sync',
      timestamp: new Date().toISOString(),
    });
  }
}

// Escuchar mensajes directos desde el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_OFFLINE_QUEUE') {
    event.waitUntil(notifyClientsToFlush());
  }
});
