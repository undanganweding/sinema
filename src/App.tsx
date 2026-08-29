/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { NewProjectForm } from './components/NewProjectForm';
import { ProjectListModal } from './components/ProjectListModal';
import { GoogleDriveExportModal } from './components/GoogleDriveExportModal';
import { CommandPalette } from './components/CommandPalette';
import { NotificationCenter } from './components/NotificationCenter';

// Top-Level Main Views
import { MainDashboardView } from './components/MainDashboardView';
import { ProductionProjectsView } from './components/ProductionProjectsView';

// Workspaces
import { ProjectDashboardWorkspace } from './components/workspaces/ProjectDashboardWorkspace';
import { StoryWorkspace } from './components/workspaces/StoryWorkspace';
import { SceneWorkspace } from './components/workspaces/SceneWorkspace';
import { ShotWorkspace } from './components/workspaces/ShotWorkspace';
import { CharacterBibleWorkspace } from './components/workspaces/CharacterBibleWorkspace';
import { LocationBibleWorkspace } from './components/workspaces/LocationBibleWorkspace';
import { AssetBibleWorkspace } from './components/workspaces/AssetBibleWorkspace';
import { ContinuityWorkspace } from './components/workspaces/ContinuityWorkspace';
import { PipelineOrchestratorWorkspace } from './components/workspaces/PipelineOrchestratorWorkspace';
import { PromptStudioWorkspace } from './components/workspaces/PromptStudioWorkspace';
import { GenerationQueueWorkspace } from './components/workspaces/GenerationQueueWorkspace';
import { SettingsWorkspace } from './components/workspaces/SettingsWorkspace';
import { ExportWorkspace } from './components/workspaces/ExportWorkspace';
import { ArrowLeft } from 'lucide-react';

import {
  Project,
  ProjectFoundation,
  CharacterBible,
  LocationBible,
  ObjectBible,
  Scene,
  Shot,
  VideoPrompt,
  PipelineLogEvent,
  PromptLanguage,
  StoryArchitecture,
  CharacterContinuityState,
  ApprovedCostumeTransition,
  PromptTarget,
  StudioWorkspaceTab,
} from './types';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [foundation, setFoundation] = useState<ProjectFoundation | null>(null);
  const [storyArchitecture, setStoryArchitecture] = useState<StoryArchitecture | null>(null);
  const [characters, setCharacters] = useState<CharacterBible[]>([]);
  const [continuityStates, setContinuityStates] = useState<CharacterContinuityState[]>([]);
  const [locations, setLocations] = useState<LocationBible[]>([]);
  const [objects, setObjects] = useState<ObjectBible[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [shots, setShots] = useState<Record<string, Shot[]>>({});
  const [videoPrompts, setVideoPrompts] = useState<Record<string, VideoPrompt[]>>({});
  const [logs, setLogs] = useState<PipelineLogEvent[]>([]);

  // Top Level Navigation Mode: 'dashboard' | 'production' | 'studio'
  const [mainMode, setMainMode] = useState<'dashboard' | 'production' | 'studio'>('dashboard');

  const [activeTab, setActiveTab] = useState<StudioWorkspaceTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState<boolean>(false);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState<boolean>(false);
  const [isDriveExportOpen, setIsDriveExportOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [processingSceneId, setProcessingSceneId] = useState<string | null>(null);
  const [processingShotId, setProcessingShotId] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  // PATCH 5.5-R1 FASE 5: per-shot generation error, drives the `error` UI state.
  // A failed contract means NOTHING was persisted, so the cell must not pretend
  // a prompt exists.
  const [shotPromptError, setShotPromptError] = useState<Record<string, string>>({});


  const eventSourceRef = useRef<EventSource | null>(null);

  // Keyboard shortcut for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch all projects list
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const list: Project[] = await res.json();
        setProjects(list);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, []);

  // Fetch full project data by ID
  const loadProjectDetails = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentProject(data.project);
        setFoundation(data.foundation);
        setStoryArchitecture(data.story_architecture || null);
        setCharacters(data.characters || []);
        setContinuityStates(data.continuity_states || []);
        setLocations(data.locations || []);
        setObjects(data.objects || []);
        setScenes(data.scenes || []);
        setShots(data.shots || {});
        setVideoPrompts(data.video_prompts || {});
        setLogs(data.logs || []);

        if (data.project.status === 'completed') {
          setActiveTab('overview');
        } else {
          setActiveTab('pipeline');
        }
        setMainMode('studio');
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  }, []);

  // Set up SSE stream for real-time orchestrator updates
  useEffect(() => {
    if (!currentProject) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/projects/${currentProject.id}/stream`);
    eventSourceRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          if (data.logs) setLogs(data.logs);
          if (data.project) {
            setCurrentProject(data.project);
            setActiveRunId(data.project.latest_run_id);
          }
        } else if (data.type === 'progress') {
          if (data.runId) {
            setActiveRunId(data.runId);
          }
          setLogs((prev) => [
            ...prev,
            {
              timestamp: data.timestamp || new Date().toISOString(),
              stage: data.stage,
              stage_name: data.stageName,
              level: data.level || 'info',
              message: data.message,
            },
          ]);
          setCurrentProject((prev) => (prev ? { ...prev, current_stage: data.stage } : null));
        } else if (data.type === 'finished') {
          if (data.runId === activeRunId) {
            loadProjectDetails(currentProject.id);
            fetchProjects();
          }
        } else if (data.type === 'end') {
          // The server intentionally ended this stream (serverless-safe) — stop
          // the EventSource so it does not auto-reconnect and churn invocations.
          sse.close();
          eventSourceRef.current = null;
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    sse.onerror = () => {
      // Reconnects automatically
    };

    return () => {
      sse.close();
    };
  }, [currentProject?.id, loadProjectDetails, fetchProjects, activeRunId]);

  // Initial load
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Create new project and kick off pipeline
  const handleCreateProject = async (formData: {
    title: string;
    raw_script: string;
    total_duration_target_sec: number;
    max_scene_shot_duration_sec: number | null;
    prompt_language: PromptLanguage;
    ai_model?: string;
  }) => {
    setIsCreating(true);
    try {
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json();
        throw new Error(errJson.error || 'Failed to create project');
      }

      const newProject: Project = await createRes.json();
      setCurrentProject(newProject);
      setFoundation(null);
      setCharacters([]);
      setLocations([]);
      setObjects([]);
      setScenes([]);
      setLogs([]);
      setActiveTab('pipeline');
      setMainMode('studio');

      await fetch(`/api/projects/${newProject.id}/generate`, {
        method: 'POST',
      });

      await fetchProjects();
    } catch (err: any) {
      console.error('Error in handleCreateProject:', err);
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const handleRetryPipeline = async () => {
    if (!currentProject) return;
    try {
      setLogs([]);
      setCurrentProject((prev) => (prev ? { ...prev, status: 'processing', current_stage: 1 } : null));
      setActiveTab('pipeline');
      await fetch(`/api/projects/${currentProject.id}/generate`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to retry pipeline:', err);
    }
  };

  const handleChangeModelAndRetry = async (newModel: string) => {
    if (!currentProject) return;
    try {
      setLogs([]);
      const patchRes = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_model: newModel }),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        setCurrentProject({ ...updated, status: 'processing', current_stage: 1 });
      }
      setActiveTab('pipeline');
      await fetch(`/api/projects/${currentProject.id}/generate`, {
        method: 'POST',
      });
      await fetchProjects();
    } catch (err) {
      console.error('Failed to change model and retry:', err);
    }
  };

  const handleRunScenePipeline = async (sceneId: string) => {
    if (!currentProject) return;
    setProcessingSceneId(sceneId);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/run-pipeline`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to run scene pipeline:', err);
    } finally {
      setProcessingSceneId(null);
    }
  };

  const handleRegenerateScenePrompt = async (sceneId: string) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/scenes/${sceneId}/regenerate-prompt`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to regenerate scene prompt:', err);
    }
  };

  const handleUpdateSceneImage = async (sceneId: string, imageUrl: string | null) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/scenes/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ master_frame_image_url: imageUrl }),
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to update scene image:', err);
    }
  };

  const handleUpdateShotImage = async (shotId: string, imageUrl: string | null) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/shots/${shotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shot_image_url: imageUrl }),
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id);
      }
    } catch (err) {
      console.error('Failed to update shot image:', err);
    }
  };

  /**
   * PATCH 5.5-R1 FASE 5: the caller MUST name an explicit PromptTarget.
   *
   * `target` is required — there is no `|| 'seedance'` and no silent default.
   * The field sent over the wire is `target`, the canonical 5.5 field, not the
   * legacy `platform` alias. The server still accepts aliases for old clients,
   * but this UI no longer depends on that compatibility layer.
   */
  const handleRunShotPrompt = async (shotId: string, target: PromptTarget) => {
    if (!currentProject) return;
    setProcessingShotId(shotId);
    setShotPromptError((prev) => {
      const next = { ...prev };
      delete next[shotId];
      return next;
    });
    try {
      const res = await fetch(`/api/shots/${shotId}/regenerate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      if (res.ok) {
        await loadProjectDetails(currentProject.id);
      } else {
        // 400 INVALID_PROMPT_TARGET / 422 contract failure: nothing was
        // persisted server-side, so surface the error instead of a stale prompt.
        const body = await res.json().catch(() => ({}));
        setShotPromptError((prev) => ({
          ...prev,
          [shotId]: body?.error || `Gagal generate prompt ${target} (HTTP ${res.status}).`,
        }));
      }
    } catch (err) {
      console.error('Failed to regenerate shot prompt:', err);
      setShotPromptError((prev) => ({
        ...prev,
        [shotId]: `Gagal generate prompt ${target}.`,
      }));
    } finally {
      setProcessingShotId(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProjects();
        if (currentProject?.id === projectId) {
          setCurrentProject(null);
          setFoundation(null);
          setCharacters([]);
          setLocations([]);
          setObjects([]);
          setScenes([]);
          setShots({});
          setVideoPrompts({});
        }
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const totalShotsCount = Object.values(shots).reduce((acc: number, curr: Shot[]) => acc + (curr?.length || 0), 0);
  const unreadLogsCount = logs.filter((l) => l.level === 'error' || l.level === 'warn').length;

  return (
    <div className="min-h-screen bg-[#090B10] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-hidden">
      {/* Top Bar */}
      <TopBar
        currentProject={currentProject}
        activeTab={activeTab}
        mainMode={mainMode}
        onSelectMainMode={(mode) => {
          if (mode === 'studio' && !currentProject) {
            setMainMode('production');
          } else {
            setMainMode(mode);
          }
        }}
        onNavigate={(tab) => {
          if (!currentProject && tab !== 'overview') {
            setIsProjectsModalOpen(true);
            return;
          }
          setActiveTab(tab);
          setMainMode('studio');
        }}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
        onOpenProjectsModal={() => setIsProjectsModalOpen(true)}
        onOpenDriveExport={() => setIsDriveExportOpen(true)}
        onNewProject={() => {
          setCurrentProject(null);
          setMainMode('production');
        }}
        onChangeModel={handleChangeModelAndRetry}
        unreadCount={unreadLogsCount}
        isGenerating={currentProject?.status === 'processing'}
      />

      {/* Main View Router */}
      <div className="flex-1 flex overflow-hidden">
        {mainMode === 'dashboard' && (
          <div className="flex-1 overflow-y-auto bg-[#090B10]">
            <MainDashboardView
              projects={projects}
              activeProject={currentProject}
              logs={logs}
              onSelectProject={(id) => {
                loadProjectDetails(id);
              }}
              onOpenCreateModal={() => setMainMode('production')}
              onOpenProductionPage={() => setMainMode('production')}
            />
          </div>
        )}

        {mainMode === 'production' && (
          <div className="flex-1 overflow-y-auto bg-[#090B10]">
            <ProductionProjectsView
              projects={projects}
              activeProjectId={currentProject?.id || null}
              onSelectProject={(id) => {
                loadProjectDetails(id);
              }}
              onDeleteProject={handleDeleteProject}
              onCreateProject={handleCreateProject}
              isCreating={isCreating}
            />
          </div>
        )}

        {mainMode === 'studio' && (
          <>
            {!currentProject ? (
              <div className="flex-1 overflow-y-auto bg-[#090B10]">
                <ProductionProjectsView
                  projects={projects}
                  activeProjectId={null}
                  onSelectProject={(id) => {
                    loadProjectDetails(id);
                  }}
                  onDeleteProject={handleDeleteProject}
                  onCreateProject={handleCreateProject}
                  isCreating={isCreating}
                />
              </div>
            ) : (
              <>
                <Sidebar
                  currentProject={currentProject}
                  activeTab={activeTab}
                  onSelectTab={(tab) => setActiveTab(tab)}
                  isCollapsed={isSidebarCollapsed}
                  onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  onOpenProjects={() => setMainMode('production')}
                  onNewProject={() => {
                    setCurrentProject(null);
                    setMainMode('production');
                  }}
                  counts={{
                    scenes: scenes.length,
                    shots: totalShotsCount,
                    characters: characters.length,
                    locations: locations.length,
                    objects: objects.length,
                    continuityViolations: 0,
                    isGenerating: currentProject.status === 'processing',
                  }}
                />

                {/* Content Workspace inside selected Project */}
                <div className="flex-1 overflow-y-auto bg-[#090B10] relative flex flex-col">
                  {/* Studio Top Sub-Bar Header */}
                  <div className="h-12 bg-[#12131F] border-b border-[#212335] px-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setMainMode('production')}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-300 transition"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Kembali ke Halaman Produksi</span>
                      </button>
                      <span className="text-slate-600">/</span>
                      <span className="text-xs font-bold text-white truncate max-w-xs">
                        {currentProject.title}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 bg-[#1B1C2E] px-3 py-1 rounded-full border border-[#2B2D44]">
                      Fokus Studio Terisolasi Dalam Proyek
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {activeTab === 'overview' && (
                      <ProjectDashboardWorkspace
                        project={currentProject}
                        foundation={foundation}
                        storyArchitecture={storyArchitecture}
                        characters={characters}
                        locations={locations}
                        objects={objects}
                        scenes={scenes}
                        shots={shots}
                        logs={logs}
                        onNavigate={(tab) => setActiveTab(tab)}
                        onRetryPipeline={handleRetryPipeline}
                        onOpenExport={() => setIsDriveExportOpen(true)}
                      />
                    )}

                    {activeTab === 'story' && (
                      <StoryWorkspace
                        storyArchitecture={storyArchitecture}
                        scenes={scenes}
                        onNavigate={(tab) => setActiveTab(tab)}
                      />
                    )}

                    {activeTab === 'scenes' && (
                      <SceneWorkspace
                        scenes={scenes}
                        shots={shots}
                        videoPrompts={videoPrompts}
                        characters={characters}
                        locations={locations}
                        objects={objects}
                        onRunScenePipeline={handleRunScenePipeline}
                        onRegenerateScenePrompt={handleRegenerateScenePrompt}
                        onUpdateSceneImage={handleUpdateSceneImage}
                        onUpdateShotImage={handleUpdateShotImage}
                        onRunShotPrompt={handleRunShotPrompt}
                        processingSceneId={processingSceneId}
                        processingShotId={processingShotId}
                        shotPromptError={shotPromptError}
                      />
                    )}

                    {activeTab === 'shots' && (
                      <ShotWorkspace
                        scenes={scenes}
                        shots={shots}
                        videoPrompts={videoPrompts}
                        onRunShotPrompt={handleRunShotPrompt}
                        onUpdateShotImage={handleUpdateShotImage}
                        processingShotId={processingShotId}
                        shotPromptError={shotPromptError}
                      />
                    )}

                    {(activeTab === 'bibles' || activeTab === 'characters' || activeTab === 'locations' || activeTab === 'objects') && (
                      <AssetBibleWorkspace
                        characters={characters}
                        locations={locations}
                        objects={objects}
                      />
                    )}

                    {activeTab === 'continuity' && (
                      <ContinuityWorkspace
                        project={currentProject}
                        characters={characters}
                        locations={locations}
                        scenes={scenes}
                      />
                    )}

                    {activeTab === 'pipeline' && (
                      <PipelineOrchestratorWorkspace
                        project={currentProject}
                        logs={logs}
                        onRetryPipeline={handleRetryPipeline}
                        isGenerating={currentProject.status === 'processing'}
                      />
                    )}

                    {activeTab === 'prompts' && (
                      <PromptStudioWorkspace scenes={scenes} shots={shots} />
                    )}

                    {activeTab === 'queue' && (
                      <GenerationQueueWorkspace scenes={scenes} shots={shots} />
                    )}

                    {activeTab === 'export' && (
                      <ExportWorkspace
                        project={currentProject}
                        scenes={scenes}
                        shots={shots}
                      />
                    )}

                    {activeTab === 'settings' && (
                      <SettingsWorkspace
                        project={currentProject}
                        onChangeModel={handleChangeModelAndRetry}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Modals & Overlays */}
      <ProjectListModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        projects={projects}
        currentProjectId={currentProject?.id || null}
        onSelectProject={(projId) => loadProjectDetails(projId)}
        onDeleteProject={handleDeleteProject}
        onNewProject={() => {
          setCurrentProject(null);
        }}
      />

      {currentProject && (
        <GoogleDriveExportModal
          isOpen={isDriveExportOpen}
          onClose={() => setIsDriveExportOpen(false)}
          projectData={{
            project: currentProject,
            foundation,
            characters,
            locations,
            objects,
            scenes,
            shots,
            videoPrompts,
            exportedAt: new Date().toISOString(),
          }}
        />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        project={currentProject}
        scenes={scenes}
        characters={characters}
        locations={locations}
        objects={objects}
        onNavigate={(tab) => {
          if (!currentProject) return;
          setActiveTab(tab);
        }}
        onNewProject={() => {
          setCurrentProject(null);
        }}
        onOpenProjects={() => setIsProjectsModalOpen(true)}
        onOpenExport={() => setIsDriveExportOpen(true)}
        onRetryPipeline={handleRetryPipeline}
      />

      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        logs={logs}
        onRetryStage={handleRetryPipeline}
      />
    </div>
  );
}
