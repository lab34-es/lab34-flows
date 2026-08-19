jest.mock('yargs-parser', () => () => ({}));
jest.mock('../../src/helpers/applications');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

import express from 'express';
import request from 'supertest';
import fs from 'fs';

import * as apps from '../../src/helpers/applications';
import applications from '../../src/api/routes/applications';

const app = express();
app.use(express.json());
app.use((req, _res, next) => { if (req.body === undefined) { req.body = {}; } next(); });
app.use('/api/applications', applications);

const CALCULATOR = {
  slug: 'calculator',
  name: 'calculator',
  envFiles: [{ name: 'local', path: '/ctx/applications/calculator/env/local.env', contents: [] }]
};

beforeEach(() => {
  jest.clearAllMocks();
  (apps.parseApplications as jest.Mock).mockResolvedValue([CALCULATOR]);
});

describe('GET /api/applications', () => {
  test('lists the parsed applications', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(200);
    expect(res.body[0].slug).toBe('calculator');
  });
});

describe('GET /api/applications/:application', () => {
  test('returns the matching application', async () => {
    const res = await request(app).get('/api/applications/calculator');
    expect(res.body.slug).toBe('calculator');
  });

  test('an unknown slug yields an empty body rather than an error', async () => {
    const res = await request(app).get('/api/applications/nope');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });
});

describe('application source files', () => {
  test('GET /files lists them', async () => {
    (apps.listAppFiles as jest.Mock).mockResolvedValue([{ path: 'index.js' }]);
    const res = await request(app).get('/api/applications/calculator/files');
    expect(res.body).toEqual([{ path: 'index.js' }]);
    expect(apps.listAppFiles).toHaveBeenCalledWith('calculator');
  });

  test('GET /files maps a failure to 400', async () => {
    (apps.listAppFiles as jest.Mock).mockRejectedValue(new Error('boom'));
    expect((await request(app).get('/api/applications/calculator/files')).status).toBe(400);
  });

  test('GET /files/content reads the requested path', async () => {
    (apps.readAppFile as jest.Mock).mockResolvedValue({ content: 'x' });
    await request(app).get('/api/applications/calculator/files/content').query({ path: 'index.js' });
    expect(apps.readAppFile).toHaveBeenCalledWith('calculator', 'index.js');
  });

  test('a "not found" message is mapped to 404', async () => {
    (apps.readAppFile as jest.Mock).mockRejectedValue(new Error('File not found'));
    const res = await request(app).get('/api/applications/calculator/files/content').query({ path: 'x' });
    expect(res.status).toBe(404);
  });

  test('PUT /files/content writes it', async () => {
    (apps.writeAppFile as jest.Mock).mockResolvedValue({ path: 'index.js' });
    const res = await request(app)
      .put('/api/applications/calculator/files/content')
      .send({ path: 'index.js', content: 'x' });
    expect(res.body).toEqual({ success: true, path: 'index.js' });
    expect(apps.writeAppFile).toHaveBeenCalledWith('calculator', 'index.js', 'x');
  });

  test('POST /files creates one', async () => {
    (apps.createAppFile as jest.Mock).mockResolvedValue({ path: 'lib/new.js' });
    const res = await request(app)
      .post('/api/applications/calculator/files')
      .send({ path: 'lib/new.js', content: '' });
    expect(res.body.success).toBe(true);
  });

  test('POST /files maps EEXISTS to 409', async () => {
    const error: NodeJS.ErrnoException = new Error('File already exists');
    error.code = 'EEXISTS';
    (apps.createAppFile as jest.Mock).mockRejectedValue(error);
    const res = await request(app).post('/api/applications/calculator/files').send({ path: 'a.js' });
    expect(res.status).toBe(409);
  });

  test('POST /files/rename moves one', async () => {
    (apps.renameAppFile as jest.Mock).mockResolvedValue({ path: 'b.js' });
    await request(app)
      .post('/api/applications/calculator/files/rename')
      .send({ from: 'a.js', to: 'b.js' });
    expect(apps.renameAppFile).toHaveBeenCalledWith('calculator', 'a.js', 'b.js');
  });

  test('DELETE /files/content takes the path from the query string', async () => {
    (apps.deleteAppFile as jest.Mock).mockResolvedValue({ removed: true });
    await request(app)
      .delete('/api/applications/calculator/files/content')
      .query({ path: 'lib/http.js' });
    expect(apps.deleteAppFile).toHaveBeenCalledWith('calculator', 'lib/http.js');
  });

  test('DELETE /files/content also accepts the path in the body', async () => {
    (apps.deleteAppFile as jest.Mock).mockResolvedValue({ removed: true });
    await request(app)
      .delete('/api/applications/calculator/files/content')
      .send({ path: 'lib/http.js' });
    expect(apps.deleteAppFile).toHaveBeenCalledWith('calculator', 'lib/http.js');
  });

  test('a non-Error rejection still reports a message', async () => {
    (apps.listAppFiles as jest.Mock).mockRejectedValue('plain');
    const res = await request(app).get('/api/applications/calculator/files');
    expect(res.body).toEqual({ error: 'plain' });
  });
});

describe('PUT /api/applications/:application/rename', () => {
  test('renames the application folder', async () => {
    (apps.renameApplication as jest.Mock).mockResolvedValue({ slug: 'calc' });
    const res = await request(app).put('/api/applications/calculator/rename').send({ name: 'calc' });
    expect(res.body).toEqual({ success: true, slug: 'calc' });
  });

  test('maps a clash to 409', async () => {
    const error: NodeJS.ErrnoException = new Error('An application named "calc" already exists');
    error.code = 'EEXISTS';
    (apps.renameApplication as jest.Mock).mockRejectedValue(error);
    expect((await request(app).put('/api/applications/calculator/rename').send({ name: 'calc' })).status).toBe(409);
  });
});

describe('environment listing', () => {
  test('GET /envs returns the env files', async () => {
    const res = await request(app).get('/api/applications/calculator/envs');
    expect(res.body).toEqual(CALCULATOR.envFiles);
  });

  test('GET /envs on an unknown application is a 404', async () => {
    const res = await request(app).get('/api/applications/nope/envs');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Application not found' });
  });

  test('GET /envs/:env returns the one env file', async () => {
    const res = await request(app).get('/api/applications/calculator/envs/local');
    expect(res.body.name).toBe('local');
  });

  test('GET /envs/:env on an unknown application is a 404', async () => {
    expect((await request(app).get('/api/applications/nope/envs/local')).status).toBe(404);
  });
});

describe('PUT /api/applications/:application/envs/:env/:key', () => {
  test('updates the variable', async () => {
    (apps.updateEnvFile as jest.Mock).mockResolvedValue(undefined);
    const res = await request(app)
      .put('/api/applications/calculator/envs/local/BASE_URL')
      .send({ value: 'http://x' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(apps.updateEnvFile).toHaveBeenCalledWith(CALCULATOR.envFiles[0].path, 'BASE_URL', 'http://x');
  });

  test('a missing value is rejected before any lookup', async () => {
    const res = await request(app).put('/api/applications/calculator/envs/local/KEY').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Value is required' });
    expect(apps.parseApplications).not.toHaveBeenCalled();
  });

  test('an unknown application is a 404', async () => {
    const res = await request(app).put('/api/applications/nope/envs/local/K').send({ value: 'v' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Application not found' });
  });

  test('an unknown env file is a 404', async () => {
    const res = await request(app).put('/api/applications/calculator/envs/prod/K').send({ value: 'v' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Environment file not found' });
  });
});

describe('raw env file access', () => {
  test('GET /envs/:env/raw returns the file contents', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('A=1\n');
    const res = await request(app).get('/api/applications/calculator/envs/local/raw');
    expect(res.body).toEqual({
      filename: 'local.env',
      path: CALCULATOR.envFiles[0].path,
      content: 'A=1\n'
    });
  });

  test('GET raw on an unknown application is a 404', async () => {
    expect((await request(app).get('/api/applications/nope/envs/local/raw')).status).toBe(404);
  });

  test('GET raw on an unknown env is a 404', async () => {
    expect((await request(app).get('/api/applications/calculator/envs/prod/raw')).status).toBe(404);
  });

  test('PUT /envs/:env/raw writes the file', async () => {
    const res = await request(app)
      .put('/api/applications/calculator/envs/local/raw')
      .send({ content: 'B=2\n' });
    expect(res.status).toBe(200);
    expect(fs.writeFileSync).toHaveBeenCalledWith(CALCULATOR.envFiles[0].path, 'B=2\n', 'utf8');
  });

  test('PUT raw without content is a 400', async () => {
    const res = await request(app).put('/api/applications/calculator/envs/local/raw').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Content is required' });
  });

  test('PUT raw on an unknown application is a 404', async () => {
    const res = await request(app).put('/api/applications/nope/envs/local/raw').send({ content: 'x' });
    expect(res.status).toBe(404);
  });

  test('PUT raw on an unknown env is a 404', async () => {
    const res = await request(app).put('/api/applications/calculator/envs/prod/raw').send({ content: 'x' });
    expect(res.status).toBe(404);
  });
});
