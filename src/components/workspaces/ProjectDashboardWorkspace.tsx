import React from 'react';
import {
  Film,
  Play,
  Users,
  MapPin,
  Package,
  ShieldCheck,
  Cpu,
  Clock,
  Sparkles,
  Layers,
  Download,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Plus,
  BarChart3,
  CheckSquare,
} from 'lucide-react';
import {
  Project,
  ProjectFoundation,
  StoryArchitecture,
  CharacterBible,
  LocationBible,
  ObjectBible,
  Scene,
  Shot,
  PipelineLogEvent,
  StudioWorkspaceTab,
} from '../../types';

interface ProjectDashboardWorkspaceProps {
  project: Project;
  foundation: ProjectFoundation | null;
  storyArchitecture: StoryArchitecture | null;
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  scenes: Scene[];
  shots: Record<string, Shot[]>;
  logs: PipelineLogEvent[];
  onNavigate: (tab: StudioWorkspaceTab, targetId?: string) => void;
  onRetryPipeline: () => void;
  onOpenExport: () => void;
}

const STAGES = [
  { code: 'S1', name: 'Story Understanding', label: '1. Pemahaman Cerita' },
  { code: 'S2', name: 'Character Detection', label: '2. Deteksi Karakter' },
  { code: 'S3', name: 'Location & Objects', label: '3. Lokasi & Objek' },
  { code: 'S4', name: 'Narrative Structure', label: '4. Struktur Naratif' },
  { code: 'S5', name: 'Scene Breakdown', label: '5. Pembagian Adegan' },
  { code: 'S6', name: 'Shot Subdivision', label: '6. Subdivisi Shot' },
  { code: 'S7', name: 'Master Frame Prompt', label: '7. Prompt Frame' },
  { code: 'S8', name: 'Video Prompt Agent', label: '8. Video Prompt Agent' },
];

export const ProjectDashboardWorkspace: React.FC<ProjectDashboardWorkspaceProps> = ({
  project,
  foundation,
  storyArchitecture,
  characters,
  locations,
  objects,
  scenes,
  shots,
  logs,
  onNavigate,
  onRetryPipeline,
  onOpenExport,
}) => {
  const totalShots = Object.values(shots).reduce((acc: number, curr: Shot[]) => acc + (curr?.length || 0), 0);
  const currentStage = project.current_stage || 1;
  const recentLogs = [...logs].reverse().slice(0, 6);

  // Derive master hero visual
  const heroImage =
    scenes.find((s) => s.master_frame_image_url)?.master_frame_image_url ||
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop';

  const progressPercent = Math.min(
    100,
    Math.round(((project.status === 'completed' ? 8 : currentStage) / 8) * 100)
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* SaaS Dashboard Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-400">
            TERAKHIR DIEDIT: BARU SAJA
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-3">
            {project.title}
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
              Proyek Aktif
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('scenes')}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-4 py-2.5 rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
          >
            <Film className="w-4 h-4" />
            Buka Scene Studio
          </button>
          <button
            onClick={onOpenExport}
            className="flex items-center gap-2 bg-[#212335] hover:bg-[#282B42] border border-[#2F324D] text-slate-200 font-semibold px-4 py-2.5 rounded-2xl text-xs transition shadow-sm"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            Ekspor Deliverables
          </button>
        </div>
      </div>

      {/* Top Hero Banner with Cinematic Preview & Progress */}
      <div className="relative rounded-3xl overflow-hidden border border-[#2B2D44] bg-[#1B1C2E] shadow-2xl p-6 sm:p-8">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 filter blur-[1px] transition scale-105"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1B1C2E] via-[#1B1C2E]/90 to-transparent" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRODUKSI SINEMATIK AI
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-mono bg-[#282B40] text-slate-300 border border-[#2F324D]">
                Durasi Target: {project.total_duration_target_sec} Detik
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Prompt: {project.prompt_language.toUpperCase()}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-2">
              {foundation?.premise || project.raw_script.slice(0, 240) + '...'}
            </p>

            {/* Visual Progress Bar (Reference SaaS Style) */}
            <div className="space-y-1.5 pt-2 max-w-xl">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400">Kemajuan Orkestrasi Stage</span>
                <span className="text-indigo-400 font-mono font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#282B40] overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Stats Pill Panel */}
          <div className="bg-[#212335]/90 backdrop-blur-md rounded-2xl p-5 border border-[#2F324D] space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">
              RINGKASAN ESTIMASI
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-[#181926] border border-[#292B42]">
                <div className="text-lg font-black text-indigo-400">{scenes.length}</div>
                <div className="text-[10px] text-slate-400 font-medium">Adegan</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#181926] border border-[#292B42]">
                <div className="text-lg font-black text-purple-400">{totalShots}</div>
                <div className="text-[10px] text-slate-400 font-medium">Sub-Shots</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#181926] border border-[#292B42]">
                <div className="text-lg font-black text-emerald-400">{characters.length}</div>
                <div className="text-[10px] text-slate-400 font-medium">Karakter</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Production Pipeline Roadmap (8 Stages) */}
      <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Roadmap Tahapan Orkestrasi AI (Stage 1 – 8)
            </h2>
          </div>
          <button
            onClick={() => onNavigate('pipeline')}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
          >
            Lihat Terminal Log <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 8 Stage Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {STAGES.map((st, idx) => {
            const stageNum = idx + 1;
            const isCompleted = project.status === 'completed' || currentStage > stageNum;
            const isCurrent = project.status === 'processing' && currentStage === stageNum;
            const isFailed = project.status === 'failed' && currentStage === stageNum;

            return (
              <div
                key={st.code}
                onClick={() => onNavigate('pipeline')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition flex flex-col justify-between min-h-[72px] shadow-sm ${
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : isCurrent
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200 animate-pulse'
                    : isFailed
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'bg-[#212335] border-[#2F324D] text-slate-400 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                  <span>{st.code}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  ) : isFailed ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <span className="text-slate-500 text-[9px]">READY</span>
                  )}
                </div>
                <div className="text-[11px] font-semibold truncate mt-2">
                  {st.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Metric Cards Grid (Matching Skateboard & Tasky Card Styling) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Scenes Card */}
        <div
          onClick={() => onNavigate('scenes')}
          className="bg-[#1B1C2E] hover:bg-[#212335] border border-[#2B2D44] hover:border-indigo-500/40 rounded-3xl p-5 cursor-pointer transition group shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Film className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">Papan Adegan</span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-white group-hover:text-indigo-300 transition">
              {scenes.length}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Adegan Skenario</div>
          </div>
        </div>

        {/* Shots Card */}
        <div
          onClick={() => onNavigate('shots')}
          className="bg-[#1B1C2E] hover:bg-[#212335] border border-[#2B2D44] hover:border-purple-500/40 rounded-3xl p-5 cursor-pointer transition group shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
              <Play className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">Sub-shot</span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-white group-hover:text-purple-300 transition">
              {totalShots}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Subdivisi Kamera</div>
          </div>
        </div>

        {/* Characters Card */}
        <div
          onClick={() => onNavigate('characters')}
          className="bg-[#1B1C2E] hover:bg-[#212335] border border-[#2B2D44] hover:border-amber-500/40 rounded-3xl p-5 cursor-pointer transition group shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">Bible Tokoh</span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-white group-hover:text-amber-300 transition">
              {characters.length}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Karakter Terkunci</div>
          </div>
        </div>

        {/* Locations Card */}
        <div
          onClick={() => onNavigate('locations')}
          className="bg-[#1B1C2E] hover:bg-[#212335] border border-[#2B2D44] hover:border-cyan-500/40 rounded-3xl p-5 cursor-pointer transition group shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">Latar Tempat</span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-white group-hover:text-cyan-300 transition">
              {locations.length}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Latar Sejarah</div>
          </div>
        </div>

        {/* Objects Card */}
        <div
          onClick={() => onNavigate('objects')}
          className="bg-[#1B1C2E] hover:bg-[#212335] border border-[#2B2D44] hover:border-emerald-500/40 rounded-3xl p-5 cursor-pointer transition group shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <Package className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">Properti</span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-white group-hover:text-emerald-300 transition">
              {objects.length}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Objek &amp; Pusaka</div>
          </div>
        </div>

        {/* Continuity Engine */}
        <div
          onClick={() => onNavigate('continuity')}
          className="bg-[#1B1C2E] hover:bg-[#212335] border border-[#2B2D44] hover:border-emerald-500/40 rounded-3xl p-5 cursor-pointer transition group shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-mono text-slate-500">Kontinuitas</span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-extrabold text-emerald-400 group-hover:scale-105 transition">
              100%
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Kunci Wardrobe</div>
          </div>
        </div>
      </div>

      {/* Two Grid Columns: Story Architecture Peek & Live Terminal Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Story Foundation Card */}
        <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Fondasi Sinematik &amp; Hook Pembuka
                </h3>
              </div>
              <button
                onClick={() => onNavigate('story')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                Lihat Diagram <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {storyArchitecture?.cold_open ? (
              <div className="p-4 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300">
                    Cold Open ({storyArchitecture.cold_open.duration_sec || 10}s)
                  </span>
                  <span className="text-[10px] font-mono text-slate-300 uppercase bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                    Hook Pembuka
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                  {storyArchitecture.cold_open.visual_hook || 'Adegan pembuka memikat rasa penasaran audiens.'}
                </p>
                <div className="text-[11px] text-slate-400 font-mono">
                  Transisi: {storyArchitecture.cold_open.cut_to_black_transition || 'Cut to Black ke Babak 1'}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Struktur cold open dan babak naratif telah dikompilasi dengan rapi.
              </p>
            )}

            {foundation && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Tema Utama</span>
                  <p className="font-bold text-slate-100 truncate">{foundation.theme || 'Sejarah Kenabian'}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#212335] border border-[#2F324D] space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Target Audiens</span>
                  <p className="font-bold text-slate-100 truncate">{foundation.target_audience || 'Universal'}</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('story')}
            className="w-full py-3 bg-[#212335] hover:bg-[#282B42] border border-[#2F324D] text-slate-200 rounded-2xl text-xs font-bold transition text-center shadow-sm"
          >
            Buka Detail Arsitektur Cerita
          </button>
        </div>

        {/* Terminal Log Stream */}
        <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Aktivitas Produksi &amp; Live Terminal Stream
                </h3>
              </div>
              <button
                onClick={() => onNavigate('pipeline')}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
              >
                Buka Terminal <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {recentLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Belum ada log orkestrasi tercatat.
                </div>
              ) : (
                recentLogs.map((item, idx) => (
                  <div
                    key={`${item.timestamp}-${idx}`}
                    className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] text-xs flex items-start gap-3 shadow-sm"
                  >
                    <div className="p-1.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-[11px] truncate">
                          {item.stage_name || `Tahap ${item.stage}`}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate mt-0.5 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={onRetryPipeline}
            className="w-full py-3 bg-[#212335] hover:bg-[#282B42] border border-[#2F324D] text-indigo-300 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Jalankan Ulang Pipeline Orkstrator
          </button>
        </div>
      </div>
    </div>
  );
};
