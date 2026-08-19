/**
 * The Markdown document of a pulled Xray Test, and where it lives on disk.
 *
 * A pulled test is a regular Markdown flow with no ```step blocks yet: Jira
 * owns the summary and the description, the steps are written here. That
 * split is what makes a second pull safe — only the frontmatter and the
 * description block are rewritten, everything the user added around them
 * survives untouched.
 *
 *   ---
 *   title: Login with valid credentials
 *   xray:
 *     testKey: ABC-123
 *     ...
 *   ---
 *
 *   # Login with valid credentials
 *
 *   <!-- xray:description -->
 *   ...whatever the Jira description says...
 *   <!-- /xray:description -->
 *
 *   ```step
 *   ...written by hand, kept by the next pull...
 *   ```
 */

import * as markdownFlows from '../markdownFlows';

// The description is fenced by markers so a second pull can replace it
// without touching a single line the user wrote around it
const DESCRIPTION_START = '<!-- xray:description -->';
const DESCRIPTION_END = '<!-- /xray:description -->';

// ...and so is the Test Details panel of Xray: the steps of a Manual test,
// the scenario of a Cucumber one, the definition of a Generic one
const DETAILS_START = '<!-- xray:details -->';
const DETAILS_END = '<!-- /xray:details -->';

// Long summaries make for unusable paths: enough to recognise the test, no more
const MAX_SLUG_LENGTH = 60;

// Windows forbids these in a file name, and every platform trips over a slash
// eslint-disable-next-line no-control-regex
const ILLEGAL_CHARACTERS = /[\u0000-\u001f<>:"/\\|?*]/g;

// Names Windows refuses whatever the extension is
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Turn a summary into a file name fragment: lowercase, ASCII, dash separated.
 * @param {string} value
 * @param {string} [fallback] - Used when nothing survives the cleanup
 * @returns {string}
 */
const slug = (value, fallback = 'untitled') => {
  const cleaned = String(value || '')
    .normalize('NFKD')
    // Drop the accents NFKD just split off
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  return cleaned || fallback;
};

/**
 * Clean a folder name coming from Xray's Test Repository, keeping it as close
 * to what the user sees in Xray as the file system allows.
 * @param {string} value
 * @returns {string}
 */
const sanitizeSegment = (value) => {
  const cleaned = String(value || '')
    .replace(ILLEGAL_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    // A name may not end in a dot or a space on Windows
    .replace(/^[.\s]+|[.\s]+$/g, '');

  if (!cleaned || RESERVED_NAMES.test(cleaned)) {
    return cleaned ? `${cleaned}_` : 'untitled';
  }

  return cleaned;
};

/**
 * "<KEY>_<slug of the summary>", the name of a folder or of a file.
 * @param {string} key - Jira issue key
 * @param {string} summary
 * @returns {string}
 */
const keyedName = (key, summary) => `${String(key || '').trim()}_${slug(summary, 'untitled')}`;

/**
 * Replace the description block of a document body, or add one when the
 * document has none yet.
 *
 * @param {string} body - The body of the document (no frontmatter)
 * @param {string} description - Markdown, as it came from Jira
 * @param {string} title - Used as the heading of a brand new document
 * @returns {string} The new body
 */
const withDescriptionBlock = (body, description, title) => {
  const text = String(description || '').trim() || '_No description in Jira._';
  const blockLines = `${DESCRIPTION_START}\n${text}\n${DESCRIPTION_END}`;

  const current = String(body || '').replace(/\r\n?/g, '\n');

  const start = current.indexOf(DESCRIPTION_START);
  const end = current.indexOf(DESCRIPTION_END);

  if (start !== -1 && end > start) {
    // Second pull: only what is between the markers changes
    return `${current.slice(0, start)}${blockLines}${current.slice(end + DESCRIPTION_END.length)}`;
  }

  const rest = current.trim();

  if (!rest) {
    return `# ${title || 'Untitled test'}\n\n${blockLines}\n`;
  }

  // The document exists but was never pulled: keep its heading on top and
  // slide the description underneath it, so nothing the user wrote is lost
  const heading = rest.match(/^(#[^\n]*)\n?/);

  if (heading) {
    const after = rest.slice(heading[0].length).replace(/^\n+/, '');
    return `${heading[1]}\n\n${blockLines}\n${after ? `\n${after}\n` : ''}`;
  }

  return `${blockLines}\n\n${rest}\n`;
};

/**
 * Trim a piece of text coming from Jira/Xray, or say there is none.
 * @param {*} value
 * @returns {string|null}
 */
const trimmed = (value) => String(value === null || value === undefined ? '' : value).trim() || null;

/**
 * A code fence long enough to hold text that has fences of its own.
 * @param {string} text
 * @returns {string}
 */
const fenceFor = (text) => {
  const longest = String(text || '').match(/`{3,}/g) || [];
  const length = longest.reduce((max, run) => Math.max(max, run.length), 2);
  return '`'.repeat(length + 1);
};

/**
 * One Manual step, as Xray shows it: what to do, what to do it with, and
 * what should happen.
 * @param {Object} step - { action, data, result }
 * @param {number} index - Zero based
 * @returns {string} Markdown
 */
const stepSection = (step, index) => {
  const lines = [`### Step ${index + 1}`, '', trimmed(step && step.action) || '_No action._'];

  const data = trimmed(step && step.data);
  if (data) { lines.push('', '**Data**', '', data); }

  const result = trimmed(step && step.result);
  if (result) { lines.push('', '**Expected result**', '', result); }

  return lines.join('\n');
};

/**
 * The Test Details of a test, as Markdown.
 *
 * What a Test holds depends on what it is: a Manual test has steps, a
 * Cucumber test a Gherkin scenario, a Generic test a definition. Whatever
 * Xray answered is written, and a test with nothing in it says so rather
 * than leaving a block that looks half written.
 *
 * @param {Object} details - { testType, steps, gherkin, unstructured }
 * @returns {string} Markdown, without the markers
 */
const detailsMarkdown = (details) => {
  const sections = ['## Test details'];

  const testType = trimmed(details && details.testType);
  if (testType) { sections.push(`**Test type:** ${testType}`); }

  const steps = (details && details.steps) || [];
  const gherkin = trimmed(details && details.gherkin);
  const unstructured = trimmed(details && details.unstructured);

  steps.forEach((step, index) => sections.push(stepSection(step, index)));

  if (gherkin) {
    const fence = fenceFor(gherkin);
    sections.push(`${fence}gherkin\n${gherkin}\n${fence}`);
  }

  if (unstructured) {
    const fence = fenceFor(unstructured);
    sections.push(`${fence}\n${unstructured}\n${fence}`);
  }

  if (!steps.length && !gherkin && !unstructured) {
    sections.push('_This test has no details in Xray._');
  }

  return sections.join('\n\n');
};

/**
 * Replace the Test Details block of a document body, add one when the
 * document has none yet, or leave the body exactly as it is when this pull
 * could not read the details at all.
 *
 * A brand new block goes right under the description, so the file reads the
 * way Xray does: what the test is, then what it says to do — and whatever
 * the user wrote below stays below.
 *
 * @param {string} body - The body of the document (no frontmatter)
 * @param {Object|null} details - See detailsMarkdown, or null when unknown
 * @returns {string} The new body
 */
const withDetailsBlock = (body, details) => {
  const current = String(body || '').replace(/\r\n?/g, '\n');

  // "Xray was not asked" is not "Xray has nothing": a pull that could not
  // read the details must not wipe the ones a previous pull wrote
  if (!details) { return current; }

  const block = `${DETAILS_START}\n${detailsMarkdown(details)}\n${DETAILS_END}`;

  const start = current.indexOf(DETAILS_START);
  const end = current.indexOf(DETAILS_END);

  if (start !== -1 && end > start) {
    return `${current.slice(0, start)}${block}${current.slice(end + DETAILS_END.length)}`;
  }

  const afterDescription = current.indexOf(DESCRIPTION_END);

  if (afterDescription !== -1) {
    const cut = afterDescription + DESCRIPTION_END.length;
    const rest = current.slice(cut).replace(/^\n+/, '');
    return `${current.slice(0, cut)}\n\n${block}\n${rest ? `\n${rest}` : ''}`;
  }

  const rest = current.trim();

  return rest ? `${rest}\n\n${block}\n` : `${block}\n`;
};

/**
 * The frontmatter of a pulled test: what Jira owns comes first and is always
 * rewritten, anything the user added to the file is kept as it was.
 *
 * Nothing that changes on its own — a timestamp of the pull, say — is written
 * here: a pull that touched no test must leave every file byte for byte as it
 * was, so a diff after a pull is a diff of what Jira changed.
 *
 * @param {Object} current - The frontmatter already in the file
 * @param {Object} test - { key, summary, status, issueType, testType, url,
 *                          folder, feature, userStory }
 * @returns {Object} The frontmatter to write
 */
const frontmatter = (current, test) => {
  const xray: Record<string, any> = { testKey: test.key };

  // Only the fields this pull could actually resolve are written: an empty
  // property reads as "Jira says nothing", which is not what we know
  if (test.status) { xray.status = test.status; }
  if (test.issueType) { xray.issueType = test.issueType; }
  if (test.testType) { xray.testType = test.testType; }
  if (test.folder) { xray.folder = test.folder; }
  if (test.feature) { xray.feature = test.feature; }
  if (test.userStory) { xray.userStory = test.userStory; }
  if (test.url) { xray.url = test.url; }

  const next = {
    title: test.summary || test.key,
    xray
  };

  Object.entries(current || {}).forEach(([key, value]) => {
    if (key === 'title' || key === 'xray') { return; }
    next[key] = value;
  });

  return next;
};

/**
 * Build the document to write for a test, merging into whatever is already
 * on disk.
 *
 * @param {string|null} existing - The current file content, or null when new
 * @param {Object} test - See frontmatter()
 * @returns {string} The full Markdown document
 */
const build = (existing, test) => {
  const { meta, body } = markdownFlows.parseFrontmatter(existing || '');

  const described = withDescriptionBlock(body, test.description, test.summary || test.key);

  return markdownFlows.withFrontmatter(
    withDetailsBlock(described, test.details),
    frontmatter(meta, test)
  );
};

export {
  build,
  frontmatter,
  withDescriptionBlock,
  withDetailsBlock,
  detailsMarkdown,
  keyedName,
  sanitizeSegment,
  slug,
  DESCRIPTION_START,
  DESCRIPTION_END,
  DETAILS_START,
  DETAILS_END
};
