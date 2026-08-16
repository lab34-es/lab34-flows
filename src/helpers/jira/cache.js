/**
 * Lazy, in-memory cache of the Jira/Xray data shown next to a flow.
 *
 * Nothing is downloaded when the tool starts, when a flow runs or when the
 * tree is listed: the frontend asks for the keys of the flow it is about to
 * render, and only the keys that were never seen before reach Jira. From
 * then on they are served from memory until the process restarts.
 *
 * The Map holds promises, not values, so two requests that need the same key
 * at the same time share a single download.
 */

// key (uppercase) -> Promise<{ key, found, ... }>
const entries = new Map();

/**
 * Keys look like "BOP-1234". Anything else is rejected before it can reach a
 * JQL query.
 */
const KEY_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*-\d+$/;

/**
 * Whether a string is a usable Jira issue key.
 * @param {*} key
 * @returns {boolean}
 */
const isValidKey = (key) => typeof key === 'string' && KEY_PATTERN.test(key.trim().toUpperCase());

/**
 * Normalize the keys of a request: uppercase, valid, unique.
 * @param {Array<string>} keys
 * @returns {Array<string>}
 */
const normalizeKeys = (keys) => {
  const seen = new Set();

  (Array.isArray(keys) ? keys : []).forEach(key => {
    if (!isValidKey(key)) { return; }
    seen.add(String(key).trim().toUpperCase());
  });

  return [...seen];
};

/**
 * Store a pending download, forgetting it if it fails so a later request can
 * try again (a wrong password or a flaky network must not poison the cache
 * until the process restarts).
 * @param {string} key
 * @param {Promise<Object>} promise
 * @returns {Promise<Object>}
 */
const remember = (key, promise) => {
  entries.set(key, promise);

  promise.catch(() => {
    if (entries.get(key) === promise) { entries.delete(key); }
  });

  return promise;
};

/**
 * Resolve a list of keys, downloading only what is missing.
 *
 * @param {Array<string>} keys - Jira issue keys
 * @param {Function} fetcher - (keys) => Promise<Object keyed by issue key>
 * @returns {Promise<Object>} Records keyed by issue key. Each record is
 *   { key, found: true, summary, status, issueType, testType, issueId },
 *   { key, found: false } or { key, error }
 */
const resolve = async (keys, fetcher) => {
  const wanted = normalizeKeys(keys);
  const missing = wanted.filter(key => !entries.has(key));

  if (missing.length) {
    // One download for every key this process has never seen
    const batch = fetcher(missing);

    missing.forEach(key => remember(key, batch.then(found => (found[key]
      ? { ...found[key], key, found: true }
      : { key, found: false }))));
  }

  const records = await Promise.all(wanted.map(key => entries.get(key).then(
    record => record,
    error => ({ key, error: (error && error.message) || String(error) })
  )));

  const result = {};
  records.forEach(record => { result[record.key] = record; });

  return result;
};

/**
 * Empty the cache. Called when the settings change, so the next render talks
 * to the newly configured Jira.
 */
const clear = () => { entries.clear(); };

/**
 * How many keys are currently cached. Only used by the tests.
 * @returns {number}
 */
const size = () => entries.size;

module.exports = {
  resolve,
  clear,
  size,
  isValidKey,
  normalizeKeys
};
