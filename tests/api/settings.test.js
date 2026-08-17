// yargs-parser v22 is ESM-only; Node's require(esm) handles it at runtime,
// but jest's module system does not — mock it out.
jest.mock('yargs-parser', () => () => ({}));

// The settings live in the user's context folder: keep them in memory instead
jest.mock('../../src/helpers/config', () => {
  let stored = {};
  return {
    load: jest.fn(async () => stored),
    save: jest.fn(async (name, data) => { stored = data; return data; }),
    __set: (value) => { stored = value; },
    __get: () => stored
  };
});

// No settings route is allowed to reach Jira/Xray on its own
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

const express = require('express');
const request = require('supertest');

const axios = require('axios');
const configHelper = require('../../src/helpers/config');
const settings = require('../../src/api/routes/settings');

const app = express();
app.use(express.json());
app.use('/api/settings', settings);

beforeEach(() => {
  configHelper.__set({});
  axios.get.mockReset();
  axios.post.mockReset();
});

describe('GET /api/settings/jira', () => {
  test('never sends the secrets to the client', async () => {
    configHelper.__set({
      jira: true,
      kind: 'cloud',
      jiraBaseUrl: 'https://acme.atlassian.net',
      cloud: { clientId: 'client-id', clientSecret: 'super-secret' },
      server: { personalAccessToken: 'super-token' }
    });

    const response = await request(app).get('/api/settings/jira').expect(200);

    expect(JSON.stringify(response.body)).not.toContain('super-secret');
    expect(JSON.stringify(response.body)).not.toContain('super-token');
    expect(response.body.cloud.hasClientSecret).toBe(true);
    expect(response.body.server.hasToken).toBe(true);
    expect(response.body.configured).toBe(true);
  });

  test('describes an empty configuration', async () => {
    const response = await request(app).get('/api/settings/jira').expect(200);

    expect(response.body.kind).toBe('cloud');
    expect(response.body.configured).toBe(false);
    expect(response.body.available.map(item => item.id)).toEqual(['cloud', 'basic', 'server']);
  });
});

describe('PUT /api/settings/jira', () => {
  test('stores the settings and answers without the new secret', async () => {
    const response = await request(app)
      .put('/api/settings/jira')
      .send({
        kind: 'cloud',
        jiraBaseUrl: 'https://acme.atlassian.net/',
        cloud: { clientId: 'client-id', clientSecret: 'super-secret' }
      })
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain('super-secret');
    expect(response.body.jiraBaseUrl).toBe('https://acme.atlassian.net');
    expect(configHelper.__get().cloud.clientSecret).toBe('super-secret');
  });

  test('answers 400 with the reason when the input is wrong', async () => {
    const response = await request(app)
      .put('/api/settings/jira')
      .send({ kind: 'onprem' })
      .expect(400);

    expect(response.body.error).toMatch(/Unknown Jira integration type/);
  });
});

describe('POST /api/settings/jira/test', () => {
  test('answers 400 without calling Jira when nothing is configured', async () => {
    const response = await request(app).post('/api/settings/jira/test').expect(400);

    expect(response.body.error).toMatch(/client id and client secret/);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('GET /api/settings/ai', () => {
  test('never sends the API keys to the client', async () => {
    configHelper.__set({
      provider: 'gemini',
      providers: { gemini: { model: 'gemini-2.5-flash', apiKey: 'super-secret' } }
    });

    const response = await request(app).get('/api/settings/ai').expect(200);

    expect(JSON.stringify(response.body)).not.toContain('super-secret');
    expect(response.body.providers.gemini.hasApiKey).toBe(true);
  });
});
