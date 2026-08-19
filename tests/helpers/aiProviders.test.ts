jest.mock('yargs-parser', () => () => ({}));

const ollamaChat = jest.fn();
const ollamaList = jest.fn();
jest.mock('ollama', () => ({
  Ollama: jest.fn(function (this: any, options: any) {
    this.options = options;
    this.chat = ollamaChat;
    this.list = ollamaList;
  })
}));

const generateContent = jest.fn();
const getGenerativeModel = jest.fn(() => ({ generateContent }));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(function (this: any, apiKey: string) {
    this.apiKey = apiKey;
    this.getGenerativeModel = getGenerativeModel;
  })
}));

const messagesCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(function (this: any, options: any) {
  this.options = options;
  this.messages = { create: messagesCreate };
}));

import { Ollama } from 'ollama';
import ollama from '../../src/helpers/ai/providers/ollama';
import gemini from '../../src/helpers/ai/providers/gemini';
import anthropic from '../../src/helpers/ai/providers/anthropic';

beforeEach(() => jest.clearAllMocks());

describe('ollama provider', () => {
  test('describes itself', () => {
    expect(ollama).toEqual(expect.objectContaining({
      id: 'ollama',
      label: 'Ollama (local)',
      requiresApiKey: false,
      defaultModel: 'llama3.1',
      defaults: { host: 'http://127.0.0.1:11434' }
    }));
  });

  test('completes against the configured host', async () => {
    ollamaChat.mockResolvedValue({ message: { content: 'the answer' } });

    const answer = await ollama.complete({
      config: { model: 'llama3.1', host: 'http://elsewhere:1234' },
      system: 'be brief',
      prompt: 'hello'
    });

    expect(answer).toBe('the answer');
    expect(Ollama).toHaveBeenCalledWith({ host: 'http://elsewhere:1234' });
    expect(ollamaChat).toHaveBeenCalledWith(expect.objectContaining({
      model: 'llama3.1',
      stream: false,
      messages: [
        { role: 'system', content: 'be brief' },
        { role: 'user', content: 'hello' }
      ]
    }));
  });

  test('falls back to the default host', async () => {
    ollamaChat.mockResolvedValue({ message: { content: 'x' } });
    await ollama.complete({ config: { model: 'llama3.1' }, system: 's', prompt: 'p' });
    expect(Ollama).toHaveBeenCalledWith({ host: 'http://127.0.0.1:11434' });
  });

  test('an answer with no content becomes an empty string', async () => {
    ollamaChat.mockResolvedValue({});
    await expect(ollama.complete({ config: {}, system: 's', prompt: 'p' })).resolves.toBe('');
  });

  test('lists the models already pulled on the host', async () => {
    ollamaList.mockResolvedValue({ models: [{ name: 'llama3.1' }, { model: 'mistral' }, {}] });
    await expect(ollama.listModels({})).resolves.toEqual(['llama3.1', 'mistral']);
  });

  test('a host with no models lists nothing', async () => {
    ollamaList.mockResolvedValue({});
    await expect(ollama.listModels({})).resolves.toEqual([]);
  });
});

describe('gemini provider', () => {
  test('describes itself', () => {
    expect(gemini).toEqual(expect.objectContaining({
      id: 'gemini',
      label: 'Google Gemini',
      requiresApiKey: true,
      defaultModel: 'gemini-2.5-flash'
    }));
  });

  test('passes the system instruction and returns the text', async () => {
    generateContent.mockResolvedValue({ response: { text: () => 'the answer' } });

    const answer = await gemini.complete({
      config: { apiKey: 'key', model: 'gemini-2.5-flash' },
      system: 'be brief',
      prompt: 'hello'
    });

    expect(answer).toBe('the answer');
    expect(getGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      systemInstruction: 'be brief'
    });
    expect(generateContent).toHaveBeenCalledWith('hello');
  });

  test('a failure propagates', async () => {
    generateContent.mockRejectedValue(new Error('quota exceeded'));
    await expect(gemini.complete({ config: {}, system: 's', prompt: 'p' }))
      .rejects.toThrow('quota exceeded');
  });
});

describe('anthropic provider', () => {
  test('describes itself', () => {
    expect(anthropic).toEqual(expect.objectContaining({
      id: 'anthropic',
      label: 'Anthropic (Claude)',
      requiresApiKey: true,
      defaultModel: 'claude-opus-5'
    }));
  });

  test('joins the text blocks of the answer', async () => {
    messagesCreate.mockResolvedValue({
      content: [
        { type: 'text', text: 'part one ' },
        { type: 'thinking', thinking: 'ignored' },
        { type: 'text', text: 'part two' }
      ]
    });

    const answer = await anthropic.complete({
      config: { apiKey: 'key', model: 'claude-opus-5' },
      system: 'be brief',
      prompt: 'hello'
    });

    expect(answer).toBe('part one part two');
    expect(messagesCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: 'be brief',
      messages: [{ role: 'user', content: 'hello' }]
    }));
  });

  test('an answer with no content becomes an empty string', async () => {
    messagesCreate.mockResolvedValue({});
    await expect(anthropic.complete({ config: {}, system: 's', prompt: 'p' })).resolves.toBe('');
  });

  test('a refusal is reported as such', async () => {
    messagesCreate.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    await expect(anthropic.complete({ config: {}, system: 's', prompt: 'p' }))
      .rejects.toThrow('The model declined to answer this prompt.');
  });

  test('a request failure propagates', async () => {
    messagesCreate.mockRejectedValue(new Error('overloaded'));
    await expect(anthropic.complete({ config: {}, system: 's', prompt: 'p' }))
      .rejects.toThrow('overloaded');
  });
});
