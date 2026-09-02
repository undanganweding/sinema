import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Film,
  Users,
  MapPin,
  Package,
  Sparkles,
  ShieldCheck,
  Download,
  Plus,
  Play,
  RotateCcw,
  Sliders,
  Layers,
  FileText,
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  Project,
  Scene,
  CharacterBible,
  LocationBible,
  ObjectBible,
  StudioWorkspaceTab,
} from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  scenes: Scene[];
  characters: CharacterBible[];
  locations: LocationBible[];
  objects: ObjectBible[];
  onNavigate: (tab: StudioWorkspaceTab, targetId?: string) => void;
  onNewProject: () => void;
  onOpenProjects: () => void;
  onOpenExport: () => void;
  onRetryPipeline?: () => void;
}

interface CommandItem {
  id: string;
  category: 'Workspace' | 'Scenes' | 'Characters' | 'Locations & Props' | 'Actions';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  badge?: string;
  action: () => void;
}

/**
 * ⚡ Bolt Optimization:
 * Hoisted static workspace command definitions outside the component scope to avoid
 * re-instantiating 10 static object templates on every component render or dependency change.
 */
interface CoreWorkspaceTemplate {
  id: string;
  tab: StudioWorkspaceTab;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}

const CORE_WORKSPACE_ITEMS: CoreWorkspaceTemplate[] = [
  {
    id: 'nav-overview',
    tab: 'overview',
    title: 'Project Overview & Dashboard',
    subtitle: 'Production statistics, pipeline summary, and hero visual',
    icon: Film,
  },
  {
    id: 'nav-story',
    tab: 'story',
    title: 'Story Architecture & Cold Open',
    subtitle: 'Act breakdown, narrative goals, and cold open hooks',
    icon: Layers,
  },
  {
    id: 'nav-scenes',
    tab: 'scenes',
    title: 'Scene Studio Workspace',
    subtitle: 'Edit master frames, fixed scene timelines, and sub-beats',
    icon: Film,
  },
  {
    id: 'nav-shots',
    tab: 'shots',
    title: 'Shot Workspace & Prompt Inspector',
    subtitle: 'Detailed camera angles, Seedance video prompts, and audio',
    icon: Play,
  },
  {
    id: 'nav-characters',
    tab: 'characters',
    title: 'Character Bible & Wardrobe',
    subtitle: 'Manage character identity locks, costumes, and transitions',
    icon: Users,
  },
  {
    id: 'nav-continuity',
    tab: 'continuity',
    title: 'Continuity Intelligence Center',
    subtitle: 'Audit identity, costume, and historical period rules',
    icon: ShieldCheck,
  },
  {
    id: 'nav-prompts',
    tab: 'prompts',
    title: 'Prompt Studio & Full Scene Prompts',
    subtitle: 'Multi-platform prompt generation, copy, and validation',
    icon: Sparkles,
  },
  {
    id: 'nav-queue',
    tab: 'queue',
    title: 'Generation Queue & Pipeline Logs',
    subtitle: 'Track active generation tasks and production logs',
    icon: Clock,
  },
  {
    id: 'nav-export',
    tab: 'export',
    title: 'Export & Google Drive Deliverables',
    subtitle: 'Package shots, prompts, and cinematic reports',
    icon: Download,
  },
  {
    id: 'nav-settings',
    tab: 'settings',
    title: 'Studio Settings & AI Models',
    subtitle: 'Configure LLM providers, aspect ratios, and languages',
    icon: Sliders,
  },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  project,
  scenes,
  characters,
  locations,
  objects,
  onNavigate,
  onNewProject,
  onOpenProjects,
  onOpenExport,
  onRetryPipeline,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build command list based on project entities and available actions
  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = CORE_WORKSPACE_ITEMS.map((item) => ({
      id: item.id,
      category: 'Workspace',
      title: item.title,
      subtitle: item.subtitle,
      icon: item.icon,
      action: () => onNavigate(item.tab),
    }));

    // Dynamic Scenes
    scenes.forEach((s) => {
      list.push({
        id: `scene-${s.id}`,
        category: 'Scenes',
        title: `Scene #${s.scene_number}: ${s.title || 'Untitled Scene'}`,
        subtitle: `${s.duration_sec}s • ${s.location_name || 'Lokasi'} • ${s.time_of_day || 'Waktu'}`,
        icon: Film,
        badge: `${s.duration_sec}s`,
        action: () => onNavigate('scenes', s.id),
      });
    });

    // Dynamic Characters
    characters.forEach((c) => {
      list.push({
        id: `char-${c.id || c.name}`,
        category: 'Characters',
        title: c.name,
        subtitle: `${c.role} • ${c.age || 'Usia'} • Kostum v${c.identity_version || 1}`,
        icon: Users,
        badge: c.role,
        action: () => onNavigate('characters', c.id || c.name),
      });
    });

    // Locations & Props
    locations.forEach((loc) => {
      list.push({
        id: `loc-${loc.id || loc.name}`,
        category: 'Locations & Props',
        title: `Lokasi: ${loc.name}`,
        subtitle: `${loc.architectural_style || 'Arsitektur'} • ${loc.lighting_atmosphere || ''}`,
        icon: MapPin,
        action: () => onNavigate('locations', loc.id || loc.name),
      });
    });

    objects.forEach((obj) => {
      list.push({
        id: `obj-${obj.id || obj.name}`,
        category: 'Locations & Props',
        title: `Properti: ${obj.name}`,
        subtitle: `${obj.material || 'Material'} • Pemilik: ${obj.owner || 'Umum'}`,
        icon: Package,
        action: () => onNavigate('objects', obj.id || obj.name),
      });
    });

    // Actions
    list.push(
      {
        id: 'act-new',
        category: 'Actions',
        title: 'Buat Proyek Sinematik Baru',
        subtitle: 'Mulai dari naskah atau template sejarah teruji',
        icon: Plus,
        action: onNewProject,
      },
      {
        id: 'act-switch',
        category: 'Actions',
        title: 'Buka Daftar Proyek',
        subtitle: 'Pilih atau kelola proyek tersimpan',
        icon: FileText,
        action: onOpenProjects,
      },
      {
        id: 'act-drive',
        category: 'Actions',
        title: 'Ekspor ke Google Drive',
        subtitle: 'Kirim seluruh paket produksi ke Google Drive',
        icon: Download,
        action: onOpenExport,
      }
    );

    if (onRetryPipeline && project) {
      list.push({
        id: 'act-retry',
        category: 'Actions',
        title: 'Jalankan Ulang Pipeline (Stages 1-8)',
        subtitle: `Eksekusi orkestrasi AI dengan model ${project.ai_model || 'Gemini'}`,
        icon: RotateCcw,
        action: onRetryPipeline,
      });
    }

    return list;
  }, [project, scenes, characters, locations, objects, onNavigate, onNewProject, onOpenProjects, onOpenExport, onRetryPipeline]);

  // Filter items
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = filtered[selectedIndex];
      if (current) {
        current.action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#0F131E] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3 bg-[#131826]">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Cari workspace, adegan, tokoh, properti, atau ketik perintah (⌘K)..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="text-[11px] font-mono uppercase bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700/60 shrink-0">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              Tidak ada hasil yang cocok dengan &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition ${
                    isSelected
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                      : 'hover:bg-zinc-800/40 text-zinc-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-zinc-800/80 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-100 truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                          {item.category}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ml-2 ${
                      isSelected ? 'text-amber-400 opacity-100' : 'text-zinc-600 opacity-0'
                    } transition`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="px-4 py-2 bg-[#0A0D15] border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">↓</kbd> Navigasi
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">↵</kbd> Pilih
            </span>
          </div>
          <span>Cinematic AI Studio</span>
        </div>
      </div>
    </div>
  );
};
