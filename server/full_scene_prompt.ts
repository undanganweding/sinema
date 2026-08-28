import {
  Scene,
  Shot,
  ContinuitySnapshot,
  CharacterContinuityState,
  LocationContinuityState,
} from '../src/types';
import { buildContinuityInstruction } from './continuity_engine';
import { CINEMATIC_GRAMMAR_GUIDELINES } from './story_architecture';

/**
 * Builds a coherent, single continuous Full Scene Prompt representing the entire fixed-duration scene.
 * Fully synchronized with scene duration, character continuity, costume locks, location identity, and shot breakdown.
 */
export function buildFullScenePrompt(
  scene: Scene,
  shots: Shot[],
  snapshot?: ContinuitySnapshot | null
): string {
  const durationSec = scene.duration_sec || 10;
  const tone = scene.scene_tone;
  const toneDesc = tone ? `[Tone: ${tone.atmosphere.toUpperCase()} | Intensitas: ${tone.intensity}/100 | Tempo: ${tone.pacing}]` : '';

  const activeCharNames = scene.character_names || [];
  const locationName = scene.location_name || 'Latar Historis';

  // Build shot-by-shot timeline overview within the fixed duration
  const shotSubdivisions = shots.map((s, idx) => {
    const timeRange = `${String(Math.floor(s.start_time_sec)).padStart(2, '0')}-${String(Math.floor(s.end_time_sec)).padStart(2, '0')}s`;
    const mode = s.narrative_mode ? `[Mode: ${s.narrative_mode}] ` : '';
    const grammar = s.narrative_mode ? `(${CINEMATIC_GRAMMAR_GUIDELINES[s.narrative_mode]?.recommendedFraming[0] || 'Cinematic Framing'})` : '';
    const dialogueText = s.dialogue && s.dialogue.length > 0 ? ` Dialog: "${s.dialogue.map(d => d.line).join(' ')}"` : '';
    return `[${timeRange}] Shot #${s.shot_number} ${mode}${grammar}: ${s.event_detail} ${dialogueText}`.trim();
  }).join('\n');

  // Continuity lock header
  let continuityLockSection = '';
  if (snapshot) {
    continuityLockSection = buildContinuityInstruction(snapshot, {
      character_names: scene.character_names,
      location_name: scene.location_name,
    });
  }

  const promptSections = [
    `=== PROMPT LENGKAP SATU ADEGAN UTUH (FULL SCENE PRODUCTION PROMPT — ${durationSec} DETIK) ===`,
    `Judul Adegan: Adegan #${scene.scene_number} — ${scene.title}`,
    `Durasi Tetap: Tepat ${durationSec} detik continuous`,
    `Tujuan Narasi & Emosional: ${scene.story_purpose} — ${scene.emotional_objective}`,
    `Latar & Waktu: ${locationName} (${scene.time_of_day})`,
    `Tokoh Utama: ${activeCharNames.join(', ') || 'Karakter'}`,
    toneDesc,
    '',
    continuityLockSection,
    '',
    `--- DESKRIPSI VISUAL & ALUR KONTINU (00-${String(durationSec).padStart(2, '0')} DETIK) ---`,
    `${scene.event}. Peristiwa dimulai dengan pengenalan atmosfer dan posisi tokoh, berkembang secara gradual sesuai durasi ${durationSec} detik tanpa lompatan visual yang tidak logis.`,
    '',
    `--- RINCIAN TIMELINE SUB-DIVISI SHOT ---`,
    shotSubdivisions || `[00-${String(durationSec).padStart(2, '0')}s] Seluruh rangkaian visual adegan berdurasi ${durationSec} detik.`,
    '',
    `--- SPESIFIKASI KAMERA & KUALITAS SINEMATIK ---`,
    `- Format: 35mm Anamorphic Lens, 4K High Dynamic Range, Realistic Cinematic Depth of Field`,
    `- Pencahayaan: Pencahayaan alami era historis, akurat waktu ${scene.time_of_day}, warm color grading, tekstur realistis`,
    `- Audio & Atmosfer: ${shots.map(s => s.audio_note).filter(Boolean).join('; ') || 'Atmosfer natural lingkungan historis'}`,
    `========================================================================`,
  ];

  return promptSections.filter(Boolean).join('\n');
}
