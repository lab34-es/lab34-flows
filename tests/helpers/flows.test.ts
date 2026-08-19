// yargs-parser v22 is ESM-only; Node's require(esm) handles it at runtime,
// but jest's module system does not — mock it out.
jest.mock('yargs-parser', () => () => ({}));

import * as flows from '../../src/helpers/flows';

describe('flows.parseValue', () => {
  const MARKDOWN = [
    '---',
    'title: MD flow',
    '---',
    '',
    'Intro',
    '',
    '```step',
    'application: calculator',
    'method: add',
    '```',
    ''
  ].join('\n');

  it('parses markdown flows into segments and steps', () => {
    const parsed = flows.parseValue(MARKDOWN);
    expect(parsed.title).toBe('MD flow');
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.segments.map(s => s.type)).toEqual(['markdown', 'step']);
  });

  it('reports invalid step blocks in markdown flows', () => {
    const parsed = flows.parseValue('```step\n[broken\n```\n');
    expect(parsed.errors).toHaveLength(1);
    expect((parsed.segments[0] as any).error).toBeTruthy();
  });

  it('passes the frontmatter xray.testKey through, trimmed', () => {
    const parsed = flows.parseValue([
      '---',
      'title: MD flow',
      'xray:',
      '  testKey: " ABC-2049 "',
      '---',
      '',
      'Intro',
      ''
    ].join('\n'));

    expect(parsed.xray).toEqual({ testKey: 'ABC-2049' });
  });

  it('answers a null xray when there is none, or it is malformed', () => {
    expect(flows.parseValue(MARKDOWN).xray).toBeNull();
    expect(flows.parseValue('---\nxray: ABC-1\n---\nIntro\n').xray).toBeNull();
    expect(flows.parseValue('---\nxray:\n  testKey: ""\n---\nIntro\n').xray).toBeNull();
  });
});
