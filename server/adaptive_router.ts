import { ReasoningConfig, ReasoningModelPreferences, ModelReference, TaskTier, FallbackLogEntry } from '../src/types';
import { resolveGeminiModel } from './gemini';

export interface TaskProfile {
  task: string;
  tier: TaskTier;
  historical_sensitivity?: 'high' | 'medium' | 'low';
  narrative_sensitivity?: 'high' | 'medium' | 'low';
  continuity_sensitivity?: 'high' | 'medium' | 'low';
  duration_sensitivity?: 'critical' | 'high' | 'medium' | 'low';
  timeline_sensitivity?: 'critical' | 'high' | 'medium' | 'low';
  visual_consistency?: 'high' | 'medium' | 'low';
}

export const DEFAULT_TASK_PROFILES: Record<string, TaskProfile> = {
  S1: { task: 'story_understanding', tier: 'deep_reasoning', historical_sensitivity: 'high', narrative_sensitivity: 'high' },
  S2: { task: 'character_detection', tier: 'general_reasoning', continuity_sensitivity: 'high' },
  S3: { task: 'location_object_detection', tier: 'general_reasoning', historical_sensitivity: 'high' },
  S4: { task: 'narrative_structure', tier: 'deep_reasoning', narrative_sensitivity: 'high' },
  S5: { task: 'scene_breakdown', tier: 'general_reasoning', duration_sensitivity: 'critical' },
  S6: { task: 'shot_breakdown', tier: 'fast_structured', timeline_sensitivity: 'critical' },
  S7: { task: 'master_frame_image_prompt', tier: 'general_reasoning', visual_consistency: 'high' },
  S8: { task: 'video_prompt', tier: 'general_reasoning' },
  S9: { task: 'continuity_historical_accuracy', tier: 'deep_reasoning' },
};

export interface ModelCapabilities {
  structured_output: boolean;
  json_schema: boolean;
  long_context: boolean;
  reasoning: boolean;
}

const MODEL_CAPABILITIES_MAP: Record<string, ModelCapabilities> = {
  'gemini-3.7-flash': { structured_output: true, json_schema: true, long_context: true, reasoning: true },
  'gemini-3.6-flash': { structured_output: true, json_schema: true, long_context: true, reasoning: true },
  'gemini-3.1-pro-preview': { structured_output: true, json_schema: true, long_context: true, reasoning: true },
  'gemini-3.1-flash-lite': { structured_output: true, json_schema: true, long_context: false, reasoning: false },
  'gemini-2.5-pro': { structured_output: true, json_schema: true, long_context: true, reasoning: true },
  'ops-5': { structured_output: true, json_schema: false, long_context: true, reasoning: true },
};

export function getModelCapabilities(modelId: string): ModelCapabilities {
  const resolved = resolveGeminiModel(modelId);
  return MODEL_CAPABILITIES_MAP[resolved] || MODEL_CAPABILITIES_MAP[modelId] || {
    structured_output: true,
    json_schema: true,
    long_context: true,
    reasoning: true,
  };
}

export interface ProviderHealthState {
  status: 'available' | 'rate_limited' | 'temporarily_unavailable' | 'unauthenticated';
  reason?: string;
  retry_after?: number;
}

const sessionProviderHealth = new Map<string, ProviderHealthState>();

export function getProviderHealth(provider: string, modelId: string): ProviderHealthState {
  const key = `${provider}:${modelId}`;
  return sessionProviderHealth.get(key) || { status: 'available' };
}

export function setProviderHealth(provider: string, modelId: string, status: ProviderHealthState['status'], reason?: string, retryAfter?: number) {
  const key = `${provider}:${modelId}`;
  sessionProviderHealth.set(key, { status, reason, retry_after: retryAfter });
}

export function satisfiesTaskTier(modelId: string, tier: TaskTier): boolean {
  const caps = getModelCapabilities(modelId);
  if (tier === 'deep_reasoning') {
    return caps.reasoning && caps.long_context;
  }
  if (tier === 'fast_structured' || tier === 'general_reasoning') {
    return caps.structured_output;
  }
  return true; // lightweight
}

export function resolveEffectiveModelForStage(
  stage: string | undefined,
  preferences?: ReasoningModelPreferences | null
): ModelReference {
  const defaultModel: ModelReference = {
    provider: 'google',
    model_id: 'gemini-3.7-flash',
    display_name: 'Gemini 3.7 Flash',
  };

  if (!preferences) {
    return defaultModel;
  }

  // 1. Check explicit custom stage routing
  if (preferences.mode === 'custom' && stage && preferences.stage_routing && preferences.stage_routing[stage]) {
    const customModelId = preferences.stage_routing[stage];
    return {
      provider: 'google',
      model_id: customModelId,
      display_name: customModelId,
    };
  }

  // 2. Return primary model
  return preferences.primary_model || defaultModel;
}

export function getDeterministicFallbacks(
  primary: ModelReference,
  preferences?: ReasoningModelPreferences | null,
  taskTier: TaskTier = 'general_reasoning',
  maxFallbacks: number = 2
): ModelReference[] {
  const candidates: ModelReference[] = [];

  if (preferences?.fallback_pool && preferences.fallback_pool.length > 0) {
    // Sort pool by priority
    const sortedPool = [...preferences.fallback_pool].sort((a, b) => (a.priority || 99) - (b.priority || 99));
    for (const entry of sortedPool) {
      if (entry.model_id !== primary.model_id && satisfiesTaskTier(entry.model_id, taskTier)) {
        candidates.push(entry);
      }
    }
  }

  // Default Gemini family fallbacks if pool is empty or insufficient
  if (primary.provider === 'google' && candidates.length < maxFallbacks) {
    const familyOrder = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite', 'gemini-2.5-pro'];
    for (const famModel of familyOrder) {
      if (famModel !== primary.model_id && !candidates.some(c => c.model_id === famModel)) {
        if (satisfiesTaskTier(famModel, taskTier)) {
          candidates.push({
            provider: 'google',
            model_id: famModel,
            display_name: famModel,
          });
        }
      }
    }
  }

  return candidates.slice(0, maxFallbacks);
}

export function isFatalNonRecoverableError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status;
  if (status === 401 || status === 403 || status === 400 || status === 404) {
    return true;
  }
  if (
    msg.includes('api key') ||
    msg.includes('unauthorized') ||
    msg.includes('invalid argument') ||
    msg.includes('not found') ||
    msg.includes('schema mismatch') ||
    msg.includes('invalid json')
  ) {
    return true;
  }
  return false;
}

export function isRateLimitOrQuotaError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status;
  if (status === 429 || status === 503 || status === 504 || status === 502) {
    return true;
  }
  if (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('exhausted') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('timeout')
  ) {
    return true;
  }
  return false;
}
