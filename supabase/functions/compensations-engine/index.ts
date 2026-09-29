/**
 * API Edge Function: Engine de Compensaciones Virtuales y Nodo de Tránsito (150104)
 * Endpoint: /functions/v1/compensations-engine
 * 
 * Permite invocar la evaluación bajo demanda para una misión completa o un SKU específico,
 * o ser llamado tras la finalización de conteos.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { jsonResponse } from '../_shared/supabaseClient.ts';
import { evaluateVirtualCompensations } from './evaluateVirtualCompensations.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  try {
    let missionId = '';
    let skuCode: string | undefined = undefined;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      missionId = body.missionId;
      skuCode = body.skuCode;
    } else {
      const url = new URL(req.url);
      missionId = url.searchParams.get('missionId') || '';
      skuCode = url.searchParams.get('skuCode') || undefined;
    }

    if (!missionId) {
      return jsonResponse(
        {
          success: false,
          error: 'Parámetro obligatorio requerido: missionId (ej. MIS-2026-01)',
          example: { missionId: 'MIS-2026-01', skuCode: 'SKU-8840' },
        },
        400
      );
    }

    console.log(`[COMPENSATIONS API] Evaluando misión: ${missionId} (SKU: ${skuCode || 'TODOS'})...`);

    const results = await evaluateVirtualCompensations(missionId, skuCode);

    return jsonResponse({
      success: true,
      missionId,
      skuFilter: skuCode || null,
      transitNode: '150104',
      totalSkusAnalyzed: results.length,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[COMPENSATIONS API ERROR] ${error.message}`);
    return jsonResponse(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});
