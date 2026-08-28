import {
  Project,
  Scene,
  SceneTone,
  TonePresetName,
  PacingType,
  AtmosphereType,
  NarrativeStyleConfig,
  GlobalConstraints,
} from '../src/types';

export const DEFAULT_GLOBAL_CONSTRAINTS: GlobalConstraints = {
  religious_adab: 'strict',
  historical_fidelity: 'strict',
  dignity: 'strict',
  clarity: 'high',
  cinematic_quality: 'high',
};

export const TONE_PRESETS: Record<TonePresetName, SceneTone> = {
  SOLEMN: {
    intensity: 20,
    emotional_weight: 70,
    pacing: 'slow',
    atmosphere: 'solemn',
    dramatic_tension: 20,
    preset: 'SOLEMN',
    is_ai_recommended: false,
  },
  CONTEMPLATIVE: {
    intensity: 25,
    emotional_weight: 65,
    pacing: 'slow',
    atmosphere: 'contemplative',
    dramatic_tension: 25,
    preset: 'CONTEMPLATIVE',
    is_ai_recommended: false,
  },
  MYSTERIOUS: {
    intensity: 45,
    emotional_weight: 55,
    pacing: 'medium',
    atmosphere: 'mysterious',
    dramatic_tension: 60,
    preset: 'MYSTERIOUS',
    is_ai_recommended: false,
  },
  TENSE: {
    intensity: 70,
    emotional_weight: 55,
    pacing: 'fast',
    atmosphere: 'tense',
    dramatic_tension: 85,
    preset: 'TENSE',
    is_ai_recommended: false,
  },
  ACTION: {
    intensity: 90,
    emotional_weight: 65,
    pacing: 'fast',
    atmosphere: 'action',
    dramatic_tension: 95,
    preset: 'ACTION',
    is_ai_recommended: false,
  },
  TRAGIC: {
    intensity: 55,
    emotional_weight: 95,
    pacing: 'slow',
    atmosphere: 'tragic',
    dramatic_tension: 70,
    preset: 'TRAGIC',
    is_ai_recommended: false,
  },
  TRIUMPHANT: {
    intensity: 75,
    emotional_weight: 80,
    pacing: 'medium',
    atmosphere: 'triumphant',
    dramatic_tension: 70,
    preset: 'TRIUMPHANT',
    is_ai_recommended: false,
  },
  CUSTOM: {
    intensity: 50,
    emotional_weight: 50,
    pacing: 'medium',
    atmosphere: 'dramatic',
    dramatic_tension: 50,
    preset: 'CUSTOM',
    is_ai_recommended: false,
  },
};

export const TONE_PRESET_NAMES: TonePresetName[] = [
  'SOLEMN',
  'CONTEMPLATIVE',
  'MYSTERIOUS',
  'TENSE',
  'ACTION',
  'TRAGIC',
  'TRIUMPHANT',
  'CUSTOM',
];

export const TONE_PRESET_DICTIONARY = TONE_PRESETS;

export const DEFAULT_NARRATIVE_STYLE_CONFIG: NarrativeStyleConfig = {
  language: 'id-ID',
  narrative_mode: 'cinematic_sirah',
  global_constraints: DEFAULT_GLOBAL_CONSTRAINTS,
  default_scene_tone: {
    intensity: 50,
    emotional_weight: 50,
    pacing: 'medium',
    atmosphere: 'dramatic',
    dramatic_tension: 50,
  },
};

export const GLOBAL_NARRATIVE_DOCTRINE_ID = `DOKTRIN GLOBAL NARRATIVE VOICE & ADAB:
1. Gunakan bahasa Indonesia yang formal namun natural, sinematik, jelas, bermartabat, dan sesuai konteks sejarah.
2. Narasi harus terasa seperti kisah sirah yang disampaikan dengan penghormatan mendalam terhadap tokoh dan peristiwa.
3. Gunakan bahasa yang indah secara terkendali. Hindari bahasa berlebihan, slang, umpatan, humor yang tidak relevan, clickbait, atau dramatisasi murahan.
4. JANGAN membuat kisah terasa seperti fairy tale, Cinderella, dongeng anak-anak, superhero story, novel remaja, atau storytelling hiburan populer.
5. JANGAN mengubah fakta sejarah demi membuat cerita lebih dramatis. Jangan menciptakan dialog sejarah yang tidak memiliki dasar sumber dan kemudian menyajikannya sebagai perkataan nyata.
6. Ketika Rasulullah ﷺ disebut, gunakan bahasa yang penuh adab, penghormatan, dan martabat luhur (hindari penggambaran visual langsung yang melanggar adab/konsensus).
7. Intensitas, pacing, emosi, dan atmosfer harus mengikuti konteks peristiwa pada scene:
   - Scene yang damai boleh tenang dan khidmat.
   - Scene yang menegangkan boleh intens dan mencekam.
   - Scene peperangan boleh keras, cepat, dan penuh energi dramatis.
   - Scene kehilangan boleh emosional, hening, dan reflektif.
   - Scene kemenangan boleh megah dan berwibawa.
8. PERUBAHAN INTENSITAS TIDAK BOLEH MENGHILANGKAN ADAB, MARTABAT, ATAU KETEPATAN SEJARAH.`;

export const GLOBAL_NARRATIVE_DOCTRINE_EN = `GLOBAL NARRATIVE VOICE & ADAB DOCTRINE:
1. Use formal yet natural, cinematic, clear, dignified, and historically authentic language.
2. The narrative must convey the weight of historical and sacred events with utmost reverence for figures and occurrences.
3. Use restrained, evocative cinematic prose. Avoid colloquialisms, slang, profanity, irrelevant humor, clickbait, or cheap sensationalism.
4. Never frame historical accounts like a fairy tale, fable, superhero fantasy, young adult novel, or cheap pop entertainment.
5. Never fabricate or distort historical facts or invent unattested historical dialogue to artificially inflate drama.
6. When the Prophet Muhammad ﷺ or sacred figures are referenced, maintain the highest standards of adab, respect, and dignity.
7. Intensity, pacing, emotional gravity, and atmosphere must adapt to the scene context:
   - Peaceful scenes may be serene and solemn.
   - Tense scenes may be urgent and suspenseful.
   - Battle scenes may be dynamic, fast-paced, and forceful.
   - Scenes of loss must be poignant, quiet, and reflective.
   - Victory scenes must be grand, majestic, and dignified.
8. ANY ESCALATION IN DRAMATIC INTENSITY MUST NEVER COMPROMISE ADAB, DIGNITY, OR HISTORICAL TRUTH.`;

/**
 * Recommends an optimal SceneTone based on the scene's semantic context.
 */
export function recommendSceneTone(scene: {
  title?: string;
  event?: string;
  story_purpose?: string;
  emotional_objective?: string;
  narrative_function?: string;
}): SceneTone {
  const combined = `${scene.title || ''} ${scene.event || ''} ${scene.story_purpose || ''} ${scene.emotional_objective || ''} ${scene.narrative_function || ''}`.toLowerCase();

  // 1. Battle / War / Action
  if (
    combined.includes('perang') ||
    combined.includes('battle') ||
    combined.includes('serangan') ||
    combined.includes('attack') ||
    combined.includes('tempur') ||
    combined.includes('pasukan') ||
    combined.includes('pedang') ||
    combined.includes('sword') ||
    combined.includes('benteng') ||
    combined.includes('pengepungan') ||
    combined.includes('badr') ||
    combined.includes('uhud') ||
    combined.includes('khandaq') ||
    combined.includes('hunain') ||
    combined.includes('mutah') ||
    combined.includes('tabuk') ||
    combined.includes('action')
  ) {
    return { ...TONE_PRESETS.ACTION, is_ai_recommended: true };
  }

  // 2. Tense / Threat / Hijrah / Ambush / Pursuit
  if (
    combined.includes('hijrah') ||
    combined.includes('pengejaran') ||
    combined.includes('ancaman') ||
    combined.includes('threat') ||
    combined.includes('konspirasi') ||
    combined.includes('pembunuhan') ||
    combined.includes('darun nadwah') ||
    combined.includes('jebakan') ||
    combined.includes('mencekam') ||
    combined.includes('tense') ||
    combined.includes('bahaya') ||
    combined.includes('pelarian') ||
    combined.includes('terkepung') ||
    combined.includes('intai')
  ) {
    return { ...TONE_PRESETS.TENSE, is_ai_recommended: true };
  }

  // 3. Loss / Grief / Demise / Martyrdom
  if (
    combined.includes('wafat') ||
    combined.includes('demise') ||
    combined.includes('meninggal') ||
    combined.includes('gugur') ||
    combined.includes('syahid') ||
    combined.includes('duka') ||
    combined.includes('grief') ||
    combined.includes('tangis') ||
    combined.includes('kehilangan') ||
    combined.includes('perpisahan') ||
    combined.includes('wada') ||
    combined.includes('tragis') ||
    combined.includes('khadijah') ||
    combined.includes('abu thalib') ||
    combined.includes('hamzah') ||
    combined.includes('tahun duka')
  ) {
    return { ...TONE_PRESETS.TRAGIC, is_ai_recommended: true };
  }

  // 4. Victory / Triumph / Fathul Makkah / Grand Treaty
  if (
    combined.includes('kemenangan') ||
    combined.includes('victory') ||
    combined.includes('triumph') ||
    combined.includes('fathul makkah') ||
    combined.includes('pembebasan') ||
    combined.includes('baiat') ||
    combined.includes('kejayaan') ||
    combined.includes('keberhasilan') ||
    combined.includes('hudaybiyah') ||
    combined.includes('megah')
  ) {
    return { ...TONE_PRESETS.TRIUMPHANT, is_ai_recommended: true };
  }

  // 5. Mystery / Revelation / Cave Hira / Vision
  if (
    combined.includes('wahyu') ||
    combined.includes('revelation') ||
    combined.includes('gua hira') ||
    combined.includes('hira') ||
    combined.includes('misteri') ||
    combined.includes('malaikat') ||
    combined.includes('jibril') ||
    combined.includes('isra') ||
    combined.includes('miraj') ||
    combined.includes('malam') ||
    combined.includes('tanda-tanda') ||
    combined.includes('penglihatan')
  ) {
    return { ...TONE_PRESETS.MYSTERIOUS, is_ai_recommended: true };
  }

  // 6. Birth / Childhood / Early Dawn / Serenity
  if (
    combined.includes('lahir') ||
    combined.includes('birth') ||
    combined.includes('maulid') ||
    combined.includes('fajar') ||
    combined.includes('damai') ||
    combined.includes('peace') ||
    combined.includes('madinah') ||
    combined.includes('piagam') ||
    combined.includes('persaudaraan') ||
    combined.includes('solemn') ||
    combined.includes('khidmat')
  ) {
    return { ...TONE_PRESETS.SOLEMN, is_ai_recommended: true };
  }

  // 7. Contemplative default for reflective dialogues / journey
  return { ...TONE_PRESETS.CONTEMPLATIVE, is_ai_recommended: true };
}

/**
 * Resolves a complete SceneTone for a given scene, respecting explicit values or AI recommendation.
 */
export function resolveSceneTone(scene: Scene): SceneTone {
  if (scene.scene_tone && typeof scene.scene_tone.intensity === 'number') {
    return scene.scene_tone;
  }
  return recommendSceneTone(scene);
}

/**
 * Builds the Global Narrative Voice instructions for prompt injection.
 */
export function buildNarrativeVoiceInstruction(
  project?: Project | null,
  language: 'id' | 'en' = 'id'
): string {
  const isIndo = (project?.prompt_language || language) === 'id';
  return isIndo ? GLOBAL_NARRATIVE_DOCTRINE_ID : GLOBAL_NARRATIVE_DOCTRINE_EN;
}

/**
 * Builds the Dynamic Scene Tone instructions for a specific scene.
 */
export function buildSceneToneInstruction(
  scene: Scene,
  customTone?: SceneTone,
  language: 'id' | 'en' = 'id'
): string {
  const tone = customTone || resolveSceneTone(scene);
  const isIndo = language === 'id';

  if (isIndo) {
    let toneGuidance = '';
    if (tone.pacing === 'fast' || tone.intensity >= 70) {
      toneGuidance = `Pacing CEPAT & Intensitas TINGGI (${tone.intensity}/100, Tension: ${tone.dramatic_tension}/100, Atmosfer: ${tone.atmosphere}).
- Tampilkan momentum dramatis yang bergejolak, keputusan cepat, pergerakan dinamis, dan ketegangan nyata.
- Pada adegan perang/aksi: gambarkan formasi barisan, deru langkah, benturan taktis, dan hembusan debu gurun dengan ketajaman sinematik tinggi.
- TETAP PATUHI ADAB: JANGAN gunakan gore berlebihan, glorifikasi kekerasan membabi buta, atau gaya bahasa pahlawan komik fiksi.`;
    } else if (tone.pacing === 'slow' || tone.emotional_weight >= 70) {
      toneGuidance = `Pacing LAMBAT & Bobot Emosional MENDALAM (${tone.emotional_weight}/100, Intensitas: ${tone.intensity}/100, Atmosfer: ${tone.atmosphere}).
- Berikan ruang jeda reflektif, suasana hening yang sarat makna, resonansi lingkungan, dan ekspresi batin yang terkendali.
- Pada adegan duka/wafat: hadirkan keheningan mendalam, tatapan penuh arti, dan rasa kehilangan yang terhormat tanpa jeritan histeris melodramatis.`;
    } else {
      toneGuidance = `Pacing SEDANG & Keseimbangan Dramatis (${tone.intensity}/100, Bobot Emosional: ${tone.emotional_weight}/100, Atmosfer: ${tone.atmosphere}).
- Hadirkan alur penceritaan yang mengalir alami, artikulasi dialog/peristiwa yang berwibawa, dan atmosfer lingkungan yang hidup.`;
    }

    return `=== DYNAMIC SCENE TONE INSTRUCTION ===
Parameter Tone Scene #${scene.scene_number} ("${scene.title}"):
- Intensity: ${tone.intensity}/100
- Emotional Weight: ${tone.emotional_weight}/100
- Dramatic Tension: ${tone.dramatic_tension}/100
- Pacing: ${tone.pacing.toUpperCase()}
- Atmosphere: ${tone.atmosphere.toUpperCase()}
- Preset Basis: ${tone.preset || 'CUSTOM'}

Pedoman Khusus Tone:
${toneGuidance}
======================================`;
  }

  let toneGuidanceEn = '';
  if (tone.pacing === 'fast' || tone.intensity >= 70) {
    toneGuidanceEn = `FAST Pacing & HIGH Intensity (${tone.intensity}/100, Tension: ${tone.dramatic_tension}/100, Atmosphere: ${tone.atmosphere}).
- Convey urgent dramatic momentum, decisive swift actions, dynamic blocking, and authentic tension.
- In battle/action scenes: detail tactical troop movements, charging ranks, and dust storms with sharp cinematic precision.
- STRICT ADAB ENFORCED: NO gratuitous gore, no violence glorification, and no cartoonish superhero tropes.`;
  } else if (tone.pacing === 'slow' || tone.emotional_weight >= 70) {
    toneGuidanceEn = `SLOW Pacing & DEEP Emotional Weight (${tone.emotional_weight}/100, Intensity: ${tone.intensity}/100, Atmosphere: ${tone.atmosphere}).
- Allow reflective pauses, quiet atmospheric resonance, and dignified emotional restraint.
- In scenes of grief/loss: emphasize profound silence, meaningful gazes, and noble solemnity without histrionic screaming.`;
  } else {
    toneGuidanceEn = `BALANCED Pacing & Dramatic Equilibrium (${tone.intensity}/100, Emotional Weight: ${tone.emotional_weight}/100, Atmosphere: ${tone.atmosphere}).
- Ensure smooth narrative progression, dignified historical weight, and rich environmental grounding.`;
  }

  return `=== DYNAMIC SCENE TONE INSTRUCTION ===
Scene Tone Parameters #${scene.scene_number} ("${scene.title}"):
- Intensity: ${tone.intensity}/100
- Emotional Weight: ${tone.emotional_weight}/100
- Dramatic Tension: ${tone.dramatic_tension}/100
- Pacing: ${tone.pacing.toUpperCase()}
- Atmosphere: ${tone.atmosphere.toUpperCase()}
- Preset: ${tone.preset || 'CUSTOM'}

Tone Guidance:
${toneGuidanceEn}
======================================`;
}

export interface NarrativeValidationResult {
  valid: boolean;
  violations: string[];
  correctivePrompt?: string;
}

// Prohibited terms that violate historical adab, dignity, or narrative authenticity
const BANNED_SLANG_OR_CASUAL_PATTERNS = [
  /\b(baper|alay|wkwk|kepo|guys|bro|sis|cuy|anjir|gila\s*sih|mantul|auto\s*menang|auto\s*viral|kocak|cinderella|ibu\s*peri|tongkat\s*sihir|superhero|superpower|villain)\b/i,
  /\b(pada\s*suatu\s*hari\s*di\s*negeri\s*dongeng|once\s*upon\s*a\s*time\s*in\s*a\s*magical\s*land)\b/i,
  /\b(bikin\s*shock|plot\s*twist\s*gila|kamu\s*tidak\s*akan\s*percaya|kejadian\s*mencengangkan)\b/i,
];

/**
 * Validates text output to ensure compliance with Global Narrative Voice & Adab.
 * Does NOT suppress valid high-intensity action language (e.g. medan perang, pedang, debu, kepungan).
 */
export function validateNarrativeStyle(
  output: string,
  language: 'id' | 'en' = 'id'
): NarrativeValidationResult {
  if (!output || typeof output !== 'string') {
    return { valid: true, violations: [] };
  }

  const violations: string[] = [];

  for (const pattern of BANNED_SLANG_OR_CASUAL_PATTERNS) {
    const match = output.match(pattern);
    if (match) {
      violations.push(`Terdeteksi istilah atau gaya bahasa tidak bermartabat/terlarang: "${match[0]}"`);
    }
  }

  if (violations.length > 0) {
    const isIndo = language === 'id';
    const correctivePrompt = isIndo
      ? `PERBAIKAN WAJIB ADAB & NARRATIVE VOICE:
Teks yang dihasilkan mengandung elemen gaya bahasa yang melanggar doktrin adab & martabat sirah:
${violations.map((v) => `- ${v}`).join('\n')}

Instruksi Perbaikan:
1. Ganti semua istilah slang/dongeng/superhero/sensasional dengan bahasa Indonesia formal, bermartabat, dan sinematik.
2. Pertahankan fakta sejarah dan bobot dramatis tanpa mengubah konteks adegan.
3. Tetap sesuaikan intensitas, pacing, dan atmosfer adegan.`
      : `MANDATORY NARRATIVE VOICE & ADAB CORRECTION:
The generated text violates sacred historical dignity and narrative voice principles:
${violations.map((v) => `- ${v}`).join('\n')}

Correction Guidelines:
1. Replace all slang, fairytale, superhero, or sensational tropes with dignified, cinematic prose.
2. Preserve authentic historical fidelity and emotional tone.`;

    return {
      valid: false,
      violations,
      correctivePrompt,
    };
  }

  return {
    valid: true,
    violations: [],
  };
}
