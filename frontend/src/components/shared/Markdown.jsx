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
          // Fenced code blocks arrive as <pre><code class="language-x">…</code></pre>.
          // Replace the whole <pre> with the highlighted CodeBlock; inline
          // code keeps the default <code> rendering.
          pre({ children: preChildren }) {
            const codeElement = React.Children.toArray(preChildren)[0];
            if (codeElement && codeElement.props) {
              const match = /language-(\w+)/.exec(codeElement.props.className || '');
              const content = String(codeElement.props.children ?? '').replace(/\n$/, '');
              return (
                <CodeBlock code={content} language={match ? match[1] : undefined} className="my-2" />
              );
            }
            return <pre>{preChildren}</pre>;
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
