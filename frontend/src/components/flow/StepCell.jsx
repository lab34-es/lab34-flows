import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import CodeBlock from '@/components/shared/CodeBlock';
import ExecutionOutput from '@/components/flow/ExecutionOutput';
import XrayChip from '@/components/flow/XrayChip';
import { cn } from '@/lib/utils';

const STATUS_BORDERS = {
  running: 'border-l-info',
  passed: 'border-l-success',
  failed: 'border-l-destructive',
  error: 'border-l-destructive',
};

/**
 * A notebook cell for a ```step block: the step definition (YAML) with its
 * live execution output right below, like In[]/Out[] in a Python notebook.
 */
export function StepCell({ segment, step, stepData, xrayTest, jiraBaseUrl }) {
  const application = step?.application;
  const method = step?.method;
  const executionStatus = stepData?.execution?.status;

  return (
    <div
      data-role="step-cell"
      className={cn(
        'my-4 overflow-hidden rounded-lg border border-l-4 bg-card shadow-sm',
        STATUS_BORDERS[executionStatus] || 'border-l-border'
      )}
    >
      {/* Cell header */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          step {segment.stepIndex + 1}
        </Badge>
        {application ? (
          <span className="font-mono text-xs">
            <Link className="text-info hover:underline" to={`/applications/${encodeURIComponent(application)}`}>
              {application}
            </Link>
            {method && (
              <>
                <span className="text-muted-foreground"> · </span>
                <Link
                  className="text-info hover:underline"
                  to={`/applications/${encodeURIComponent(application)}?method=${encodeURIComponent(method)}`}
                >
                  {method}
                </Link>
              </>
            )}
          </span>
        ) : (
          !segment.error && <span className="text-muted-foreground text-xs">step</span>
        )}
        {step?.description && (
          <span className="text-muted-foreground truncate text-xs">— {step.description}</span>
        )}
        {step?.testKey && (
          <XrayChip
            testKey={step.testKey}
            test={xrayTest}
            jiraBaseUrl={jiraBaseUrl}
            compact
          />
        )}
      </div>

      {/* Step definition (YAML) */}
      <CodeBlock code={segment.content} language="yaml" className="rounded-none border-0" />

      {/* Invalid step YAML */}
      {segment.error && (
        <div className="border-t border-destructive/40 bg-destructive/5 flex items-start gap-2 px-4 py-2 text-xs">
          <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" />
          <span className="text-destructive font-mono">{segment.error}</span>
        </div>
      )}

      {/* Notebook-style execution output */}
      <ExecutionOutput stepData={stepData} />
    </div>
  );
}

export default StepCell;
