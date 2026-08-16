import React from 'react';
import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * The Xray Test a flow (or one of its steps) points at.
 *
 * Renders nothing until the backend has answered, and nothing at all when
 * the integration is not configured — the flow reads exactly as before.
 *
 * @param {Object} props
 * @param {string} props.testKey - Jira issue key, e.g. "BOP-1234"
 * @param {Object} [props.test] - Record from /api/jira/tests, when it arrived
 * @param {string} [props.jiraBaseUrl] - To link the key to its issue
 * @param {boolean} [props.compact] - Discreet variant, used inside a step
 */
export function XrayChip({ testKey, test, jiraBaseUrl, compact = false }) {
  if (!testKey || !test) { return null; }

  const className = cn('gap-1 font-mono', compact && 'text-[10px]');
  const href = jiraBaseUrl ? `${jiraBaseUrl}/browse/${encodeURIComponent(testKey)}` : null;

  // Network or credentials problem: the key is still worth showing, with the
  // reason one hover away
  if (test.error) {
    return (
      <span
        className={cn('text-muted-foreground font-mono text-xs', compact && 'text-[10px]')}
        title={test.error}
      >
        {testKey}
      </span>
    );
  }

  if (!test.found) {
    return (
      <Badge
        variant="outline"
        className={cn(className, 'text-muted-foreground border-dashed')}
        title={`${testKey} was not found in Jira`}
      >
        {testKey} · not found
      </Badge>
    );
  }

  const label = (
    <>
      {testKey}
      {test.status && (
        <span className={cn('text-muted-foreground font-sans', compact ? 'text-[10px]' : 'text-xs')}>
          · {test.status}
        </span>
      )}
      {href && <ExternalLink className="size-3" />}
    </>
  );

  const title = [test.summary, test.testType && `Test type: ${test.testType}`]
    .filter(Boolean)
    .join(' — ');

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {href ? (
        <Badge variant="outline" className={cn(className, 'hover:bg-accent')} asChild>
          <a href={href} target="_blank" rel="noopener noreferrer" title={title || testKey}>
            {label}
          </a>
        </Badge>
      ) : (
        <Badge variant="outline" className={className} title={title || testKey}>{label}</Badge>
      )}
      {test.summary && (
        <span
          className={cn('text-muted-foreground truncate', compact ? 'text-[10px]' : 'text-xs')}
          title={test.summary}
        >
          {test.summary}
        </span>
      )}
    </span>
  );
}

export default XrayChip;
