import React from 'react';
import {
  Film,
  Play,
  Users,
  MapPin,
  Package,
  Sparkles,
  Cpu,
  Clock,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Layers,
  Zap,
  BarChart2,
  Activity,
  ChevronRight,
  Video,
} from 'lucide-react';
import { Project, PipelineLogEvent, StudioWorkspaceTab } from '../types';

interface MainDashboardViewProps {
  projects: Project[];
  activeProject: Project | null;
  logs: PipelineLogEvent[];
  onSelectProject: (projectId: string) => void;
  onOpenCreateModal: () => void;
  onOpenProductionPage: () => void;
}

const STAGES = [
  { stage: 1, name: 'Story Understanding' },
  { stage: 2, name: 'Character Detection' },
  { stage: 3, name: 'Location & Objects' },
  { stage: 4, name: 'Narrative Structure' },
  { stage: 5, name: 'Scene Breakdown' },
  { stage: 6, name: 'Shot Subdivision' },
  { stage: 7, name: 'Master Frame Prompt' },
  { stage: 8, name: 'Video Prompt Agent' },
];

export const MainDashboardView: React.FC<MainDashboardViewProps> = ({
  projects,
  activeProject,
  logs,
  onSelectProject,
  onOpenCreateModal,
  onOpenProductionPage,
}) => {
  const ongoingProjects = projects.filter((p) => p.status === 'processing');
  const completedProjects = projects.filter((p) => p.status === 'completed');
  const draftProjects = projects.filter((p) => p.status === 'idle' || p.status === 'failed');

  const recentLogs = [...logs].reverse().slice(0, 6);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* SaaS Dashboard Title & Quick Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#181926] border border-[#2B2D44] p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              ORKESTRATOR STUDIO AI v3.0
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sistem Aktif
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Dashboard Orkestrasi Sinematik
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Pusat kendali pipeline AI untuk naskah film, pembagian adegan, subdivisi kamera, dan ekstraksi prompt prompt visual sinematik.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Buat Proyek Baru
          </button>
          <button
            onClick={onOpenProductionPage}
            className="flex items-center gap-2 bg-[#212335] hover:bg-[#282B42] border border-[#2F324D] text-slate-200 font-semibold px-4 py-3 rounded-2xl text-xs transition shadow-sm"
          >
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            Halaman Produksi ({projects.length})
          </button>
        </div>
      </div>

      {/* 4 Compact Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects Card */}
        <div
          onClick={onOpenProductionPage}
          className="bg-[#1B1C2E] border border-[#2B2D44] hover:border-indigo-500/40 rounded-3xl p-5 cursor-pointer transition group shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
              <Film className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Total Proyek</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-white group-hover:text-indigo-300 transition">
              {projects.length}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-2">
              <span className="text-emerald-400 font-bold">{completedProjects.length} Selesai</span>
              <span>•</span>
              <span className="text-indigo-400 font-bold">{ongoingProjects.length} Berjalan</span>
            </div>
          </div>
        </div>

        {/* Ongoing Pipeline Card */}
        <div
          onClick={onOpenProductionPage}
          className="bg-[#1B1C2E] border border-[#2B2D44] hover:border-purple-500/40 rounded-3xl p-5 cursor-pointer transition group shadow-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Status Orkestrasi</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-purple-300 group-hover:text-purple-200 transition">
              {ongoingProjects.length > 0 ? `${ongoingProjects.length} Aktif` : 'Idle'}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              {ongoingProjects.length > 0
                ? 'Pipeline AI sedang memproses naskah'
                : 'Tidak ada proses berjalan'}
            </div>
          </div>
        </div>

        {/* Engine Model Card */}
        <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Engine Gemini</span>
          </div>
          <div className="mt-4">
            <div className="text-lg font-black text-amber-300 truncate">
              Gemini 3.7 Flash
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              High-Speed Reasoning Agent
            </div>
          </div>
        </div>

        {/* Storage / System Health */}
        <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-slate-500 uppercase font-bold">Kapasitas Quota</span>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-black text-emerald-400">
              100%
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-1">
              Rate-Limit &amp; Memory Optimal
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Ongoing Projects + Quick Access + Log Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide on LG): Proyek Berjalan & Proyek Terkini */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ongoing Projects Section */}
          <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Proyek Sedang Berjalan (In Progress)
                </h2>
              </div>
              <button
                onClick={onOpenProductionPage}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                Lihat Semua ({projects.length}) <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {ongoingProjects.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl bg-[#212335] border border-dashed border-[#2F324D] text-center space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Tidak ada proyek yang sedang berjalan</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Semua naskah film Anda telah siap atau berada dalam draf. Mulai generasi proyek baru untuk melihat orchestrator beraksi!
                  </p>
                </div>
                <button
                  onClick={onOpenCreateModal}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md inline-flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Mulai Produksi Baru
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {ongoingProjects.map((proj) => {
                  const stageNum = proj.current_stage || 1;
                  const progressPct = Math.round((stageNum / 8) * 100);
                  const stageObj = STAGES.find((s) => s.stage === stageNum) || STAGES[0];

                  return (
                    <div
                      key={proj.id}
                      className="p-5 rounded-2xl bg-[#212335] border border-indigo-500/40 space-y-3 shadow-md hover:border-indigo-500 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase text-indigo-400 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                            STAGE {stageNum}/8: {stageObj.name}
                          </span>
                          <h3 className="text-base font-extrabold text-white mt-1">
                            {proj.title}
                          </h3>
                        </div>

                        <button
                          onClick={() => onSelectProject(proj.id)}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition shrink-0"
                        >
                          Buka Studio
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold font-mono">
                          <span className="text-slate-400">{stageObj.name}</span>
                          <span className="text-indigo-400">{progressPct}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#181926] overflow-hidden p-0.5 border border-[#2B2D44]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Projects List / Grid */}
          <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-purple-400" />
                Daftar Proyek Sinematik Terkini
              </h2>
              <button
                onClick={onOpenProductionPage}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Ke Halaman Produksi →
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                Belum ada proyek yang dibuat.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.slice(0, 4).map((proj) => (
                  <div
                    key={proj.id}
                    onClick={() => onSelectProject(proj.id)}
                    className="p-4 rounded-2xl bg-[#212335] hover:bg-[#282B42] border border-[#2F324D] hover:border-indigo-500/50 cursor-pointer transition group shadow-sm flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#181926] text-slate-300 border border-[#2F324D]">
                        Target: {proj.total_duration_target_sec}s
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          proj.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : proj.status === 'processing'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-700/40 text-slate-300'
                        }`}
                      >
                        {proj.status.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition line-clamp-1">
                        {proj.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {proj.raw_script}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#2B2D44] flex items-center justify-between text-xs text-indigo-400 font-semibold">
                      <span>Masuk ke Studio Proyek</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Terminal Activity Stream & Roadmap */}
        <div className="space-y-6">
          {/* Real-time Activity Stream */}
          <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between min-h-[320px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                    Aktivitas &amp; Stream Orkestrator
                  </h3>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="space-y-2">
                {recentLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Belum ada aktivitas orkestrasi tercatat.
                  </div>
                ) : (
                  recentLogs.map((item, idx) => (
                    <div
                      key={`${item.timestamp}-${idx}`}
                      className="p-3 rounded-2xl bg-[#212335] border border-[#2F324D] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-300 truncate">
                          {item.stage_name || `Stage ${item.stage}`}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#2F324D] text-center text-[11px] text-slate-400 font-mono">
              Terhubung ke Gemini SSE Event Bus
            </div>
          </div>

          {/* 8-Stage Architecture Roadmap Overview */}
          <div className="bg-[#1B1C2E] border border-[#2B2D44] rounded-3xl p-6 space-y-3 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Tahapan Pipeline (1 – 8)
            </h3>
            <div className="space-y-1.5 text-xs font-mono">
              {STAGES.map((st) => (
                <div
                  key={st.stage}
                  className="p-2 rounded-xl bg-[#212335] border border-[#2F324D] flex items-center justify-between text-slate-300"
                >
                  <span className="font-bold text-indigo-400">0{st.stage}</span>
                  <span className="truncate px-2 text-[11px]">{st.name}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
