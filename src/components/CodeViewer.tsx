import React, { useState } from 'react';
import { CODE_FILES, CodeFile } from '../data/codeFiles';
import { Check, Copy, Download, FileCode, Terminal, Layers, Info } from 'lucide-react';

export const CodeViewer: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState<string>('index-js');
  const [copied, setCopied] = useState<boolean>(false);

  const currentFile = CODE_FILES.find((f) => f.id === selectedFileId) || CODE_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = (file: CodeFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    CODE_FILES.forEach((file, index) => {
      setTimeout(() => {
        handleDownloadSingle(file);
      }, index * 200);
    });
  };

  const lines = currentFile.content.split('\n');

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Production Grade 100% Complete
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Node.js 20 LTS + Docker Alpine
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileCode className="w-6 h-6 text-indigo-400" />
              On-Premise Relay Agent Artifacts
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Complete source code package ready to copy, deploy into your Docker host, or commit to your repo. Built strictly according to the 4 architectural requirements: Supabase Realtime, 300ms throttling, 10-batch limits with 2,000ms pause, and MaraPlus REST 3x retry recovery.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer"
              title="Downloads all individual configuration and code files"
            >
              <Download className="w-4 h-4" />
              Download All Files
            </button>
          </div>
        </div>
      </div>

      {/* Code Editor Frame */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Tabs Bar */}
        <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 pt-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {CODE_FILES.map((file) => {
              const active = file.id === selectedFileId;
              return (
                <button
                  key={file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  className={`px-3 py-2 rounded-t-lg text-xs font-mono font-medium transition-all flex items-center gap-2 border-t border-x ${
                    active
                      ? 'bg-slate-950 text-indigo-300 border-slate-700 border-b-transparent shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
                  }`}
                >
                  <FileCode className={`w-3.5 h-3.5 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                  {file.name}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {file.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy File</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleDownloadSingle(currentFile)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* File Description Bar */}
        <div className="bg-slate-900/40 border-b border-slate-800/60 px-5 py-2.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate">{currentFile.description}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-slate-500">
            <span>{lines.length} lines</span>
            <span>UTF-8</span>
            <span className="uppercase">{currentFile.language}</span>
          </div>
        </div>

        {/* Code Content Area */}
        <div className="p-0 overflow-x-auto max-h-[640px] font-mono text-xs leading-relaxed bg-[#0d1117] selection:bg-indigo-900/60 selection:text-white">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => {
                const lineNum = idx + 1;
                return (
                  <tr key={idx} className="hover:bg-slate-800/30 group">
                    <td className="w-12 py-0.5 pr-4 pl-4 text-right text-slate-600 select-none text-[11px] border-r border-slate-800/40 font-mono group-hover:text-slate-400">
                      {lineNum}
                    </td>
                    <td className="py-0.5 pl-4 pr-6 text-slate-300 font-mono whitespace-pre">
                      {renderSyntaxLine(line, currentFile.language)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architectural Checklist Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm mb-1.5">
            <Terminal className="w-4 h-4" />
            1. Supabase Realtime
          </div>
          <p className="text-xs text-slate-400">
            Subscribed to physical table <code className="text-indigo-300">Relay_Queue</code> on INSERT & UPDATE for <code className="text-emerald-300">Status = 'Pending'</code> with startup cold-recovery.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-1.5">
            <Layers className="w-4 h-4" />
            2. FIFO Throttling
          </div>
          <p className="text-xs text-slate-400">
            Enforces strict sequence: 300 ms pause between individual requests, ceiling of 10 items per batch, and mandatory 2,000 ms inter-batch pause.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm mb-1.5">
            <FileCode className="w-4 h-4" />
            3. MaraPlus REST Client
          </div>
          <p className="text-xs text-slate-400">
            Consumes <code className="text-sky-300">192.168.15.225:3002/api/inventory</code>, parses <code className="text-amber-300">stock_quantity</code> & <code className="text-amber-300">ventas_del_dia</code>, with 3x retry & backoff.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-1.5">
            <Check className="w-4 h-4" />
            4. Queue Updates
          </div>
          <p className="text-xs text-slate-400">
            Updates Supabase with <code className="text-emerald-300">Completed</code> + JSON payload on success, or <code className="text-rose-300">Failed</code> if all 3 retries expire.
          </p>
        </div>
      </div>
    </div>
  );
};

// Simple syntax colorizer for the code viewer lines
function renderSyntaxLine(line: string, language: string) {
  if (!line) return <span> </span>;

  // Comments
  if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*') || line.trim().startsWith('#') || line.trim().startsWith('--')) {
    return <span className="text-slate-500 italic">{line}</span>;
  }

  // Keywords & patterns
  if (language === 'javascript') {
    if (line.includes('const ') || line.includes('let ') || line.includes('function ') || line.includes('import ') || line.includes('export ') || line.includes('async ') || line.includes('await ')) {
      return (
        <span>
          {line.split(/(const|let|function|import|export|from|async|await|return|if|else|while|for)/g).map((part, i) => {
            if (['const', 'let', 'function', 'import', 'export', 'from', 'async', 'await', 'return', 'if', 'else', 'while', 'for'].includes(part)) {
              return <span key={i} className="text-purple-400 font-semibold">{part}</span>;
            }
            if (part.includes('(') || part.includes(')')) {
              return <span key={i} className="text-slate-200">{part}</span>;
            }
            return <span key={i} className="text-slate-300">{part}</span>;
          })}
        </span>
      );
    }
  }

  return <span>{line}</span>;
}
