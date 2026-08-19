// yargs-parser v22 is ESM-only; Node's require(esm) handles it at runtime,
// but jest's module system does not — mock it out.
jest.mock('yargs-parser', () => () => ({}));

// The settings live in the user's context folder: keep them in memory instead
jest.mock('../../src/helpers/config', () => {
  let stored = {};
  return {
    load: jest.fn(async () => stored),
    save: jest.fn(async (name, data) => { stored = data; return data; }),
    __set: (value) => { stored = value; },
    __get: () => stored
  };
});

import * as configHelper from '../../src/helpers/config';
import * as ai from '../../src/helpers/ai';

beforeEach(() => {
  (configHelper as any).__set({});
});

describe('ai.normalize', () => {
  test('defaults to the first provider with its default model', () => {
    const settings = ai.normalize({});

    expect(settings.provider).toBe('ollama');
    expect(settings.providers.ollama.model).toBe('llama3.1');
    expect(settings.providers.ollama.host).toBe('http://127.0.0.1:11434');
    expect(settings.providers.anthropic.model).toBe('claude-opus-5');
  });

  test('migrates the legacy gemini-only configuration', () => {
    const settings = ai.normalize({
      defaultProvider: 'gemini',
      gemini: { apiKey: 'legacy-key', model: 'gemini-1.5-pro' }
    });

    expect(settings.provider).toBe('gemini');
    expect(settings.providers.gemini.apiKey).toBe('legacy-key');
    expect(settings.providers.gemini.model).toBe('gemini-1.5-pro');
  });

  test('falls back to a known provider when the stored one is unknown', () => {
    expect(ai.normalize({ provider: 'skynet' }).provider).toBe('ollama');
  });
});

describe('ai.isConfigured', () => {
  test('providers with an API key need one', () => {
    expect(ai.isConfigured('anthropic', { model: 'claude-opus-5' })).toBe(false);
    expect(ai.isConfigured('anthropic', { model: 'claude-opus-5', apiKey: 'k' })).toBe(true);
  });

  test('ollama only needs a model', () => {
    expect(ai.isConfigured('ollama', { model: '' })).toBe(false);
    expect(ai.isConfigured('ollama', { model: 'llama3.1' })).toBe(true);
  });
});

describe('ai.getSettings', () => {
  test('never returns API keys', async () => {
    (configHelper as any).__set({
      provider: 'gemini',
      providers: { gemini: { model: 'gemini-2.5-flash', apiKey: 'super-secret' } }
    });

    const settings = await ai.getSettings();

    expect(JSON.stringify(settings)).not.toContain('super-secret');
    expect(settings.providers.gemini.hasApiKey).toBe(true);
    expect(settings.providers.gemini.apiKey).toBeUndefined();
    expect(settings.providers.anthropic.hasApiKey).toBe(false);
    expect(settings.ready).toBe(true);
  });

  test('lists the supported providers', async () => {
    const settings = await ai.getSettings();
    expect(settings.available.map(provider => provider.id))
      .toEqual(['ollama', 'gemini', 'anthropic']);
  });
});

describe('ai.saveSettings', () => {
  test('keeps the stored API key when the client does not send one', async () => {
    (configHelper as any).__set({
      provider: 'anthropic',
      providers: { anthropic: { model: 'claude-opus-5', apiKey: 'stored-key' } }
    });

    await ai.saveSettings({ providers: { anthropic: { model: 'claude-sonnet-5' } } });

    const saved = (configHelper as any).__get();
    expect(saved.providers.anthropic.apiKey).toBe('stored-key');
    expect(saved.providers.anthropic.model).toBe('claude-sonnet-5');
  });

  test('replaces the API key when one is sent, and clears it with null', async () => {
    await ai.saveSettings({
      provider: 'gemini',
      providers: { gemini: { apiKey: 'new-key' } }
    });
    expect((configHelper as any).__get().providers.gemini.apiKey).toBe('new-key');

    await ai.saveSettings({ providers: { gemini: { apiKey: null } } });
    expect((configHelper as any).__get().providers.gemini.apiKey).toBeUndefined();
  });

  test('rejects unknown providers', async () => {
    await expect(ai.saveSettings({ provider: 'skynet' })).rejects.toThrow(/Unknown AI provider/);
    await expect(ai.saveSettings({ providers: { skynet: {} } }))
      .rejects.toThrow(/Unknown AI provider/);
  });

  test('rejects an empty model', async () => {
    await expect(ai.saveSettings({ providers: { ollama: { model: '   ' } } }))
      .rejects.toThrow(/model is required/);
  });
});

describe('ai.generate', () => {
  test('explains what is missing instead of calling the provider', async () => {
    (configHelper as any).__set({ provider: 'anthropic', providers: {} });

    await expect(ai.generate({ system: 'x', prompt: 'y' }))
      .rejects.toThrow(/No API key configured for Anthropic \(Claude\)/);
  });
});
