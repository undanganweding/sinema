import React from 'react';
import { Clapperboard, Film, Plus, FolderGit2, Cpu, CheckCircle2, FolderUp } from 'lucide-react';
import { Project } from '../types';

interface HeaderProps {
  currentProject: Project | null;
  onNewProject: () => void;
  onOpenProjectsList: () => void;
  onOpenDriveExport?: () => void;
  activeView: 'form' | 'orchestrator' | 'blueprint';
  onNavigateView: (view: 'form' | 'orchestrator' | 'blueprint') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  onNewProject,
  onOpenProjectsList,
  onOpenDriveExport,
  activeView,
  onNavigateView,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-zinc-950 font-bold">
          <Clapperboard className="w-5 h-5 text-zinc-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              Studio Produksi Sinematik AI
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 tracking-wider">
                Pipeline Tahap 1-8
              </span>
            </h1>
          </div>
          <p className="text-xs text-zinc-400 font-medium">
            {currentProject ? (
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Film className="w-3 h-3 text-amber-400" />
                <span className="font-semibold text-zinc-200">{currentProject.title}</span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-400">Target {currentProject.total_duration_target_sec} detik</span>
                {currentProject.status === 'completed' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 ml-1">
                    <CheckCircle2 className="w-3 h-3" /> Tervalidasi
                  </span>
                )}
              </span>
            ) : (
              'Orkestrator Naskah ke Cetak Biru Produksi Sinematik'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {currentProject && (
          <div className="hidden sm:flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              id="nav-orchestrator-tab"
              onClick={() => onNavigateView('orchestrator')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'orchestrator'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Alur Pipeline
            </button>
            <button
              id="nav-blueprint-tab"
              onClick={() => onNavigateView('blueprint')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'blueprint'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Cetak Biru
            </button>
          </div>
        )}

        {currentProject && onOpenDriveExport && (
          <button
            id="btn-drive-export-header"
            onClick={onOpenDriveExport}
            className="px-3 py-1.5 text-xs font-semibold text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            title="Ekspor Cetak Biru ke Google Drive"
          >
            <FolderUp className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">Ekspor Drive</span>
          </button>
        )}

        <button
          id="btn-open-projects"
          onClick={onOpenProjectsList}
          className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
          title="Pustaka Proyek"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden md:inline">Pustaka</span>
        </button>

        <button
          id="btn-header-new-project"
          onClick={onNewProject}
          className="px-3.5 py-1.5 text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 active:scale-95 transition shadow-sm rounded-lg flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Proyek Baru</span>
        </button>
      </div>
    </header>
  );
};
