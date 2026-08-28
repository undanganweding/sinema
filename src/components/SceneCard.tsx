import React, { useState, useRef } from 'react';
import {
  Film,
  Camera,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Upload,
  Link,
  Trash2,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { Scene, Shot, VideoPrompt, Project } from '../types';
import { CombinedPromptViewer } from './CombinedPromptViewer';
import { ShotRow } from './ShotRow';

interface SceneCardProps {
  scene: Scene;
  project: Project;
  shots: Shot[];
  videoPrompts: Record<string, VideoPrompt[]>; // keyed by shot_id
  onRunScenePipeline: (sceneId: string) => Promise<void>;
  onRegenerateScenePrompt: (sceneId: string) => Promise<void>;
  onUpdateSceneImage: (sceneId: string, imageUrl: string | null) => Promise<void>;
  onUpdateShotImage: (shotId: string, imageUrl: string | null) => Promise<void>;
  isProcessingPipeline?: boolean;
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  project,
  shots = [],
  videoPrompts = {},
  onRunScenePipeline,
  onRegenerateScenePrompt,
  onUpdateSceneImage,
  onUpdateShotImage,
  isProcessingPipeline = false,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showPromptViewer, setShowPromptViewer] = useState<boolean>(false);
  const [showFullScenePrompt, setShowFullScenePrompt] = useState<boolean>(false);
  const [isFullPromptCopied, setIsFullPromptCopied] = useState<boolean>(false);
  const [showPromptJson, setShowPromptJson] = useState<boolean>(false);
  const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState<boolean>(false);
  const [isPromptCopied, setIsPromptCopied] = useState<boolean>(false);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [pastedUrl, setPastedUrl] = useState<string>('');
  const [isSavingImage, setIsSavingImage] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalShotsDuration = shots.reduce((sum, sh) => sum + sh.duration_sec, 0);
  const isShotsDurationExact = shots.length > 0 && totalShotsDuration === scene.duration_sec;

  // Compile prompt text for clipboard copy
  const getCompiledMasterPrompt = () => {
    const pj = scene.master_image_prompt_json;
    if (!pj) return `Master cinematic film still. Scene #${scene.scene_number}: ${scene.title}. ${scene.event}. Shot on 35mm anamorphic lens. Lighting: volumetric cinematic lighting. Historical accuracy 8k UHD.`;
    return `Master cinematic film still, ${pj.cinematic_style || 'Panavision 35mm style'}. ${pj.subject || scene.event}. ${pj.characters_note || ''}. Costumes: ${pj.costume || ''}. Location & Era: ${pj.location || scene.location_name}, ${pj.era || 'Historical'}, ${pj.architecture || ''}. Environment: ${pj.environment || scene.time_of_day}. Lighting: ${pj.lighting || ''}. Composition: ${pj.composition || 'Rule of thirds'}. Shot on ${pj.camera || 'Arri Alexa 65'}, ${pj.lens || '35mm anamorphic'}. Mood: ${pj.mood || scene.emotional_objective}. Photorealistic, ultra-detailed 8k, historical accuracy.\nNegative Prompt: ${pj.negative_prompt || 'no modern objects, no modern textiles, no deformed faces, no CGI artifacts'}`;
  };

  const handleCopyPrompt = () => {
    const text = getCompiledMasterPrompt();
    navigator.clipboard.writeText(text);
    setIsPromptCopied(true);
    setTimeout(() => setIsPromptCopied(false), 2000);
  };

  const handleRegenerateTextPrompt = async () => {
    if (!scene.id) return;
    setIsRegeneratingPrompt(true);
    try {
      await onRegenerateScenePrompt(scene.id);
    } finally {
      setIsRegeneratingPrompt(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scene.id) return;

    setIsSavingImage(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (base64 && scene.id) {
        await onUpdateSceneImage(scene.id, base64);
      }
      setIsSavingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setIsSavingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePastedUrl = async () => {
    if (!pastedUrl.trim() || !scene.id) return;
    setIsSavingImage(true);
    try {
      await onUpdateSceneImage(scene.id, pastedUrl.trim());
      setPastedUrl('');
      setShowUrlInput(false);
    } finally {
      setIsSavingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!scene.id) return;
    setIsSavingImage(true);
    try {
      await onUpdateSceneImage(scene.id, null);
    } finally {
      setIsSavingImage(false);
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl overflow-hidden backdrop-blur transition hover:border-zinc-700/90 shadow-sm space-y-0">
      {/* Top Header of Scene Card */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 font-mono font-bold text-sm flex items-center justify-center border border-amber-500/30 shrink-0">
              #{scene.scene_number}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base sm:text-lg font-bold text-zinc-100">{scene.title}</h4>
                {scene.status === 'completed' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Tahap 6-8 Siap
                  </span>
                )}
                {scene.continuity_status === 'passed' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Kontinuitas Lolos
                  </span>
                )}
                {scene.continuity_status === 'warning' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-mono">
                    ⚠️ Peringatan Kontinuitas
                  </span>
                )}
                {scene.continuity_status === 'continuity_failed' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-mono">
                    ✕ Kontinuitas Terlanggar
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-1">
                <span className="text-amber-400 font-medium">{scene.narrative_function}</span>
                <span>•</span>
                <span>{scene.location_name}</span>
                <span>•</span>
                <span className="font-mono uppercase text-zinc-300">{scene.time_of_day}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-sm font-mono font-extrabold px-3 py-1.5 rounded-xl bg-zinc-950 border border-amber-500/30 text-amber-400 shadow-sm">
              ⏱ {scene.duration_sec} dtk dialokasikan
            </span>
          </div>
        </div>

        {/* Middle Content: Visual Master Frame & Scene Narrative Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Master Frame Preview & Manual Input Section */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Master Frame (Tahap 7)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700">
                  Target: Nano Banana Pro
                </span>
              </div>

              {/* Frame Image Display / Clean Placeholder */}
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center group">
                {scene.master_frame_image_url ? (
                  <>
                    <img
                      src={scene.master_frame_image_url}
                      alt={`Master Frame Adegan ${scene.scene_number}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg bg-zinc-800/90 text-zinc-200 hover:text-white text-xs flex items-center gap-1 border border-zinc-700 cursor-pointer"
                        title="Ganti file gambar"
                      >
                        <Upload className="w-3.5 h-3.5" /> Ganti
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="p-1.5 rounded-lg bg-red-950/80 text-red-300 hover:text-red-100 text-xs flex items-center gap-1 border border-red-800/60 cursor-pointer"
                        title="Hapus gambar"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-3 text-center space-y-1.5 text-zinc-500">
                    <ImageIcon className="w-6 h-6 mx-auto text-zinc-600" />
                    <span className="text-[11px] font-medium text-zinc-400 block">
                      Belum Ada Gambar Referensi
                    </span>
                    <span className="text-[10px] text-zinc-500 block leading-tight">
                      Salin prompt di bawah, generate di AI Studio/Gemini, lalu upload atau paste URL di sini.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt Actions Bar */}
            <div className="space-y-2 pt-1 border-t border-zinc-800/80">
              {/* Copy Prompt Button */}
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="w-full py-2 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {isPromptCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Prompt Gambar Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Salin Prompt Master Frame</span>
                  </>
                )}
              </button>

              {/* External Tool Links */}
              <div className="grid grid-cols-2 gap-1.5">
                <a
                  href="https://aistudio.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-medium transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3 text-amber-400" />
                  <span>AI Studio</span>
                </a>
                <a
                  href="https://gemini.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-medium transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3 text-amber-400" />
                  <span>Gemini App</span>
                </a>
              </div>

              {/* Upload or Paste URL Options */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSavingImage}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3 h-3 text-amber-400" />
                  <span>Upload Gambar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[11px] font-medium transition flex items-center justify-center gap-1 cursor-pointer"
                  title="Tempel URL Gambar"
                >
                  <Link className="w-3 h-3 text-amber-400" />
                  <span>URL</span>
                </button>
                {scene.master_image_prompt_json && (
                  <button
                    type="button"
                    onClick={() => setShowPromptJson(!showPromptJson)}
                    title="Lihat Detail JSON Master Prompt"
                    className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Paste URL Input Form */}
              {showUrlInput && (
                <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 space-y-2">
                  <span className="text-[10px] text-zinc-400 block font-semibold">
                    Tempel Link / URL Gambar Hasil:
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      placeholder="https://... atau data:image/..."
                      value={pastedUrl}
                      onChange={(e) => setPastedUrl(e.target.value)}
                      className="flex-1 px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleSavePastedUrl}
                      disabled={isSavingImage || !pastedUrl.trim()}
                      className="px-2.5 py-1 rounded bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer disabled:opacity-40"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              )}

              {/* Regenerate Stage 7 Text Prompt */}
              <button
                type="button"
                onClick={handleRegenerateTextPrompt}
                disabled={isRegeneratingPrompt}
                className="w-full py-1 text-[11px] text-zinc-400 hover:text-amber-300 transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isRegeneratingPrompt ? (
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                ) : (
                  <Sparkles className="w-3 h-3 text-amber-400/80" />
                )}
                <span>Regenerate Prompt Teks (Tahap 7)</span>
              </button>

              {/* Master Frame JSON Breakdown */}
              {showPromptJson && scene.master_image_prompt_json && (
                <div className="p-2.5 bg-zinc-900 rounded-lg text-[10px] font-mono text-zinc-300 space-y-1 border border-zinc-800 max-h-48 overflow-y-auto">
                  <span className="font-bold text-amber-400 block">JSON Prompt Master Image:</span>
                  <p><strong className="text-zinc-400">Subjek:</strong> {scene.master_image_prompt_json.subject}</p>
                  <p><strong className="text-zinc-400">Pencahayaan:</strong> {scene.master_image_prompt_json.lighting}</p>
                  <p><strong className="text-zinc-400">Kamera & Lensa:</strong> {scene.master_image_prompt_json.camera} ({scene.master_image_prompt_json.lens})</p>
                  <p><strong className="text-zinc-400">Gaya:</strong> {scene.master_image_prompt_json.cinematic_style}</p>
                  <p><strong className="text-red-400">Prompt Negatif:</strong> {scene.master_image_prompt_json.negative_prompt}</p>
                </div>
              )}
            </div>
          </div>

          {/* Scene Event & Narrative Description */}
          <div className="lg:col-span-2 space-y-3 text-xs flex flex-col justify-between">
            <div className="space-y-2.5">
              <div>
                <span className="text-zinc-400 font-semibold block mb-1 uppercase tracking-wider text-[10px]">
                  Aksi Dramatis & Peristiwa Kejadian:
                </span>
                <p className="text-zinc-200 leading-relaxed font-medium bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/80">
                  {scene.event}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-400 block font-semibold mb-0.5">Tujuan Cerita:</span>
                  <p className="text-zinc-300">{scene.story_purpose}</p>
                </div>
                <div className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-400 block font-semibold mb-0.5">Ketukan Emosional:</span>
                  <p className="text-zinc-300">{scene.emotional_objective}</p>
                </div>
              </div>

              {scene.character_names && scene.character_names.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 font-medium">Tokoh dalam Adegan:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {scene.character_names.map((charName, cIdx) => (
                      <span
                        key={`char-${scene.id || ''}-${charName}-${cIdx}`}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]"
                      >
                        {charName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-Divisi Beat Adegan (Story Architecture Beat Breakdown) */}
              {scene.beats && scene.beats.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono uppercase text-amber-400/90 font-bold flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-400" /> Sub-Divisi Beat ({scene.beats.length} Beat):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {scene.beats.map((b, bIdx) => (
                      <div key={b.id || b.beat_id || `beat-${scene.id || ''}-${b.beat_number || bIdx}-${bIdx}`} className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-2 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-zinc-200">Beat #{b.beat_number}</span>
                          <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-zinc-900 text-amber-300 border border-zinc-700">
                            {b.narrative_mode}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-[10px]">{b.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar for Shots Breakdown & Combined Prompt */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800/80">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => scene.id && onRunScenePipeline(scene.id)}
                  disabled={isProcessingPipeline}
                  className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPipeline ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses Tahap 6-8...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 fill-zinc-950" />
                      <span>{shots.length > 0 ? 'Jalankan Ulang Tahap 6-8' : 'Jalankan Tahap 6-8 (Shot & Prompt)'}</span>
                    </>
                  )}
                </button>

                {scene.full_scene_prompt && (
                  <button
                    type="button"
                    onClick={() => setShowFullScenePrompt(!showFullScenePrompt)}
                    className="py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition border border-amber-500/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{showFullScenePrompt ? 'Tutup Full Scene Prompt' : 'Full Scene Prompt (Tahap 8)'}</span>
                  </button>
                )}

                {shots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPromptViewer(!showPromptViewer)}
                    className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{showPromptViewer ? 'Sembunyikan Prompt Gabungan' : 'Prompt Per-Shot'}</span>
                  </button>
                )}
              </div>

              {/* Toggle Expand Shots */}
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                <span>{shots.length} Shot {isExpanded ? '▲' : '▼'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Scene Production Prompt Modal/Drawer */}
      {showFullScenePrompt && scene.full_scene_prompt && (
        <div className="mx-5 mb-5 sm:mx-6 sm:mb-6 bg-zinc-950 border border-amber-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-zinc-100 text-sm">
                Full Scene Production Prompt (Fixed Duration: {scene.duration_sec}s)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Tahap 8 Kontinuitas Lolos
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(scene.full_scene_prompt || '');
                setIsFullPromptCopied(true);
                setTimeout(() => setIsFullPromptCopied(false), 2000);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/20 self-start sm:self-auto"
            >
              {isFullPromptCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isFullPromptCopied ? 'Tersalin!' : 'Salin Prompt Adegan Lengkap'}</span>
            </button>
          </div>

          <div className="bg-zinc-900/90 rounded-xl p-4 text-xs font-mono text-zinc-200 leading-relaxed whitespace-pre-wrap border border-zinc-800">
            {scene.full_scene_prompt}
          </div>
        </div>
      )}

      {/* Derived Combined Prompt Viewer Section */}
      {showPromptViewer && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <CombinedPromptViewer
            scene={scene}
            videoPlatforms={project.video_model || ['veo']}
            includeSeedance={Boolean(project.include_seedance_format)}
          />
        </div>
      )}

      {/* Expanded Shot Breakdown Rows Section */}
      {isExpanded && (
        <div className="p-5 sm:p-6 bg-zinc-950/90 border-t border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-amber-400" />
              <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                Garis Waktu Rincian Shot ({shots.length} Shot)
              </h5>
            </div>

            {/* Strict Duration Sum Validation Indicator */}
            {shots.length > 0 && (
              <div
                className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  isShotsDurationExact
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                <span>Total: {totalShotsDuration} dtk / {scene.duration_sec} dtk</span>
                <span>{isShotsDurationExact ? '✓ Presisi 0s tolerance' : '⚠️ durasi belum cocok'}</span>
              </div>
            )}
          </div>

          {shots.length === 0 ? (
            <div className="py-8 text-center space-y-2 bg-zinc-900/40 rounded-xl border border-zinc-800">
              <Film className="w-6 h-6 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400">Belum ada data shot untuk adegan ini.</p>
              <p className="text-[11px] text-zinc-500">
                Klik tombol "Jalankan Tahap 6-8 (Shot & Prompt)" untuk melakukan rincian shot dan perumusan prompt video platform.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {shots.map((shot, sIdx) => {
                const shotPrompts = (shot.id && videoPrompts[shot.id]) || [];
                return (
                  <ShotRow
                    key={shot.id || `shot-${scene.id || ''}-${shot.shot_number || sIdx}-${sIdx}`}
                    shot={shot}
                    videoPrompts={shotPrompts}
                    includeSeedance={Boolean(project.include_seedance_format)}
                    onUpdateShotImage={onUpdateShotImage}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
