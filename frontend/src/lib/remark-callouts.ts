/**
 * GitHub-style callouts (alerts) for Markdown prose.
 *
 * A blockquote whose first line is a `[!TYPE]` marker becomes a callout:
 *
 *     > [!WARNING]
 *     > Running this deletes the reservation.
 *
 * The marker may also carry a custom title on the same line
 * (`> [!NOTE] Read this first`), which replaces the default label.
 *
 * The transform stays in mdast: the blockquote is turned into a `<div>` with
 * `data-callout` set to the lowercased type, and the marker text is stripped
 * from the content. `Markdown.tsx` picks that attribute up and renders the
 * icon and the title bar; blockquotes without a marker are left alone.
 */

const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;

export type CalloutType = (typeof CALLOUT_TYPES)[number];

/** Default title shown when the marker line carries no custom one. */
export const CALLOUT_LABELS: Record<CalloutType, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};

// The marker has to open the blockquote, optionally followed by a title on the
// same line. Everything up to (and including) that first newline is consumed.
const MARKER = new RegExp(`^\\[!(${CALLOUT_TYPES.join('|')})\\][ \\t]*([^\\n]*)(?:\\n|$)`, 'i');

function isCalloutType(value: string): value is CalloutType {
  return (CALLOUT_TYPES as readonly string[]).includes(value);
}

/**
 * Rewrites one blockquote in place. Returns false when it carries no marker.
 */
function transformBlockquote(node: any): boolean {
  const paragraph = node.children?.[0];
  if (!paragraph || paragraph.type !== 'paragraph') return false;

  const first = paragraph.children?.[0];
  if (!first || first.type !== 'text' || typeof first.value !== 'string') return false;

  const match = MARKER.exec(first.value);
  if (!match) return false;

  const type = match[1].toLowerCase();
  if (!isCalloutType(type)) return false;

  const title = match[2].trim() || CALLOUT_LABELS[type];

  // Drop the marker from the prose. A blockquote holding nothing but the
  // marker line leaves an empty paragraph behind, so remove that too.
  first.value = first.value.slice(match[0].length);
  if (!first.value) {
    paragraph.children.shift();
    if (paragraph.children.length === 0) node.children.shift();
  }

  node.data = {
    ...(node.data || {}),
    hName: 'div',
    hProperties: {
      ...(node.data?.hProperties || {}),
      'data-callout': type,
      'data-callout-title': title,
    },
  };
  return true;
}

/** Depth-first walk; callouts nest inside lists and other blockquotes. */
function walk(node: any): void {
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (child?.type === 'blockquote') transformBlockquote(child);
    walk(child);
  }
}

export function remarkCallouts() {
  return (tree: any) => walk(tree);
}

export default remarkCallouts;
