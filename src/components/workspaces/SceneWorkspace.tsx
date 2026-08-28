import React, { useState } from 'react';
import {
  Film,
  Play,
  Clock,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  ShieldCheck,
  MapPin,
  Users,
  ChevronRight,
  Upload,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Video,
  Cpu,
  Package,
  Layers,
  PlaySquare,
  Volume2,
} from 'lucide-react';
import {
  Scene,
  Shot,
  VideoPrompt,
  CharacterBible,
  LocationBible,
  ObjectBible,
  NarrativeMode,
  PromptTarget,
} from '../../types';
import {
  getPersistedPrompt,
  getPersistedScenePrompt,
  PersistedPrompt,
  PROMPT_TARGET_DESCRIPTIONS,
  PROMPT_TARGET_LABELS,
  SHOT_PROMPT_TARGETS,
} from '../../lib/prompt_targets';

interface SceneWorkspaceProps {
  scenes: Scene[];
  shots: Record<string, Shot[]>;
  /** Keyed by SHOT id (see db.getProjectFullData -> promptsMap), not scene id. */
  videoPrompts?: Record<string, VideoPrompt[]>;
  characters?: CharacterBible[];
  locations?: LocationBible[];
  objects?: ObjectBible[];
  selectedSceneId?: string;
  onSelectScene?: (sceneId: string) => void;
  onRunScenePipeline: (sceneId: string) => void;
  onRegenerateScenePrompt: (sceneId: string) => void;
  onUpdateSceneImage: (sceneId: string, imageUrl: string | null) => void;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => void;
  /** PATCH 5.5-R1 FASE 5: explicit target, no legacy platform alias. */
  onRunShotPrompt?: (shotId: string, target: PromptTarget) => void;
  processingSceneId: string | null;
  processingShotId?: string | null;
  shotPromptError?: Record<string, string>;
}

/**
 * Per-target button chrome (mirrors ShotWorkspace). Keyed on canonical
 * PromptTarget so a new target only needs an entry here plus SHOT_PROMPT_TARGETS.
 */
const TARGET_BUTTON_STYLE: Record<PromptTarget, { active: string; icon: React.ReactNode }> = {
  banana_master_frame: { active: 'bg-amber-500 text-black shadow-md', icon: <Sparkles className="w-3.5 h-3.5" /> },
  banana_image: { active: 'bg-amber-500 text-black shadow-md', icon: <Sparkles className="w-3.5 h-3.5" /> },
  veo: { active: 'bg-indigo-600 text-white shadow-md', icon: <Video className="w-3.5 h-3.5" /> },
  omni: { active: 'bg-violet-600 text-white shadow-md', icon: <Video className="w-3.5 h-3.5" /> },
  seedance_10: { active: 'bg-cyan-600 text-white shadow-md', icon: <Cpu className="w-3.5 h-3.5" /> },
  seedance_30: { active: 'bg-teal-600 text-white shadow-md', icon: <Cpu className="w-3.5 h-3.5" /> },
};

export const SceneWorkspace: React.FC<SceneWorkspaceProps> = ({

  scenes,
  shots,
  videoPrompts = {},
  characters = [],
  locations = [],
  objects = [],
  selectedSceneId,
  onSelectScene,
  onRunScenePipeline,
  onRegenerateScenePrompt,
  onUpdateSceneImage,
  onUpdateShotImage,
  onRunShotPrompt,
  processingSceneId,
  processingShotId,
  shotPromptError = {},
}) => {
  const [activeSceneId, setActiveSceneId] = useState<string>(
    selectedSceneId || (scenes.length > 0 ? scenes[0].id : '')
  );
  const [viewMode, setViewMode] = useState<'all' | 'shots' | 'assets'>('all');

  // Image editing states
  const [isEditingSceneImage, setIsEditingSceneImage] = useState(false);
  const [sceneImageUrlInput, setSceneImageUrlInput] = useState('');
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [shotImageUrlInput, setShotImageUrlInput] = useState('');

  // Copy indicator state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Accordion expanded states (DEFAULT IS COLLAPSED false!)
  const [expandedShots, setExpandedShots] = useState<Record<string, boolean>>({});
  // Selected canonical PromptTarget per shot. One button = one explicit target.
  const [selectedTarget, setSelectedTarget] = useState<Record<string, PromptTarget>>({});

  // Synchronize when selectedSceneId changes externally
  React.useEffect(() => {
    if (selectedSceneId) {
      setActiveSceneId(selectedSceneId);
    }
  }, [selectedSceneId]);

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
  const isProcessing = processingSceneId === currentScene?.id;

  // Calculate shot durations sum
  const shotsTotalDuration = currentShots.reduce((acc, sh) => acc + (sh.duration_sec || 0), 0);
  const sceneAuthoritativeDuration = currentScene?.duration_sec || 10;
  const isDurationBalanced = Math.abs(shotsTotalDuration - sceneAuthoritativeDuration) < 0.1;

  // Copy handler
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Accordion toggles
  const toggleShotExpand = (shotId: string) => {
    setExpandedShots((prev) => ({ ...prev, [shotId]: !prev[shotId] }));
  };

  const toggleAllShotsExpand = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    currentShots.forEach((sh, idx) => {
      const id = sh.id || `shot-${currentScene?.id}-${idx}`;
      nextState[id] = expand;
    });
    setExpandedShots(nextState);
  };

  /**
   * Scene-level `banana_master_frame` read path.
   *
   * FASE 5: the canonical persisted text comes from getPersistedScenePrompt
   * (scene.master_image_prompt, written by POST /scenes/:id/regenerate-prompt).
   * The master_image_prompt_json branch below is a LEGACY fallback only: the
   * orchestrator path (orchestrator.ts) persists the structured JSON without the
   * compiled text, so pre-5.5 projects would otherwise render as empty.
   * When neither exists the state is an honest `idle` with PROMPT_EMPTY_MESSAGE.
   */
  const readScenePrompt = (sc: Scene): PersistedPrompt => {
    const persisted = getPersistedScenePrompt(sc);
    if (persisted.hasPrompt) return persisted;

    const json = sc.master_image_prompt_json;
    if (json) {
      return {
        state: 'ready',
        text: `${json.subject || ''}. Location: ${json.location || ''}. Lighting: ${json.lighting || ''}. Style: ${json.cinematic_style || ''}`,
        hasPrompt: true,
        resolvedDurationSec: 10,
        row: null,
      };
    }
    return persisted;
  };

  // Canonical prompt read path: keyed on (shot, target), no cross-target
  // fallback. Replaces getShotBananaPrompt / getShotVeoPrompt / getShotSeedancePrompt.
  const readPrompt = (sh: Shot, target: PromptTarget) =>
    getPersistedPrompt(sh, target, currentPrompts, {
      isGenerating: processingShotId === sh.id,
      hasError: !!shotPromptError[sh.id],
    });

  const getCharacterBananaPrompt = (c: CharacterBible) => {
    if (c.master_portrait_prompt && c.master_portrait_prompt.trim().length > 0) return c.master_portrait_prompt;
    const desc = c.physical_description || c.physical_appearance || 'historical figure';
    const costume = c.costume || c.wardrobe || (c.clothing?.length ? c.clothing.join(', ') : 'historical garments');
    return `Photorealistic cinematic master portrait of ${c.name}, ${desc}, wearing ${costume}, 8k resolution, cinematic lighting, 85mm portrait lens --no modern clothes, no distortion`;
  };

  const getLocationBananaPrompt = (l: LocationBible) => {
    if (l.master_environment_prompt && l.master_environment_prompt.trim().length > 0) return l.master_environment_prompt;
    const arch = l.architectural_style || l.architecture || 'period architecture';
    const env = l.environment || l.landscape || l.description || 'historical landscape';
    return `Cinematic wide master shot of ${l.name}, ${arch}, ${env}, 8k ultra-detailed, photorealistic, 35mm anamorphic lens --no modern buildings`;
  };

  // Characters & Locations related to active scene
  const sceneCharacters = characters.filter((c) =>
    currentScene?.character_names?.some((name) => name.toLowerCase().includes(c.name.toLowerCase()))
  );
  const sceneLocations = locations.filter((l) =>
    currentScene?.location_name?.toLowerCase().includes(l.name.toLowerCase())
  );

  if (scenes.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 max-w-lg mx-auto space-y-4">
        <Film className="w-12 h-12 mx-auto text-slate-600" />
        <h3 className="text-lg font-bold text-slate-300">Belum Ada Adegan Terstruktur</h3>
        <p className="text-xs text-slate-400">
          Struktur babak dan pembagian adegan sinematik akan muncul di sini setelah pipeline Stage 5 selesai.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row overflow-hidden bg-[#090B10]">
      {/* 1. LEFT COLUMN: Scene List Navigator */}
      <div className="w-full lg:w-72 bg-[#0C101A] border-r border-[#212335] flex flex-col shrink-0 overflow-y-auto">
        <div className="p-3.5 border-b border-[#212335] bg-[#0E1320] flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              Daftar Adegan ({scenes.length})
            </span>
          </div>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            Control Center
          </span>
        </div>

        <div className="p-2 space-y-1">
          {scenes.map((sc) => {
            const isSelected = sc.id === currentScene?.id;
            const scShots = shots[sc.id] || [];
            return (
              <button
                key={sc.id}
                onClick={() => {
                  setActiveSceneId(sc.id);
                  if (onSelectScene) onSelectScene(sc.id);
                }}
                className={`w-full p-3 rounded-xl text-left transition flex items-start justify-between gap-2 border ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-md'
                    : 'hover:bg-[#151726] text-slate-400 border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        isSelected ? 'bg-amber-500/30 text-amber-100' : 'bg-[#1D1F33] text-slate-400'
                      }`}
                    >
                      #{sc.scene_number}
                    </span>
                    <span className="text-xs font-bold truncate text-slate-100">
                      {sc.title || `Adegan ${sc.scene_number}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {sc.location_name || 'Latar Umum'} • {sc.time_of_day || 'Siang'}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pt-0.5">
                    <span>{sc.duration_sec}s</span>
                    <span>•</span>
                    <span>{scShots.length} shot</span>
                    {sc.master_frame_image_url && (
                      <span className="text-emerald-400 font-semibold"> • Master ✓</span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 mt-1 shrink-0 ${
                    isSelected ? 'text-amber-400 opacity-100' : 'text-slate-600 opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. CENTER UNIFIED COMMAND CENTER */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-5">
        {currentScene && (
          <>
            {/* Top Scene Command Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141626] border border-[#25283E] p-4 sm:p-5 rounded-2xl shadow-xl">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase text-amber-400 font-bold">
                  <span>Adegan #{currentScene.scene_number}</span>
                  <span>•</span>
                  <span>{currentScene.location_name}</span>
                  <span>•</span>
                  <span>{currentScene.time_of_day || 'Day'}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  {currentScene.title || `Adegan ${currentScene.scene_number}`}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(readScenePrompt(currentScene).text, `sc-master-${currentScene.id}`)}
                  disabled={!readScenePrompt(currentScene).hasPrompt}
                  className="px-3 py-2 bg-[#212338] hover:bg-[#2A2E4B] text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Salin Master Banana Image Prompt 1-Klik"
                >
                  {copiedId === `sc-master-${currentScene.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{copiedId === `sc-master-${currentScene.id}` ? 'Tersalin!' : 'Salin Master Banana'}</span>
                </button>

                <button
                  onClick={() => onRegenerateScenePrompt(currentScene.id)}
                  disabled={isProcessing}
                  className="px-3 py-2 rounded-xl text-xs bg-[#212338] hover:bg-[#2A2E4B] border border-[#2F3352] text-slate-200 font-semibold transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                  <span>Regen Prompt</span>
                </button>

                <button
                  onClick={() => onRunScenePipeline(currentScene.id)}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-xl text-xs bg-amber-500 hover:bg-amber-400 text-black font-extrabold shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Memproses...' : 'Jalankan Pipeline'}</span>
                </button>
              </div>
            </div>

            {/* Sub-Navigation Switcher (All in Scene Studio!) */}
            <div className="flex items-center gap-2 bg-[#121424] p-1.5 rounded-2xl border border-[#23253B]">
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  viewMode === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-[#1A1C30]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Kendali Lengkap (All-in-One)</span>
              </button>

              <button
                onClick={() => setViewMode('shots')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  viewMode === 'shots'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-[#1A1C30]'
                }`}
              >
                <PlaySquare className="w-3.5 h-3.5" />
                <span>Subdivisi Shot ({currentShots.length})</span>
              </button>

              <button
                onClick={() => setViewMode('assets')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  viewMode === 'assets'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-[#1A1C30]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Asset &amp; Tokoh Adegan</span>
              </button>
            </div>

            {/* VIEW MODE 1: ALL-IN-ONE & OVERVIEW */}
            {(viewMode === 'all' || viewMode === 'shots') && (
              <div className="space-y-4">
                {/* Master Frame Canvas & Master Prompt */}
                {viewMode === 'all' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Master Frame Thumbnail */}
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-[#25283E] flex items-center justify-center group shadow-xl">
                      {currentScene.master_frame_image_url ? (
                        <img
                          src={currentScene.master_frame_image_url}
                          alt={currentScene.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="p-4 text-center text-slate-600 space-y-2">
                          <ImageIcon className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                          <span className="text-[11px] font-mono text-slate-500 block">Belum ada Master Frame</span>
                        </div>
                      )}
                      <button
                        onClick={() => setIsEditingSceneImage(!isEditingSceneImage)}
                        className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-black/90 hover:bg-black text-amber-300 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1.5 shadow-lg transition"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        {currentScene.master_frame_image_url ? 'Ganti Frame' : 'URL Frame'}
                      </button>
                    </div>

                    {/* Master Banana Image Prompt Box */}
                    <div className="lg:col-span-2 bg-[#121424] border border-[#23253B] rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xl">
                      <div className="flex items-center justify-between border-b border-[#212338] pb-2">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Google Banana Pro Master Frame Prompt</span>
                        </div>
                        <button
                          onClick={() => handleCopy(readScenePrompt(currentScene).text, `box-${currentScene.id}`)}
                          disabled={!readScenePrompt(currentScene).hasPrompt}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {copiedId === `box-${currentScene.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === `box-${currentScene.id}` ? 'Tersalin!' : 'Salin'}</span>
                        </button>
                      </div>

                      <p
                        className={`font-mono text-xs leading-relaxed whitespace-pre-wrap select-all bg-[#0A0B14] p-3 rounded-xl border border-[#1E2033] flex-1 ${
                          readScenePrompt(currentScene).hasPrompt ? 'text-slate-300' : 'text-slate-500 italic'
                        }`}
                      >
                        {readScenePrompt(currentScene).text}
                      </p>
                    </div>
                  </div>
                )}

                {/* Edit Scene Image Drawer */}
                {isEditingSceneImage && (
                  <div className="p-3 bg-[#16182C] border border-amber-500/30 rounded-xl flex items-center gap-2">
                    <input
                      type="url"
                      value={sceneImageUrlInput}
                      onChange={(e) => setSceneImageUrlInput(e.target.value)}
                      placeholder="Tempel URL gambar Master Frame (https://...)"
                      className="flex-1 bg-[#0F101E] border border-[#292C47] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        onUpdateSceneImage(currentScene.id, sceneImageUrlInput.trim() || null);
                        setIsEditingSceneImage(false);
                        setSceneImageUrlInput('');
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
                    >
                      Simpan
                    </button>
                  </div>
                )}

                {/* Authoritative Timeline Bar */}
                <div className="bg-[#121424] border border-[#23253B] rounded-2xl p-4 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
                        Authoritative Scene Timeline ({sceneAuthoritativeDuration}s)
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded font-bold ${
                        isDurationBalanced
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      Shot Subdivisi: {shotsTotalDuration.toFixed(1)}s / {sceneAuthoritativeDuration.toFixed(1)}s{' '}
                      {isDurationBalanced ? '✓' : '⚠️'}
                    </span>
                  </div>

                  <div className="w-full h-8 bg-[#090B12] rounded-xl border border-[#212338] overflow-hidden flex p-1 gap-1">
                    {currentShots.length === 0 ? (
                      <div className="w-full flex items-center justify-center text-[10px] font-mono text-slate-600">
                        Belum ada subdivisi shot
                      </div>
                    ) : (
                      currentShots.map((sh, idx) => {
                        const widthPercent = ((sh.duration_sec || 1) / sceneAuthoritativeDuration) * 100;
                        return (
                          <div
                            key={sh.id || idx}
                            style={{ width: `${Math.max(5, widthPercent)}%` }}
                            className="h-full bg-[#1A1D33] hover:bg-indigo-500/20 border border-[#2B2E4D] hover:border-indigo-500/40 rounded-lg flex items-center justify-between px-2 text-[10px] font-mono text-slate-300 transition group cursor-pointer"
                            title={`Shot #${sh.shot_number}: ${sh.duration_sec}s (${sh.camera_movement || 'Kamera'})`}
                          >
                            <span className="font-bold">S{sh.shot_number}</span>
                            <span className="text-slate-400 group-hover:text-amber-300">{sh.duration_sec}s</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* SHOT SUBDIVISION LIST (COMPACT DEFAULT COLLAPSED, MATCHING USER REFERENCE IMAGE) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">
                      <PlaySquare className="w-4 h-4" />
                      <span>Subdivisi Shot &amp; Prompt Engine ({currentShots.length} shot)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAllShotsExpand(true)}
                        className="px-2.5 py-1 bg-[#1A1C30] hover:bg-[#232642] text-slate-300 rounded-lg text-[11px] font-semibold border border-[#2A2D4A] transition"
                      >
                        Buka Semua
                      </button>
                      <button
                        onClick={() => toggleAllShotsExpand(false)}
                        className="px-2.5 py-1 bg-[#1A1C30] hover:bg-[#232642] text-slate-300 rounded-lg text-[11px] font-semibold border border-[#2A2D4A] transition"
                      >
                        Tutup Semua
                      </button>
                    </div>
                  </div>

                  {currentShots.map((sh, sIdx) => {
                    const shotId = sh.id || `shot-${currentScene.id}-${sIdx}`;
                    const isExpanded = expandedShots[shotId] ?? false; // DEFAULT IS COLLAPSED (false)
                    const activeTarget: PromptTarget = selectedTarget[shotId] || 'seedance_10';

                    // One read per (shot, activeTarget). Switching target re-reads;
                    // it never reuses another target's text.
                    const activePrompt = readPrompt(sh, activeTarget);
                    const activePromptText = activePrompt.text;
                    const quickPrompt = readPrompt(sh, 'seedance_10');

                    return (
                      <div
                        key={shotId}
                        className="bg-[#121424] border border-[#23263B] hover:border-indigo-500/30 rounded-2xl shadow-xl transition overflow-hidden"
                      >
                        {/* Shot Top Bar (Matching Reference Image Style) */}
                        <div className="p-3.5 flex items-center justify-between gap-3 bg-[#16182C]">
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-mono font-extrabold text-xs shadow-sm">
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
                            <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              {sh.duration_sec}s
                            </span>

                            <button
                              onClick={() => toggleShotExpand(shotId)}
                              className="p-1 rounded-lg bg-[#23263D] hover:bg-[#2C2F4D] text-slate-300 transition border border-[#2F3352]"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* COLLAPSED QUICK VIEW ROW */}
                        {!isExpanded && (
                          <div className="px-4 py-2.5 bg-[#0F101E] border-t border-[#1C1E33] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="text-xs text-slate-300 truncate font-mono">
                                <strong className="text-indigo-300">Aksi:</strong> {sh.visual_description || sh.action || 'Visual sinematik.'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleCopy(quickPrompt.text, `quick-${shotId}`)}
                                disabled={!quickPrompt.hasPrompt}
                                title={quickPrompt.hasPrompt ? 'Salin prompt Seedance 10s' : 'Prompt belum digenerate'}
                                className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {copiedId === `quick-${shotId}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copiedId === `quick-${shotId}` ? 'Tersalin!' : 'Salin Seedance 10s'}</span>
                              </button>

                              <button
                                onClick={() => toggleShotExpand(shotId)}
                                className="text-xs font-semibold text-slate-400 hover:text-white transition"
                              >
                                Detail &rarr;
                              </button>
                            </div>
                          </div>
                        )}

                        {/* EXPANDED FULL VIEW (MATCHING REFERENCE IMAGE UI EXACTLY) */}
                        {isExpanded && (
                          <div className="p-4 space-y-4 border-t border-[#1C1E33] bg-[#0F101E]">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                              {/* Shot Visual Keyframe */}
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
                                {onUpdateShotImage && (
                                  <button
                                    onClick={() => setEditingShotId(editingShotId === shotId ? null : shotId)}
                                    className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-black/90 hover:bg-black text-amber-300 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1.5 shadow-lg transition"
                                  >
                                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                                    {sh.image_url ? 'Ganti URL' : 'URL'}
                                  </button>
                                )}
                              </div>

                              {/* Shot Visual Description & Audio */}
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
                                      {sh.audio_narration || (Array.isArray(sh.dialogue) && sh.dialogue.length > 0 ? sh.dialogue.map(d => `${d.character_name}: "${d.line}"`).join(' | ') : (typeof sh.dialogue === 'string' ? sh.dialogue : '')) || sh.sound_effects || 'Natural SFX'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Edit Shot Image Input */}
                            {editingShotId === shotId && onUpdateShotImage && (
                              <div className="p-3 bg-[#16182C] border border-amber-500/30 rounded-xl flex items-center gap-2">
                                <input
                                  type="url"
                                  value={shotImageUrlInput}
                                  onChange={(e) => setShotImageUrlInput(e.target.value)}
                                  placeholder="Tempel URL keyframe shot (https://...)"
                                  className="flex-1 bg-[#0F101E] border border-[#292C47] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                />
                                <button
                                  onClick={() => {
                                    onUpdateShotImage(shotId, shotImageUrlInput.trim() || null);
                                    setEditingShotId(null);
                                    setShotImageUrlInput('');
                                  }}
                                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition"
                                >
                                  Simpan
                                </button>
                              </div>
                            )}

                            {/* PROMPT GENERATOR CONTAINER */}
                            <div className="p-4 rounded-xl bg-[#16182C] border border-indigo-500/30 space-y-3 shadow-lg">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#242742] pb-3">
                                {/* Explicit PromptTarget switcher: ONE button per
                                    canonical target (banana_image / veo / omni /
                                    seedance_10 / seedance_30). */}
                                <div className="flex items-center gap-1.5 overflow-x-auto">
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

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => handleCopy(activePromptText, shotId)}
                                    disabled={!activePrompt.hasPrompt}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    {copiedId === shotId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedId === shotId ? 'Tersalin!' : 'Salin Prompt'}</span>
                                  </button>

                                  {onRunShotPrompt && (
                                    <button
                                      onClick={() => onRunShotPrompt(shotId, activeTarget)}
                                      disabled={processingShotId === shotId}
                                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 ${processingShotId === shotId ? 'animate-spin' : ''}`} />
                                      <span>
                                        {processingShotId === shotId
                                          ? 'Generating...'
                                          : `Gen ${PROMPT_TARGET_LABELS[activeTarget]}`}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[11px] font-mono font-bold text-amber-300">
                                  {PROMPT_TARGET_DESCRIPTIONS[activeTarget]}
                                </span>
                                <div className="flex items-center gap-2">
                                  {activePrompt.hasPrompt && activePrompt.resolvedDurationSec !== null && (
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

                              {/* Empty state shows PROMPT_EMPTY_MESSAGE, never
                                  another target's prompt. */}
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
                  })}
                </div>
              </div>
            )}

            {/* VIEW MODE 3: ASSETS INVOLVED IN THIS SCENE */}
            {(viewMode === 'all' || viewMode === 'assets') && (
              <div className="space-y-4 pt-4 border-t border-[#23253B]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                  <Users className="w-4 h-4" />
                  <span>Asset Bible &amp; Prompts Terkait Adegan Ini</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Scene Characters */}
                  {sceneCharacters.map((char, cIdx) => {
                    const cPrompt = getCharacterBananaPrompt(char);
                    return (
                      <div
                        key={char.id || cIdx}
                        className="bg-[#121424] border border-[#23253B] rounded-2xl p-4 space-y-3 shadow-xl"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-amber-400" />
                            <h4 className="text-sm font-extrabold text-white">{char.name}</h4>
                          </div>
                          <button
                            onClick={() => handleCopy(cPrompt, `c-${char.id || cIdx}`)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-bold flex items-center gap-1 hover:bg-amber-500/30 transition"
                          >
                            {copiedId === `c-${char.id || cIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === `c-${char.id || cIdx}` ? 'Tersalin!' : 'Salin Prompt'}</span>
                          </button>
                        </div>
                        <p className="font-mono text-xs text-slate-300 bg-[#0A0B14] p-3 rounded-xl border border-[#1E2033] leading-relaxed select-all">
                          {cPrompt}
                        </p>
                      </div>
                    );
                  })}

                  {/* Scene Locations */}
                  {sceneLocations.map((loc, lIdx) => {
                    const lPrompt = getLocationBananaPrompt(loc);
                    return (
                      <div
                        key={loc.id || lIdx}
                        className="bg-[#121424] border border-[#23253B] rounded-2xl p-4 space-y-3 shadow-xl"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-cyan-400" />
                            <h4 className="text-sm font-extrabold text-white">{loc.name}</h4>
                          </div>
                          <button
                            onClick={() => handleCopy(lPrompt, `l-${loc.id || lIdx}`)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center gap-1 hover:bg-cyan-500/30 transition"
                          >
                            {copiedId === `l-${loc.id || lIdx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === `l-${loc.id || lIdx}` ? 'Tersalin!' : 'Salin Prompt'}</span>
                          </button>
                        </div>
                        <p className="font-mono text-xs text-slate-300 bg-[#0A0B14] p-3 rounded-xl border border-[#1E2033] leading-relaxed select-all">
                          {lPrompt}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. RIGHT COLUMN: Scene Intelligence Panel */}
      <div className="w-full lg:w-80 bg-[#0C101A] border-l border-[#212335] p-4 sm:p-5 flex flex-col space-y-5 shrink-0 overflow-y-auto">
        <div className="flex items-center gap-2 pb-3 border-b border-[#212335]">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-slate-200">
            Scene Intelligence
          </h3>
        </div>

        {currentScene && (
          <div className="space-y-4 text-xs">
            {/* Tone & Atmosphere */}
            <div className="p-3 rounded-xl bg-[#121424] border border-[#23253B] space-y-2">
              <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Tonus &amp; Atmosfer</div>
              <div className="font-semibold text-slate-200">{currentScene.tone || 'Khidmat, Epik'}</div>
              <div className="text-slate-400 text-[11px]">{currentScene.lighting || 'Pencahayaan alami'}</div>
            </div>

            {/* Location & Era */}
            <div className="p-3 rounded-xl bg-[#121424] border border-[#23253B] space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Latar Lokasi</div>
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="font-semibold text-slate-200">{currentScene.location_name}</div>
              <div className="text-slate-400 text-[11px]">Era: Abad ke-6 Hijaz / Makkah Kuno</div>
            </div>

            {/* Characters Present & Costume Lock */}
            <div className="p-3 rounded-xl bg-[#121424] border border-[#23253B] space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Tokoh Terlibat</div>
                <Users className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="space-y-1.5">
                {currentScene.characters_present && currentScene.characters_present.length > 0 ? (
                  currentScene.characters_present.map((charName) => (
                    <div
                      key={charName}
                      className="flex items-center justify-between bg-[#0A0B14] px-2.5 py-1.5 rounded-lg border border-[#1E2033]"
                    >
                      <span className="text-slate-200 font-medium">{charName}</span>
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        🔒 Kostum Terkunci
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">Tidak ada tokoh eksplisit</div>
                )}
              </div>
            </div>

            {/* Dramatic Purpose */}
            <div className="p-3 rounded-xl bg-[#121424] border border-[#23253B] space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">Tujuan Dramatis</div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {currentScene.dramatic_purpose || currentScene.action_summary || 'Menghidupkan progresi naratif.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
