import React from 'react';
import { Clock, CheckCircle2, Sparkles, Play } from 'lucide-react';
import { Scene, Shot } from '../../types';

interface GenerationQueueWorkspaceProps {
  scenes: Scene[];
  shots: Record<string, Shot[]>;
}

export const GenerationQueueWorkspace: React.FC<GenerationQueueWorkspaceProps> = ({ scenes, shots }) => {
  const totalShots = Object.values(shots).reduce((acc: number, curr: Shot[]) => acc + (curr?.length || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-amber-400 font-bold">
            <Clock className="w-4 h-4" />
            <span>Generation Queue &amp; Render Manager</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
            Antrean Render &amp; Status Aset Visual
          </h1>
        </div>
        <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-500/30 font-bold">
          Siap Render
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Master Frames (Stage 7)</span>
          <div className="text-2xl font-black text-zinc-100">{scenes.length} Adegan</div>
          <p className="text-xs text-emerald-400">Prompt dan keyframe siap diexport.</p>
        </div>
        <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Seedance Prompts (Stage 8)</span>
          <div className="text-2xl font-black text-zinc-100">{totalShots} Shots</div>
          <p className="text-xs text-emerald-400">Prompt video terkunci rapi.</p>
        </div>
        <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Status Queue</span>
          <div className="text-2xl font-black text-emerald-400">Optimal</div>
          <p className="text-xs text-zinc-400">Tidak ada task error dalam antrean.</p>
        </div>
      </div>

      {/* Queue items list */}
      <div className="bg-[#0F131E] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
        <h3 className="text-xs font-bold uppercase font-mono text-zinc-200 tracking-wider">
          Task Log &amp; Render Queue
        </h3>

        <div className="space-y-3">
          {scenes.map((sc, idx) => (
            <div key={sc.id || idx} className="p-4 rounded-xl bg-[#121624] border border-white/5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-300 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                  #{sc.scene_number}
                </div>
                <div>
                  <h4 className="font-bold text-zinc-100 text-xs">{sc.title || `Adegan ${sc.scene_number}`}</h4>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{sc.duration_sec}s • {sc.location_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Selesai
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
