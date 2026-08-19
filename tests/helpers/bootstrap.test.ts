jest.mock('yargs-parser', () => () => ({}));
jest.mock('../../src/helpers/paths');

import fs from 'fs';
import os from 'os';
import path from 'path';

import * as paths from '../../src/helpers/paths';
import * as bootstrap from '../../src/helpers/bootstrap';

let ctx: string;

beforeEach(() => {
  jest.clearAllMocks();
  ctx = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-'));
  (paths.contextDir as jest.Mock).mockImplementation(
    async (parts: string[]) => path.join(ctx, ...(parts || []))
  );
});

afterEach(() => fs.rmSync(ctx, { recursive: true, force: true }));

describe('bootstrap.ensureDefaults', () => {
  test('creates the applications and flows folders', async () => {
    await bootstrap.ensureDefaults();
    expect(fs.existsSync(path.join(ctx, 'applications'))).toBe(true);
    expect(fs.existsSync(path.join(ctx, 'flows'))).toBe(true);
  });

  test('seeds the bundled example applications and flows', async () => {
    await bootstrap.ensureDefaults();

    expect(fs.existsSync(path.join(ctx, 'applications', 'calculator', 'index.js'))).toBe(true);
    expect(fs.existsSync(path.join(ctx, 'applications', 'httpbin'))).toBe(true);
    expect(fs.existsSync(path.join(ctx, 'applications', 'jsonplaceholder'))).toBe(true);
    expect(fs.existsSync(path.join(ctx, 'flows', 'examples', '01-welcome.md'))).toBe(true);
  });

  test('writes a marker so seeding only ever happens once', async () => {
    await bootstrap.ensureDefaults();
    const marker = path.join(ctx, '.examples-seeded');
    expect(fs.existsSync(marker)).toBe(true);
    expect(JSON.parse(fs.readFileSync(marker, 'utf8')).seededAt).toBeDefined();
  });

  test('a deleted example does not come back on the next start', async () => {
    await bootstrap.ensureDefaults();
    fs.rmSync(path.join(ctx, 'applications', 'calculator'), { recursive: true, force: true });

    await bootstrap.ensureDefaults();

    expect(fs.existsSync(path.join(ctx, 'applications', 'calculator'))).toBe(false);
  });

  test('an existing application folder is left untouched', async () => {
    const dest = path.join(ctx, 'applications', 'calculator');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'index.js'), '// mine');

    await bootstrap.ensureDefaults();

    expect(fs.readFileSync(path.join(dest, 'index.js'), 'utf8')).toBe('// mine');
  });

  test('an existing example flow is left untouched', async () => {
    const dest = path.join(ctx, 'flows', 'examples');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, '01-welcome.md'), '# mine');

    await bootstrap.ensureDefaults();

    expect(fs.readFileSync(path.join(dest, '01-welcome.md'), 'utf8')).toBe('# mine');
  });

  test('seeding never prevents the tool from starting', async () => {
    (paths.contextDir as jest.Mock).mockRejectedValue(new Error('no context'));

    await expect(bootstrap.ensureDefaults()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      'Could not seed default examples:', 'no context'
    );
  });
});
