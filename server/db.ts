import fs from 'fs';
import path from 'path';
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
  StageExecutionTelemetry,
  ProjectFullData,
  StoryArchitecture,
  CharacterContinuityState,
  ContinuitySnapshot,
  ApprovedCostumeTransition,
} from '../src/types';
import { DEFAULT_NARRATIVE_STYLE_CONFIG, recommendSceneTone } from './narrative_tone';
import { createCharacterContinuityState } from './continuity_engine';
import { synthesizeStoryArchitectureForLegacyProject, deriveBeatsForScene } from './story_architecture';

// Persistent data directory
const DATA_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'data')
  : path.join(process.cwd(), 'data');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('DATA_DIR initialization notice:', err);
}

interface FirestoreState {
  projects: Record<string, Project>;
  project_foundation: Record<string, ProjectFoundation>;
  characters: Record<string, CharacterBible>;
  locations: Record<string, LocationBible>;
  objects: Record<string, ObjectBible>;
  scenes: Record<string, Scene>;
  shots: Record<string, Shot>;
  video_prompts: Record<string, VideoPrompt>;
  logs: Record<string, PipelineLogEvent[]>;
  telemetry: Record<string, any[]>;
  story_architectures: Record<string, StoryArchitecture>;
  continuity_states: Record<string, CharacterContinuityState[]>;
  continuity_snapshots: Record<string, ContinuitySnapshot>;
}

const DB_FILE = path.join(DATA_DIR, 'firestore_store.json');

function loadState(): FirestoreState {
  if (!fs.existsSync(DB_FILE)) {
    return {
      projects: {},
      project_foundation: {},
      characters: {},
      locations: {},
      objects: {},
      scenes: {},
      shots: {},
      video_prompts: {},
      logs: {},
      telemetry: {},
      story_architectures: {},
      continuity_states: {},
      continuity_snapshots: {},
    };
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      projects: parsed.projects || {},
      project_foundation: parsed.project_foundation || {},
      characters: parsed.characters || {},
      locations: parsed.locations || {},
      objects: parsed.objects || {},
      scenes: parsed.scenes || {},
      shots: parsed.shots || {},
      video_prompts: parsed.video_prompts || {},
      logs: parsed.logs || {},
      telemetry: parsed.telemetry || {},
      story_architectures: parsed.story_architectures || {},
      continuity_states: parsed.continuity_states || {},
      continuity_snapshots: parsed.continuity_snapshots || {},
    };
  } catch (err) {
    console.error('Error reading Firestore store file:', err);
    return {
      projects: {},
      project_foundation: {},
      characters: {},
      locations: {},
      objects: {},
      scenes: {},
      shots: {},
      video_prompts: {},
      logs: {},
      telemetry: {},
      story_architectures: {},
      continuity_states: {},
      continuity_snapshots: {},
    };
  }
}

function saveState(state: FirestoreState): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing Firestore store file:', err);
  }
}

// In-memory synced state
let memoryState: FirestoreState = loadState();

// Transient in-memory storage for active API keys to keep them out of saved JSON files
const ephemeralApiKeys = new Map<string, string>();

function sanitizeProjectForStorage(project: Project): Project {
  if (project.reasoning_config?.api_key) {
    ephemeralApiKeys.set(project.id, project.reasoning_config.api_key);
  }
  
  const copy = { ...project };
  if (copy.reasoning_config) {
    copy.reasoning_config = {
      ...copy.reasoning_config,
      api_key: undefined, // Strip API key before writing to file
    };
  }
  return copy;
}

function attachEphemeralApiKey(project: Project | null): Project | null {
  if (!project) return null;
  
  // Backward compatibility migration for older projects without reasoning_config
  if (!project.reasoning_model_preferences) {
    const primaryModelId = project.reasoning_config?.model_id || project.ai_model || 'gemini-3.7-flash';
    project.reasoning_model_preferences = {
      mode: 'fixed',
      primary_model: {
        provider: project.reasoning_config?.provider_type || 'google',
        model_id: primaryModelId,
        display_name: project.reasoning_config?.display_name || primaryModelId,
      },
      fallback_policy: 'off',
      fallback_pool: [
        { provider: 'google', model_id: 'gemini-3.6-flash', priority: 1, display_name: 'Gemini 3.6 Flash' },
        { provider: 'google', model_id: 'gemini-3.1-pro-preview', priority: 2, display_name: 'Gemini 3.1 Pro' },
      ],
      force_model: false,
      stage_routing: {},
    };
  }

  if (project.reasoning_config && ephemeralApiKeys.has(project.id)) {
    project.reasoning_config.api_key = ephemeralApiKeys.get(project.id);
  }

  // Normalize duration mode & fixed scene duration
  if (!project.duration_mode) {
    project.duration_mode = project.scene_duration_sec ? 'fixed' : 'auto';
  }
  if (project.fixed_scene_duration === undefined) {
    project.fixed_scene_duration = project.scene_duration_sec ?? null;
  }

  // Normalize narrative style config
  if (!project.narrative_style_config) {
    project.narrative_style_config = {
      ...DEFAULT_NARRATIVE_STYLE_CONFIG,
      language: project.prompt_language === 'en' ? 'en-US' : 'id-ID',
    };
  }

  return project;
}

export const db = {
  // --- Projects ---
  saveProject(project: Project): Project {
    memoryState = loadState();
    const cleanProject = sanitizeProjectForStorage(project);
    memoryState.projects[project.id] = {
      ...cleanProject,
      updated_at: new Date().toISOString(),
    };
    saveState(memoryState);
    return attachEphemeralApiKey(memoryState.projects[project.id])!;
  },

  getProject(id: string): Project | null {
    memoryState = loadState();
    const raw = memoryState.projects[id] || null;
    return attachEphemeralApiKey(raw ? { ...raw } : null);
  },

  listProjects(): Project[] {
    memoryState = loadState();
    return Object.values(memoryState.projects)
      .map((p) => attachEphemeralApiKey({ ...p })!)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  deleteProject(id: string): boolean {
    memoryState = loadState();
    if (!memoryState.projects[id]) return false;
    delete memoryState.projects[id];
    delete memoryState.project_foundation[id];
    delete memoryState.logs[id];

    // Remove related sub-entities
    for (const key of Object.keys(memoryState.characters)) {
      if (memoryState.characters[key].project_id === id) {
        delete memoryState.characters[key];
      }
    }
    for (const key of Object.keys(memoryState.locations)) {
      if (memoryState.locations[key].project_id === id) {
        delete memoryState.locations[key];
      }
    }
    for (const key of Object.keys(memoryState.objects)) {
      if (memoryState.objects[key].project_id === id) {
        delete memoryState.objects[key];
      }
    }
    for (const key of Object.keys(memoryState.scenes)) {
      if (memoryState.scenes[key].project_id === id) {
        delete memoryState.scenes[key];
      }
    }
    for (const key of Object.keys(memoryState.shots)) {
      if (memoryState.shots[key].project_id === id) {
        delete memoryState.shots[key];
      }
    }
    for (const key of Object.keys(memoryState.video_prompts)) {
      if (memoryState.video_prompts[key].project_id === id) {
        delete memoryState.video_prompts[key];
      }
    }

    saveState(memoryState);
    return true;
  },

  // --- Stage 1: Project Foundation ---
  saveProjectFoundation(foundation: ProjectFoundation): ProjectFoundation {
    memoryState = loadState();
    const docId = foundation.project_id; // 1-to-1 relationship
    memoryState.project_foundation[docId] = {
      ...foundation,
      id: docId,
      updated_at: new Date().toISOString(),
    };
    saveState(memoryState);
    return memoryState.project_foundation[docId];
  },

  getProjectFoundation(projectId: string): ProjectFoundation | null {
    memoryState = loadState();
    return memoryState.project_foundation[projectId] || null;
  },

  // --- Stage 2: Characters with Merge Logic & Versioning ---
  getCharacters(projectId: string): CharacterBible[] {
    memoryState = loadState();
    return Object.values(memoryState.characters).filter((c) => c.project_id === projectId);
  },

  saveAndMergeCharacters(
    projectId: string,
    newCharacters: Omit<CharacterBible, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): CharacterBible[] {
    memoryState = loadState();
    const existing = Object.values(memoryState.characters).filter((c) => c.project_id === projectId);
    const existingByName = new Map<string, CharacterBible>();
    for (const item of existing) {
      existingByName.set(item.name.trim().toLowerCase(), item);
    }

    const results: CharacterBible[] = [];

    for (const char of newCharacters) {
      const normalizedName = char.name.trim().toLowerCase();
      const existingMatch = existingByName.get(normalizedName);

      if (existingMatch) {
        const merged: CharacterBible = {
          ...existingMatch,
          age: existingMatch.age || char.age || '',
          gender: existingMatch.gender || char.gender || '',
          physical_appearance: existingMatch.physical_appearance || char.physical_appearance || '',
          face_identity_locked: existingMatch.face_identity_locked ?? char.face_identity_locked ?? false,
          hair: existingMatch.hair || char.hair || '',
          beard: existingMatch.beard || char.beard || '',
          clothing:
            existingMatch.clothing && existingMatch.clothing.length > 0
              ? existingMatch.clothing
              : char.clothing || [],
          accessories:
            existingMatch.accessories && existingMatch.accessories.length > 0
              ? existingMatch.accessories
              : char.accessories || [],
          personality: existingMatch.personality || char.personality || '',
          voice_character: existingMatch.voice_character || char.voice_character || '',
          movement_style: existingMatch.movement_style || char.movement_style || '',
          version: existingMatch.version || 1,
          updated_at: new Date().toISOString(),
        };
        memoryState.characters[existingMatch.id!] = merged;
        results.push(merged);
      } else {
        const id = `char_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const created: CharacterBible = {
          ...char,
          id,
          project_id: projectId,
          version: 1,
          face_identity_locked: char.face_identity_locked ?? false,
          clothing: char.clothing || [],
          accessories: char.accessories || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        memoryState.characters[id] = created;
        results.push(created);
      }
    }

    saveState(memoryState);
    return results;
  },

  // --- Stage 3: Locations & Objects with Merge Logic & Versioning ---
  getLocations(projectId: string): LocationBible[] {
    memoryState = loadState();
    return Object.values(memoryState.locations).filter((l) => l.project_id === projectId);
  },

  saveAndMergeLocations(
    projectId: string,
    newLocations: Omit<LocationBible, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): LocationBible[] {
    memoryState = loadState();
    const existing = Object.values(memoryState.locations).filter((l) => l.project_id === projectId);
    const existingByName = new Map<string, LocationBible>();
    for (const item of existing) {
      existingByName.set(item.name.trim().toLowerCase(), item);
    }

    const results: LocationBible[] = [];

    for (const loc of newLocations) {
      const normalizedName = loc.name.trim().toLowerCase();
      const existingMatch = existingByName.get(normalizedName);

      if (existingMatch) {
        const merged: LocationBible = {
          ...existingMatch,
          era: existingMatch.era || loc.era || '',
          architecture: existingMatch.architecture || loc.architecture || '',
          environment: existingMatch.environment || loc.environment || '',
          landscape: existingMatch.landscape || loc.landscape || '',
          climate: existingMatch.climate || loc.climate || '',
          culture: existingMatch.culture || loc.culture || '',
          lighting_style: existingMatch.lighting_style || loc.lighting_style || '',
          color_palette:
            existingMatch.color_palette && existingMatch.color_palette.length > 0
              ? existingMatch.color_palette
              : loc.color_palette || [],
          material: existingMatch.material || loc.material || '',
          version: existingMatch.version || 1,
          updated_at: new Date().toISOString(),
        };
        memoryState.locations[existingMatch.id!] = merged;
        results.push(merged);
      } else {
        const id = `loc_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const created: LocationBible = {
          ...loc,
          id,
          project_id: projectId,
          version: 1,
          color_palette: loc.color_palette || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        memoryState.locations[id] = created;
        results.push(created);
      }
    }

    saveState(memoryState);
    return results;
  },

  getObjects(projectId: string): ObjectBible[] {
    memoryState = loadState();
    return Object.values(memoryState.objects).filter((o) => o.project_id === projectId);
  },

  saveAndMergeObjects(
    projectId: string,
    newObjects: Omit<ObjectBible, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): ObjectBible[] {
    memoryState = loadState();
    const existing = Object.values(memoryState.objects).filter((o) => o.project_id === projectId);
    const existingByName = new Map<string, ObjectBible>();
    for (const item of existing) {
      existingByName.set(item.name.trim().toLowerCase(), item);
    }

    const results: ObjectBible[] = [];

    for (const obj of newObjects) {
      const normalizedName = obj.name.trim().toLowerCase();
      const existingMatch = existingByName.get(normalizedName);

      if (existingMatch) {
        const merged: ObjectBible = {
          ...existingMatch,
          category: existingMatch.category || obj.category || '',
          description: existingMatch.description || obj.description || '',
          continuity_notes: existingMatch.continuity_notes || obj.continuity_notes || '',
          version: existingMatch.version || 1,
          updated_at: new Date().toISOString(),
        };
        memoryState.objects[existingMatch.id!] = merged;
        results.push(merged);
      } else {
        const id = `obj_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const created: ObjectBible = {
          ...obj,
          id,
          project_id: projectId,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        memoryState.objects[id] = created;
        results.push(created);
      }
    }

    saveState(memoryState);
    return results;
  },

  // --- Stage 5: Scenes ---
  getScenes(projectId: string): Scene[] {
    memoryState = loadState();
    return Object.values(memoryState.scenes)
      .filter((s) => s.project_id === projectId)
      .map((s) => ({
        ...s,
        scene_tone: s.scene_tone || recommendSceneTone(s),
      }))
      .sort((a, b) => a.scene_number - b.scene_number);
  },

  getScene(sceneId: string): Scene | null {
    memoryState = loadState();
    const raw = memoryState.scenes[sceneId];
    if (!raw) return null;
    return {
      ...raw,
      scene_tone: raw.scene_tone || recommendSceneTone(raw),
    };
  },

  updateScene(sceneId: string, partial: Partial<Scene>): Scene | null {
    memoryState = loadState();
    const current = memoryState.scenes[sceneId];
    if (!current) return null;
    const updated: Scene = {
      ...current,
      ...partial,
      updated_at: new Date().toISOString(),
    };
    memoryState.scenes[sceneId] = updated;
    saveState(memoryState);
    return updated;
  },

  saveScenes(projectId: string, scenes: Omit<Scene, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]): Scene[] {
    memoryState = loadState();
    // Clear previous scenes for this project if any
    for (const key of Object.keys(memoryState.scenes)) {
      if (memoryState.scenes[key].project_id === projectId) {
        delete memoryState.scenes[key];
      }
    }

    const results: Scene[] = [];
    for (const scene of scenes) {
      const id = `scene_${projectId}_${scene.scene_number}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const saved: Scene = {
        ...scene,
        scene_tone: scene.scene_tone || recommendSceneTone(scene),
        id,
        project_id: projectId,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryState.scenes[id] = saved;
      results.push(saved);
    }

    saveState(memoryState);
    return results;
  },

  // --- Stage 6: Shots ---
  getShot(shotId: string): Shot | null {
    memoryState = loadState();
    return memoryState.shots[shotId] || null;
  },

  getShotsByScene(sceneId: string): Shot[] {
    memoryState = loadState();
    return Object.values(memoryState.shots)
      .filter((s) => s.scene_id === sceneId)
      .sort((a, b) => a.shot_number - b.shot_number);
  },

  getShotsByProject(projectId: string): Shot[] {
    memoryState = loadState();
    return Object.values(memoryState.shots)
      .filter((s) => s.project_id === projectId)
      .sort((a, b) => a.shot_number - b.shot_number);
  },

  saveShots(
    sceneId: string,
    projectId: string,
    shots: Omit<Shot, 'id' | 'scene_id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): Shot[] {
    memoryState = loadState();
    // Clear old shots for this scene
    for (const key of Object.keys(memoryState.shots)) {
      if (memoryState.shots[key].scene_id === sceneId) {
        delete memoryState.shots[key];
      }
    }

    const results: Shot[] = [];
    for (const s of shots) {
      const id = `shot_${sceneId}_${s.shot_number}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const created: Shot = {
        ...s,
        id,
        scene_id: sceneId,
        project_id: projectId,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryState.shots[id] = created;
      results.push(created);
    }

    saveState(memoryState);
    return results;
  },

  updateShot(shotId: string, partial: Partial<Shot>): Shot | null {
    memoryState = loadState();
    const current = memoryState.shots[shotId];
    if (!current) return null;
    const updated: Shot = {
      ...current,
      ...partial,
      updated_at: new Date().toISOString(),
    };
    memoryState.shots[shotId] = updated;
    saveState(memoryState);
    return updated;
  },

  // --- Stage 8: Video Prompts ---
  getVideoPromptsByShot(shotId: string): VideoPrompt[] {
    memoryState = loadState();
    return Object.values(memoryState.video_prompts).filter((v) => v.shot_id === shotId);
  },

  getVideoPromptsByScene(sceneId: string): VideoPrompt[] {
    memoryState = loadState();
    return Object.values(memoryState.video_prompts).filter((v) => v.scene_id === sceneId);
  },

  getVideoPromptsByProject(projectId: string): VideoPrompt[] {
    memoryState = loadState();
    return Object.values(memoryState.video_prompts).filter((v) => v.project_id === projectId);
  },

  saveVideoPrompts(
    shotId: string,
    sceneId: string,
    projectId: string,
    prompts: Omit<VideoPrompt, 'id' | 'shot_id' | 'scene_id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): VideoPrompt[] {
    memoryState = loadState();
    // Clear old video prompts for this shot
    for (const key of Object.keys(memoryState.video_prompts)) {
      if (memoryState.video_prompts[key].shot_id === shotId) {
        delete memoryState.video_prompts[key];
      }
    }

    const results: VideoPrompt[] = [];
    for (const p of prompts) {
      const id = `vprompt_${shotId}_${p.target_platform}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const created: VideoPrompt = {
        ...p,
        id,
        shot_id: shotId,
        scene_id: sceneId,
        project_id: projectId,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryState.video_prompts[id] = created;
      results.push(created);
    }

    saveState(memoryState);
    return results;
  },

  saveSingleVideoPrompt(prompt: VideoPrompt): VideoPrompt {
    memoryState = loadState();
    // PATCH 5.5-R1 FASE 5: include the canonical `prompt_target` in the generated
    // id. `target_platform` alone collapses seedance_10 and seedance_30 onto the
    // same `seedance` slug, so two distinct targets saved within the same
    // millisecond would produce identical ids and silently overwrite each other.
    const targetSlug = prompt.prompt_target || prompt.target_platform;
    const id = prompt.id || `vprompt_${prompt.shot_id}_${targetSlug}_${Date.now()}`;
    const full: VideoPrompt = {
      ...prompt,
      id,
      updated_at: new Date().toISOString(),
    };
    memoryState.video_prompts[id] = full;
    saveState(memoryState);
    return full;
  },

  // --- Pipeline Logs & Realtime Events ---
  addLog(projectId: string, log: Omit<PipelineLogEvent, 'timestamp'>): PipelineLogEvent {
    memoryState = loadState();
    if (!memoryState.logs[projectId]) {
      memoryState.logs[projectId] = [];
    }
    const fullLog: PipelineLogEvent = {
      ...log,
      timestamp: new Date().toISOString(),
    };
    memoryState.logs[projectId].push(fullLog);
    saveState(memoryState);
    return fullLog;
  },

  getLogs(projectId: string): PipelineLogEvent[] {
    memoryState = loadState();
    return memoryState.logs[projectId] || [];
  },

  // --- Pipeline Telemetry Tracking ---
  addTelemetry(projectId: string, item: StageExecutionTelemetry): StageExecutionTelemetry {
    memoryState = loadState();
    if (!memoryState.telemetry) {
      memoryState.telemetry = {};
    }
    if (!memoryState.telemetry[projectId]) {
      memoryState.telemetry[projectId] = [];
    }
    const entry: StageExecutionTelemetry = {
      id: item.id || `telem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      project_id: projectId,
      ...item,
    };
    memoryState.telemetry[projectId].push(entry);
    saveState(memoryState);
    return entry;
  },

  getTelemetry(projectId: string): StageExecutionTelemetry[] {
    memoryState = loadState();
    return memoryState.telemetry?.[projectId] || [];
  },

  // --- Story Architecture (Babak, Sequences, Cold Open) ---
  getStoryArchitecture(projectId: string): StoryArchitecture | null {
    memoryState = loadState();
    let arch = memoryState.story_architectures?.[projectId] || null;
    if (!arch) {
      // Synthesize default backward-compatible architecture
      const project = this.getProject(projectId);
      const foundation = this.getProjectFoundation(projectId);
      const scenes = this.getScenes(projectId);
      if (project) {
        arch = synthesizeStoryArchitectureForLegacyProject(project, foundation, scenes);
        memoryState.story_architectures[projectId] = arch;
        saveState(memoryState);
      }
    }
    return arch;
  },

  saveStoryArchitecture(arch: StoryArchitecture): StoryArchitecture {
    memoryState = loadState();
    if (!memoryState.story_architectures) {
      memoryState.story_architectures = {};
    }
    const full: StoryArchitecture = {
      ...arch,
      updated_at: new Date().toISOString(),
    };
    memoryState.story_architectures[arch.project_id] = full;
    saveState(memoryState);
    return full;
  },

  // --- Character Continuity States ---
  getCharacterContinuityStates(projectId: string): CharacterContinuityState[] {
    memoryState = loadState();
    let states = memoryState.continuity_states?.[projectId];
    if (!states || states.length === 0) {
      const characters = this.getCharacters(projectId);
      states = characters.map(createCharacterContinuityState);
      if (!memoryState.continuity_states) {
        memoryState.continuity_states = {};
      }
      memoryState.continuity_states[projectId] = states;
      saveState(memoryState);
    }
    return states;
  },

  saveCharacterContinuityStates(projectId: string, states: CharacterContinuityState[]): CharacterContinuityState[] {
    memoryState = loadState();
    if (!memoryState.continuity_states) {
      memoryState.continuity_states = {};
    }
    memoryState.continuity_states[projectId] = states;
    saveState(memoryState);
    return states;
  },

  recordApprovedCostumeTransition(
    projectId: string,
    characterName: string,
    transition: ApprovedCostumeTransition
  ): CharacterContinuityState[] {
    const states = this.getCharacterContinuityStates(projectId);
    const char = states.find(c => c.name.toLowerCase() === characterName.toLowerCase());
    if (char) {
      if (!char.approved_transitions) char.approved_transitions = [];
      char.approved_transitions.push(transition);
      char.current_state.costume_version = transition.to_costume_version;
      this.saveCharacterContinuityStates(projectId, states);
    }
    return states;
  },

  // --- Continuity Snapshots per Scene ---
  getContinuitySnapshot(projectId: string, sceneNumber: number): ContinuitySnapshot | null {
    memoryState = loadState();
    const key = `${projectId}_scene_${sceneNumber}`;
    return memoryState.continuity_snapshots?.[key] || null;
  },

  saveContinuitySnapshot(projectId: string, sceneNumber: number, snapshot: ContinuitySnapshot): ContinuitySnapshot {
    memoryState = loadState();
    if (!memoryState.continuity_snapshots) {
      memoryState.continuity_snapshots = {};
    }
    const key = `${projectId}_scene_${sceneNumber}`;
    memoryState.continuity_snapshots[key] = snapshot;
    saveState(memoryState);
    return snapshot;
  },

  // Full composite data retrieval
  getFullProjectData(projectId: string): ProjectFullData | null {
    const project = this.getProject(projectId);
    if (!project) return null;
    const foundation = this.getProjectFoundation(projectId);
    const characters = this.getCharacters(projectId);
    const locations = this.getLocations(projectId);
    const objects = this.getObjects(projectId);
    const rawScenes = this.getScenes(projectId);

    // Group shots by scene_id
    const allShots = this.getShotsByProject(projectId);
    const shotsMap: Record<string, Shot[]> = {};
    for (const scene of rawScenes) {
      if (scene.id) {
        shotsMap[scene.id] = allShots.filter((s) => s.scene_id === scene.id);
      }
    }

    // Ensure scenes have beats populated if shots exist
    const scenes = rawScenes.map(scene => {
      const sceneShots = scene.id ? shotsMap[scene.id] || [] : [];
      if (!scene.beats || scene.beats.length === 0) {
        scene.beats = deriveBeatsForScene(scene, sceneShots);
      }
      return scene;
    });

    // Group video prompts by shot_id
    const allVideoPrompts = this.getVideoPromptsByProject(projectId);
    const promptsMap: Record<string, VideoPrompt[]> = {};
    for (const shot of allShots) {
      if (shot.id) {
        promptsMap[shot.id] = allVideoPrompts.filter((v) => v.shot_id === shot.id);
      }
    }

    const storyArchitecture = this.getStoryArchitecture(projectId);
    const continuityStates = this.getCharacterContinuityStates(projectId);

    return {
      project,
      foundation,
      story_architecture: storyArchitecture,
      characters,
      continuity_states: continuityStates,
      locations,
      objects,
      scenes,
      shots: shotsMap,
      video_prompts: promptsMap,
    };
  },
};
