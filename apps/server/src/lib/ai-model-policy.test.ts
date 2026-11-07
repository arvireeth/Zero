import {
  DEFAULT_FREE_MODEL,
  DEFAULT_GEMINI_FREE_MODEL,
  resolveAiModel,
  resolveGeminiFreeModel,
  shouldUseFreeFallback,
} from './ai-model-policy';
import { describe, expect, it } from 'vitest';

describe('resolveAiModel', () => {
  it('defaults to the free router when no model is configured', () => {
    expect(resolveAiModel(undefined, false)).toBe(DEFAULT_FREE_MODEL);
    expect(resolveAiModel('  ', false)).toBe(DEFAULT_FREE_MODEL);
  });

  it('allows the OpenRouter free router and explicitly free model variants', () => {
    expect(resolveAiModel('openrouter/free', false)).toBe('openrouter/free');
    expect(resolveAiModel('provider/model:free', false)).toBe('provider/model:free');
  });

  it('blocks paid models unless paid inference is explicitly enabled', () => {
    expect(resolveAiModel('openai/gpt-4.1', false)).toBe(DEFAULT_FREE_MODEL);
    expect(resolveAiModel('provider/model', false)).toBe(DEFAULT_FREE_MODEL);
    expect(resolveAiModel('openai/gpt-4.1', true)).toBe('openai/gpt-4.1');
  });

  it('trims configured model names before checking policy', () => {
    expect(resolveAiModel('  provider/model:free  ', false)).toBe('provider/model:free');
    expect(resolveAiModel('  provider/model  ', false)).toBe(DEFAULT_FREE_MODEL);
  });
});

describe('resolveGeminiFreeModel', () => {
  it('uses the free-tier default and permits known free models', () => {
    expect(resolveGeminiFreeModel(undefined)).toBe(DEFAULT_GEMINI_FREE_MODEL);
    expect(resolveGeminiFreeModel('gemini-3.1-flash-lite')).toBe('gemini-3.1-flash-lite');
  });

  it('blocks models not on the free-tier allowlist', () => {
    expect(resolveGeminiFreeModel('gemini-4-argon')).toBe(DEFAULT_GEMINI_FREE_MODEL);
    expect(resolveGeminiFreeModel('openai/gpt-4.1')).toBe(DEFAULT_GEMINI_FREE_MODEL);
  });
});

describe('shouldUseFreeFallback', () => {
  it.each([401, 403, 408, 429, 500, 503])('allows fallback for retryable status %s', (status) => {
    expect(shouldUseFreeFallback({ statusCode: status })).toBe(true);
  });

  it('does not hide a bad request by switching providers', () => {
    expect(shouldUseFreeFallback({ statusCode: 400, message: 'Invalid tool schema' })).toBe(false);
  });

  it('allows fallback for network and timeout failures', () => {
    expect(shouldUseFreeFallback(new Error('fetch failed: network timeout'))).toBe(true);
    expect(shouldUseFreeFallback(new Error('ECONNRESET'))).toBe(true);
  });

  it('does not retry unknown failures automatically', () => {
    expect(shouldUseFreeFallback(new Error('Unexpected programming error'))).toBe(false);
    expect(shouldUseFreeFallback(null)).toBe(false);
  });
});
