import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/lib/utils';
import CodeBlock from '@/components/shared/CodeBlock';

/**
 * Markdown renderer for flow prose and application READMEs.
 * Fenced code blocks are highlighted with Prism.
 */
export function Markdown({ children, className }) {
  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children: preChildren }) {
            // Let the `code` renderer decide; avoid double <pre>
            return <>{preChildren}</>;
          },
          code({ inline, className: codeClassName, children: codeChildren, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const content = String(codeChildren ?? '').replace(/\n$/, '');
            const isBlock = match || content.includes('\n');

            if (!inline && isBlock) {
              return <CodeBlock code={content} language={match ? match[1] : undefined} className="my-2" />;
            }

            return (
              <code className={codeClassName} {...props}>
                {codeChildren}
              </code>
            );
          },
          a({ children: linkChildren, ...props }) {
            return (
              <a {...props} target="_blank" rel="noreferrer">
                {linkChildren}
              </a>
            );
          },
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
