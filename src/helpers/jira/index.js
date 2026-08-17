/**
 * Jira / Xray integration.
 *
 * A flow is an Xray Test, and every ```step block of the flow is one of its
 * steps. The link is declared in the flow itself, in its frontmatter:
 *
 *   ---
 *   title: Fraud detection
 *   xray:
 *     testKey: BOP-1234
 *   ---
 *
 * The settings live in the context folder, at config/jira.json:
 *
 *   {
 *     "kind": "cloud",
 *     "jiraBaseUrl": "https://acme.atlassian.net",
 *     "projectKey": "BOP",
 *     "cloud":  { "xrayBaseUrl": "https://xray.cloud.getxray.app",
 *                 "clientId": "...", "clientSecret": "..." },
 *     "basic":  { "email": "me@acme.com", "apiToken": "..." },
 *     "server": { "personalAccessToken": "..." }
 *   }
 *
 * Secrets never leave the machine through this module: everything the UI
 * reads goes through `getSettings`, which replaces them with the
 * "hasClientSecret" / "hasApiToken" / "hasToken" booleans.
 */

const configHelper = require('../config');
const client = require('./client');
const cache = require('./cache');
const pull = require('./pull');

const CONFIG_NAME = 'jira';

const DEFAULT_XRAY_BASE_URL = 'https://xray.cloud.getxray.app';

const KINDS = [
  {
    id: 'cloud',
    label: 'Xray Cloud',
    hint: 'Jira Cloud + Xray. Create an API key in Jira > Apps > Xray > API Keys.'
  },
  {
    id: 'basic',
    label: 'Jira Cloud (API token)',
    hint: 'Jira Cloud without an Xray API key: sign in with your email and an Atlassian API token from id.atlassian.com > Security > API tokens. Xray test types are not available this way.'
  },
  {
    id: 'server',
    label: 'Jira Server / Data Center',
    hint: 'Xray for Server/DC talks to Jira directly. Create a token in your Jira profile > Personal Access Tokens.'
  }
];

const KIND_IDS = KINDS.map(kind => kind.id);

/**
 * Trim a base URL so it can be concatenated with a path.
 * @param {*} value
 * @returns {string}
 */
const cleanUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

/**
 * Normalize a raw config file into the current shape.
 * @param {Object} raw - Contents of config/jira.json
 * @returns {Object} { kind, jiraBaseUrl, projectKey, cloud, server }
 */
const normalize = (raw) => {
  const source = (raw && typeof raw === 'object') ? raw : {};
  const cloud = (source.cloud && typeof source.cloud === 'object') ? source.cloud : {};
  const basic = (source.basic && typeof source.basic === 'object') ? source.basic : {};
  const server = (source.server && typeof source.server === 'object') ? source.server : {};

  return {
    kind: KIND_IDS.includes(source.kind) ? source.kind : KIND_IDS[0],
    jiraBaseUrl: cleanUrl(source.jiraBaseUrl),
    projectKey: String(source.projectKey || '').trim(),
    cloud: {
      xrayBaseUrl: cleanUrl(cloud.xrayBaseUrl) || DEFAULT_XRAY_BASE_URL,
      clientId: String(cloud.clientId || '').trim(),
      clientSecret: cloud.clientSecret || undefined
    },
    basic: {
      email: String(basic.email || '').trim(),
      apiToken: basic.apiToken || undefined
    },
    server: {
      personalAccessToken: server.personalAccessToken || undefined
    }
  };
};

/**
 * Load the settings as stored on disk, secrets included. Internal use only.
 * @returns {Promise<Object>}
 */
const loadSettings = async () => normalize(await configHelper.load(CONFIG_NAME));

/**
 * Whether the integration has everything it needs to reach Jira/Xray.
 * @param {Object} settings - Full settings, as returned by loadSettings
 * @returns {boolean}
 */
const isConfigured = (settings) => {
  if (!settings) { return false; }

  if (settings.kind === 'cloud') {
    return Boolean(settings.cloud.xrayBaseUrl && settings.cloud.clientId && settings.cloud.clientSecret);
  }

  if (settings.kind === 'basic') {
    return Boolean(settings.jiraBaseUrl && settings.basic.email && settings.basic.apiToken);
  }

  return Boolean(settings.jiraBaseUrl && settings.server.personalAccessToken);
};

/**
 * Settings as the UI sees them: no secrets, just whether one is stored.
 * @returns {Promise<Object>}
 */
const getSettings = async () => {
  const settings = await loadSettings();

  return {
    kind: settings.kind,
    jiraBaseUrl: settings.jiraBaseUrl,
    projectKey: settings.projectKey,
    cloud: {
      xrayBaseUrl: settings.cloud.xrayBaseUrl,
      clientId: settings.cloud.clientId,
      hasClientSecret: Boolean(settings.cloud.clientSecret)
    },
    basic: {
      email: settings.basic.email,
      hasApiToken: Boolean(settings.basic.apiToken)
    },
    server: {
      hasToken: Boolean(settings.server.personalAccessToken)
    },
    available: KINDS,
    defaultXrayBaseUrl: DEFAULT_XRAY_BASE_URL,
    configured: isConfigured(settings)
  };
};

/**
 * Read a secret coming from the client: undefined keeps the stored one (the
 * UI never receives it, so it cannot send it back), null clears it.
 * @param {*} incoming - Value sent by the client
 * @param {*} stored - Value currently on disk
 * @returns {string|undefined}
 */
const nextSecret = (incoming, stored) => {
  if (incoming === undefined) { return stored; }
  if (incoming === null) { return undefined; }
  return String(incoming).trim() || undefined;
};

/**
 * Update the settings.
 *
 * @param {Object} body - { kind, jiraBaseUrl, projectKey,
 *                          cloud: { xrayBaseUrl, clientId, clientSecret },
 *                          basic: { email, apiToken },
 *                          server: { personalAccessToken } }
 * @returns {Promise<Object>} The public settings, as returned by getSettings
 */
const saveSettings = async (body) => {
  const input = (body && typeof body === 'object') ? body : {};
  const current = await loadSettings();

  if (input.kind !== undefined && !KIND_IDS.includes(input.kind)) {
    throw new Error(`Unknown Jira integration type "${input.kind}"`);
  }

  const inputCloud = (input.cloud && typeof input.cloud === 'object') ? input.cloud : {};
  const inputBasic = (input.basic && typeof input.basic === 'object') ? input.basic : {};
  const inputServer = (input.server && typeof input.server === 'object') ? input.server : {};

  const next = {
    kind: input.kind || current.kind,
    jiraBaseUrl: input.jiraBaseUrl === undefined ? current.jiraBaseUrl : cleanUrl(input.jiraBaseUrl),
    projectKey: input.projectKey === undefined
      ? current.projectKey
      : String(input.projectKey || '').trim(),
    cloud: {
      xrayBaseUrl: inputCloud.xrayBaseUrl === undefined
        ? current.cloud.xrayBaseUrl
        : (cleanUrl(inputCloud.xrayBaseUrl) || DEFAULT_XRAY_BASE_URL),
      clientId: inputCloud.clientId === undefined
        ? current.cloud.clientId
        : String(inputCloud.clientId || '').trim(),
      clientSecret: nextSecret(inputCloud.clientSecret, current.cloud.clientSecret)
    },
    basic: {
      email: inputBasic.email === undefined
        ? current.basic.email
        : String(inputBasic.email || '').trim(),
      apiToken: nextSecret(inputBasic.apiToken, current.basic.apiToken)
    },
    server: {
      personalAccessToken: nextSecret(inputServer.personalAccessToken, current.server.personalAccessToken)
    }
  };

  if (next.jiraBaseUrl && !/^https?:\/\//i.test(next.jiraBaseUrl)) {
    throw new Error('The Jira URL must start with http:// or https://');
  }

  if (next.cloud.xrayBaseUrl && !/^https?:\/\//i.test(next.cloud.xrayBaseUrl)) {
    throw new Error('The Xray URL must start with http:// or https://');
  }

  await configHelper.save(CONFIG_NAME, next);

  // The next flow that is rendered must see the newly configured Jira
  cache.clear();
  client.resetToken();

  return getSettings();
};

/**
 * Validate the stored credentials against Jira/Xray.
 * @returns {Promise<Object>} { kind, message, ... }
 */
const test = async () => {
  const settings = await loadSettings();

  if (!isConfigured(settings)) {
    if (settings.kind === 'cloud') {
      throw new Error('Add the Xray client id and client secret first.');
    }
    if (settings.kind === 'basic') {
      throw new Error('Add the Jira URL, your email and an API token first.');
    }
    throw new Error('Add the Jira URL and a personal access token first.');
  }

  return client.verify(settings);
};

/**
 * Xray data for a list of test keys, downloading only the ones this process
 * has never seen. When the integration is not configured, nothing is
 * downloaded and the caller gets an empty answer, so the UI shows no Xray
 * information at all.
 *
 * @param {Array<string>} keys - Jira issue keys, e.g. ['BOP-1', 'BOP-2']
 * @returns {Promise<Object>} { configured, jiraBaseUrl, tests }
 */
const getTests = async (keys) => {
  const settings = await loadSettings();

  const answer = {
    configured: isConfigured(settings),
    jiraBaseUrl: settings.jiraBaseUrl,
    tests: {}
  };

  if (!answer.configured) {
    return answer;
  }

  answer.tests = await cache.resolve(keys, missing => client.fetchTests(settings, missing));

  return answer;
};

/**
 * Download every test of the configured project into the flows folder. See
 * ./pull for what lands where.
 *
 * @param {Object} [options] - { io } - the socket.io server, when there is one
 * @returns {Promise<Object>} The progress, as it stands at the first tick
 */
const startPull = async (options) => {
  const settings = await loadSettings();

  if (!isConfigured(settings)) {
    throw new Error('Configure the Jira / Xray integration first.');
  }

  return pull.start(settings, options);
};

module.exports = {
  loadSettings,
  getSettings,
  saveSettings,
  isConfigured,
  normalize,
  test,
  getTests,
  startPull,
  cancelPull: pull.cancel,
  pullStatus: pull.status,
  clearCache: cache.clear,
  KIND_IDS,
  KINDS,
  DEFAULT_XRAY_BASE_URL
};
