import React, { useState } from 'react';
import {
  Film,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  ArrowRight,
  Download,
  RotateCcw,
  Sparkles,
  X,
  Layers,
  Play,
  CheckSquare,
} from 'lucide-react';
import { Project, PromptLanguage, ReasoningConfig } from '../types';
import { NewProjectForm } from './NewProjectForm';

interface ProductionProjectsViewProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onCreateProject: (formData: {
    title: string;
    raw_script: string;
    total_duration_target_sec: number;
    max_scene_shot_duration_sec: number | null;
    prompt_language: PromptLanguage;
    ai_model?: string;
    reasoning_config?: ReasoningConfig;
  }) => Promise<void>;
  isCreating: boolean;
}

export const ProductionProjectsView: React.FC<ProductionProjectsViewProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onDeleteProject,
  onCreateProject,
  isCreating,
}) => {
  const [filter, setFilter] = useState<'all' | 'processing' | 'completed' | 'draft'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const filteredProjects = projects.filter((p) => {
    // Legacy/partial records can lack title or raw_script (e.g. a project row
    // persisted before validation). Guard the search fields so one bad record
    // cannot crash the whole Production view.
    const needle = searchQuery.toLowerCase();
    const matchesSearch = (p.title || '').toLowerCase().includes(needle) ||
      (p.raw_script || '').toLowerCase().includes(needle);

    if (!matchesSearch) return false;

    if (filter === 'processing') return p.status === 'processing';
    if (filter === 'completed') return p.status === 'completed';
    if (filter === 'draft') return p.status === 'idle' || p.status === 'failed';
    return true;
  });

  const ongoingCount = projects.filter((p) => p.status === 'processing').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const draftCount = projects.filter((p) => p.status === 'idle' || p.status === 'failed').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Production Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#181926] border border-[#2B2D44] p-6 rounded-3xl shadow-xl">
        <div>
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-400">
            PABRIK MANAJEMEN NASKAH &amp; PRODUKSI
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Halaman Produksi Proyek
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Daftar seluruh proyek sinematik yang telah dibuat, berjalan, atau siap diolah di dalam Studio.
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-5 py-3 rounded-2xl text-xs shadow-lg shadow-indigo-600/30 transition transform active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Buat Proyek Baru
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <span>Semua Proyek</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20">
              {projects.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('processing')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              filter === 'processing'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>Sedang Berjalan</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-indigo-300">
              {ongoingCount}
            </span>
          </button>

          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              filter === 'completed'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Selesai</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-emerald-300">
              {completedCount}
            </span>
          </button>

          <button
            onClick={() => setFilter('draft')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
              filter === 'draft'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-[#1E2032] hover:bg-[#25283E] text-slate-400 border border-[#2B2D44]'
            }`}
          >
            <span>Draft &amp; Idle</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-purple-300">
              {draftCount}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari naskah atau judul proyek..."
            className="w-full bg-[#1B1C2E] border border-[#2B2D44] focus:border-indigo-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-[#1B1C2E] border border-dashed border-[#2B2D44] rounded-3xl p-12 text-center space-y-4">
          <Film className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-200">Tidak ada proyek ditemukan</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery
                ? 'Tidak ada proyek yang sesuai dengan pencarian Anda.'
                : 'Belum ada proyek di kategori ini. Buat proyek baru untuk memulai.'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl shadow-lg transition inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Buat Proyek Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((proj) => {
            const isCurrent = activeProjectId === proj.id;
            const currentStage = proj.current_stage || 1;
            const progressPercent = Math.min(
              100,
              Math.round(((proj.status === 'completed' ? 8 : currentStage) / 8) * 100)
            );

            return (
              <div
                key={proj.id}
                className={`bg-[#1B1C2E] border rounded-3xl p-6 flex flex-col justify-between space-y-4 transition group shadow-xl relative overflow-hidden ${
                  isCurrent
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-[#2B2D44] hover:border-indigo-500/40'
                }`}
              >
                {/* Header Tag */}
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-[#212335] text-slate-300 border border-[#2F324D]">
                    Target: {proj.total_duration_target_sec}s
                  </span>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                        proj.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : proj.status === 'processing'
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse'
                          : 'bg-slate-700/30 text-slate-400'
                      }`}
                    >
                      {proj.status === 'processing' ? `Stage ${currentStage}/8` : proj.status}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Hapus proyek "${proj.title}"?`)) {
                          onDeleteProject(proj.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition"
                      title="Hapus Proyek"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-white group-hover:text-indigo-300 transition line-clamp-1">
                    {proj.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {proj.raw_script}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono font-semibold">
                    <span className="text-slate-400">Kemajuan Stage</span>
                    <span className="text-indigo-400 font-bold">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#212335] overflow-hidden p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Footer Link CTA */}
                <div className="pt-3 border-t border-[#292B42] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">
                    Model: {proj.ai_model || 'gemini-3.7-flash'}
                  </span>
                  <button
                    onClick={() => onSelectProject(proj.id)}
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition transform active:scale-95"
                  >
                    Masuk Studio Proyek
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Modal Overlay */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#181926] border border-[#2B2D44] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-6 sm:p-8">
            <button
              onClick={() => setShowCreateForm(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white bg-[#212335] hover:bg-[#282B42] rounded-2xl border border-[#2F324D] transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400">
                PROSES INISIALISASI NASKAH
              </span>
              <h2 className="text-2xl font-black text-white mt-1">Buat Proyek Sinematik Baru</h2>
              <p className="text-xs text-slate-400 mt-1">
                Masukkan naskah film atau ide sinematik Anda. Agent AI akan membagi cerita ke dalam 8 tahapan otomatis.
              </p>
            </div>

            <NewProjectForm
              onSubmit={async (data) => {
                await onCreateProject(data);
                setShowCreateForm(false);
              }}
              isLoading={isCreating}
            />
          </div>
        </div>
      )}
    </div>
  );
};
