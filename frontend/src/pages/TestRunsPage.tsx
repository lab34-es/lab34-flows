import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatusDot from '@/components/shared/StatusDot';
import { useAppState } from '@/context/AppStateContext';
import { dotStatus, formatDuration, runLabel, runScore, testRunUrl, triggerLabel } from '@/lib/testRuns';

/**
 * Every recorded test run, newest first. The list lives in the app state and
 * refreshes itself over the socket, so a run in progress ticks along here.
 */
export function TestRunsPage() {
  const navigate = useNavigate();
  const { testRuns } = useAppState();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="bg-background/95 sticky top-0 z-10 border-b px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <History className="text-muted-foreground size-4" />
          <h1 className="text-lg font-bold tracking-tight">Test runs</h1>
          <span className="text-muted-foreground text-sm">
            {testRuns.length} run{testRuns.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Every execution — from a flow’s Run button, a folder’s “Run all” or the CLI —
          stored under <span className="font-mono">test-runs/</span> in the context directory.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {testRuns.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            No runs yet. Run a flow — or “Run all” on a folder — and it will be recorded here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">Flows</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testRuns.map((run) => (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() => navigate(testRunUrl(run.id))}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusDot status={dotStatus(run.status)} />
                      <span className="font-medium">{runLabel(run)}</span>
                      <span className="text-muted-foreground font-mono text-xs">{run.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{triggerLabel(run.trigger)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{run.environment}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {run.trigger === 'folder'
                      ? `${run.folder || 'All flows'}${run.view ? ` · ${run.view}` : ''}`
                      : (run.flows?.[0]?.file || '—')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{runScore(run)}</TableCell>
                  <TableCell className="text-muted-foreground text-right font-mono text-xs">
                    {formatDuration(run.times) || '…'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export default TestRunsPage;
