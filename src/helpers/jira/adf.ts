/**
 * Jira descriptions, as Markdown.
 *
 * The same field arrives in two very different shapes depending on who
 * answered: Jira's REST v2 API (and every Jira Server/DC) sends wiki markup
 * as a plain string, while anything going through the v3 API — Xray Cloud
 * proxies Jira fields that way — sends an Atlassian Document Format tree.
 *
 * Both end up here and both come out as Markdown, because that is what a
 * flow file holds. The conversion is deliberately conservative: text that
 * cannot be translated with certainty is kept as it was rather than mangled.
 */

/* ------------------------------ Wiki markup ------------------------------ */

/**
 * Convert a Jira wiki markup line prefix into its Markdown equivalent.
 * @param {string} line
 * @returns {string}
 */
const wikiLine = (line) => {
  // h1. Title -> # Title
  const heading = line.match(/^h([1-6])\.\s*(.*)$/);
  if (heading) {
    return `${'#'.repeat(Number(heading[1]))} ${heading[2]}`;
  }

  // bq. quoted -> > quoted
  const quote = line.match(/^bq\.\s*(.*)$/);
  if (quote) {
    return `> ${quote[1]}`;
  }

  // Nested bullets: * / ** / *** -> -, indented
  const bullet = line.match(/^(\*+)\s+(.*)$/);
  if (bullet) {
    return `${'  '.repeat(bullet[1].length - 1)}- ${bullet[2]}`;
  }

  // Nested numbers: # / ## -> 1., indented
  const number = line.match(/^(#+)\s+(.*)$/);
  if (number) {
    return `${'   '.repeat(number[1].length - 1)}1. ${number[2]}`;
  }

  return line;
};

/**
 * Convert the inline constructs of Jira wiki markup.
 *
 * Only the unambiguous ones are touched: emphasis markers that could just as
 * well be part of the text (a lone asterisk, an underscore inside an
 * identifier) are left alone, because a wrong guess corrupts the sentence.
 *
 * @param {string} text
 * @returns {string}
 */
const wikiInline = (text) => text
  // {{monospaced}} -> `monospaced`
  .replace(/\{\{(.+?)\}\}/g, '`$1`')
  // [label|https://…] -> [label](https://…), [https://…] -> <https://…>
  .replace(/\[([^\]|]+)\|((?:https?|mailto):[^\]]+)\]/g, '[$1]($2)')
  .replace(/\[((?:https?|mailto):[^\]]+)\]/g, '<$1>')
  // *strong* -> **strong**, but only when it wraps a word
  .replace(/(^|[\s(])\*(\S(?:[^*\n]*\S)?)\*(?=[\s).,;:!?]|$)/g, '$1**$2**')
  // _emphasis_ -> *emphasis*, never inside_an_identifier
  .replace(/(^|[\s(])_(\S(?:[^_\n]*\S)?)_(?=[\s).,;:!?]|$)/g, '$1*$2*')
  // {color:red}text{color} and friends carry no meaning in Markdown
  .replace(/\{color:[^}]*\}/g, '')
  .replace(/\{color\}/g, '');

/**
 * Convert Jira wiki markup into Markdown.
 * @param {string} text
 * @returns {string}
 */
const fromWiki = (text) => {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  // Everything between {code}/{noformat} markers is copied verbatim
  let fenced = false;

  lines.forEach(line => {
    const block = line.match(/^\{(code|noformat)(?::([^}]*))?\}\s*$/);

    if (block) {
      if (fenced) {
        out.push('```');
        fenced = false;
        return;
      }

      const attributes = block[2] || '';
      // {code:java} and {code:language=java} both name the language
      const language = attributes.match(/(?:^|:|\|)(?:language=)?([a-z0-9+#-]+)\s*$/i);
      out.push(`\`\`\`${block[1] === 'code' && language ? language[1] : ''}`);
      fenced = true;
      return;
    }

    if (fenced) {
      out.push(line);
      return;
    }

    // {panel:title=…} / {quote} wrappers have no Markdown counterpart
    if (/^\{(panel|quote)(:[^}]*)?\}\s*$/.test(line)) {
      return;
    }

    out.push(wikiInline(wikiLine(line)));
  });

  if (fenced) {
    out.push('```');
  }

  return out.join('\n').trim();
};

/* -------------------------- Atlassian Document --------------------------- */

/**
 * Wrap a text node in the Markdown of its marks (bold, links, code...).
 * @param {Object} node - An ADF "text" node
 * @returns {string}
 */
const withMarks = (node) => {
  let text = node.text || '';

  (node.marks || []).forEach(mark => {
    const attrs = mark.attrs || {};

    switch (mark.type) {
      case 'strong': text = `**${text}**`; break;
      case 'em': text = `*${text}*`; break;
      case 'code': text = `\`${text}\``; break;
      case 'strike': text = `~~${text}~~`; break;
      case 'link': text = `[${text}](${attrs.href || ''})`; break;
      default: break;
    }
  });

  return text;
};

/**
 * Render the children of a node as a single line of inline Markdown.
 * @param {Object} node
 * @returns {string}
 */
const inline = (node) => (node && Array.isArray(node.content) ? node.content : [])
  .map(child => {
    switch (child.type) {
      case 'text': return withMarks(child);
      case 'hardBreak': return '\n';
      case 'emoji': return (child.attrs && (child.attrs.text || child.attrs.shortName)) || '';
      case 'mention': return (child.attrs && child.attrs.text) || '';
      case 'inlineCard': return (child.attrs && child.attrs.url) ? `<${child.attrs.url}>` : '';
      case 'status': return (child.attrs && child.attrs.text) || '';
      case 'date': return (child.attrs && child.attrs.timestamp) || '';
      default: return inline(child);
    }
  })
  .join('');

/**
 * Indent every line of a block, so it stays inside its list item.
 * @param {string} text
 * @param {string} prefix - Indentation for the continuation lines
 * @returns {string}
 */
const indent = (text, prefix) => text
  .split('\n')
  .map((line, index) => (index === 0 || line === '' ? line : `${prefix}${line}`))
  .join('\n');

/**
 * Render one ADF row as a Markdown table row.
 * @param {Object} row - An ADF "tableRow" node
 * @returns {string}
 */
const tableRow = (row) => {
  const cells = (row.content || []).map(cell => inline((cell.content || [])[0] || {}).replace(/\|/g, '\\|').trim());
  return `| ${cells.join(' | ')} |`;
};

/**
 * Render one ADF block node as Markdown.
 * @param {Object} node
 * @param {number} depth - Nesting level, for lists
 * @returns {string}
 */
const block = (node, depth = 0) => {
  if (!node || typeof node !== 'object') { return ''; }

  const attrs = node.attrs || {};
  const children = Array.isArray(node.content) ? node.content : [];

  switch (node.type) {
    case 'doc':
      return children.map(child => block(child, depth)).filter(Boolean).join('\n\n');

    case 'paragraph':
      return inline(node);

    case 'heading':
      return `${'#'.repeat(Math.min(Number(attrs.level) || 1, 6))} ${inline(node)}`;

    case 'bulletList':
    case 'orderedList': {
      const ordered = node.type === 'orderedList';
      const pad = '  '.repeat(depth);

      return children.map((item, index) => {
        const marker = ordered ? `${(Number(attrs.order) || 1) + index}. ` : '- ';
        const body = (item.content || [])
          .map(child => block(child, depth + 1))
          .filter(Boolean)
          .join('\n\n');
        return `${pad}${marker}${indent(body, `${pad}${' '.repeat(marker.length)}`)}`;
      }).join('\n');
    }

    case 'codeBlock':
      return `\`\`\`${attrs.language || ''}\n${inline(node)}\n\`\`\``;

    case 'blockquote':
      return children
        .map(child => block(child, depth))
        .filter(Boolean)
        .join('\n\n')
        .split('\n')
        .map(line => `> ${line}`.trimEnd())
        .join('\n');

    case 'panel':
      return children.map(child => block(child, depth)).filter(Boolean).join('\n\n');

    case 'rule':
      return '---';

    case 'table': {
      const rows = children.filter(child => child.type === 'tableRow');
      if (!rows.length) { return ''; }

      const [header, ...body] = rows;
      const columns = (header.content || []).length;

      return [
        tableRow(header),
        `|${' --- |'.repeat(columns)}`,
        ...body.map(tableRow)
      ].join('\n');
    }

    case 'mediaSingle':
    case 'mediaGroup':
    case 'media':
      // Attachments live in Jira, not in the flows folder: naming them is
      // more useful than a link that would not resolve
      return attrs.alt ? `_(attachment: ${attrs.alt})_` : '';

    default:
      return children.map(child => block(child, depth)).filter(Boolean).join('\n\n');
  }
};

/**
 * Convert an Atlassian Document Format tree into Markdown.
 * @param {Object} doc
 * @returns {string}
 */
const fromAdf = (doc) => block(doc).replace(/\n{3,}/g, '\n\n').trim();

/**
 * Convert whatever Jira returned for a rich text field into Markdown.
 * @param {*} value - A wiki markup string, an ADF document, or nothing
 * @returns {string} Markdown, possibly empty
 */
const toMarkdown = (value) => {
  if (!value) { return ''; }
  if (typeof value === 'string') { return fromWiki(value); }

  if (typeof value === 'object') {
    // Some endpoints wrap the document, others send it bare
    if (value.type === 'doc' || Array.isArray(value.content)) { return fromAdf(value); }
    if (typeof value.value === 'string') { return fromWiki(value.value); }
  }

  return '';
};

export {
  toMarkdown,
  fromWiki,
  fromAdf
};
