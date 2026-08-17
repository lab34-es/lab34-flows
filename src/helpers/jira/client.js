/**
 * Raw HTTP access to Xray Cloud and to Jira Server/DC.
 *
 * Nothing here is cached except the Xray Cloud JWT, which is expensive to
 * obtain and lives for about 24h: see ./cache.js for the test data cache.
 */

const axios = require('axios');

// Jira/Xray are external services: never let a hung request block a render
const TIMEOUT = 15000;

// A pull walks whole projects: those requests are allowed to take longer
// than the ones a render waits for
const PULL_TIMEOUT = 60000;

// Xray Cloud's GraphQL API caps getTests at 100 results per call
const MAX_KEYS_PER_QUERY = 100;

// Jira's search endpoints cap a page at 100 issues too
const SEARCH_PAGE_SIZE = 100;

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

// The same query, page by page and with everything a pulled file needs: the
// Test Repository folder it sits in, and the description that becomes the
// body of the Markdown document
const ALL_TESTS_QUERY = `query allTests($jql: String!, $limit: Int!, $start: Int!) {
  getTests(jql: $jql, limit: $limit, start: $start) {
    total
    start
    limit
    results {
      issueId
      testType { name }
      folder { path }
      jira(fields: ["key", "summary", "description", "status", "issuetype"])
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
 * Run a GraphQL query against Xray Cloud, renewing the JWT when it expired
 * halfway through.
 *
 * @param {Object} settings - Full Jira settings
 * @param {Object} body - { query, variables }
 * @param {Object} [options] - { timeout }
 * @returns {Promise<Object>} The "data" of the answer
 */
const graphql = async (settings, body, { timeout = TIMEOUT } = {}) => {
  const token = await authenticate(settings);

  const request = (jwt) => axios.post(`${settings.cloud.xrayBaseUrl}/api/v2/graphql`, body, {
    timeout,
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

  return data.data || {};
};

/**
 * Fetch tests from Xray Cloud, in as few GraphQL calls as possible.
 * @param {Object} settings - Full Jira settings
 * @param {Array<string>} keys - Jira issue keys
 * @returns {Promise<Object>} Tests, keyed by issue key
 */
const fetchCloudTests = async (settings, keys) => {
  const found = {};

  for (const batch of chunk(keys, MAX_KEYS_PER_QUERY)) {
    const data = await graphql(settings, {
      query: TESTS_QUERY,
      variables: { jql: `key in (${batch.join(', ')})`, limit: MAX_KEYS_PER_QUERY }
    });

    const results = (data.getTests && data.getTests.results) || [];

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
 * Walk every Test of a JQL query in Xray Cloud, page by page, handing each
 * page to the caller as soon as it arrives. Used by the pull, which writes
 * files while the next page is still downloading.
 *
 * @param {Object} settings - Full Jira settings
 * @param {Object} options
 * @param {string} options.jql - Which tests to walk, e.g. 'project = "BOP"'
 * @param {Function} options.onPage - async (tests, total) => void. Each test is
 *   { key, summary, description, status, issueType, testType, issueId, folder }
 * @param {Function} [options.stopped] - () => boolean, checked between pages
 * @returns {Promise<number>} How many tests were handed over
 */
const walkCloudTests = async (settings, { jql, onPage, stopped }) => {
  let start = 0;
  let seen = 0;

  for (;;) {
    const data = await graphql(settings, {
      query: ALL_TESTS_QUERY,
      variables: { jql, limit: MAX_KEYS_PER_QUERY, start }
    }, { timeout: PULL_TIMEOUT });

    const page = (data.getTests && data.getTests.results) || [];
    const total = (data.getTests && data.getTests.total) || 0;

    if (!page.length) { return seen; }

    await onPage(page.map(result => {
      const jira = result.jira || {};
      return {
        ...(fromGraphql(result) || { key: jira.key }),
        description: jira.description || null,
        folder: (result.folder && result.folder.path) || null
      };
    }).filter(test => test.key), total);

    seen += page.length;
    start += page.length;

    if (seen >= total || (stopped && stopped())) { return seen; }
  }
};

/**
 * The Authorization header for plain Jira REST access: Basic auth (email +
 * Atlassian API token) on Jira Cloud, Bearer (personal access token) on
 * Server/DC.
 * @param {Object} settings - Full Jira settings
 * @returns {Object} Headers for axios
 */
const jiraRestHeaders = (settings) => {
  if (settings.kind === 'basic') {
    const pair = `${settings.basic.email}:${settings.basic.apiToken}`;
    return { Authorization: `Basic ${Buffer.from(pair, 'utf8').toString('base64')}` };
  }

  return { Authorization: `Bearer ${settings.server.personalAccessToken}` };
};

/**
 * Fetch issues through the plain Jira REST API, one request per key (there is
 * no Xray GraphQL service to batch against). Used for Jira Server/DC and for
 * Jira Cloud with Basic auth: on both, testType stays null.
 * @param {Object} settings - Full Jira settings
 * @param {Array<string>} keys - Jira issue keys
 * @returns {Promise<Object>} Tests, keyed by issue key
 */
const fetchJiraTests = async (settings, keys) => {
  const headers = jiraRestHeaders(settings);

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
  : fetchJiraTests(settings, keys));

/* ------------------------------- Searching ------------------------------- */

/**
 * Jira Cloud retired GET /rest/api/2/search in favour of the token-paginated
 * /rest/api/2/search/jql; Jira Server/DC only ever had the former. Whichever
 * one this instance answers is remembered per base URL, so the fallback is
 * paid once.
 */
const searchStyles = new Map();

/**
 * One page of a JQL search, whichever endpoint this Jira understands.
 * @param {Object} settings - Full Jira settings
 * @param {Object} cursor - { jql, fields, nextPageToken, startAt }
 * @returns {Promise<Object>} { issues, nextPageToken, startAt, total }
 */
const searchPage = async (settings, cursor) => {
  const headers = jiraRestHeaders(settings);
  const style = searchStyles.get(settings.jiraBaseUrl) || 'enhanced';

  const common = {
    jql: cursor.jql,
    fields: (cursor.fields || []).join(','),
    maxResults: SEARCH_PAGE_SIZE
  };

  if (style === 'enhanced') {
    const params = { ...common };
    if (cursor.nextPageToken) { params.nextPageToken = cursor.nextPageToken; }

    try {
      const response = await axios.get(`${settings.jiraBaseUrl}/rest/api/2/search/jql`, {
        timeout: PULL_TIMEOUT, headers, params
      });

      searchStyles.set(settings.jiraBaseUrl, 'enhanced');

      return {
        issues: (response.data && response.data.issues) || [],
        nextPageToken: (response.data && response.data.nextPageToken) || null,
        total: (response.data && response.data.total) || null
      };
    }
    catch (error) {
      const status = error && error.response && error.response.status;

      // Not there: this is a Jira that still has the classic endpoint
      if (status !== 404 && status !== 405 && status !== 410) {
        throw describeError(error, 'search issues in Jira');
      }

      searchStyles.set(settings.jiraBaseUrl, 'classic');
    }
  }

  const response = await axios
    .get(`${settings.jiraBaseUrl}/rest/api/2/search`, {
      timeout: PULL_TIMEOUT,
      headers,
      params: { ...common, startAt: cursor.startAt || 0 }
    })
    .catch(error => { throw describeError(error, 'search issues in Jira'); });

  const data = response.data || {};
  const issues = data.issues || [];

  return {
    issues,
    startAt: (data.startAt || 0) + issues.length,
    total: typeof data.total === 'number' ? data.total : null
  };
};

/**
 * Walk every issue of a JQL query, handing each page to the caller as soon as
 * it arrives.
 *
 * @param {Object} settings - Full Jira settings
 * @param {Object} options
 * @param {string} options.jql
 * @param {Array<string>} options.fields - Jira field names to ask for
 * @param {Function} options.onPage - async (issues, total) => void
 * @param {Function} [options.stopped] - () => boolean, checked between pages
 * @returns {Promise<number>} How many issues were handed over
 */
const searchIssues = async (settings, { jql, fields, onPage, stopped }) => {
  let cursor = { jql, fields };
  let seen = 0;

  for (;;) {
    const page = await searchPage(settings, cursor);

    if (!page.issues.length) { return seen; }

    await onPage(page.issues, page.total);
    seen += page.issues.length;

    if (stopped && stopped()) { return seen; }

    // The enhanced endpoint stops by dropping the token, the classic one by
    // answering with fewer issues than a full page
    if (page.nextPageToken) {
      cursor = { jql, fields, nextPageToken: page.nextPageToken };
      continue;
    }

    if (page.startAt !== undefined && page.issues.length === SEARCH_PAGE_SIZE) {
      cursor = { jql, fields, startAt: page.startAt };
      continue;
    }

    return seen;
  }
};

/**
 * How many issues a JQL query matches, so a pull can show real progress.
 * Returns null when Jira will not say, which only costs the progress bar its
 * percentage.
 *
 * @param {Object} settings - Full Jira settings
 * @param {string} jql
 * @returns {Promise<number|null>}
 */
const countIssues = async (settings, jql) => {
  const headers = jiraRestHeaders(settings);

  const approximate = await axios
    .post(`${settings.jiraBaseUrl}/rest/api/2/search/approximate-count`, { jql }, {
      timeout: TIMEOUT,
      headers: { ...headers, 'Content-Type': 'application/json' }
    })
    .then(response => (response.data && typeof response.data.count === 'number' ? response.data.count : null))
    .catch(() => null);

  if (approximate !== null) { return approximate; }

  return axios
    .get(`${settings.jiraBaseUrl}/rest/api/2/search`, {
      timeout: TIMEOUT, headers, params: { jql, maxResults: 0 }
    })
    .then(response => (response.data && typeof response.data.total === 'number' ? response.data.total : null))
    .catch(() => null);
};

/**
 * Read a set of issues in as few searches as possible. Used to resolve the
 * parents of a batch of tests without one request per issue.
 *
 * @param {Object} settings - Full Jira settings
 * @param {Array<string>} keys - Jira issue keys
 * @param {Array<string>} fields - Jira field names to ask for
 * @returns {Promise<Object>} Raw Jira issues, keyed by uppercase issue key
 */
const fetchIssuesByKeys = async (settings, keys, fields) => {
  const found = {};

  for (const batch of chunk(keys, MAX_KEYS_PER_QUERY)) {
    await searchIssues(settings, {
      jql: `key in (${batch.join(', ')})`,
      fields,
      onPage: (issues) => {
        issues.forEach(issue => {
          if (issue && issue.key) { found[issue.key.toUpperCase()] = issue; }
        });
      }
    });
  }

  return found;
};

/**
 * The id of a Jira field, by name — "Epic Link" is a custom field, and its id
 * differs from one instance to the next.
 *
 * @param {Object} settings - Full Jira settings
 * @param {string} name - The field name as Jira displays it
 * @returns {Promise<string|null>}
 */
const fieldId = async (settings, name) => axios
  .get(`${settings.jiraBaseUrl}/rest/api/2/field`, {
    timeout: TIMEOUT, headers: jiraRestHeaders(settings)
  })
  .then(response => {
    const fields = Array.isArray(response.data) ? response.data : [];
    const match = fields.find(field => String(field.name || '').toLowerCase() === name.toLowerCase());
    return (match && match.id) || null;
  })
  // A user without admin rights may not list the fields: the pull carries on
  // with whatever the issues themselves say
  .catch(() => null);

/* -------------------------- Xray Server/DC folders ------------------------ */

/**
 * The Test Repository of a project on Xray for Server/DC: which folder every
 * test sits in.
 *
 * Xray Cloud answers this as part of the GraphQL query, Server/DC only
 * through its own REST API, and only to users who can see the project. When
 * it cannot be read the pull falls back to a flat folder, so this never
 * throws.
 *
 * @param {Object} settings - Full Jira settings
 * @param {string} projectKey
 * @returns {Promise<Object>} Folder path ("/A/B"), keyed by uppercase test key
 */
const fetchServerRepository = async (settings, projectKey) => {
  const headers = jiraRestHeaders(settings);
  const base = `${settings.jiraBaseUrl}/rest/raven/1.0/api/testrepository/${encodeURIComponent(projectKey)}/folders`;

  const root = await axios
    .get(base, { timeout: PULL_TIMEOUT, headers })
    .then(response => response.data)
    .catch(() => null);

  if (!root) { return {}; }

  const paths = {};

  // Depth first, so a folder is asked for its tests right after its name is
  // known — the tree is small, the test lists are not
  const walk = async (folder, prefix) => {
    const path = folder.id === -1 || !folder.name ? prefix : `${prefix}/${folder.name}`;

    if (folder.id !== undefined && folder.id !== -1) {
      const tests = await axios
        .get(`${base}/${encodeURIComponent(folder.id)}/tests`, { timeout: PULL_TIMEOUT, headers })
        .then(response => {
          const data = response.data;
          return (data && Array.isArray(data.tests) ? data.tests : (Array.isArray(data) ? data : []));
        })
        .catch(() => []);

      tests.forEach(test => {
        if (test && test.key) { paths[String(test.key).toUpperCase()] = path || '/'; }
      });
    }

    for (const child of (folder.folders || [])) {
      await walk(child, path);
    }
  };

  await walk(root, '');

  return paths;
};

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
      headers: jiraRestHeaders(settings)
    })
    .catch(error => { throw describeError(error, 'reach Jira'); });

  const user = (response.data && (response.data.displayName || response.data.name)) || 'unknown user';

  return { kind: settings.kind, user, message: `Connected to ${settings.jiraBaseUrl} as ${user}` };
};

module.exports = {
  authenticate,
  fetchTests,
  verify,
  resetToken,
  walkCloudTests,
  searchIssues,
  countIssues,
  fetchIssuesByKeys,
  fetchServerRepository,
  fieldId,
  TIMEOUT,
  PULL_TIMEOUT
};
