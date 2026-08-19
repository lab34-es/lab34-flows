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

  const YAML_FLOW = [
    'title: Yaml flow',
    'description: A legacy flow',
    'steps:',
    '  - application: calculator',
    '    method: add',
    '  - application: calculator',
    '    method: multiply',
    ''
  ].join('\n');

  it('auto-detects markdown flows', () => {
    const parsed = flows.parseValue(MARKDOWN);
    expect(parsed.format).toBe('markdown');
    expect(parsed.title).toBe('MD flow');
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.segments.map(s => s.type)).toEqual(['markdown', 'step']);
  });

  it('auto-detects YAML flows', () => {
    const parsed = flows.parseValue(YAML_FLOW);
    expect(parsed.format).toBe('yaml');
    expect(parsed.title).toBe('Yaml flow');
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[1].stepIndex).toBe(1);
  });

  it('synthesizes one step segment per YAML step (plus the description)', () => {
    const parsed = flows.parseValue(YAML_FLOW);
    expect(parsed.segments.map(s => s.type)).toEqual(['markdown', 'step', 'step']);
    expect((parsed.segments[1] as any).stepIndex).toBe(0);
    expect(parsed.segments[1].content).toContain('application: calculator');
  });

  it('respects an explicit format over detection', () => {
    // Markdown content forced as YAML: parses as (invalid) YAML instead
    const parsed = flows.parseValue(MARKDOWN, 'yaml');
    expect(parsed.format).toBe('yaml');
  });

  it('reports YAML syntax errors instead of throwing', () => {
    const parsed = flows.parseValue('steps: [unclosed', 'yaml');
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.steps).toHaveLength(0);
  });

  it('reports invalid step blocks in markdown flows', () => {
    const parsed = flows.parseValue('```step\n[broken\n```\n', 'markdown');
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
    ].join('\n'), 'markdown');

    expect(parsed.xray).toEqual({ testKey: 'ABC-2049' });
  });

  it('passes the xray block of YAML flows through too', () => {
    const parsed = flows.parseValue(`${YAML_FLOW}xray:\n  testKey: ABC-7\n`, 'yaml');
    expect(parsed.xray).toEqual({ testKey: 'ABC-7' });
  });

  it('answers a null xray when there is none, or it is malformed', () => {
    expect(flows.parseValue(MARKDOWN).xray).toBeNull();
    expect(flows.parseValue(YAML_FLOW).xray).toBeNull();
    expect(flows.parseValue('---\nxray: ABC-1\n---\nIntro\n', 'markdown').xray).toBeNull();
    expect(flows.parseValue('---\nxray:\n  testKey: ""\n---\nIntro\n', 'markdown').xray).toBeNull();
  });
});
