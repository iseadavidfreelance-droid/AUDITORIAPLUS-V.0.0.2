/**
 * Registro del Service Worker y configuración de Background Sync para AUDITORIAPLUS+
 */

import { flushOfflineQueue } from './syncEngine';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[PWA] Service Workers no soportados en este entorno.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[PWA] Service Worker registrado exitosamente:', registration.scope);

    // Escuchar mensajes provenientes del Service Worker
    navigator.serviceWorker.addEventListener('message', async (event) => {
      if (event.data?.type === 'SW_TRIGGER_FLUSH') {
        console.log('[PWA] Service Worker solicitó vaciado de cola (Background Sync).');
        await flushOfflineQueue();
      }
    });

    return registration;
  } catch (err) {
    console.warn('[PWA] No se pudo registrar el Service Worker:', err);
    return null;
  }
}

/**
 * Solicita registro en Background Sync API si el navegador lo soporta
 */
export async function requestBackgroundSync(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if ('sync' in reg) {
      // @ts-expect-error SyncManager is standard in Chromium browsers
      await reg.sync.register('sync:flush-offline-queue');
      console.log('[PWA Background Sync] Tarea "sync:flush-offline-queue" registrada en el navegador.');
      return true;
    }
  } catch (err) {
    console.warn('[PWA Background Sync] No se pudo registrar Background Sync:', err);
  }
  return false;
}
