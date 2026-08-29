import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiInstance: GoogleGenAI | null = null;

export function getGeminiAI(apiKeyOverride?: string | null): GoogleGenAI {
  // Request-scoped credential resolution: an explicit per-request key (from reasoning_config.api_key)
  // takes precedence over the global server secret. This is intentionally NOT written to process.env,
  // so concurrent workers cannot bleed credentials into each other or leak into logs/telemetry.
  const apiKey = (apiKeyOverride && apiKeyOverride.trim().length > 0)
    ? apiKeyOverride.trim()
    : process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }
  // Only reuse the singleton when it was built from the same (global env) key.
  // When an explicit override is supplied, build a request-scoped client instead.
  if (apiKeyOverride && apiKeyOverride.trim().length > 0) {
    return new GoogleGenAI({ apiKey });
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.7-flash';

export interface GeminiModelInfo {
  id: string;
  name: string;
  badge?: string;
  description: string;
  isRecommended?: boolean;
  tier: 'flash' | 'pro' | 'lite';
}

export const AVAILABLE_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Recommended',
    description: 'Generasi terbaru dengan penalaran adaptif sinematik & kecepatan sangat tinggi.',
    isRecommended: true,
    tier: 'flash',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    badge: 'Stable Fast',
    description: 'Model ultra cepat dan stabil untuk pemrosesan teks, karakter & durasi.',
    isRecommended: false,
    tier: 'flash',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Deep Reasoning',
    description: 'Ideal untuk narasi kompleks, struktur naskah berlapis & karakter mendalam.',
    isRecommended: false,
    tier: 'pro',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast',
    description: 'Model teringan dan responsif untuk breakdown skrip cepat.',
    isRecommended: false,
    tier: 'lite',
  },
];

export function resolveGeminiModel(modelName?: string | null): string {
  if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
    return DEFAULT_GEMINI_MODEL;
  }
  let trimmed = modelName.trim();
  // Strip 'models/' prefix if user provided it
  if (trimmed.startsWith('models/')) {
    trimmed = trimmed.replace('models/', '');
  }
  // Auto-upgrade legacy / discontinued models
  if (trimmed === 'gemini-2.5-flash' || trimmed === 'gemini-2.0-flash' || trimmed === 'gemini-1.5-flash') {
    return 'gemini-3.6-flash';
  }
  if (trimmed === 'gemini-2.5-pro' || trimmed === 'gemini-2.0-pro' || trimmed === 'gemini-1.5-pro') {
    return 'gemini-3.1-pro-preview';
  }
  return trimmed;
}

export const GEMINI_MODEL = DEFAULT_GEMINI_MODEL;

/**
 * Capability check for Gemini Omni / Live features
 * Returns true if the current API key has access to Omni models
 */
export async function checkGeminiOmniCapability(): Promise<boolean> {
  try {
    const ai = getGeminiAI();
    // Test model info for omni models
    const response = await ai.models.get({
      model: 'gemini-omni-flash-preview',
    });
    return !!response?.name;
  } catch (err: any) {
    // If not accessible (404/403/permission denied), return false
    return false;
  }
}

export { Type };
export type { Schema };


