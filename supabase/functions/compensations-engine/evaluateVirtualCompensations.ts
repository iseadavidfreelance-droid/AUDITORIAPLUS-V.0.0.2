/**
 * Algoritmo de Compensación Virtual y Nodo de Tránsito (150104)
 * AUDITORIAPLUS+
 * 
 * Función interna: evaluateVirtualCompensations(missionId, skuCode)
 * 
 * Regla de Negocio:
 * Si dentro de la misma misión, un SKU presenta faltante en un depósito
 * (ej. Almacén 150101: -5 unidades) y sobrante en otro (ej. Piso 150103: +6 unidades):
 * 1. Calcula la compensación óptima: Cantidad = min(|faltante|, sobrante) = 5.
 * 2. Genera un registro en Read_Virtual_Transfers con:
 *      FromDeposit = '150103' (Depósito con sobrante)
 *      ToDeposit = '150101'   (Depósito con faltante)
 *      TransitDeposit = '150104' (Nodo de Tránsito Virtual)
 *      QuantityToMove = 5
 *      Status = 'Suggested'
 * 3. Asigna las unidades al Nodo de Tránsito Virtual (150104) para balancear
 *    la auditoría antes de la aprobación en ERP MaraPlus.
 */

import { supabaseAdmin, TRANSIT_NODE_DEPOSIT, VirtualTransfer } from '../_shared/supabaseClient.ts';

export interface CompensationResult {
  missionId: string;
  skuCode: string;
  transfersGenerated: VirtualTransfer[];
  depositsEvaluated: {
    depositCode: string;
    counted: number;
    system: number;
    sales: number;
    effectiveTheorical: number;
    variance: number; // >0 sobrante, <0 faltante
    residualVariance: number;
  }[];
  summary: {
    totalDeficitUnits: number;
    totalSurplusUnits: number;
    compensatedUnits: number;
    transitNode: string;
  };
}

/**
 * Evalúa compensaciones virtuales para un SKU específico (o todos los SKUs) en una misión.
 */
export async function evaluateVirtualCompensations(
  missionId: string,
  skuCode?: string
): Promise<CompensationResult[]> {
  if (!missionId) {
    throw new Error('El parámetro missionId es obligatorio para evaluateVirtualCompensations');
  }

  // 1. Consultar tareas de conteo de la misión
  let query = supabaseAdmin
    .from('Read_Mission_Tasks')
    .select('*')
    .eq('MissionId', missionId)
    .not('CountedQuantity', 'is', null);

  if (skuCode) {
    query = query.eq('SkuCode', skuCode.trim());
  }

  const { data: tasks, error } = await query;

  if (error) {
    throw new Error(`Error consultando tareas de misión ${missionId}: ${error.message}`);
  }

  if (!tasks || tasks.length === 0) {
    return [];
  }

  // 2. Agrupar por SKU
  const tasksBySku = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const sku = task.SkuCode.trim();
    if (!tasksBySku.has(sku)) {
      tasksBySku.set(sku, []);
    }
    tasksBySku.get(sku)!.push(task);
  }

  const allResults: CompensationResult[] = [];

  // 3. Procesar cada SKU por separado
  for (const [currentSku, skuTasks] of tasksBySku.entries()) {
    // Necesitamos al menos 2 depósitos para que exista compensación cruzada
    if (skuTasks.length < 2) {
      continue;
    }

    interface DepositBalance {
      depositCode: string;
      counted: number;
      system: number;
      sales: number;
      effectiveTheorical: number;
      variance: number; // > 0: sobrante (+), < 0: faltante (-)
      residual: number; // saldo dinámico durante el algoritmo de matching
    }

    const balances: DepositBalance[] = [];
    const surpluses: DepositBalance[] = [];
    const deficits: DepositBalance[] = [];

    for (const task of skuTasks) {
      const counted = Number(task.CountedQuantity || 0);
      const system = Number(task.SystemQuantity || 0);
      const sales = Number(task.SalesDuringAudit || 0);

      // Teórico ajustado con ventas durante la auditoría
      // Si se vendió durante el conteo, el stock físico real debe ser (System - Sales)
      const effectiveTheorical = Math.max(0, system - sales);
      const variance = counted - effectiveTheorical;

      const item: DepositBalance = {
        depositCode: task.DepositCode?.trim() || 'UNKNOWN',
        counted,
        system,
        sales,
        effectiveTheorical,
        variance,
        residual: variance,
      };

      balances.push(item);

      if (variance > 0) {
        surpluses.push(item);
      } else if (variance < 0) {
        deficits.push(item);
      }
    }

    // Si no hay tanto sobrantes como faltantes, no hay compensación posible para este SKU
    if (surpluses.length === 0 || deficits.length === 0) {
      continue;
    }

    // Ordenar sobrantes de mayor a menor y faltantes de mayor déficit a menor
    surpluses.sort((a, b) => b.residual - a.residual);
    deficits.sort((a, b) => a.residual - b.residual); // los más negativos primero

    const transfersToCreate: VirtualTransfer[] = [];
    let totalCompensated = 0;

    // 4. Algoritmo Greedy de Compensación Cruzada & Nodo de Tránsito (150104)
    for (const deficit of deficits) {
      if (deficit.residual >= 0) continue;

      for (const surplus of surpluses) {
        if (surplus.residual <= 0) continue;

        const needed = Math.abs(deficit.residual);
        const available = surplus.residual;
        const quantityToMove = Math.min(needed, available);

        if (quantityToMove <= 0) continue;

        // Actualizar residuales
        deficit.residual += quantityToMove;
        surplus.residual -= quantityToMove;
        totalCompensated += quantityToMove;

        // Estructura de transferencia virtual hacia el Nodo de Tránsito 150104
        const transferRecord: VirtualTransfer = {
          MissionId: missionId,
          SkuCode: currentSku,
          FromDeposit: surplus.depositCode,     // ej: 150103 (Piso - Sobrante)
          ToDeposit: deficit.depositCode,       // ej: 150101 (Almacén - Faltante)
          TransitDeposit: TRANSIT_NODE_DEPOSIT, // 150104 (Nodo de Tránsito Virtual)
          QuantityToMove: quantityToMove,       // ej: 5
          Status: 'Suggested',
          SurplusBefore: surplus.variance,
          DeficitBefore: deficit.variance,
          Notes: `Compensación automática: Sobrante en ${surplus.depositCode} (+${surplus.variance}) cubre Faltante en ${deficit.depositCode} (${deficit.variance}) vía Nodo Virtual ${TRANSIT_NODE_DEPOSIT}.`,
          CreatedAt: new Date().toISOString(),
        };

        transfersToCreate.push(transferRecord);

        // Si el faltante quedó totalmente cubierto, pasamos al siguiente
        if (deficit.residual === 0) {
          break;
        }
      }
    }

    // 5. Persistir en la tabla física Read_Virtual_Transfers
    if (transfersToCreate.length > 0) {
      // Verificar si ya existen sugerencias activas para este SKU y Misión para no duplicar
      const { data: existingTransfers } = await supabaseAdmin
        .from('Read_Virtual_Transfers')
        .select('FromDeposit, ToDeposit, QuantityToMove, Status')
        .eq('MissionId', missionId)
        .eq('SkuCode', currentSku)
        .in('Status', ['Suggested', 'Approved', 'Applied_ERP']);

      const existingMap = new Set(
        (existingTransfers || []).map(
          (t: { FromDeposit: string; ToDeposit: string; QuantityToMove: number }) =>
            `${t.FromDeposit}->${t.ToDeposit}:${t.QuantityToMove}`
        )
      );

      const filteredToInsert = transfersToCreate.filter(
        (t) => !existingMap.has(`${t.FromDeposit}->${t.ToDeposit}:${t.QuantityToMove}`)
      );

      if (filteredToInsert.length > 0) {
        const { error: insertErr } = await supabaseAdmin
          .from('Read_Virtual_Transfers')
          .insert(filteredToInsert);

        if (insertErr) {
          console.error(`[COMPENSATIONS ERROR] Falló inserción en Read_Virtual_Transfers: ${insertErr.message}`);
        } else {
          console.log(`[COMPENSATIONS] Generados ${filteredToInsert.length} registros en Read_Virtual_Transfers para SKU ${currentSku}.`);
        }
      }
    }

    allResults.push({
      missionId,
      skuCode: currentSku,
      transfersGenerated: transfersToCreate,
      depositsEvaluated: balances.map((b) => ({
        depositCode: b.depositCode,
        counted: b.counted,
        system: b.system,
        sales: b.sales,
        effectiveTheorical: b.effectiveTheorical,
        variance: b.variance,
        residualVariance: b.residual,
      })),
      summary: {
        totalDeficitUnits: deficits.reduce((acc, d) => acc + Math.abs(d.variance), 0),
        totalSurplusUnits: surpluses.reduce((acc, s) => acc + s.variance, 0),
        compensatedUnits: totalCompensated,
        transitNode: TRANSIT_NODE_DEPOSIT,
      },
    });
  }

  return allResults;
}
