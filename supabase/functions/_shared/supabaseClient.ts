/**
 * Shared Supabase Client & Database Types for AUDITORIAPLUS+ Edge Functions
 * Deno / TypeScript Runtime
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// Variables de entorno inyectadas automáticamente por Supabase Edge Runtime
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[AUDITORIAPLUS+] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

/**
 * Cliente con service_role para operaciones administrativas en background workers (bypass RLS)
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const TRANSIT_NODE_DEPOSIT = '150104'; // Nodo de Tránsito Virtual de Auditoría

export interface MissionTask {
  Id: number;
  MissionId: string;
  SkuCode: string;
  DepositCode: string;
  Status: 'Pending_Count' | 'Counting' | 'Counted' | 'Discrepancy' | 'Reconciled' | 'Cancelled';
  SystemQuantity: number | null;     // Stock teórico de MaraPlus
  SalesDuringAudit: number | null;   // Ventas del día durante conteo
  CountedQuantity: number | null;    // Conteo físico real auditado
  Discrepancy: number | null;        // Counted - (System - Sales)
  LastTheoreticalSyncAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface RelayQueueItem {
  Id?: number;
  SkuCode: string;
  DepositCode: string;
  Status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  MissionTaskId?: number | null;
  MissionId?: string | null;
  Payload?: Record<string, unknown> | null;
  StockQuantity?: number | null;
  VentasDelDia?: number | null;
  ErrorMessage?: string | null;
  CreatedAt?: string;
  ProcessedAt?: string | null;
}

export interface VirtualTransfer {
  Id?: number;
  MissionId: string;
  SkuCode: string;
  FromDeposit: string;      // Depósito con sobrante (+), ej: 150103
  ToDeposit: string;        // Depósito con faltante (-), ej: 150101
  TransitDeposit: string;   // Nodo Virtual '150104'
  QuantityToMove: number;   // Cantidad compensada
  Status: 'Suggested' | 'Approved' | 'Rejected' | 'Applied_ERP' | 'Failed_ERP';
  SurplusBefore: number;
  DeficitBefore: number;
  ErpDocumentRef?: string | null;
  Notes?: string | null;
  CreatedAt?: string;
  AppliedAt?: string | null;
}

/**
 * Helper para respuestas JSON estandarizadas en Edge Functions
 */
export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}
