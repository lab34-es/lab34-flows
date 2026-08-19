/**
 * The Jira projects a pull covers.
 *
 * The integration is not tied to a single project: the settings hold a comma
 * separated list of project keys, and a pull walks them one after the other,
 * writing each project into its own folder — see ./pull.
 *
 * Both the settings (./index) and the pull read that list through here, so
 * "ABC, ACME", ["ABC", "ACME"] and the single "ABC" older settings stored all
 * mean the same thing.
 */

// What Jira accepts as a project key — and what a pull is allowed to turn
// into a folder name
const PROJECT_KEY = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * The project keys held by a settings value, whatever shape it came in.
 * Blanks and repeats go; the order the user typed them in stays.
 *
 * @param {*} value - "ABC, ACME", ["ABC", "ACME"] or "ABC"
 * @returns {Array<string>}
 */
const parseKeys = (value) => {
  const raw = Array.isArray(value)
    ? value
    : String(value === undefined || value === null ? '' : value).split(',');

  const found: string[] = [];
  const seen = new Set<string>();

  raw.forEach(item => {
    const key = String(item === undefined || item === null ? '' : item).trim();

    if (!key || seen.has(key.toUpperCase())) { return; }

    seen.add(key.toUpperCase());
    found.push(key);
  });

  return found;
};

/**
 * The first key that is not one, so the caller can say which.
 * @param {Array<string>} keys
 * @returns {string|undefined}
 */
const firstInvalid = (keys) => (keys || []).find(key => !PROJECT_KEY.test(key));

export { PROJECT_KEY, parseKeys, firstInvalid };
