import React from 'react';
import {
  Network,
  ShieldCheck,
  Server,
  Cloud,
  Layers,
  ArrowRight,
  Terminal,
  Cpu,
  Clock,
  Radio,
  FileCheck,
  Zap,
  Boxes,
  Workflow,
  CheckCircle2,
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Visual System Topology */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            AUDITORIAPLUS+ Enterprise Suite
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Deno Edge Functions + Realtime Relay
          </span>
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Network className="w-6 h-6 text-emerald-400" />
          Topología Completa AUDITORIAPLUS+ & MaraPlus ERP
        </h2>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl">
          Arquitectura asíncrona bidireccional sin VPN ni puertos entrantes. Supabase Edge Functions orquestan los Workers programados y el algoritmo de compensaciones, mientras que el Relay Agent On-Premise interactúa con la API física local de MaraPlus.
        </p>

        {/* Diagram Flow */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Node 1: Edge Functions & Workers */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  <Workflow className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Deno / Edge
                </span>
              </div>
              <h3 className="font-bold text-sm text-white">Workers & Engine</h3>
              <p className="text-xs text-slate-400 mt-1">
                <strong>Worker 1 (1h):</strong> Teóricos.<br />
                <strong>Worker 2 (15m):</strong> ERP Sync.<br />
                <strong>Compensaciones:</strong> Nodo 150104.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 font-mono text-[10px] text-slate-400">
              Trigger: Cron / Webhook
            </div>
          </div>

          {/* Node 2: Supabase Cloud Postgres & Realtime */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                  <Cloud className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Cloud DB
                </span>
              </div>
              <h3 className="font-bold text-sm text-white">Tablas Físicas</h3>
              <p className="text-xs text-slate-400 mt-1">
                <code className="text-cyan-300 font-mono">Read_Mission_Tasks</code><br />
                <code className="text-cyan-300 font-mono">Relay_Queue</code> (WSS)<br />
                <code className="text-cyan-300 font-mono">Read_Virtual_Transfers</code>
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 font-mono text-[10px] text-slate-400">
              WebSockets Realtime
            </div>
          </div>

          {/* Node 3: On-Premise Docker Agent */}
          <div className="bg-slate-950 border-2 border-indigo-500/40 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                  <Server className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Docker LAN
                </span>
              </div>
              <h3 className="font-bold text-sm text-white">Relay Agent Daemon</h3>
              <p className="text-xs text-slate-400 mt-1">
                • FIFO + Rate Limit (300ms)<br />
                • Lote 10 / Pausa 2.000ms<br />
                • 3x Retry Backoff
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 font-mono text-[10px] text-indigo-300">
              Outbound WSS to Cloud
            </div>
          </div>

          {/* Node 4: MaraPlus Local API */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                  <Cpu className="w-4 h-4" />
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  On-Premise LAN
                </span>
              </div>
              <h3 className="font-bold text-sm text-white">MaraPlus ERP API</h3>
              <p className="text-xs text-slate-400 mt-1">
                <code className="text-purple-300 font-mono">192.168.15.225:3002</code><br />
                GET /api/inventory<br />
                POST /api/transfers
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 font-mono text-[10px] text-slate-400">
              stock_quantity & ventas_dia
            </div>
          </div>
        </div>
      </div>

      {/* Detalle Técnico de los 3 Componentes Clave */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Worker 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-white text-sm">Worker 1: Sondeo 1 Hora</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ejecuta un cron cada 60 minutos (<code className="text-cyan-300 font-mono">0 * * * *</code>). Consulta tareas en <code className="text-cyan-300 font-mono">Read_Mission_Tasks</code> con estado <code className="text-slate-200 font-mono">Pending_Count</code> o teóricos desactualizados. Encola peticiones en <code className="text-cyan-300 font-mono">Relay_Queue</code> y al recibir la respuesta, actualiza <code className="text-slate-200 font-mono">SystemQuantity</code> y <code className="text-slate-200 font-mono">SalesDuringAudit</code>.
          </p>
          <div className="text-[11px] bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-slate-400 space-y-1">
            <div>✓ Consulta teóricos iniciales</div>
            <div>✓ Evita saturación con deduplicación</div>
            <div>✓ Reconciliación atómica</div>
          </div>
        </div>

        {/* Algoritmo Compensaciones & Nodo 150104 */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">Compensación & Nodo 150104</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Función <code className="text-amber-300 font-mono">evaluateVirtualCompensations(missionId, skuCode)</code>. Cuando un SKU presenta faltante en un depósito (ej. Almacén 150101: -5) y sobrante en otro (ej. Piso 150103: +6), genera un traspaso en <code className="text-amber-300 font-mono">Read_Virtual_Transfers</code> por 5 unidades con <code className="text-slate-200 font-mono">Status = 'Suggested'</code> a través del nodo virtual <code className="text-amber-300 font-mono">150104</code>.
          </p>
          <div className="text-[11px] bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-slate-400 space-y-1">
            <div>✓ Match óptimo greedy entre depósitos</div>
            <div>✓ Neutraliza varianza en Tránsito Virtual</div>
            <div>✓ Evita descuadres fiscales erróneos</div>
          </div>
        </div>

        {/* Worker 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white text-sm">Worker 2: Sondeo 15 Minutos</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Cron ejecutado cada 15 minutos (<code className="text-purple-300 font-mono">*/15 * * * *</code>). Detecta transferencias aprobadas en <code className="text-purple-300 font-mono">Read_Virtual_Transfers</code>, genera la orden contable de traspaso en MaraPlus ERP y registra el número de documento oficial (<code className="text-slate-200 font-mono">ErpDocumentRef</code>) marcando <code className="text-slate-200 font-mono">Status = 'Applied_ERP'</code>.
          </p>
          <div className="text-[11px] bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-slate-400 space-y-1">
            <div>✓ Traspasos formales en MaraPlus ERP</div>
            <div>✓ Cierre de ciclo: Status 'Reconciled'</div>
            <div>✓ Alerta por traspasos demorados</div>
          </div>
        </div>
      </div>

      {/* Comandos de Despliegue en Servidor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          Guía de Despliegue en Producción
        </h3>

        <div className="space-y-4 text-xs font-mono">
          <div>
            <div className="text-slate-400 mb-1 font-sans font-semibold">1. Desplegar Edge Functions en Supabase CLI:</div>
            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-emerald-400 overflow-x-auto">
{`# Iniciar sesión y desplegar Workers y Engine
supabase functions deploy sync-theoricals-worker --no-verify-jwt
supabase functions deploy compensations-engine --no-verify-jwt
supabase functions deploy erp-confirmation-worker --no-verify-jwt`}
            </pre>
          </div>

          <div>
            <div className="text-slate-400 mb-1 font-sans font-semibold">2. Levantar el Relay Agent en el Servidor On-Premise (Docker):</div>
            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-cyan-400 overflow-x-auto">
{`# En el servidor físico con acceso a 192.168.15.225
cd /opt/maraplus-relay
docker compose up -d --build

# Verificar logs en tiempo real
docker compose logs -f --tail 100`}
            </pre>
          </div>

          <div>
            <div className="text-slate-400 mb-1 font-sans font-semibold">3. Probar el Sondeo de Salud y Métricas:</div>
            <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-purple-300 overflow-x-auto">
{`curl -s http://localhost:3001/metrics | jq .`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
