/**
 * PATCH 5.5-R1 FASE 5 — canonical frontend prompt-target layer.
 *
 * The UI addresses prompts by an explicit `PromptTarget` ONLY. It never sends a
 * legacy platform alias (`banana`, `banana_img`, `gemini_omni`, `seedance`) and
 * never derives a target from a button's internal state.
 *
 * The server keeps its LEGACY_PLATFORM_TARGET compatibility boundary for old
 * data and old API clients — that layer stays. What disappears here is the
 * frontend's *dependence* on it:
 *
 *   Legacy data/API -> LEGACY_PLATFORM_TARGET -> canonical PromptTarget   (server, kept)
 *   New UI          -> PromptTarget                                        (this module)
 */
import { PromptTarget, Shot, VideoPrompt } from '../types';

/**
 * Lifecycle of a single (shot, target) prompt cell.
 *
 *   idle       — the datastore has no prompt for this exact target yet
 *   generating — a request for this shot is in flight
 *   ready      — a persisted prompt exists for this exact target
 *   error      — the last generation attempt for this shot failed
 */
export type PromptCellState = 'idle' | 'generating' | 'ready' | 'error';

/** Shown when, and only when, no prompt exists for the requested target. */
export const PROMPT_EMPTY_MESSAGE = 'Prompt belum digenerate';

export const PROMPT_TARGET_LABELS: Record<PromptTarget, string> = {
  banana_master_frame: 'Banana Master Frame',
  banana_image: 'Banana Image',
  veo: 'Veo',
  omni: 'Omni',
  seedance_10: 'Seedance 10s',
  seedance_30: 'Seedance 30s',
};

/** Long-form labels for the prompt panel header. */
export const PROMPT_TARGET_DESCRIPTIONS: Record<PromptTarget, string> = {
  banana_master_frame: 'Banana Master Frame Prompt (Google) — still, 10s contract',
  banana_image: 'Banana Image Prompt (Google) — still, 10s contract',
  veo: 'Veo AI Video Prompt (Google) — 10s',
  omni: 'Omni AI Video Prompt (Google) — 10s',
  seedance_10: 'Seedance 2.5 Video Prompt (ByteDance) — 10s',
  seedance_30: 'Seedance 2.5 Video Prompt (ByteDance) — 30s extended',
};

/**
 * The targets a shot-level "Gen Prompt" button may request, in UI order.
 * `banana_master_frame` is deliberately absent: it is a SCENE-level target and
 * the scene endpoint is the only one that accepts it.
 */
export const SHOT_PROMPT_TARGETS: PromptTarget[] = [
  'banana_image',
  'veo',
  'omni',
  'seedance_10',
  'seedance_30',
];

/** Targets that yield a still image prompt rather than a video timeline row. */
export function isStillTarget(target: PromptTarget): boolean {
  return target === 'banana_master_frame' || target === 'banana_image';
}

/**
 * Maps a legacy `target_platform` column value to a canonical target, for rows
 * persisted before 5.5 that carry no `prompt_target`.
 *
 * `seedance` is intentionally NOT resolvable here: the column cannot tell 10s
 * from 30s. Such a row is disambiguated by its resolved duration, and if even
 * that is missing it matches nothing — an honest `idle` beats showing a 30s
 * prompt in the 10s slot.
 */
function legacyPlatformToTarget(platform: VideoPrompt['target_platform']): PromptTarget | null {
  if (platform === 'veo') return 'veo';
  if (platform === 'gemini_omni') return 'omni';
  return null;
}

/**
 * Resolves the canonical target a persisted row belongs to.
 * Prefers the explicit `prompt_target` written by 5.5 generators.
 */
export function resolveRowTarget(row: VideoPrompt): PromptTarget | null {
  if (row.prompt_target) return row.prompt_target;

  const mapped = legacyPlatformToTarget(row.target_platform);
  if (mapped) return mapped;

  if (row.target_platform === 'seedance') {
    const duration =
      row.timeline_json?.resolved_duration_sec ?? row.timeline_json?.clip_duration_sec;
    if (duration === 10) return 'seedance_10';
    if (duration === 30) return 'seedance_30';
  }
  return null;
}

/** Extracts the prompt body for a target from its persisted row. */
function readRowText(row: VideoPrompt, target: PromptTarget): string | null {
  const timeline = row.timeline_json;
  if (!timeline) return null;

  // Seedance adapters emit a shot breakdown; Veo/Omni emit a single prompt body.
  const raw =
    target === 'seedance_10' || target === 'seedance_30'
      ? timeline.shot_breakdown || timeline.prompt
      : timeline.prompt;

  return raw && raw.trim().length > 0 ? raw : null;
}

export interface PersistedPrompt {
  state: PromptCellState;
  /** Prompt body when ready, otherwise PROMPT_EMPTY_MESSAGE. */
  text: string;
  /** True only when a prompt for this exact target exists. */
  hasPrompt: boolean;
  /** Duration the persisted prompt was actually generated for. */
  resolvedDurationSec: number | null;
  row: VideoPrompt | null;
}

const emptyResult = (state: PromptCellState): PersistedPrompt => ({
  state,
  text: PROMPT_EMPTY_MESSAGE,
  hasPrompt: false,
  resolvedDurationSec: null,
  row: null,
});

/**
 * THE single canonical read path for a persisted prompt. Replaces the old
 * getShotBananaPrompt / getShotVeoPrompt / getShotSeedancePrompt trio.
 *
 * Lookup is keyed on (shot, target) — never on shot alone. There is no
 * cross-target fallback, so a Veo prompt can never surface in the Omni slot and
 * a 30s Seedance prompt can never surface as the 10s one. Legacy per-shot
 * columns (`shot.video_prompt`, `shot.seedance_prompt`) are deliberately NOT
 * consulted: they are shared across targets and would reintroduce exactly the
 * leakage this function exists to prevent.
 */
export function getPersistedPrompt(
  shot: Shot,
  target: PromptTarget,
  prompts: VideoPrompt[],
  options?: { isGenerating?: boolean; hasError?: boolean }
): PersistedPrompt {
  if (options?.hasError) return emptyResult('error');
  if (options?.isGenerating) return emptyResult('generating');

  // Still targets are persisted on the entity itself, not in video_prompts.
  if (isStillTarget(target)) {
    const stillText = shot.master_image_prompt;
    if (stillText && stillText.trim().length > 0) {
      return { state: 'ready', text: stillText, hasPrompt: true, resolvedDurationSec: 10, row: null };
    }
    return emptyResult('idle');
  }

  const row = prompts.find((p) => p.shot_id === shot.id && resolveRowTarget(p) === target);
  if (!row) return emptyResult('idle');

  const text = readRowText(row, target);
  if (!text) return emptyResult('idle');

  return {
    state: 'ready',
    text,
    hasPrompt: true,
    resolvedDurationSec: row.timeline_json?.resolved_duration_sec ?? null,
    row,
  };
}

/**
 * Scene-level master frame prompt (`banana_master_frame`), persisted on the
 * scene row. Kept separate because the scene endpoint is the only caller.
 */
export function getPersistedScenePrompt(
  scene: { master_image_prompt?: string },
  options?: { isGenerating?: boolean; hasError?: boolean }
): PersistedPrompt {
  if (options?.hasError) return emptyResult('error');
  if (options?.isGenerating) return emptyResult('generating');

  const text = scene.master_image_prompt;
  if (text && text.trim().length > 0) {
    return { state: 'ready', text, hasPrompt: true, resolvedDurationSec: 10, row: null };
  }
  return emptyResult('idle');
}


