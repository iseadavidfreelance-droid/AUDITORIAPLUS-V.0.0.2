/**
 * WORKER 1: Sondeo de 1 Hora - Actualización de Teóricos (AUDITORIAPLUS+)
 * Edge Function / Scheduled Cron (cron: "0 * * * *" o invocable vía POST/GET)
 * 
 * Flujo:
 * 1. Selecciona tareas activas en Read_Mission_Tasks con Status = 'Pending_Count' 
 *    (o aquellas cuyo LastTheoreticalSyncAt tenga más de 60 minutos o sea nulo).
 * 2. Deduplica e inserta registros en Relay_Queue con Status = 'Pending' para ser 
 *    consumidos por el Relay Agent físico On-Premise.
 * 3. Proceso Inverso / Conciliación: Revisa Relay_Queue con Status = 'Completed'
 *    y actualiza Read_Mission_Tasks:
 *      - SystemQuantity = stock_quantity
 *      - SalesDuringAudit = ventas_del_dia || ventas_dia
 *      - LastTheoreticalSyncAt = NOW()
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin, jsonResponse } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  const startTime = Date.now();
  console.log(`[WORKER 1] Iniciando ciclo de Sondeo de Teóricos (${new Date().toISOString()})...`);

  try {
    // -------------------------------------------------------------
    // FASE A: Conciliar tareas ya procesadas por el Relay Agent
    // -------------------------------------------------------------
    const syncedCompletedCount = await reconcileCompletedRelayItems();

    // -------------------------------------------------------------
    // FASE B: Consultar tareas 'Pending_Count' en Read_Mission_Tasks
    // -------------------------------------------------------------
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: pendingTasks, error: tasksError } = await supabaseAdmin
      .from('Read_Mission_Tasks')
      .select('Id, MissionId, SkuCode, DepositCode, Status, SystemQuantity, LastTheoreticalSyncAt')
      .in('Status', ['Pending_Count', 'Counting'])
      .or(`LastTheoreticalSyncAt.is.null,LastTheoreticalSyncAt.lt.${oneHourAgo}`)
      .limit(200);

    if (tasksError) {
      throw new Error(`Error consultando Read_Mission_Tasks: ${tasksError.message}`);
    }

    console.log(`[WORKER 1] Encontradas ${pendingTasks?.length ?? 0} tareas candidatas para actualización.`);

    let enqueuedCount = 0;
    let skippedCount = 0;

    if (pendingTasks && pendingTasks.length > 0) {
      // Consultar elementos actualmente pendientes en Relay_Queue para evitar saturación
      const { data: activeRelayQueue } = await supabaseAdmin
        .from('Relay_Queue')
        .select('SkuCode, DepositCode')
        .in('Status', ['Pending', 'Processing']);

      const activeSet = new Set(
        (activeRelayQueue || []).map((q: { SkuCode: string; DepositCode: string }) => `${q.SkuCode.trim()}#${(q.DepositCode || '').trim()}`)
      );

      const itemsToEnqueue = [];

      for (const task of pendingTasks) {
        const key = `${task.SkuCode.trim()}#${(task.DepositCode || '').trim()}`;

        // Si ya hay una petición en vuelo para este SKU y Depósito, no sobrecargamos la cola
        if (activeSet.has(key)) {
          skippedCount++;
          continue;
        }

        activeSet.add(key); // Marcar en memoria del batch

        itemsToEnqueue.push({
          SkuCode: task.SkuCode.trim(),
          DepositCode: task.DepositCode?.trim() || 'DEFAULT',
          Status: 'Pending',
          MissionTaskId: task.Id,
          MissionId: task.MissionId,
          CreatedAt: new Date().toISOString(),
        });
      }

      if (itemsToEnqueue.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('Relay_Queue')
          .insert(itemsToEnqueue);

        if (insertError) {
          throw new Error(`Error encolando en Relay_Queue: ${insertError.message}`);
        }

        enqueuedCount = itemsToEnqueue.length;
        console.log(`[WORKER 1] Se insertaron ${enqueuedCount} registros en Relay_Queue.`);
      }
    }

    const durationMs = Date.now() - startTime;

    return jsonResponse({
      success: true,
      worker: 'Worker 1 - Sondeo Teóricos (1 Hora)',
      timestamp: new Date().toISOString(),
      durationMs,
      metrics: {
        reconciledFromRelay: syncedCompletedCount,
        candidatesFound: pendingTasks?.length ?? 0,
        enqueuedToRelayQueue: enqueuedCount,
        skippedAlreadyInFlight: skippedCount,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[WORKER 1 ERROR] ${error.message}`);
    return jsonResponse(
      {
        success: false,
        error: error.message,
        worker: 'Worker 1 - Sondeo Teóricos',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

/**
 * Reconciliación: Lee registros de Relay_Queue con Status = 'Completed'
 * y vuelca stock_quantity y ventas_del_dia a Read_Mission_Tasks.
 */
async function reconcileCompletedRelayItems(): Promise<number> {
  // Tomamos los últimos 150 items completados que aún no hayan sido consumidos
  const { data: completedItems, error } = await supabaseAdmin
    .from('Relay_Queue')
    .select('Id, SkuCode, DepositCode, MissionTaskId, MissionId, Payload, ProcessedAt')
    .eq('Status', 'Completed')
    .not('ProcessedAt', 'is', null)
    .order('ProcessedAt', { ascending: false })
    .limit(150);

  if (error || !completedItems || completedItems.length === 0) {
    return 0;
  }

  let updatedCount = 0;

  for (const item of completedItems) {
    try {
      const payload = item.Payload as Record<string, unknown> | null;
      if (!payload) continue;

      // Extracción resiliente de campos según contrato de MaraPlus
      const extracted = (payload.extracted as Record<string, unknown>) || payload;
      const raw = (payload.raw as Record<string, unknown>) || payload;

      const stockQuantity = Number(
        extracted.stock_quantity ??
        raw.stock_quantity ??
        raw.StockQuantity ??
        raw.stock ??
        0
      );

      const salesDay = Number(
        extracted.ventas_del_dia ??
        extracted.ventas_dia ??
        raw.ventas_del_dia ??
        raw.ventas_dia ??
        raw.VentasDelDia ??
        0
      );

      // Si tenemos MissionTaskId directo, actualizamos por Id
      if (item.MissionTaskId) {
        const { error: updateErr } = await supabaseAdmin
          .from('Read_Mission_Tasks')
          .update({
            SystemQuantity: stockQuantity,
            SalesDuringAudit: salesDay,
            LastTheoreticalSyncAt: new Date().toISOString(),
            UpdatedAt: new Date().toISOString(),
          })
          .eq('Id', item.MissionTaskId);

        if (!updateErr) updatedCount++;
      } else {
        // Enlace alternativo por SkuCode + DepositCode en tareas pendientes
        const { error: updateErr } = await supabaseAdmin
          .from('Read_Mission_Tasks')
          .update({
            SystemQuantity: stockQuantity,
            SalesDuringAudit: salesDay,
            LastTheoreticalSyncAt: new Date().toISOString(),
            UpdatedAt: new Date().toISOString(),
          })
          .eq('SkuCode', item.SkuCode)
          .eq('DepositCode', item.DepositCode)
          .in('Status', ['Pending_Count', 'Counting']);

        if (!updateErr) updatedCount++;
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.warn(`[RECONCILE WARNING] Error procesando item Relay #${item.Id}: ${error.message}`);
    }
  }

  return updatedCount;
}
