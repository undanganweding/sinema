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
import { getFirestore, isFirestoreConfigured } from './firebase_admin';

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------
const IS_PRODUCTION = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

if (IS_PRODUCTION && !isFirestoreConfigured()) {
  // Fail fast: production must NEVER silently degrade to the ephemeral /tmp JSON.
  throw new Error(
    'Firestore is not configured for production (VERCEL). Set FIREBASE_PROJECT_ID, ' +
    'FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (or GOOGLE_APPLICATION_CREDENTIALS). ' +
    'Refusing to fall back to ephemeral filesystem storage.'
  );
}

const USE_FIRESTORE = isFirestoreConfigured();

// ---------------------------------------------------------------------------
// JSON fallback backend (local development / tests only)
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'firestore_store.json');

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

function emptyState(): FirestoreState {
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

function loadJsonState(): FirestoreState {
  if (!fs.existsSync(DB_FILE)) return emptyState();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    return { ...emptyState(), ...parsed };
  } catch (err) {
    console.error('Error reading Firestore store file:', err);
    return emptyState();
  }
}

function saveJsonState(state: FirestoreState): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing Firestore store file:', err);
  }
}

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
      api_key: undefined,
    };
  }
  return copy;
}

function attachEphemeralApiKey(project: Project | null): Project | null {
  if (!project) return null;
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
  if (!project.duration_mode) {
    project.duration_mode = project.scene_duration_sec ? 'fixed' : 'auto';
  }
  if (project.fixed_scene_duration === undefined) {
    project.fixed_scene_duration = project.scene_duration_sec ?? null;
  }
  if (!project.narrative_style_config) {
    project.narrative_style_config = {
      ...DEFAULT_NARRATIVE_STYLE_CONFIG,
      language: project.prompt_language === 'en' ? 'en-US' : 'id-ID',
    };
  }
  return project;
}

function now(): string {
  return new Date().toISOString();
}

function normalizeSceneTone(scene: Scene): Scene {
  return { ...scene, scene_tone: scene.scene_tone || recommendSceneTone(scene) };
}

// Local cache of the JSON state (kept in memory for the JSON fallback path).
let jsonState: FirestoreState = loadJsonState();

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------
function colRef(db: any, name: string) {
  return db.collection(name);
}

function docRef(db: any, collectionName: string, id: string) {
  return db.collection(collectionName).doc(id);
}

async function getDocData<T>(db: any, collectionName: string, id: string): Promise<T | null> {
  const snap = await docRef(db, collectionName, id).get();
  return snap.exists ? (snap.data() as T) : null;
}

async function queryWhere<T>(
  db: any,
  collectionName: string,
  field: string,
  value: unknown
): Promise<T[]> {
  const snap = await colRef(db, collectionName).where(field, '==', value).get();
  return snap.docs.map((d: any) => ({ ...(d.data() as T), id: d.id }));
}

async function queryWhereSorted<T>(
  db: any,
  collectionName: string,
  field: string,
  value: unknown,
  sortField: string,
  dir: 'asc' | 'desc' = 'asc'
): Promise<T[]> {
  const snap = await colRef(db, collectionName)
    .where(field, '==', value)
    .orderBy(sortField, dir)
    .get();
  return snap.docs.map((d: any) => ({ ...(d.data() as T), id: d.id }));
}

// ---------------------------------------------------------------------------
// DB adapter
// ---------------------------------------------------------------------------
export const db = {
  // --- Projects ---
  async saveProject(project: Project): Promise<Project> {
    if (!USE_FIRESTORE) {
      const cleanProject = sanitizeProjectForStorage(project);
      jsonState.projects[project.id] = { ...cleanProject, updated_at: now() };
      saveJsonState(jsonState);
      return attachEphemeralApiKey(jsonState.projects[project.id])!;
    }
    const fsdb = getFirestore();
    const cleanProject = sanitizeProjectForStorage(project);
    const stored = { ...cleanProject, updated_at: now() };
    await docRef(fsdb, 'projects', project.id).set(stored, { merge: true });
    return attachEphemeralApiKey(stored)!;
  },

  async updateProject(projectId: string, updater: (project: Project) => Project): Promise<Project | null> {
    if (!USE_FIRESTORE) {
      const current = jsonState.projects[projectId];
      if (!current) return null;
      const next = sanitizeProjectForStorage(updater({ ...current }));
      jsonState.projects[projectId] = { ...next, updated_at: now() };
      saveJsonState(jsonState);
      return attachEphemeralApiKey(jsonState.projects[projectId])!;
    }
    const fsdb = getFirestore();
    const currentSnap = await docRef(fsdb, 'projects', projectId).get();
    if (!currentSnap.exists) return null;
    const current = currentSnap.data() as Project;
    const next = sanitizeProjectForStorage(updater({ ...current }));
    const stored = { ...next, updated_at: now() };
    await docRef(fsdb, 'projects', projectId).set(stored, { merge: true });
    return attachEphemeralApiKey(stored)!;
  },

  async getProject(id: string): Promise<Project | null> {
    if (!USE_FIRESTORE) {
      const raw = jsonState.projects[id] || null;
      return attachEphemeralApiKey(raw ? { ...raw } : null);
    }
    const fsdb = getFirestore();
    const raw = await getDocData<Project>(fsdb, 'projects', id);
    return attachEphemeralApiKey(raw ? { ...raw } : null);
  },

  async listProjects(): Promise<Project[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.projects)
        .map((p) => attachEphemeralApiKey({ ...p })!)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    const fsdb = getFirestore();
    const snap = await colRef(fsdb, 'projects').orderBy('created_at', 'desc').get();
    return snap.docs.map((d: any) => attachEphemeralApiKey({ ...(d.data() as Project), id: d.id })!);
  },

  async deleteProject(id: string): Promise<boolean> {
    if (!USE_FIRESTORE) {
      if (!jsonState.projects[id]) return false;
      delete jsonState.projects[id];
      delete jsonState.project_foundation[id];
      delete jsonState.logs[id];
      for (const key of Object.keys(jsonState.characters)) {
        if (jsonState.characters[key].project_id === id) delete jsonState.characters[key];
      }
      for (const key of Object.keys(jsonState.locations)) {
        if (jsonState.locations[key].project_id === id) delete jsonState.locations[key];
      }
      for (const key of Object.keys(jsonState.objects)) {
        if (jsonState.objects[key].project_id === id) delete jsonState.objects[key];
      }
      for (const key of Object.keys(jsonState.scenes)) {
        if (jsonState.scenes[key].project_id === id) delete jsonState.scenes[key];
      }
      for (const key of Object.keys(jsonState.shots)) {
        if (jsonState.shots[key].project_id === id) delete jsonState.shots[key];
      }
      for (const key of Object.keys(jsonState.video_prompts)) {
        if (jsonState.video_prompts[key].project_id === id) delete jsonState.video_prompts[key];
      }
      saveJsonState(jsonState);
      return true;
    }
    const fsdb = getFirestore();
    const ownedCollections = [
      'characters', 'locations', 'objects', 'scenes', 'shots',
      'video_prompts', 'story_architectures', 'continuity_states', 'continuity_snapshots',
    ];
    const deleteRefs: any[] = [];
    for (const collName of ownedCollections) {
      const snap = await colRef(fsdb, collName).where('project_id', '==', id).get();
      for (const d of snap.docs) deleteRefs.push(d.ref);
    }
    const subSnaps = await Promise.all([
      colRef(fsdb, 'logs').where('project_id', '==', id).get(),
      colRef(fsdb, 'telemetry').where('project_id', '==', id).get(),
    ]);
    for (const snap of subSnaps) for (const d of snap.docs) deleteRefs.push(d.ref);

    deleteRefs.push(docRef(fsdb, 'projects', id));
    deleteRefs.push(docRef(fsdb, 'project_foundation', id));
    deleteRefs.push(docRef(fsdb, 'story_architectures', id));

    while (deleteRefs.length > 0) {
      const chunk = deleteRefs.splice(0, 499);
      const batch = fsdb.batch();
      for (const ref of chunk) batch.delete(ref);
      await batch.commit();
    }
    return true;
  },

  // --- Stage 1: Project Foundation ---
  async saveProjectFoundation(foundation: ProjectFoundation): Promise<ProjectFoundation> {
    if (!USE_FIRESTORE) {
      const docId = foundation.project_id;
      jsonState.project_foundation[docId] = { ...foundation, id: docId, updated_at: now() };
      saveJsonState(jsonState);
      return jsonState.project_foundation[docId];
    }
    const fsdb = getFirestore();
    const docId = foundation.project_id;
    const stored = { ...foundation, id: docId, updated_at: now() };
    await docRef(fsdb, 'project_foundation', docId).set(stored);
    return stored;
  },

  async getProjectFoundation(projectId: string): Promise<ProjectFoundation | null> {
    if (!USE_FIRESTORE) {
      return jsonState.project_foundation[projectId] || null;
    }
    const fsdb = getFirestore();
    return getDocData<ProjectFoundation>(fsdb, 'project_foundation', projectId);
  },

  // --- Stage 2: Characters ---
  async getCharacters(projectId: string): Promise<CharacterBible[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.characters).filter((c) => c.project_id === projectId);
    }
    const fsdb = getFirestore();
    return queryWhere<CharacterBible>(fsdb, 'characters', 'project_id', projectId);
  },

  async saveAndMergeCharacters(
    projectId: string,
    newCharacters: Omit<CharacterBible, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): Promise<CharacterBible[]> {
    if (!USE_FIRESTORE) {
      const existing = Object.values(jsonState.characters).filter((c) => c.project_id === projectId);
      const existingByName = new Map<string, CharacterBible>();
      for (const item of existing) existingByName.set(item.name.trim().toLowerCase(), item);
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
            clothing: existingMatch.clothing && existingMatch.clothing.length > 0 ? existingMatch.clothing : char.clothing || [],
            accessories: existingMatch.accessories && existingMatch.accessories.length > 0 ? existingMatch.accessories : char.accessories || [],
            personality: existingMatch.personality || char.personality || '',
            voice_character: existingMatch.voice_character || char.voice_character || '',
            movement_style: existingMatch.movement_style || char.movement_style || '',
            version: existingMatch.version || 1,
            updated_at: now(),
          };
          jsonState.characters[existingMatch.id!] = merged;
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
            created_at: now(),
            updated_at: now(),
          };
          jsonState.characters[id] = created;
          results.push(created);
        }
      }
      saveJsonState(jsonState);
      return results;
    }
    const fsdb = getFirestore();
    const existing = await queryWhere<CharacterBible>(fsdb, 'characters', 'project_id', projectId);
    const existingByName = new Map<string, CharacterBible>();
    for (const item of existing) existingByName.set(item.name.trim().toLowerCase(), item);
    const results: CharacterBible[] = [];
    const batch = fsdb.batch();
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
          clothing: existingMatch.clothing && existingMatch.clothing.length > 0 ? existingMatch.clothing : char.clothing || [],
          accessories: existingMatch.accessories && existingMatch.accessories.length > 0 ? existingMatch.accessories : char.accessories || [],
          personality: existingMatch.personality || char.personality || '',
          voice_character: existingMatch.voice_character || char.voice_character || '',
          movement_style: existingMatch.movement_style || char.movement_style || '',
          version: existingMatch.version || 1,
          updated_at: now(),
        };
        batch.set(docRef(fsdb, 'characters', existingMatch.id!), merged);
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
          created_at: now(),
          updated_at: now(),
        };
        batch.set(docRef(fsdb, 'characters', id), created);
        results.push(created);
      }
    }
    await batch.commit();
    return results;
  },

  // --- Stage 3: Locations & Objects with Merge Logic & Versioning ---
  async getLocations(projectId: string): Promise<LocationBible[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.locations).filter((l) => l.project_id === projectId);
    }
    const fsdb = getFirestore();
    return queryWhere<LocationBible>(fsdb, 'locations', 'project_id', projectId);
  },

  async saveAndMergeLocations(
    projectId: string,
    newLocations: Omit<LocationBible, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): Promise<LocationBible[]> {
    if (!USE_FIRESTORE) {
      const existing = Object.values(jsonState.locations).filter((l) => l.project_id === projectId);
      const existingByName = new Map<string, LocationBible>();
      for (const item of existing) existingByName.set(item.name.trim().toLowerCase(), item);
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
            color_palette: existingMatch.color_palette && existingMatch.color_palette.length > 0 ? existingMatch.color_palette : loc.color_palette || [],
            material: existingMatch.material || loc.material || '',
            version: existingMatch.version || 1,
            updated_at: now(),
          };
          jsonState.locations[existingMatch.id!] = merged;
          results.push(merged);
        } else {
          const id = `loc_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const created: LocationBible = {
            ...loc,
            id,
            project_id: projectId,
            version: 1,
            color_palette: loc.color_palette || [],
            created_at: now(),
            updated_at: now(),
          };
          jsonState.locations[id] = created;
          results.push(created);
        }
      }
      saveJsonState(jsonState);
      return results;
    }
    const fsdb = getFirestore();
    const existing = await queryWhere<LocationBible>(fsdb, 'locations', 'project_id', projectId);
    const existingByName = new Map<string, LocationBible>();
    for (const item of existing) existingByName.set(item.name.trim().toLowerCase(), item);
    const results: LocationBible[] = [];
    const batch = fsdb.batch();
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
          color_palette: existingMatch.color_palette && existingMatch.color_palette.length > 0 ? existingMatch.color_palette : loc.color_palette || [],
          material: existingMatch.material || loc.material || '',
          version: existingMatch.version || 1,
          updated_at: now(),
        };
        batch.set(docRef(fsdb, 'locations', existingMatch.id!), merged);
        results.push(merged);
      } else {
        const id = `loc_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const created: LocationBible = {
          ...loc,
          id,
          project_id: projectId,
          version: 1,
          color_palette: loc.color_palette || [],
          created_at: now(),
          updated_at: now(),
        };
        batch.set(docRef(fsdb, 'locations', id), created);
        results.push(created);
      }
    }
    await batch.commit();
    return results;
  },

  async getObjects(projectId: string): Promise<ObjectBible[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.objects).filter((o) => o.project_id === projectId);
    }
    const fsdb = getFirestore();
    return queryWhere<ObjectBible>(fsdb, 'objects', 'project_id', projectId);
  },

  async saveAndMergeObjects(
    projectId: string,
    newObjects: Omit<ObjectBible, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): Promise<ObjectBible[]> {
    if (!USE_FIRESTORE) {
      const existing = Object.values(jsonState.objects).filter((o) => o.project_id === projectId);
      const existingByName = new Map<string, ObjectBible>();
      for (const item of existing) existingByName.set(item.name.trim().toLowerCase(), item);
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
            updated_at: now(),
          };
          jsonState.objects[existingMatch.id!] = merged;
          results.push(merged);
        } else {
          const id = `obj_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const created: ObjectBible = {
            ...obj,
            id,
            project_id: projectId,
            version: 1,
            created_at: now(),
            updated_at: now(),
          };
          jsonState.objects[id] = created;
          results.push(created);
        }
      }
      saveJsonState(jsonState);
      return results;
    }
    const fsdb = getFirestore();
    const existing = await queryWhere<ObjectBible>(fsdb, 'objects', 'project_id', projectId);
    const existingByName = new Map<string, ObjectBible>();
    for (const item of existing) existingByName.set(item.name.trim().toLowerCase(), item);
    const results: ObjectBible[] = [];
    const batch = fsdb.batch();
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
          updated_at: now(),
        };
        batch.set(docRef(fsdb, 'objects', existingMatch.id!), merged);
        results.push(merged);
      } else {
        const id = `obj_${projectId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const created: ObjectBible = {
          ...obj,
          id,
          project_id: projectId,
          version: 1,
          created_at: now(),
          updated_at: now(),
        };
        batch.set(docRef(fsdb, 'objects', id), created);
        results.push(created);
      }
    }
    await batch.commit();
    return results;
  },

  // --- Stage 5: Scenes ---
  async getScenes(projectId: string): Promise<Scene[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.scenes)
        .filter((s) => s.project_id === projectId)
        .map(normalizeSceneTone)
        .sort((a, b) => a.scene_number - b.scene_number);
    }
    const fsdb = getFirestore();
    const all = await queryWhereSorted<Scene>(fsdb, 'scenes', 'project_id', projectId, 'scene_number', 'asc');
    return all.map(normalizeSceneTone);
  },

  async getScene(sceneId: string): Promise<Scene | null> {
    if (!USE_FIRESTORE) {
      const raw = jsonState.scenes[sceneId];
      return raw ? normalizeSceneTone(raw) : null;
    }
    const fsdb = getFirestore();
    const raw = await getDocData<Scene>(fsdb, 'scenes', sceneId);
    return raw ? normalizeSceneTone(raw) : null;
  },

  async updateScene(sceneId: string, partial: Partial<Scene>): Promise<Scene | null> {
    if (!USE_FIRESTORE) {
      const current = jsonState.scenes[sceneId];
      if (!current) return null;
      const updated: Scene = { ...current, ...partial, updated_at: now() };
      jsonState.scenes[sceneId] = updated;
      saveJsonState(jsonState);
      return updated;
    }
    const fsdb = getFirestore();
    const ref = docRef(fsdb, 'scenes', sceneId);
    const currentSnap = await ref.get();
    if (!currentSnap.exists) return null;
    const current = currentSnap.data() as Scene;
    const updated: Scene = { ...current, ...partial, updated_at: now() };
    await ref.set(updated);
    return updated;
  },

  async saveScenes(projectId: string, scenes: Omit<Scene, 'id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]): Promise<Scene[]> {
    if (!USE_FIRESTORE) {
      for (const key of Object.keys(jsonState.scenes)) {
        if (jsonState.scenes[key].project_id === projectId) delete jsonState.scenes[key];
      }
      const results: Scene[] = [];
      for (const scene of scenes) {
        const id = `scene_${projectId}_${scene.scene_number}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const saved: Scene = { ...scene, scene_tone: scene.scene_tone || recommendSceneTone(scene), id, project_id: projectId, version: 1, created_at: now(), updated_at: now() };
        jsonState.scenes[id] = saved;
        results.push(saved);
      }
      saveJsonState(jsonState);
      return results;
    }
    const fsdb = getFirestore();
    // Replace semantics: delete existing scenes for this project, then insert new ones.
    const existingSnap = await colRef(fsdb, 'scenes').where('project_id', '==', projectId).get();
    const batch = fsdb.batch();
    for (const d of existingSnap.docs) batch.delete(d.ref);
    const results: Scene[] = [];
    for (const scene of scenes) {
      const id = `scene_${projectId}_${scene.scene_number}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const saved: Scene = { ...scene, scene_tone: scene.scene_tone || recommendSceneTone(scene), id, project_id: projectId, version: 1, created_at: now(), updated_at: now() };
      batch.set(docRef(fsdb, 'scenes', id), saved);
      results.push(saved);
    }
    await batch.commit();
    return results;
  },

  // --- Stage 6: Shots ---
  async getShot(shotId: string): Promise<Shot | null> {
    if (!USE_FIRESTORE) {
      return jsonState.shots[shotId] || null;
    }
    const fsdb = getFirestore();
    return getDocData<Shot>(fsdb, 'shots', shotId);
  },

  async getShotsByScene(sceneId: string): Promise<Shot[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.shots)
        .filter((s) => s.scene_id === sceneId)
        .sort((a, b) => a.shot_number - b.shot_number);
    }
    const fsdb = getFirestore();
    return queryWhereSorted<Shot>(fsdb, 'shots', 'scene_id', sceneId, 'shot_number', 'asc');
  },

  async getShotsByProject(projectId: string): Promise<Shot[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.shots)
        .filter((s) => s.project_id === projectId)
        .sort((a, b) => a.shot_number - b.shot_number);
    }
    const fsdb = getFirestore();
    return queryWhereSorted<Shot>(fsdb, 'shots', 'project_id', projectId, 'shot_number', 'asc');
  },

  async saveShots(
    sceneId: string,
    projectId: string,
    shots: Omit<Shot, 'id' | 'scene_id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): Promise<Shot[]> {
    if (!USE_FIRESTORE) {
      for (const key of Object.keys(jsonState.shots)) {
        if (jsonState.shots[key].scene_id === sceneId) delete jsonState.shots[key];
      }
      const results: Shot[] = [];
      for (const s of shots) {
        const id = `shot_${sceneId}_${s.shot_number}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const created: Shot = { ...s, id, scene_id: sceneId, project_id: projectId, version: 1, created_at: now(), updated_at: now() };
        jsonState.shots[id] = created;
        results.push(created);
      }
      saveJsonState(jsonState);
      return results;
    }
    const fsdb = getFirestore();
    // Replace semantics: delete old shots for this scene, then insert new ones.
    const existingShots = await colRef(fsdb, 'shots').where('scene_id', '==', sceneId).get();
    const batch = fsdb.batch();
    for (const d of existingShots.docs) batch.delete(d.ref);
    const results: Shot[] = [];
    for (const s of shots) {
      const id = `shot_${sceneId}_${s.shot_number}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const created: Shot = { ...s, id, scene_id: sceneId, project_id: projectId, version: 1, created_at: now(), updated_at: now() };
      batch.set(docRef(fsdb, 'shots', id), created);
      results.push(created);
    }
    await batch.commit();
    return results;
  },

  async updateShot(shotId: string, partial: Partial<Shot>): Promise<Shot | null> {
    if (!USE_FIRESTORE) {
      const current = jsonState.shots[shotId];
      if (!current) return null;
      const updated: Shot = { ...current, ...partial, updated_at: now() };
      jsonState.shots[shotId] = updated;
      saveJsonState(jsonState);
      return updated;
    }
    const fsdb = getFirestore();
    const ref = docRef(fsdb, 'shots', shotId);
    const currentSnap = await ref.get();
    if (!currentSnap.exists) return null;
    const current = currentSnap.data() as Shot;
    const updated: Shot = { ...current, ...partial, updated_at: now() };
    await ref.set(updated);
    return updated;
  },

  // --- Stage 8: Video Prompts ---
  async getVideoPromptsByShot(shotId: string): Promise<VideoPrompt[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.video_prompts).filter((v) => v.shot_id === shotId);
    }
    const fsdb = getFirestore();
    return queryWhere<VideoPrompt>(fsdb, 'video_prompts', 'shot_id', shotId);
  },

  async getVideoPromptsByScene(sceneId: string): Promise<VideoPrompt[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.video_prompts).filter((v) => v.scene_id === sceneId);
    }
    const fsdb = getFirestore();
    return queryWhere<VideoPrompt>(fsdb, 'video_prompts', 'scene_id', sceneId);
  },

  async getVideoPromptsByProject(projectId: string): Promise<VideoPrompt[]> {
    if (!USE_FIRESTORE) {
      return Object.values(jsonState.video_prompts).filter((v) => v.project_id === projectId);
    }
    const fsdb = getFirestore();
    return queryWhere<VideoPrompt>(fsdb, 'video_prompts', 'project_id', projectId);
  },

  async saveVideoPrompts(
    shotId: string,
    sceneId: string,
    projectId: string,
    prompts: Omit<VideoPrompt, 'id' | 'shot_id' | 'scene_id' | 'project_id' | 'version' | 'created_at' | 'updated_at'>[]
  ): Promise<VideoPrompt[]> {
    if (!USE_FIRESTORE) {
      for (const key of Object.keys(jsonState.video_prompts)) {
        if (jsonState.video_prompts[key].shot_id === shotId) delete jsonState.video_prompts[key];
      }
      const results: VideoPrompt[] = [];
      for (const p of prompts) {
        const id = `vprompt_${shotId}_${p.target_platform}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const created: VideoPrompt = { ...p, id, shot_id: shotId, scene_id: sceneId, project_id: projectId, version: 1, created_at: now(), updated_at: now() };
        jsonState.video_prompts[id] = created;
        results.push(created);
      }
      saveJsonState(jsonState);
      return results;
    }
    const fsdb = getFirestore();
    const existingPromptSnap = await colRef(fsdb, 'video_prompts').where('shot_id', '==', shotId).get();
    const batch = fsdb.batch();
    for (const d of existingPromptSnap.docs) batch.delete(d.ref);
    const results: VideoPrompt[] = [];
    for (const p of prompts) {
      const id = `vprompt_${shotId}_${p.target_platform}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const created: VideoPrompt = { ...p, id, shot_id: shotId, scene_id: sceneId, project_id: projectId, version: 1, created_at: now(), updated_at: now() };
      batch.set(docRef(fsdb, 'video_prompts', id), created);
      results.push(created);
    }
    await batch.commit();
    return results;
  },

  async saveSingleVideoPrompt(prompt: VideoPrompt): Promise<VideoPrompt> {
    if (!USE_FIRESTORE) {
      const targetSlug = prompt.prompt_target || prompt.target_platform;
      const id = prompt.id || `vprompt_${prompt.shot_id}_${targetSlug}_${Date.now()}`;
      const full: VideoPrompt = { ...prompt, id, updated_at: now() };
      jsonState.video_prompts[id] = full;
      saveJsonState(jsonState);
      return full;
    }
    const fsdb = getFirestore();
    const targetSlug = prompt.prompt_target || prompt.target_platform;
    const id = prompt.id || `vprompt_${prompt.shot_id}_${targetSlug}_${Date.now()}`;
    const full: VideoPrompt = { ...prompt, id, updated_at: now() };
    await docRef(fsdb, 'video_prompts', id).set(full);
    return full;
  },

  // --- Pipeline Logs & Realtime Events ---
  async addLog(projectId: string, log: Omit<PipelineLogEvent, 'timestamp'>): Promise<PipelineLogEvent> {
    const fullLog: PipelineLogEvent = { ...log, timestamp: now() };
    if (!USE_FIRESTORE) {
      if (!jsonState.logs[projectId]) jsonState.logs[projectId] = [];
      jsonState.logs[projectId].push(fullLog);
      saveJsonState(jsonState);
      return fullLog;
    }
    const fsdb = getFirestore();
    // Append-only: store as an independent document in a subcollection (with auto id).
    await colRef(fsdb, `projects/${projectId}/logs`).add({
      ...fullLog,
      project_id: projectId,
    });
    return fullLog;
  },

  async getLogs(projectId: string): Promise<PipelineLogEvent[]> {
    if (!USE_FIRESTORE) {
      return jsonState.logs[projectId] || [];
    }
    const fsdb = getFirestore();
    const snap = await colRef(fsdb, `projects/${projectId}/logs`).orderBy('timestamp', 'asc').get();
    return snap.docs.map((d: any) => d.data() as PipelineLogEvent);
  },

  // --- Pipeline Telemetry Tracking ---
  async addTelemetry(projectId: string, item: StageExecutionTelemetry): Promise<StageExecutionTelemetry> {
    const entry: StageExecutionTelemetry = {
      id: item.id || `telem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      ...item,
      project_id: projectId,
    };
    if (!USE_FIRESTORE) {
      if (!jsonState.telemetry[projectId]) jsonState.telemetry[projectId] = [];
      jsonState.telemetry[projectId].push(entry);
      saveJsonState(jsonState);
      return entry;
    }
    const fsdb = getFirestore();
    await colRef(fsdb, `projects/${projectId}/telemetry`).add(entry);
    return entry;
  },

  async getTelemetry(projectId: string): Promise<StageExecutionTelemetry[]> {
    if (!USE_FIRESTORE) {
      return jsonState.telemetry?.[projectId] || [];
    }
    const fsdb = getFirestore();
    const snap = await colRef(fsdb, `projects/${projectId}/telemetry`).orderBy('started_at', 'asc').get();
    return snap.docs.map((d: any) => d.data() as StageExecutionTelemetry);
  },

  // --- Story Architecture (Babak, Sequences, Cold Open) ---
  async getStoryArchitecture(projectId: string): Promise<StoryArchitecture | null> {
    if (!USE_FIRESTORE) {
      let arch = jsonState.story_architectures?.[projectId] || null;
      if (!arch) {
        const project = await this.getProject(projectId);
        const foundation = await this.getProjectFoundation(projectId);
        const scenes = await this.getScenes(projectId);
        if (project) {
          arch = synthesizeStoryArchitectureForLegacyProject(project, foundation, scenes);
          jsonState.story_architectures[projectId] = arch;
          saveJsonState(jsonState);
        }
      }
      return arch;
    }
    const fsdb = getFirestore();
    let arch = await getDocData<StoryArchitecture>(fsdb, 'story_architectures', projectId);
    if (!arch) {
      const project = await this.getProject(projectId);
      const foundation = await this.getProjectFoundation(projectId);
      const scenes = await this.getScenes(projectId);
      if (project) {
        arch = synthesizeStoryArchitectureForLegacyProject(project, foundation, scenes);
        await docRef(fsdb, 'story_architectures', projectId).set(arch);
      }
    }
    return arch;
  },

  async saveStoryArchitecture(arch: StoryArchitecture): Promise<StoryArchitecture> {
    if (!USE_FIRESTORE) {
      if (!jsonState.story_architectures) jsonState.story_architectures = {};
      const full: StoryArchitecture = { ...arch, updated_at: now() };
      jsonState.story_architectures[arch.project_id] = full;
      saveJsonState(jsonState);
      return full;
    }
    const fsdb = getFirestore();
    const full: StoryArchitecture = { ...arch, updated_at: now() };
    await docRef(fsdb, 'story_architectures', arch.project_id).set(full);
    return full;
  },

  // --- Character Continuity States ---
  async getCharacterContinuityStates(projectId: string): Promise<CharacterContinuityState[]> {
    if (!USE_FIRESTORE) {
      let states = jsonState.continuity_states?.[projectId];
      if (!states || states.length === 0) {
        const characters = await this.getCharacters(projectId);
        states = characters.map(createCharacterContinuityState);
        if (!jsonState.continuity_states) jsonState.continuity_states = {};
        jsonState.continuity_states[projectId] = states;
        saveJsonState(jsonState);
      }
      return states;
    }
    const fsdb = getFirestore();
    let states = await getDocData<CharacterContinuityState[]>(fsdb, 'continuity_states', projectId);
    if (!states || states.length === 0) {
      const characters = await this.getCharacters(projectId);
      states = characters.map(createCharacterContinuityState);
      await docRef(fsdb, 'continuity_states', projectId).set(states);
    }
    return states;
  },

  async saveCharacterContinuityStates(projectId: string, states: CharacterContinuityState[]): Promise<CharacterContinuityState[]> {
    if (!USE_FIRESTORE) {
      if (!jsonState.continuity_states) jsonState.continuity_states = {};
      jsonState.continuity_states[projectId] = states;
      saveJsonState(jsonState);
      return states;
    }
    const fsdb = getFirestore();
    await docRef(fsdb, 'continuity_states', projectId).set(states);
    return states;
  },

  async recordApprovedCostumeTransition(
    projectId: string,
    characterName: string,
    transition: ApprovedCostumeTransition
  ): Promise<CharacterContinuityState[]> {
    const states = await this.getCharacterContinuityStates(projectId);
    const char = states.find(c => c.name.toLowerCase() === characterName.toLowerCase());
    if (char) {
      if (!char.approved_transitions) char.approved_transitions = [];
      char.approved_transitions.push(transition);
      const nextCostumeVersion = Number(transition.to_costume_version);
      if (!Number.isNaN(nextCostumeVersion)) {
        char.current_state.costume_version = nextCostumeVersion;
      }
      await this.saveCharacterContinuityStates(projectId, states);
    }
    return states;
  },

  // --- Continuity Snapshots per Scene ---
  async getContinuitySnapshot(projectId: string, sceneNumber: number): Promise<ContinuitySnapshot | null> {
    const key = `${projectId}_scene_${sceneNumber}`;
    if (!USE_FIRESTORE) {
      return jsonState.continuity_snapshots?.[key] || null;
    }
    const fsdb = getFirestore();
    return getDocData<ContinuitySnapshot>(fsdb, 'continuity_snapshots', key);
  },

  async saveContinuitySnapshot(projectId: string, sceneNumber: number, snapshot: ContinuitySnapshot): Promise<ContinuitySnapshot> {
    const key = `${projectId}_scene_${sceneNumber}`;
    if (!USE_FIRESTORE) {
      if (!jsonState.continuity_snapshots) jsonState.continuity_snapshots = {};
      jsonState.continuity_snapshots[key] = snapshot;
      saveJsonState(jsonState);
      return snapshot;
    }
    const fsdb = getFirestore();
    await docRef(fsdb, 'continuity_snapshots', key).set(snapshot);
    return snapshot;
  },

  // Full composite data retrieval
  async getFullProjectData(projectId: string): Promise<ProjectFullData | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;
    const [foundation, characters, locations, objects, rawScenes, allShots, allVideoPrompts, storyArchitecture, continuityStates] = await Promise.all([
      this.getProjectFoundation(projectId),
      this.getCharacters(projectId),
      this.getLocations(projectId),
      this.getObjects(projectId),
      this.getScenes(projectId),
      this.getShotsByProject(projectId),
      this.getVideoPromptsByProject(projectId),
      this.getStoryArchitecture(projectId),
      this.getCharacterContinuityStates(projectId),
    ]);

    const shotsMap: Record<string, Shot[]> = {};
    for (const scene of rawScenes) {
      if (scene.id) {
        shotsMap[scene.id] = allShots.filter((s) => s.scene_id === scene.id);
      }
    }

    const scenes = rawScenes.map(scene => {
      const sceneShots = scene.id ? shotsMap[scene.id] || [] : [];
      if (!scene.beats || scene.beats.length === 0) {
        scene.beats = deriveBeatsForScene(scene, sceneShots);
      }
      return scene;
    });

    const promptsMap: Record<string, VideoPrompt[]> = {};
    for (const shot of allShots) {
      if (shot.id) {
        promptsMap[shot.id] = allVideoPrompts.filter((v) => v.shot_id === shot.id);
      }
    }

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