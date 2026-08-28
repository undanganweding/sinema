import { Response } from 'express';
import {
  ALL_PROMPT_TARGETS,
  InvalidPromptTargetError,
  isInvalidPromptTargetError,
  isPromptTarget,
  isLegacyPlatformName,
  normalizePromptTarget,
  LEGACY_PLATFORM_TARGET,
  LegacyPlatformName,
} from './stages/stage8_video_prompt';
import {
  isPromptDurationContractError,
  PROMPT_DURATION_CONTRACT_FAILED,
} from './duration_engine';
import {
  isPromptContractValidationError,
  PROMPT_CONTRACT_VALIDATION_FAILED,
} from './cinematic_prompt_engine';
import { PromptTarget } from '../src/types';

/**
 * ============================================================================
 * PATCH 5.5-R1 FASE 4: HTTP PROMPT CONTRACT BOUNDARY
 * ============================================================================
 * One place that translates prompt-domain failures into HTTP responses, so that
 * every endpoint answers with the same JSON shape and the same status codes:
 *
 *   INVALID_PROMPT_TARGET             -> 400
 *   PROMPT_DURATION_CONTRACT_FAILED   -> 422
 *   PROMPT_CONTRACT_VALIDATION_FAILED -> 422
 *   anything else                     -> 500
 *
 * Status codes are derived from the error CLASS (via the exported type guards),
 * never by parsing err.message.
 */

export const INVALID_PROMPT_TARGET_STATUS = 400;
export const PROMPT_CONTRACT_FAILED_STATUS = 422;

/**
 * Additional legacy aliases accepted only at the HTTP edge. These are the
 * strings the current UI sends for the still prompts; they are translated to
 * explicit targets here so the endpoint never forwards an arbitrary string.
 */
const HTTP_STILL_ALIASES: Record<string, PromptTarget> = {
  banana: 'banana_image',
  banana_img: 'banana_image',
  banana_image: 'banana_image',
  banana_master_frame: 'banana_master_frame',
};

export function isHttpStillAlias(value: unknown): value is keyof typeof HTTP_STILL_ALIASES {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HTTP_STILL_ALIASES, value);
}

/**
 * The complete set of strings an endpoint will accept for a prompt target.
 * Reported back to the caller on a 400 so the contract is discoverable.
 */
export const ACCEPTED_TARGET_INPUTS: string[] = Array.from(
  new Set<string>([
    ...ALL_PROMPT_TARGETS,
    ...(Object.keys(LEGACY_PLATFORM_TARGET) as LegacyPlatformName[]),
    ...Object.keys(HTTP_STILL_ALIASES),
  ])
);

/**
 * Validates and normalizes a caller-supplied target at the endpoint boundary.
 *
 * Accepts: canonical PromptTarget values, the explicitly mapped legacy platform
 * names, and the explicitly mapped still aliases. Everything else throws
 * InvalidPromptTargetError. There is no Seedance fallback and no default target
 * on this path.
 */
export function parsePromptTargetFromRequest(value: unknown): PromptTarget {
  if (isPromptTarget(value)) return value;
  if (isLegacyPlatformName(value)) return LEGACY_PLATFORM_TARGET[value];
  if (isHttpStillAlias(value)) return HTTP_STILL_ALIASES[value];
  throw new InvalidPromptTargetError(value);
}

/**
 * Optional-target variant: absent/null/'' means "caller did not ask for a
 * specific target" and yields undefined so the callee can use its own explicit
 * project batch. Any PRESENT but unrecognised value still throws — a typo is
 * never silently downgraded to a default.
 */
export function parseOptionalPromptTargetFromRequest(value: unknown): PromptTarget | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return parsePromptTargetFromRequest(value);
}

/**
 * Normalizes an optional caller-supplied duration. Whether the number is legal
 * for the target is decided by resolveOutputDurationStrict(), so there is
 * exactly one duration authority; non-numeric input is passed through as NaN
 * and rejected there as a duration contract failure (422), not a 500.
 */
export function parseOptionalRequestedDuration(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : NaN;
}

export interface PromptErrorResponse {
  success: false;
  error: string;
  code: string;
  [key: string]: unknown;
}

/**
 * Maps a thrown prompt-domain error to its HTTP status. Class-based, never
 * message-based. Returns null when the error is not a prompt contract failure.
 */
export function promptErrorStatus(err: unknown): number | null {
  if (isInvalidPromptTargetError(err)) return INVALID_PROMPT_TARGET_STATUS;
  if (isPromptDurationContractError(err)) return PROMPT_CONTRACT_FAILED_STATUS;
  if (isPromptContractValidationError(err)) return PROMPT_CONTRACT_FAILED_STATUS;
  return null;
}

/** Builds the JSON error body for a prompt-domain failure. */
export function promptErrorBody(err: unknown): PromptErrorResponse | null {
  if (isInvalidPromptTargetError(err)) {
    return {
      success: false,
      error: err.message,
      ...err.toPayload(),
      acceptedTargets: ACCEPTED_TARGET_INPUTS,
    };
  }

  if (isPromptDurationContractError(err)) {
    return { success: false, error: err.message, ...err.toPayload() };
  }

  if (isPromptContractValidationError(err)) {
    return { success: false, error: err.message, ...err.toPayload() };
  }

  return null;
}

/**
 * Single exit point for prompt endpoints. ALWAYS responds with JSON:
 *   400 INVALID_PROMPT_TARGET
 *   422 PROMPT_DURATION_CONTRACT_FAILED
 *   422 PROMPT_CONTRACT_VALIDATION_FAILED
 *   500 INTERNAL_PROMPT_ERROR (fallback, still JSON)
 *
 * Nothing is persisted by this function — reaching it means the request failed
 * before the persistence step.
 */
export function sendPromptError(res: Response, err: unknown, fallbackMessage: string): Response {
  const status = promptErrorStatus(err);
  const body = promptErrorBody(err);

  if (status !== null && body !== null) {
    return res.status(status).json(body);
  }

  const message = (err as any)?.message;
  return res.status(500).json({
    success: false,
    error: typeof message === 'string' && message.length > 0 ? message : fallbackMessage,
    code: 'INTERNAL_PROMPT_ERROR',
  });
}

// Re-exported so route modules have one import site for the boundary contract.
export {
  PROMPT_DURATION_CONTRACT_FAILED,
  PROMPT_CONTRACT_VALIDATION_FAILED,
  normalizePromptTarget,
  ALL_PROMPT_TARGETS,
};
