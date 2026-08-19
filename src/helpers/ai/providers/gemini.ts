/**
 * Google Gemini provider.
 */

export default {
  id: 'gemini',
  label: 'Google Gemini',
  requiresApiKey: true,
  defaultModel: 'gemini-2.5-flash',
  defaults: {},

  /**
   * @param {Object} options
   * @param {Object} options.config - Provider configuration
   * @param {string} options.system - System instructions
   * @param {string} options.prompt - User message
   * @returns {Promise<string>} The model's answer
   */
  complete: async ({ config, system, prompt }) => {
    const { GoogleGenerativeAI } = require('@google/generative-ai');

    const model = new GoogleGenerativeAI(config.apiKey).getGenerativeModel({
      model: config.model,
      systemInstruction: system
    });

    const result = await model.generateContent(prompt);

    return result.response.text();
  }
};
