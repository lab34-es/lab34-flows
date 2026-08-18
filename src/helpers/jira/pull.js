/**
 * Pull every Xray Test of a project into the flows folder.
 *
 * The tests land under "flows/xray", and how they are laid out inside it
 * depends on what the integration can actually see:
 *
 *   - Xray Cloud and Xray Server/DC know their own Test Repository, so the
 *     folders on disk are the folders the user sees in Xray.
 *
 *   - Jira Cloud with an API token has no Xray API to ask, so the layout is
 *     rebuilt from Jira's own hierarchy:
 *
 *       xray/<FEATURE>_<slug>/<STORY>_<slug>/<TEST>_<slug>.md
 *
 *     A test that is not a child of anything gets its feature and story from
 *     its related work — the parent field first, then the issue links — and
 *     whatever cannot be resolved falls back to "_no-feature" /
 *     "_no-user-story" rather than being dropped.
 *
 * A pull is repeatable: a test that moved is moved on disk instead of being
 * duplicated, and only the frontmatter, the description block and the test
 * details block of a file are rewritten — see ./testDoc. Whether a test that
 * is already on disk is rewritten at all is the user's call: with "overwrite"
 * off, a flow whose frontmatter already carries that xray.testKey is left
 * exactly as it is and counted as skipped.
 *
 * One pull runs at a time, and its progress is both readable (status()) and
 * pushed over the socket, because the UI shows it in a modal.
 */

const fs = require('fs');
const path = require('path');

const flows = require('../flows');
const markdownFlows = require('../markdownFlows');
const client = require('./client');
const adf = require('./adf');
const testDoc = require('./testDoc');

// Everything a pull writes lives here, relative to the flows directory
const ROOT = 'xray';

// Where a test goes when Jira has nothing to say about its hierarchy
const NO_FEATURE = '_no-feature';
const NO_STORY = '_no-user-story';

// The socket carries one message per test: enough to see it move, not enough
// to flood the UI
const EMIT_INTERVAL = 200;

// Only the tail of the log is kept: the counters carry the whole story
const LOG_LIMIT = 200;

// The Jira fields a pulled test is built from
const TEST_FIELDS = ['summary', 'description', 'status', 'issuetype', 'parent', 'issuelinks'];

// Where Xray for Server/DC keeps the Test Details that are not steps. They
// are ordinary Jira custom fields, so they are read with the issue itself —
// a Jira that does not have them simply resolves to nothing.
const DETAIL_FIELDS = [
  { name: 'Test Type', as: 'testType' },
  { name: 'Cucumber Scenario', as: 'gherkin' },
  { name: 'Generic Test Definition', as: 'unstructured' }
];

// How many tests are asked for their steps at once on Server/DC: enough to
// keep the pull moving, few enough not to hammer Jira
const STEP_CONCURRENCY = 5;

// ...and the ones needed to walk up from a story to its feature
const PARENT_FIELDS = ['summary', 'issuetype', 'parent', 'issuelinks'];

/**
 * How strongly an issue type says "this is the story a test belongs to".
 * Anything absent from both tables is not part of the hierarchy at all.
 */
const STORY_TYPES = {
  'user story': 100,
  story: 100,
  requirement: 90,
  'new feature': 70,
  task: 60,
  improvement: 55,
  bug: 50,
  defect: 50
};

const FEATURE_TYPES = {
  feature: 100,
  epic: 100,
  initiative: 80,
  capability: 70,
  theme: 60
};

/* --------------------------------- State --------------------------------- */

const idle = () => ({
  running: false,
  cancelling: false,
  phase: 'idle',
  message: 'No pull has run yet.',
  strategy: null,
  folder: ROOT,
  projectKey: null,
  overwrite: true,
  total: null,
  processed: 0,
  created: 0,
  updated: 0,
  moved: 0,
  unchanged: 0,
  skipped: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
  errors: [],
  log: []
});

let state = idle();
let emitter = null;
let lastEmit = 0;

/**
 * The current progress, as the API and the socket send it.
 * @returns {Object}
 */
const status = () => ({ ...state, errors: [...state.errors], log: [...state.log] });

/**
 * Push the progress to whoever is watching. Called for every test, so it is
 * throttled — except for the messages that must not be missed.
 * @param {boolean} [force]
 */
const emit = (force = false) => {
  // A pull started from somewhere without a socket — a test, a future CLI —
  // still runs: it just reports through status()
  if (!emitter || typeof emitter.emit !== 'function') { return; }

  const now = Date.now();
  if (!force && now - lastEmit < EMIT_INTERVAL) { return; }

  lastEmit = now;
  emitter.emit('xraypull:update', status());
};

/**
 * Add a line to the log the modal shows.
 * @param {string} message
 * @param {string} [level] - 'info' | 'warn' | 'error'
 */
const log = (message, level = 'info') => {
  state.log.push({ level, message });
  if (state.log.length > LOG_LIMIT) { state.log = state.log.slice(-LOG_LIMIT); }
};

/**
 * Move to a new phase and say so, whatever the throttling.
 * @param {string} next - 'starting' | 'downloading' | 'writing' | 'done' | ...
 * @param {string} message
 */
const phase = (next, message) => {
  state.phase = next;
  state.message = message;
  log(message);
  emit(true);
};

/**
 * Whether the user asked for the pull to stop.
 * @returns {boolean}
 */
const stopped = () => state.cancelling;

/* -------------------------------- Helpers -------------------------------- */

/**
 * Read an issue type name out of whatever shape Jira used for it.
 * @param {Object} issue - A Jira issue, or the summary of one
 * @returns {string}
 */
const typeOf = (issue) => {
  const fields = (issue && issue.fields) || {};
  const type = fields.issuetype || issue.issuetype;
  return String((type && (type.name || type)) || '').toLowerCase();
};

/**
 * Classify an issue against the hierarchy: the story a test belongs to, the
 * feature that story belongs to, or neither.
 * @param {Object} issue
 * @returns {{level: string, score: number}|null}
 */
const classify = (issue) => {
  const name = typeOf(issue);

  if (FEATURE_TYPES[name]) { return { level: 'feature', score: FEATURE_TYPES[name] }; }
  if (STORY_TYPES[name]) { return { level: 'story', score: STORY_TYPES[name] }; }

  return null;
};

/**
 * Everything an issue points at that could be its story or its feature: the
 * parent first, then the epic link, then the related work (Jira's issue
 * links, where Xray tests usually hang).
 *
 * @param {Object} issue - A raw Jira issue
 * @param {string|null} epicLinkField - Id of the "Epic Link" custom field
 * @returns {Array<Object>} { key, summary, level, score }
 */
const relatives = (issue, epicLinkField) => {
  const fields = (issue && issue.fields) || {};
  const found = [];

  const add = (candidate, bonus, level = null) => {
    if (!candidate || !candidate.key || candidate.key === issue.key) { return; }

    const guess = level ? { level, score: 100 } : classify(candidate);
    if (!guess) { return; }

    found.push({
      key: candidate.key,
      summary: (candidate.fields && candidate.fields.summary) || candidate.summary || null,
      level: guess.level,
      score: guess.score + bonus
    });
  };

  // A real parent beats anything a link could suggest
  add(fields.parent, 1000);

  // On Jira Server/DC — and on older Cloud projects — the epic is a custom
  // field holding nothing but the key
  if (epicLinkField && typeof fields[epicLinkField] === 'string') {
    add({ key: fields[epicLinkField] }, 900, 'feature');
  }

  (fields.issuelinks || []).forEach(link => {
    const other = link.outwardIssue || link.inwardIssue;
    const name = String((link.type && link.type.name) || '').toLowerCase();

    // Xray's own link type is what "this test tests that story" looks like
    add(other, name === 'test' || name === 'tests' ? 300 : 100);
  });

  return found;
};

/**
 * The best story and the best feature an issue points at.
 * @param {Object} issue - A raw Jira issue
 * @param {string|null} epicLinkField
 * @returns {{story: Object|null, feature: Object|null}}
 */
const bestRelatives = (issue, epicLinkField) => {
  const best = { story: null, feature: null };

  relatives(issue, epicLinkField).forEach(candidate => {
    const current = best[candidate.level];
    if (!current || candidate.score > current.score) {
      best[candidate.level] = candidate;
    }
  });

  return best;
};

/**
 * Delete the folders a move left behind, deepest first.
 * @param {string} dir
 * @returns {boolean} Whether the folder is now gone
 */
const pruneEmpty = (dir) => {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  }
  catch {
    return false;
  }

  let empty = true;

  entries.forEach(entry => {
    if (entry.isDirectory()) {
      if (!pruneEmpty(path.join(dir, entry.name))) { empty = false; }
      return;
    }
    empty = false;
  });

  if (empty) {
    try {
      fs.rmdirSync(dir);
      return true;
    }
    catch {
      return false;
    }
  }

  return false;
};

/**
 * Where every test already pulled lives right now, so a test that moved in
 * Jira is moved on disk instead of being written twice.
 *
 * @param {string} rootDir - Absolute path of the "xray" folder
 * @returns {Object} Absolute file path, keyed by uppercase test key
 */
const indexExisting = (rootDir) => {
  const found = {};

  const scan = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
      return;
    }

    entries.forEach(entry => {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scan(full);
        return;
      }

      if (!/\.(md|markdown)$/i.test(entry.name)) { return; }

      try {
        const { meta } = markdownFlows.parseFrontmatter(fs.readFileSync(full, 'utf8'));
        const key = meta && meta.xray && meta.xray.testKey;
        if (key) { found[String(key).trim().toUpperCase()] = full; }
      }
      catch {
        // An unreadable file simply does not take part in the index
      }
    });
  };

  scan(rootDir);

  return found;
};

/* -------------------------------- Writing -------------------------------- */

/**
 * Whether a test is already on disk and the user asked for those to be left
 * alone. Checked before the test is written — and before anything is
 * downloaded for it — so a pull that skips costs nothing.
 *
 * @param {Object} ctx - The running pull
 * @param {string} key - Test issue key
 * @returns {boolean}
 */
const skipping = (ctx, key) => !ctx.overwrite && Boolean(ctx.existing[String(key).trim().toUpperCase()]);

/**
 * Write one test to disk, moving it first when it no longer belongs where it
 * was.
 *
 * @param {Object} ctx - The running pull
 * @param {Object} test - { key, summary, description, status, issueType,
 *                          testType, folder, feature, userStory, details }
 * @param {Array<string>} segments - Folder names under "xray"
 */
const writeTest = (ctx, test, segments) => {
  // A flow with this xray.testKey is already there and must stay as it is:
  // not moved, not rewritten, not even read
  if (skipping(ctx, test.key)) {
    state.skipped += 1;
    return;
  }

  const fileName = `${testDoc.keyedName(test.key, test.summary)}.md`;
  const absolute = path.join(ctx.rootDir, ...segments, fileName);
  const key = test.key.toUpperCase();
  const previous = ctx.existing[key];

  if (previous && previous !== absolute) {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.renameSync(previous, absolute);
    state.moved += 1;
    log(`${test.key} moved to ${path.relative(ctx.flowsDir, absolute)}`);
  }

  const existed = fs.existsSync(absolute);
  const current = existed ? fs.readFileSync(absolute, 'utf8') : null;

  const next = testDoc.build(current, {
    key: test.key,
    summary: test.summary,
    description: test.description,
    status: test.status,
    issueType: test.issueType,
    testType: test.testType,
    folder: test.folder,
    feature: test.feature,
    userStory: test.userStory,
    details: test.details || null,
    url: ctx.jiraBaseUrl ? `${ctx.jiraBaseUrl}/browse/${test.key}` : null
  });

  if (current === next) {
    state.unchanged += 1;
  }
  else {
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, next, 'utf8');

    if (existed || previous) { state.updated += 1; }
    else { state.created += 1; }
  }

  ctx.existing[key] = absolute;
};

/**
 * Record a test that could not be written, and carry on with the next one.
 * @param {string} key
 * @param {Error} error
 */
const failed = (key, error) => {
  state.failed += 1;
  state.errors.push({ key, message: (error && error.message) || String(error) });
  log(`${key}: ${(error && error.message) || error}`, 'error');
};

/* --------------------------------- Details -------------------------------- */

/**
 * Run a worker over a list, a few items at a time, keeping the answers in
 * the order the items came in.
 *
 * @param {Array} items
 * @param {number} limit - How many run at once
 * @param {Function} worker - async (item, index) => any
 * @returns {Promise<Array>}
 */
const mapWithLimit = async (items, limit, worker) => {
  const results = new Array(items.length);
  let next = 0;

  const runner = async () => {
    for (;;) {
      const index = next;
      next += 1;

      if (index >= items.length) { return; }

      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));

  return results;
};

/**
 * The ids of the Jira custom fields Xray keeps the non-step details in.
 * A field this Jira does not have — or that this user may not list — is
 * simply absent, and the pull carries on without it.
 *
 * @param {Object} settings - Full Jira settings
 * @returns {Promise<Object>} Field id, keyed by "testType" | "gherkin" | "unstructured"
 */
const detailFieldIds = async (settings) => {
  const found = {};

  for (const field of DETAIL_FIELDS) {
    const id = await client.fieldId(settings, field.name);
    if (id) { found[field.as] = id; }
  }

  return found;
};

/**
 * Read the detail custom fields off an issue.
 * @param {Object} fields - issue.fields
 * @param {Object} ids - As returned by detailFieldIds
 * @returns {Object} { testType, gherkin, unstructured }
 */
const fieldDetails = (fields, ids) => {
  const read = (id) => {
    const raw = id ? (fields || {})[id] : null;

    if (raw === null || raw === undefined) { return null; }
    // An option field ("Test Type") arrives as an object, a text one as text
    if (typeof raw === 'object') { return raw.value || raw.name || null; }

    return String(raw).trim() || null;
  };

  return {
    testType: read(ids.testType),
    gherkin: read(ids.gherkin),
    unstructured: read(ids.unstructured)
  };
};

/**
 * The details to write for a test, or null when this pull learned nothing
 * about them — which must leave whatever a previous pull wrote alone.
 *
 * @param {Object} parts - { testType, gherkin, unstructured }
 * @param {Array<Object>|null} steps - null when Xray would not answer
 * @returns {Object|null}
 */
const detailsOf = (parts, steps) => {
  const known = steps !== null || parts.testType || parts.gherkin || parts.unstructured;

  return known ? { ...parts, steps: steps || [] } : null;
};

/* ------------------------------- Strategies ------------------------------- */

/**
 * The folder names under "xray" for an Xray Test Repository path.
 * @param {string|null} folder - e.g. "/Authentication/Login"
 * @returns {Array<string>}
 */
const folderSegments = (folder) => String(folder || '')
  .split('/')
  .map(segment => segment.trim())
  .filter(Boolean)
  .map(testDoc.sanitizeSegment);

/**
 * Xray Cloud: the Test Repository comes with every test, so the folders on
 * disk are the folders in Xray.
 * @param {Object} settings - Full Jira settings
 * @param {Object} ctx - The running pull
 */
const pullXrayCloud = async (settings, ctx) => {
  phase('downloading', `Reading the tests of ${ctx.projectKey} from Xray Cloud…`);

  await client.walkCloudTests(settings, {
    jql: `project = "${ctx.projectKey}"`,
    stopped,
    onNotice: (message) => log(message, 'warn'),
    onPage: (tests, total) => {
      if (state.total === null) { state.total = total; }

      tests.forEach(test => {
        if (stopped()) { return; }

        try {
          writeTest(ctx, {
            key: test.key,
            summary: test.summary,
            description: adf.toMarkdown(test.description),
            status: test.status,
            issueType: test.issueType,
            testType: test.testType,
            folder: test.folder || '/',
            details: test.details || null
          }, folderSegments(test.folder));
        }
        catch (error) {
          failed(test.key, error);
        }

        state.processed += 1;
        state.message = `${test.key} — ${test.summary || ''}`.trim();
        emit();
      });
    }
  });
};

/**
 * Xray Server/DC: the tests come from Jira, their folders from Xray's own
 * REST API. When that API cannot be read the tests still land in "xray",
 * just without the folders.
 * @param {Object} settings - Full Jira settings
 * @param {Object} ctx - The running pull
 */
const pullXrayServer = async (settings, ctx) => {
  phase('folders', 'Reading the Test Repository from Xray…');

  const folders = await client.fetchServerRepository(settings, ctx.projectKey);
  const known = Object.keys(folders).length;

  log(known
    ? `The Test Repository places ${known} test(s) in a folder.`
    : 'The Test Repository could not be read: the tests will land directly in "xray".',
  known ? 'info' : 'warn');

  phase('fields', 'Looking up the Jira fields…');
  const detailIds = await detailFieldIds(settings);

  const jql = `project = "${ctx.projectKey}" AND issuetype = Test ORDER BY key ASC`;

  phase('downloading', `Reading the tests of ${ctx.projectKey} from Jira…`);
  state.total = await client.countIssues(settings, jql);

  await client.searchIssues(settings, {
    jql,
    fields: ['summary', 'description', 'status', 'issuetype', ...Object.values(detailIds)],
    stopped,
    onPage: async (issues, total) => {
      if (state.total === null && typeof total === 'number') { state.total = total; }

      // A test that is skipped is not asked for its steps: the point of
      // skipping is that nothing is downloaded for it either
      const wanted = issues.filter(issue => !stopped() && !skipping(ctx, issue.key));

      if (wanted.length) {
        state.phase = 'details';
        state.message = `Reading the details of ${wanted.length} test(s)…`;
        emit(true);
      }

      const steps = new Map();

      await mapWithLimit(wanted, STEP_CONCURRENCY, async (issue) => {
        if (stopped()) { return; }

        try {
          steps.set(issue.key, await client.fetchServerSteps(settings, issue.key));
        }
        catch {
          // The steps are a detail: a test that would not answer is still
          // written, just without them
          steps.set(issue.key, null);
        }
      });

      state.phase = 'writing';

      issues.forEach(issue => {
        if (stopped()) { return; }

        const fields = issue.fields || {};
        const folder = folders[String(issue.key).toUpperCase()] || '/';
        const parts = fieldDetails(fields, detailIds);
        const details = detailsOf(parts, steps.has(issue.key) ? steps.get(issue.key) : null);

        try {
          writeTest(ctx, {
            key: issue.key,
            summary: fields.summary,
            description: adf.toMarkdown(fields.description),
            status: (fields.status && fields.status.name) || null,
            issueType: (fields.issuetype && fields.issuetype.name) || null,
            testType: parts.testType,
            folder,
            details
          }, folderSegments(folder));
        }
        catch (error) {
          failed(issue.key, error);
        }

        state.processed += 1;
        state.message = `${issue.key} — ${fields.summary || ''}`.trim();
        emit();
      });
    }
  });
};

/**
 * Jira Cloud with an API token: no Xray API to ask, so the layout is rebuilt
 * from the hierarchy Jira does expose.
 * @param {Object} settings - Full Jira settings
 * @param {Object} ctx - The running pull
 */
const pullJiraHierarchy = async (settings, ctx) => {
  phase('fields', 'Looking up the Jira fields…');

  const epicLinkField = await client.fieldId(settings, 'Epic Link');
  const parentFields = epicLinkField ? [...PARENT_FIELDS, epicLinkField] : PARENT_FIELDS;

  // Whatever of the Test Details this Jira exposes as a custom field: without
  // an Xray API key there is no other way to reach them, and the steps of a
  // Manual test are out of reach altogether
  const detailIds = await detailFieldIds(settings);

  if (!Object.keys(detailIds).length) {
    log('Jira does not expose the Xray test details as fields: the tests are pulled without them.', 'warn');
  }

  const testFields = [
    ...TEST_FIELDS,
    ...(epicLinkField ? [epicLinkField] : []),
    ...Object.values(detailIds)
  ];

  // Every parent read so far, so a story shared by fifty tests is downloaded
  // once
  const issues = new Map();

  const ensureIssues = async (keys) => {
    const missing = [...new Set(keys.map(key => String(key).toUpperCase()))]
      .filter(key => !issues.has(key));

    if (!missing.length) { return; }

    const found = await client.fetchIssuesByKeys(settings, missing, parentFields);

    // A key that answered nothing is remembered as nothing, so it is not
    // asked for again on the next page
    missing.forEach(key => issues.set(key, found[key] || null));
  };

  const jql = `project = "${ctx.projectKey}" AND issuetype = Test ORDER BY key ASC`;

  phase('downloading', `Reading the tests of ${ctx.projectKey} from Jira…`);
  state.total = await client.countIssues(settings, jql);

  await client.searchIssues(settings, {
    jql,
    fields: testFields,
    stopped,
    onPage: async (page, total) => {
      if (state.total === null && typeof total === 'number') { state.total = total; }

      state.phase = 'resolving';
      state.message = `Resolving the hierarchy of ${page.length} test(s)…`;
      emit(true);

      const picks = page.map(issue => ({ issue, ...bestRelatives(issue, epicLinkField) }));

      // A test linked to a story says nothing about that story's feature:
      // read the stories, then ask them
      await ensureIssues(picks.filter(pick => pick.story && !pick.feature).map(pick => pick.story.key));

      picks.forEach(pick => {
        if (!pick.story || pick.feature) { return; }

        const story = issues.get(pick.story.key.toUpperCase());
        if (!story) { return; }

        // The story's own summary is more trustworthy than the one embedded
        // in the link
        pick.story.summary = (story.fields && story.fields.summary) || pick.story.summary;
        pick.feature = bestRelatives(story, epicLinkField).feature;
      });

      // An epic reached through the epic link field is a bare key: it needs
      // one more read to get a name for its folder
      await ensureIssues(picks.filter(pick => pick.feature && !pick.feature.summary).map(pick => pick.feature.key));

      picks.forEach(pick => {
        if (!pick.feature || pick.feature.summary) { return; }

        const feature = issues.get(pick.feature.key.toUpperCase());
        if (feature) { pick.feature.summary = (feature.fields && feature.fields.summary) || null; }
      });

      state.phase = 'writing';

      picks.forEach(({ issue, story, feature }) => {
        if (stopped()) { return; }

        const fields = issue.fields || {};

        const segments = [
          feature ? testDoc.keyedName(feature.key, feature.summary) : NO_FEATURE,
          story ? testDoc.keyedName(story.key, story.summary) : NO_STORY
        ];

        const parts = fieldDetails(fields, detailIds);

        try {
          writeTest(ctx, {
            key: issue.key,
            summary: fields.summary,
            description: adf.toMarkdown(fields.description),
            status: (fields.status && fields.status.name) || null,
            issueType: (fields.issuetype && fields.issuetype.name) || null,
            testType: parts.testType,
            feature: feature ? feature.key : null,
            userStory: story ? story.key : null,
            details: detailsOf(parts, null)
          }, segments);
        }
        catch (error) {
          failed(issue.key, error);
        }

        state.processed += 1;
        state.message = `${issue.key} — ${fields.summary || ''}`.trim();
        emit();
      });
    }
  });
};

/* ---------------------------------- Run ---------------------------------- */

/**
 * Run a pull from start to finish, updating the progress as it goes.
 * @param {Object} settings - Full Jira settings
 * @param {Object} ctx - The running pull
 */
const run = async (settings, ctx) => {
  try {
    phase('starting', `Pulling the tests of ${ctx.projectKey} into "${ROOT}"…`);

    ctx.existing = indexExisting(ctx.rootDir);

    const already = Object.keys(ctx.existing).length;

    log(`${already} test(s) already pulled.`);
    log(ctx.overwrite
      ? 'Tests already pulled are updated with what Jira says now.'
      : 'Tests already pulled are left as they are: only tests that are not in "xray" yet are written.');

    if (settings.kind === 'cloud') { await pullXrayCloud(settings, ctx); }
    else if (settings.kind === 'basic') { await pullJiraHierarchy(settings, ctx); }
    else { await pullXrayServer(settings, ctx); }

    // The folders a move emptied go, the "xray" folder itself stays
    if (state.moved) {
      fs.readdirSync(ctx.rootDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .forEach(entry => pruneEmpty(path.join(ctx.rootDir, entry.name)));
    }

    if (stopped()) {
      phase('cancelled', `Stopped after ${state.processed} test(s).`);
    }
    else {
      const skipped = state.skipped ? `, ${state.skipped} left as they were` : '';
      phase('done', `${state.processed} test(s) pulled into "${ROOT}"${skipped}.`);
    }
  }
  catch (error) {
    state.error = (error && error.message) || String(error);
    phase('error', state.error);
  }
  finally {
    state.running = false;
    state.cancelling = false;
    state.finishedAt = new Date().toISOString();
    emit(true);
  }
};

/**
 * Start a pull. Answers as soon as it has started: the progress travels over
 * the socket, and can be read back with status().
 *
 * @param {Object} settings - Full Jira settings, secrets included, the pull
 *   options among them
 * @param {Object} [options] - { io } - the socket.io server, when there is one
 * @returns {Promise<Object>} The progress, as it stands at the first tick
 */
const start = async (settings, options = {}) => {
  if (state.running) {
    throw new Error('A pull is already running.');
  }

  const projectKey = String((settings && settings.projectKey) || '').trim();

  if (!projectKey) {
    throw new Error('Set the project key first: a pull downloads the tests of one Jira project.');
  }

  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(projectKey)) {
    throw new Error(`"${projectKey}" is not a Jira project key.`);
  }

  const { flowsDir, absolute } = await flows.resolveWithinFlows(ROOT);
  fs.mkdirSync(absolute, { recursive: true });

  emitter = options.io || null;
  lastEmit = 0;

  const overwrite = !(settings.pull && settings.pull.overwrite === false);

  state = {
    ...idle(),
    running: true,
    phase: 'starting',
    message: 'Starting…',
    strategy: settings.kind === 'basic' ? 'jira-hierarchy' : 'xray-repository',
    projectKey,
    overwrite,
    startedAt: new Date().toISOString()
  };

  const ctx = {
    projectKey,
    flowsDir,
    rootDir: absolute,
    jiraBaseUrl: settings.jiraBaseUrl || '',
    overwrite,
    existing: {}
  };

  // Deliberately not awaited: the caller gets its answer now, the pull keeps
  // going and reports over the socket
  run(settings, ctx);

  return status();
};

/**
 * Ask the running pull to stop. Whatever it already wrote stays on disk.
 * @returns {Object} The progress
 */
const cancel = () => {
  if (state.running) {
    state.cancelling = true;
    state.message = 'Stopping…';
    emit(true);
  }

  return status();
};

module.exports = {
  start,
  cancel,
  status,
  ROOT,
  NO_FEATURE,
  NO_STORY,
  // Exported for the tests
  bestRelatives,
  folderSegments,
  indexExisting,
  detailsOf,
  fieldDetails
};
