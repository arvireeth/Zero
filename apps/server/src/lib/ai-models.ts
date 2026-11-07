import {
  DEFAULT_FREE_MODEL,
  DEFAULT_GEMINI_FREE_MODEL,
  resolveAiModel,
  resolveGeminiFreeModel,
  shouldUseFreeFallback,
} from './ai-model-policy';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { wrapLanguageModel } from 'ai';
import { env } from '../env';

/**
 * OpenRouter is the primary provider, with a strictly opt-in Gemini free-tier
 * fallback. Gemini is never called unless ALLOW_GEMINI_FALLBACK=true and its
 * separate API key is configured.
 */
const DEFAULT_CHAT_MODEL = DEFAULT_FREE_MODEL;
const DEFAULT_MINI_MODEL = DEFAULT_FREE_MODEL;

const openrouter = () => {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  return createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    compatibility: 'strict',
    headers: {
      'HTTP-Referer': env.VITE_PUBLIC_APP_URL || 'https://0.email',
      'X-Title': 'Zero',
    },
  });
};

const geminiFallback = () => {
  if (env.ALLOW_GEMINI_FALLBACK !== 'true' || !env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return undefined;
  }
  const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
  const selectedModel = resolveGeminiFreeModel(env.GEMINI_FALLBACK_MODEL);
  if (env.GEMINI_FALLBACK_MODEL?.trim() && selectedModel !== env.GEMINI_FALLBACK_MODEL.trim()) {
    console.warn(
      `[AI safety] GEMINI_FALLBACK_MODEL is not on the free-tier allowlist; using ${DEFAULT_GEMINI_FREE_MODEL}.`,
    );
  }
  return google(selectedModel);
};

const withFreeFallback = <TModel extends ReturnType<ReturnType<typeof createOpenRouter>['chat']>>(
  primary: TModel,
  fallback: ReturnType<ReturnType<typeof createGoogleGenerativeAI>>,
) =>
  wrapLanguageModel({
    model: primary,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        try {
          return await doGenerate();
        } catch (error) {
          if (!shouldUseFreeFallback(error)) throw error;
          console.warn(
            '[AI fallback] OpenRouter failed; trying the configured Gemini free-tier model.',
          );
          return fallback.doGenerate(params);
        }
      },
      wrapStream: async ({ doStream, params }) => {
        try {
          return await doStream();
        } catch (error) {
          if (!shouldUseFreeFallback(error)) throw error;
          console.warn(
            '[AI fallback] OpenRouter stream failed; trying the configured Gemini free-tier model.',
          );
          return fallback.doStream(params);
        }
      },
    },
  });

const modelFor = (configuredModel: string | undefined, settingName: string, fallback: string) => {
  const model = resolveAiModel(configuredModel || fallback, env.ALLOW_PAID_AI === 'true');
  if (configuredModel?.trim() && model !== configuredModel.trim()) {
    console.warn(
      `[AI safety] ${settingName} selected a non-free model; using ${DEFAULT_FREE_MODEL}. Set ALLOW_PAID_AI=true only to explicitly permit paid inference.`,
    );
  }

  const secondary = geminiFallback();
  if (!env.OPENROUTER_API_KEY) {
    if (secondary) return secondary;
    throw new Error(
      'No AI provider is configured. Add OPENROUTER_API_KEY, or configure GOOGLE_GENERATIVE_AI_API_KEY with ALLOW_GEMINI_FALLBACK=true.',
    );
  }

  const primary = openrouter().chat(model);
  return secondary ? withFreeFallback(primary, secondary) : primary;
};

/** Main model: the chat agent, drafting, and anything with tool calls. */
export const chatModel = () =>
  modelFor(env.OPENROUTER_MODEL, 'OPENROUTER_MODEL', DEFAULT_CHAT_MODEL);

/** Fast model for small one-shot tasks; remains free-only by default. */
export const miniModel = () =>
  modelFor(env.OPENROUTER_MINI_MODEL, 'OPENROUTER_MINI_MODEL', DEFAULT_MINI_MODEL);
