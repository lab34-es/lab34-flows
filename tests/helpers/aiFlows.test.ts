// yargs-parser v22 is ESM-only; Node's require(esm) handles it at runtime,
// but jest's module system does not — mock it out.
jest.mock('yargs-parser', () => () => ({}));

// The model and the user's applications folder are both stubbed: these tests
// cover the prompt, the validation and the retry, not the providers.
jest.mock('../../src/helpers/ai', () => ({ generate: jest.fn() }));
jest.mock('../../src/helpers/applications', () => ({
  parseApplications: jest.fn(async () => [
    {
      name: 'calculator',
      description: 'Does maths',
      methods: [
        { name: 'add', description: 'Adds', docs: {}, parameters: {} },
        { name: 'multiply', description: 'Multiplies', docs: {}, parameters: {} },
        { name: 'divide', implemented: false, docs: {} }
      ]
    }
  ])
}));

import * as ai from '../../src/helpers/ai';
import * as aiFlows from '../../src/helpers/aiFlows';

const CATALOGUE = [
  { name: 'calculator', methods: [{ name: 'add' }, { name: 'multiply' }] },
  { name: 'httpbin', methods: [{ name: 'get' }] }
];

const DOCUMENT = [
  '---',
  'title: Sums',
  '---',
  '',
  '# Sums',
  '',
  'Adds two numbers.',
  '',
  '```step',
  'application: calculator',
  'method: add',
  'parameters:',
  '  body:',
  '    a: 1',
  '    b: 2',
  '```',
  ''
].join('\n');

describe('aiFlows.unwrapDocument', () => {
  test('leaves a plain document untouched', () => {
    expect(aiFlows.unwrapDocument(DOCUMENT)).toBe(DOCUMENT.trim());
  });

  test('removes a ```markdown wrapper without touching the step blocks', () => {
    const wrapped = ['```markdown', DOCUMENT.trim(), '```'].join('\n');
    expect(aiFlows.unwrapDocument(wrapped)).toBe(DOCUMENT.trim());
  });

  test('removes a bare ``` wrapper', () => {
    const wrapped = ['```', DOCUMENT.trim(), '```', ''].join('\n');
    expect(aiFlows.unwrapDocument(wrapped)).toBe(DOCUMENT.trim());
  });

  test('keeps a document that only opens with a fence', () => {
    const value = ['```markdown', '# Not closed'].join('\n');
    expect(aiFlows.unwrapDocument(value)).toBe(value);
  });

  test('normalizes CRLF and tolerates empty answers', () => {
    expect(aiFlows.unwrapDocument('# Title\r\n\r\nBody\r\n')).toBe('# Title\n\nBody');
    expect(aiFlows.unwrapDocument(undefined)).toBe('');
  });
});

describe('aiFlows.validateDocument', () => {
  test('accepts a valid document', () => {
    expect(aiFlows.validateDocument(DOCUMENT, CATALOGUE)).toEqual([]);
  });

  test('rejects a document without step blocks', () => {
    const problems = aiFlows.validateDocument('# Just prose', CATALOGUE);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/no ```step blocks/);
  });

  test('reports invalid step YAML', () => {
    const broken = ['```step', 'application: calculator', '  method: [oops', '```'].join('\n');
    const problems = aiFlows.validateDocument(broken, CATALOGUE);
    expect(problems.join(' ')).toMatch(/step 1: Invalid step YAML/);
  });

  test('reports unknown applications and methods', () => {
    const document = [
      '```step',
      'application: nope',
      'method: add',
      '```',
      '',
      '```step',
      'application: calculator',
      'method: divide',
      '```'
    ].join('\n');

    const problems = aiFlows.validateDocument(document, CATALOGUE);
    expect(problems).toEqual([
      'step 1: unknown application "nope"',
      'step 2: application "calculator" has no method "divide"'
    ]);
  });

  test('requires both application and method', () => {
    const document = ['```step', 'description: does nothing', '```'].join('\n');
    expect(aiFlows.validateDocument(document, CATALOGUE)).toEqual([
      'step 1: both "application" and "method" are required'
    ]);
  });
});

describe('aiFlows prompts', () => {
  test('the create prompt asks for markdown, not YAML', () => {
    const prompt = aiFlows.buildCreatePrompt('Add two numbers', CATALOGUE);

    expect(prompt).toContain('Add two numbers');
    expect(prompt).toContain('Markdown flow');
    expect(prompt).toContain('```step');
    expect(prompt).toContain('calculator');
    expect(prompt).not.toMatch(/must be a YAML file/);
  });

  test('the edit prompt carries the current document', () => {
    const prompt = aiFlows.buildEditPrompt('Add an assertion', DOCUMENT, CATALOGUE);

    expect(prompt).toContain('Add an assertion');
    expect(prompt).toContain('# Sums');
    expect(prompt).toContain('complete updated document');
  });
});

describe('aiFlows.create', () => {
  beforeEach(() => (ai.generate as jest.Mock).mockReset());

  test('refuses an empty prompt', async () => {
    await expect(aiFlows.create({ prompt: '  ' })).rejects.toThrow(/Describe what the flow/);
    expect(ai.generate).not.toHaveBeenCalled();
  });

  test('returns the generated document', async () => {
    (ai.generate as jest.Mock).mockResolvedValue({
      text: ['```markdown', DOCUMENT.trim(), '```'].join('\n'),
      provider: 'ollama',
      model: 'llama3.1'
    });

    const result = await aiFlows.create({ prompt: 'Add two numbers' });

    expect(result).toEqual({
      flow: DOCUMENT.trim(),
      provider: 'ollama',
      model: 'llama3.1'
    });
    expect(ai.generate).toHaveBeenCalledTimes(1);
    // Methods that are not implemented stay out of the catalogue
    expect((ai.generate as jest.Mock).mock.calls[0][0].prompt).not.toContain('divide');
  });

  test('retries once, telling the model what was wrong', async () => {
    (ai.generate as jest.Mock)
      .mockResolvedValueOnce({ text: '# No steps here', provider: 'ollama', model: 'llama3.1' })
      .mockResolvedValueOnce({ text: DOCUMENT, provider: 'ollama', model: 'llama3.1' });

    const result = await aiFlows.create({ prompt: 'Add two numbers' });

    expect(result.flow).toBe(DOCUMENT.trim());
    expect(ai.generate).toHaveBeenCalledTimes(2);
    expect((ai.generate as jest.Mock).mock.calls[1][0].prompt).toContain('no ```step blocks');
  });

  test('gives up after the retry, explaining why', async () => {
    (ai.generate as jest.Mock).mockResolvedValue({
      text: ['```step', 'application: nope', 'method: add', '```'].join('\n'),
      provider: 'ollama',
      model: 'llama3.1'
    });

    await expect(aiFlows.create({ prompt: 'Add two numbers' }))
      .rejects.toThrow(/unknown application "nope"/);
    expect(ai.generate).toHaveBeenCalledTimes(2);
  });
});

describe('aiFlows.edit', () => {
  beforeEach(() => (ai.generate as jest.Mock).mockReset());

  test('refuses an empty instruction', async () => {
    await expect(aiFlows.edit({ prompt: '', content: DOCUMENT }))
      .rejects.toThrow(/Describe the change/);
  });

  test('refuses an empty document', async () => {
    await expect(aiFlows.edit({ prompt: 'Do something', content: '' }))
      .rejects.toThrow(/nothing to edit/);
  });

  test('sends the current document and returns the rewritten one', async () => {
    (ai.generate as jest.Mock).mockResolvedValue({ text: DOCUMENT, provider: 'gemini', model: 'gemini-2.5-flash' });

    const result = await aiFlows.edit({ prompt: 'Add an assertion', content: DOCUMENT });

    expect(result.flow).toBe(DOCUMENT.trim());
    expect((ai.generate as jest.Mock).mock.calls[0][0].prompt).toContain('Add an assertion');
    expect((ai.generate as jest.Mock).mock.calls[0][0].prompt).toContain('# Sums');
  });
});
