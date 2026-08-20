import YAML from 'yaml';

import * as markdownFlows from '../../src/helpers/markdownFlows';

const DOC = [
  '---',
  'title: Pay with card',
  '---',
  '',
  'Intro prose.',
  '',
  '```step',
  'application: calculator',
  'method: add',
  '```',
  '',
  'Between steps.',
  '',
  '```js',
  'console.log("not a step");',
  '```',
  '',
  '```step',
  'application: calculator',
  'method: subtract',
  '```',
  ''
].join('\n');

const RESULTS = [
  { execution: { status: 'passed', times: { start: 1, end: 2, duration: 1 } }, response: { status: 200 } },
  { execution: { status: 'failed' } }
];

describe('markdownFlows.withResults', () => {
  test('writes a step-result block under every step block', () => {
    const out = markdownFlows.withResults(DOC, RESULTS);

    const lines = out.split('\n');
    const opens = lines.filter(line => line.includes('step-result'));
    expect(opens).toHaveLength(2);

    // Each result block sits right after its step's closing fence
    const firstStepClose = lines.indexOf('```', lines.indexOf('```step') + 1);
    expect(lines[firstStepClose + 1]).toBe('');
    expect(lines[firstStepClose + 2]).toContain('step-result');
  });

  test('keeps the document parsing exactly as before', () => {
    const out = markdownFlows.withResults(DOC, RESULTS);
    const parsed = markdownFlows.parse(out);

    expect(parsed.title).toBe('Pay with card');
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.errors).toHaveLength(0);
  });

  test('a regular code block gets no result and stays untouched', () => {
    const out = markdownFlows.withResults(DOC, RESULTS);
    expect(out).toContain('console.log("not a step");');
    expect(out.match(/step-result/g)).toHaveLength(2);
  });

  test('replaces existing result blocks instead of stacking them', () => {
    const once = markdownFlows.withResults(DOC, RESULTS);
    const twice = markdownFlows.withResults(once, RESULTS);
    expect(twice).toBe(once);
  });

  test('a hole in the results leaves that step without a block', () => {
    const out = markdownFlows.withResults(DOC, [undefined, { execution: { status: 'passed' } }]);
    expect(out.match(/step-result/g)).toHaveLength(1);
  });

  test('the frontmatter is left alone', () => {
    const out = markdownFlows.withResults(DOC, RESULTS);
    expect(out.startsWith('---\ntitle: Pay with card\n---')).toBe(true);
  });

  test('content with backtick runs cannot break out of its fence', () => {
    const tricky = [{ execution: { status: 'passed' }, response: { body: 'a ``` fence\n```\ninside' } }];
    const doc = '```step\napplication: a\nmethod: b\n```\n';

    const out = markdownFlows.withResults(doc, tricky);
    const { results } = markdownFlows.extractResults(out);

    expect(results[0].response.body).toBe('a ``` fence\n```\ninside');
  });
});

describe('markdownFlows.extractResults', () => {
  test('round-trips what withResults wrote', () => {
    const out = markdownFlows.withResults(DOC, RESULTS);
    const { content, results } = markdownFlows.extractResults(out);

    expect(results[0]).toEqual(RESULTS[0]);
    expect(results[1]).toEqual(RESULTS[1]);
    expect(content).toBe(DOC);
  });

  test('the stripped content parses like the original document', () => {
    const out = markdownFlows.withResults(DOC, RESULTS);
    const { content } = markdownFlows.extractResults(out);

    expect(markdownFlows.parse(content).steps).toEqual(markdownFlows.parse(DOC).steps);
  });

  test('a document with no results answers an empty map', () => {
    const { results } = markdownFlows.extractResults(DOC);
    expect(results).toEqual({});
  });

  test('a broken result block is dropped, not fatal', () => {
    const doc = [
      '```step',
      'application: a',
      'method: b',
      '```',
      '',
      '```step-result',
      '[broken yaml',
      '```',
      ''
    ].join('\n');

    const { results, content } = markdownFlows.extractResults(doc);
    expect(results).toEqual({});
    expect(content).not.toContain('step-result');
  });

  test('a result block before any step is ignored', () => {
    const doc = [
      '```step-result',
      'execution:',
      '  status: passed',
      '```',
      '',
      '```step',
      'application: a',
      'method: b',
      '```',
      ''
    ].join('\n');

    const { results } = markdownFlows.extractResults(doc);
    expect(results).toEqual({});
  });

  test('results survive YAML round-tripping of rich values', () => {
    const rich = [{
      execution: { status: 'passed', times: { start: 1700000000000, end: 1700000001000, duration: 1 } },
      request: { body: { note: 'multi\nline', list: [1, 2, 3] } },
      response: { status: 201, headers: { 'content-type': 'application/json' }, body: { ok: true } },
      testReport: { hasErrors: false, status: [] }
    }];

    const out = markdownFlows.withResults('```step\napplication: a\nmethod: b\n```\n', rich);
    const { results } = markdownFlows.extractResults(out);

    expect(results[0]).toEqual(rich[0]);
    // And the stored block really is YAML someone can read
    expect(YAML.parse(out.split('step-result\n')[1].split('\n`')[0])).toBeTruthy();
  });
});
