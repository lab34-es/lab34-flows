jest.mock('yargs-parser', () => () => ({}));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));

import axios from 'axios';
import * as client from '../../src/helpers/jira/client';

const CLOUD = {
  kind: 'cloud',
  jiraBaseUrl: 'https://jira.test',
  cloud: {
    xrayBaseUrl: 'https://xray.test',
    clientId: 'id',
    clientSecret: 'secret'
  }
};

const BASIC = {
  kind: 'basic',
  jiraBaseUrl: 'https://jira.test',
  basic: { email: 'a@b.test', apiToken: 'token' }
};

const SERVER = {
  kind: 'server',
  jiraBaseUrl: 'https://jira.test',
  server: { personalAccessToken: 'pat' }
};

/** An axios-shaped rejection carrying an HTTP response. */
const httpError = (status: number, data?: any) => {
  const error: any = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  return error;
};

beforeEach(() => {
  jest.clearAllMocks();
  client.resetToken();
});

describe('client.authenticate', () => {
  test('posts the credentials and unwraps the quoted token', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: '"jwt-token"' });

    await expect(client.authenticate(CLOUD)).resolves.toBe('jwt-token');
    expect(axios.post).toHaveBeenCalledWith(
      'https://xray.test/api/v2/authenticate',
      { client_id: 'id', client_secret: 'secret' },
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
    );
  });

  test('a non-string answer is coerced', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: 12345 });
    await expect(client.authenticate(CLOUD)).resolves.toBe('12345');
  });

  test('an empty token is an error', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: '' });
    await expect(client.authenticate(CLOUD)).rejects.toThrow(/empty token/);
  });

  test('the token is cached for the same credentials', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: '"jwt"' });

    await client.authenticate(CLOUD);
    await client.authenticate(CLOUD);

    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  test('different credentials get their own token', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: '"jwt"' });

    await client.authenticate(CLOUD);
    await client.authenticate({ ...CLOUD, cloud: { ...CLOUD.cloud, clientId: 'other' } });

    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('force ignores the cache', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: '"jwt"' });

    await client.authenticate(CLOUD);
    await client.authenticate(CLOUD, true);

    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('a failed authentication is not remembered', async () => {
    (axios.post as jest.Mock).mockRejectedValueOnce(httpError(401, { error: 'bad creds' }));
    await expect(client.authenticate(CLOUD)).rejects.toThrow(/authenticate with Xray Cloud/);

    (axios.post as jest.Mock).mockResolvedValue({ data: '"jwt"' });
    await expect(client.authenticate(CLOUD)).resolves.toBe('jwt');
  });

  test('the HTTP status and body detail are reported', async () => {
    (axios.post as jest.Mock).mockRejectedValue(httpError(403, { errorMessages: ['nope'] }));
    await expect(client.authenticate(CLOUD)).rejects.toThrow(/HTTP 403.*nope/);
  });

  test('a string body is truncated into the message', async () => {
    (axios.post as jest.Mock).mockRejectedValue(httpError(500, 'boom'));
    await expect(client.authenticate(CLOUD)).rejects.toThrow(/\(HTTP 500\): boom/);
  });

  test('a network failure without a response still reports', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(client.authenticate(CLOUD)).rejects.toThrow(/ECONNREFUSED/);
  });
});

describe('client.fetchTests - Xray Cloud', () => {
  const graphqlAnswer = (tests: any[]) => ({
    data: { data: { getTests: { results: tests } } }
  });

  beforeEach(() => {
    (axios.post as jest.Mock).mockImplementation((url: string) => {
      if (url.endsWith('/authenticate')) { return Promise.resolve({ data: '"jwt"' }); }
      return Promise.resolve(graphqlAnswer([{
        issueId: '1',
        testType: { name: 'Manual' },
        jira: { key: 'BOP-1', summary: 'Pay', status: { name: 'To Do' }, issuetype: { name: 'Test' } }
      }]));
    });
  });

  test('returns the tests keyed by issue key', async () => {
    const found = await client.fetchTests(CLOUD, ['BOP-1']);
    expect(found['BOP-1']).toEqual(expect.objectContaining({
      key: 'BOP-1', summary: 'Pay', status: 'To Do', issueType: 'Test', testType: 'Manual'
    }));
  });

  test('keys are batched, a hundred at a time', async () => {
    const keys = Array.from({ length: 150 }, (_, i) => `BOP-${i}`);
    await client.fetchTests(CLOUD, keys);

    const graphqlCalls = (axios.post as jest.Mock).mock.calls.filter(([url]) => url.endsWith('/graphql'));
    expect(graphqlCalls).toHaveLength(2);
  });

  test('an expired token is renewed once and the query retried', async () => {
    let graphqlCalls = 0;
    (axios.post as jest.Mock).mockImplementation((url: string) => {
      if (url.endsWith('/authenticate')) { return Promise.resolve({ data: '"jwt"' }); }
      graphqlCalls += 1;
      if (graphqlCalls === 1) { return Promise.reject(httpError(401)); }
      return Promise.resolve(graphqlAnswer([]));
    });

    await expect(client.fetchTests(CLOUD, ['BOP-1'])).resolves.toEqual({});
    expect(graphqlCalls).toBe(2);
  });

  test('a retry that fails again reports', async () => {
    (axios.post as jest.Mock).mockImplementation((url: string) => {
      if (url.endsWith('/authenticate')) { return Promise.resolve({ data: '"jwt"' }); }
      return Promise.reject(httpError(401));
    });

    await expect(client.fetchTests(CLOUD, ['BOP-1'])).rejects.toThrow(/read tests from Xray Cloud/);
  });

  test('a non-401 failure reports without retrying', async () => {
    (axios.post as jest.Mock).mockImplementation((url: string) => {
      if (url.endsWith('/authenticate')) { return Promise.resolve({ data: '"jwt"' }); }
      return Promise.reject(httpError(500));
    });

    await expect(client.fetchTests(CLOUD, ['BOP-1'])).rejects.toThrow(/HTTP 500/);
  });

  test('GraphQL errors are surfaced and flagged', async () => {
    (axios.post as jest.Mock).mockImplementation((url: string) => {
      if (url.endsWith('/authenticate')) { return Promise.resolve({ data: '"jwt"' }); }
      return Promise.resolve({ data: { errors: [{ message: 'unknown field' }] } });
    });

    await expect(client.fetchTests(CLOUD, ['BOP-1'])).rejects.toThrow(/Xray Cloud: unknown field/);
  });

  test('an answer with no data yields nothing', async () => {
    (axios.post as jest.Mock).mockImplementation((url: string) => {
      if (url.endsWith('/authenticate')) { return Promise.resolve({ data: '"jwt"' }); }
      return Promise.resolve({ data: {} });
    });

    await expect(client.fetchTests(CLOUD, ['BOP-1'])).resolves.toEqual({});
  });
});

describe('client.fetchTests - plain Jira REST', () => {
  test('basic auth sends an Authorization: Basic header', async () => {
    (axios.get as jest.Mock).mockResolvedValue({
      data: { key: 'BOP-1', id: '10', fields: { summary: 'S', status: { name: 'Done' }, issuetype: { name: 'Test' } } }
    });

    const found = await client.fetchTests(BASIC, ['BOP-1']);

    expect(found['BOP-1']).toEqual(expect.objectContaining({ summary: 'S', status: 'Done', testType: null }));
    const [, options] = (axios.get as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toMatch(/^Basic /);
  });

  test('a personal access token sends a Bearer header', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { key: 'BOP-1', fields: {} } });

    await client.fetchTests(SERVER, ['BOP-1']);

    const [, options] = (axios.get as jest.Mock).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer pat');
  });

  test('missing fields become nulls', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { key: 'BOP-1', fields: {} } });
    const found = await client.fetchTests(SERVER, ['BOP-1']);
    expect(found['BOP-1']).toEqual(expect.objectContaining({ summary: null, status: null, issueType: null }));
  });

  test('a 404 or 400 means "not found", not a failure', async () => {
    (axios.get as jest.Mock).mockRejectedValue(httpError(404));
    await expect(client.fetchTests(SERVER, ['BOP-1'])).resolves.toEqual({});

    (axios.get as jest.Mock).mockRejectedValue(httpError(400));
    await expect(client.fetchTests(SERVER, ['BOP-1'])).resolves.toEqual({});
  });

  test('any other failure is reported', async () => {
    (axios.get as jest.Mock).mockRejectedValue(httpError(500));
    await expect(client.fetchTests(SERVER, ['BOP-1'])).rejects.toThrow(/read BOP-1 from Jira/);
  });

  test('keys are upper-cased in the result', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { key: 'bop-1', fields: {} } });
    const found = await client.fetchTests(SERVER, ['bop-1']);
    expect(found['BOP-1']).toBeDefined();
  });
});

describe('client.verify', () => {
  test('reports the connected user', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { displayName: 'Ana' } });

    const result = await client.verify(BASIC);

    expect(result).toEqual({ kind: 'basic', user: 'Ana', message: expect.stringContaining('Ana') });
  });

  test('falls back to the name field', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { name: 'ana' } });
    expect((await client.verify(SERVER)).user).toBe('ana');
  });

  test('an anonymous answer still verifies', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: {} });
    expect((await client.verify(SERVER)).user).toBe('unknown user');
  });
});

describe('client.fieldId', () => {
  test('finds a custom field by name, case-insensitively', async () => {
    (axios.get as jest.Mock).mockResolvedValue({
      data: [{ id: 'customfield_10014', name: 'Epic Link' }]
    });

    await expect(client.fieldId(BASIC, 'epic link')).resolves.toBe('customfield_10014');
  });

  test('is null when no field matches', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: [{ id: 'x', name: 'Other' }] });
    await expect(client.fieldId(BASIC, 'Epic Link')).resolves.toBeNull();
  });

  test('a failure is swallowed into null', async () => {
    (axios.get as jest.Mock).mockRejectedValue(httpError(403));
    await expect(client.fieldId(BASIC, 'Epic Link')).resolves.toBeNull();
  });
});

describe('client.fetchIssuesByKeys', () => {
  test('is empty when asked for nothing', async () => {
    await expect(client.fetchIssuesByKeys(BASIC, [], ['summary'])).resolves.toEqual({});
  });
});

describe('client.countIssues', () => {
  test('returns the total the search reports', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { total: 42, issues: [] } });
    await expect(client.countIssues(BASIC, 'project = BOP')).resolves.toBe(42);
  });
});
