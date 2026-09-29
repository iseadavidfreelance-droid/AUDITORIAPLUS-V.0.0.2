/**
 * MaraPlus On-Premise Relay Agent
 * -------------------------------------------------------------
 * Bridges Supabase Cloud Realtime Queue with local MaraPlus ERP REST API.
 * 
 * Technical Highlights:
 * 1. Supabase Realtime WebSocket client subscribing to 'Relay_Queue' (INSERT/UPDATE).
 * 2. Automatic startup recovery for pending jobs.
 * 3. Strict FIFO execution with atomic deduplication.
 * 4. Rate Limiting: 300ms inter-request delay + 2,000ms inter-batch pause every 10 jobs.
 * 5. MaraPlus REST inventory consumer with 3x retry and exponential backoff.
 * 6. Supabase status update (Completed with Payload / Failed with ErrorMessage).
 * 7. Graceful shutdown handler and lightweight healthcheck server.
 */

import { createClient } from '@supabase/supabase-js';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  MARAPLUS_BASE_URL: process.env.MARAPLUS_BASE_URL || 'http://192.168.15.225:3002',
  MARAPLUS_TIMEOUT_MS: parseInt(process.env.MARAPLUS_TIMEOUT_MS || '8000', 10),
  
  // Rate Limiting & Throttling Specs
  THROTTLE_DELAY_MS: parseInt(process.env.THROTTLE_DELAY_MS || '300', 10),       // 300 ms between requests
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '10', 10),                     // Max 10 requests per batch
  INTER_BATCH_PAUSE_MS: parseInt(process.env.INTER_BATCH_PAUSE_MS || '2000', 10),// 2,000 ms pause after 10 requests
  
  // Retry Policy
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3', 10),                    // 3 attempts before Failure
  RETRY_BASE_DELAY_MS: parseInt(process.env.RETRY_BASE_DELAY_MS || '1000', 10), // Base delay for exponential backoff

  // Healthcheck & Metrics Server
  PORT: parseInt(process.env.PORT || '3001', 10),
};

const log = {
  info: (msg, meta = '') => console.log(`\x1b[36m[${new Date().toISOString()}] [INFO]\x1b[0m ${msg}`, meta),
  success: (msg, meta = '') => console.log(`\x1b[32m[${new Date().toISOString()}] [SUCCESS]\x1b[0m ${msg}`, meta),
  warn: (msg, meta = '') => console.warn(`\x1b[33m[${new Date().toISOString()}] [WARN]\x1b[0m ${msg}`, meta),
  error: (msg, meta = '') => console.error(`\x1b[31m[${new Date().toISOString()}] [ERROR]\x1b[0m ${msg}`, meta),
  batch: (msg, meta = '') => console.log(`\x1b[35m[${new Date().toISOString()}] [BATCH-THROTTLE]\x1b[0m ${msg}`, meta),
};

if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
  log.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Ensure .env is populated.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const supabase = createClient(CONFIG.SUPABASE_URL || 'https://placeholder.supabase.co', CONFIG.SUPABASE_SERVICE_ROLE_KEY || 'placeholder', {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 20 } },
});

const state = {
  queue: [],
  enqueuedIds: new Set(),
  isProcessing: false,
  consecutiveBatchCount: 0,
  isShuttingDown: false,
  metrics: {
    totalEnqueued: 0,
    totalCompleted: 0,
    totalFailed: 0,
    totalRetries: 0,
    batchesCompleted: 0,
    uptimeStart: new Date(),
  },
};

function enqueueJob(job) {
  if (!job || !job.Id) return;
  if (state.enqueuedIds.has(job.Id)) {
    log.info(`[QUEUE] Job #${job.Id} already in queue. Skipping duplicate.`);
    return;
  }
  if (job.Status !== 'Pending') return;

  state.enqueuedIds.add(job.Id);
  state.queue.push(job);
  state.metrics.totalEnqueued++;

  log.info(`[QUEUE] Enqueued Job #${job.Id} | SKU: ${job.SkuCode} | Deposit: ${job.DepositCode || 'DEFAULT'} | Depth: ${state.queue.length}`);

  if (!state.isProcessing && !state.isShuttingDown) {
    processQueue().catch((err) => log.error('[QUEUE ENGINE] Processing error:', err.message));
  }
}

async function processQueue() {
  if (state.isProcessing) return;
  state.isProcessing = true;

  try {
    while (state.queue.length > 0 && !state.isShuttingDown) {
      const currentJob = state.queue.shift();
      const startTime = Date.now();

      log.info(`----------------------------------------------------------------`);
      log.info(`[WORKER] Processing Job #${currentJob.Id} (${state.consecutiveBatchCount + 1}/${CONFIG.BATCH_SIZE} in batch)`);

      const result = await executeWithRetries(currentJob);

      if (result.success) {
        await updateJobInSupabase(currentJob.Id, {
          Status: 'Completed',
          ProcessedAt: new Date().toISOString(),
          Payload: result.data,
          ErrorMessage: null,
        });
        state.metrics.totalCompleted++;
        log.success(`[COMPLETED] Job #${currentJob.Id} finished successfully in ${Date.now() - startTime}ms`);
      } else {
        await updateJobInSupabase(currentJob.Id, {
          Status: 'Failed',
          ProcessedAt: new Date().toISOString(),
          ErrorMessage: result.error || 'Failed after 3 retries',
        });
        state.metrics.totalFailed++;
        log.error(`[FAILED] Job #${currentJob.Id} failed after ${CONFIG.MAX_RETRIES} attempts. Error: ${result.error}`);
      }

      state.enqueuedIds.delete(currentJob.Id);
      state.consecutiveBatchCount++;

      // Check if batch ceiling reached (10 requests)
      if (state.consecutiveBatchCount >= CONFIG.BATCH_SIZE) {
        state.metrics.batchesCompleted++;
        log.batch(`[INTER-BATCH PAUSE] Reached ${CONFIG.BATCH_SIZE} consecutive requests. Enforcing mandatory ${CONFIG.INTER_BATCH_PAUSE_MS}ms pause...`);
        await sleep(CONFIG.INTER_BATCH_PAUSE_MS);
        state.consecutiveBatchCount = 0;
        log.batch(`[INTER-BATCH PAUSE] Cooldown complete. Resuming queue processing...`);
      } else if (state.queue.length > 0) {
        // Individual Request Throttle: 300 ms pause before next request
        log.info(`[THROTTLE] Applying ${CONFIG.THROTTLE_DELAY_MS}ms pause between requests...`);
        await sleep(CONFIG.THROTTLE_DELAY_MS);
      }
    }
  } finally {
    state.isProcessing = false;
    if (state.queue.length === 0) {
      log.info(`[WORKER] Queue is empty. Ready for new Realtime events.`);
    }
  }
}

async function executeWithRetries(job) {
  let lastError = null;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      log.info(`[MARAPLUS] Attempt ${attempt}/${CONFIG.MAX_RETRIES} for SKU: "${job.SkuCode}", Deposito: "${job.DepositCode || ''}"`);
      const data = await queryMaraPlusInventory(job.SkuCode, job.DepositCode);
      return { success: true, data };
    } catch (err) {
      lastError = err.message;
      state.metrics.totalRetries++;
      log.warn(`[MARAPLUS] Attempt ${attempt} failed: ${err.message}`);

      if (attempt < CONFIG.MAX_RETRIES) {
        const backoffDelay = CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        log.info(`[RETRY BACKOFF] Waiting ${backoffDelay}ms before retry #${attempt + 1}...`);
        await sleep(backoffDelay);
      }
    }
  }

  return { success: false, error: lastError };
}

async function queryMaraPlusInventory(skuCode, depositCode) {
  if (!skuCode) throw new Error('Missing SkuCode');

  const url = new URL('/api/inventory', CONFIG.MARAPLUS_BASE_URL);
  url.searchParams.set('search', skuCode.trim());
  url.searchParams.set('deposito', (depositCode || '').trim());
  url.searchParams.set('onlyOffers', 'false');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.MARAPLUS_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MaraPlus-Relay-Agent/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} (${response.statusText}): ${errText.substring(0, 100)}`);
    }

    const json = await response.json();
    const extracted = extractMaraPlusMetrics(json);

    return {
      raw: json,
      extracted,
      queriedAt: new Date().toISOString(),
      endpoint: url.toString(),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`MaraPlus request timed out after ${CONFIG.MARAPLUS_TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

function extractMaraPlusMetrics(payload) {
  let target = payload;
  if (Array.isArray(payload)) {
    target = payload[0] || {};
  } else if (payload && typeof payload === 'object' && payload.data) {
    target = Array.isArray(payload.data) ? payload.data[0] || {} : payload.data;
  }

  const stockQuantity = target.stock_quantity ?? target.StockQuantity ?? target.stock ?? target.cantidad ?? 0;
  const ventasDia = target.ventas_del_dia ?? target.ventas_dia ?? target.VentasDelDia ?? target.ventasHoy ?? 0;

  return {
    stock_quantity: Number(stockQuantity) || 0,
    ventas_del_dia: Number(ventasDia) || 0,
    description: target.description || target.descripcion || target.name || null,
    price: target.price || target.precio || null,
  };
}

async function updateJobInSupabase(jobId, fields) {
  try {
    const { error } = await supabase
      .from('Relay_Queue')
      .update(fields)
      .eq('Id', jobId);

    if (error) {
      log.error(`[SUPABASE UPDATE ERROR] Job #${jobId}: ${error.message}`);
      await sleep(1000);
      await supabase.from('Relay_Queue').update(fields).eq('Id', jobId);
    }
  } catch (err) {
    log.error(`[SUPABASE CRITICAL] Job #${jobId}: ${err.message}`);
  }
}

async function recoverPendingJobs() {
  log.info('[STARTUP] Querying Supabase for existing Pending jobs in Relay_Queue...');
  try {
    const { data, error } = await supabase
      .from('Relay_Queue')
      .select('*')
      .eq('Status', 'Pending')
      .order('CreatedAt', { ascending: true })
      .limit(500);

    if (error) {
      log.error(`[STARTUP RECOVERY] Error: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      log.info(`[STARTUP RECOVERY] Found ${data.length} pending jobs. Queuing...`);
      for (const row of data) {
        enqueueJob(row);
      }
    } else {
      log.info('[STARTUP RECOVERY] No pending jobs. Daemon standby.');
    }
  } catch (err) {
    log.error(`[STARTUP RECOVERY] Exception: ${err.message}`);
  }
}

function initRealtimeSubscription() {
  log.info('[REALTIME] Subscribing to "Relay_Queue" INSERT and UPDATE events...');

  const channel = supabase
    .channel('relay_queue_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'Relay_Queue' },
      (payload) => {
        log.info(`[REALTIME INSERT] Job #${payload.new?.Id} (Status: ${payload.new?.Status})`);
        if (payload.new && payload.new.Status === 'Pending') enqueueJob(payload.new);
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'Relay_Queue' },
      (payload) => {
        log.info(`[REALTIME UPDATE] Job #${payload.new?.Id} (Status: ${payload.new?.Status})`);
        if (payload.new && payload.new.Status === 'Pending') enqueueJob(payload.new);
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        log.success('[REALTIME] Connected to Supabase Realtime WebSocket successfully.');
      } else if (status === 'CHANNEL_ERROR') {
        log.error('[REALTIME ERROR]', err?.message || 'Check supabase_realtime publication');
      }
    });

  return channel;
}

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/healthz' || req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
      return;
    }

    if (req.url === '/metrics' || req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        agent: 'MaraPlus-Relay-Agent',
        uptimeSeconds: Math.floor(process.uptime()),
        queueDepth: state.queue.length,
        isProcessing: state.isProcessing,
        currentBatchProgress: `${state.consecutiveBatchCount}/${CONFIG.BATCH_SIZE}`,
        metrics: state.metrics,
      }, null, 2));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(CONFIG.PORT, '0.0.0.0', () => {
    log.info(`[HTTP SERVER] Health endpoint at http://0.0.0.0:${CONFIG.PORT}/healthz`);
  });

  return server;
}

async function bootstrap() {
  const healthServer = startHealthServer();
  const realtimeChannel = initRealtimeSubscription();
  await recoverPendingJobs();

  const shutdown = async (signal) => {
    if (state.isShuttingDown) return;
    state.isShuttingDown = true;
    log.warn(`[SHUTDOWN] Received ${signal}. Stopping agent...`);

    if (realtimeChannel) await supabase.removeChannel(realtimeChannel);
    healthServer.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  log.error('[FATAL]', err);
  process.exit(1);
});
