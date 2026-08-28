import { db } from '../db';
import { CombinedScenePrompt } from '../../src/types';
import { resolveSceneTone } from '../narrative_tone';

export function assembleCombinedScenePrompt(
  sceneId: string,
  platform: 'veo' | 'gemini_omni' | 'seedance'
): CombinedScenePrompt {
  const scene = db.getScene(sceneId);
  if (!scene) {
    return {
      status: 'incomplete',
      readyShots: 0,
      totalShots: 0,
      platform,
      message: 'Scene tidak ditemukan',
    };
  }

  const projectId = scene.project_id;
  const foundation = db.getProjectFoundation(projectId);
  const locations = db.getLocations(projectId);
  const relevantLocation = locations.find((l) =>
    l.name.toLowerCase().includes(scene.location_name.toLowerCase())
  );

  const shots = db.getShotsByScene(sceneId);
  const totalShots = shots.length;

  if (totalShots === 0) {
    return {
      status: 'incomplete',
      readyShots: 0,
      totalShots: 0,
      platform,
      message: 'Belum ada shot yang di-breakdown untuk scene ini',
    };
  }

  const allVideoPrompts = db.getVideoPromptsByScene(sceneId);
  const readyPromptsByShotId = new Map<string, any>();
  let failedShotsCount = 0;

  for (const vp of allVideoPrompts) {
    if (vp.target_platform === platform) {
      if (vp.status === 'video_prompt_failed') {
        failedShotsCount++;
      } else if (
        vp.timeline_json &&
        (vp.timeline_json.prompt || vp.timeline_json.global_style)
      ) {
        readyPromptsByShotId.set(vp.shot_id, vp);
      }
    }
  }

  const readyShots = shots.filter((s) => s.id && readyPromptsByShotId.has(s.id)).length;

  if (readyShots < totalShots) {
    const failedNotice = failedShotsCount > 0 ? ` (${failedShotsCount} shot gagal - silakan generate ulang)` : '';
    return {
      status: 'incomplete',
      readyShots,
      totalShots,
      platform,
      message: `Belum lengkap — ${readyShots} dari ${totalShots} shot siap${failedNotice}`,
    };
  }

  // Assemble the Header
  const era = foundation?.era || 'Historical Era';
  const visualTone = foundation?.visual_tone || 'Cinematic Atmospheric';
  const locationArchitecture = relevantLocation?.architecture || 'Authentic historical architecture';
  const lightingStyle = relevantLocation?.lighting_style || 'Volumetric cinematic lighting';

  const platformTitle =
    platform === 'veo'
      ? 'GOOGLE VEO'
      : platform === 'gemini_omni'
      ? 'GEMINI OMNI'
      : 'FORMAT SEEDANCE';

  const sceneTone = resolveSceneTone(scene);
  const toneSummary = `Preset=${sceneTone.preset || 'KUSTOM'} | Atmosfer=${sceneTone.atmosphere} | Tempo/Pacing=${sceneTone.pacing} | Intensitas=${sceneTone.intensity}/100 | Ketegangan=${sceneTone.dramatic_tension}/100`;

  const header = `=== PROMPT MASTER ADEGAN [${platformTitle}] ===
ADEGAN #${scene.scene_number}: ${scene.title.toUpperCase()}
DURASI TOTAL ADEGAN: ${scene.duration_sec} DETIK | JUMLAH SHOT: ${totalShots}
NUANSA / TONE ADEGAN: ${toneSummary}
LOKASI & ERA: ${scene.location_name} (${era}) | WAKTU: ${scene.time_of_day}
ARSITEKTUR & TATA SET: ${locationArchitecture}
TATA CAHAYA & SUASANA: ${lightingStyle} | ${visualTone}
RASIO ASPEK: 16:9 | GAYA SINEMATIK: Film Seluloid 35mm Panavision Sinematik
=====================================================`;

  const shotBlocks: {
    shot_number: number;
    time_range: string;
    event_summary: string;
    body: string;
  }[] = [];

  for (const shot of shots) {
    const vp = readyPromptsByShotId.get(shot.id!)!;
    const tj = vp.timeline_json || {};

    const startPadded = String(Math.floor(shot.start_time_sec)).padStart(2, '0');
    const endPadded = String(Math.floor(shot.end_time_sec)).padStart(2, '0');
    const timeRange = `${startPadded}-${endPadded} DETIK`;
    const eventSummary = shot.event_detail.length > 60
      ? shot.event_detail.substring(0, 57) + '...'
      : shot.event_detail;

    let body = '';

    if (platform === 'veo' || platform === 'gemini_omni') {
      body += `[DESKRIPSI PROMPT VISUAL]:\n${tj.prompt || shot.event_detail}\n\n`;
      body += `[GERAKAN & LENSA KAMERA (Sub-Timestamp)]:\n${tj.camera || shot.camera_note}\n\n`;
      if (tj.dialog && tj.dialog.trim()) {
        body += `[DIALOG / SUARA TOKOH]:\n${tj.dialog}\n\n`;
      }
      if (tj.sfx_ambient && tj.sfx_ambient.trim()) {
        body += `[EFEK SUARA / SFX & AMBIENCE LATAR]:\n${tj.sfx_ambient}\n\n`;
      }
      body += `[DURASI KLIP SHOT]: ${shot.duration_sec} detik\n`;
      if (tj.reference_image) {
        body += `[GAMBAR ACUAN / REFERENCE IMAGE]: Master Frame Adegan\n`;
      }
      if (platform === 'gemini_omni' && tj.follow_up_edit_instructions) {
        body += `[INSTRUKSI PENYUNTINGAN LANJUTAN]:\n${tj.follow_up_edit_instructions}\n\n`;
      }
      body += `[PROMPT LARANGAN / NEGATIVE PROMPT]:\n${tj.negative_prompt || vp.negative_prompt}`;
    } else {
      // Seedance Format
      body += `[GAYA VISUAL GLOBAL]:\n${tj.global_style || 'Gaya Sinematik Film Historis'}\n\n`;
      body += `[KARAKTER & TOKOH]:\n${tj.characters || scene.character_names.join(', ')}\n\n`;
      body += `[RUJUKAN / ASSET REFERENCE]:\n${tj.references || '@Gambar / @Audio'}\n\n`;
      body += `[RINCIAN AKSI PER-SHOT]:\n${tj.shot_breakdown || shot.event_detail}\n\n`;
      body += `[TATA SUARA & SKORING]:\n${tj.audio || shot.audio_note}\n\n`;
      body += `[ELEMEN WAJIB TERKUNCI]:\n${tj.do_not_change || 'Identitas karakter terkunci, wajah, dan tata letak lokasi'}\n\n`;
      body += `[PROMPT LARANGAN / NEGATIVE PROMPT]:\n${tj.negative_prompt || vp.negative_prompt}`;
    }

    shotBlocks.push({
      shot_number: shot.shot_number,
      time_range: timeRange,
      event_summary: eventSummary,
      body: body.trim(),
    });
  }

  // Assemble full scene single-pass prompt
  const timelinePassages = shots.map((s) => {
    const startPadded = String(Math.floor(s.start_time_sec)).padStart(2, '0');
    const endPadded = String(Math.floor(s.end_time_sec)).padStart(2, '0');
    const vp = readyPromptsByShotId.get(s.id!);
    const promptText = vp?.timeline_json?.prompt || s.event_detail;
    const cameraText = vp?.timeline_json?.camera || s.camera_note;
    return `[${startPadded}-${endPadded}s]: ${promptText} (Kamera: ${cameraText})`;
  }).join('\n');

  const dialogSummary = shots
    .flatMap((s) => s.dialogue || [])
    .map((d) => `${d.character_name}: "${d.line}"`)
    .join('; ');

  const fullScenePrompt = `[PROMPT ADEGAN LENGKAP - ${platformTitle} - DURASI ${scene.duration_sec} DETIK]
ADEGAN #${scene.scene_number}: ${scene.title.toUpperCase()} (Total ${scene.duration_sec} Detik)
SET & LOKASI: ${scene.location_name} (${era}) | ${locationArchitecture}
TATA CAHAYA & SUASANA: ${lightingStyle} | ${visualTone}
PERISTIWA UTAMA: ${scene.event}

URUTAN TIMELINE SHOT:
${timelinePassages}

${dialogSummary ? `DIALOG & SUARA TOKOH:\n${dialogSummary}\n` : ''}SPESIFIKASI TEKNIS: Lensa Anamorphic 35mm Panavision, Rasio Aspek 16:9, Kualitas Fotorealistik 8K Sinematik.`;

  // Assemble full text (Shot-by-Shot View)
  const fullText = [
    header,
    ...shotBlocks.map(
      (sb) =>
        `\n--- SHOT #${sb.shot_number} (${sb.time_range}) — ${sb.event_summary} ---\n${sb.body}`
    ),
  ].join('\n');

  return {
    status: 'complete',
    readyShots,
    totalShots,
    platform,
    text: fullText,
    full_scene_prompt: fullScenePrompt,
    full_scene_prompt_status: 'clean',
    header,
    shots_text: shotBlocks,
  };
}
