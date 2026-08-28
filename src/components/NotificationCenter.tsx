import React from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { PipelineLogEvent } from '../types';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  logs: PipelineLogEvent[];
  onRetryStage?: () => void;
  onNavigateToStage?: (stageNumber: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  logs,
  onRetryStage,
}) => {
  if (!isOpen) return null;

  // Filter important recent events (warn, error, or stage completions)
  const recentEvents = [...logs].reverse().slice(0, 30);
  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warningCount = logs.filter((l) => l.level === 'warn').length;

  const getIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#0E121D] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#121724]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Pusat Notifikasi &amp; Log</h3>
            <p className="text-[11px] text-zinc-400">Status orkestrasi &amp; audit kontinuitas</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Summary status pill */}
      <div className="p-3 bg-[#0A0D15] border-b border-white/5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-mono text-[10px] font-semibold border border-rose-500/30">
              {errorCount} Error
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono text-[10px] font-semibold border border-amber-500/30">
              {warningCount} Peringatan
            </span>
          )}
          {errorCount === 0 && warningCount === 0 && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-semibold border border-emerald-500/30">
              Sistem Normal
            </span>
          )}
        </div>
        {onRetryStage && errorCount > 0 && (
          <button
            onClick={onRetryStage}
            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
          >
            <RotateCcw className="w-3 h-3" /> Coba Ulang
          </button>
        )}
      </div>

      {/* Notification Events List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {recentEvents.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-xs space-y-2">
            <Sparkles className="w-6 h-6 mx-auto text-zinc-600" />
            <p>Belum ada aktivitas produksi yang dicatat.</p>
          </div>
        ) : (
          recentEvents.map((event, idx) => (
            <div
              key={`${event.timestamp}-${idx}`}
              className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                event.level === 'error'
                  ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                  : event.level === 'warn'
                  ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                  : event.level === 'success'
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {getIcon(event.level)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-zinc-300">
                      {event.stage_name || `Tahap ${event.stage}`}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed mt-0.5">
                    {event.message}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-[#0A0D15] border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <span>Menampilkan {recentEvents.length} log terbaru</span>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-200 transition"
        >
          Tutup
        </button>
      </div>
    </div>
  );
};
