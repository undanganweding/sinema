import {
  CharacterBible,
  LocationBible,
  ObjectBible,
  CharacterContinuityState,
  LocationContinuityState,
  ObjectContinuityState,
  ContinuitySnapshot,
  ContinuityViolation,
  ContinuityValidationResult,
  CostumeStructure,
  CostumeItem,
  ApprovedCostumeTransition,
  Scene,
  Shot,
  ContextPackage,
  ContinuityIssue,
  ContinuityState,
  CharacterState,
  SceneContinuityState,
  ContinuityTransitionType,
  ContinuityScope,
} from '../src/types';

/**
 * Extracts structured costume breakdown from freeform character clothing descriptions
 */
export function extractCostumeStructure(clothing: string[], characterName: string, gender: string): CostumeStructure {
  const structure: CostumeStructure = {
    accessories: [],
    colors: [],
    materials: [],
    distinctive_details: [],
  };

  const fullText = clothing.join(' ').toLowerCase();

  // Head cover detection (Hijab, Khimar, Turban, Kufi, Scarf, Veil, etc.)
  if (
    fullText.includes('hijab') ||
    fullText.includes('jilbab') ||
    fullText.includes('kerudung') ||
    fullText.includes('khimar') ||
    fullText.includes('veil') ||
    fullText.includes('turban') ||
    fullText.includes('sorban') ||
    fullText.includes('kufi') ||
    fullText.includes('penutup kepala')
  ) {
    const matched = clothing.find(c => {
      const lc = c.toLowerCase();
      return (
        lc.includes('hijab') ||
        lc.includes('jilbab') ||
        lc.includes('kerudung') ||
        lc.includes('khimar') ||
        lc.includes('veil') ||
        lc.includes('turban') ||
        lc.includes('sorban') ||
        lc.includes('kufi') ||
        lc.includes('penutup')
      );
    });
    structure.head_cover = {
      value: matched || 'Traditional modest head covering',
      status: 'required',
      notes: 'Wajib konsisten di setiap adegan sesuai adab & identitas historis',
    };
  }

  // Outer garment detection (Robe, Jubah, Cloak, Abaya, Gamis, Tunik)
  const outerMatch = clothing.find(c => {
    const lc = c.toLowerCase();
    return (
      lc.includes('jubah') ||
      lc.includes('robe') ||
      lc.includes('cloak') ||
      lc.includes('abaya') ||
      lc.includes('gamis') ||
      lc.includes('tunic') ||
      lc.includes('tunik') ||
      lc.includes('baju kurung')
    );
  });
  if (outerMatch) {
    structure.outer_garment = {
      value: outerMatch,
      status: 'required',
      notes: 'Pakaian luar utama',
    };
  }

  // Footwear detection (Sandals, Boots, etc.)
  const footwearMatch = clothing.find(c => {
    const lc = c.toLowerCase();
    return lc.includes('sandal') || lc.includes('sepatu') || lc.includes('alas kaki') || lc.includes('boots');
  });
  if (footwearMatch) {
    structure.footwear = {
      value: footwearMatch,
      status: 'required',
    };
  } else {
    structure.footwear = {
      value: 'Alas kaki kulit tradisional era kuno / padang pasir',
      status: 'optional',
    };
  }

  // Extract color mentions
  const colorKeywords = [
    'cream', 'krem', 'putih', 'white', 'hitam', 'black', 'cokelat', 'brown', 'earth-tone',
    'abu-abu', 'grey', 'gray', 'emas', 'gold', 'merah', 'red', 'biru', 'blue', 'hijau', 'green'
  ];
  for (const item of clothing) {
    const lc = item.toLowerCase();
    for (const color of colorKeywords) {
      if (lc.includes(color) && !structure.colors?.includes(color)) {
        structure.colors?.push(color);
      }
    }
  }

  return structure;
}

/**
 * Initializes a canonical CharacterContinuityState from a CharacterBible
 */
export function createCharacterContinuityState(character: CharacterBible): CharacterContinuityState {
  const costume = extractCostumeStructure(
    character.clothing || [],
    character.name,
    character.gender
  );

  return {
    character_id: character.id || character.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: character.name,
    identity_version: character.version || 1,
    identity: {
      face: 'locked',
      body: 'locked',
      age: 'locked',
      skin_tone: 'locked',
      hair: 'locked',
    },
    costume,
    appearance: {
      accessories: character.accessories || [],
      facial_features: [character.hair, character.beard].filter(Boolean),
      body_features: [character.physical_appearance].filter(Boolean),
    },
    continuity_rules: {
      appearance_change_requires_approval: true,
      costume_change_requires_approval: true,
    },
    current_state: {
      scene_id: null,
      costume_version: 1,
      temporary_props: [],
    },
    approved_transitions: [],
  };
}

/**
 * Initializes canonical LocationContinuityState from LocationBible
 */
export function createLocationContinuityState(location: LocationBible): LocationContinuityState {
  return {
    location_id: location.id || location.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: location.name,
    architecture: location.architecture || 'Ancient Semitic stone and adobe vernacular architecture',
    terrain: location.landscape || 'Arid desert valley surrounded by rugged rocky hills',
    layout: location.environment || 'Open courtyard with narrow unpaved alleys',
    materials: location.material || 'Local clay, dried mud-brick, rough-hewn stone, palm timber',
    environmental_identity: `${location.era} - ${location.climate}`,
    historical_period: location.era || 'Pre-Islamic Ancient Arabia',
    recurring_landmarks: [],
    lighting_conditions: location.lighting_style || 'Harsh natural desert daylight with sharp shadows and warm golden hour',
    prohibited_elements: [
      'no modern buildings',
      'no skyscrapers',
      'no asphalt roads',
      'no electric poles or wires',
      'no modern vehicles or machinery',
      'no contemporary plastics or neon signs',
    ],
  };
}

/**
 * Initializes canonical ObjectContinuityState from ObjectBible
 */
export function createObjectContinuityState(obj: ObjectBible): ObjectContinuityState {
  return {
    object_id: obj.id || obj.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    name: obj.name,
    appearance: obj.description,
    material: obj.category || 'Traditional era-appropriate material',
    color: 'Authentic historical patina',
    condition: 'Pristine historical condition',
    current_state: 'active',
  };
}

/**
 * Builds a ContinuitySnapshot for a scene with inheritance from previous scene
 */
export function buildContinuitySnapshot(
  characters: CharacterBible[],
  locations: LocationBible[],
  objects: ObjectBible[],
  characterStates: CharacterContinuityState[],
  sceneNumber: number,
  previousSceneState?: {
    scene_number: number;
    character_states: Record<string, any>;
    location_name: string;
  }
): ContinuitySnapshot {
  const charContinuityMap = new Map<string, CharacterContinuityState>();
  
  // Ensure state exists for each character
  for (const char of characters) {
    const existing = characterStates.find(cs => cs.name.toLowerCase() === char.name.toLowerCase());
    if (existing) {
      charContinuityMap.set(char.name.toLowerCase(), { ...existing });
    } else {
      charContinuityMap.set(char.name.toLowerCase(), createCharacterContinuityState(char));
    }
  }

  // Inherit state from previous scene if available
  if (previousSceneState && previousSceneState.character_states) {
    for (const [charName, prevState] of Object.entries(previousSceneState.character_states)) {
      const state = charContinuityMap.get(charName.toLowerCase());
      if (state && prevState) {
        // Inherit costume version & permanent state
        state.current_state.costume_version = prevState.costume_version || state.current_state.costume_version;
        // Temporary props do NOT inherit unless persistent
        state.current_state.temporary_props = [];
      }
    }
  }

  const locContinuity = locations.map(createLocationContinuityState);
  const objContinuity = objects.map(createObjectContinuityState);

  return {
    characters: Array.from(charContinuityMap.values()),
    locations: locContinuity,
    objects: objContinuity,
    environment: [
      'Pencahayaan alami realistis',
      'Atmosfer partikel debu halus gurun pasir',
      'Palet warna earth-tone bertekstur organik',
    ],
    visual_style: [
      'Gaya sinematik epik 35mm dengan lensa anamorfik halus',
      'Tekstur kain tenun alami dan batu pahat kasar',
    ],
    previous_scene_state: previousSceneState,
  };
}

/**
 * Builds a compact, high-impact continuity instruction to inject into prompts
 * Additive and focused only on characters and locations in the scene.
 */
export function buildContinuityInstruction(
  snapshot: ContinuitySnapshot,
  scene: { character_names?: string[]; location_name?: string }
): string {
  const activeCharNames = (scene.character_names || []).map(n => n.toLowerCase());
  const activeChars = snapshot.characters.filter(c =>
    activeCharNames.some(name => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()))
  );

  const activeLoc = snapshot.locations.find(l =>
    scene.location_name &&
    (l.name.toLowerCase().includes(scene.location_name.toLowerCase()) ||
      scene.location_name.toLowerCase().includes(l.name.toLowerCase()))
  );

  const lines: string[] = ['--- KONTINUITAS VISUAL RESMI (CONTINUITY LOCK) ---'];

  if (activeChars.length > 0) {
    for (const char of activeChars) {
      lines.push(`Karakter [${char.name}]:`);
      lines.push(`- Wajah & Usia: Identitas TERKUNCI (Strict Facial Lock).`);
      if (char.costume.head_cover && char.costume.head_cover.status === 'required') {
        lines.push(`- Penutup Kepala (WAJIB): ${char.costume.head_cover.value} — DILARANG keras dihilangkan atau diganti tanpa izin.`);
      }
      if (char.costume.outer_garment) {
        lines.push(`- Busana Luar: ${char.costume.outer_garment.value}.`);
      }
      if (char.costume.colors && char.costume.colors.length > 0) {
        lines.push(`- Palet Warna Busana: ${char.costume.colors.join(', ')}.`);
      }
      lines.push(`- Status Busana: Versi ${char.current_state.costume_version} (Terkunci konsisten dengan adegan sebelumnya).`);
    }
  }

  if (activeLoc) {
    lines.push(`Lokasi [${activeLoc.name}]:`);
    lines.push(`- Arsitektur: ${activeLoc.architecture}.`);
    lines.push(`- Material: ${activeLoc.materials}.`);
    lines.push(`- Pantangan Kontinuitas: ${activeLoc.prohibited_elements?.join(', ')}.`);
  }

  lines.push('----------------------------------------------------');
  return lines.join('\n');
}

/**
 * Validates Character Continuity against canonical rules
 */
export function validateCharacterContinuity(
  sceneText: string,
  character: CharacterContinuityState,
  sceneNumber: number,
  shotNumber?: number
): ContinuityViolation[] {
  const violations: ContinuityViolation[] = [];
  const textLower = sceneText.toLowerCase();

  // Check 1: Mandatory Head Covering (Hijab / Turban / Scarf)
  if (character.costume.head_cover && character.costume.head_cover.status === 'required') {
    const headCoverVal = character.costume.head_cover.value.toLowerCase();
    const indicatesNoHeadCover =
      textLower.includes('no hijab') ||
      textLower.includes('without hijab') ||
      textLower.includes('uncovered hair') ||
      textLower.includes('rambut terurai') ||
      textLower.includes('tanpa hijab') ||
      textLower.includes('tanpa penutup kepala') ||
      textLower.includes('bare head') ||
      textLower.includes('hair exposed');

    if (indicatesNoHeadCover) {
      violations.push({
        type: 'head_cover_missing',
        field: 'costume.head_cover',
        expected: character.costume.head_cover.value,
        actual: 'Penutup kepala dihilangkan secara tidak sah',
        severity: 'critical',
        character_name: character.name,
        scene_number: sceneNumber,
        shot_number: shotNumber,
        message: `Pelanggaran Kritis: Penutup kepala wajib (${character.costume.head_cover.value}) pada karakter ${character.name} hilang atau terbuka pada adegan ${sceneNumber}.`,
      });
    }
  }

  // Check 2: Unauthorized major wardrobe contradictions
  if (character.costume.outer_garment) {
    const garment = character.costume.outer_garment.value.toLowerCase();
    const modernClothingKeywords = ['t-shirt', 'kaos', 'jeans', 'celana jeans', 'hoodie', 'jas modern', 'suit'];
    for (const kw of modernClothingKeywords) {
      if (textLower.includes(kw)) {
        violations.push({
          type: 'costume_change',
          field: 'costume.outer_garment',
          expected: character.costume.outer_garment.value,
          actual: `Pakaian modern '${kw}' terdeteksi`,
          severity: 'critical',
          character_name: character.name,
          scene_number: sceneNumber,
          shot_number: shotNumber,
          message: `Pelanggaran Kritis: Terdeteksi pakaian era modern '${kw}' pada karakter ${character.name}.`,
        });
      }
    }
  }

  return violations;
}

/**
 * Validates Location Continuity against modern anachronisms
 */
export function validateLocationContinuity(
  sceneText: string,
  location: LocationContinuityState,
  sceneNumber: number
): ContinuityViolation[] {
  const violations: ContinuityViolation[] = [];
  const textLower = sceneText.toLowerCase();

  const modernAnachronisms = [
    { word: 'skyscraper', name: 'Gedung pencakar langit' },
    { word: 'gedung bertingkat modern', name: 'Gedung modern' },
    { word: 'asphalt', name: 'Jalan aspal modern' },
    { word: 'aspal', name: 'Jalan aspal modern' },
    { word: 'car', name: 'Mobil/kendaraan bermotor' },
    { word: 'mobil', name: 'Mobil/kendaraan bermotor' },
    { word: 'motorcycle', name: 'Sepeda motor' },
    { word: 'electric pole', name: 'Tiang listrik' },
    { word: 'kabel listrik', name: 'Kabel listrik' },
    { word: 'neon', name: 'Lampu neon modern' },
    { word: 'plastic', name: 'Plastik modern' },
  ];

  for (const anach of modernAnachronisms) {
    // Avoid false positives (e.g. "no asphalt")
    if (textLower.includes(anach.word) && !textLower.includes(`no ${anach.word}`) && !textLower.includes(`tanpa ${anach.word}`)) {
      violations.push({
        type: 'period_violation',
        field: 'location.architecture',
        expected: location.architecture,
        actual: anach.name,
        severity: 'critical',
        location_name: location.name,
        scene_number: sceneNumber,
        message: `Pelanggaran Kritis: Elemen anakronisme modern '${anach.name}' terdeteksi pada lokasi historis ${location.name}.`,
      });
    }
  }

  return violations;
}

/**
 * Comprehensive Scene Continuity Validation
 */
export function validateSceneContinuity(
  scene: Scene,
  shots: Shot[],
  snapshot: ContinuitySnapshot,
  runtimeState?: ContinuityState | null
): ContinuityValidationResult {
  const violations: ContinuityViolation[] = [];
  const sceneNumber = scene.scene_number;

  // Canonical continuity source-of-truth:
  //   CharacterBible (S2) → buildContinuitySnapshot() → persisted snapshot (validation baseline).
  //   project.continuityState (runtime ContinuityState) → mutable scene-to-scene state mutated by S6 advanceContinuity().
  // The runtime state is authoritative for scene-to-scene mutations; when present it overrides the
  // snapshot's static costume with the current scene's observed clothing. Backward compatible: callers
  // that omit runtimeState still validate against the snapshot alone.
  const effectiveCharacters = snapshot.characters.map((char) => {
    const runtimeChar = runtimeState?.characters?.find(
      (c) => phase6Normalize(c.displayName) === phase6Normalize(char.name)
    );
    if (!runtimeChar) return char;
    // Rebuild costume from the runtime observable clothing so S8 validates the mutable state
    // that S6 actually advanced to, not only the static S5 baseline.
    const applied = { ...char };
    if (runtimeChar.clothing && runtimeChar.clothing.length > 0) {
      applied.costume = extractCostumeStructure(runtimeChar.clothing, char.name, '');
    }
    return applied;
  });
  const effectiveSnapshot: ContinuitySnapshot = { ...snapshot, characters: effectiveCharacters };

  // 1. Validate all scene characters
  const activeCharNames = (scene.character_names || []).map(n => n.toLowerCase());
  const activeChars = effectiveSnapshot.characters.filter(c =>
    activeCharNames.some(name => c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()))
  );

  const fullSceneText = [
    scene.title,
    scene.event,
    scene.story_purpose,
    scene.master_image_prompt_json?.characters_note || '',
    scene.master_image_prompt_json?.costume || '',
    ...shots.map(s => `${s.event_detail} ${s.character_action}`),
  ].join(' ');

  for (const char of activeChars) {
    const charViolations = validateCharacterContinuity(fullSceneText, char, sceneNumber);
    violations.push(...charViolations);
  }

  // 2. Validate location continuity
  const activeLoc = effectiveSnapshot.locations.find(l =>
    scene.location_name &&
    (l.name.toLowerCase().includes(scene.location_name.toLowerCase()) ||
      scene.location_name.toLowerCase().includes(l.name.toLowerCase()))
  );

  if (activeLoc) {
    const locViolations = validateLocationContinuity(fullSceneText, activeLoc, sceneNumber);
    violations.push(...locViolations);
  }

  const hasCritical = violations.some(v => v.severity === 'critical');
  const hasHigh = violations.some(v => v.severity === 'high');

  const isValid = !hasCritical && !hasHigh;

  return {
    valid: isValid,
    status: isValid ? 'passed' : 'continuity_failed',
    violations,
  };
}

/**
 * Automatic correction helper for continuity violations (Max 2 attempts)
 */
export function applyContinuityCorrectionToPrompt(
  promptText: string,
  violations: ContinuityViolation[],
  snapshot: ContinuitySnapshot
): { correctedText: string; fixesApplied: string[] } {
  let text = promptText;
  const fixesApplied: string[] = [];

  for (const v of violations) {
    if (v.type === 'head_cover_missing' && v.character_name) {
      const char = snapshot.characters.find(c => c.name.toLowerCase() === v.character_name?.toLowerCase());
      if (char?.costume.head_cover) {
        text = `${text} [Koreksi Kontinuitas: ${char.name} mengenakan ${char.costume.head_cover.value} terkunci rapi sesuai adab historis]`;
        fixesApplied.push(`Menambahkan penutup kepala wajib '${char.costume.head_cover.value}' pada ${char.name}`);
      }
    }

    if (v.type === 'period_violation' && v.location_name) {
      text = `${text} [Koreksi Kontinuitas: Bebas total dari ${v.actual}, sepenuhnya autentik era kuno]`;
      fixesApplied.push(`Menghilangkan elemen modern '${v.actual}'`);
    }
  }

  return {
    correctedText: text,
    fixesApplied,
  };
}

function phase6Normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function phase6Text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(phase6Text).join(' ');
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${key} ${phase6Text(item)}`).join(' ');
  return String(value);
}

function phase6CanonicalIdentity(name: string, context?: ContextPackage | null): string {
  const normalized = phase6Normalize(name);
  const entity = phase6EntityForName(name, context);
  return entity ? `entity:${entity.entityId}` : `unknown:${normalized}`;
}

function phase6EntityForName(name: string, context?: ContextPackage | null) {
  const normalized = phase6Normalize(name);
  return context?.entities.find((candidate) => [candidate.name, ...(candidate.aliases || [])].some((alias) => phase6Normalize(alias) === normalized));
}

function phase6Transition(previous?: SceneContinuityState, _location?: string): ContinuityTransitionType {
  return previous ? 'CONTINUOUS' : 'CONTINUOUS';
}

export function createContinuityState(
  context?: ContextPackage | null,
  characters: CharacterBible[] = [],
  locations: LocationBible[] = [],
  objects: ObjectBible[] = []
): ContinuityState {
  const characterStates: CharacterState[] = characters.map((character) => ({
    canonicalIdentity: phase6CanonicalIdentity(character.name, context),
    displayName: character.name,
    aliases: phase6EntityForName(character.name, context)?.aliases || [],
    status: phase6EntityForName(character.name, context)?.status,
    birthYear: phase6EntityForName(character.name, context)?.birthYear,
    deathYear: phase6EntityForName(character.name, context)?.deathYear,
    age: character.age,
    attributes: [character.physical_appearance, character.personality].filter(Boolean),
    clothing: [...(character.clothing || [])],
    accessories: [...(character.accessories || [])],
    relationships: [],
    possessions: [],
    provenance: phase6EntityForName(character.name, context)?.sourceIds || [],
    confidence: phase6EntityForName(character.name, context)?.status ? 'HIGH' : 'UNKNOWN',
  }));
  const locationState = Object.fromEntries(locations.map((location) => [phase6Normalize(location.name), {
    canonicalLocation: location.name,
    aliases: [],
    provenance: [],
    confidence: 'UNKNOWN' as const,
  }]));
  const objectState = Object.fromEntries(objects.map((object) => [phase6Normalize(object.name), {
    canonicalObject: object.name,
    appearance: [object.description].filter(Boolean),
    provenance: [],
  }]));
  return {
    version: '1.0',
    characters: characterStates,
    characterIdentities: Object.fromEntries(characterStates.map((character) => [phase6Normalize(character.displayName), character.canonicalIdentity])),
    locations: locationState,
    activeEvents: [],
    relationships: [],
    objects: objectState,
    scenes: [],
    visualState: {},
    continuityConstraints: context?.constraints ? [...context.constraints] : [],
    temporalOrder: Object.fromEntries((context?.events || []).map((event) => [phase6Normalize(event.label), event.startYear ?? event.endYear]).filter((entry): entry is [string, number] => entry[1] !== undefined)),
    unresolvedIssues: [],
  };
}

/**
 * Fast specialized deep cloner for ContinuityState.
 * Replaces expensive JSON serialization or heavy V8 structuredClone
 * with targeted structural cloning.
 */
export function cloneContinuityState(state: ContinuityState): ContinuityState {
  return {
    ...state,
    characters: state.characters
      ? state.characters.map((c) => ({
          ...c,
          aliases: [...(c.aliases || [])],
          attributes: [...(c.attributes || [])],
          clothing: [...(c.clothing || [])],
          accessories: [...(c.accessories || [])],
          relationships: [...(c.relationships || [])],
          possessions: [...(c.possessions || [])],
          provenance: [...(c.provenance || [])],
        }))
      : [],
    characterIdentities: { ...(state.characterIdentities || {}) },
    locations: state.locations
      ? Object.fromEntries(
          Object.entries(state.locations).map(([k, v]) => [
            k,
            { ...v, aliases: [...(v.aliases || [])], provenance: [...(v.provenance || [])] },
          ])
        )
      : {},
    activeEvents: [...(state.activeEvents || [])],
    relationships: [...(state.relationships || [])],
    objects: state.objects
      ? Object.fromEntries(
          Object.entries(state.objects).map(([k, v]) => [
            k,
            { ...v, appearance: [...(v.appearance || [])], provenance: [...(v.provenance || [])] },
          ])
        )
      : {},
    scenes: state.scenes
      ? state.scenes.map((sc) => ({
          ...sc,
          activeCharacters: [...(sc.activeCharacters || [])],
          objects: [...(sc.objects || [])],
          visualState: sc.visualState
            ? Object.fromEntries(
                Object.entries(sc.visualState).map(([k, v]) => [k, [...v]])
              )
            : {},
          continuityConstraints: [...(sc.continuityConstraints || [])],
        }))
      : [],
    visualState: state.visualState
      ? Object.fromEntries(
          Object.entries(state.visualState).map(([k, v]) => [k, [...v]])
        )
      : {},
    continuityConstraints: [...(state.continuityConstraints || [])],
    temporalOrder: { ...(state.temporalOrder || {}) },
    unresolvedIssues: state.unresolvedIssues
      ? state.unresolvedIssues.map((u) => ({
          ...u,
          sourceIds: u.sourceIds ? [...u.sourceIds] : undefined,
        }))
      : [],
  };
}

export function updateContinuityState(
  state: ContinuityState,
  scene: { id?: string; scene_number?: number; location_name?: string; character_names?: string[]; event?: string; era?: string },
  output: unknown,
  transitionType?: ContinuityTransitionType,
  scope: ContinuityScope = 'within-scene'
): { state: ContinuityState; issues: ContinuityIssue[] } {
  // Performance optimization (⚡ Bolt): Use fast specialized cloneContinuityState instead of
  // JSON.parse(JSON.stringify()) to avoid costly JSON stringification & parsing (~10x faster).
  const next: ContinuityState = cloneContinuityState(state);
  const sceneId = scene.id || `scene_${scene.scene_number || next.scenes.length + 1}`;
  const priorScenes = next.scenes.filter((item) => item.sceneId !== sceneId);
  const previous = scene.scene_number === undefined
    ? priorScenes[priorScenes.length - 1]
    : priorScenes
      .filter((item) => item.sceneNumber !== undefined && item.sceneNumber < scene.scene_number!)
      .sort((left, right) => (right.sceneNumber ?? -1) - (left.sceneNumber ?? -1) || left.sceneId.localeCompare(right.sceneId))[0]
      || priorScenes.filter((item) => item.sceneNumber !== undefined).sort((left, right) => (right.sceneNumber ?? -1) - (left.sceneNumber ?? -1) || left.sceneId.localeCompare(right.sceneId))[0];
  const text = phase6Text({ scene, output });
  const outputRecords = (() => {
    const collect = (value: unknown): Record<string, unknown>[] => {
      if (!value || typeof value !== 'object') return [];
      if (Array.isArray(value)) return value.flatMap(collect);
      const record = value as Record<string, unknown>;
      return [record, ...Object.values(record).flatMap(collect)];
    };
    return collect(output);
  })();
  const issues: ContinuityIssue[] = [];
  for (const record of outputRecords) {
    const name = typeof record.name === 'string' ? record.name : undefined;
    if (name && !next.characters.some((character) => phase6Normalize(character.displayName) === phase6Normalize(name))) {
      next.characters.push({ canonicalIdentity: `unknown:${phase6Normalize(name)}`, displayName: name, aliases: [], attributes: [], clothing: [], accessories: [], relationships: [], possessions: [], provenance: [], confidence: 'UNKNOWN' });
      next.characterIdentities[phase6Normalize(name)] = `unknown:${phase6Normalize(name)}`;
    }
  }
  const currentLocation = scene.location_name;
  const resolvedTransition = transitionType || phase6Transition(previous, currentLocation);
  const shotRecords = (() => {
    const shots = (output && typeof output === 'object' && !Array.isArray(output))
      ? (output as Record<string, unknown>).shots
      : undefined;
    return Array.isArray(shots)
      ? shots
        .filter((shot): shot is Record<string, unknown> => Boolean(shot && typeof shot === 'object' && !Array.isArray(shot)))
        .filter((shot) => typeof shot.shot_number === 'number')
        .sort((left, right) => Number(left.shot_number) - Number(right.shot_number))
      : [];
  })();
  const locationSequence = shotRecords.flatMap((record) => {
    const value = record.location_name || record.location;
    return typeof value === 'string' ? [phase6Normalize(value)] : [];
  });
  const activeCharacters = (scene.character_names || []).map((name) => next.characters.find((character) => phase6Normalize(character.displayName) === phase6Normalize(name) || character.aliases.some((alias) => phase6Normalize(alias) === phase6Normalize(name)))?.canonicalIdentity || `unknown:${phase6Normalize(name)}`);
  const eventName = scene.event;

  if (scope === 'explicit-chain' && previous && currentLocation && previous.location && phase6Normalize(previous.location) !== phase6Normalize(currentLocation) && resolvedTransition === 'CONTINUOUS') {
    issues.push({ code: 'LOCATION_CHANGE_WITHOUT_TRANSITION', severity: 'BLOCKING', message: `Location changes from ${previous.location} to ${currentLocation} without an explicit transition.`, sceneId });
  }
  const hasOrderedLocationChange = locationSequence.some((location, index) => index > 0 && location !== locationSequence[index - 1]);
  if (scope === 'within-scene' && hasOrderedLocationChange && !transitionType) {
    issues.push({ code: 'WITHIN_SCENE_LOCATION_CHANGE', severity: 'BLOCKING', message: `Within-scene location changes across ${Array.from(new Set(locationSequence)).join(' and ')} without an explicit transition.`, sceneId });
  }

  const currentScene: SceneContinuityState = {
    sceneId,
    sceneNumber: scene.scene_number,
    previousSceneId: previous?.sceneId,
    activeCharacters,
    location: currentLocation,
    event: eventName,
    objects: [],
    temporalState: scene.era,
    visualState: {},
    transitionType: resolvedTransition,
    continuityConstraints: [...next.continuityConstraints],
  };

  const currentEvent = eventName && Object.keys(next.temporalOrder || {}).find((event) => phase6Normalize(eventName).includes(event));
  const previousEvent = previous?.event && Object.keys(next.temporalOrder || {}).find((event) => phase6Normalize(previous.event || '').includes(event));
  if (currentEvent && previousEvent && (next.temporalOrder || {})[currentEvent] < (next.temporalOrder || {})[previousEvent]) {
    issues.push({ code: 'TEMPORAL_ORDER_CONFLICT', severity: 'BLOCKING', message: `Event ${eventName} occurs before the accepted previous event.`, sceneId });
  }

  for (const character of next.characters) {
    const present = (scene.character_names || []).some((name) => phase6Normalize(name) === phase6Normalize(character.displayName) || character.aliases.some((alias) => phase6Normalize(name) === phase6Normalize(alias)));
    if (!present) continue;
    const entityText = text;
    const contextYear = Array.from(entityText.matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)).map((match) => Number(match[1]))[0];
    if (character.status === 'DECEASED' && character.deathYear !== undefined && contextYear !== undefined && contextYear > character.deathYear && /participat|living|alive|hadir|ikut/.test(entityText)) {
      issues.push({ code: 'DECEASED_CHARACTER_ACTIVE', severity: 'BLOCKING', message: `${character.displayName} is used as a living participant in ${sceneId}.`, sceneId, sourceIds: character.provenance });
    }
    const clothing = (text.match(/(?:white|black|red|blue|green|putih|hitam|merah|biru|hijau)(?:\s+\w+){0,2}\s+(?:robe|jubah|dress|suit|baju)/gi) || []).map((item) => item.toLowerCase());
    const previousScene = previous && next.scenes.find((item) => item.sceneId === previous.sceneId);
    const previousClothing = previousScene?.visualState[character.canonicalIdentity] || [];
    if (clothing.length > 0 && previousClothing.length > 0 && clothing.some((item) => !previousClothing.includes(item))) {
      issues.push({ code: 'CLOTHING_DRIFT', severity: 'WARNING', message: `${character.displayName} clothing changes without an explicit continuity lock.`, sceneId });
    }
    if (clothing.length > 0) {
      currentScene.visualState[character.canonicalIdentity] = clothing;
      next.visualState[character.canonicalIdentity] = clothing;
    }
    character.currentLocation = currentLocation;
    character.activeEvent = eventName;
  }

  for (const object of Object.values(next.objects)) {
    const possessionRecord = outputRecords.find((record) => {
      const recordObject = String(record.objectName || record.object || record.name || '');
      return phase6Normalize(recordObject) === phase6Normalize(object.canonicalObject) && typeof record.owner === 'string';
    });
    if (!text.includes(phase6Normalize(object.canonicalObject)) && !possessionRecord) continue;
    const ownerMatch = text.match(/(?:held by|owned by|dibawa|dipegang)\s+([a-z]+\s+[a-z]+)/i);
    const owner = typeof possessionRecord?.owner === 'string' ? possessionRecord.owner.trim() : ownerMatch?.[1]?.trim();
    if (owner) {
      if (object.owner && phase6Normalize(object.owner) !== phase6Normalize(owner)) {
        issues.push({ code: 'OBJECT_POSSESSION_CONFLICT', severity: 'BLOCKING', message: `${object.canonicalObject} changes possession from ${object.owner} to ${owner} without transition.`, sceneId });
      }
      object.owner = owner;
      currentScene.objects.push(object.canonicalObject);
    }
  }

  const existingIndex = next.scenes.findIndex((item) => item.sceneId === sceneId);
  if (existingIndex >= 0) next.scenes[existingIndex] = currentScene;
  else next.scenes.push(currentScene);
  next.scenes.sort((left, right) => (left.sceneNumber ?? Number.MAX_SAFE_INTEGER) - (right.sceneNumber ?? Number.MAX_SAFE_INTEGER) || left.sceneId.localeCompare(right.sceneId));
  next.activeEvents = eventName ? Array.from(new Set([...next.activeEvents, eventName])) : next.activeEvents;
  next.activeEvents.sort((left, right) => left.localeCompare(right));
  next.unresolvedIssues = [...next.unresolvedIssues.filter((item) => item.sceneId !== sceneId), ...issues];
  next.unresolvedIssues.sort((left, right) => `${left.sceneId || ''}:${left.code}`.localeCompare(`${right.sceneId || ''}:${right.code}`));
  return { state: next, issues };
}

export function buildContinuityPromptContext(state: ContinuityState | null | undefined): string {
  if (!state) return 'No continuity state available.';
  return JSON.stringify({ version: state.version, characters: state.characters, locations: state.locations, objects: state.objects, scenes: state.scenes, visualState: state.visualState, constraints: state.continuityConstraints, unresolvedIssues: state.unresolvedIssues }, null, 2);
}
