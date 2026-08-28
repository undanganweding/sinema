import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  Camera,
  MessageSquare,
  Volume2,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Video as VideoIcon,
  Upload,
  Link,
  Trash2,
  ExternalLink,
  AlertCircle,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { PromptTarget, Shot, VideoPrompt } from '../types';
import {
  PROMPT_EMPTY_MESSAGE,
  PROMPT_TARGET_LABELS,
  resolveRowTarget,
} from '../lib/prompt_targets';

/**
 * PATCH 5.5-R1 FASE 5: the video targets this row can switch between, in UI
 * order. `seedance_10` and `seedance_30` are SEPARATE entries — the old single
 * "Format Seedance" button could not express which duration contract was meant.
 * `banana_image` is not here: this panel is the Stage 8 *video* prompt panel.
 */
const ROW_VIDEO_TARGETS: PromptTarget[] = ['veo', 'omni', 'seedance_10', 'seedance_30'];

interface ShotRowProps {
  shot: Shot;
  videoPrompts: VideoPrompt[];
  includeSeedance: boolean;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => Promise<void>;
  onPromptsUpdated?: (shotId: string, prompts: VideoPrompt[]) => void;
}

export const ShotRow: React.FC<ShotRowProps> = ({
  shot,
  videoPrompts,
  includeSeedance,
  onUpdateShotImage,
  onPromptsUpdated,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  // FASE 5: the row addresses prompts by canonical PromptTarget, never by the
  // legacy `target_platform` alias.
  const [selectedTarget, setSelectedTarget] = useState<PromptTarget>('veo');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState<boolean>(false);
  const [pastedUrl, setPastedUrl] = useState<string>('');
  const [isSavingImage, setIsSavingImage] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [localPrompts, setLocalPrompts] = useState<VideoPrompt[]>(videoPrompts);
  const [regenError, setRegenError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLocalPrompts(videoPrompts);
  }, [videoPrompts]);

  // Per-(shot, target) lookup. resolveRowTarget prefers the explicit
  // `prompt_target` column and falls back to the row's resolved duration for
  // legacy rows; it never guesses seedance_10 vs seedance_30 by name alone.
  const activeVideoPrompt = localPrompts.find((vp) => resolveRowTarget(vp) === selectedTarget);
  const hasAnyFailedPrompt = localPrompts.some((vp) => vp.status === 'video_prompt_failed');
  const isSeedanceTarget = selectedTarget === 'seedance_10' || selectedTarget === 'seedance_30';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shot.id || !onUpdateShotImage) return;

    setIsSavingImage(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      if (base64 && shot.id) {
        await onUpdateShotImage(shot.id, base64);
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
    if (!pastedUrl.trim() || !shot.id || !onUpdateShotImage) return;
    setIsSavingImage(true);
    try {
      await onUpdateShotImage(shot.id, pastedUrl.trim());
      setPastedUrl('');
      setShowUrlInput(false);
    } finally {
      setIsSavingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!shot.id || !onUpdateShotImage) return;
    setIsSavingImage(true);
    try {
      await onUpdateShotImage(shot.id, null);
    } finally {
      setIsSavingImage(false);
    }
  };

  /**
   * FASE 5: sends the canonical `target` field. There is no `platform` alias and
   * no default — the caller always names the target explicitly.
   *
   * The merge below is keyed on the canonical target too, so generating Veo then
   * Omni then Seedance 30 leaves three coexisting rows instead of one row being
   * repeatedly overwritten.
   */
  const handleRegeneratePrompt = async (target: PromptTarget) => {
    if (!shot.id) return;
    setIsRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch(`/api/shots/${shot.id}/regenerate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal meregenerate video prompt.');
      }
      const data = await res.json();
      if (data.prompts && Array.isArray(data.prompts)) {
        // Merge or replace, keyed on the canonical target.
        const updated = [...localPrompts];
        for (const p of data.prompts as VideoPrompt[]) {
          const incomingTarget = resolveRowTarget(p);
          const idx = updated.findIndex((item) => resolveRowTarget(item) === incomingTarget);
          if (idx >= 0) {
            updated[idx] = p;
          } else {
            updated.push(p);
          }
        }
        setLocalPrompts(updated);
        onPromptsUpdated?.(shot.id, updated);
      }
    } catch (err: any) {
      setRegenError(err.message || 'Terjadi kesalahan saat generate prompt.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className={`bg-zinc-950/80 border rounded-xl overflow-hidden transition hover:border-zinc-700/90 ${
      hasAnyFailedPrompt ? 'border-red-900/60' : 'border-zinc-800/90'
    }`}>
      {/* Main Row Bar */}
      <div className="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Thumbnail & Main Info */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
          {/* Shot Thumbnail Slot */}
          <div className="relative group w-20 h-14 sm:w-24 sm:h-16 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0 overflow-hidden flex items-center justify-center">
            {shot.shot_image_url ? (
              <>
                <img
                  src={shot.shot_image_url}
                  alt={`Shot ${shot.shot_number}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5 p-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Ganti Gambar Shot"
                    className="p-1 rounded bg-zinc-800 text-zinc-200 hover:text-white"
                  >
                    <Upload className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    title="Hapus Gambar Shot"
                    className="p-1 rounded bg-red-900/80 text-red-300 hover:text-white"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition p-1 text-center"
                title="Klik untuk upload gambar manual untuk shot ini"
              >
                <ImageIcon className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition" />
                <span className="text-[9px] font-medium leading-none">Upload Img</span>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Shot Metadata & Event Details */}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono font-bold text-xs">
                Shot #{shot.shot_number}
              </span>
              <span className="text-xs font-mono text-zinc-400">
                {formatSeconds(shot.start_time_sec)} - {formatSeconds(shot.end_time_sec)} ({shot.duration_sec} dtk)
              </span>
              {shot.narrative_mode && (
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-zinc-700">
                  Mode: {shot.narrative_mode}
                </span>
              )}
              {shot.emotion && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  Nuansa Emosi: {shot.emotion}
                </span>
              )}

              {/* Status indicators */}
              {hasAnyFailedPrompt ? (
                <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  Prompt Gagal
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-amber-300/80">
                  Prompt Siap Pakai
                </span>
              )}
            </div>

            {/* Detail Kejadian (Single Source of Truth) */}
            <p className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-relaxed">
              {shot.event_detail}
            </p>

            {/* Camera & Action snippet */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 pt-0.5">
              <span className="flex items-center gap-1 text-zinc-300">
                <Camera className="w-3 h-3 text-amber-400" /> {shot.camera_note}
              </span>
              {shot.dialogue && shot.dialogue.length > 0 && (
                <span className="flex items-center gap-1 text-zinc-300">
                  <MessageSquare className="w-3 h-3 text-amber-400" /> {shot.dialogue.length} Dialog
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions & Toggle */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            title="Tempel URL Gambar Shot"
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition cursor-pointer text-xs"
          >
            <Link className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
              hasAnyFailedPrompt
                ? 'bg-red-950/50 hover:bg-red-900/50 text-red-200 border-red-800/80'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800'
            }`}
          >
            <span>{isExpanded ? 'Tutup Rincian' : 'Lihat Rincian & Prompt'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Paste URL for Shot Image Drawer */}
      {showUrlInput && (
        <div className="p-3 bg-zinc-900/90 border-t border-zinc-800 flex items-center gap-2">
          <span className="text-[11px] text-zinc-400 font-semibold shrink-0">URL Gambar Shot:</span>
          <input
            type="url"
            placeholder="https://... atau data:image/..."
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            className="flex-1 px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs focus:outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={handleSavePastedUrl}
            disabled={isSavingImage || !pastedUrl.trim()}
            className="px-3 py-1 rounded bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer disabled:opacity-40"
          >
            Simpan
          </button>
        </div>
      )}

      {/* Expandable Deep Detail Panel */}
      {isExpanded && (
        <div className="p-4 bg-zinc-900/60 border-t border-zinc-800 space-y-4">
          {/* Section 1: Detail Kejadian & Action / Dialogue Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800/80 space-y-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" /> Detail Kejadian & Karakter
              </span>
              <p className="text-zinc-200 leading-relaxed font-medium">
                {shot.event_detail}
              </p>
              <div className="pt-2 border-t border-zinc-800/60 text-[11px]">
                <strong className="text-zinc-400 block mb-0.5">Aksi Karakter:</strong>
                <p className="text-zinc-300">{shot.character_action}</p>
              </div>
            </div>

            <div className="bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800/80 space-y-2">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" /> Audio, SFX & Dialog
              </span>
              {shot.dialogue && shot.dialogue.length > 0 ? (
                <div className="space-y-1.5">
                  {shot.dialogue.map((d, idx) => (
                    <div key={idx} className="p-2 rounded bg-zinc-900 text-zinc-200 text-[11px] border border-zinc-800">
                      <span className="font-bold text-amber-300 block">{d.character_name}:</span>
                      <span className="italic">"{d.line}"</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-[11px] italic">Tidak ada dialog lisan (aksi visual murni).</p>
              )}
              {shot.audio_note && (
                <div className="pt-1 text-[11px] text-zinc-400">
                  <strong className="text-zinc-300">SFX / Atmosfer Suara:</strong> {shot.audio_note}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Platform-Specific Video Prompt (Stage 8) - Manual Prompt Workflow */}
          <div className="bg-zinc-950/90 p-4 rounded-xl border border-zinc-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <VideoIcon className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Prompt Model Video (Tahap 8)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Prompt Siap Pakai — Generate Manual
                </span>
              </div>

              {/* Target Switcher — one button per canonical PromptTarget */}
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs flex-wrap">
                {ROW_VIDEO_TARGETS.filter(
                  (t) => includeSeedance || (t !== 'seedance_10' && t !== 'seedance_30')
                ).map((t) => {
                  const hasRow = localPrompts.some((vp) => resolveRowTarget(vp) === t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTarget(t)}
                      title={`${PROMPT_TARGET_LABELS[t]} (target: ${t})`}
                      className={`px-2.5 py-0.5 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
                        selectedTarget === t
                          ? 'bg-amber-500 text-zinc-950 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span>{PROMPT_TARGET_LABELS[t]}</span>
                      <span
                        aria-hidden="true"
                        className={`w-1.5 h-1.5 rounded-full ${
                          hasRow
                            ? selectedTarget === t
                              ? 'bg-emerald-700'
                              : 'bg-emerald-400'
                            : 'bg-zinc-600'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {regenError && (
              <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-300 flex items-center justify-between">
                <span>{regenError}</span>
                <button
                  type="button"
                  onClick={() => setRegenError(null)}
                  className="text-red-400 hover:text-red-200 font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* If Video Prompt Failed */}
            {activeVideoPrompt?.status === 'video_prompt_failed' ? (
              <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-red-300 font-semibold">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Prompt gagal — coba generate ulang shot ini</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRegeneratePrompt(selectedTarget)}
                    disabled={isRegenerating}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                    <span>{isRegenerating ? 'Mencoba Ulang...' : 'Generate Ulang Shot Ini'}</span>
                  </button>
                </div>
                {activeVideoPrompt.error && (
                  <p className="text-[11px] text-red-300/90 font-mono bg-red-950/80 p-2.5 rounded-lg border border-red-900/60 leading-relaxed">
                    {activeVideoPrompt.error}
                  </p>
                )}
              </div>
            ) : activeVideoPrompt ? (
              <div className="space-y-3">
                {/* Platform Prompt Content */}
                {selectedTarget === 'veo' && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-300">Teks Prompt Google Veo:</span>
                      <div className="flex items-center gap-2">
                        <a
                          href="https://aistudio.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded border border-zinc-800"
                        >
                          <ExternalLink className="w-3 h-3 text-amber-400" />
                          <span>Buka AI Studio</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRegeneratePrompt('veo')}
                          disabled={isRegenerating}
                          className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded flex items-center gap-1 cursor-pointer font-medium border border-zinc-700 disabled:opacity-50"
                          title="Generate ulang prompt Veo untuk shot ini"
                        >
                          <RotateCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin text-amber-400' : ''}`} />
                          <span>Regenerate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            activeVideoPrompt.timeline_json.prompt &&
                            copyToClipboard(activeVideoPrompt.timeline_json.prompt, `veo-prompt-${shot.id}`)
                          }
                          className="text-[11px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer font-medium"
                        >
                          {copiedKey === `veo-prompt-${shot.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin Prompt</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <pre className="p-3 bg-zinc-900 rounded-lg text-zinc-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed border border-zinc-800">
                      {activeVideoPrompt.timeline_json.prompt}
                    </pre>

                    {activeVideoPrompt.timeline_json.camera && (
                      <div className="space-y-1">
                        <span className="font-semibold text-zinc-400">Sub-Timestamp Pergerakan Kamera:</span>
                        <div className="p-2.5 bg-zinc-900/80 rounded-lg text-amber-200/90 font-mono text-[11px] border border-zinc-800 whitespace-pre-wrap">
                          {activeVideoPrompt.timeline_json.camera}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedTarget === 'omni' && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-300">Spesifikasi Prompt Gemini Omni:</span>
                      <div className="flex items-center gap-2">
                        <a
                          href="https://gemini.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded border border-zinc-800"
                        >
                          <ExternalLink className="w-3 h-3 text-amber-400" />
                          <span>Buka Gemini</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleRegeneratePrompt('omni')}
                          disabled={isRegenerating}
                          className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded flex items-center gap-1 cursor-pointer font-medium border border-zinc-700 disabled:opacity-50"
                          title="Generate ulang prompt Gemini Omni untuk shot ini"
                        >
                          <RotateCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin text-amber-400' : ''}`} />
                          <span>Regenerate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            activeVideoPrompt.timeline_json.prompt &&
                            copyToClipboard(activeVideoPrompt.timeline_json.prompt, `omni-prompt-${shot.id}`)
                          }
                          className="text-[11px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer font-medium"
                        >
                          {copiedKey === `omni-prompt-${shot.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin Prompt</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <pre className="p-3 bg-zinc-900 rounded-lg text-zinc-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed border border-zinc-800">
                      {activeVideoPrompt.timeline_json.prompt}
                    </pre>

                    {activeVideoPrompt.timeline_json.follow_up_edit_instructions && (
                      <div className="space-y-1">
                        <span className="font-semibold text-zinc-400">Instruksi Edit Lanjutan Multi-Turn:</span>
                        <p className="p-2.5 bg-zinc-900/80 rounded-lg text-zinc-300 text-[11px] border border-zinc-800">
                          {activeVideoPrompt.timeline_json.follow_up_edit_instructions}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {isSeedanceTarget && (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-300">Format Timestamp Ganda Seedance:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRegeneratePrompt(selectedTarget)}
                          disabled={isRegenerating}
                          className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded flex items-center gap-1 cursor-pointer font-medium border border-zinc-700 disabled:opacity-50"
                          title={`Generate ulang prompt ${PROMPT_TARGET_LABELS[selectedTarget]} untuk shot ini`}
                        >
                          <RotateCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin text-amber-400' : ''}`} />
                          <span>Regenerate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              JSON.stringify(activeVideoPrompt.timeline_json, null, 2),
                              `seedance-prompt-${shot.id}`
                            )
                          }
                          className="text-[11px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer font-medium"
                        >
                          {copiedKey === `seedance-prompt-${shot.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Salin Struktur Seedance</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                        <span className="text-zinc-400 font-bold block mb-0.5">Referensi Gambar:</span>
                        <p className="text-zinc-200 font-mono">{activeVideoPrompt.timeline_json.references || '@Image_MasterFrame'}</p>
                      </div>
                      <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                        <span className="text-zinc-400 font-bold block mb-0.5">Pantangan / Jangan Diubah:</span>
                        <p className="text-amber-200/90 font-mono">{activeVideoPrompt.timeline_json.do_not_change || 'Identitas karakter, gaya pencahayaan, layout lingkungan'}</p>
                      </div>
                    </div>
                    {activeVideoPrompt.timeline_json.shot_breakdown && (
                      <div className="space-y-1">
                        <span className="font-semibold text-zinc-400">Timestamp Rincian Shot:</span>
                        <pre className="p-2.5 bg-zinc-900 rounded text-zinc-200 font-mono text-[11px] whitespace-pre-wrap border border-zinc-800">
                          {activeVideoPrompt.timeline_json.shot_breakdown}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {activeVideoPrompt.negative_prompt && (
                  <div className="text-[11px] pt-1 text-zinc-400">
                    <strong className="text-red-400/80">Prompt Negatif:</strong>{' '}
                    <span className="text-zinc-300">{activeVideoPrompt.negative_prompt}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-zinc-900/60 rounded-xl text-zinc-400 text-xs text-center space-y-2">
                <p className="italic">
                  {PROMPT_EMPTY_MESSAGE} — {PROMPT_TARGET_LABELS[selectedTarget]}
                </p>
                <button
                  type="button"
                  onClick={() => handleRegeneratePrompt(selectedTarget)}
                  disabled={isRegenerating}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isRegenerating ? 'Membuat...' : `Generate Prompt ${PROMPT_TARGET_LABELS[selectedTarget]}`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
