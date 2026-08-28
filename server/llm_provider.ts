import { getGeminiAI, resolveGeminiModel } from './gemini';
import {
  ReasoningConfig,
  ReasoningProviderType,
  ReasoningModelPreferences,
  ModelReference,
  TaskTier,
  FallbackLogEntry,
  ErrorClassification,
} from '../src/types';
import {
  DEFAULT_TASK_PROFILES,
  getModelCapabilities,
  satisfiesTaskTier,
  resolveEffectiveModelForStage,
  getDeterministicFallbacks,
  isFatalNonRecoverableError,
  isRateLimitOrQuotaError,
  setProviderHealth,
} from './adaptive_router';
import dotenv from 'dotenv';

dotenv.config();

export interface LLMGenerateOptions {
  reasoningConfig?: ReasoningConfig | null;
  modelPreferences?: ReasoningModelPreferences | null;
  stage?: string;
  entityId?: string;
  model?: string | null;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LLMGenerateResult {
  text: string;
}

export interface LLMCapabilities {
  structured_output: boolean;
  json_schema: boolean;
  long_context: boolean;
  reasoning: boolean;
}

/**
  Strip markdown code blocks or surrounding whitespace from AI JSON output
 */
export function cleanJsonResponse(rawText: string): string {
  let text = rawText.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  text = text.trim();

  // If text contains conversational preamble or reasoning before JSON, extract JSON substring
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  
  let startIndex = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIndex = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  let endIndex = Math.max(lastBrace, lastBracket);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    text = text.slice(startIndex, endIndex + 1);
  }

  return text.trim();
}

/**
 * Safely parse JSON text from LLM responses, stripping code fences,
 * fixing unescaped newlines inside strings, and repairing truncated JSON objects.
 */
export function safeParseJSON<T = any>(rawText: string): T {
  let cleaned = cleanJsonResponse(rawText);

  // 1. Direct parse attempt
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    // 2. Fix raw unescaped newlines/tabs inside double-quoted string literals
    try {
      const sanitized = cleaned.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
        return match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
      });
      return JSON.parse(sanitized);
    } catch (err2) {
      // 3. Attempt repair for truncated JSON string/object (e.g. from token cutoff)
      let repaired = cleaned;

      repaired = repaired.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
        return match
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
      });

      // Count unescaped double quotes to see if a string is unterminated
      let inString = false;
      let escaped = false;
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (char === '\\' && !escaped) {
          escaped = true;
          continue;
        }
        if (char === '"' && !escaped) {
          inString = !inString;
        }
        escaped = false;
      }

      if (inString) {
        repaired += '"';
      }

      // Balance open brackets and braces
      const stack: string[] = [];
      inString = false;
      escaped = false;
      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (char === '\\' && !escaped) {
          escaped = true;
          continue;
        }
        if (char === '"' && !escaped) {
          inString = !inString;
        }
        escaped = false;

        if (!inString) {
          if (char === '{') stack.push('}');
          else if (char === '[') stack.push(']');
          else if (char === '}' || char === ']') {
            if (stack.length > 0 && stack[stack.length - 1] === char) {
              stack.pop();
            }
          }
        }
      }

      while (stack.length > 0) {
        repaired += stack.pop();
      }

      try {
        return JSON.parse(repaired);
      } catch (err3) {
        throw new Error(`JSON parse gagal (Unterminated/Invalid JSON): ${(err1 as Error).message}`);
      }
    }
  }
}

function sanitizeErrorMessage(rawMsg: string, status: number): string {
  if (status === 401 || status === 403) {
    return 'Autentikasi gagal atau API Key tidak valid / tidak memiliki izin akses.';
  }
  if (status === 429) {
    return 'Batas kuota terlampaui (Rate limit / Quota exceeded).';
  }
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return 'Server provider mengalami gangguan sementara (Transient service failure / 5xx error).';
  }
  return rawMsg;
}

function getEffectiveBaseUrl(config?: ReasoningConfig | null): string {
  if (config?.base_url && config.base_url.trim().length > 0) {
    return config.base_url.trim().replace(/\/+$/, '');
  }
  switch (config?.provider_type) {
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'xai':
      return 'https://api.x.ai/v1';
    case 'custom_openai':
      return 'https://api.tabitoken.com/v1'; // Default custom proxy
    default:
      return 'https://api.openai.com/v1';
  }
}

function buildEndpointUrl(baseUrl: string): string {
  if (baseUrl.endsWith('/chat/completions')) {
    return baseUrl;
  }
  return `${baseUrl}/chat/completions`;
}

function getEffectiveApiKey(config?: ReasoningConfig | null): string | undefined {
  if (config?.api_key && config.api_key.trim().length > 0) {
    return config.api_key.trim();
  }
  switch (config?.provider_type) {
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'xai':
      return process.env.XAI_API_KEY;
    case 'custom_openai':
      return process.env.CUSTOM_OPENAI_API_KEY || 'sk-custom-token';
    default:
      return undefined;
  }
}

function extractResponseText(data: any): string | null {
  if (typeof data.output_text === 'string') {
    return data.output_text;
  }
  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item && Array.isArray(item.content)) {
        for (const contentItem of item.content) {
          if (contentItem && typeof contentItem.text === 'string') {
            return contentItem.text;
          }
        }
      }
    }
  }
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0];
    if (choice.message && typeof choice.message.content === 'string') {
      return choice.message.content;
    }
    if (typeof choice.text === 'string') {
      return choice.text;
    }
  }
  return JSON.stringify(data);
}

function parseRetryDelayMs(err: any, attemptNumber: number): number {
  if (err && err.message) {
    const match = err.message.match(/retry after (\d+)/i) || err.message.match(/try again in (\d+)s/i);
    if (match && match[1]) {
      const parsedSeconds = parseInt(match[1], 10);
      if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
        return Math.min(parsedSeconds * 1000, 15000);
      }
    }
  }

  const baseDelays = [2000, 4000, 8000, 12000];
  const base = baseDelays[Math.min(attemptNumber - 1, baseDelays.length - 1)] || 5000;
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(base + jitter, 15000);
}

export function getFallbackModels(primaryModel: string): string[] {
  const resolved = resolveGeminiModel(primaryModel);
  const fallbacks: string[] = [resolved];
  const candidates = [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview',
  ];

  for (const candidate of candidates) {
    if (!fallbacks.includes(candidate)) {
      fallbacks.push(candidate);
    }
  }

  return fallbacks;
}

/**
 * Execute a single model request without global adaptive orchestration wrapper
 */
async function executeSingleModelRequest(
  options: LLMGenerateOptions
): Promise<LLMGenerateResult> {
  const config = options.reasoningConfig;
  const providerType: ReasoningProviderType = config?.provider_type || 'google';
  const MAX_ATTEMPTS = 3;

  if (providerType === 'google') {
    const ai = getGeminiAI();
    const primaryModel = resolveGeminiModel(config?.model_id || options.model);
    const fallbackList = getFallbackModels(primaryModel);

    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const currentModel = fallbackList[(attempt - 1) % fallbackList.length];
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: options.prompt,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: options.maxOutputTokens,
            responseMimeType: options.responseSchema ? 'application/json' : undefined,
            responseSchema: options.responseSchema,
          },
        });

        if (!response.text) {
          throw new Error('Google Gemini returned an empty response.');
        }
        return { text: cleanJsonResponse(response.text) };
      } catch (err: any) {
        lastError = err;
        if (isFatalNonRecoverableError(err)) {
          throw err;
        }
        const isRetryable = isRetryableError(err);
        
        if (isRetryable && attempt < MAX_ATTEMPTS) {
          const delayMs = parseRetryDelayMs(err, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          throw err;
        }
      }
    }

    throw lastError || new Error('Google Gemini generation failed after retries.');
  } else {
    // External OpenAI-Compatible Provider
    const baseUrl = getEffectiveBaseUrl(config);
    const endpoint = buildEndpointUrl(baseUrl);
    const apiKey = getEffectiveApiKey(config);
    const modelId = config?.model_id || options.model || 'ops-5';
    const providerName = config?.provider_name || providerType;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (providerType === 'custom_openai') {
      headers['Authorization'] = 'Bearer sk-custom-token';
    } else {
      throw new Error(
        `API Key untuk provider external "${providerName}" belum dikonfigurasi. Silakan masukkan API Key pada form project.`
      );
    }

    if (providerType === 'openrouter') {
      headers['HTTP-Referer'] = 'https://ai.studio/build';
      headers['X-Title'] = 'AI Cinematic Production Studio';
    }

    const systemContent = options.systemInstruction || '';
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const sendResponseFormat = attempt === 1 && Boolean(options.responseSchema);
        const useSystemRole = attempt <= 2;

        let messages: { role: string; content: string }[];
        if (useSystemRole && systemContent.trim()) {
          let systemMsg = systemContent.trim();
          if (options.responseSchema) {
            systemMsg += `\n\nCRITICAL MANDATE: Output ONLY valid JSON matching the required schema. Do NOT wrap in markdown fences.`;
          }
          messages = [
            { role: 'system', content: systemMsg },
            { role: 'user', content: options.prompt },
          ];
        } else {
          let mergedPrompt = options.prompt;
          if (systemContent.trim()) {
            mergedPrompt = `[SYSTEM INSTRUCTIONS]\n${systemContent.trim()}\n\n[USER REQUEST]\n${options.prompt}`;
          }
          if (options.responseSchema) {
            mergedPrompt += `\n\nCRITICAL MANDATE: Output ONLY valid JSON strictly matching the schema.`;
          }
          messages = [{ role: 'user', content: mergedPrompt }];
        }

        const bodyPayload: any = {
          model: modelId,
          messages,
          temperature: options.temperature ?? 0.3,
        };

        if (options.maxOutputTokens) {
          bodyPayload.max_tokens = options.maxOutputTokens;
        }

        if (sendResponseFormat) {
          bodyPayload.response_format = { type: 'json_object' };
        }

        let response: Response;
        try {
          const controller = new AbortController();
          const timeoutMs = providerType === 'custom_openai' ? 60000 : 45000;
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError' || fetchErr.message?.includes('aborted')) {
            throw new Error(
              `Timeout (60s) menghubungi provider "${providerName}" (${endpoint}). Server tidak merespons tepat waktu.`
            );
          }
          throw new Error(
            `Koneksi ke endpoint provider "${providerName}" (${endpoint}) gagal: ${fetchErr?.message || fetchErr}`
          );
        }

        if (!response.ok) {
          const errText = await response.text();
          let parsedErr: any = null;
          try {
            parsedErr = JSON.parse(errText);
          } catch {}
          const rawMsg = parsedErr?.error?.message || parsedErr?.message || errText;
          const cleanMsg = sanitizeErrorMessage(rawMsg, response.status);
          const customErr: any = new Error(`Provider "${providerName}" menolak request (HTTP ${response.status}): ${cleanMsg}`);
          customErr.status = response.status;
          customErr.details = parsedErr?.error?.details || parsedErr;
          throw customErr;
        }

        const data = await response.json();
        const extractedText = extractResponseText(data);
        if (!extractedText || typeof extractedText !== 'string') {
          throw new Error(`Provider "${providerName}" mengembalikan respons tanpa konten teks yang dapat dibaca.`);
        }

        const cleanedText = cleanJsonResponse(extractedText);
        return { text: cleanedText };
      } catch (err: any) {
        lastError = err;
        const isRetryable = isRetryableError(err);
        
        if (isRetryable && attempt < MAX_ATTEMPTS) {
          const delayMs = parseRetryDelayMs(err, attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          throw err;
        }
      }
    }

    throw lastError || new Error(`Provider "${providerName}" gagal memproses request setelah ${MAX_ATTEMPTS} kali percobaan.`);
  }
}

export const fallbackAuditLogs: FallbackLogEntry[] = [];

export function classifyError(err: any): ErrorClassification {
  const msg = (err?.message || '').toLowerCase();
  const status = err?.status;
  if (msg.includes('quota') || msg.includes('resource exhausted')) {
    return 'quota_exceeded';
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'rate_limit';
  }
  if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('unauthorized')) {
    return 'auth_error';
  }
  if (status === 500 || status === 502 || status === 503 || status === 504 || msg.includes('timeout')) {
    return 'network';
  }
  if (msg.includes('json') || msg.includes('schema') || msg.includes('parse')) {
    return 'schema_validation';
  }
  return 'unknown';
}

export function isRetryableError(err: any): boolean {
  const classification = classifyError(err);
  return classification === 'quota_exceeded' || classification === 'rate_limit' || classification === 'network';
}

/**
 * Central Abstraction Layer for executing LLM requests with Adaptive Router, Fallback Pool, and Explicit Logging
 */
export async function executeLLMRequest(
  options: LLMGenerateOptions
): Promise<LLMGenerateResult> {
  const stage = options.stage || 'S1';
  const taskProfile = DEFAULT_TASK_PROFILES[stage] || { task: 'general', tier: 'general_reasoning' };
  const prefs = options.modelPreferences;
  const mode = prefs?.mode || 'fixed';
  const forceModel = prefs?.force_model || false;

  const effectivePrimary = resolveEffectiveModelForStage(stage, prefs);

  const modelsToTry: { provider: string; model_id: string; isFallback: boolean }[] = [];

  if (options.reasoningConfig) {
    modelsToTry.push({
      provider: options.reasoningConfig.provider_type || 'google',
      model_id: options.reasoningConfig.model_id || 'gemini-3.7-flash',
      isFallback: false,
    });
  } else {
    modelsToTry.push({
      provider: String(effectivePrimary.provider),
      model_id: effectivePrimary.model_id,
      isFallback: false,
    });
  }

  if (mode === 'adaptive' && prefs?.fallback_policy === 'smart' && !forceModel) {
    const fallbacks = getDeterministicFallbacks(effectivePrimary, prefs, taskProfile.tier, 2);
    for (const fb of fallbacks) {
      modelsToTry.push({
        provider: String(fb.provider),
        model_id: fb.model_id,
        isFallback: true,
      });
    }
  }

  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const candidate = modelsToTry[i];
    const isPrimaryAttempt = i === 0;

    try {
      const result = await executeSingleModelRequest({
        ...options,
        reasoningConfig: {
          provider_type: candidate.provider as ReasoningProviderType,
          provider_name: candidate.provider === 'google' ? 'Google Gemini' : candidate.provider,
          model_id: candidate.model_id,
          api_key: options.reasoningConfig?.api_key,
          base_url: options.reasoningConfig?.base_url,
        },
      });

      if (!isPrimaryAttempt) {
        const fallbackLog: FallbackLogEntry = {
          requested_provider: modelsToTry[0].provider,
          requested_model: modelsToTry[0].model_id,
          actual_provider: candidate.provider,
          actual_model: candidate.model_id,
          fallback: true,
          fallback_reason: lastError?.message || 'Primary model quota exceeded / rate limit / unavailable',
          stage,
          entity_id: options.entityId,
          attempt: i + 1,
          timestamp: new Date().toISOString(),
          user_preference_mode: mode,
        };
        fallbackAuditLogs.push(fallbackLog);
        console.warn(`[EXPLICIT FALLBACK AUDIT]`, JSON.stringify(fallbackLog));
      }

      return result;
    } catch (err: any) {
      lastError = err;
      if (isFatalNonRecoverableError(err)) {
        throw err;
      }
      const isQuotaOrRateLimit = isRateLimitOrQuotaError(err);
      if (!isQuotaOrRateLimit || forceModel || prefs?.fallback_policy === 'off' || prefs?.fallback_policy === 'strict') {
        if (mode === 'fixed' && isQuotaOrRateLimit && isPrimaryAttempt) {
          console.warn(`[LLM Provider] Model "${modelsToTry[0].model_id}" hit quota/rate limit in FIXED mode. Forcing fallback pool evaluation for user resilience.`);
        } else {
          throw err;
        }
      }
      console.warn(`[Adaptive Router] Model "${candidate.model_id}" gagal karena kuota/rate limit. Mengevaluasi fallback berikutnya...`);
    }
  }

  throw lastError || new Error('Seluruh model dalam primary dan fallback pool gagal memenuhi request.');
}

/**
 * Ping test connection for external or Google models
 */
export async function testLLMConnection(
  config: ReasoningConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await executeLLMRequest({
      reasoningConfig: config,
      prompt: 'Ping test connection. Respond with JSON object: {"status": "ok"}',
      systemInstruction: 'Output valid JSON strictly: {"status": "ok"}',
      temperature: 0.1,
    });
    if (!result.text) {
      throw new Error('Respons kosong dari model');
    }
    return {
      success: true,
      message: `Koneksi ke ${config.provider_name || config.provider_type} (${config.model_id}) berhasil! Respons: ${result.text.slice(0, 100)}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal terhubung ke provider model.',
    };
  }
}
