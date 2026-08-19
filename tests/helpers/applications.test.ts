jest.mock('yargs-parser', () => () => ({}));

import fs from 'fs';
import os from 'os';
import path from 'path';

const CONTEXT = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-'));
jest.mock('../../src/helpers/paths', () => ({
  contextDir: async (parts) => require('path').join(CONTEXT, ...(parts || []))
}));

import * as apps from '../../src/helpers/applications';

const appsDir = path.join(CONTEXT, 'applications');

const write = (relative: string, content = '') => {
  const file = path.join(appsDir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
};

/** A minimal self-describing application, in the shape the loader expects. */
const CALC_INDEX = `
const { validate, applications } = require('lab34-flows');

/**
 * Adds two numbers.
 * @param {number} a - First
 * @returns {200} The sum
 */
module.exports.add = applications.handler([
  validate.body({ type: 'object', properties: { a: { type: 'number' } } }),
  (ctx, parameters) => ({ sum: 1 })
], 'add');
`;

beforeEach(() => {
  fs.rmSync(appsDir, { recursive: true, force: true });
  fs.mkdirSync(appsDir, { recursive: true });
});

afterAll(() => fs.rmSync(CONTEXT, { recursive: true, force: true }));

describe('applications.handler', () => {
  test('describes itself, exposing the body and query schemas', () => {
    const bodySchema = { type: 'object' };
    const querySchema = { type: 'object' };
    const bodyValidator: any = () => {}; bodyValidator.schemaType = 'body'; bodyValidator.schema = bodySchema;
    const queryValidator: any = () => {}; queryValidator.schemaType = 'query'; queryValidator.schema = querySchema;

    const fn = apps.handler([bodyValidator, queryValidator, () => 'done'], 'add');

    expect(fn('describe', null, null)).toEqual({
      name: 'add',
      description: null,
      parameters: { body: bodySchema, query: querySchema }
    });
  });

  test('a leading string is still accepted as the description', () => {
    const fn = apps.handler(['Legacy description', () => 'done'], 'add');
    expect(fn('describe', null, null).description).toBe('Legacy description');
  });

  test('running it calls every validator and then the last function', () => {
    const validator = jest.fn();
    const execute = jest.fn().mockReturnValue('result');
    const ctx = { env: {} };

    const result = apps.handler([validator, execute], 'add')(ctx, { body: {} }, { memory: {} });

    expect(validator).toHaveBeenCalledWith(ctx, { body: {} }, { memory: {} });
    expect(execute).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  test('a leading description is not called as a validator', () => {
    const execute = jest.fn().mockReturnValue('ok');
    expect(apps.handler(['desc', execute], 'add')({}, {}, {})).toBe('ok');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('non-function entries are skipped', () => {
    const execute = jest.fn().mockReturnValue('ok');
    expect(apps.handler([null as any, execute], 'add')({}, {}, {})).toBe('ok');
  });
});

describe('applications.description', () => {
  test('is an identity passthrough kept for application authors', () => {
    expect(apps.description('text')).toBe('text');
  });
});

describe('applications.parseApplications', () => {
  test('is empty when there is no applications directory', async () => {
    fs.rmSync(appsDir, { recursive: true, force: true });
    expect(await apps.parseApplications()).toEqual([]);
  });

  test('ignores loose files, listing only application folders', async () => {
    write('notes.txt', 'x');
    fs.mkdirSync(path.join(appsDir, 'calculator'), { recursive: true });
    const list = await apps.parseApplications();
    expect(list.map(a => a.name)).toEqual(['calculator']);
  });

  test('loads an application, its methods and its JSDoc', async () => {
    write('calculator/index.js', CALC_INDEX);

    const [app] = await apps.parseApplications();

    expect(app.name).toBe('calculator');
    expect(app.slug).toBe('calculator');
    expect(app.errors).toEqual([]);

    const add = app.methods.find(m => m.name === 'add')!;
    expect(add.implemented).toBe(true);
    expect(add.description).toBe('Adds two numbers.');
    expect(add.docs).toBeDefined();
  });

  test('restores index.js after rewriting the lab34-flows import', async () => {
    const file = write('calculator/index.js', CALC_INDEX);
    await apps.parseApplications();
    expect(fs.readFileSync(file, 'utf8')).toBe(CALC_INDEX);
  });

  test('reports an application whose code throws, without failing the list', async () => {
    write('broken/index.js', 'throw new Error("boom");');

    const [app] = await apps.parseApplications();

    expect(app.name).toBe('broken');
    expect(app.errors[0].message).toContain('boom');
    expect(app.errors[0].stack).toBeDefined();
  });

  test('an application with no index.js still lists', async () => {
    write('empty/README.md', '# Empty');
    const [app] = await apps.parseApplications();
    expect(app.methods).toEqual([]);
    expect(app.readme).toBe('# Empty');
  });

  test('reads the README case-insensitively', async () => {
    write('calculator/readme.md', '# Calc');
    const [app] = await apps.parseApplications();
    expect(app.readme).toBe('# Calc');
  });

  test('warns that docs.json is no longer used', async () => {
    write('calculator/index.js', CALC_INDEX);
    write('calculator/docs.json', '{}');

    const [app] = await apps.parseApplications();

    expect(app.errors.some(e => e.message.includes('docs.json is no longer used'))).toBe(true);
  });

  test('a documented but unimplemented method is listed as not implemented', async () => {
    write('calculator/index.js', [
      '/**', ' * Subtracts.', ' * @returns {200} diff', ' */', 'module.exports.subtract = 1;'
    ].join('\n'));

    const [app] = await apps.parseApplications();
    const subtract = app.methods.find(m => m.name === 'subtract')!;

    expect(subtract).toBeDefined();
    expect(subtract.implemented).toBe(false);
  });

  test('env files are listed with their values, secrets masked', async () => {
    write('calculator/env/local.env', 'BASE_URL=http://x\nTOKEN=abcdefghijkl\n');

    const [app] = await apps.parseApplications();
    const local = app.envFiles.find(e => e.name === 'local')!;

    expect(local.contents).toEqual(expect.arrayContaining([
      { key: 'BASE_URL', isSecret: false, value: 'http://x' },
      { key: 'TOKEN', isSecret: true, value: '********ijkl' }
    ]));
  });

  test('a short secret is masked entirely', async () => {
    write('calculator/env/local.env', 'PASSWORD=abc\n');
    const [app] = await apps.parseApplications();
    expect(app.envFiles[0].contents[0].value).toBe('***');
  });

  test('an empty secret is left as it is', async () => {
    write('calculator/env/local.env', 'SECRET=\n');
    const [app] = await apps.parseApplications();
    expect(app.envFiles[0].contents[0].value).toBe('');
  });

  test('an application with no env folder reports none', async () => {
    write('calculator/index.js', CALC_INDEX);
    const [app] = await apps.parseApplications();
    expect(app.envFiles).toEqual([]);
  });

  test('only .env files are picked up', async () => {
    write('calculator/env/local.env', 'A=1\n');
    write('calculator/env/notes.txt', 'x');
    const [app] = await apps.parseApplications();
    expect(app.envFiles.map(e => e.name)).toEqual(['local']);
  });
});

describe('applications.allPossibleEnvironments', () => {
  test('is the sorted union across applications, without blanks', async () => {
    write('a/env/prod.env', 'A=1\n');
    write('a/env/local.env', 'A=1\n');
    write('b/env/local.env', 'B=1\n');

    expect(await apps.allPossibleEnvironments()).toEqual(['local', 'prod']);
  });

  test('is empty when nothing declares an environment', async () => {
    write('a/index.js', 'module.exports = {};');
    expect(await apps.allPossibleEnvironments()).toEqual([]);
  });
});

describe('applications.updateEnvFile', () => {
  test('updates an existing key, leaving the others', async () => {
    const file = write('calculator/env/local.env', 'A=1\nB=2\n');

    await apps.updateEnvFile(file, 'A', '9');

    const written = fs.readFileSync(file, 'utf8');
    expect(written).toContain('A=9');
    expect(written).toContain('B=2');
  });

  test('adds a key that was not there', async () => {
    const file = write('calculator/env/local.env', 'A=1\n');
    await apps.updateEnvFile(file, 'NEW', 'x');
    expect(fs.readFileSync(file, 'utf8')).toContain('NEW=x');
  });

  test('rejects when the file cannot be read', async () => {
    await expect(apps.updateEnvFile(path.join(appsDir, 'ghost.env'), 'A', '1')).rejects.toBeDefined();
  });
});

describe('applications.loadAll', () => {
  test('registers every application that has an index.js', async () => {
    write('calculator/index.js', CALC_INDEX);
    write('noindex/README.md', '# x');

    await apps.loadAll();

    expect(apps.applications.calculator).toBeDefined();
    expect(apps.applications.noindex).toBeUndefined();
  });
});

describe('applications.summary', () => {
  test('prints each application and its methods', async () => {
    write('calculator/index.js', CALC_INDEX);

    await apps.summary();

    const out = (console.log as jest.Mock).mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('Applications Summary');
    expect(out).toContain('Application: calculator');
    expect(out).toContain('- add:');
  });

  test('says so when there are no applications', async () => {
    await apps.summary();
    const out = (console.log as jest.Mock).mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('No applications found.');
  });

  test('says so when an application has no methods', async () => {
    write('empty/README.md', '# x');
    await apps.summary();
    const out = (console.log as jest.Mock).mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('No methods found.');
  });
});
