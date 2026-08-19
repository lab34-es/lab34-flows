import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  DownloadCloud,
  FolderTree,
  Loader2,
  OctagonX,
} from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAppState } from '@/context/AppStateContext';
import { settingsApi } from '@/services/api';
import { socket } from '@/services/socket';

// The layout a pull writes depends on what the integration can see: only the
// Xray APIs know the Test Repository.
const LAYOUTS = {
  cloud: {
    label: 'Xray Test Repository',
    detail: 'The folders on disk are the folders of the Test Repository in Xray.',
    example: 'xray/Authentication/Login/BOP-123_login-with-valid-credentials.md',
  },
  server: {
    label: 'Xray Test Repository',
    detail: 'The folders on disk are the folders of the Test Repository in Xray.',
    example: 'xray/Authentication/Login/BOP-123_login-with-valid-credentials.md',
  },
  basic: {
    label: 'Jira hierarchy',
    detail:
      'Without an Xray API key there is no Test Repository to read, so the folders are '
      + 'rebuilt from Jira: the feature and the user story of every test, taken from its '
      + 'parent when it has one and from its related work when it does not.',
    example: 'xray/BOP-10_checkout/BOP-42_pay-with-a-card/BOP-123_pay-with-an-expired-card.md',
  },
};

const PHASE_LABELS = {
  idle: 'Idle',
  starting: 'Starting',
  fields: 'Reading the Jira fields',
  folders: 'Reading the Test Repository',
  downloading: 'Downloading',
  resolving: 'Resolving the hierarchy',
  details: 'Reading the test details',
  writing: 'Writing files',
  done: 'Finished',
  cancelled: 'Stopped',
  error: 'Failed',
};

const COUNTERS = [
  { key: 'created', label: 'created' },
  { key: 'updated', label: 'updated' },
  { key: 'moved', label: 'moved' },
  { key: 'unchanged', label: 'unchanged' },
  { key: 'skipped', label: 'skipped' },
  { key: 'failed', label: 'failed' },
];

/**
 * Everything a pull writes, as one line of text.
 * @param {Object} progress
 * @returns {string}
 */
const summarize = (progress) => COUNTERS
  .filter((counter) => progress[counter.key])
  .map((counter) => `${progress[counter.key]} ${counter.label}`)
  .join(', ');

/**
 * The card that starts a pull, and the modal that follows it.
 *
 * The pull runs on the server: the modal only watches it, so closing it does
 * not stop anything and reopening it picks the progress back up.
 */
export function XrayPull() {
  const { refreshTree } = useAppState();

  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [starting, setStarting] = useState(false);

  // Whether a test already in "xray" is rewritten by the next pull. Saved as
  // soon as it is switched: it is one setting, not a form.
  const [overwrite, setOverwrite] = useState(true);
  const [savingOverwrite, setSavingOverwrite] = useState(false);
  const [overwriteError, setOverwriteError] = useState<any>(null);

  // The tree is refreshed once, when the pull that wrote the files ends
  const finished = useRef(false);
  const logRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    settingsApi.getJira()
      .then((response) => {
        if (cancelled) { return; }
        setSettings(response.data);
        setOverwrite(response.data?.pull?.overwrite !== false);
      })
      .catch(() => { if (!cancelled) { setSettings(null); } })
      .finally(() => { if (!cancelled) { setLoading(false); } });

    return () => { cancelled = true; };
  }, []);

  const apply = useCallback((next) => {
    setProgress(next);

    if (!next || next.running || finished.current) { return; }

    // Whatever the pull wrote is only in the sidebar after this
    finished.current = true;
    refreshTree();
  }, [refreshTree]);

  // The server pushes every step; the poll is the safety net for a socket
  // that dropped while the modal was closed
  useEffect(() => {
    if (!open) { return undefined; }

    const onUpdate = (next) => apply(next);
    socket.on('xraypull:update', onUpdate);

    const poll = setInterval(() => {
      settingsApi.getJiraPull()
        .then((response) => apply(response.data))
        .catch(() => {});
    }, 2000);

    return () => {
      socket.off('xraypull:update', onUpdate);
      clearInterval(poll);
    };
  }, [open, apply]);

  // Keep the newest line of the log in sight
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress]);

  const handlePull = async () => {
    setError(null);
    setProgress(null);
    setStarting(true);
    finished.current = false;
    setOpen(true);

    try {
      const response = await settingsApi.pullJira();
      setProgress(response.data);
    } catch (ex) {
      const message = ex.response?.data?.error || ex.message;

      // A pull already running is not an error worth a red box: show it
      if (/already running/i.test(message)) {
        settingsApi.getJiraPull().then((response) => setProgress(response.data)).catch(() => {});
      } else {
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  };

  const handleOverwrite = async (next) => {
    // The switch moves now and is put back if the save fails: waiting for a
    // round trip to see a toggle move reads as broken
    setOverwrite(next);
    setSavingOverwrite(true);
    setOverwriteError(null);

    try {
      const response = await settingsApi.saveJira({ pull: { overwrite: next } });
      setSettings(response.data);
      setOverwrite(response.data?.pull?.overwrite !== false);
    } catch (ex) {
      setOverwrite(!next);
      setOverwriteError(ex.response?.data?.error || ex.message);
    } finally {
      setSavingOverwrite(false);
    }
  };

  const handleStop = async () => {
    try {
      const response = await settingsApi.cancelJiraPull();
      setProgress(response.data);
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
    }
  };

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  const layout = LAYOUTS[settings?.kind] || LAYOUTS.cloud;
  const ready = Boolean(settings?.configured && settings?.projectKey);
  const running = Boolean(progress?.running);
  const percent = progress?.total
    ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
    : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DownloadCloud className="size-4" /> Pull tests
          </CardTitle>
          <CardDescription>
            Download every Xray test of the project into the <span className="font-mono">xray</span>{' '}
            folder of your flows, one Markdown file per test, with the Jira description and the
            Xray test details as its content. Pulling again updates what Jira owns and keeps the
            steps you wrote.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <FolderTree className="size-3" /> {layout.label}
              </Badge>
              {settings?.projectKey ? (
                <Badge variant="outline" className="font-mono">{settings.projectKey}</Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">{layout.detail}</p>
            <p className="text-muted-foreground font-mono text-xs break-all">{layout.example}</p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="grid gap-1">
              <Label htmlFor="xray-pull-overwrite" className="text-sm font-medium">
                Overwrite tests already pulled
              </Label>
              <p className="text-muted-foreground text-xs">
                {overwrite
                  ? 'A test that is already in the xray folder is rewritten with what Jira says '
                    + 'now: its properties, its description and its test details. The steps you '
                    + 'wrote in the file are kept.'
                  : 'A flow whose xray.testKey is already in the xray folder is left exactly as '
                    + 'it is: only tests that were never pulled are written.'}
              </p>
              {overwriteError && <p className="text-destructive text-xs">{overwriteError}</p>}
            </div>
            <Switch
              id="xray-pull-overwrite"
              checked={overwrite}
              disabled={savingOverwrite || running}
              onCheckedChange={handleOverwrite}
            />
          </div>

          {!settings?.configured && (
            <Alert>
              <AlertCircle />
              <AlertTitle>Not configured yet</AlertTitle>
              <AlertDescription>
                Fill in the Jira / Xray card above before pulling.
              </AlertDescription>
            </Alert>
          )}

          {settings?.configured && !settings?.projectKey && (
            <Alert>
              <AlertCircle />
              <AlertTitle>No project key</AlertTitle>
              <AlertDescription>
                A pull downloads the tests of one Jira project: set the project key above.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Button onClick={handlePull} disabled={!ready || running}>
              {running ? <Loader2 className="animate-spin" /> : <DownloadCloud />}
              {running ? 'Pulling…' : 'Pull from Xray'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {running || starting ? <Loader2 className="size-4 animate-spin" /> : null}
              Pulling tests from Xray
            </DialogTitle>
            <DialogDescription>
              {progress?.projectKey
                ? `Project ${progress.projectKey}, into the "${progress.folder}" folder.`
                : 'Starting…'}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Could not start the pull</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {progress && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">
                    {PHASE_LABELS[progress.phase] || progress.phase}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {progress.processed}
                    {progress.total ? ` / ${progress.total}` : ''} tests
                  </span>
                </div>

                {/* An unknown total still moves, so the modal never looks stuck */}
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={`bg-primary h-full transition-all ${percent === null && running ? 'animate-pulse' : ''}`}
                    style={{ width: percent === null ? (running ? '100%' : '0%') : `${percent}%` }}
                  />
                </div>

                <p className="text-muted-foreground truncate text-xs">{progress.message}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {COUNTERS.map((counter) => (
                  <Badge
                    key={counter.key}
                    variant={counter.key === 'failed' && progress.failed ? 'destructive' : 'outline'}
                    className="tabular-nums"
                  >
                    {progress[counter.key]} {counter.label}
                  </Badge>
                ))}
              </div>

              <div
                ref={logRef}
                className="bg-muted/50 h-48 overflow-y-auto rounded-md border p-2 font-mono text-xs"
              >
                {(progress.log || []).map((line, index) => (
                  <div
                    key={index}
                    className={
                      line.level === 'error'
                        ? 'text-destructive'
                        : line.level === 'warn'
                          ? 'text-amber-600 dark:text-amber-500'
                          : 'text-muted-foreground'
                    }
                  >
                    {line.message}
                  </div>
                ))}
              </div>

              {progress.phase === 'done' && (
                <Alert>
                  <CheckCircle2 />
                  <AlertTitle>Pulled</AlertTitle>
                  <AlertDescription>
                    {summarize(progress) || 'Nothing changed.'}
                  </AlertDescription>
                </Alert>
              )}

              {progress.error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>The pull failed</AlertTitle>
                  <AlertDescription>{progress.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            {running ? (
              <Button variant="outline" onClick={handleStop} disabled={progress?.cancelling}>
                <OctagonX />
                {progress?.cancelling ? 'Stopping…' : 'Stop'}
              </Button>
            ) : null}
            <Button variant={running ? 'ghost' : 'default'} onClick={() => setOpen(false)}>
              {running ? 'Hide' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default XrayPull;
