import React from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, CircleDashed, Loader2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import CodeBlock from '@/components/shared/CodeBlock';
import { cn } from '@/lib/utils';

const STATUS_META = {
  running: { label: 'Running', variant: 'info', Icon: Loader2, iconClass: 'animate-spin' },
  passed: { label: 'Passed', variant: 'success', Icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', Icon: XCircle },
  error: { label: 'Error', variant: 'destructive', Icon: AlertCircle },
};

const formatDuration = (times) => {
  if (!times?.start || !times?.end) { return null; }
  const ms = times.end - times.start;
  if (ms < 1000) { return `${ms} ms`; }
  return `${(ms / 1000).toFixed(2)} s`;
};

const asJson = (value) => JSON.stringify(value, null, 2);

function Section({ title, defaultOpen = false, badge, children }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group/section">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center gap-1 py-1 text-xs font-semibold uppercase tracking-wide">
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]/section:rotate-90" />
        {title}
        {badge}
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-2 pl-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function TestReport({ report }) {
  if (!report) { return null; }

  const aspects = Object.entries(report).filter(([key, value]) => key !== 'hasErrors' && Array.isArray(value));

  if (!report.hasErrors) {
    return (
      <div className="text-success flex items-center gap-1.5 text-sm">
        <CheckCircle2 className="size-4" /> All assertions passed
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {aspects.map(([aspect, errors]) => {
        if (!errors.length) {
          return (
            <div key={aspect} className="text-success flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="size-3.5" /> {aspect}: passed
            </div>
          );
        }

        return (
          <div key={aspect} className="space-y-2">
            <div className="text-destructive flex items-center gap-1.5 text-xs font-semibold">
              <XCircle className="size-3.5" /> {aspect}: {errors.length} failed assertion{errors.length > 1 ? 's' : ''}
            </div>
            {errors.map((error, index) => (
              <div key={index} className="border-destructive/40 bg-destructive/5 space-y-1 rounded-md border px-3 py-2 text-xs">
                <p className="font-medium">{error.message}</p>
                {'expression' in error && (
                  <p className="font-mono text-[11px]">
                    <span className="text-muted-foreground">expression:</span> {error.expression}
                  </p>
                )}
                {'expected' in error && (
                  <p className="font-mono text-[11px]">
                    <span className="text-success">expected:</span> {asJson(error.expected)}
                  </p>
                )}
                {('actual' in error || 'actualValue' in error) && (
                  <p className="font-mono text-[11px]">
                    <span className="text-destructive">actual:</span>{' '}
                    {asJson('actual' in error ? error.actual : error.actualValue)}
                  </p>
                )}
                {'errors' in error && Array.isArray(error.errors) && error.errors.map((sub, subIndex) => (
                  <p key={subIndex} className="font-mono text-[11px]">{asJson(sub)}</p>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The notebook "output cell": live execution details rendered below a step's
 * code block (status, request, response, assertions, errors).
 */
export function ExecutionOutput({ stepData }) {
  const execution = stepData?.execution;

  if (!stepData || !execution) {
    return null;
  }

  const meta = STATUS_META[execution.status] || {
    label: execution.status || 'Pending', variant: 'secondary', Icon: CircleDashed,
  };
  const duration = formatDuration(execution.times);
  const response = stepData.response;
  const request = stepData.request || stepData.parameters;
  const responseStatus = response?.status;

  return (
    <div className="border-t bg-muted/20 px-4 py-3" data-role="execution-output">
      {/* Status line */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={meta.variant} className="gap-1">
          <meta.Icon className={cn('size-3', meta.iconClass)} /> {meta.label}
        </Badge>
        {duration && <span className="text-muted-foreground font-mono text-xs">{duration}</span>}
        {execution.attempt > 0 && (
          <Badge variant="warning" className="text-[10px]">retry #{execution.attempt}</Badge>
        )}
        {responseStatus !== undefined && responseStatus !== null && (
          <Badge variant={responseStatus < 400 ? 'secondary' : 'destructive'} className="font-mono text-[10px]">
            HTTP {responseStatus}
          </Badge>
        )}
      </div>

      {/* Runner error */}
      {execution.error && (
        <div className="border-destructive/40 bg-destructive/5 mb-2 rounded-md border px-3 py-2 text-xs">
          <p className="text-destructive font-semibold">{execution.error.name || 'Error'}</p>
          <p className="mt-0.5 font-mono">{execution.error.message}</p>
        </div>
      )}

      {/* Request (parameters after replacers were applied) */}
      {request && Object.keys(request).length > 0 && (
        <Section title="Request">
          <CodeBlock code={asJson(request)} language="json" />
        </Section>
      )}

      {/* Response */}
      {response && (
        <>
          {response.headers && Object.keys(response.headers).length > 0 && (
            <Section title="Response headers">
              <CodeBlock code={asJson(response.headers)} language="json" />
            </Section>
          )}
          <Section title="Response body" defaultOpen>
            {response.body !== undefined && response.body !== null && response.body !== '' ? (
              <CodeBlock
                code={typeof response.body === 'string' ? response.body : asJson(response.body)}
                language={typeof response.body === 'string' ? undefined : 'json'}
              />
            ) : (
              <p className="text-muted-foreground text-xs">Empty body</p>
            )}
          </Section>
        </>
      )}

      {/* Test report */}
      {stepData.testReport && (
        <Section
          title="Tests"
          defaultOpen
          badge={
            stepData.testReport.hasErrors
              ? <Badge variant="destructive" className="ml-1 text-[10px]">failed</Badge>
              : <Badge variant="success" className="ml-1 text-[10px]">passed</Badge>
          }
        >
          <TestReport report={stepData.testReport} />
        </Section>
      )}
    </div>
  );
}

export default ExecutionOutput;
