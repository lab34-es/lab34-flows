/**
 * Application documentation, extracted from the JSDoc blocks of an
 * application's `index.js`.
 *
 * There is no `docs.json`: an application documents itself in its own code.
 *
 *  - The JSDoc block at the very top of the file describes the application.
 *  - The JSDoc block right above each exported method documents that method:
 *    its free text is the method description (markdown), and the tags
 *    `@param`, `@returns`, `@memory` and `@example` describe its input,
 *    output, flow memory usage and an example step.
 *
 * Example:
 *
 *   /**
 *    * Adds two numbers (a + b).
 *    *
 *    * @param {number} body.a - First operand.
 *    * @param {number} [body.b=0] - Second operand.
 *    * @returns {200} The operation performed and its result.
 *    * ```json
 *    * { "operation": "add", "result": 42 }
 *    * ```
 *    * @memory {write} lastResult - The result of the operation.
 *    * @example
 *    * application: calculator
 *    * method: add
 *    *\/
 *   module.exports.add = applications.handler([...], 'add');
 */

// Every JSDoc block (/** ... *\/) of a file
const BLOCK_RE = /\/\*\*([\s\S]*?)\*\//g;

// What follows a block when it documents an exported method
const EXPORT_RE = /^\s*(?:module\.)?exports\.([A-Za-z0-9_$]+)\s*=/;

// `{type} name - description`, where `[name]` and `[name=default]` mark an
// optional value. Shared by @param and @memory.
const TYPED_NAME_RE = /^(?:\{([^}]*)\}\s*)?(\[[^\]]*\]|[^\s]+)\s*(?:[-–—:]\s*)?([\s\S]*)$/;

// A fenced code block used to document an example response body
const FENCE_RE = /```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n?```/;

/**
 * Remove the leading ` * ` of every line of a JSDoc block body.
 * @param {string} block
 * @returns {string}
 */
const stripDelimiters = (block) => {
  return block
    .split(/\r?\n/)
    .map(line => line.replace(/^[ \t]*\*[ \t]?/, '').replace(/[ \t]+$/, ''))
    .join('\n');
};

/**
 * Split a cleaned block into its free text (the description) and its tags.
 * A tag owns every line until the next tag, so tags can span several lines.
 * @param {string} text
 * @returns {{description: string, tags: Array<{tag: string, text: string}>}}
 */
const splitTags = (text) => {
  const description = [];
  const tags = [];
  let current = null;

  for (const line of text.split('\n')) {
    const match = /^@(\w+)[ \t]*(.*)$/.exec(line);

    if (match) {
      current = { tag: match[1].toLowerCase(), lines: [match[2]] };
      tags.push(current);
      continue;
    }

    (current ? current.lines : description).push(line);
  }

  return {
    description: description.join('\n').trim(),
    tags: tags.map(tag => ({ tag: tag.tag, text: tag.lines.join('\n') }))
  };
};

/**
 * Collapse a multi-line tag description into a single line.
 * @param {string} value
 * @returns {string}
 */
const oneLine = (value) => (value || '').replace(/\s*\n\s*/g, ' ').trim();

/**
 * `@param {number} [body.b=0] - Second operand.`
 * @param {string} text
 * @returns {Object|null}
 */
const parseParam = (text) => {
  const match = TYPED_NAME_RE.exec(text.trim());
  if (!match) {
    return null;
  }

  const [, type, rawName, description] = match;

  let name = rawName;
  let required = true;
  let defaultValue;

  if (name.startsWith('[')) {
    required = false;
    name = name.slice(1, -1);
    const equals = name.indexOf('=');
    if (equals !== -1) {
      defaultValue = name.slice(equals + 1).trim();
      name = name.slice(0, equals);
    }
  }

  name = name.trim();
  if (!name) {
    return null;
  }

  const param = {
    name,
    type: (type || '').trim() || null,
    required,
    description: oneLine(description)
  };

  if (defaultValue !== undefined) {
    param.default = defaultValue;
  }

  return param;
};

/**
 * `@returns {200} What comes back` plus an optional fenced example body.
 * @param {string} text
 * @returns {Object|null}
 */
const parseReturns = (text) => {
  const match = /^(?:\{([^}]*)\}\s*)?([\s\S]*)$/.exec(text.trim());
  if (!match) {
    return null;
  }

  const rawStatus = (match[1] || '').trim();
  let rest = match[2];
  let body;

  const fence = FENCE_RE.exec(rest);
  if (fence) {
    rest = rest.slice(0, fence.index) + rest.slice(fence.index + fence[0].length);
    try {
      body = JSON.parse(fence[1]);
    }
    catch {
      // Not JSON: document it verbatim
      body = fence[1].trim();
    }
  }

  const output = {
    status: /^\d+$/.test(rawStatus) ? Number(rawStatus) : (rawStatus || null),
    description: oneLine(rest)
  };

  if (body !== undefined) {
    output.body = body;
  }

  return output;
};

/**
 * `@memory {write} lastResult - The result of the operation.`
 * @param {string} text
 * @returns {Object|null}
 */
const parseMemory = (text) => {
  const param = parseParam(text);
  if (!param) {
    return null;
  }

  const mode = (param.type || 'write').toLowerCase();

  return {
    key: param.name,
    mode: mode === 'read' ? 'read' : 'write',
    description: param.description
  };
};

/**
 * Turn one JSDoc block into the documentation of a method.
 * @param {string} name - Exported method name
 * @param {string} block - Raw block body (between the delimiters)
 * @returns {Object}
 */
const parseMethodBlock = (name, block) => {
  const { description, tags } = splitTags(stripDelimiters(block));

  const docs = {
    name,
    description,
    input: [],
    output: null,
    memory: [],
    example: null
  };

  const examples = [];

  for (const { tag, text } of tags) {
    switch (tag) {
      case 'description': {
        docs.description = docs.description
          ? `${docs.description}\n\n${text.trim()}`
          : text.trim();
        break;
      }
      case 'param':
      case 'arg':
      case 'argument': {
        const param = parseParam(text);
        if (param) { docs.input.push(param); }
        break;
      }
      case 'returns':
      case 'return': {
        docs.output = parseReturns(text);
        break;
      }
      case 'memory': {
        const memory = parseMemory(text);
        if (memory) { docs.memory.push(memory); }
        break;
      }
      case 'example': {
        // Examples are YAML steps: keep their indentation and line breaks
        const example = text.replace(/^\n+/, '').replace(/\s+$/, '');
        if (example) { examples.push(example); }
        break;
      }
      default:
        // Unknown tags are ignored on purpose: applications are free to use
        // any other JSDoc tag for their own tooling
        break;
    }
  }

  if (examples.length) {
    docs.example = examples.join('\n\n');
  }

  return docs;
};

/**
 * Parse the documentation of an application from the source of its index.js.
 * @param {string} source - Contents of the application's index.js
 * @returns {{description: string|null, methods: Object<string, Object>}}
 */
const parse = (source) => {
  const result = { description: null, methods: {} };

  if (!source || typeof source !== 'string') {
    return result;
  }

  BLOCK_RE.lastIndex = 0;
  let match;

  while ((match = BLOCK_RE.exec(source)) !== null) {
    const blockStart = match.index;
    const blockEnd = BLOCK_RE.lastIndex;

    const exported = EXPORT_RE.exec(source.slice(blockEnd));

    if (exported) {
      const name = exported[1];
      result.methods[name] = parseMethodBlock(name, match[1]);
      continue;
    }

    // A block at the very top of the file, not attached to a method,
    // describes the application itself
    if (result.description === null && !source.slice(0, blockStart).trim()) {
      const { description, tags } = splitTags(stripDelimiters(match[1]));
      const described = tags.find(tag => tag.tag === 'description');
      result.description = (description || (described && described.text.trim()) || '') || null;
    }
  }

  return result;
};

module.exports.parse = parse;
