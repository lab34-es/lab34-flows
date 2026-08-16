/**
 * Raw HTTP access to Xray Cloud and to Jira Server/DC.
 *
 * Nothing here is cached except the Xray Cloud JWT, which is expensive to
 * obtain and lives for about 24h: see ./cache.js for the test data cache.
 */

const axios = require('axios');

// Jira/Xray are external services: never let a hung request block a render
const TIMEOUT = 15000;

// Xray Cloud's GraphQL API caps getTests at 100 results per call
const MAX_KEYS_PER_QUERY = 100;

const TESTS_QUERY = `query getTests($jql: String!, $limit: Int!) {
  getTests(jql: $jql, limit: $limit) {
    total
    results {
      issueId
      testType { name }
      jira(fields: ["key", "summary", "status", "issuetype"])
    }
  }
}`;

// The JWT of the last authenticated Xray Cloud account, kept for the life of
// the process. The credentials are part of the entry so that changing them in
// Settings cannot reuse the previous token.
let cloudToken = null;

/**
 * Forget the cached Xray Cloud JWT.
 */
const resetToken = () => { cloudToken = null; };

/**
 * Turn an axios error into a message worth showing in the UI.
 * @param {Error} error
 * @param {string} what - What was being done, e.g. "authenticate with Xray"
 * @returns {Error}
 */
const describeError = (error, what) => {
  const response = error && error.response;

  if (response) {
    const body = response.data;
    const detail = typeof body === 'string'
      ? body.slice(0, 200)
      : (body && (body.error || body.errorMessages || body.message));
    const suffix = detail ? `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : '';
    return new Error(`Could not ${what} (HTTP ${response.status})${suffix}`);
  }

  return new Error(`Could not ${what}: ${(error && error.message) || String(error)}`);
};

/**
 * Identity of an Xray Cloud account, so a token is only reused for the very
 * same credentials.
 * @param {Object} cloud - Cloud settings
 * @returns {string}
 */
const credentialsId = (cloud) => [cloud.xrayBaseUrl, cloud.clientId, cloud.clientSecret].join('|');

/**
 * Get a JWT for the Xray Cloud API, reusing the cached one when possible.
 *
 * The token is stored as a promise, so concurrent callers share a single
 * authentication request.
 *
 * @param {Object} settings - Full Jira settings
 * @param {boolean} [force] - Ignore the cached token (used after a 401)
 * @returns {Promise<string>} The JWT
 */
const authenticate = (settings, force = false) => {
  const { cloud } = settings;
  const id = credentialsId(cloud);

  if (!force && cloudToken && cloudToken.id === id) {
    return cloudToken.promise;
  }

  const promise = axios
    .post(
      `${cloud.xrayBaseUrl}/api/v2/authenticate`,
      { client_id: cloud.clientId, client_secret: cloud.clientSecret },
      { timeout: TIMEOUT, headers: { 'Content-Type': 'application/json' } }
    )
    .then(response => {
      // The endpoint answers with the token as a quoted JSON string
      const token = typeof response.data === 'string'
        ? response.data.replace(/^"|"$/g, '')
        : String(response.data || '');

      if (!token) {
        throw new Error('Xray returned an empty token');
      }

      return token;
    })
    .catch(error => { throw describeError(error, 'authenticate with Xray Cloud'); });

  cloudToken = { id, promise };

  // A failed authentication must not be remembered
  promise.catch(() => {
    if (cloudToken && cloudToken.promise === promise) { resetToken(); }
  });

  return promise;
};

/**
 * Read a Test's fields out of an Xray Cloud GraphQL result.
 * @param {Object} result - One entry of getTests().results
 * @returns {Object|null} { key, summary, status, issueType, testType, issueId }
 */
const fromGraphql = (result) => {
  const jira = (result && result.jira) || {};
  if (!jira.key) { return null; }

  return {
    key: jira.key,
    summary: jira.summary || null,
    status: (jira.status && (jira.status.name || jira.status)) || null,
    issueType: (jira.issuetype && (jira.issuetype.name || jira.issuetype)) || null,
    testType: (result.testType && result.testType.name) || null,
    issueId: result.issueId || null
  };
};

/**
 * Split an array into chunks of at most "size" items.
 * @param {Array} items
 * @param {number} size
 * @returns {Array<Array>}
 */
const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/**
 * Fetch tests from Xray Cloud, in as few GraphQL calls as possible.
 * @param {Object} settings - Full Jira settings
 * @param {Array<string>} keys - Jira issue keys
 * @returns {Promise<Object>} Tests, keyed by issue key
 */
const fetchCloudTests = async (settings, keys) => {
  const token = await authenticate(settings);
  const found = {};

  for (const batch of chunk(keys, MAX_KEYS_PER_QUERY)) {
    const body = {
      query: TESTS_QUERY,
      variables: { jql: `key in (${batch.join(', ')})`, limit: MAX_KEYS_PER_QUERY }
    };

    const request = (jwt) => axios.post(`${settings.cloud.xrayBaseUrl}/api/v2/graphql`, body, {
      timeout: TIMEOUT,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }
    });

    let response;
    try {
      response = await request(token);
    }
    catch (error) {
      // The JWT lives for ~24h: when it expired mid-process, get a new one
      if (error && error.response && error.response.status === 401) {
        response = await request(await authenticate(settings, true))
          .catch(retryError => { throw describeError(retryError, 'read tests from Xray Cloud'); });
      }
      else {
        throw describeError(error, 'read tests from Xray Cloud');
      }
    }

    const data = response.data || {};

    if (data.errors && data.errors.length) {
      throw new Error(`Xray Cloud: ${data.errors.map(error => error.message).join('; ')}`);
    }

    const results = (data.data && data.data.getTests && data.data.getTests.results) || [];

    results.forEach(result => {
      const test = fromGraphql(result);
      // Keys not returned by Xray simply stay out: the caller reports them
      // as "not found"
      if (test) { found[test.key.toUpperCase()] = test; }
    });
  }

  return found;
};

/**
 * Fetch issues from Jira Server/DC, one request per key (there is no Xray
 * service to batch against on Server/DC).
 * @param {Object} settings - Full Jira settings
 * @param {Array<string>} keys - Jira issue keys
 * @returns {Promise<Object>} Tests, keyed by issue key
 */
const fetchServerTests = async (settings, keys) => {
  const headers = { Authorization: `Bearer ${settings.server.personalAccessToken}` };

  const issues = await Promise.all(keys.map(key => axios
    .get(`${settings.jiraBaseUrl}/rest/api/2/issue/${encodeURIComponent(key)}`, {
      timeout: TIMEOUT,
      headers,
      params: { fields: 'summary,status,issuetype' }
    })
    .then(response => {
      const fields = (response.data && response.data.fields) || {};
      return {
        key: response.data.key || key,
        summary: fields.summary || null,
        status: (fields.status && fields.status.name) || null,
        issueType: (fields.issuetype && fields.issuetype.name) || null,
        testType: null,
        issueId: (response.data && response.data.id) || null
      };
    })
    .catch(error => {
      // A key that does not exist (or the user cannot see) is not an error:
      // the UI shows it as "not found"
      const status = error && error.response && error.response.status;
      if (status === 404 || status === 400) { return null; }
      throw describeError(error, `read ${key} from Jira`);
    })));

  const found = {};
  issues.forEach(issue => {
    if (issue) { found[issue.key.toUpperCase()] = issue; }
  });

  return found;
};

/**
 * Fetch tests with whichever flavour is configured.
 * @param {Object} settings - Full Jira settings
 * @param {Array<string>} keys - Jira issue keys
 * @returns {Promise<Object>} Tests, keyed by issue key
 */
const fetchTests = (settings, keys) => (settings.kind === 'cloud'
  ? fetchCloudTests(settings, keys)
  : fetchServerTests(settings, keys));

/**
 * Validate the stored credentials by actually using them.
 * @param {Object} settings - Full Jira settings
 * @returns {Promise<Object>} Something to show in the UI
 */
const verify = async (settings) => {
  if (settings.kind === 'cloud') {
    await authenticate(settings, true);
    return { kind: 'cloud', message: `Authenticated against ${settings.cloud.xrayBaseUrl}` };
  }

  const response = await axios
    .get(`${settings.jiraBaseUrl}/rest/api/2/myself`, {
      timeout: TIMEOUT,
      headers: { Authorization: `Bearer ${settings.server.personalAccessToken}` }
    })
    .catch(error => { throw describeError(error, 'reach Jira'); });

  const user = (response.data && (response.data.displayName || response.data.name)) || 'unknown user';

  return { kind: 'server', user, message: `Connected to ${settings.jiraBaseUrl} as ${user}` };
};

module.exports = {
  authenticate,
  fetchTests,
  verify,
  resetToken,
  TIMEOUT
};
