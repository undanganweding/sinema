import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Flame,
  Film,
  Camera,
  MessageSquare,
  Eye,
  Activity,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Sliders,
  Tv,
} from 'lucide-react';
import {
  StoryArchitecture,
  Scene,
  Shot,
  NarrativeMode,
  ColdOpenArchitecture,
} from '../types';

interface StoryArchitectureViewProps {
  storyArchitecture: StoryArchitecture | null;
  scenes: Scene[];
  shots: Record<string, Shot[]>;
}

export const StoryArchitectureView: React.FC<StoryArchitectureViewProps> = ({
  storyArchitecture,
  scenes,
  shots,
}) => {
  const [expandedActId, setExpandedActId] = useState<string | null>(null);

  // Compute narrative mode stats across all shots
  const allShotsList: Shot[] = (Object.values(shots || {}) as Shot[][]).flat();
  const totalShotsCount = allShotsList.length;

  const modeCounts: Record<NarrativeMode, number> = {
    NARRATOR: 0,
    DIALOGUE: 0,
    ACTION: 0,
    VISUAL_ONLY: 0,
    REACTION: 0,
    MIXED: 0,
  };

  for (const s of allShotsList) {
    const mode = (s.narrative_mode || (s.dialogue && s.dialogue.length > 0 ? 'DIALOGUE' : 'ACTION')) as NarrativeMode;
    if (modeCounts[mode] !== undefined) {
      modeCounts[mode]++;
    }
  }

  const narratorPct = totalShotsCount > 0 ? Math.round((modeCounts.NARRATOR / totalShotsCount) * 100) : 40;
  const dialoguePct = totalShotsCount > 0 ? Math.round((modeCounts.DIALOGUE / totalShotsCount) * 100) : 30;
  const actionVisualPct = totalShotsCount > 0 ? Math.round(((modeCounts.ACTION + modeCounts.VISUAL_ONLY) / totalShotsCount) * 100) : 25;

  const coldOpen = storyArchitecture?.cold_open;
  const acts = storyArchitecture?.acts || [];
  const globalSequences = storyArchitecture?.sequences || [];

  return (
    <div className="space-y-6">
      {/* Top Card: Story Architecture Overview */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 backdrop-blur space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                Arsitektur Cerita Sinematik (Story Architecture Engine)
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-xs text-zinc-400 font-mono">
                Hierarki: Cerita &gt; Cold Open &gt; Babak &gt; Sekuens &gt; Adegan &gt; Beat &gt; Mode Narasi &gt; Shot
              </span>
            </div>
            <h3 className="text-xl font-bold text-zinc-100">Struktur Naratif Global, Sekuens, &amp; Keseimbangan Mode</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Mengontrol alur dramatik berkesinambungan mulai dari hook pembuka adegan (Cold Open), pembagian 5 babak struktural, sekuens dramatik, hingga sub-divisi beat per adegan.
            </p>
          </div>
        </div>
      </div>

      {/* Cold Open Architecture Card */}
      {coldOpen && (
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <Flame className="w-5 h-5 text-amber-400" />
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

      {/* Narrative Balance Analysis */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-400" /> Analisis Keseimbangan Narasi (Narrative Balance)
          </h4>
          <span className="text-[11px] text-zinc-400">Total {totalShotsCount} Shot Teranalisis</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Porsi Narator</span>
              <span className="font-mono font-bold text-amber-400">{narratorPct}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${narratorPct}%` }} />
            </div>
            <div className="text-[10px] text-zinc-500">Panduan: 40–50% (Pengantar &amp; Konteks)</div>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Porsi Dialog Tokoh</span>
              <span className="font-mono font-bold text-sky-400">{dialoguePct}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div className="bg-sky-500 h-full rounded-full" style={{ width: `${dialoguePct}%` }} />
            </div>
            <div className="text-[10px] text-zinc-500">Panduan: 25–35% (Interaksi Karakter)</div>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Porsi Aksi / Visual</span>
              <span className="font-mono font-bold text-emerald-400">{actionVisualPct}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${actionVisualPct}%` }} />
            </div>
            <div className="text-[10px] text-zinc-500">Panduan: 15–25% (Pembangunan Atmosfer)</div>
          </div>
        </div>
      </div>

      {/* 5-Act & Sequence Structural Hierarchy */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 px-1 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-amber-400" /> Peta 5-Babak Struktural &amp; Sekuens ({acts.length} Babak)
        </h4>

        <div className="space-y-3">
          {acts.map((act: any, actIdx: number) => {
            const actKey = act.id || act.act_id || `act-${act.act_number || actIdx}-${actIdx}`;
            const isExpanded = expandedActId === actKey;

            // Resolve sequences for this act
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
              <div key={actKey} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedActId(isExpanded ? null : actKey)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-zinc-800/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-bold text-xs flex items-center justify-center border border-amber-500/30">
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
                  <div className="p-4 sm:p-5 pt-0 space-y-4 border-t border-zinc-800/60">
                    <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                      <span className="font-bold text-amber-400">Tujuan Emosional Babak: </span>
                      {emotionalMilestone}
                    </div>

                    {/* Sequences in this Act */}
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
                              <div key={seqKey} className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-zinc-200 text-xs">{seqTitle}</span>
                                  <span className="font-mono text-[10px] text-amber-400 bg-zinc-900 px-2 py-0.5 rounded">
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

      {/* Cinematic Grammar Reference for Narrative Modes */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-amber-400" /> Tata Bahasa Sinematik (Cinematic Grammar Rules)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 space-y-1">
            <div className="font-bold text-amber-300 font-mono">NARRATOR MODE</div>
            <div className="text-[11px] text-zinc-400">Framing: Wide, Extreme Wide, Slow Orbit, Ambient Lighting, Pacing Lambat/Megah</div>
          </div>
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 space-y-1">
            <div className="font-bold text-sky-300 font-mono">DIALOGUE MODE</div>
            <div className="text-[11px] text-zinc-400">Framing: Medium Close-up, Over-the-shoulder, Subtle Push-in, Focus Voice Dialogue</div>
          </div>
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 space-y-1">
            <div className="font-bold text-emerald-300 font-mono">ACTION MODE</div>
            <div className="text-[11px] text-zinc-400">Framing: Tracking Shot, Fast Pan, Dynamic Handheld, High Kinetic Pacing, Foley SFX</div>
          </div>
        </div>
      </div>
    </div>
  );
};
