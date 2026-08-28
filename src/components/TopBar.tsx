import React, { useState } from 'react';
import {
  Film,
  Search,
  FolderKanban,
  Plus,
  Download,
  Bell,
  Cpu,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Layers,
  Moon,
  Zap,
} from 'lucide-react';
import { Project, StudioWorkspaceTab } from '../types';

interface TopBarProps {
  currentProject: Project | null;
  activeTab: StudioWorkspaceTab;
  mainMode: 'dashboard' | 'production' | 'studio';
  onSelectMainMode: (mode: 'dashboard' | 'production' | 'studio') => void;
  onNavigate: (tab: StudioWorkspaceTab) => void;
  onOpenCommandPalette: () => void;
  onOpenNotificationCenter: () => void;
  onOpenProjectsModal: () => void;
  onOpenDriveExport: () => void;
  onNewProject: () => void;
  onChangeModel?: (model: string) => void;
  unreadCount?: number;
  isGenerating?: boolean;
}

const AVAILABLE_MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', badge: 'Tercepat & Cerdas' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badge: 'Stabil & Cepat' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', badge: 'Penalaran Mendalam' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', badge: 'Ultra Cepat' },
];

export const TopBar: React.FC<TopBarProps> = ({
  currentProject,
  activeTab,
  mainMode,
  onSelectMainMode,
  onNavigate,
  onOpenCommandPalette,
  onOpenNotificationCenter,
  onOpenProjectsModal,
  onOpenDriveExport,
  onNewProject,
  onChangeModel,
  unreadCount = 0,
  isGenerating = false,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const getStatusBadge = () => {
    if (!currentProject) {
      return (
        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-[#25273C] text-slate-400 border border-[#2F324D]">
          Studio Siap
        </span>
      );
    }
    if (currentProject.status === 'processing' || isGenerating) {
      return (
        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          Produksi Aktif
        </span>
      );
    }
    if (currentProject.status === 'completed') {
      return (
        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Selesai
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
        Draft Naskah
      </span>
    );
  };

  const currentModelId = currentProject?.ai_model || 'gemini-3.7-flash';
  const currentModel = AVAILABLE_MODELS.find((m) => m.id === currentModelId) || AVAILABLE_MODELS[0];

  return (
    <header className="h-16 bg-[#181926] border-b border-[#26283B] px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Left Area: Logo & Main Navigation Pills */}
      <div className="flex items-center gap-4 min-w-0">
        <div
          onClick={() => onSelectMainMode('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
          title="Ke Dashboard Utama"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 p-0.5 shadow-md shadow-indigo-600/30">
            <div className="w-full h-full bg-[#181926] rounded-[14px] flex items-center justify-center">
              <Film className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition duration-200" />
            </div>
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-black tracking-tight text-white flex items-center gap-2">
              Studio AI
              <span className="text-[9px] uppercase tracking-widest text-indigo-300 font-mono px-2 py-0.5 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                SaaS
              </span>
            </span>
          </div>
        </div>

        {/* Main Navigation Mode Tabs */}
        <div className="flex items-center gap-1.5 bg-[#1B1C2E] p-1 rounded-2xl border border-[#2B2D44]">
          <button
            onClick={() => onSelectMainMode('dashboard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              mainMode === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => onSelectMainMode('production')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              mainMode === 'production'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Produksi
          </button>

          {currentProject && (
            <button
              onClick={() => onSelectMainMode('studio')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 max-w-[160px] truncate ${
                mainMode === 'studio'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400 hover:text-indigo-300'
              }`}
              title={currentProject.title}
            >
              <span className="truncate">Studio: {currentProject.title}</span>
            </button>
          )}
        </div>
      </div>

      {/* Center Search Bar (Reference SaaS Style) */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between bg-[#202234] hover:bg-[#26283D] border border-[#2D304A] text-slate-400 hover:text-slate-200 px-4 py-2 rounded-2xl text-xs transition shadow-inner group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition" />
            <span className="text-slate-400 group-hover:text-slate-300">
              Cari tugas, naskah, shot, atau perintah...
            </span>
          </div>
          <kbd className="text-[10px] font-mono bg-[#181926] text-slate-300 px-2 py-0.5 rounded-lg border border-[#2E314B]">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Area: Actions, Model, Notifications, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Model Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-2 bg-[#202234] hover:bg-[#26283D] border border-[#2D304A] px-3 py-2 rounded-2xl text-xs text-slate-200 transition"
            title="Pilih Model AI"
          >
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span className="hidden xl:inline text-xs font-semibold">{currentModel.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#1B1C2E] border border-[#2E314B] rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-[10px] font-mono uppercase text-slate-400 font-bold border-b border-[#2A2C44]">
                Model Produksi Gemini 3.x
              </div>
              <div className="space-y-1 mt-1.5">
                {AVAILABLE_MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (onChangeModel) onChangeModel(model.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between ${
                      model.id === currentModelId
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 font-bold'
                        : 'hover:bg-[#24263A] text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{model.name}</div>
                      <div className="text-[10px] text-slate-400">{model.badge}</div>
                    </div>
                    {model.id === currentModelId && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Drive Export */}
        {currentProject && (
          <button
            onClick={onOpenDriveExport}
            className="p-2 text-slate-400 hover:text-indigo-300 bg-[#202234] hover:bg-[#26283D] border border-[#2D304A] rounded-2xl transition"
            title="Ekspor ke Google Drive"
          >
            <Download className="w-4 h-4" />
          </button>
        )}

        {/* Notifications */}
        <button
          onClick={onOpenNotificationCenter}
          className="relative p-2 text-slate-400 hover:text-slate-200 bg-[#202234] hover:bg-[#26283D] border border-[#2D304A] rounded-2xl transition"
          title="Pusat Notifikasi & Log"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse border-2 border-[#181926]" />
          )}
        </button>

        {/* New Project CTA */}
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold px-4 py-2 rounded-2xl text-xs shadow-lg shadow-indigo-600/25 transition transform active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="hidden sm:inline">Proyek Baru</span>
        </button>

        {/* Profile Avatar Card */}
        <div
          className="flex items-center gap-2 pl-2 border-l border-[#26283B]"
          title="Ali Mamedgasanov - Studio Director"
        >
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center font-bold text-xs shadow-md">
            AM
          </div>
        </div>
      </div>
    </header>
  );
};
