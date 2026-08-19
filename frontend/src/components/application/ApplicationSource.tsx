import React, { useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { AlertCircle, Save } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SourceExplorer from '@/components/application/SourceExplorer';
import SourceFileDialogs from '@/components/application/SourceFileDialogs';
import { applicationsApi } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';

const LANGUAGES = {
  md: 'markdown',
  markdown: 'markdown',
  js: 'javascript',
  json: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  env: 'ini',
};

const extensionOf = (filePath) => (filePath.split('.').pop() || '').toLowerCase();

// Starting content offered when a canonical file does not exist yet
const templateFor = (filePath, slug) => {
  const ext = extensionOf(filePath);

  if (ext === 'js') {
    return [
      '/**',
      ` * ${slug} — what this application is.`,
      ' */',
      "const { applications } = require('lab34-flows');",
      '',
      '/**',
      ' * What this method does.',
      ' *',
      ' * @param {string} body.example - What this parameter is for.',
      ' * @returns {200} What comes back.',
      ' * ```json',
      ' * { "ok": true }',
      ' * ```',
      ' * @memory {write} lastValue - What this method writes to the flow memory.',
      ' * @example',
      ` * application: ${slug}`,
      ' * method: myMethod',
      ' * parameters:',
      ' *   body:',
      ' *     example: "hello"',
      ' */',
      'module.exports.myMethod = applications.handler([',
      '  async (ctx, parameters) => {',
      '    return [{}, 200, { ok: true }, {}];',
      '  }',
      "], 'myMethod');",
      '',
    ].join('\n');
  }

  return `# ${slug}\n\nDescribe this application.\n`;
};

/** New path of `filePath` once `from` has been renamed to `to`. */
const renamedPath = (filePath, from, to) => {
  if (filePath === from) { return to; }
  if (filePath.startsWith(`${from}/`)) { return `${to}${filePath.slice(from.length)}`; }
  return filePath;
};

/** Same, over the keys of the drafts/originals maps. */
const renameKeys = (map, from, to) => Object.fromEntries(
  Object.entries(map).map(([key, value]) => [renamedPath(key, from, to), value])
);

/** Drop every entry of a drafts/originals map under a deleted path. */
const dropKeys = (map, target) => Object.fromEntries(
  Object.entries(map).filter(([key]) => key !== target && !key.startsWith(`${target}/`))
);

/**
 * "Source" view of an application: a VS Code-like explorer listing its files
 * — where they can be created, renamed and deleted — next to the Monaco
 * editor used for flows.
 */
export function ApplicationSource({ slug, onSaved }) {
  const { theme } = useTheme();

  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [originals, setOriginals] = useState<any>({});
  const [drafts, setDrafts] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<any>(null);
  const [action, setAction] = useState<any>(null);

  const refreshFiles = useCallback(async () => {
    const response = await applicationsApi.listFiles(slug);
    const list = response.data || [];
    setFiles(list);
    return list;
  }, [slug]);

  const openFile = useCallback(async (file, currentDrafts) => {
    setSelected(file.path);
    setError(null);

    if (currentDrafts && currentDrafts[file.path] !== undefined) { return; }

    try {
      const response = await applicationsApi.getFile(slug, file.path);
      const content = response.data.exists
        ? response.data.content
        : templateFor(file.path, slug);
      setOriginals((prev) => ({ ...prev, [file.path]: response.data.exists ? content : null }));
      setDrafts((prev) => ({ ...prev, [file.path]: content }));
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
    }
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFiles([]);
    setSelected(null);
    setOriginals({});
    setDrafts({});
    setError(null);
    setAction(null);

    applicationsApi.listFiles(slug)
      .then((response) => {
        if (cancelled) { return; }
        const list = response.data || [];
        setFiles(list);
        const first = list.find((file) => file.exists) || list[0];
        if (first) { openFile(first, {}); }
      })
      .catch((ex) => !cancelled && setError(ex.response?.data?.error || ex.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [slug, openFile]);

  const dirtyFor = useCallback((filePath) =>
    drafts[filePath] !== undefined && drafts[filePath] !== originals[filePath],
  [drafts, originals]);

  const handleSave = async () => {
    if (!selected) { return; }
    setSaving(true);
    setError(null);
    try {
      await applicationsApi.saveFile(slug, selected, drafts[selected] ?? '');
      setOriginals((prev) => ({ ...prev, [selected]: drafts[selected] ?? '' }));
      setFiles((prev) => prev.map((file) =>
        file.path === selected ? { ...file, exists: true } : file
      ));
      onSaved?.();
    } catch (ex) {
      setError(ex.response?.data?.error || ex.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Run one explorer action and bring the local state in line with it. The
   * dialog reports the error, so failures are rethrown as they are.
   */
  const handleAction = async (currentAction, value) => {
    setError(null);

    if (currentAction.type === 'new-file') {
      await applicationsApi.createFile(slug, value, '');
      await refreshFiles();
      setOriginals((prev) => ({ ...prev, [value]: '' }));
      setDrafts((prev) => ({ ...prev, [value]: '' }));
      setSelected(value);
      onSaved?.();
      return;
    }

    if (currentAction.type === 'rename') {
      const from = currentAction.targetPath;
      const response = await applicationsApi.renameFile(slug, from, value);
      const to = response.data.path || value;
      await refreshFiles();
      setDrafts((prev) => renameKeys(prev, from, to));
      setOriginals((prev) => renameKeys(prev, from, to));
      setSelected((current) => (current ? renamedPath(current, from, to) : current));
      onSaved?.();
      return;
    }

    if (currentAction.type === 'delete') {
      const target = currentAction.targetPath;
      await applicationsApi.deleteFile(slug, target);
      const list = await refreshFiles();
      setDrafts((prev) => dropKeys(prev, target));
      setOriginals((prev) => dropKeys(prev, target));
      setSelected((current) => {
        const stillThere = current && current !== target && !current.startsWith(`${target}/`);
        if (stillThere) { return current; }
        return (list.find((file) => file.exists) || list[0])?.path || null;
      });
      onSaved?.();
    }
  };

  // Opening the file a delete or rename left selected, when its content is
  // not in the drafts yet
  useEffect(() => {
    if (!selected || drafts[selected] !== undefined) { return; }
    const file = files.find((item) => item.path === selected);
    if (file) { openFile(file, drafts); }
  }, [selected, files, drafts, openFile]);

  if (loading) {
    return (
      <div className="flex h-full min-h-0">
        <div className="w-56 shrink-0 space-y-2 border-r p-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
        <div className="flex-1 p-3">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  const selectedExists = files.find((file) => file.path === selected)?.exists;
  const language = selected ? LANGUAGES[extensionOf(selected)] : 'plaintext';

  return (
    <div className="flex h-full min-h-0">
      <SourceExplorer
        files={files}
        selected={selected}
        isDirty={dirtyFor}
        onSelect={(file) => openFile(file, drafts)}
        onAction={setAction}
      />

      {/* Editor pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <span className="text-muted-foreground truncate font-mono text-xs">
            {selected || 'No file selected'}
          </span>
          {selected && dirtyFor(selected) && (
            <span className="bg-warning size-1.5 shrink-0 rounded-full" title="Unsaved changes" />
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !selected || (!dirtyFor(selected) && selectedExists)}
          >
            <Save /> {saving ? 'Saving…' : selectedExists ? 'Save' : 'Create file'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="m-3 w-auto">
            <AlertCircle />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="min-h-0 flex-1">
          {selected && drafts[selected] !== undefined ? (
            <Editor
              height="100%"
              path={`${slug}/${selected}`}
              language={language}
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              value={drafts[selected]}
              onChange={(value) => setDrafts((prev) => ({ ...prev, [selected]: value ?? '' }))}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Select a file to edit
            </div>
          )}
        </div>

        <p className="text-muted-foreground shrink-0 border-t px-3 py-2 text-xs">
          The JSDoc blocks of <span className="font-mono">index.js</span> and{' '}
          <span className="font-mono">README.md</span> update the Document view on save;
          code changes are picked up on the next run.
        </p>
      </div>

      <SourceFileDialogs
        action={action}
        onSubmit={handleAction}
        onClose={() => setAction(null)}
      />
    </div>
  );
}

export default ApplicationSource;
