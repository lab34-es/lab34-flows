import { Marked } from 'marked';

const marked = new Marked({ gfm: true });

/** Render a help article body (Markdown) to HTML. */
export function renderMarkdown(markdown) {
  return marked.parse(markdown.trim());
}
