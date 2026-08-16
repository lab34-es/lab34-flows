import React, { useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-markdown';

import { cn } from '@/lib/utils';

const ALIASES = {
  yml: 'yaml',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  md: 'markdown',
};

/**
 * Lightweight syntax-highlighted code block (Prism), themed through CSS
 * variables so it follows light/dark mode.
 */
export function CodeBlock({ code, language, className }) {
  const lang = ALIASES[language] || language;
  const grammar = lang ? Prism.languages[lang] : null;

  const html = useMemo(() => {
    if (!grammar) { return null; }
    try {
      return Prism.highlight(code || '', grammar, lang);
    } catch {
      return null;
    }
  }, [code, grammar, lang]);

  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-lg border bg-muted/40 p-3 text-[0.8rem] leading-relaxed font-mono',
        className
      )}
    >
      {html !== null ? (
        <code
          className={`language-${lang}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <code>{code}</code>
      )}
    </pre>
  );
}

export default CodeBlock;
