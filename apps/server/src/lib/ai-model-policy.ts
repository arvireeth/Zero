/** Free-only model policy for personal deployments. */
export const DEFAULT_FREE_MODEL = 'openrouter/free';
export const DEFAULT_GEMINI_FREE_MODEL = 'gemini-3.8-flash';

// Explicit allowlist prevents a misconfigured fallback from selecting a paid-only model.
const GEMINI_FREE_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]);

export function resolveGeminiFreeModel(configuredModel: string | undefined): string {
  const candidate = configuredModel?.trim() || DEFAULT_GEMINI_FREE_MODEL;
  return GEMINI_FREE_MODELS.has(candidate) ? candidate : DEFAULT_GEMINI_FREE_MODEL;
}

/**
 * Prevent accidental paid inference. OpenRouter's free router and model IDs
 * ending in :free remain free; any other model requires an explicit opt-in.
 */
export function resolveAiModel(configuredModel: string | undefined, allowPaid: boolean): string {
  const candidate = configuredModel?.trim() || DEFAULT_FREE_MODEL;
  if (allowPaid || candidate === DEFAULT_FREE_MODEL || candidate.endsWith(':free')) {
    return candidate;
  }
  return DEFAULT_FREE_MODEL;
}

/** Retry a different free provider only for authentication, rate-limit, server, or network failures. */
export function shouldUseFreeFallback(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const value = error as { status?: unknown; statusCode?: unknown; message?: unknown };
    const status =
      typeof value.statusCode === 'number'
        ? value.statusCode
        : typeof value.status === 'number'
          ? value.status
          : undefined;

    if (status !== undefined) {
      return status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
    }

    if (typeof value.message === 'string') {
      return /network|fetch failed|timeout|timed out|econnreset|econnrefused|enotfound|temporarily unavailable/i.test(
        value.message,
      );
    }
  }

  return (
    typeof error === 'string' &&
    /network|fetch failed|timeout|timed out|econnreset|econnrefused|enotfound|temporarily unavailable/i.test(
      error,
    )
  );
}
