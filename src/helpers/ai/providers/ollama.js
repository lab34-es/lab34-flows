/**
 * Local Ollama provider.
 *
 * Nothing leaves the machine: the model runs on the host configured as
 * "host" (http://127.0.0.1:11434 by default).
 */

const DEFAULT_HOST = 'http://127.0.0.1:11434';

const client = (config) => {
  const { Ollama } = require('ollama');
  return new Ollama({ host: config.host || DEFAULT_HOST });
};

module.exports = {
  id: 'ollama',
  label: 'Ollama (local)',
  requiresApiKey: false,
  defaultModel: 'llama3.1',
  defaults: { host: DEFAULT_HOST },

  /**
   * @param {Object} options
   * @param {Object} options.config - Provider configuration
   * @param {string} options.system - System instructions
   * @param {string} options.prompt - User message
   * @returns {Promise<string>} The model's answer
   */
  complete: async ({ config, system, prompt }) => {
    const response = await client(config).chat({
      model: config.model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ]
    });

    return (response && response.message && response.message.content) || '';
  },

  /**
   * Models already pulled on the host, so the UI can offer a list.
   * @param {Object} config
   * @returns {Promise<Array<string>>}
   */
  listModels: async (config) => {
    const response = await client(config).list();
    return (response.models || []).map(model => model.name || model.model).filter(Boolean);
  }
};
