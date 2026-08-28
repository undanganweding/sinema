import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Film,
  PlaySquare,
  ChevronDown,
  ChevronUp,
  Cpu,
  Video,
  Clock,
  Layers,
} from 'lucide-react';
import { Scene, Shot } from '../../types';

interface PromptStudioWorkspaceProps {
  scenes: Scene[];
  shots: Record<string, Shot[]>;
}

export const PromptStudioWorkspace: React.FC<PromptStudioWorkspaceProps> = ({ scenes, shots }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'banana' | 'veo' | 'seedance'>('all');

  // DEFAULT COLLAPSED: empty object means ALL collapsed by default!
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSceneExpand = (sceneId: string) => {
    setExpandedScenes((prev) => ({ ...prev, [sceneId]: !prev[sceneId] }));
  };

  const toggleExpandAll = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    scenes.forEach((sc) => {
      nextState[sc.id] = expand;
    });
    setExpandedScenes(nextState);
  };

  // Authoritative Prompt Accessors (Consumes backend Cinematic Prompt Engine data directly)
  const getBananaImagePrompt = (sc: Scene, sh?: Shot) => {
    if (sh && sh.master_image_prompt && sh.master_image_prompt.trim().length > 0) return sh.master_image_prompt;
    if (sc.master_image_prompt && sc.master_image_prompt.trim().length > 0) return sc.master_image_prompt;
    if (sc.full_scene_prompt && sc.full_scene_prompt.trim().length > 0) return sc.full_scene_prompt;
    return 'Prompt Banana Image belum digenerate. Silakan generate prompt via Scene Studio.';
  };

  const getVeoVideoPrompt = (sc: Scene, sh?: Shot) => {
    if (sh && sh.video_prompt && sh.video_prompt.trim().length > 0) return sh.video_prompt;
    return 'Prompt Google Veo belum digenerate. Silakan generate prompt via Scene Studio.';
  };

  const getSeedancePrompt = (sc: Scene, sh?: Shot) => {
    if (sh && sh.seedance_prompt && sh.seedance_prompt.trim().length > 0) return sh.seedance_prompt;
    return 'Prompt Seedance 2.5 belum digenerate. Silakan generate prompt via Scene Studio.';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#181926] border border-[#2B2D44] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-amber-400 font-bold">
            <Sparkles className="w-4 h-4" />
            <span>Stage 7 &amp; 8 • Prompt Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Prompt Studio Multi-Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Prompt Image khusus <strong>Banana Pro (Google)</strong> dan Video khusus <strong>Veo / Omni (Google)</strong> &amp; <strong>Seedance 2.5 (ByteDance)</strong>. Tampilan ringkas (default collapsed) dengan 1-klik copy prompt.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleExpandAll(true)}
            className="px-3 py-2 bg-[#212335] hover:bg-[#282B42] text-slate-300 rounded-xl text-xs font-semibold border border-[#2F324D] transition"
          >
            Buka Semua
          </button>
          <button
            onClick={() => toggleExpandAll(false)}
            className="px-3 py-2 bg-[#212335] hover:bg-[#282B42] text-slate-300 rounded-xl text-xs font-semibold border border-[#2F324D] transition"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
          }`}
        >
          <span>Semua Prompt Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('banana')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'banana'
              ? 'bg-amber-500 text-black shadow-md'
              : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Banana Img (Google)</span>
        </button>

        <button
          onClick={() => setActiveTab('veo')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'veo'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Veo / Omni Video (Google)</span>
        </button>

        <button
          onClick={() => setActiveTab('seedance')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'seedance'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Seedance 2.5 Video (ByteDance)</span>
        </button>
      </div>

      {/* Scenes List */}
      <div className="space-y-4">
        {scenes.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-[#161726] rounded-3xl border border-[#282940] space-y-3">
            <Film className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-xs">Belum ada prompt adegan. Jalankan Stage 7 &amp; 8 pada Pipeline.</p>
          </div>
        ) : (
          scenes.map((sc) => {
            const scShots = shots[sc.id] || [];
            const isExpanded = expandedScenes[sc.id] ?? false; // DEFAULT IS COLLAPSED (false)

            const masterBanana = getBananaImagePrompt(sc);
            const masterVeo = getVeoVideoPrompt(sc);
            const masterSeedance = getSeedancePrompt(sc);

            return (
              <div
                key={sc.id}
                className="bg-[#171827] border border-[#292B45] hover:border-indigo-500/30 rounded-3xl p-5 space-y-4 shadow-xl transition overflow-hidden"
              >
                {/* Scene Card Header Bar */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-mono font-extrabold text-xs shadow-sm">
                      Adegan #{sc.scene_number}
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white">
                      {sc.title || `Adegan ${sc.scene_number}`}
                    </h2>
                    <span className="text-[11px] font-mono text-slate-400 bg-[#22243A] px-2.5 py-0.5 rounded-lg border border-[#2F3252]">
                      {sc.location_name} • {scShots.length} shot
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(masterBanana, `sc-banana-${sc.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      {copiedId === `sc-banana-${sc.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === `sc-banana-${sc.id}` ? 'Tersalin!' : 'Salin Master Banana'}</span>
                    </button>

                    <button
                      onClick={() => toggleSceneExpand(sc.id)}
                      className="p-2 rounded-xl bg-[#22243A] hover:bg-[#2B2E4A] text-slate-300 transition border border-[#2F3252]"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Master Scene Prompt (Always visible in brief) */}
                {(activeTab === 'all' || activeTab === 'banana') && (
                  <div className="p-3.5 rounded-2xl bg-[#0F101B] border border-[#24263D] space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-300">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Master Image Prompt (Google Banana Format)
                      </span>
                      <button
                        onClick={() => handleCopy(masterBanana, `m-banana-${sc.id}`)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      >
                        {copiedId === `m-banana-${sc.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedId === `m-banana-${sc.id}` ? 'Tersalin!' : 'Salin'}
                      </button>
                    </div>
                    <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                      {masterBanana}
                    </p>
                  </div>
                )}

                {/* EXPANDED SHOT BREAKDOWN PROMPTS */}
                {isExpanded && (
                  <div className="space-y-4 pt-3 border-t border-[#292B45] animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        Breakdown Prompt Shot Subdivisi ({scShots.length} shot)
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {scShots.map((sh, sIdx) => {
                        const shotBanana = getBananaImagePrompt(sc, sh);
                        const shotVeo = getVeoVideoPrompt(sc, sh);
                        const shotSeedance = getSeedancePrompt(sc, sh);

                        return (
                          <div
                            key={sh.id || `sh-${sc.id}-${sIdx}`}
                            className="p-4 rounded-2xl bg-[#0F101B] border border-[#24263D] space-y-3"
                          >
                            <div className="flex items-center justify-between border-b border-[#1F2136] pb-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white font-mono font-extrabold text-xs">
                                  Shot #{sh.shot_number}
                                </span>
                                <span className="text-xs font-bold text-slate-200">
                                  {sh.camera_movement || 'Camera Setup'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 bg-[#1D1F33] px-2 py-0.5 rounded">
                                  {sh.shot_type || 'Medium Shot'}
                                </span>
                              </div>

                              <div className="text-xs font-mono text-amber-300 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {sh.duration_sec}s
                              </div>
                            </div>

                            {/* Prompts per Engine */}
                            {(activeTab === 'all' || activeTab === 'banana') && (
                              <div className="p-3 rounded-xl bg-[#161726] border border-amber-500/20 space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-mono text-amber-300 font-bold">
                                  <span>🍌 Banana Image Prompt (Google)</span>
                                  <button
                                    onClick={() => handleCopy(shotBanana, `sh-b-${sh.id || sIdx}`)}
                                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                                  >
                                    {copiedId === `sh-b-${sh.id || sIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    {copiedId === `sh-b-${sh.id || sIdx}` ? 'Tersalin!' : 'Salin'}
                                  </button>
                                </div>
                                <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                                  {shotBanana}
                                </p>
                              </div>
                            )}

                            {(activeTab === 'all' || activeTab === 'veo') && (
                              <div className="p-3 rounded-xl bg-[#161726] border border-indigo-500/20 space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-mono text-indigo-300 font-bold">
                                  <span>🎥 Veo / Omni Video Prompt (Google)</span>
                                  <button
                                    onClick={() => handleCopy(shotVeo, `sh-v-${sh.id || sIdx}`)}
                                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                  >
                                    {copiedId === `sh-v-${sh.id || sIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    {copiedId === `sh-v-${sh.id || sIdx}` ? 'Tersalin!' : 'Salin'}
                                  </button>
                                </div>
                                <p className="font-mono text-xs text-slate-300 leading-relaxed select-all">
                                  {shotVeo}
                                </p>
                              </div>
                            )}

                            {(activeTab === 'all' || activeTab === 'seedance') && (
                              <div className="p-3 rounded-xl bg-[#161726] border border-cyan-500/20 space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300 font-bold">
                                  <span>✨ Seedance 2.5 Video Prompt (ByteDance)</span>
                                  <button
                                    onClick={() => handleCopy(shotSeedance, `sh-s-${sh.id || sIdx}`)}
                                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                                  >
                                    {copiedId === `sh-s-${sh.id || sIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    {copiedId === `sh-s-${sh.id || sIdx}` ? 'Tersalin!' : 'Salin'}
                                  </button>
                                </div>
                                <pre className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-all">
                                  {shotSeedance}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
