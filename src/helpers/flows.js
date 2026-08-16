const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const paths = require('./paths');
const apps = require('./applications');
const aiFlows = require('./aiFlows');
const markdownFlows = require('./markdownFlows');

const ALLOWED_FILE_FORMATS = ['md', 'markdown', 'yaml', 'yml'];
const MARKDOWN_FORMATS = ['md', 'markdown'];

/**
 * Generate a brand new Markdown flow from a natural language description.
 * Only available from the UI: see helpers/aiFlows.
 * @param {Object} body - { prompt }
 * @returns {Promise<{flow: string, format: string, provider: string, model: string}>}
 */
module.exports.createAI = async (body) => aiFlows.create(body || {});

/**
 * Rewrite an existing flow following an instruction.
 * @param {Object} body - { prompt, content }
 * @returns {Promise<{flow: string, format: string, provider: string, model: string}>}
 */
module.exports.editAI = async (body) => aiFlows.edit(body || {});

module.exports.listCapabilities = async () => {
  return apps.summary();
};

/**
 * Build a human readable title from a flow file name.
 * @param {string} fileName
 * @returns {string}
 */
const titleFromFileName = (fileName) => {
  return fileName
    .replace(new RegExp(`\\.(${ALLOWED_FILE_FORMATS.join('|')})$`, 'i'), '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Whether a flow file path points to a markdown flow.
 * @param {string} flowPath
 * @returns {boolean}
 */
const isMarkdownPath = (flowPath) => {
  const ext = path.extname(flowPath).toLowerCase().substring(1);
  return MARKDOWN_FORMATS.includes(ext);
};

/**
 * Parse raw flow content (markdown or YAML) into a normalized structure
 * shared by the API and the UI:
 * { format, title, description, segments, steps, errors }
 *
 * Segments describe the document in order, so the UI can render it as a
 * notebook: markdown segments are plain content, step segments are the
 * executable cells.
 *
 * @param {string} value - Raw file content
 * @param {string|null} format - 'markdown' | 'yaml' | null (auto-detect)
 * @returns {Object}
 */
/**
 * Detect the format of raw flow content. A document containing ```step
 * fences is markdown — unless it also parses as a YAML object with a
 * `steps` list (e.g. a YAML flow whose strings embed markdown examples),
 * in which case YAML wins.
 * @param {string} value
 * @returns {'markdown'|'yaml'}
 */
const detectFormat = (value) => {
  if (!markdownFlows.isMarkdownFlow(value)) {
    return 'yaml';
  }
  try {
    const asYaml = YAML.parse(value);
    if (asYaml && typeof asYaml === 'object' && Array.isArray(asYaml.steps)) {
      return 'yaml';
    }
  }
  catch {
    // Not YAML at all: markdown
  }
  return 'markdown';
};

const parseValue = (value, format = null) => {
  const isMarkdown = format === 'markdown' ||
    (format !== 'yaml' && detectFormat(value) === 'markdown');

  if (isMarkdown) {
    const parsed = markdownFlows.parse(value);
    return {
      format: 'markdown',
      title: parsed.title,
      description: parsed.description,
      version: parsed.version,
      segments: parsed.segments,
      steps: parsed.steps,
      errors: parsed.errors
    };
  }

  // Classic YAML flow: synthesize one step segment per step so the UI can
  // render YAML flows with the same notebook look.
  let contents;
  try {
    contents = YAML.parse(value);
  }
  catch (ex) {
    return {
      format: 'yaml',
      title: null,
      description: null,
      segments: [],
      steps: [],
      errors: [{ message: `Invalid YAML: ${ex.message}` }]
    };
  }

  if (!contents || typeof contents !== 'object') {
    return {
      format: 'yaml',
      title: null,
      description: null,
      segments: [],
      steps: [],
      errors: [{ message: 'Flow file must contain a YAML object' }]
    };
  }

  const steps = Array.isArray(contents.steps) ? contents.steps : [];

  const segments = [];
  if (contents.description) {
    segments.push({ type: 'markdown', content: contents.description });
  }
  steps.forEach((step, index) => {
    segments.push({
      type: 'step',
      content: YAML.stringify(step).trim(),
      info: 'step',
      stepIndex: index
    });
  });

  return {
    format: 'yaml',
    title: contents.title || null,
    description: contents.description || null,
    version: contents.version,
    segments,
    steps: steps.map((step, index) => {
      if (step && typeof step === 'object' && !Array.isArray(step)) {
        return { ...step, stepIndex: index };
      }
      return step;
    }),
    errors: []
  };
};

module.exports.parseValue = parseValue;

/**
 * Given the location of a flow file (markdown or YAML), return its parsed
 * content, or null when it cannot be parsed at all.
 * @param {string} flowPath
 * @returns {Object|null}
 */
const getContent = (flowPath) => {
  const fileName = path.basename(flowPath);

  let contents;

  try {
    const raw = fs.readFileSync(flowPath, 'utf8');
    const parsed = parseValue(raw, isMarkdownPath(flowPath) ? 'markdown' : 'yaml');

    contents = {
      format: parsed.format,
      title: parsed.title,
      description: parsed.description,
      stepsCount: parsed.steps.length,
      errors: parsed.errors
    };

    if (!contents.title) {
      contents.title = titleFromFileName(fileName);
    }
  }
  catch {
    contents = null;
  }

  return contents;
};

module.exports.getUserFlow = async (flowPath) => {
  if (!flowPath || !fs.existsSync(flowPath)) {
    return Promise.reject(new Error('Flow not found'));
  }

  // Only serve flow files that live inside the flows directory, with an
  // allowed extension — this API must not read arbitrary files from disk.
  const flowsDir = await paths.contextDir(['flows']);
  const resolved = path.resolve(flowPath);
  const relative = path.relative(flowsDir, resolved);
  const isInside = relative && !relative.startsWith('..') && !path.isAbsolute(relative);

  const ext = path.extname(resolved).toLowerCase().substring(1);
  if (!isInside || !ALLOWED_FILE_FORMATS.includes(ext)) {
    return Promise.reject(new Error('Flow not found'));
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const parsed = parseValue(raw, isMarkdownPath(resolved) ? 'markdown' : 'yaml');

  return {
    ...parsed,
    title: parsed.title || titleFromFileName(path.basename(resolved)),
    path: resolved,
    relativePath: relative.split(path.sep).join('/'),
    plainText: raw
  };
};

/**
 * List all available flows from the flows directory
 * @returns {Promise<Array>} Array of flow objects
 */
module.exports.list = async () => {
  const flowsDir = await paths.contextDir(['flows']);

  if (!fs.existsSync(flowsDir)) {
    return [];
  }

  const flows = [];
  
  const scanDirectory = (dir, relativePath = '') => {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        scanDirectory(fullPath, path.join(relativePath, item));
      } else if (stat.isFile()) {
        // Check if it's a flow file
        const ext = path.extname(item).toLowerCase().substring(1);
        if (ALLOWED_FILE_FORMATS.includes(ext)) {
          const content = getContent(fullPath);
          if (content) {
            flows.push({
              ...content,
              path: fullPath,
              relativePath: path.join(relativePath, item),
              name: content.title || item.replace(new RegExp(`\\.(${ALLOWED_FILE_FORMATS.join('|')})$`, 'i'), ''),
              category: relativePath || 'root'
            });
          }
        }
      }
    }
  };
  
  scanDirectory(flowsDir);

  return flows;
};

/**
 * Resolve a user-provided relative path inside the flows directory,
 * rejecting any attempt to escape it.
 * @param {string} relativePath
 * @returns {Promise<{flowsDir: string, absolute: string, relative: string}>}
 */
const resolveWithinFlows = async (relativePath) => {
  const flowsDir = await paths.contextDir(['flows']);
  const absolute = path.resolve(flowsDir, relativePath || '.');

  if (absolute !== flowsDir && !absolute.startsWith(flowsDir + path.sep)) {
    throw new Error('Invalid path: outside of the flows directory');
  }

  return {
    flowsDir,
    absolute,
    relative: path.relative(flowsDir, absolute)
  };
};

module.exports.resolveWithinFlows = resolveWithinFlows;

/**
 * Return the flows directory as a nested tree of folders and flow files,
 * including empty folders, so the UI can render a file explorer.
 * @returns {Promise<Array>} tree nodes:
 *   { type: 'folder', name, relativePath, children }
 *   { type: 'flow', name, title, relativePath, path, format, stepsCount }
 */
module.exports.tree = async () => {
  const flowsDir = await paths.contextDir(['flows']);

  if (!fs.existsSync(flowsDir)) {
    return [];
  }

  const scan = (dir, relativePath) => {
    const nodes = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      if (item.startsWith('.')) { continue; }

      const fullPath = path.join(dir, item);
      const itemRelative = relativePath ? path.posix.join(relativePath, item) : item;

      let stat;
      try {
        stat = fs.statSync(fullPath);
      }
      catch {
        // Broken symlink or unreadable entry: skip it instead of failing
        continue;
      }

      if (stat.isDirectory()) {
        nodes.push({
          type: 'folder',
          name: item,
          relativePath: itemRelative,
          children: scan(fullPath, itemRelative)
        });
        continue;
      }

      const ext = path.extname(item).toLowerCase().substring(1);
      if (!ALLOWED_FILE_FORMATS.includes(ext)) { continue; }

      const content = getContent(fullPath);
      nodes.push({
        type: 'flow',
        name: item,
        title: (content && content.title) || titleFromFileName(item),
        relativePath: itemRelative,
        path: fullPath,
        format: content ? content.format : (isMarkdownPath(fullPath) ? 'markdown' : 'yaml'),
        stepsCount: content ? content.stepsCount : 0,
        hasErrors: Boolean(content && content.errors && content.errors.length)
      });
    }

    // Folders first, then flows; alphabetical within each group
    return nodes.sort((a, b) => {
      if (a.type !== b.type) { return a.type === 'folder' ? -1 : 1; }
      return a.name.localeCompare(b.name);
    });
  };

  return scan(flowsDir, '');
};

/**
 * Create a folder inside the flows directory.
 * @param {string} relativePath
 */
module.exports.createFolder = async (relativePath) => {
  if (!relativePath || !relativePath.trim()) {
    throw new Error('Folder path is required');
  }

  const { absolute, relative } = await resolveWithinFlows(relativePath);

  if (!relative) {
    throw new Error('Folder path is required');
  }

  fs.mkdirSync(absolute, { recursive: true });
  return { relativePath: relative };
};

/**
 * Create or update a flow file inside the flows directory.
 * @param {Object} options
 * @param {string} options.relativePath - File path relative to the flows dir
 * @param {string} options.content - File content
 * @param {boolean} options.overwrite - Allow overwriting an existing file
 */
module.exports.saveFile = async ({ relativePath, content, overwrite = false }) => {
  if (!relativePath || !relativePath.trim()) {
    throw new Error('File path is required');
  }

  const ext = path.extname(relativePath).toLowerCase().substring(1);
  if (!ALLOWED_FILE_FORMATS.includes(ext)) {
    throw new Error(`Unsupported file format ".${ext}". Allowed: ${ALLOWED_FILE_FORMATS.join(', ')}`);
  }

  const { absolute, relative } = await resolveWithinFlows(relativePath);

  if (fs.existsSync(absolute)) {
    if (fs.statSync(absolute).isDirectory()) {
      throw new Error('A folder with that name already exists');
    }
    if (!overwrite) {
      const err = new Error('File already exists');
      err.code = 'EEXISTS';
      throw err;
    }
  }

  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content ?? '', 'utf8');

  return { relativePath: relative, path: absolute };
};

/**
 * Delete a flow file or folder inside the flows directory.
 * @param {string} relativePath
 */
module.exports.remove = async (relativePath) => {
  if (!relativePath || !relativePath.trim()) {
    throw new Error('Path is required');
  }

  const { absolute, relative } = await resolveWithinFlows(relativePath);

  if (!relative) {
    throw new Error('Refusing to delete the flows directory itself');
  }

  // lstat instead of existsSync so broken symlinks can still be deleted
  let exists = true;
  try {
    fs.lstatSync(absolute);
  }
  catch {
    exists = false;
  }

  if (!exists) {
    throw new Error('Path not found');
  }

  fs.rmSync(absolute, { recursive: true, force: true });
  return { relativePath: relative };
};

/**
 * Method called from API
 *
 * @param {*} body
 * @returns
 */
module.exports.start = async (body, opts) => {
  const {
    value,
    environment,
    format
  } = body;

  const {
    io // socketio instance
  } = opts;

  const required = ['value', 'environment'];

  if (!required.every(key => body[key])) {
    return Promise.reject(new Error('Invalid request: "value" and "environment" are required'));
  }

  const isMarkdown = format === 'markdown' ||
    (format !== 'yaml' && detectFormat(value) === 'markdown');

  let flowAsJson;

  if (isMarkdown) {
    // Throws a descriptive error when a step block contains invalid YAML
    flowAsJson = markdownFlows.toFlow(value);
  }
  else {
    try {
      flowAsJson = YAML.parse(value);
    }
    catch (ex) {
      return Promise.reject(new Error(`Invalid YAML flow: ${ex.message}`));
    }
  }

  if (!flowAsJson || !Array.isArray(flowAsJson.steps) || !flowAsJson.steps.length) {
    return Promise.reject(new Error('Flow has no steps to execute'));
  }

  // Make sure application methods are loaded (the CLI does this itself,
  // but API-triggered runs need it too)
  await apps.loadAll();

  const runner = require(`./runner/v${flowAsJson.version || '1'}`);

  const result = await runner.run(flowAsJson, {
    environment,
    reporter: {
      cli: false,
      server: io
    }
  });

  // The runner refuses to start when another flow is already running
  if (!result) {
    return Promise.reject(new Error('Another flow is already running. Wait for it to finish.'));
  }

  return result;
};
