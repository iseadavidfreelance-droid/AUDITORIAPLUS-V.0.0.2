import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Zap,
  AlertTriangle,
  Clock,
  Layers,
  Database,
  ArrowRight,
  Server,
  Activity,
  Code,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Terminal,
} from 'lucide-react';

export interface SimulatedJob {
  Id: number;
  SkuCode: string;
  DepositCode: string;
  Status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  Attempts: number;
  StockQuantity?: number;
  VentasDelDia?: number;
  Payload?: any;
  ErrorMessage?: string;
  CreatedAt: string;
  ProcessedAt?: string;
  SimulateFailureMode?: 'none' | 'transient' | 'fatal_timeout' | 'fatal_500';
  DurationMs?: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'batch';
  message: string;
}

export const LiveSimulator: React.FC = () => {
  // Configuration
  const [throttleDelayMs, setThrottleDelayMs] = useState<number>(300);
  const [batchSize, setBatchSize] = useState<number>(10);
  const [interBatchPauseMs, setInterBatchPauseMs] = useState<number>(2000);
  const [maxRetries] = useState<number>(3);

  // Engine state
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [queue, setQueue] = useState<SimulatedJob[]>([]);
  const [activeJob, setActiveJob] = useState<SimulatedJob | null>(null);
  const [completedJobs, setCompletedJobs] = useState<SimulatedJob[]>([]);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [engineState, setEngineState] = useState<'IDLE' | 'PROCESSING' | 'THROTTLING' | 'INTER_BATCH_PAUSE' | 'RETRYING'>('IDLE');
  const [pauseCountdownMs, setPauseCountdownMs] = useState<number>(0);
  const [selectedPayloadJob, setSelectedPayloadJob] = useState<SimulatedJob | null>(null);

  // Form input for single SKU
  const [inputSku, setInputSku] = useState<string>('MP-7001');
  const [inputDeposit, setInputDeposit] = useState<string>('DEP-01');

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef<number>(1);

  // Refs for async processing loop to avoid stale closures
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  const queueRef = useRef(queue);
  queueRef.current = queue;

  const batchCountRef = useRef(batchProgress);
  batchCountRef.current = batchProgress;

  const addLog = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setLogs((prev) => [...prev.slice(-150), entry]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Seed initial sample jobs on mount
  useEffect(() => {
    addLog('info', 'MaraPlus On-Premise Relay Simulator initialized.');
    addLog('info', 'Supabase Realtime Channel connected: public.Relay_Queue (INSERT, UPDATE).');
    addLog('info', 'Ready. Add items to queue or fire a batch test to watch FIFO throttling.');
    
    // Add 3 initial pending items
    enqueueItems([
      { SkuCode: 'SKU-COCA-2L', DepositCode: 'DEP-CENTRAL', SimulateFailureMode: 'none' },
      { SkuCode: 'SKU-LECHE-1L', DepositCode: 'DEP-VALENCIA', SimulateFailureMode: 'none' },
      { SkuCode: 'SKU-ARROZ-1K', DepositCode: 'DEP-CENTRAL', SimulateFailureMode: 'none' },
    ]);
  }, []);

  const enqueueItems = (
    items: Array<{
      SkuCode: string;
      DepositCode: string;
      SimulateFailureMode?: SimulatedJob['SimulateFailureMode'];
    }>
  ) => {
    const newJobs: SimulatedJob[] = items.map((item) => ({
      Id: nextIdRef.current++,
      SkuCode: item.SkuCode,
      DepositCode: item.DepositCode,
      Status: 'Pending',
      Attempts: 0,
      CreatedAt: new Date().toLocaleTimeString(),
      SimulateFailureMode: item.SimulateFailureMode || 'none',
    }));

    setQueue((prev) => [...prev, ...newJobs]);
    addLog('info', `[REALTIME INSERT] Enqueued ${newJobs.length} job(s) into FIFO queue.`);
  };

  // Main processing loop effect
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const runLoop = async () => {
      if (!isRunningRef.current) return;
      if (queueRef.current.length === 0) {
        if (engineState !== 'IDLE') setEngineState('IDLE');
        return;
      }
      if (activeJob) return; // Already busy

      // 1. Dequeue FIFO
      const [nextJob, ...remainingQueue] = queueRef.current;
      setQueue(remainingQueue);
      setActiveJob(nextJob);
      setEngineState('PROCESSING');

      const itemInBatch = batchCountRef.current + 1;
      addLog(
        'info',
        `[WORKER] Processing Job #${nextJob.Id} (${nextJob.SkuCode}) - Item ${itemInBatch}/${batchSize} in current batch.`
      );

      const startTime = Date.now();
      let attempt = 0;
      let success = false;
      let finalData: any = null;
      let lastErr = '';

      // Execute with retry policy (up to 3 attempts)
      while (attempt < maxRetries && !success && !cancelled) {
        attempt++;
        nextJob.Attempts = attempt;

        if (attempt > 1) {
          setEngineState('RETRYING');
          const backoff = 500 * Math.pow(2, attempt - 2);
          addLog('warn', `[RETRY] Attempt ${attempt}/${maxRetries} for Job #${nextJob.Id}. Waiting ${backoff}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
        }

        // Simulate MaraPlus REST API query:
        // http://192.168.15.225:3002/api/inventory?search={SkuCode}&deposito={DepositCode}&onlyOffers=false
        try {
          if (nextJob.SimulateFailureMode === 'fatal_500') {
            throw new Error('HTTP 500 Internal Server Error: MaraPlus Database Timeout');
          } else if (nextJob.SimulateFailureMode === 'fatal_timeout') {
            throw new Error('MaraPlus request timed out after 8000ms');
          } else if (nextJob.SimulateFailureMode === 'transient' && attempt === 1) {
            throw new Error('HTTP 503 Service Temporarily Unavailable (Connection refused)');
          } else {
            // Success response
            const stock = Math.floor(Math.random() * 250) + 5;
            const ventas = Math.floor(Math.random() * 45) + 1;
            finalData = {
              stock_quantity: stock,
              ventas_del_dia: ventas,
              descripcion: `MaraPlus Item for ${nextJob.SkuCode}`,
              deposito: nextJob.DepositCode,
              precio_referencia: (Math.random() * 15 + 1.5).toFixed(2),
              last_sync: new Date().toISOString(),
            };
            success = true;
          }
        } catch (err: any) {
          lastErr = err.message || 'Unknown error';
        }
      }

      if (cancelled) return;

      const durationMs = Date.now() - startTime;
      const completedJob: SimulatedJob = {
        ...nextJob,
        ProcessedAt: new Date().toLocaleTimeString(),
        DurationMs: durationMs,
      };

      if (success) {
        completedJob.Status = 'Completed';
        completedJob.StockQuantity = finalData.stock_quantity;
        completedJob.VentasDelDia = finalData.ventas_del_dia;
        completedJob.Payload = finalData;
        addLog(
          'success',
          `[COMPLETED] Job #${nextJob.Id} synced with MaraPlus (${durationMs}ms) | Stock: ${finalData.stock_quantity}, Ventas: ${finalData.ventas_del_dia}`
        );
      } else {
        completedJob.Status = 'Failed';
        completedJob.ErrorMessage = lastErr;
        addLog('error', `[FAILED] Job #${nextJob.Id} failed after ${maxRetries} attempts: ${lastErr}`);
      }

      setCompletedJobs((prev) => [completedJob, ...prev.slice(0, 99)]);
      setActiveJob(null);

      // Increment batch counter
      const nextBatchCount = batchCountRef.current + 1;

      // Rate Limiting Logic:
      if (nextBatchCount >= batchSize) {
        // Inter-batch pause of 2,000ms
        setBatchProgress(0);
        setEngineState('INTER_BATCH_PAUSE');
        addLog(
          'batch',
          `[INTER-BATCH PAUSE] Reached batch ceiling (${batchSize} requests). Enforcing mandatory ${interBatchPauseMs}ms pause before next batch...`
        );

        // Countdown visualizer
        const intervalSteps = 20;
        const stepTime = interBatchPauseMs / intervalSteps;
        for (let i = 0; i < intervalSteps; i++) {
          if (cancelled) break;
          setPauseCountdownMs(Math.round(interBatchPauseMs - (i * stepTime)));
          await new Promise((r) => setTimeout(r, stepTime));
        }
        setPauseCountdownMs(0);

        addLog('batch', `[INTER-BATCH PAUSE] 2,000ms cooldown complete. Resuming FIFO processing.`);
      } else {
        setBatchProgress(nextBatchCount);
        if (remainingQueue.length > 0) {
          // Individual request pause (300ms)
          setEngineState('THROTTLING');
          await new Promise((r) => setTimeout(r, throttleDelayMs));
        }
      }

      setEngineState('IDLE');
    };

    if (isRunning && !activeJob && queue.length > 0) {
      timeoutId = setTimeout(runLoop, 50);
    }

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [queue, activeJob, isRunning, batchSize, throttleDelayMs, interBatchPauseMs, maxRetries, engineState]);

  const handleEnqueueSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSku.trim()) return;
    enqueueItems([{ SkuCode: inputSku.trim().toUpperCase(), DepositCode: inputDeposit.trim().toUpperCase() }]);
    setInputSku(`MP-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleEnqueueBatch15 = () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      SkuCode: `BATCH-${100 + i}`,
      DepositCode: i % 2 === 0 ? 'DEP-01' : 'DEP-02',
      SimulateFailureMode: (i === 4 ? 'transient' : 'none') as SimulatedJob['SimulateFailureMode'],
    }));
    enqueueItems(items);
  };

  const handleEnqueueFailure3x = () => {
    enqueueItems([
      { SkuCode: 'ERR-FATAL-500', DepositCode: 'DEP-FAIL', SimulateFailureMode: 'fatal_500' },
    ]);
  };

  const handleEnqueueTransientRecovery = () => {
    enqueueItems([
      { SkuCode: 'WARN-TRANSIENT', DepositCode: 'DEP-RECOVER', SimulateFailureMode: 'transient' },
    ]);
  };

  const handleClearQueue = () => {
    setQueue([]);
    setBatchProgress(0);
    setEngineState('IDLE');
    addLog('info', 'Queue cleared.');
  };

  return (
    <div className="space-y-6">
      {/* Simulation Controls & Status Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  engineState === 'PROCESSING'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : engineState === 'INTER_BATCH_PAUSE'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : engineState === 'THROTTLING'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : engineState === 'RETRYING'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                State: {engineState.replace('_', ' ')}
              </span>

              {engineState === 'INTER_BATCH_PAUSE' && (
                <span className="text-xs font-mono text-amber-400 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                  Pause Countdown: {pauseCountdownMs} ms
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Server className="w-6 h-6 text-indigo-400" />
              Live On-Premise Relay Simulator
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Simulates real FIFO WebSocket processing from Supabase to MaraPlus REST API (<code className="text-slate-300">192.168.15.225:3002</code>) with strict 300ms throttling and 2,000ms inter-batch pauses.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95 cursor-pointer ${
                isRunning
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30'
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Pause Daemon' : 'Resume Daemon'}
            </button>

            <button
              onClick={handleClearQueue}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              Clear Queue
            </button>
          </div>
        </div>

        {/* Live Gauges / Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              FIFO Queue Depth
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {queue.length} <span className="text-xs text-slate-500 font-normal">pending</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Batch Progress (Max 10)
            </span>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-1 flex items-baseline gap-1">
              {batchProgress} / {batchSize}
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-amber-400 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(batchProgress / batchSize) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Completed Syncs
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {completedJobs.filter((j) => j.Status === 'Completed').length}
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              Failed (After 3x)
            </span>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {completedJobs.filter((j) => j.Status === 'Failed').length}
            </div>
          </div>
        </div>
      </div>

      {/* Preset Generators & Input Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Manual Enqueue Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-indigo-400" />
            Enqueue Single Realtime Item
          </h3>
          <form onSubmit={handleEnqueueSingle} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">SkuCode</label>
              <input
                type="text"
                value={inputSku}
                onChange={(e) => setInputSku(e.target.value)}
                placeholder="e.g. SKU-1004"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">DepositCode</label>
              <input
                type="text"
                value={inputDeposit}
                onChange={(e) => setInputDeposit(e.target.value)}
                placeholder="DEP-01"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Database className="w-3.5 h-3.5" />
              Enqueue into Relay_Queue
            </button>
          </form>
        </div>

        {/* Batch Test Generators */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Scenario Generators (Testing Limits & Resilience)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Trigger pre-configured testing workloads to verify the 10-batch throttle, 2,000ms pause, and 3x retry policies in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleEnqueueBatch15}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/40 text-left transition group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-amber-300 mb-1">
                <span>Enqueue 15 SKUs</span>
                <Layers className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Tests batch ceiling. Processes 10 items @ 300ms, then forces 2,000ms pause before remaining 5.
              </p>
            </button>

            <button
              onClick={handleEnqueueTransientRecovery}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/40 text-left transition group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-300 mb-1">
                <span>Transient Error</span>
                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-45 transition" />
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Fails attempt 1 (HTTP 503), then recovers cleanly on retry attempt 2 with exponential backoff.
              </p>
            </button>

            <button
              onClick={handleEnqueueFailure3x}
              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-800/40 text-left transition group cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-rose-300 mb-1">
                <span>3x Fatal Retries</span>
                <AlertTriangle className="w-3.5 h-3.5 group-hover:scale-110 transition" />
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                MaraPlus 500 error fails 3 times, then marks record as <code className="text-rose-400">Failed</code> in Supabase.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Main Execution Arena: Queue Cards + Active Job + Live Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Job & Waiting FIFO Pipeline (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Job Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                Active MaraPlus Request
              </span>
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                192.168.15.225:3002
              </span>
            </div>

            {activeJob ? (
              <div className="bg-slate-950 border border-indigo-500/40 rounded-xl p-4 relative overflow-hidden">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                      Job #{activeJob.Id}
                    </span>
                    <h4 className="text-lg font-bold font-mono text-white mt-1.5">{activeJob.SkuCode}</h4>
                    <p className="text-xs text-slate-400">Deposit: {activeJob.DepositCode || 'DEFAULT'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-semibold text-amber-300">
                      Attempt {activeJob.Attempts || 1}/{maxRetries}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                      <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                      <span>Fetching REST...</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] font-mono text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800 truncate">
                  GET /api/inventory?search={activeJob.SkuCode}&deposito={activeJob.DepositCode}&onlyOffers=false
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/50 border border-dashed border-slate-800 rounded-xl p-6 text-center text-slate-500 text-xs">
                {engineState === 'INTER_BATCH_PAUSE' ? (
                  <div className="space-y-1">
                    <p className="text-amber-400 font-semibold">Inter-Batch Cooldown Active</p>
                    <p className="text-slate-400">Pausing 2,000ms to allow on-premise MaraPlus DB to recover.</p>
                  </div>
                ) : (
                  'No active request. Waiting for next queued item...'
                )}
              </div>
            )}
          </div>

          {/* Waiting FIFO Queue Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Waiting FIFO Queue ({queue.length})
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Strict FIFO Order</span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {queue.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 italic">
                  Queue is empty. Use the buttons above to enqueue items.
                </div>
              ) : (
                queue.map((item, idx) => (
                  <div
                    key={item.Id}
                    className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between text-xs hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-mono font-semibold text-slate-200">{item.SkuCode}</div>
                        <div className="text-[10px] text-slate-500">Deposit: {item.DepositCode || 'DEFAULT'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.SimulateFailureMode !== 'none' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                          {item.SimulateFailureMode}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                        Pending
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Realtime Console Logs (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col h-[480px]">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-semibold text-slate-300">
                Daemon Stdout & Realtime Event Stream
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-mono text-slate-500">Node.js 20.x Daemon</span>
            </div>
          </div>

          {/* Terminal output */}
          <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 pr-2 select-text">
            {logs.map((log) => {
              let color = 'text-slate-300';
              if (log.level === 'success') color = 'text-emerald-400 font-medium';
              if (log.level === 'warn') color = 'text-amber-400';
              if (log.level === 'error') color = 'text-rose-400 font-semibold';
              if (log.level === 'batch') color = 'text-purple-400 font-semibold';

              return (
                <div key={log.id} className="leading-snug hover:bg-slate-900/50 rounded px-1">
                  <span className="text-slate-600 mr-2 text-[10px]">[{log.timestamp}]</span>
                  <span className={`text-[10px] uppercase font-bold mr-2 ${
                    log.level === 'success' ? 'text-emerald-500' :
                    log.level === 'warn' ? 'text-amber-500' :
                    log.level === 'error' ? 'text-rose-500' :
                    log.level === 'batch' ? 'text-purple-400' : 'text-cyan-500'
                  }`}>
                    [{log.level}]
                  </span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Completed & Processed Jobs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              Supabase 'Relay_Queue' Synchronized Records
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live reflection of records updated in Supabase with Status, ProcessedAt, and extracted MaraPlus inventory metrics.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Total Processed: {completedJobs.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Job ID</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Deposit</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Stock Quantity</th>
                <th className="py-2.5 px-3">Ventas Día</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Attempts</th>
                <th className="py-2.5 px-3 text-right">MaraPlus Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {completedJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 italic">
                    No completed records yet.
                  </td>
                </tr>
              ) : (
                completedJobs.map((job) => (
                  <tr key={job.Id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 text-slate-400 font-bold">#{job.Id}</td>
                    <td className="py-2.5 px-3 text-white font-semibold">{job.SkuCode}</td>
                    <td className="py-2.5 px-3 text-slate-400">{job.DepositCode || 'DEFAULT'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          job.Status === 'Completed'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {job.Status === 'Completed' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {job.Status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {job.Status === 'Completed' ? (
                        <span className="text-emerald-400 font-bold">{job.StockQuantity}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {job.Status === 'Completed' ? (
                        <span className="text-indigo-300 font-semibold">{job.VentasDelDia}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{job.DurationMs}ms</td>
                    <td className="py-2.5 px-3 text-slate-300">{job.Attempts} / 3</td>
                    <td className="py-2.5 px-3 text-right">
                      {job.Payload ? (
                        <button
                          onClick={() => setSelectedPayloadJob(job)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[11px] cursor-pointer"
                        >
                          <Code className="w-3 h-3" />
                          View JSON
                        </button>
                      ) : (
                        <span className="text-rose-400 text-[11px] truncate max-w-[150px] inline-block" title={job.ErrorMessage}>
                          {job.ErrorMessage || 'Failed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedPayloadJob && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  MaraPlus JSON Payload - Job #{selectedPayloadJob.Id}
                </h3>
                <p className="text-xs text-slate-400">SKU: {selectedPayloadJob.SkuCode} | Deposito: {selectedPayloadJob.DepositCode}</p>
              </div>
              <button
                onClick={() => setSelectedPayloadJob(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs max-h-[300px] overflow-y-auto text-emerald-400 leading-relaxed">
              <pre>{JSON.stringify(selectedPayloadJob.Payload, null, 2)}</pre>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedPayloadJob(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
