/**
 * The "/" menu of the editable Document view.
 *
 * Typing `/` while writing prose opens a list of the things a flow can hold —
 * headings, lists, tables, callouts and, above all, executable `step` blocks —
 * the same way Obsidian does it. Every entry is a small Markdown template, so
 * nothing here is a special editor object: what the menu inserts is exactly
 * what the file will contain, and it can be typed by hand just as well.
 *
 * `$|` marks where the caret lands once the template is in. Three shapes:
 *
 * - `line`   — a prefix for the line the caret is on (`# `, `- `, `> `).
 * - `inline` — text dropped at the caret (a link, an image).
 * - `block`  — a block of its own; the paragraph being written is split
 *              around it when it is not empty.
 */

export type SlashMode = 'line' | 'inline' | 'block';

export interface SlashCommand {
  id: string;
  /** Icon key, resolved against the map in SlashMenu. */
  icon: string;
  label: string;
  /** What the entry writes, shown right of the label. */
  hint: string;
  group: string;
  mode: SlashMode;
  /** Markdown template. `$|` marks the caret, and is removed on insert. */
  template: string;
  /** Extra words the entry answers to, beyond its own label. */
  keywords?: string[];
}

/** Where the caret goes inside a template, and the template without the marker. */
export const expandTemplate = (template: string): { text: string; caret: number } => {
  const caret = template.indexOf('$|');
  if (caret === -1) return { text: template, caret: template.length };
  return { text: template.replace('$|', ''), caret };
};

export const SLASH_COMMANDS: SlashCommand[] = [
  /* ------------------------------- Flow -------------------------------- */
  {
    id: 'step',
    icon: 'play',
    label: 'Step',
    hint: 'Executable step block',
    group: 'Flow',
    mode: 'block',
    keywords: ['run', 'execute', 'application', 'method', 'call', 'request'],
    template: '```step\napplication: $|\nmethod: \n```',
  },
  {
    id: 'step-parameters',
    icon: 'play',
    label: 'Step with parameters',
    hint: 'Step block with a body',
    group: 'Flow',
    mode: 'block',
    keywords: ['run', 'execute', 'payload', 'body', 'parameters'],
    template: '```step\napplication: $|\nmethod: \nparameters:\n  body:\n    key: value\n```',
  },
  {
    id: 'step-test',
    icon: 'check',
    label: 'Step with assertions',
    hint: 'Step block with a test',
    group: 'Flow',
    mode: 'block',
    keywords: ['run', 'execute', 'assert', 'expect', 'test', 'status'],
    template: '```step\napplication: $|\nmethod: \ntest:\n  status: 200\n```',
  },

  /* ------------------------------- Basic ------------------------------- */
  { id: 'h1', icon: 'h1', label: 'Heading 1', hint: '# ', group: 'Basic', mode: 'line', template: '# ', keywords: ['title'] },
  { id: 'h2', icon: 'h2', label: 'Heading 2', hint: '## ', group: 'Basic', mode: 'line', template: '## ', keywords: ['section', 'subtitle'] },
  { id: 'h3', icon: 'h3', label: 'Heading 3', hint: '### ', group: 'Basic', mode: 'line', template: '### ', keywords: ['subsection'] },
  { id: 'bullet', icon: 'list', label: 'Bullet list', hint: '- ', group: 'Basic', mode: 'line', template: '- ', keywords: ['unordered', 'ul', 'item'] },
  { id: 'numbered', icon: 'list-ordered', label: 'Numbered list', hint: '1. ', group: 'Basic', mode: 'line', template: '1. ', keywords: ['ordered', 'ol', 'steps'] },
  { id: 'task', icon: 'check-square', label: 'Task list', hint: '- [ ] ', group: 'Basic', mode: 'line', template: '- [ ] ', keywords: ['todo', 'checkbox', 'checklist'] },
  { id: 'quote', icon: 'quote', label: 'Quote', hint: '> ', group: 'Basic', mode: 'line', template: '> ', keywords: ['blockquote', 'citation'] },
  {
    id: 'code',
    icon: 'code',
    label: 'Code block',
    hint: 'Fenced, highlighted',
    group: 'Basic',
    mode: 'block',
    keywords: ['fence', 'snippet', 'syntax', 'json', 'yaml'],
    template: '```\n$|\n```',
  },
  {
    id: 'table',
    icon: 'table',
    label: 'Table',
    hint: '3 columns',
    group: 'Basic',
    mode: 'block',
    keywords: ['grid', 'rows', 'columns'],
    template: '| $| | Column | Column |\n|-|-|-|\n|  |  |  |',
  },
  { id: 'divider', icon: 'minus', label: 'Divider', hint: '---', group: 'Basic', mode: 'block', template: '---', keywords: ['rule', 'separator', 'hr', 'line'] },
  { id: 'link', icon: 'link', label: 'Link', hint: '[text](url)', group: 'Basic', mode: 'inline', template: '[$|](https://)', keywords: ['url', 'href', 'anchor'] },
  { id: 'image', icon: 'image', label: 'Image', hint: '![alt](path)', group: 'Basic', mode: 'inline', template: '![$|](./image.png)', keywords: ['picture', 'screenshot', 'diagram'] },

  /* ------------------------------ Callouts ------------------------------ */
  {
    id: 'callout-note',
    icon: 'info',
    label: 'Note callout',
    hint: '> [!NOTE]',
    group: 'Callouts',
    mode: 'block',
    keywords: ['admonition', 'alert', 'aside', 'info'],
    template: '> [!NOTE]\n> $|',
  },
  {
    id: 'callout-tip',
    icon: 'lightbulb',
    label: 'Tip callout',
    hint: '> [!TIP]',
    group: 'Callouts',
    mode: 'block',
    keywords: ['admonition', 'alert', 'advice', 'hint'],
    template: '> [!TIP]\n> $|',
  },
  {
    id: 'callout-important',
    icon: 'message-warning',
    label: 'Important callout',
    hint: '> [!IMPORTANT]',
    group: 'Callouts',
    mode: 'block',
    keywords: ['admonition', 'alert', 'crucial'],
    template: '> [!IMPORTANT]\n> $|',
  },
  {
    id: 'callout-warning',
    icon: 'triangle-alert',
    label: 'Warning callout',
    hint: '> [!WARNING]',
    group: 'Callouts',
    mode: 'block',
    keywords: ['admonition', 'alert', 'risk', 'careful'],
    template: '> [!WARNING]\n> $|',
  },
  {
    id: 'callout-caution',
    icon: 'octagon-alert',
    label: 'Caution callout',
    hint: '> [!CAUTION]',
    group: 'Callouts',
    mode: 'block',
    keywords: ['admonition', 'alert', 'danger', 'destructive'],
    template: '> [!CAUTION]\n> $|',
  },
];

/**
 * The entries a query matches, in menu order.
 *
 * Matching is a plain substring test over the label, the group and the
 * keywords: "cal" finds every callout, "warn" finds the warning one, and an
 * empty query lists everything.
 *
 * @param {string} query - What was typed after the slash
 * @returns {SlashCommand[]} The matching commands
 */
export const filterSlashCommands = (query: string): SlashCommand[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return SLASH_COMMANDS;

  return SLASH_COMMANDS.filter((command) => {
    const haystack = [command.label, command.group, command.hint, ...(command.keywords || [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
};

export default SLASH_COMMANDS;
