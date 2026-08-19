/**
 * AI assisted authoring of Markdown flows.
 *
 * Flows are Markdown documents whose executable steps are ```step fenced
 * blocks (see helpers/markdownFlows.js), so everything here is built around
 * producing — and validating — that format. Nothing in this module talks to
 * a specific vendor: it goes through helpers/ai, which resolves the provider
 * the user configured in the Settings screen.
 */

import * as ai from './ai';
import * as apps from './applications';
import * as markdownFlows from './markdownFlows';

// One retry is enough to recover from the occasional malformed document,
// and keeps a failed generation from burning tokens in a loop.
const MAX_ATTEMPTS = 2;

const SYSTEM = [
  'You are an experienced E2E tester writing test flows for Lab34 Flows.',
  'A flow is a Markdown document, and your entire answer is that document:',
  'no preamble, no explanations, and never wrapped in a code fence.'
].join(' ');

/**
 * Describe the applications the flow can drive.
 *
 * Applications document themselves through the JSDoc blocks of their
 * index.ts: the description of the application and, per method, its
 * description, input parameters, output, memory usage and example step.
 *
 * @returns {Promise<Array<Object>>}
 */
const applicationsCatalogue = async () => {
  const parsed = await apps.parseApplications();

  return parsed.map(app => ({
    name: app.name,
    description: app.description || undefined,
    methods: (app.methods || [])
      .filter(method => method.implemented !== false)
      .map(method => {
        const docs = method.docs || {};
        return {
          name: method.name,
          description: method.description || undefined,
          input: docs.input && docs.input.length ? docs.input : undefined,
          output: docs.output || undefined,
          memory: docs.memory && docs.memory.length ? docs.memory : undefined,
          example: docs.example || undefined,
          parameters: method.parameters && Object.keys(method.parameters).length
            ? method.parameters
            : undefined
        };
      })
  }));
};

/**
 * The part of the prompt that explains the file format, shared by the
 * "create" and "edit" prompts.
 * @returns {Array<string>}
 */
const formatRules = () => [
  'The document has three ingredients:',
  '',
  '1. An optional YAML frontmatter at the very top, delimited by "---" lines,',
  '   holding the flow "title" and "description".',
  '2. Regular Markdown: headings, prose, lists, links. Use it to explain what',
  '   each part of the flow verifies — the document is meant to be read.',
  '3. The executable steps, as fenced code blocks tagged "step". The content',
  '   of a step block is YAML with the keys: application, method, description,',
  '   parameters and (optionally) test.',
  '',
  'A complete example:',
  '',
  '---',
  'title: Posts and memory',
  'description: Creates a post and checks it back.',
  '---',
  '',
  '# Posts and memory',
  '',
  'Some prose introducing the scenario.',
  '',
  '## Create a post',
  '',
  '```step',
  'application: jsonplaceholder',
  'method: createPost',
  'description: Create a post',
  'parameters:',
  '  body:',
  '    title: "A title"',
  '    userId: 1',
  'test:',
  '  status: 201',
  '```',
  '',
  'Rules:',
  '- Only use the applications and methods listed below. If you are not sure',
  '  about one, do not use it.',
  '- Use the exact parameter names documented for the method: an input named',
  '  "body.a" means parameters.body.a.',
  '- Respect YAML types: strings in double quotes, numbers plain, booleans',
  '  true/false. Every step block must be valid YAML.',
  '- Keep steps meaningful and avoid repeating the same step.',
  '- Do not wrap the document in a code fence, and do not add any text before',
  '  the frontmatter or after the last block.'
];

/**
 * Build the prompt used to create a flow from scratch.
 * @param {string} description - What the user wants to test
 * @param {Array<Object>} catalogue - Applications, as returned by applicationsCatalogue
 * @returns {string}
 */
const buildCreatePrompt = (description, catalogue) => [
  'Write a Markdown flow that tests the following scenario:',
  '',
  description,
  '',
  ...formatRules(),
  '',
  'The applications you can interact with, and their methods:',
  '------------------',
  JSON.stringify(catalogue),
  '------------------',
  '',
  'Answer with the Markdown document only.'
].join('\n');

/**
 * Build the prompt used to rewrite an existing flow.
 * @param {string} instruction - What the user wants changed
 * @param {string} document - Current flow document
 * @param {Array<Object>} catalogue - Applications, as returned by applicationsCatalogue
 * @returns {string}
 */
const buildEditPrompt = (instruction, document, catalogue) => [
  'Here is an existing Markdown flow:',
  '------------------',
  document,
  '------------------',
  '',
  'Apply this change to it:',
  '',
  instruction,
  '',
  'Keep everything the change does not affect exactly as it is — same prose,',
  'same steps, same order — and return the complete updated document, not a',
  'diff or an excerpt.',
  '',
  ...formatRules(),
  '',
  'The applications you can interact with, and their methods:',
  '------------------',
  JSON.stringify(catalogue),
  '------------------',
  '',
  'Answer with the Markdown document only.'
].join('\n');

/**
 * Models sometimes wrap the whole answer in a ```markdown fence despite
 * being told not to. Remove that wrapper — and only that wrapper, so the
 * ```step blocks inside the document survive untouched.
 *
 * @param {string} value - Raw model answer
 * @returns {string} The document
 */
const unwrapDocument = (value) => {
  const text = (value || '').replace(/\r\n?/g, '\n').trim();

  const lines = text.split('\n');
  if (lines.length < 2) { return text; }

  const opening = lines[0].match(/^\s*(`{3,}|~{3,})\s*(markdown|md)?\s*$/i);
  if (!opening) { return text; }

  const fence = opening[1];
  const closing = new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`);

  // Walk from the end: the wrapper closes on the document's last fence line
  for (let i = lines.length - 1; i > 0; i--) {
    if (lines[i].trim() === '') { continue; }
    return closing.test(lines[i])
      ? lines.slice(1, i).join('\n').trim()
      : text;
  }

  return text;
};

/**
 * Check a generated document: it must parse, contain at least one step, and
 * only reference applications and methods that actually exist.
 *
 * @param {string} document - The generated markdown flow
 * @param {Array<Object>} catalogue - Applications, as returned by applicationsCatalogue
 * @returns {Array<string>} Problems found, empty when the document is good
 */
const validateDocument = (document, catalogue) => {
  const parsed = markdownFlows.parse(document);
  const problems = parsed.errors.map(error => (
    typeof error.stepIndex === 'number'
      ? `step ${error.stepIndex + 1}: ${error.message}`
      : error.message
  ));

  if (!parsed.steps.length) {
    problems.push('the document has no ```step blocks, so there is nothing to run');
  }

  const known = new Map<string, Set<string>>(
    catalogue.map(app => [app.name, new Set((app.methods || []).map(method => method.name))])
  );

  parsed.steps.forEach((step, index) => {
    const label = `step ${index + 1}`;

    if (!step.application || !step.method) {
      problems.push(`${label}: both "application" and "method" are required`);
      return;
    }

    if (!known.has(step.application)) {
      problems.push(`${label}: unknown application "${step.application}"`);
      return;
    }

    if (!known.get(step.application)!.has(step.method)) {
      problems.push(`${label}: application "${step.application}" has no method "${step.method}"`);
    }
  });

  return problems;
};

/**
 * Ask the model for a document, and retry once when what comes back is not
 * a usable flow.
 *
 * @param {Object} options
 * @param {string} options.prompt - The prompt to send
 * @param {Array<Object>} options.catalogue - Applications catalogue
 * @param {string} [options.provider] - Overrides the configured provider
 * @returns {Promise<{flow: string, provider: string, model: string}>}
 */
const generateDocument = async ({ prompt, catalogue, provider }) => {
  let currentPrompt = prompt;
  let lastProblems: string[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const result = await ai.generate({ system: SYSTEM, prompt: currentPrompt, provider });
    const flow = unwrapDocument(result.text);

    lastProblems = validateDocument(flow, catalogue);

    if (!lastProblems.length) {
      return { flow, provider: result.provider, model: result.model };
    }

    currentPrompt = [
      prompt,
      '',
      'Your previous answer could not be used. Problems found:',
      ...lastProblems.map(problem => `- ${problem}`),
      '',
      'Write the whole document again, fixing all of them.'
    ].join('\n');
  }

  throw new Error(
    `The generated flow is not valid: ${lastProblems.join('; ')}. Try rephrasing your prompt.`
  );
};

/**
 * Create a Markdown flow from a natural language description.
 * @param {Object} body - { prompt, provider }
 * @returns {Promise<{flow: string, provider: string, model: string}>}
 */
export const create = async (body) => {
  const prompt = (body && body.prompt ? String(body.prompt) : '').trim();

  if (!prompt) {
    throw new Error('Describe what the flow should test');
  }

  const catalogue = await applicationsCatalogue();

  return generateDocument({
    prompt: buildCreatePrompt(prompt, catalogue),
    catalogue,
    provider: body.provider
  });
};

/**
 * Rewrite an existing flow following an instruction.
 * @param {Object} body - { prompt, content, provider }
 * @returns {Promise<{flow: string, provider: string, model: string}>}
 */
export const edit = async (body) => {
  const prompt = (body && body.prompt ? String(body.prompt) : '').trim();
  const content = (body && body.content ? String(body.content) : '').trim();

  if (!prompt) {
    throw new Error('Describe the change you want');
  }

  if (!content) {
    throw new Error('The flow is empty: there is nothing to edit');
  }

  const catalogue = await applicationsCatalogue();

  return generateDocument({
    prompt: buildEditPrompt(prompt, content, catalogue),
    catalogue,
    provider: body.provider
  });
};

export { unwrapDocument };
export { validateDocument };
export { buildCreatePrompt };
export { buildEditPrompt };
