import React, { useState } from 'react';
import {
  PlaySquare,
  Film,
  Sparkles,
  RefreshCw,
  Clock,
  Video,
  Volume2,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Upload,
  Image as ImageIcon,
  Cpu,
} from 'lucide-react';
import { Scene, Shot, VideoPrompt, PromptTarget } from '../../types';
import {
  getPersistedPrompt,
  PROMPT_TARGET_DESCRIPTIONS,
  PROMPT_TARGET_LABELS,
  SHOT_PROMPT_TARGETS,
} from '../../lib/prompt_targets';

interface ShotWorkspaceProps {
  scenes: Scene[];
  shots: Record<string, Shot[]>;
  /** Keyed by SHOT id (see db.getProjectFullData -> promptsMap), not scene id. */
  videoPrompts: Record<string, VideoPrompt[]>;
  /** PATCH 5.5-R1 FASE 5: explicit target, no legacy platform alias. */
  onRunShotPrompt: (shotId: string, target: PromptTarget) => void;
  onUpdateShotImage: (shotId: string, imageUrl: string | null) => void;
  processingShotId: string | null;
  shotPromptError?: Record<string, string>;
}

/**
 * Per-target button chrome. Keyed on canonical PromptTarget so adding a target
 * to SHOT_PROMPT_TARGETS is the only change needed to surface a new button.
 */
const TARGET_BUTTON_STYLE: Record<PromptTarget, { active: string; icon: React.ReactNode }> = {
  banana_master_frame: { active: 'bg-amber-500 text-black shadow-md', icon: <Sparkles className="w-3.5 h-3.5" /> },
  banana_image: { active: 'bg-amber-500 text-black shadow-md', icon: <Sparkles className="w-3.5 h-3.5" /> },
  veo: { active: 'bg-indigo-600 text-white shadow-md', icon: <Video className="w-3.5 h-3.5" /> },
  omni: { active: 'bg-violet-600 text-white shadow-md', icon: <Video className="w-3.5 h-3.5" /> },
  seedance_10: { active: 'bg-cyan-600 text-white shadow-md', icon: <Cpu className="w-3.5 h-3.5" /> },
  seedance_30: { active: 'bg-teal-600 text-white shadow-md', icon: <Cpu className="w-3.5 h-3.5" /> },
};

export const ShotWorkspace: React.FC<ShotWorkspaceProps> = ({

  scenes,
  shots,
  videoPrompts,
  onRunShotPrompt,
  onUpdateShotImage,
  processingShotId,
  shotPromptError = {},
}) => {
  const [activeSceneId, setActiveSceneId] = useState<string>(scenes.length > 0 ? scenes[0].id : '');
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Default collapsed state for all shots: empty object means ALL collapsed by default!
  const [expandedShots, setExpandedShots] = useState<Record<string, boolean>>({});
  // Selected canonical PromptTarget per shot. One button = one explicit target;
  // Veo and Omni are separate entries, never one button branching internally.
  const [selectedTarget, setSelectedTarget] = useState<Record<string, PromptTarget>>({});

  const currentScene = scenes.find((s) => s.id === activeSceneId) || scenes[0];
  const currentShots = currentScene ? shots[currentScene.id] || [] : [];
  // PERMANENT TYPE-SAFETY GATE (Fase 0): the explicit VideoPrompt[] annotation
  // must stay. Without it the index access widens and `.find()` callbacks stop
  // being checked against the VideoPrompt shape, which is how the old accessors
  // silently referenced non-existent fields such as `p.shot_number`.
  //
  // FASE 5 FIX: `videoPrompts` is keyed by SHOT id, not scene id. The previous
  // `videoPrompts[currentScene.id]` lookup always missed, which is why the old
  // accessors appeared to work only via their legacy per-shot column fallbacks.
  const currentPrompts: VideoPrompt[] = currentShots.flatMap(
    (sh) => (sh.id && videoPrompts[sh.id]) || []
  );

  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpandShot = (shotId: string) => {
    setExpandedShots((prev) => ({ ...prev, [shotId]: !prev[shotId] }));
  };

  const toggleExpandAll = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    currentShots.forEach((sh, idx) => {
      const id = sh.id || `shot-${currentScene?.id}-${idx}`;
      nextState[id] = expand;
    });
    setExpandedShots(nextState);
  };

  // Canonical prompt read path: keyed on (shot, target), no cross-target
  // fallback. Replaces getBananaImagePrompt / getVeoVideoPrompt / getSeedance25Prompt.
  const readPrompt = (sh: Shot, target: PromptTarget) =>
    getPersistedPrompt(sh, target, currentPrompts, {
      isGenerating: processingShotId === sh.id,
      hasError: !!shotPromptError[sh.id],
    });

  if (scenes.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 max-w-lg mx-auto space-y-4">
        <PlaySquare className="w-12 h-12 mx-auto text-slate-600" />
        <h3 className="text-lg font-bold text-slate-300">Belum Ada Shot Tersedia</h3>
        <p className="text-xs text-slate-400">
          Subdivisi shot akan otomatis digenerate pada Stage 6 &amp; 8 produksi sinematik.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row overflow-hidden bg-[#090B10]">
      {/* 1. LEFT COLUMN: Scene Selector */}
      <div className="w-full lg:w-72 bg-[#0C101A] border-r border-[#212335] flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-[#212335] bg-[#0E1320] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              Pilih Adegan
            </span>
          </div>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            Stage 6 &amp; 8
          </span>
        </div>

        <div className="p-2 space-y-1">
          {scenes.map((sc) => {
            const isSelected = sc.id === currentScene?.id;
            const scShots = shots[sc.id] || [];
            return (
              <button
                key={sc.id}
                onClick={() => setActiveSceneId(sc.id)}
                className={`w-full p-3 rounded-xl text-left transition flex items-center justify-between gap-2 border ${
                  isSelected
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200 shadow-md'
                    : 'hover:bg-[#151726] text-slate-400 border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-indigo-500/30 text-indigo-100' : 'bg-[#1D1F33] text-slate-400'
                      }`}
                    >
                      #{sc.scene_number}
                    </span>
                    <span className="text-xs font-bold truncate text-slate-100">
                      {sc.title || `Adegan ${sc.scene_number}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {scShots.length} shot • {sc.duration_sec}s
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? 'text-indigo-400 opacity-100' : 'text-slate-600 opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN CONTENT: Shots list for selected scene */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4">
        {currentScene && (
          <>
            {/* Header & Global Expand Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141626] border border-[#26283E] p-5 rounded-2xl shadow-xl">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-indigo-400 font-bold">
                  <span>Adegan #{currentScene.scene_number}</span>
                  <span>•</span>
                  <span>{currentScene.location_name}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Shot Subdivisi &amp; Prompt Generator
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tampilan ringkas (default collapsed). Klik pada kartu untuk membuka detail camera setup &amp; prompt.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleExpandAll(true)}
                  className="px-3 py-1.5 bg-[#1F2136] hover:bg-[#282B45] text-slate-300 rounded-xl text-xs font-semibold border border-[#2F324F] transition"
                >
                  Buka Semua
                </button>
                <button
                  onClick={() => toggleExpandAll(false)}
                  className="px-3 py-1.5 bg-[#1F2136] hover:bg-[#282B45] text-slate-300 rounded-xl text-xs font-semibold border border-[#2F324F] transition"
                >
                  Tutup Semua
                </button>
              </div>
            </div>

            {/* Shots Grid */}
            <div className="space-y-3">
              {currentShots.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-[#121424] rounded-2xl border border-[#24263B] space-y-3">
                  <PlaySquare className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-xs">Belum ada subdivisi shot untuk adegan ini.</p>
                </div>
              ) : (
                currentShots.map((sh, sIdx) => {
                  const shotId = sh.id || `shot-${currentScene.id}-${sIdx}`;
                  const isExpanded = expandedShots[shotId] ?? false; // DEFAULT IS COLLAPSED (false)
                  const isProcessing = processingShotId === shotId;
                  const activeTarget: PromptTarget = selectedTarget[shotId] || 'seedance_10';

                  // One read per (shot, activeTarget). Switching target re-reads;
                  // it never reuses another target's text.
                  const activePrompt = readPrompt(sh, activeTarget);
                  const activePromptText = activePrompt.text;
                  const quickPrompt = readPrompt(sh, 'seedance_10');

                  const activeEngineLabel = PROMPT_TARGET_DESCRIPTIONS[activeTarget];

                  return (
                    <div
                      key={shotId}
                      className="bg-[#121424] border border-[#23263B] hover:border-indigo-500/30 rounded-2xl shadow-xl transition overflow-hidden"
                    >
                      {/* Shot Top Bar (Matching Reference Image Style) */}
                      <div className="p-4 flex items-center justify-between gap-3 bg-[#16182C]">
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-mono font-extrabold text-xs shadow-sm">
                            Shot #{sh.shot_number}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {sh.camera_movement || 'Camera Setup'}
                          </span>
                          <span className="text-[11px] font-mono bg-[#23263D] text-slate-300 px-2.5 py-0.5 rounded-md border border-[#2F3352]">
                            {sh.shot_type || 'Medium Shot'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            {sh.duration_sec}s
                          </span>

                          <button
                            onClick={() => toggleExpandShot(shotId)}
                            className="p-1.5 rounded-lg bg-[#23263D] hover:bg-[#2C2F4D] text-slate-300 transition border border-[#2F3352]"
                            title={isExpanded ? 'Tutup Detail Shot' : 'Buka Detail Shot'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* COLLAPSED QUICK VIEW ROW */}
                      {!isExpanded && (
                        <div className="px-4 py-3 bg-[#0F101E] border-t border-[#1C1E33] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="text-xs text-slate-300 truncate font-mono">
                              <strong className="text-indigo-300">Aksi:</strong> {sh.visual_description || sh.action || 'Visual sinematik shot.'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleCopyPrompt(quickPrompt.text, `quick-${shotId}`)}
                              disabled={!quickPrompt.hasPrompt}
                              title={quickPrompt.hasPrompt ? 'Salin prompt Seedance 10s' : 'Prompt belum digenerate'}
                              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {copiedId === `quick-${shotId}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedId === `quick-${shotId}` ? 'Tersalin!' : 'Salin Seedance 10s'}</span>
                            </button>

                            <button
                              onClick={() => toggleExpandShot(shotId)}
                              className="text-xs font-semibold text-slate-400 hover:text-white transition"
                            >
                              Expand Detail &rarr;
                            </button>
                          </div>
                        </div>
                      )}

                      {/* EXPANDED FULL VIEW (MATCHING REFERENCE IMAGE UI) */}
                      {isExpanded && (
                        <div className="p-5 space-y-4 border-t border-[#1C1E33] bg-[#0F101E]">
                          {/* Visual & Description Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Shot Visual Frame */}
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-[#292C47] flex items-center justify-center group">
                              {sh.image_url ? (
                                <img
                                  src={sh.image_url}
                                  alt={`Shot ${sh.shot_number}`}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="text-center p-4 text-slate-600 space-y-2">
                                  <ImageIcon className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                                  <span className="text-[11px] font-mono text-slate-500 block">Belum ada keyframe shot</span>
                                </div>
                              )}
                              <button
                                onClick={() => setEditingShotId(editingShotId === shotId ? null : shotId)}
                                className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-black/90 hover:bg-black text-amber-300 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1.5 shadow-lg transition"
                              >
                                <Upload className="w-3.5 h-3.5 text-amber-400" />
                                {sh.image_url ? 'Ganti URL' : 'URL'}
                              </button>
                            </div>

                            {/* Shot Action & Audio (Matching Reference Image Layout) */}
                            <div className="lg:col-span-2 space-y-3">
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                                  DESKRIPSI VISUAL &amp; AKSI
                                </span>
                                <p className="text-xs font-bold text-white leading-relaxed">
                                  {sh.visual_description || sh.action || 'Visual sinematik detail.'}
                                </p>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-xl bg-[#16182C] border border-[#242742] space-y-1">
                                  <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold flex items-center gap-1.5">
                                    <Video className="w-3.5 h-3.5" /> KAMERA &amp; PANNING
                                  </span>
                                  <p className="text-slate-200 font-semibold">{sh.camera_movement || 'Stabil'}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-[#16182C] border border-[#242742] space-y-1">
                                  <span className="text-[10px] font-mono text-amber-400 uppercase font-bold flex items-center gap-1.5">
                                    <Volume2 className="w-3.5 h-3.5" /> AUDIO / NARASI / SFX
                                  </span>
                                  <p className="text-slate-200 font-semibold">
                                    {sh.audio_narration || sh.dialogue || sh.sound_effects || 'Natural SFX'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Edit Image Input for Shot */}
                          {editingShotId === shotId && (
                            <div className="p-3 bg-[#16182C] border border-amber-500/30 rounded-xl flex items-center gap-2 animate-in fade-in">
                              <input
                                type="url"
                                value={imageUrlInput}
                                onChange={(e) => setImageUrlInput(e.target.value)}
                                placeholder="Tempel URL keyframe shot (https://...)"
                                className="flex-1 bg-[#0F101E] border border-[#292C47] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                onClick={() => {
                                  onUpdateShotImage(shotId, imageUrlInput.trim() || null);
                                  setEditingShotId(null);
                                  setImageUrlInput('');
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
                              >
                                Simpan Keyframe
                              </button>
                            </div>
                          )}

                          {/* PROMPT GENERATOR SECTION (MATCHING REFERENCE IMAGE UI) */}
                          <div className="p-4 rounded-xl bg-[#16182C] border border-indigo-500/30 space-y-3 shadow-lg">
                            {/* Prompt Bar Header & Engine Switcher */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242742] pb-3">
                              {/* Explicit PromptTarget switcher: ONE button per
                                  canonical target. Veo and Omni are separate
                                  buttons — no button derives its target from
                                  internal conditions. */}
                              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                                {SHOT_PROMPT_TARGETS.map((target) => {
                                  const style = TARGET_BUTTON_STYLE[target];
                                  const isActive = activeTarget === target;
                                  return (
                                    <button
                                      key={target}
                                      onClick={() => setSelectedTarget((prev) => ({ ...prev, [shotId]: target }))}
                                      title={PROMPT_TARGET_DESCRIPTIONS[target]}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                                        isActive ? style.active : 'bg-[#21243D] hover:bg-[#2A2E4E] text-slate-300'
                                      }`}
                                    >
                                      {style.icon}
                                      <span>{PROMPT_TARGET_LABELS[target]}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Action Buttons: 1-Click Copy & Gen Prompt */}
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleCopyPrompt(activePromptText, shotId)}
                                  disabled={!activePrompt.hasPrompt}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {copiedId === shotId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedId === shotId ? 'Tersalin!' : 'Salin Prompt'}</span>
                                </button>

                                <button
                                  onClick={() => onRunShotPrompt(shotId, activeTarget)}
                                  disabled={isProcessing}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                                  <span>
                                    {isProcessing ? 'Generating...' : `Gen ${PROMPT_TARGET_LABELS[activeTarget]}`}
                                  </span>
                                </button>
                              </div>
                            </div>

                            {/* Prompt Engine Title + explicit (target, state) badge */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 font-mono">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>{activeEngineLabel}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {activePrompt.resolvedDurationSec !== null && activePrompt.hasPrompt && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#1B1E33] text-slate-300 border border-[#2C3050]">
                                    {activePrompt.resolvedDurationSec}s
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                                    activePrompt.state === 'ready'
                                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                      : activePrompt.state === 'generating'
                                      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                      : activePrompt.state === 'error'
                                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                                      : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                                  }`}
                                >
                                  {activePrompt.state}
                                </span>
                              </div>
                            </div>

                            {shotPromptError[shotId] && (
                              <p className="text-[11px] font-mono text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                                {shotPromptError[shotId]}
                              </p>
                            )}

                            {/* Prompt body. Empty state shows PROMPT_EMPTY_MESSAGE,
                                never another target's prompt. */}
                            <pre
                              className={`p-3.5 rounded-lg bg-[#0A0B14] border border-[#22243A] font-mono text-xs leading-relaxed whitespace-pre-wrap select-all overflow-x-auto ${
                                activePrompt.hasPrompt ? 'text-slate-200' : 'text-slate-500 italic'
                              }`}
                            >
                              {activePromptText}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
