import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Film,
  Sparkles,
  Layers,
  FileText,
  AlertCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { CombinedScenePrompt, Scene } from '../types';

interface CombinedPromptViewerProps {
  scene: Scene;
  videoPlatforms: ('veo' | 'gemini_omni')[];
  includeSeedance: boolean;
}

export const CombinedPromptViewer: React.FC<CombinedPromptViewerProps> = ({
  scene,
  videoPlatforms,
  includeSeedance,
}) => {
  const [activeTab, setActiveTab] = useState<'veo' | 'gemini_omni' | 'seedance'>('veo');
  const [viewMode, setViewMode] = useState<'full_scene' | 'shot_breakdown'>('full_scene');
  const [promptData, setPromptData] = useState<CombinedScenePrompt | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedFull, setCopiedFull] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCombinedPrompt = async (platform: string) => {
    if (!scene.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${scene.id}/combined-prompt?platform=${platform}`);
      if (!res.ok) {
        throw new Error('Gagal mengambil prompt gabungan');
      }
      const data: CombinedScenePrompt = await res.json();
      setPromptData(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat prompt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCombinedPrompt(activeTab);
  }, [scene.id, activeTab]);

  const handleCopyShotBreakdown = () => {
    if (!promptData?.text) return;
    navigator.clipboard.writeText(promptData.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyFullScene = () => {
    if (!promptData?.full_scene_prompt) return;
    navigator.clipboard.writeText(promptData.full_scene_prompt);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 2000);
  };

  return (
    <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 space-y-3">
      {/* Header and Platform Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
            Penampil Prompt Adegan #{scene.scene_number} (Durasi {scene.duration_sec} detik)
          </span>
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('veo')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'veo'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Google Veo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gemini_omni')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gemini_omni'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Gemini Omni</span>
          </button>

          {includeSeedance && (
            <button
              type="button"
              onClick={() => setActiveTab('seedance')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'seedance'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Format Seedance</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Header: View Mode Toggle & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {/* View Mode Switch */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode('full_scene')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                viewMode === 'full_scene'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Prompt Adegan Lengkap ({scene.duration_sec} dtk Terpadu)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('shot_breakdown')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                viewMode === 'shot_breakdown'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Tampilan Rincian Per-Shot
            </button>
          </div>

          {promptData && (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                promptData.status === 'complete'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              Shot Siap: {promptData.readyShots} / {promptData.totalShots}
            </span>
          )}
        </div>

        {/* Copy Buttons */}
        <div className="flex items-center gap-2">
          {viewMode === 'full_scene' && promptData?.full_scene_prompt && (
            <button
              type="button"
              onClick={handleCopyFullScene}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm"
            >
              {copiedFull ? (
                <>
                  <Check className="w-3.5 h-3.5 text-zinc-950" />
                  <span>Prompt Adegan Lengkap Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-950" />
                  <span>Salin Prompt Adegan Lengkap</span>
                </>
              )}
            </button>
          )}

          {viewMode === 'shot_breakdown' && promptData?.text && (
            <button
              type="button"
              onClick={handleCopyShotBreakdown}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition cursor-pointer border border-zinc-700 active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Salin Prompt Per-Shot</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-500">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Merapikan prompt gabungan...</span>
        </div>
      ) : error ? (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      ) : promptData?.status === 'incomplete' ? (
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center space-y-2">
          {promptData.message?.includes('gagal') ? (
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
          ) : (
            <Clock className="w-6 h-6 text-amber-400 mx-auto" />
          )}
          <p className={`text-xs font-semibold ${promptData.message?.includes('gagal') ? 'text-red-300' : 'text-zinc-300'}`}>
            {promptData.message}
          </p>
          <p className="text-[11px] text-zinc-500">
            {promptData.message?.includes('gagal')
              ? 'Silakan buka detail shot yang gagal di bawah untuk mencoba generate ulang prompt secara mandiri.'
              : 'Jalankan Tahap 6 (Rincian Shot) & Tahap 8 (Prompt Video) untuk merakit prompt video gabungan adegan ini.'}
          </p>
        </div>
      ) : (
        <div className="relative">
          <pre className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-200 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-96">
            {viewMode === 'full_scene' ? promptData?.full_scene_prompt || promptData?.text : promptData?.text}
          </pre>
        </div>
      )}
    </div>
  );
};
