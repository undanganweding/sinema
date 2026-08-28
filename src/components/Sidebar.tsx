import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Users,
  MapPin,
  Package,
  Film,
  PlaySquare,
  Sparkles,
  ShieldCheck,
  Cpu,
  Clock,
  Download,
  Sliders,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Plus,
  Video,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { StudioWorkspaceTab, Project } from '../types';

interface SidebarProps {
  currentProject: Project | null;
  activeTab: StudioWorkspaceTab;
  onSelectTab: (tab: StudioWorkspaceTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenProjects: () => void;
  onNewProject: () => void;
  counts: {
    scenes: number;
    shots: number;
    characters: number;
    locations: number;
    objects: number;
    continuityViolations: number;
    isGenerating?: boolean;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentProject,
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  onOpenProjects,
  onNewProject,
  counts,
}) => {
  const groups = [
    {
      title: '01. UTAMA & PIPELINE',
      items: [
        {
          id: 'overview' as StudioWorkspaceTab,
          label: 'Ringkasan Studio',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'pipeline' as StudioWorkspaceTab,
          label: 'Pipeline Orchestrator',
          icon: Cpu,
          badge: counts.isGenerating ? 'RUN' : null,
          badgeClass: counts.isGenerating ? 'bg-indigo-500/30 text-indigo-200 animate-pulse font-bold' : undefined,
        },
      ],
    },
    {
      title: '02. CERITA & ADEGAN',
      items: [
        {
          id: 'story' as StudioWorkspaceTab,
          label: 'Story Architecture',
          icon: Layers,
          badge: null,
        },
        {
          id: 'scenes' as StudioWorkspaceTab,
          label: 'Scene Studio',
          icon: Film,
          badge: counts.scenes > 0 ? String(counts.scenes) : null,
        },
      ],
    },
    {
      title: '03. SHOTS & PROMPTS',
      items: [
        {
          id: 'shots' as StudioWorkspaceTab,
          label: 'Shot Inspector',
          icon: PlaySquare,
          badge: counts.shots > 0 ? String(counts.shots) : null,
        },
        {
          id: 'prompts' as StudioWorkspaceTab,
          label: 'Prompt Studio',
          icon: Sparkles,
          badge: null,
        },
      ],
    },
    {
      title: '04. VISUAL ASSET BIBLE',
      items: [
        {
          id: 'bibles' as StudioWorkspaceTab,
          label: 'Visual Asset Bibles',
          icon: Users,
          badge: (counts.characters + counts.locations + counts.objects) > 0 ? String(counts.characters + counts.locations + counts.objects) : null,
        },
      ],
    },
    {
      title: '05. EKSPOR & UTILITY',
      items: [
        {
          id: 'continuity' as StudioWorkspaceTab,
          label: 'Continuity Verification',
          icon: ShieldCheck,
          badge: counts.continuityViolations > 0 ? `! ${counts.continuityViolations}` : '✓',
          badgeClass:
            counts.continuityViolations > 0
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        },
        {
          id: 'export' as StudioWorkspaceTab,
          label: 'Export & Drive',
          icon: Download,
          badge: null,
        },
        {
          id: 'settings' as StudioWorkspaceTab,
          label: 'Studio Settings',
          icon: Sliders,
          badge: null,
        },
      ],
    },
  ];

  return (
    <aside
      className={`bg-[#181926] border-r border-[#26283B] flex flex-col justify-between transition-all duration-200 z-20 shrink-0 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Top Project Card Widget */}
      <div className="p-3 border-b border-[#26283B]">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onOpenProjects}
              className="p-2.5 rounded-2xl bg-[#212335] hover:bg-[#2A2D44] text-indigo-400 transition border border-[#2F324C]"
              title="Daftar Proyek"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                Proyek Aktif
              </span>
              <button
                onClick={onNewProject}
                className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1 transition"
                title="Buat Proyek Baru"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={onOpenProjects}
              className="w-full text-left p-3 rounded-2xl bg-[#212335] hover:bg-[#282B42] border border-[#2F324D] transition group flex items-center justify-between shadow-sm"
            >
              <div className="min-w-0 pr-2">
                <div className="text-xs font-bold text-slate-100 truncate group-hover:text-indigo-300 transition">
                  {currentProject ? currentProject.title : 'Pilih Proyek Sinematik'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  {currentProject
                    ? `${currentProject.total_duration_target_sec}s • ${currentProject.prompt_language.toUpperCase()}`
                    : 'Klik untuk membuka'}
                </div>
              </div>
              <FolderOpen className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 shrink-0 transition" />
            </button>
          </div>
        )}
      </div>

      {/* Nav groups list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {groups.map((group) => (
          <div key={group.title} className="space-y-1.5">
            {!isCollapsed && (
              <div className="px-3 text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
                {group.title}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/25 font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-[#222438] border border-transparent'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                    {!isCollapsed && (
                      <div className="flex-1 flex items-center justify-between min-w-0">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              item.badgeClass ||
                              (isActive
                                ? 'bg-white/20 text-white font-bold'
                                : 'bg-[#282B40] text-slate-300')
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Team / Members widget (matching Tasky / Skateboard reference style) */}
        {!isCollapsed && (
          <div className="pt-3 border-t border-[#26283B] space-y-2">
            <div className="px-3 text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
              TIM SISTEM AI
            </div>
            <div className="p-3 bg-[#212335] rounded-2xl border border-[#2F324D] space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                <span>Ai Orchestrator</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <Zap className="w-3 h-3" /> ONLINE
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-[10px] font-bold">
                  S1
                </div>
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 text-white flex items-center justify-center text-[10px] font-bold">
                  S4
                </div>
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                  S8
                </div>
                <span className="text-[10px] font-mono text-slate-400 ml-1">+8 Stage</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom collapse toggle button */}
      <div className="p-3 border-t border-[#26283B] flex items-center justify-between">
        {!isCollapsed && (
          <div className="text-[10px] font-mono text-slate-500">
            v2.5 • SaaS Studio
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-xl bg-[#212335] hover:bg-[#282B42] text-slate-400 hover:text-slate-100 transition border border-[#2F324D] mx-auto"
          title={isCollapsed ? 'Perluas Sidebar' : 'Perkecil Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
};
