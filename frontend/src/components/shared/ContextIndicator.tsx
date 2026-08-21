import React, { useState } from 'react';
import { ArrowDown, ArrowUp, FolderOpen, GitBranch, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import GitSyncDialog from '@/components/shared/GitSyncDialog';
import { useAppState } from '@/context/AppStateContext';
import { trackingLabel } from '@/lib/git';

/**
 * Which folder the app is working in -- and, when that folder is a git
 * repository, which branch and how dirty it is. The sync button next to the
 * name opens the git panel.
 *
 * Everything the app reads and writes lives under this one directory, so it
 * belongs on screen at all times rather than behind a settings page.
 */
export function ContextIndicator() {
  const { contextInfo } = useAppState();
  const [open, setOpen] = useState(false);

  const git = contextInfo?.git;
  const changes = git?.changes?.length || 0;

  const title = contextInfo?.path
    ? `Context directory: ${contextInfo.path}${contextInfo.custom ? ' (--context)' : ''}`
    : 'Context directory';

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <FolderOpen className="text-muted-foreground size-4 shrink-0" />
      {/* A filesystem path speaks as data, so it is set in the mono voice */}
      <span className="max-w-56 truncate font-mono text-[13px] font-medium" title={title}>
        {contextInfo?.path || 'lab34/flows'}
      </span>

      {git && (
        <span
          className="text-muted-foreground ml-1 hidden items-center gap-1 font-mono text-xs sm:inline-flex"
          title={trackingLabel(git)}
        >
          <GitBranch className="size-3" />
          <span className="max-w-40 truncate">{git.branch}</span>
          {git.behind > 0 && (
            <span className="text-info inline-flex items-center">
              <ArrowDown className="size-3" />{git.behind}
            </span>
          )}
          {git.ahead > 0 && (
            <span className="text-warning inline-flex items-center">
              <ArrowUp className="size-3" />{git.ahead}
            </span>
          )}
        </span>
      )}

      <Button
        size="icon-sm"
        variant="ghost"
        className="relative shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Sync with git"
        title={git
          ? `Sync: ${changes} change${changes === 1 ? '' : 's'} on ${git.branch}`
          : 'Sync: this folder is not a git repository'}
      >
        <RefreshCw />
        {/* A dot rather than a count: the exact number is one click away, and
            the bar has no room for it */}
        {changes > 0 && (
          <span className="bg-warning absolute top-0.5 right-0.5 size-1.5 rounded-full" />
        )}
      </Button>

      <GitSyncDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export default ContextIndicator;
