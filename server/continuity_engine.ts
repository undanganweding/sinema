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
  snapshot: ContinuitySnapshot
): ContinuityValidationResult {
  const violations: ContinuityViolation[] = [];
  const sceneNumber = scene.scene_number;

  // 1. Validate all scene characters
  const activeCharNames = (scene.character_names || []).map(n => n.toLowerCase());
  const activeChars = snapshot.characters.filter(c =>
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
  const activeLoc = snapshot.locations.find(l =>
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
