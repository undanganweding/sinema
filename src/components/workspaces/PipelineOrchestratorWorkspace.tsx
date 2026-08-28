import React from 'react';
import { Cpu, RotateCcw, CheckCircle2, AlertTriangle, Terminal, Sparkles } from 'lucide-react';
import { Project, PipelineLogEvent } from '../../types';

interface PipelineOrchestratorWorkspaceProps {
  project: Project | null;
  logs: PipelineLogEvent[];
  onRetryPipeline: () => void;
  isGenerating: boolean;
}

const STAGES_DETAIL = [
  { num: 1, name: 'Story Understanding & Parsing', desc: 'Menganalisis naskah mentah dan memecah premis utama' },
  { num: 2, name: 'Character Detection & Wardrobe Lock', desc: 'Mengekstrak daftar tokoh, ciri fisik, dan mengunci kostum' },
  { num: 3, name: 'Location & Object Bible', desc: 'Mengidentifikasi latar tempat, arsitektur, dan properti penting' },
  { num: 4, name: 'Narrative Structure & Cold Open', desc: 'Menyusun arsitektur babak, sekuens, dan kait cold open' },
  { num: 5, name: 'Scene Breakdown & Beats', desc: 'Membagi cerita ke dalam adegan dengan durasi otoritatif' },
  { num: 6, name: 'Shot Subdivision & Pacing', desc: 'Mensubdivisi adegan menjadi shot-shot sinematik dengan timing' },
  { num: 7, name: 'Master Frame Prompt Generation', desc: 'Membuat prompt visual master frame untuk setiap adegan' },
  { num: 8, name: 'Video Prompt Agent (Seedance)', desc: 'Menghasilkan prompt video mendetail untuk platform AI video' },
];

export const PipelineOrchestratorWorkspace: React.FC<PipelineOrchestratorWorkspaceProps> = ({
  project,
  logs,
  onRetryPipeline,
  isGenerating,
}) => {
  const currentStage = project?.current_stage || 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-indigo-400 font-bold">
            <Cpu className="w-4 h-4" />
            <span>Orkestrasi Pipeline AI (Stages 1 – 8)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
            Pipeline Orchestrator &amp; Terminal Log
          </h1>
        </div>
        <button
          onClick={onRetryPipeline}
          disabled={isGenerating}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
        >
          <RotateCcw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? 'Menjalankan Pipeline...' : 'Jalankan Ulang Pipeline (Stages 1-8)'}
        </button>
      </div>

      {/* Stages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAGES_DETAIL.map((st) => {
          const isCompleted = project?.status === 'completed' || currentStage > st.num;
          const isCurrent = (project?.status === 'processing' || isGenerating) && currentStage === st.num;

          return (
            <div
              key={st.num}
              className={`p-4 rounded-2xl border space-y-2 flex flex-col justify-between ${
                isCompleted
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : isCurrent
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 animate-pulse'
                  : 'bg-[#0F131E] border-white/10 text-zinc-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                  Tahap {st.num}
                </span>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                ) : (
                  <span className="text-[10px] font-mono text-zinc-600">PENDING</span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-zinc-100 text-xs mt-1">{st.name}</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{st.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Terminal Log Stream */}
      <div className="bg-[#0F131E] border border-white/[0.08] rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
              Terminal Log Produksi ({logs.length} Event)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">Model: {project?.ai_model || 'Gemini 3.7 Flash'}</span>
        </div>

        <div className="bg-[#080A0F] border border-white/5 rounded-xl p-4 font-mono text-xs space-y-2 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-zinc-600 text-center py-8">Belum ada log aktivitas orkestrasi.</div>
          ) : (
            logs.map((log, idx) => (
              <div key={`${log.timestamp}-${idx}`} className="flex items-start gap-3 border-b border-white/[0.03] pb-2">
                <span className="text-zinc-500 shrink-0">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                    log.level === 'error'
                      ? 'bg-rose-500/20 text-rose-300'
                      : log.level === 'warn'
                      ? 'bg-amber-500/20 text-amber-300'
                      : log.level === 'success'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {log.stage_name || `S${log.stage}`}
                </span>
                <p className="text-zinc-300 flex-1 min-w-0 leading-relaxed">{log.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
