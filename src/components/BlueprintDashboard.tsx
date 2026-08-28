import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  MapPin,
  Clock,
  Layers,
  CheckCircle2,
  Lock,
  Unlock,
  Film,
  Tag,
  Palette,
  Package,
  Calendar,
  Compass,
  Flame,
  ShieldCheck,
  ChevronRight,
  Tv,
  Image as ImageIcon,
  Video as VideoIcon,
  Shield,
  Sliders,
} from 'lucide-react';
import {
  Project,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  ObjectBible,
  Scene,
  Shot,
  VideoPrompt,
  StoryArchitecture,
  CharacterContinuityState,
  ApprovedCostumeTransition,
} from '../types';
import { SceneCard } from './SceneCard';
import { StoryArchitectureView } from './StoryArchitectureView';
import { ContinuityPanel } from './ContinuityPanel';

interface BlueprintDashboardProps {
  project: Project;
  foundation: ProjectFoundation | null;
  storyArchitecture?: StoryArchitecture | null;
  characters: CharacterBible[];
  continuityStates?: CharacterContinuityState[];
  locations: LocationBible[];
  objects: ObjectBible[];
  scenes: Scene[];
  shots?: Record<string, Shot[]>;
  videoPrompts?: Record<string, VideoPrompt[]>;
  onRunScenePipeline?: (sceneId: string) => Promise<void>;
  onRegenerateScenePrompt?: (sceneId: string) => Promise<void>;
  onUpdateSceneImage?: (sceneId: string, imageUrl: string | null) => Promise<void>;
  onUpdateShotImage?: (shotId: string, imageUrl: string | null) => Promise<void>;
  onApproveCostumeTransition?: (characterName: string, transition: ApprovedCostumeTransition) => Promise<void>;
  processingSceneId?: string | null;
}

export const BlueprintDashboard: React.FC<BlueprintDashboardProps> = ({
  project,
  foundation,
  storyArchitecture = null,
  characters,
  continuityStates = [],
  locations,
  objects,
  scenes,
  shots = {},
  videoPrompts = {},
  onRunScenePipeline = async () => {},
  onRegenerateScenePrompt = async () => {},
  onUpdateSceneImage = async () => {},
  onUpdateShotImage = async () => {},
  onApproveCostumeTransition,
  processingSceneId = null,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'story_structure' | 'continuity' | 'foundation' | 'characters' | 'locations' | 'scenes'
  >('overview');

  const totalCalculatedDuration = scenes.reduce((sum, s) => sum + s.duration_sec, 0);
  const isDurationExact = totalCalculatedDuration === project.total_duration_target_sec;

  // Calculate total shots and visuals
  const totalShotsCount = Object.values(shots).reduce(
    (acc: number, list: Shot[]) => acc + (Array.isArray(list) ? list.length : 0),
    0
  );
  const totalMasterFrames = scenes.filter((s) => !!s.master_frame_image_url).length;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Blueprint Header */}
      <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-6 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              Cetak Biru Produksi Sinematik • Tahap 1-8 Aktif
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-400 font-mono">ID: {project.id}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-100">{project.title}</h2>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-400">
            <span className="bg-amber-500/10 text-amber-300 font-mono font-medium px-2.5 py-1 rounded-md border border-amber-500/20">
              Penalaran AI: {project.ai_model || 'gemini-3.7-flash'}
            </span>
            <span className="bg-zinc-800 text-amber-300 font-mono font-medium px-2.5 py-1 rounded-md flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Target Visual: Nano Banana Pro
            </span>
            {foundation?.genre && (
              <span className="bg-zinc-800 text-amber-300 font-medium px-2.5 py-1 rounded-md">
                Genre: {foundation.genre}
              </span>
            )}
            {foundation?.era && (
              <span className="bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-md">
                Era: {foundation.era}
              </span>
            )}
            <span className="text-zinc-500">•</span>
            <span className="flex items-center gap-1 text-zinc-300">
              <Users className="w-3.5 h-3.5 text-amber-400" /> {characters.length} Tokoh/Karakter
            </span>
            <span className="flex items-center gap-1 text-zinc-300">
              <MapPin className="w-3.5 h-3.5 text-amber-400" /> {locations.length} Lokasi Set
            </span>
            <span className="flex items-center gap-1 text-zinc-300">
              <Film className="w-3.5 h-3.5 text-amber-400" /> {scenes.length} Adegan ({totalShotsCount} Shot)
            </span>
          </div>
        </div>

        {/* Duration Validation Badge */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              isDurationExact
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {isDurationExact ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold text-zinc-400">Alokasi Durasi Total</div>
            <div className="text-sm font-mono font-bold text-zinc-100 flex items-center gap-1.5">
              <span>{totalCalculatedDuration} dtk</span>
              <span className="text-zinc-500">/</span>
              <span className="text-amber-400">{project.total_duration_target_sec} dtk target</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">
              {isDurationExact ? '✓ Presisi pas (0s tolerance)' : 'Durasi terhitung'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-800 text-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Tv className="w-4 h-4" />
          Ringkasan Cetak Biru
        </button>
        <button
          onClick={() => setActiveTab('story_structure')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'story_structure'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          Arsitektur Cerita &amp; 5-Babak
        </button>
        <button
          onClick={() => setActiveTab('continuity')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'continuity'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          Mesin Kontinuitas ({continuityStates.length || characters.length})
        </button>
        <button
          onClick={() => setActiveTab('foundation')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'foundation'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Fondasi Cerita
        </button>
        <button
          onClick={() => setActiveTab('characters')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'characters'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Bible Karakter ({characters.length})
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'locations'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Lokasi &amp; Properti ({locations.length + objects.length})
        </button>
        <button
          onClick={() => setActiveTab('scenes')}
          className={`px-4 py-2.5 rounded-xl font-semibold transition whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'scenes'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          Rincian Adegan ({scenes.length})
        </button>
      </div>

      {/* TAB: STORY STRUCTURE */}
      {activeTab === 'story_structure' && (
        <StoryArchitectureView
          storyArchitecture={storyArchitecture}
          scenes={scenes}
          shots={shots}
        />
      )}

      {/* TAB: CONTINUITY */}
      {activeTab === 'continuity' && (
        <ContinuityPanel
          projectId={project.id}
          characters={characters}
          locations={locations}
          objects={objects}
          scenes={scenes}
          continuityStates={continuityStates}
          onApproveTransition={onApproveCostumeTransition}
        />
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Story Visual Tone Banner */}
          {foundation && (
            <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                <Sparkles className="w-4 h-4" />
                Arah Visual & Atmosfer Sinematik
              </div>
              <p className="text-base text-zinc-200 leading-relaxed italic font-serif">
                "{foundation.visual_tone}"
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/80 text-xs">
                <div>
                  <span className="text-zinc-400 block mb-0.5">Konflik Utama:</span>
                  <span className="text-zinc-200 font-medium">{foundation.main_conflict}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5">Tema Cerita:</span>
                  <span className="text-zinc-200 font-medium">{foundation.theme}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5">Cakupan Garis Waktu:</span>
                  <span className="text-zinc-200 font-medium">{foundation.timeline}</span>
                </div>
              </div>
            </div>
          )}

          {/* 5-Beat Narrative Summary strip */}
          {foundation?.narrative_beats && (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Struktur Makro Naratif 5-Babak (5-Beat Structure)
                </h3>
                <span className="text-[11px] font-mono text-zinc-400">Peta Narasi Global Tahap 4</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {[
                  { title: '1. Awal (Beginning)', text: foundation.narrative_beats.beginning, color: 'border-blue-500/30 bg-blue-950/20' },
                  { title: '2. Perkembangan (Development)', text: foundation.narrative_beats.development, color: 'border-amber-500/30 bg-amber-950/20' },
                  { title: '3. Klimaks (Climax)', text: foundation.narrative_beats.climax, color: 'border-red-500/30 bg-red-950/20' },
                  { title: '4. Konsekuensi (Consequence)', text: foundation.narrative_beats.consequence, color: 'border-purple-500/30 bg-purple-950/20' },
                  { title: '5. Akhir (Ending)', text: foundation.narrative_beats.ending, color: 'border-emerald-500/30 bg-emerald-950/20' },
                ].map((beat) => (
                  <div key={beat.title} className={`p-3.5 rounded-xl border ${beat.color} space-y-1.5`}>
                    <div className="text-xs font-bold text-zinc-200">{beat.title}</div>
                    <p className="text-xs text-zinc-300/90 leading-relaxed line-clamp-4 hover:line-clamp-none transition-all">
                      {beat.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Scene Strip */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Garis Waktu Alokasi Adegan ({scenes.length} Adegan • Total {totalCalculatedDuration} dtk)
              </h3>
              <button
                onClick={() => setActiveTab('scenes')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Lihat Detail <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Visual proportional duration bar */}
            <div className="w-full h-4 bg-zinc-950 rounded-lg overflow-hidden flex border border-zinc-800">
              {scenes.map((s, idx) => {
                const widthPercent = (s.duration_sec / totalCalculatedDuration) * 100;
                const colors = [
                  'bg-amber-500',
                  'bg-emerald-500',
                  'bg-blue-500',
                  'bg-purple-500',
                  'bg-rose-500',
                  'bg-teal-500',
                  'bg-indigo-500',
                ];
                const color = colors[idx % colors.length];
                return (
                  <div
                    key={s.id || s.scene_number}
                    style={{ width: `${widthPercent}%` }}
                    className={`${color} hover:brightness-125 transition relative group cursor-pointer border-r border-zinc-950/40`}
                    title={`Adegan #${s.scene_number}: ${s.title} (${s.duration_sec} dtk)`}
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {scenes.slice(0, 6).map((s) => (
                <div
                  key={s.id || s.scene_number}
                  className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      ADEGAN #{s.scene_number}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-200">
                      {s.duration_sec} dtk
                    </span>
                  </div>
                  <div className="text-xs font-bold text-zinc-100 line-clamp-1">{s.title}</div>
                  <div className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {s.event}
                  </div>
                  <div className="text-[10px] text-zinc-400 pt-1 flex items-center justify-between border-t border-zinc-900">
                    <span className="truncate max-w-[140px]">{s.location_name}</span>
                    <span className="font-mono uppercase">{s.time_of_day}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FOUNDATION & 5-ACT BEATS */}
      {activeTab === 'foundation' && foundation && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Story Foundation Card */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Fondasi Cerita (Tahap 1)
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-zinc-400 block font-semibold mb-0.5">Genre & Era:</span>
                  <p className="text-zinc-200 text-sm font-bold">{foundation.genre} • {foundation.era}</p>
                </div>
                <div>
                  <span className="text-zinc-400 block font-semibold mb-0.5">Tema Pokok:</span>
                  <p className="text-zinc-300 leading-relaxed">{foundation.theme}</p>
                </div>
                <div>
                  <span className="text-zinc-400 block font-semibold mb-0.5">Cakupan Garis Waktu:</span>
                  <p className="text-zinc-300">{foundation.timeline}</p>
                </div>
                <div>
                  <span className="text-zinc-400 block font-semibold mb-0.5">Konflik Utama:</span>
                  <p className="text-zinc-300 leading-relaxed">{foundation.main_conflict}</p>
                </div>
                <div>
                  <span className="text-zinc-400 block font-semibold mb-0.5">Alur Emosional & Naratif:</span>
                  <p className="text-zinc-300 leading-relaxed mb-1"><strong className="text-amber-400">Emosional:</strong> {foundation.emotional_arc}</p>
                  <p className="text-zinc-300 leading-relaxed"><strong className="text-amber-400">Naratif:</strong> {foundation.narrative_arc}</p>
                </div>
              </div>
            </div>

            {/* Visual Tone & Atmosphere Card */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                Arah Visual & Nuansa
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/80 italic font-serif">
                "{foundation.visual_tone}"
              </p>
              <div>
                <span className="text-xs font-semibold text-zinc-400 block mb-2">Tokoh Utama Terdeteksi:</span>
                <div className="flex flex-wrap gap-2">
                  {(foundation.main_characters || []).map((char, cIdx) => (
                    <span key={`main-char-${char}-${cIdx}`} className="text-xs px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
                      {char}
                    </span>
                  ))}
                </div>
              </div>
              {foundation.supporting_characters && foundation.supporting_characters.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-zinc-400 block mb-2">Tokoh Pendukung:</span>
                  <div className="flex flex-wrap gap-2">
                    {foundation.supporting_characters.map((char, scIdx) => (
                      <span key={`sup-char-${char}-${scIdx}`} className="text-xs px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-300">
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5-Beat Narrative Beats Map */}
          {foundation.narrative_beats && (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Peta Struktur Naratif 5-Babak Global (Tahap 4)
              </h3>
              <div className="space-y-4">
                {[
                  {
                    act: 'Babak I: Awal (Beginning)',
                    subtitle: 'Eksposisi & Pemicu Konflik',
                    text: foundation.narrative_beats.beginning,
                    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                  },
                  {
                    act: 'Babak II: Perkembangan (Development)',
                    subtitle: 'Aksi Meningkat & Konflik Meruncing',
                    text: foundation.narrative_beats.development,
                    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                  },
                  {
                    act: 'Babak III: Klimaks (Climax)',
                    subtitle: 'Titik Puncak Ketegangan Dramatis',
                    text: foundation.narrative_beats.climax,
                    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
                  },
                  {
                    act: 'Babak IV: Konsekuensi (Consequence)',
                    subtitle: 'Penurunan Aksi & Dampak Langsung',
                    text: foundation.narrative_beats.consequence,
                    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                  },
                  {
                    act: 'Babak V: Akhir (Ending)',
                    subtitle: 'Resolusi & Resonansi Pesan Tematik',
                    text: foundation.narrative_beats.ending,
                    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                  },
                ].map((item) => (
                  <div key={item.act} className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/90 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${item.badge}`}>
                        {item.act}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">{item.subtitle}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHARACTER BIBLE */}
      {activeTab === 'characters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Bible Karakter & Tokoh ({characters.length} Karakter)
            </h3>
            <span className="text-xs text-zinc-400">
              Koleksi <code className="font-mono text-amber-400">characters</code> • Auto-merged v1
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {characters.map((char) => (
              <div
                key={char.id || char.name}
                className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3.5 backdrop-blur shadow-sm hover:border-zinc-700 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      {char.name}
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        v{char.version}
                      </span>
                    </h4>
                    <p className="text-xs text-amber-400 font-medium mt-0.5">
                      {char.gender} • Usia: {char.age}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {char.face_identity_locked ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                        <Lock className="w-3 h-3" /> Wajah Terkunci
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                        <Unlock className="w-3 h-3" /> Standar
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-zinc-400 block font-semibold">Ciri Fisik & Wajah:</span>
                    <p className="text-zinc-200 leading-relaxed">{char.physical_appearance}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                    <div>
                      <span className="text-zinc-400 block">Rambut:</span>
                      <span className="text-zinc-200">{char.hair}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Jenggot / Kumis:</span>
                      <span className="text-zinc-200">{char.beard || 'Tidak Ada'}</span>
                    </div>
                  </div>

                  {char.clothing && char.clothing.length > 0 && (
                    <div>
                      <span className="text-zinc-400 block font-semibold mb-1">Pakaian & Kostum Era:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {char.clothing.map((item, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {char.accessories && char.accessories.length > 0 && (
                    <div>
                      <span className="text-zinc-400 block font-semibold mb-1">Aksesoris & Properti:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {char.accessories.map((acc, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-zinc-800/80 text-amber-300 text-[11px] border border-amber-500/20">
                            {acc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                    <div>
                      <span className="text-zinc-400 block font-semibold">Kepribadian & Motif:</span>
                      <p className="text-zinc-300">{char.personality}</p>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-semibold">Karakter Suara & Gaya Gerak:</span>
                      <p className="text-zinc-300">
                        <strong className="text-zinc-400">Suara:</strong> {char.voice_character} <br />
                        <strong className="text-zinc-400">Gaya Gerak:</strong> {char.movement_style}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LOCATIONS & PROPS */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          {/* Locations */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              Bible Lokasi Set ({locations.length} Lokasi)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {locations.map((loc) => (
                <div
                  key={loc.id || loc.name}
                  className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-zinc-100">{loc.name}</h4>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-amber-300">
                      Era: {loc.era}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-zinc-400 block font-semibold">Arsitektur & Struktur:</span>
                      <p className="text-zinc-200 leading-relaxed">{loc.architecture}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                      <div>
                        <span className="text-zinc-400 block">Lingkungan:</span>
                        <span className="text-zinc-200">{loc.environment}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">Iklim & Atmosfer:</span>
                        <span className="text-zinc-200">{loc.climate}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-zinc-400 block font-semibold">Gaya Pencahayaan:</span>
                      <p className="text-zinc-300 leading-relaxed">{loc.lighting_style}</p>
                    </div>

                    {loc.color_palette && loc.color_palette.length > 0 && (
                      <div>
                        <span className="text-zinc-400 block font-semibold mb-1">Palet Warna Utama:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {loc.color_palette.map((color, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[11px] border border-zinc-700"
                            >
                              {color}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-zinc-400 block font-semibold">Material Utama:</span>
                      <p className="text-zinc-300">{loc.material}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Objects / Props */}
          {objects.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-zinc-800">
              <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                Objek Kunci & Properti Kontinuitas ({objects.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {objects.map((obj) => (
                  <div
                    key={obj.id || obj.name}
                    className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-zinc-100">{obj.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {obj.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{obj.description}</p>
                    <div className="pt-2 border-t border-zinc-800/80">
                      <span className="text-[11px] font-semibold text-amber-400/90 block">
                        Aturan Kontinuitas:
                      </span>
                      <p className="text-[11px] text-zinc-400 italic">{obj.continuity_notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: SCENE BREAKDOWN & TIMELINE (STAGES 5-8) */}
      {activeTab === 'scenes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Urutan Master Adegan, Shot & Visual ({scenes.length} Adegan)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Alokasi presisi toleransi 0 dtk dengan Master Frame Nano Banana Pro, Rincian Shot & Garis Waktu Prompt Video.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Total: {totalCalculatedDuration} dtk === {project.total_duration_target_sec} dtk
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {scenes.map((scene) => {
              const sceneShots = (scene.id && shots[scene.id]) || [];
              return (
                <SceneCard
                  key={scene.id || scene.scene_number}
                  scene={scene}
                  project={project}
                  shots={sceneShots}
                  videoPrompts={videoPrompts}
                  onRunScenePipeline={onRunScenePipeline}
                  onRegenerateScenePrompt={onRegenerateScenePrompt}
                  onUpdateSceneImage={onUpdateSceneImage}
                  onUpdateShotImage={onUpdateShotImage}
                  isProcessingPipeline={processingSceneId === scene.id}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
