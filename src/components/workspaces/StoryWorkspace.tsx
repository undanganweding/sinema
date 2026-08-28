import React, { useState } from 'react';
import {
  Layers,
  Flame,
  Film,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { StoryArchitecture, Scene, StudioWorkspaceTab } from '../../types';

interface StoryWorkspaceProps {
  storyArchitecture: StoryArchitecture | null;
  scenes: Scene[];
  onNavigate: (tab: StudioWorkspaceTab, targetId?: string) => void;
}

export const StoryWorkspace: React.FC<StoryWorkspaceProps> = ({
  storyArchitecture,
  scenes,
  onNavigate,
}) => {
  const [expandedActId, setExpandedActId] = useState<string | null>('act-1');

  const coldOpen = storyArchitecture?.cold_open;
  const acts = storyArchitecture?.acts || [];
  const globalSequences = storyArchitecture?.sequences || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#0F131E] border border-white/[0.08] p-5 rounded-2xl shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-amber-400 font-bold">
            <Layers className="w-4 h-4" />
            <span>Stage 4 • Arsitektur Cerita &amp; Cold Open</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 mt-1">
            Story Architecture &amp; Babak Sinematik
          </h1>
        </div>
        <button
          onClick={() => onNavigate('scenes')}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition"
        >
          <Film className="w-4 h-4" />
          Kelola Scene Studio
        </button>
      </div>

      {/* Cold Open Card */}
      {coldOpen && (
        <div className="bg-gradient-to-br from-[#161424] to-[#0F131E] border border-amber-500/30 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
              <span>Cold Open Architecture ({coldOpen.duration_sec || 10} Detik Pertama)</span>
            </div>
            <span className="text-[11px] font-mono uppercase bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded border border-amber-500/30 font-semibold">
              Tipe Hook: {(coldOpen as any).hook_type ? String((coldOpen as any).hook_type).toUpperCase() : 'VISUAL HOOK DRAMATIS'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-zinc-950/70 border border-amber-900/30 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-mono uppercase text-amber-400/90 font-bold">Visual Hook Pembuka</div>
              <div className="text-zinc-200">{coldOpen.visual_hook || (coldOpen as any).description || 'Kilasan adegan pembuka dramatis.'}</div>
            </div>
            <div className="bg-zinc-950/70 border border-amber-900/30 rounded-xl p-3.5 space-y-1">
              <div className="text-[10px] font-mono uppercase text-amber-400/90 font-bold">Pertanyaan Dramatis &amp; Transisi</div>
              <div className="text-zinc-200">
                {coldOpen.dramatic_question || (coldOpen as any).audio_hook || 'Bagaimana kisah agung ini bermula?'}
                {coldOpen.cut_to_black_transition ? ` — ${coldOpen.cut_to_black_transition}` : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Acts & Sequences Hierarchy */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase font-mono text-zinc-400 tracking-wider">
          Struktur Babak &amp; Sekuens ({acts.length} Babak)
        </h3>

        <div className="space-y-3">
          {acts.map((act: any, actIdx: number) => {
            const actKey = act.id || act.act_id || `act-${act.act_number || actIdx}-${actIdx}`;
            const isExpanded = expandedActId === actKey;

            const actSequences = Array.isArray(act.sequences)
              ? act.sequences
              : (Array.isArray(act.sequence_ids)
                  ? globalSequences.filter((gs) => act.sequence_ids.includes(gs.sequence_id || (gs as any).id))
                  : []);

            const actTitle = act.title || act.name || `Babak ${act.act_number || actIdx + 1}`;
            const actType = act.act_type || act.purpose || 'Pengembangan Dramatis';
            const dramaticGoal = act.dramatic_goal || act.dramatic_question || act.purpose || 'Menghidupkan progresi cerita';
            const emotionalMilestone = act.emotional_milestone || act.emotional_arc || 'Perjalanan emosional mendalam';

            return (
              <div key={actKey} className="bg-[#0F131E] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
                <button
                  onClick={() => setExpandedActId(isExpanded ? null : actKey)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-zinc-800/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                      B{act.act_number || actIdx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-100 text-sm sm:text-base">{actTitle}</span>
                        <span className="text-xs text-zinc-400 font-mono">({actType})</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">{dramaticGoal}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {act.start_scene_number !== undefined && act.end_scene_number !== undefined ? (
                      <span className="text-xs font-mono text-amber-400 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
                        Adegan #{act.start_scene_number} – #{act.end_scene_number} {act.total_duration_sec ? `(${act.total_duration_sec}s)` : ''}
                      </span>
                    ) : null}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-white/[0.06]">
                    <div className="text-xs text-zinc-300 leading-relaxed bg-[#121624] p-3 rounded-xl border border-white/5">
                      <span className="font-bold text-amber-400">Tujuan Emosional Babak: </span>
                      {emotionalMilestone}
                    </div>

                    {actSequences && actSequences.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[11px] font-mono uppercase font-bold text-zinc-400">
                          Daftar Sekuens dalam Babak Ini:
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {actSequences.map((seq: any, seqIdx: number) => {
                            const seqKey = seq.id || seq.sequence_id || `seq-${actKey}-${seq.sequence_number || seqIdx}-${seqIdx}`;
                            const seqTitle = seq.title || seq.name || `Sekuens ${seq.sequence_number || seqIdx + 1}`;
                            const sceneLabels = Array.isArray(seq.scene_numbers)
                              ? seq.scene_numbers.join(', #')
                              : (Array.isArray(seq.scene_ids) ? seq.scene_ids.join(', ') : `${seqIdx + 1}`);

                            return (
                              <div key={seqKey} className="bg-[#121624] border border-white/5 rounded-xl p-3.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-zinc-200 text-xs">{seqTitle}</span>
                                  <span className="font-mono text-[10px] text-amber-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                                    Adegan #{sceneLabels}
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-400">{seq.narrative_goal || seq.purpose || seq.dramatic_goal}</div>
                                {seq.tonal_shift && (
                                  <div className="text-[10px] text-zinc-500 font-mono">Tonal Shift: {seq.tonal_shift}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
