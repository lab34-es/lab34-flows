/**
 * Anthropic (Claude) provider.
 */

// Non-streaming requests: keep max_tokens under the SDK's HTTP timeout while
// leaving plenty of room for a full flow document.
const MAX_TOKENS = 16000;

export default {
  id: 'anthropic',
  label: 'Anthropic (Claude)',
  requiresApiKey: true,
  defaultModel: 'claude-opus-5',
  defaults: {},

  /**
   * @param {Object} options
   * @param {Object} options.config - Provider configuration
   * @param {string} options.system - System instructions
   * @param {string} options.prompt - User message
   * @returns {Promise<string>} The model's answer
   */
  complete: async ({ config, system, prompt }) => {
    let Anthropic;
    try {
      Anthropic = require('@anthropic-ai/sdk');
    }
    catch {
      throw new Error(
        'The Anthropic SDK is not installed. Run "npm install" to enable this provider.'
      );
    }

    const client = new Anthropic({ apiKey: config.apiKey });

    // Note: temperature/top_p are rejected by current Claude models, so the
    // request only carries the model, the system prompt and the message.
    const response = await client.messages.create({
      model: config.model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: prompt }]
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined to answer this prompt.');
    }

    return (response.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
  }
};
