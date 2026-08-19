/**
 * Provider-agnostic access to the configured AI model.
 *
 * The settings live in the context folder, at config/ai.json:
 *
 *   {
 *     "provider": "anthropic",
 *     "providers": {
 *       "ollama":    { "model": "llama3.1", "host": "http://127.0.0.1:11434" },
 *       "gemini":    { "model": "gemini-2.5-flash", "apiKey": "..." },
 *       "anthropic": { "model": "claude-opus-5", "apiKey": "..." }
 *     }
 *   }
 *
 * API keys never leave the machine through this module: everything the UI
 * reads goes through `getSettings`, which replaces them with a "hasApiKey"
 * boolean.
 */

import * as configHelper from '../config';

import anthropic from './providers/anthropic';
import gemini from './providers/gemini';
import ollama from './providers/ollama';

// Order matters: the first entry is the default provider.
const PROVIDERS = {
  ollama,
  gemini,
  anthropic
};

const PROVIDER_IDS = Object.keys(PROVIDERS);
const CONFIG_NAME = 'ai';

/**
 * Normalize a raw config file into the current shape, migrating the legacy
 * one ({ defaultProvider, gemini: { apiKey, model } }) on the fly so users
 * that already configured Gemini keep working.
 *
 * @param {Object} raw - Contents of config/ai.json
 * @returns {Object} { provider, providers }
 */
const normalize = (raw) => {
  const source = (raw && typeof raw === 'object') ? raw : {};
  const rawProviders = (source.providers && typeof source.providers === 'object')
    ? source.providers
    : {};

  const providers: Record<string, any> = {};

  PROVIDER_IDS.forEach(id => {
    const definition = PROVIDERS[id];
    // Legacy files kept each provider at the root of the object
    const legacy = (source[id] && typeof source[id] === 'object') ? source[id] : {};
    const current = (rawProviders[id] && typeof rawProviders[id] === 'object')
      ? rawProviders[id]
      : {};

    const merged = { ...definition.defaults, ...legacy, ...current };

    providers[id] = {
      ...merged,
      model: merged.model || definition.defaultModel,
      apiKey: merged.apiKey || undefined
    };
  });

  const requested = source.provider || source.defaultProvider;
  const provider = PROVIDER_IDS.includes(requested) ? requested : PROVIDER_IDS[0];

  return { provider, providers };
};

/**
 * Load the settings as stored on disk, API keys included. Internal use only.
 * @returns {Promise<Object>}
 */
const loadSettings = async () => normalize(await configHelper.load(CONFIG_NAME));

export { loadSettings };

/**
 * Whether a provider has everything it needs to answer a prompt.
 * @param {string} id - Provider id
 * @param {Object} config - Provider configuration
 * @returns {boolean}
 */
const isConfigured = (id, config) => {
  const definition = PROVIDERS[id];
  if (!definition || !config || !config.model) { return false; }
  return definition.requiresApiKey ? Boolean(config.apiKey) : true;
};

/**
 * Settings as the UI sees them: no API keys, just whether one is stored.
 * @returns {Promise<Object>}
 */
export const getSettings = async () => {
  const settings = await loadSettings();

  const providers: Record<string, any> = {};
  PROVIDER_IDS.forEach(id => {
    const { apiKey, ...rest } = settings.providers[id];
    providers[id] = {
      ...rest,
      hasApiKey: Boolean(apiKey),
      configured: isConfigured(id, settings.providers[id])
    };
  });

  return {
    provider: settings.provider,
    providers,
    available: PROVIDER_IDS.map(id => ({
      id,
      label: PROVIDERS[id].label,
      requiresApiKey: PROVIDERS[id].requiresApiKey,
      defaultModel: PROVIDERS[id].defaultModel
    })),
    ready: isConfigured(settings.provider, settings.providers[settings.provider])
  };
};

/**
 * Update the settings.
 *
 * Per provider, "apiKey" is only touched when the caller sends it: omitting
 * it keeps the stored key (the UI never receives it, so it cannot send it
 * back), and sending null clears it.
 *
 * @param {Object} body - { provider, providers: { <id>: { model, apiKey, host } } }
 * @returns {Promise<Object>} The public settings, as returned by getSettings
 */
export const saveSettings = async (body) => {
  const input = (body && typeof body === 'object') ? body : {};
  const current = await loadSettings();

  if (input.provider !== undefined && !PROVIDER_IDS.includes(input.provider)) {
    throw new Error(`Unknown AI provider "${input.provider}"`);
  }

  const inputProviders = (input.providers && typeof input.providers === 'object')
    ? input.providers
    : {};

  const unknown = Object.keys(inputProviders).find(id => !PROVIDER_IDS.includes(id));
  if (unknown) {
    throw new Error(`Unknown AI provider "${unknown}"`);
  }

  const providers: Record<string, any> = {};

  PROVIDER_IDS.forEach(id => {
    const stored = current.providers[id];
    const incoming = (inputProviders[id] && typeof inputProviders[id] === 'object')
      ? inputProviders[id]
      : {};

    const next = { ...stored };

    if (incoming.model !== undefined) {
      const model = String(incoming.model).trim();
      if (!model) {
        throw new Error(`A model is required for "${PROVIDERS[id].label}"`);
      }
      next.model = model;
    }

    if (incoming.host !== undefined) {
      next.host = String(incoming.host).trim() || PROVIDERS[id].defaults.host;
    }

    if (incoming.apiKey !== undefined) {
      const apiKey = incoming.apiKey === null ? '' : String(incoming.apiKey).trim();
      next.apiKey = apiKey || undefined;
    }

    providers[id] = next;
  });

  const provider = input.provider || current.provider;

  await configHelper.save(CONFIG_NAME, { provider, providers });

  return module.exports.getSettings();
};

/**
 * Resolve the provider to use, making sure it is usable.
 * @param {string} [providerId] - Overrides the configured provider
 * @returns {Promise<{id: string, definition: Object, config: Object}>}
 */
const resolve = async (providerId) => {
  const settings = await loadSettings();
  const id = providerId || settings.provider;

  const definition = PROVIDERS[id];
  if (!definition) {
    throw new Error(`Unknown AI provider "${id}"`);
  }

  const config = settings.providers[id];

  if (!config.model) {
    throw new Error(`No model configured for ${definition.label}. Set one in Settings.`);
  }

  if (definition.requiresApiKey && !config.apiKey) {
    throw new Error(`No API key configured for ${definition.label}. Add one in Settings.`);
  }

  return { id, definition, config };
};

/**
 * Turn a provider/SDK error into something worth showing in the UI.
 * @param {Error} error
 * @param {Object} definition - Provider definition
 * @returns {Error}
 */
const describeError = (error, definition) => {
  const message = (error && error.message) || String(error);
  return new Error(`${definition.label}: ${message}`);
};

/**
 * Send a prompt to the configured model.
 * @param {Object} options
 * @param {string} options.system - System instructions
 * @param {string} options.prompt - User message
 * @param {string} [options.provider] - Overrides the configured provider
 * @returns {Promise<{text: string, provider: string, model: string}>}
 */
export const generate = async ({ system, prompt, provider }: {
  system?: any;
  prompt?: any;
  provider?: any;
}) => {
  const { id, definition, config } = await resolve(provider);

  let text;
  try {
    text = await definition.complete({ config, system, prompt });
  }
  catch (ex) {
    throw describeError(ex, definition);
  }

  if (!text || !text.trim()) {
    throw new Error(`${definition.label} returned an empty response. Try again.`);
  }

  return { text, provider: id, model: config.model };
};

/**
 * Ask the configured model for a one word answer, to validate the settings.
 * @param {string} [providerId]
 * @returns {Promise<{provider: string, model: string, reply: string}>}
 */
export const test = async (providerId) => {
  const { id, definition, config } = await resolve(providerId);

  let text;
  try {
    text = await definition.complete({
      config,
      system: 'You are being health checked. Reply with the single word: ok.',
      prompt: 'Reply with "ok".'
    });
  }
  catch (ex) {
    throw describeError(ex, definition);
  }

  return { provider: id, model: config.model, reply: (text || '').trim().slice(0, 120) };
};

/**
 * List the models a provider can offer (only Ollama knows them locally).
 * @param {string} providerId
 * @returns {Promise<Array<string>>}
 */
export const listModels = async (providerId) => {
  const settings = await loadSettings();
  const definition = PROVIDERS[providerId];

  if (!definition) {
    throw new Error(`Unknown AI provider "${providerId}"`);
  }

  if (!definition.listModels) {
    return [];
  }

  try {
    return await definition.listModels(settings.providers[providerId]);
  }
  catch (ex) {
    throw describeError(ex, definition);
  }
};

export { PROVIDER_IDS };
export { isConfigured };
export { normalize };
