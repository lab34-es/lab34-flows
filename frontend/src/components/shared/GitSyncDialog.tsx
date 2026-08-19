import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import GitBadge from '@/components/shared/GitBadge';
import { useAppState } from '@/context/AppStateContext';
import { contextApi } from '@/services/api';
import { decorationFor, trackingLabel } from '@/lib/git';
import { cn } from '@/lib/utils';

/**
 * The git panel for the context directory: which branch it is on, what
 * changed in it, and the three things one does about that -- pull, commit,
 * push -- without leaving the app for a terminal.
 *
 * Every action re-reads the context afterwards, so the sidebar decorations
 * and the branch line here always describe the same moment.
 */
export function GitSyncDialog({ open, onOpenChange }) {
  const { contextInfo, refreshContext, refreshTree, refreshApplications } = useAppState();
  const git = contextInfo?.git;

  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<any>(null);
  const [output, setOutput] = useState('');

  const changes = useMemo(
    () => (git?.changes || []).filter(change => change.contextPath),
    [git]
  );

  // Opening the panel is the moment the user asks "what is going on right
  // now": answer with fresh state, not with whatever the last poll saw.
  useEffect(() => {
    if (!open) { return; }
    setError(null);
    setOutput('');
    setSelected([]);
    refreshContext();
  }, [open, refreshContext]);

  const toggle = (filePath) => {
    setSelected(current => (current.includes(filePath)
      ? current.filter(value => value !== filePath)
      : current.concat(filePath)));
  };

  /**
   * Run one git action, then re-read everything it could have changed:
   * a pull rewrites files, which rewrites the tree and the applications list.
   */
  const act = async (name, call) => {
    setBusy(name);
    setError(null);
    setOutput('');

    try {
      const response = await call();
      setOutput(String(response.data?.output || '').trim());
      if (name === 'commit') {
        setMessage('');
        setSelected([]);
      }
      await Promise.all([refreshTree(), refreshApplications()]);
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
      await refreshContext();
    } finally {
      setBusy('');
    }
  };

  const commitLabel = selected.length
    ? `Commit ${selected.length} selected`
    : `Commit all (${changes.length})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="size-4" /> Sync {contextInfo?.name}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {contextInfo?.path}
          </DialogDescription>
        </DialogHeader>

        {!git ? (
          <p className="text-muted-foreground text-sm">
            This context directory is not inside a git repository. Run{' '}
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">git init</code> in it
            to track your flows and applications with the rest of your team.
          </p>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            {/* ----------------------- Branch ----------------------- */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <GitBranch className="text-muted-foreground size-3.5" />
                {git.branch || 'unknown'}
                {git.detached && (
                  <span className="text-muted-foreground text-xs">(detached)</span>
                )}
              </span>

              <span className="text-muted-foreground text-xs" title={trackingLabel(git)}>
                {git.upstream || 'no upstream'}
              </span>

              {git.behind > 0 && (
                <span className="text-info inline-flex items-center gap-0.5 text-xs" title={`${git.behind} commit(s) to pull`}>
                  <ArrowDown className="size-3" />{git.behind}
                </span>
              )}
              {git.ahead > 0 && (
                <span className="text-warning inline-flex items-center gap-0.5 text-xs" title={`${git.ahead} commit(s) to push`}>
                  <ArrowUp className="size-3" />{git.ahead}
                </span>
              )}

              {git.remote?.webUrl && (
                <a
                  href={git.remote.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-info ml-auto inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
                  title={git.remote.url}
                >
                  {git.remote.name}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>

            {/* ---------------------- Changes ----------------------- */}
            <div className="min-w-0">
              <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-xs">
                <span>
                  {changes.length
                    ? `${changes.length} changed file${changes.length === 1 ? '' : 's'}`
                    : 'Working copy clean'}
                </span>
                {changes.length > 0 && selected.length > 0 && (
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => setSelected([])}
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {changes.length > 0 && (
                <ul className="max-h-56 overflow-auto rounded-md border [&>li]:min-w-max">
                  {changes.map((change) => {
                    const isSelected = selected.includes(change.contextPath);
                    return (
                      <li key={change.contextPath}>
                        {/* Selecting nothing commits everything, so the boxes
                            are a narrowing, not a requirement. The whole list
                            scrolls sideways as one unit (see the <ul>), so long
                            paths stay aligned across rows instead of each row
                            scrolling on its own. */}
                        <label className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm">
                          <input
                            type="checkbox"
                            className="accent-primary size-3.5 shrink-0"
                            checked={isSelected}
                            onChange={() => toggle(change.contextPath)}
                          />
                          <GitBadge status={change.status} className="w-3 shrink-0 text-center" />
                          <span
                            className={cn(
                              'font-mono text-xs whitespace-nowrap',
                              decorationFor(change.status)?.className
                            )}
                            title={change.from ? `${change.from} → ${change.path}` : change.path}
                          >
                            {change.contextPath}
                          </span>
                          {change.staged && (
                            <span className="text-muted-foreground shrink-0 pl-2 text-[10px] uppercase">
                              staged
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* ---------------------- Commit ------------------------ */}
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={message}
                placeholder="Commit message"
                onChange={(event) => setMessage(event.target.value)}
                disabled={!changes.length}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => act('commit', () => contextApi.commit(message, selected))}
                  disabled={Boolean(busy) || !changes.length || !message.trim()}
                >
                  {busy === 'commit' ? <Loader2 className="animate-spin" /> : <GitCommitHorizontal />}
                  {commitLabel}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act('pull', () => contextApi.pull())}
                  disabled={Boolean(busy)}
                  title="git pull --rebase --autostash"
                >
                  {busy === 'pull' ? <Loader2 className="animate-spin" /> : <ArrowDown />}
                  Pull{git.behind > 0 ? ` (${git.behind})` : ''}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act('push', () => contextApi.push())}
                  disabled={Boolean(busy) || !git.remote}
                  title={git.remote ? `git push to ${git.remote.name}` : 'No remote configured'}
                >
                  {busy === 'push' ? <Loader2 className="animate-spin" /> : <Upload />}
                  Push{git.ahead > 0 ? ` (${git.ahead})` : ''}
                </Button>

                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => refreshContext()}
                  title="Re-read the working copy"
                  aria-label="Refresh git status"
                >
                  <RefreshCw />
                </Button>
              </div>
            </div>

            {/* ---------------------- Result ------------------------ */}
            {error && (
              <pre className="text-destructive max-h-32 overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap">
                {error}
              </pre>
            )}
            {!error && output && (
              <pre className="text-muted-foreground max-h-32 overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap">
                {output}
              </pre>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default GitSyncDialog;
