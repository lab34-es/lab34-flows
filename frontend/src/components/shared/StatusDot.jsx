import React from 'react';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const STATUS_STYLES = {
  standby: 'bg-muted-foreground/40',
  running: 'bg-info animate-pulse',
  ok: 'bg-success',
  error: 'bg-destructive',
};

const STATUS_LABELS = {
  standby: 'Standby',
  running: 'Running…',
  ok: 'OK — last run passed',
  error: 'Error — last run failed',
};

/**
 * Tiny status indicator used in the flows sidebar:
 * standby (grey), running (pulsing blue), ok (green), error (red).
 */
export function StatusDot({ status = 'standby', className }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-status={status}
          className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_STYLES[status] || STATUS_STYLES.standby, className)}
        />
      </TooltipTrigger>
      <TooltipContent side="right">{STATUS_LABELS[status] || status}</TooltipContent>
    </Tooltip>
  );
}

export default StatusDot;
