import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Terminal,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Database,
  Layers,
  Users,
  MapPin,
  Clock,
  Cpu,
} from 'lucide-react';
import { Project, PipelineLogEvent } from '../types';

interface OrchestratorViewProps {
  project: Project;
  logs: PipelineLogEvent[];
  onRetry: () => void;
  onViewBlueprint: () => void;
  onChangeModel?: (newModel: string) => Promise<void>;
}

const AVAILABLE_MODELS_LIST = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash (Direkomendasikan)' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Cepat & Stabil)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Penalaran Mendalam)' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (Ultra Cepat)' },
];

const STAGES_CONFIG = [
  {
    stage: 1,
    name: 'Agen Pemahaman Cerita & Fondasi',
    desc: 'Menganalisis tema, era, genre, linimasa, busur emosional, & nuansa visual',
    collection: 'project_foundation (1-1)',
    icon: Sparkles,
  },
  {
    stage: 2,
    name: 'Agen Deteksi & Profil Karakter',
    desc: 'Ekstraksi Kitab Karakter lengkap + verifikasi penggabungan data karakter',
    collection: 'characters (v1)',
    icon: Users,
  },
  {
    stage: 3,
    name: 'Agen Deteksi Lokasi & Objek Penting',
    desc: 'Pemetaan arsitektur, iklim, pencahayaan & catatan kontinuitas properti kunci',
    collection: 'locations & objects (v1)',
    icon: MapPin,
  },
  {
    stage: 4,
    name: 'Agen Struktur Naratif 5-Babak',
    desc: 'Sintesis konteks Tahap 1-3 menjadi Peta 5-Babak Naratif Global',
    collection: 'project_foundation.narrative_beats',
    icon: Layers,
  },
  {
    stage: 5,
    name: 'Agen Rincian Adegan & Alokasi Durasi',
    desc: 'Alokasi durasi berbobot naratif + validasi ketat total durasi target',
    collection: 'scenes (v1)',
    icon: Clock,
  },
];

export const OrchestratorView: React.FC<OrchestratorViewProps> = ({
  project,
  logs,
  onRetry,
  onViewBlueprint,
  onChangeModel,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [selectedRetryModel, setSelectedRetryModel] = useState<string>(project.ai_model || 'gemini-3.7-flash');
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const currentStage = project.current_stage || 1;
  const isCompleted = project.status === 'completed';
  const isFailed = project.status === 'failed';
  const isProcessing = project.status === 'processing';

  const handleModelChangeAndRetry = async () => {
    if (onChangeModel) {
      setIsUpdatingModel(true);
      try {
        await onChangeModel(selectedRetryModel);
      } finally {
        setIsUpdatingModel(false);
      }
    } else {
      onRetry();
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header Status Banner */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 sm:p-6 backdrop-blur flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
              Mesin Orkestrator
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-mono">ID: {project.id}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100">{project.title}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md text-amber-300 font-mono font-medium">
              <Cpu className="w-3.5 h-3.5 text-amber-400" /> {project.ai_model || 'gemini-3.7-flash'}
            </span>
            <span className="flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300">
              <Clock className="w-3 h-3 text-amber-400" /> Target: {project.total_duration_target_sec} dtk
            </span>
            <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300">
              Maks / Adegan:{' '}
              {project.max_scene_shot_duration_sec ? `${project.max_scene_shot_duration_sec} dtk` : 'Otomatis (30 dtk)'}
            </span>
            <span className="bg-zinc-800/80 px-2 py-0.5 rounded text-zinc-300">
              Bahasa Prompt: {project.prompt_language.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {isProcessing && (
            <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memproses Tahap {currentStage}/5...</span>
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2">
              <button
                id="btn-view-blueprint-primary"
                onClick={onViewBlueprint}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <span>Buka Cetak Biru Film</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {isFailed && (
            <button
              id="btn-retry-orchestrator"
              onClick={onRetry}
              disabled={isUpdatingModel}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Coba Ulang Orkestrator</span>
            </button>
          )}
        </div>
      </div>

      {/* Failure Alert Banner & Quick Model Switcher */}
      {isFailed && (
        <div className="p-5 sm:p-6 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 space-y-4">
          <div className="flex items-center gap-2 text-red-400 font-bold text-base">
            <ShieldAlert className="w-5 h-5" />
            <span>Orchestrator Dihentikan: Terjadi Kendala Pemrosesan / Model</span>
          </div>
          <p className="text-sm text-red-300/90 leading-relaxed font-mono text-xs bg-red-950/80 p-3 rounded-lg border border-red-800/50">
            {project.error_message || 'Terjadi kendala saat menghubungi Google Gemini API atau batasan durasi.'}
          </p>

          <div className="pt-2 border-t border-red-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>Ganti model AI untuk retry:</span>
              <select
                value={selectedRetryModel}
                onChange={(e) => setSelectedRetryModel(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400 font-mono"
              >
                {AVAILABLE_MODELS_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleModelChangeAndRetry}
              disabled={isUpdatingModel}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 shadow cursor-pointer disabled:opacity-50"
            >
              {isUpdatingModel ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengupdate...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Terapkan Model & Jalankan Ulang</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Pipeline Stage Stepper */}
      <div className="bg-zinc-900/70 border border-zinc-800/90 rounded-2xl p-5 sm:p-6 backdrop-blur space-y-4">
        <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          Status Tahapan Pipeline & Koleksi Basis Data
        </h3>

        <div className="space-y-3">
          {STAGES_CONFIG.map((stageConfig) => {
            const isPast = isCompleted || (isProcessing && currentStage > stageConfig.stage);
            const isCurrent = isProcessing && currentStage === stageConfig.stage;
            const isStageFailed = isFailed && currentStage === stageConfig.stage;
            const Icon = stageConfig.icon;

            return (
              <div
                key={stageConfig.stage}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/30'
                    : isPast
                    ? 'bg-zinc-950/60 border-zinc-800/90'
                    : isStageFailed
                    ? 'bg-red-950/30 border-red-500/40'
                    : 'bg-zinc-950/30 border-zinc-800/40 opacity-60'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isPast
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isCurrent
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                        : isStageFailed
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    ) : isStageFailed ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <span className="text-xs font-mono font-bold">{stageConfig.stage}</span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-100">
                        Tahap {stageConfig.stage}: {stageConfig.name}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{stageConfig.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                    {stageConfig.collection}
                  </span>
                  {isPast && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selesai
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sedang Berjalan
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Realtime Terminal Execution Logs */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-zinc-900/90 px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-semibold text-zinc-200">
              Log Eksekusi & Validasi Alur Orkestrator Realtime
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-mono text-zinc-400">{logs.length} aktivitas</span>
          </div>
        </div>

        <div className="p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2 text-zinc-300">
          {logs.length === 0 ? (
            <div className="text-zinc-600 italic py-6 text-center">
              Menunggu sinyal awal dari Orchestrator...
            </div>
          ) : (
            logs.map((logItem, index) => {
              const timeFormatted = new Date(logItem.timestamp).toLocaleTimeString();
              let badgeColor = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
              if (logItem.level === 'success') {
                badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
              } else if (logItem.level === 'warn') {
                badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
              } else if (logItem.level === 'error') {
                badgeColor = 'text-red-400 bg-red-500/10 border-red-500/20';
              }

              return (
                <div
                  key={index}
                  className="flex items-start gap-2.5 py-1 border-b border-zinc-900/80 last:border-0"
                >
                  <span className="text-zinc-400 shrink-0 select-none">[{timeFormatted}]</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border shrink-0 ${badgeColor}`}
                  >
                    S{logItem.stage} • {logItem.stage_name}
                  </span>
                  <span
                    className={`leading-relaxed break-words ${
                      logItem.level === 'error'
                        ? 'text-red-300 font-semibold'
                        : logItem.level === 'warn'
                        ? 'text-amber-300'
                        : logItem.level === 'success'
                        ? 'text-emerald-300 font-medium'
                        : 'text-zinc-300'
                    }`}
                  >
                    {logItem.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
