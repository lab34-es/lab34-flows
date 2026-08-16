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

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

const axios = require('axios');
const configHelper = require('../../src/helpers/config');
const jira = require('../../src/helpers/jira');
const client = require('../../src/helpers/jira/client');
const cache = require('../../src/helpers/jira/cache');

const CLOUD_SETTINGS = {
  kind: 'cloud',
  jiraBaseUrl: 'https://acme.atlassian.net',
  cloud: { clientId: 'client-id', clientSecret: 'client-secret' }
};

const SERVER_SETTINGS = {
  kind: 'server',
  jiraBaseUrl: 'https://jira.acme.com',
  server: { personalAccessToken: 'pat-token' }
};

/**
 * One Xray Cloud GraphQL result, as the API returns it.
 */
const graphqlTest = (key, summary = `Summary of ${key}`) => ({
  issueId: `id-${key}`,
  testType: { name: 'Manual' },
  jira: { key, summary, status: { name: 'To Do' }, issuetype: { name: 'Test' } }
});

const graphqlResponse = (keys) => ({
  data: { data: { getTests: { total: keys.length, results: keys.map(key => graphqlTest(key)) } } }
});

/**
 * The JQL of every GraphQL call made so far.
 */
const jqlCalls = () => axios.post.mock.calls
  .filter(([url]) => url.endsWith('/graphql'))
  .map(([, body]) => body.variables.jql);

beforeEach(() => {
  configHelper.__set({});
  cache.clear();
  client.resetToken();
  axios.get.mockReset();
  axios.post.mockReset();
});

describe('jira.normalize', () => {
  test('defaults to Xray Cloud on its public endpoint', () => {
    const settings = jira.normalize({});

    expect(settings.kind).toBe('cloud');
    expect(settings.cloud.xrayBaseUrl).toBe('https://xray.cloud.getxray.app');
    expect(settings.jiraBaseUrl).toBe('');
  });

  test('trims trailing slashes off the URLs', () => {
    const settings = jira.normalize({
      jiraBaseUrl: 'https://acme.atlassian.net/',
      cloud: { xrayBaseUrl: 'https://eu.xray.cloud.getxray.app//' }
    });

    expect(settings.jiraBaseUrl).toBe('https://acme.atlassian.net');
    expect(settings.cloud.xrayBaseUrl).toBe('https://eu.xray.cloud.getxray.app');
  });

  test('falls back to a known kind when the stored one is unknown', () => {
    expect(jira.normalize({ kind: 'onprem' }).kind).toBe('cloud');
  });
});

describe('jira.isConfigured', () => {
  test('cloud needs a client id and secret', () => {
    expect(jira.isConfigured(jira.normalize({ kind: 'cloud', cloud: { clientId: 'a' } }))).toBe(false);
    expect(jira.isConfigured(jira.normalize(CLOUD_SETTINGS))).toBe(true);
  });

  test('server needs a Jira URL and a token', () => {
    expect(jira.isConfigured(jira.normalize({ kind: 'server', server: { personalAccessToken: 't' } })))
      .toBe(false);
    expect(jira.isConfigured(jira.normalize(SERVER_SETTINGS))).toBe(true);
  });
});

describe('jira.getSettings', () => {
  test('never returns the secrets', async () => {
    configHelper.__set({
      kind: 'cloud',
      jiraBaseUrl: 'https://acme.atlassian.net',
      cloud: { clientId: 'client-id', clientSecret: 'super-secret' },
      server: { personalAccessToken: 'super-token' }
    });

    const settings = await jira.getSettings();

    expect(JSON.stringify(settings)).not.toContain('super-secret');
    expect(JSON.stringify(settings)).not.toContain('super-token');
    expect(settings.cloud.clientSecret).toBeUndefined();
    expect(settings.cloud.hasClientSecret).toBe(true);
    expect(settings.server.personalAccessToken).toBeUndefined();
    expect(settings.server.hasToken).toBe(true);
    expect(settings.cloud.clientId).toBe('client-id');
    expect(settings.configured).toBe(true);
  });

  test('reports an empty configuration as not configured', async () => {
    const settings = await jira.getSettings();

    expect(settings.configured).toBe(false);
    expect(settings.cloud.hasClientSecret).toBe(false);
    expect(settings.server.hasToken).toBe(false);
  });
});

describe('jira.saveSettings', () => {
  test('keeps the stored secrets when the client does not send them', async () => {
    configHelper.__set(CLOUD_SETTINGS);

    await jira.saveSettings({ jiraBaseUrl: 'https://other.atlassian.net' });

    const saved = configHelper.__get();
    expect(saved.cloud.clientSecret).toBe('client-secret');
    expect(saved.jiraBaseUrl).toBe('https://other.atlassian.net');
  });

  test('replaces a secret when one is sent, and clears it with null', async () => {
    configHelper.__set(CLOUD_SETTINGS);

    await jira.saveSettings({ cloud: { clientSecret: 'new-secret' } });
    expect(configHelper.__get().cloud.clientSecret).toBe('new-secret');

    await jira.saveSettings({ cloud: { clientSecret: null } });
    expect(configHelper.__get().cloud.clientSecret).toBeUndefined();
  });

  test('rejects an unknown kind and malformed URLs', async () => {
    await expect(jira.saveSettings({ kind: 'onprem' }))
      .rejects.toThrow(/Unknown Jira integration type/);
    await expect(jira.saveSettings({ jiraBaseUrl: 'acme.atlassian.net' }))
      .rejects.toThrow(/must start with http/);
  });

  test('drops the cached tests, so the next render sees the new Jira', async () => {
    configHelper.__set(CLOUD_SETTINGS);
    axios.post
      .mockResolvedValueOnce({ data: '"jwt"' })
      .mockResolvedValueOnce(graphqlResponse(['BOP-1']));

    await jira.getTests(['BOP-1']);
    expect(cache.size()).toBe(1);

    await jira.saveSettings({ projectKey: 'BOP' });
    expect(cache.size()).toBe(0);
  });
});

describe('jira.getTests, without the integration configured', () => {
  test('answers empty without reaching out to Jira', async () => {
    const result = await jira.getTests(['BOP-1', 'BOP-2']);

    expect(result).toEqual({ configured: false, jiraBaseUrl: '', tests: {} });
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('jira.getTests, on Xray Cloud', () => {
  beforeEach(() => { configHelper.__set(CLOUD_SETTINGS); });

  test('authenticates once and reads every key in a single GraphQL call', async () => {
    axios.post
      .mockResolvedValueOnce({ data: '"jwt-token"' })
      .mockResolvedValueOnce(graphqlResponse(['BOP-1', 'BOP-2']));

    const result = await jira.getTests(['BOP-1', 'BOP-2']);

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[0][0]).toBe('https://xray.cloud.getxray.app/api/v2/authenticate');
    expect(axios.post.mock.calls[0][1]).toEqual({ client_id: 'client-id', client_secret: 'client-secret' });
    expect(jqlCalls()).toEqual(['key in (BOP-1, BOP-2)']);
    expect(axios.post.mock.calls[1][2].headers.Authorization).toBe('Bearer jwt-token');

    expect(result.configured).toBe(true);
    expect(result.jiraBaseUrl).toBe('https://acme.atlassian.net');
    expect(result.tests['BOP-1']).toEqual({
      key: 'BOP-1',
      found: true,
      summary: 'Summary of BOP-1',
      status: 'To Do',
      issueType: 'Test',
      testType: 'Manual',
      issueId: 'id-BOP-1'
    });
  });

  test('downloads every key once per process', async () => {
    axios.post
      .mockResolvedValueOnce({ data: '"jwt-token"' })
      .mockResolvedValueOnce(graphqlResponse(['BOP-1']))
      .mockResolvedValueOnce(graphqlResponse(['BOP-2']));

    await jira.getTests(['BOP-1']);
    // Same key again: served from memory, nothing is downloaded
    await jira.getTests(['BOP-1']);
    // Only the key that was never seen reaches Xray
    const result = await jira.getTests(['BOP-1', 'BOP-2']);

    expect(jqlCalls()).toEqual(['key in (BOP-1)', 'key in (BOP-2)']);
    expect(Object.keys(result.tests).sort()).toEqual(['BOP-1', 'BOP-2']);
  });

  test('normalizes the keys, so casing and duplicates cost nothing', async () => {
    axios.post
      .mockResolvedValueOnce({ data: '"jwt-token"' })
      .mockResolvedValueOnce(graphqlResponse(['BOP-1']));

    const result = await jira.getTests([' bop-1 ', 'BOP-1', 'not a key']);

    expect(jqlCalls()).toEqual(['key in (BOP-1)']);
    expect(Object.keys(result.tests)).toEqual(['BOP-1']);
  });

  test('concurrent requests for the same key share a single download', async () => {
    axios.post
      .mockResolvedValueOnce({ data: '"jwt-token"' })
      .mockImplementationOnce(() => new Promise(resolve => {
        setTimeout(() => resolve(graphqlResponse(['BOP-1'])), 10);
      }));

    const [first, second] = await Promise.all([
      jira.getTests(['BOP-1']),
      jira.getTests(['BOP-1'])
    ]);

    expect(jqlCalls()).toEqual(['key in (BOP-1)']);
    expect(first.tests['BOP-1'].summary).toBe('Summary of BOP-1');
    expect(second.tests['BOP-1'].summary).toBe('Summary of BOP-1');
  });

  test('marks as not found the keys Xray does not know about', async () => {
    axios.post
      .mockResolvedValueOnce({ data: '"jwt-token"' })
      .mockResolvedValueOnce(graphqlResponse(['BOP-1']));

    const result = await jira.getTests(['BOP-1', 'BOP-404']);

    expect(result.tests['BOP-404']).toEqual({ key: 'BOP-404', found: false });
  });

  test('reports failures per key, and retries them on the next render', async () => {
    axios.post
      .mockResolvedValueOnce({ data: '"jwt-token"' })
      .mockRejectedValueOnce(Object.assign(new Error('Request failed'), {
        response: { status: 500, data: { error: 'boom' } }
      }))
      // The JWT is still good: only the failed key is downloaded again
      .mockResolvedValueOnce(graphqlResponse(['BOP-1']));

    const failed = await jira.getTests(['BOP-1']);
    expect(failed.tests['BOP-1'].error).toMatch(/Could not read tests from Xray Cloud/);
    // A failure is not remembered: the key is downloaded again next time
    expect(cache.size()).toBe(0);

    const recovered = await jira.getTests(['BOP-1']);
    expect(recovered.tests['BOP-1'].found).toBe(true);
  });

  test('surfaces GraphQL errors as a per key error', async () => {
    axios.post
      .mockResolvedValueOnce({ data: '"jwt-token"' })
      .mockResolvedValueOnce({ data: { errors: [{ message: 'Not authorized' }] } });

    const result = await jira.getTests(['BOP-1']);

    expect(result.tests['BOP-1'].error).toMatch(/Not authorized/);
  });
});

describe('jira.getTests, on Jira Server/DC', () => {
  beforeEach(() => { configHelper.__set(SERVER_SETTINGS); });

  test('reads the issue with the personal access token', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        id: '10001',
        key: 'BOP-1',
        fields: { summary: 'Login works', status: { name: 'Done' }, issuetype: { name: 'Test' } }
      }
    });

    const result = await jira.getTests(['BOP-1']);

    expect(axios.get).toHaveBeenCalledTimes(1);
    const [url, options] = axios.get.mock.calls[0];
    expect(url).toBe('https://jira.acme.com/rest/api/2/issue/BOP-1');
    expect(options.headers.Authorization).toBe('Bearer pat-token');
    expect(result.tests['BOP-1']).toEqual({
      key: 'BOP-1',
      found: true,
      summary: 'Login works',
      status: 'Done',
      issueType: 'Test',
      testType: null,
      issueId: '10001'
    });
  });

  test('treats a 404 as "not found" instead of an error', async () => {
    axios.get.mockRejectedValueOnce(Object.assign(new Error('Not Found'), {
      response: { status: 404, data: {} }
    }));

    const result = await jira.getTests(['BOP-404']);

    expect(result.tests['BOP-404']).toEqual({ key: 'BOP-404', found: false });
  });
});

describe('jira.test', () => {
  test('explains what is missing instead of calling Jira', async () => {
    await expect(jira.test()).rejects.toThrow(/client id and client secret/);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('authenticates against Xray Cloud', async () => {
    configHelper.__set(CLOUD_SETTINGS);
    axios.post.mockResolvedValueOnce({ data: '"jwt-token"' });

    const result = await jira.test();

    expect(result.kind).toBe('cloud');
    expect(result.message).toMatch(/xray.cloud.getxray.app/);
  });

  test('asks Jira Server who we are', async () => {
    configHelper.__set(SERVER_SETTINGS);
    axios.get.mockResolvedValueOnce({ data: { displayName: 'Jane Tester' } });

    const result = await jira.test();

    expect(axios.get.mock.calls[0][0]).toBe('https://jira.acme.com/rest/api/2/myself');
    expect(result.user).toBe('Jane Tester');
  });
});
