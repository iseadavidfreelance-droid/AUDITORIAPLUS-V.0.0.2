/**
 * Edge Function / Scheduled Cron (cron: "* / 15 * * * *" o invocable vía POST/GET)
 * 
 * Flujo de Trabajo:
 * 1. Monitorea transferencias virtuales en Read_Virtual_Transfers con Status = 'Approved'
 *    o 'Pending_ERP_Sync'.
 * 2. Prepara la orden de traspaso de inventario físico en MaraPlus (desde el depósito emisor
 *    hacia el receptor pasando por el Nodo de Tránsito Virtual 150104).
 * 3. Encola la solicitud de sincronización en Relay_Queue con Tipo/Acción 'ERP_TRANSFER_DISPATCH'.
 * 4. Inspecciona respuestas de confirmación de MaraPlus:
 *    - Si MaraPlus generó el documento de traspaso (ej. TRF-2026-9912):
 *      Actualiza Read_Virtual_Transfers:
 *        Status = 'Applied_ERP'
 *        ErpDocumentRef = TRF-XXXXX
 *        AppliedAt = NOW()
 * 5. Cierra el ciclo de auditoría: si todas las transferencias de la tarea/misión
 *    están aplicadas, actualiza Read_Mission_Tasks a 'Reconciled'.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseAdmin, jsonResponse } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  const startTime = Date.now();
  console.log(`[WORKER 2] Iniciando Sondeo de 15 Minutos - Sincronización ERP MaraPlus (${new Date().toISOString()})...`);

  try {
    // -------------------------------------------------------------
    // FASE 1: Buscar transferencias 'Approved' pendientes de envío al ERP
    // -------------------------------------------------------------
    const { data: approvedTransfers, error: fetchErr } = await supabaseAdmin
      .from('Read_Virtual_Transfers')
      .select('*')
      .eq('Status', 'Approved')
      .order('CreatedAt', { ascending: true })
      .limit(100);

    if (fetchErr) {
      throw new Error(`Error consultando transferencias aprobadas: ${fetchErr.message}`);
    }

    let dispatchedToRelay = 0;

    if (approvedTransfers && approvedTransfers.length > 0) {
      console.log(`[WORKER 2] Procesando ${approvedTransfers.length} transferencias aprobadas para envío a MaraPlus...`);

      const relayJobs = approvedTransfers.map((transfer: any) => ({
        SkuCode: transfer.SkuCode,
        DepositCode: transfer.FromDeposit, // Depósito origen
        Status: 'Pending',
        MissionId: transfer.MissionId,
        Payload: {
          action: 'ERP_TRANSFER_DISPATCH',
          transferId: transfer.Id,
          fromDeposit: transfer.FromDeposit,
          toDeposit: transfer.ToDeposit,
          transitDeposit: transfer.TransitDeposit || '150104',
          quantity: transfer.QuantityToMove,
          skuCode: transfer.SkuCode,
          missionId: transfer.MissionId,
        },
        CreatedAt: new Date().toISOString(),
      }));

      const { error: relayInsertErr } = await supabaseAdmin
        .from('Relay_Queue')
        .insert(relayJobs);

      if (relayInsertErr) {
        throw new Error(`Error encolando despachos en Relay_Queue: ${relayInsertErr.message}`);
      }

      // Marcar transferencias como 'Pending_ERP_Sync' para evitar doble despacho
      const transferIds = approvedTransfers.map((t: any) => t.Id);
      await supabaseAdmin
        .from('Read_Virtual_Transfers')
        .update({
          Status: 'Pending_ERP_Sync',
          Notes: 'Despachado a Relay_Queue para registro contable en MaraPlus ERP',
        })
        .in('Id', transferIds);

      dispatchedToRelay = approvedTransfers.length;
    }

    // -------------------------------------------------------------
    // FASE 2: Verificar respuestas de confirmación desde Relay_Queue
    // -------------------------------------------------------------
    const { data: completedRelaySyncs, error: relayFetchErr } = await supabaseAdmin
      .from('Relay_Queue')
      .select('*')
      .eq('Status', 'Completed')
      .not('Payload->action', 'is', null)
      .limit(100);

    let confirmedCount = 0;
    let failedCount = 0;

    if (!relayFetchErr && completedRelaySyncs && completedRelaySyncs.length > 0) {
      for (const queueItem of completedRelaySyncs) {
        const payload = queueItem.Payload as Record<string, unknown> | null;
        if (payload?.action !== 'ERP_TRANSFER_DISPATCH' || !payload.transferId) {
          continue;
        }

        const transferId = payload.transferId;
        const rawRes = (payload.raw as Record<string, unknown>) || {};
        const erpDocNumber = String(rawRes.document_number || rawRes.nro_traspaso || `TRF-MP-${queueItem.Id}`);

        // Marcar la transferencia como 'Applied_ERP'
        const { error: updateTransferErr } = await supabaseAdmin
          .from('Read_Virtual_Transfers')
          .update({
            Status: 'Applied_ERP',
            ErpDocumentRef: erpDocNumber,
            AppliedAt: new Date().toISOString(),
            Notes: `Traspaso físico/virtual ejecutado en MaraPlus con documento ${erpDocNumber}.`,
          })
          .eq('Id', transferId);

        if (!updateTransferErr) {
          confirmedCount++;
        }
      }
    }

    // -------------------------------------------------------------
    // FASE 3: Conciliar tareas en Read_Mission_Tasks
    // -------------------------------------------------------------
    // Si una tarea tiene todos sus ajustes compensados o confirmados, marcar como 'Reconciled'
    const { data: candidateTasks } = await supabaseAdmin
      .from('Read_Mission_Tasks')
      .select('Id, MissionId, SkuCode, DepositCode, Status')
      .in('Status', ['Counted', 'Discrepancy'])
      .limit(50);

    let reconciledTasksCount = 0;

    if (candidateTasks && candidateTasks.length > 0) {
      for (const task of candidateTasks) {
        // Verificar si existen transferencias pendientes de aplicar para este SKU en esta misión
        const { data: pendingTransfers } = await supabaseAdmin
          .from('Read_Virtual_Transfers')
          .select('Id')
          .eq('MissionId', task.MissionId)
          .eq('SkuCode', task.SkuCode)
          .in('Status', ['Suggested', 'Approved', 'Pending_ERP_Sync']);

        // Si no quedan transferencias pendientes por sincronizar, reconciliar
        if (!pendingTransfers || pendingTransfers.length === 0) {
          const { error: reconcileErr } = await supabaseAdmin
            .from('Read_Mission_Tasks')
            .update({
              Status: 'Reconciled',
              UpdatedAt: new Date().toISOString(),
            })
            .eq('Id', task.Id);

          if (!reconcileErr) {
            reconciledTasksCount++;
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return jsonResponse({
      success: true,
      worker: 'Worker 2 - Sondeo 15 Minutos (Confirmación ERP MaraPlus)',
      timestamp: new Date().toISOString(),
      durationMs,
      metrics: {
        dispatchedToRelayQueue: dispatchedToRelay,
        confirmedAppliedInErp: confirmedCount,
        failedSyncs: failedCount,
        missionTasksReconciled: reconciledTasksCount,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[WORKER 2 ERROR] ${error.message}`);
    return jsonResponse(
      {
        success: false,
        error: error.message,
        worker: 'Worker 2 - Confirmación ERP',
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});
