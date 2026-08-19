import YAML from 'yaml';

/**
 * Markdown-based flows.
 *
 * A flow is a regular Markdown document. The user can write any content
 * (headings, prose, lists, images...) and define the executable steps as
 * fenced code blocks tagged as "step":
 *
 *   ```step
 *   application: calculator
 *   method: add
 *   parameters:
 *     body:
 *       a: 1
 *       b: 2
 *   ```
 *
 * The content of a step block is YAML, using the exact same step schema as
 * the classic YAML flows (application, method, parameters, test, mimic,
 * retry...).
 *
 * Flow-level metadata (title, description, version, latentApplications...)
 * can be provided in an optional YAML frontmatter at the very top of the
 * document:
 *
 *   ---
 *   title: My flow
 *   description: What this flow does
 *   ---
 *
 * When no frontmatter title is present, the first `# heading` of the
 * document is used as the title.
 */

/** Flow-level metadata parsed from the optional YAML frontmatter. */
export interface Frontmatter {
  meta: Record<string, any>;
  body: string;
  bodyStartLine: number;
  error: string | null;
}

/** A run of prose, including any fenced blocks that are not steps. */
export interface MarkdownSegment {
  type: 'markdown';
  content: string;
}

/** An executable ```step block. */
export interface StepSegment {
  type: 'step';
  content: string;
  info: string;
  stepIndex: number;
  startLine: number;
  endLine: number;
  error?: string;
}

export type Segment = MarkdownSegment | StepSegment;

/**
 * The result of parsing a markdown flow.
 *
 * Frontmatter keys are spread onto the result, so the index signature is part
 * of the contract rather than a loophole: callers read `parsed.version`,
 * `parsed.xray` and any other user-defined property straight off it.
 */
export interface ParsedMarkdownFlow extends Record<string, any> {
  title: string | null;
  description: string | null;
  meta: Record<string, any>;
  segments: Segment[];
  steps: Record<string, any>[];
  errors: ParseError[];
}

/** A problem found while parsing a flow document. */
export interface ParseError {
  message: string;
  line: number;
  stepIndex?: number;
}

// Fence info tokens that mark a code block as an executable step.
// Both ```step and ```yaml step (any order) are accepted.
const STEP_TOKENS = ['step', 'flow-step'];

/**
 * Normalize line endings (CRLF / lone CR) so the fence regexes work on
 * documents written on any platform.
 * @param {string} content
 * @returns {string}
 */
const normalize = (content) => (content || '').replace(/\r\n?/g, '\n');

/**
 * Extract the YAML frontmatter from a markdown document.
 * @param {string} content - Full markdown document
 * @returns {{meta: Object, body: string, bodyStartLine: number, error: string|null}}
 */
const parseFrontmatter = (content) => {
  content = normalize(content);
  const result: Frontmatter = { meta: {}, body: content, bodyStartLine: 0, error: null };

  const lines = content.split('\n');
  if (!lines.length || lines[0].trim() !== '---') {
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    // The closing marker must start at column 0 — indented '---' lines can
    // legitimately appear inside YAML block scalars
    if (/^(---|\.\.\.)\s*$/.test(lines[i])) {
      const raw = lines.slice(1, i).join('\n');
      try {
        const meta = YAML.parse(raw);
        if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
          result.meta = meta;
        }
      }
      catch (ex) {
        result.error = `Invalid YAML frontmatter: ${ex.message}`;
      }
      result.body = lines.slice(i + 1).join('\n');
      result.bodyStartLine = i + 1;
      return result;
    }
  }

  // No closing marker: treat the whole document as body
  return result;
};

/**
 * Replace the YAML frontmatter of a markdown document, leaving the body
 * exactly as it was — the document view edits properties, not prose.
 *
 * An empty meta object removes the frontmatter block altogether, and a
 * document that had none gets one prepended.
 *
 * @param {string} content - Full markdown document
 * @param {Object} meta - The frontmatter to write. Key order is kept, so the
 *                        caller decides how the block reads.
 * @returns {string} The document with the new frontmatter
 */
const withFrontmatter = (content, meta) => {
  const { body } = parseFrontmatter(content || '');

  const entries = Object.entries(meta || {}).filter(([key]) => String(key).trim() !== '');

  if (!entries.length) {
    // Nothing left to write: drop the block, and the blank line it left behind
    return body.replace(/^\n+/, '');
  }

  const yaml = YAML.stringify(Object.fromEntries(entries));

  // YAML.stringify always ends with a newline, so the closing marker sits on
  // its own line
  const frontmatter = `---\n${yaml}---\n`;

  if (body.trim() === '') {
    return frontmatter;
  }

  // Keep the body's own leading blank line when it had one, add one otherwise
  return body.startsWith('\n') ? `${frontmatter}${body}` : `${frontmatter}\n${body}`;
};

/**
 * Check whether a fence info string marks a step block.
 * @param {string} info - The text after the opening fence (e.g. "yaml step")
 * @returns {boolean}
 */
const isStepInfo = (info) => {
  const tokens = (info || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.some(token => STEP_TOKENS.includes(token));
};

/**
 * Split a markdown body into ordered segments of markdown content and step
 * blocks. Fenced code blocks that are not steps stay inside the markdown
 * segments, untouched.
 *
 * @param {string} body - Markdown (without frontmatter)
 * @param {number} lineOffset - Line number of the first body line in the
 *                             original document
 * @returns {Array<Object>} segments - Each segment is either
 *   { type: 'markdown', content }
 *   { type: 'step', content, info, stepIndex, startLine, endLine, error? }
 */
const splitSegments = (body, lineOffset = 0) => {
  const lines = normalize(body).split('\n');
  const segments: Segment[] = [];

  let markdownBuffer: string[] = [];
  let stepIndex = 0;

  const flushMarkdown = () => {
    if (!markdownBuffer.length) { return; }
    const content = markdownBuffer.join('\n');
    if (content.trim() !== '') {
      segments.push({ type: 'markdown', content });
    }
    markdownBuffer = [];
  };

  const FENCE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(FENCE_RE);

    if (!match) {
      markdownBuffer.push(lines[i]);
      continue;
    }

    const [, fence, info] = match;

    // Info strings of backtick fences cannot contain backticks (CommonMark)
    if (fence[0] === '`' && info.includes('`')) {
      markdownBuffer.push(lines[i]);
      continue;
    }

    // Find the closing fence: same character, at least same length,
    // nothing but whitespace after it.
    const closeRe = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`);
    let closeIdx = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (closeRe.test(lines[j])) {
        closeIdx = j;
        break;
      }
    }

    const blockLines = closeIdx === -1 ? lines.slice(i + 1) : lines.slice(i + 1, closeIdx);
    const blockContent = blockLines.join('\n');

    if (isStepInfo(info)) {
      flushMarkdown();
      const segment: StepSegment = {
        type: 'step',
        content: blockContent,
        info: info.trim(),
        stepIndex,
        startLine: lineOffset + i + 1,
        endLine: lineOffset + (closeIdx === -1 ? lines.length : closeIdx + 1)
      };
      stepIndex += 1;
      segments.push(segment);
    }
    else {
      // A regular code block: keep it verbatim inside the markdown segment
      markdownBuffer.push(lines[i]);
      markdownBuffer.push(...blockLines);
      if (closeIdx !== -1) {
        markdownBuffer.push(lines[closeIdx]);
      }
    }

    i = closeIdx === -1 ? lines.length : closeIdx;
  }

  flushMarkdown();

  return segments;
};

/**
 * Find the first ATX `# heading` in a list of segments.
 * @param {Array<Object>} segments
 * @returns {string|null}
 */
const findFirstHeading = (segments) => {
  for (const segment of segments) {
    if (segment.type !== 'markdown') { continue; }

    // Walk the lines tracking fenced code blocks, so '# comment' lines
    // inside code blocks are not mistaken for headings
    let openFence: string | null = null;
    for (const line of segment.content.split('\n')) {
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        if (!openFence) {
          openFence = fenceMatch[1];
        }
        else if (fenceMatch[1][0] === openFence[0] && fenceMatch[1].length >= openFence.length) {
          openFence = null;
        }
        continue;
      }
      if (openFence) { continue; }

      const match = line.match(/^ {0,3}#\s+(.+?)\s*#*\s*$/);
      if (match) {
        return match[1].trim();
      }
    }
  }
  return null;
};

/**
 * Parse a markdown flow document.
 *
 * @param {string} content - Full markdown document
 * @returns {Object} {
 *   title, description, version, latentApplications,
 *   meta,          // raw frontmatter
 *   segments,      // ordered markdown/step segments (for rendering)
 *   steps,         // parsed steps (YAML of each step block + stepIndex)
 *   errors         // [{ message, stepIndex?, line? }]
 * }
 */
const parse = (content): ParsedMarkdownFlow => {
  const errors: ParseError[] = [];

  const { meta, body, bodyStartLine, error: frontmatterError } = parseFrontmatter(content || '');
  if (frontmatterError) {
    errors.push({ message: frontmatterError, line: 0 });
  }

  const segments = splitSegments(body, bodyStartLine);

  const steps: Record<string, any>[] = [];
  segments.forEach(segment => {
    if (segment.type !== 'step') { return; }

    let step: any = null;
    try {
      step = YAML.parse(segment.content);
    }
    catch (ex) {
      segment.error = `Invalid step YAML: ${ex.message}`;
      errors.push({
        message: segment.error,
        stepIndex: segment.stepIndex,
        line: segment.startLine
      });
      return;
    }

    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      segment.error = 'Step block must contain a YAML object (application, method, ...)';
      errors.push({
        message: segment.error,
        stepIndex: segment.stepIndex,
        line: segment.startLine
      });
      return;
    }

    steps.push({ ...step, stepIndex: segment.stepIndex });
  });

  const title = meta.title || findFirstHeading(segments) || null;

  return {
    ...meta,
    title,
    description: meta.description || null,
    meta,
    segments,
    steps,
    errors
  };
};

/**
 * Whether a document looks like a markdown flow (i.e. contains at least one
 * fenced "step" block).
 * @param {string} content
 * @returns {boolean}
 */
const isMarkdownFlow = (content) => {
  if (!content || typeof content !== 'string') { return false; }
  const { body } = parseFrontmatter(content);
  return splitSegments(body).some(segment => segment.type === 'step');
};

/**
 * Build the flow object expected by the runners from a markdown document.
 * Throws when the document contains invalid step blocks.
 *
 * @param {string} content - Full markdown document
 * @returns {Object} flow - { title, description, version, latentApplications, steps }
 */
const toFlow = (content): Record<string, any> => {
  const parsed = parse(content);

  if (parsed.errors.length) {
    const details = parsed.errors
      .map(err => (typeof err.stepIndex === 'number' ? `step ${err.stepIndex + 1}: ${err.message}` : err.message))
      .join('; ');
    throw new Error(`Invalid markdown flow: ${details}`);
  }

  if (!parsed.steps.length) {
    throw new Error('Invalid markdown flow: no ```step blocks found');
  }

  const { meta } = parsed;

  return {
    ...meta,
    title: parsed.title || 'Untitled flow',
    description: parsed.description || undefined,
    steps: parsed.steps
  };
};

export {
  parse,
  parseFrontmatter,
  withFrontmatter,
  splitSegments,
  isMarkdownFlow,
  isStepInfo,
  toFlow
};
