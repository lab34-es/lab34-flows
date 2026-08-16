import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { AlertCircle, ChevronDown, FileCode2, FileText, Folder, Save, Settings2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { applicationsApi } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

const LANGUAGES = {
  md: 'markdown',
  markdown: 'markdown',
  js: 'javascript',
  env: 'ini',
};

const FILE_ICONS = {
  md: FileText,
  js: FileCode2,
  env: Settings2,
};

const extensionOf = (filePath) => (filePath.split('.').pop() || '').toLowerCase();

const baseNameOf = (filePath) => filePath.split('/').pop();

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

/**
 * Split the flat file list into root-level files and one entry per folder
 * (currently only env/), so the explorer can render a small tree.
 */
const groupFiles = (files) => {
  const roots = [];
  const folders = new Map();

  for (const file of files) {
    const slash = file.path.indexOf('/');
    if (slash === -1) {
      roots.push(file);
      continue;
    }
    const folder = file.path.slice(0, slash);
    if (!folders.has(folder)) { folders.set(folder, []); }
    folders.get(folder).push(file);
  }

  return { roots, folders: [...folders.entries()] };
};

/** One row in the explorer tree. */
function FileRow({ file, label, depth, isActive, isDirty, onSelect }) {
  const Icon = FILE_ICONS[extensionOf(file.path)] || FileText;

  return (
    <button
      type="button"
      onClick={() => onSelect(file)}
      title={file.path}
      className={cn(
        'flex w-full items-center gap-1.5 py-1 pr-2 text-left font-mono text-xs',
        'hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground font-medium',
        !file.exists && 'text-muted-foreground italic'
      )}
      style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
    >
      <Icon className="size-3.5 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
      {isDirty && <span className="bg-warning size-1.5 shrink-0 rounded-full" />}
      {!file.exists && (
        <Badge variant="secondary" className="ml-auto shrink-0 px-1 py-0 text-[9px]">new</Badge>
      )}
    </button>
  );
}

/**
 * "Source" view of an application: a VS Code-like explorer listing its files
 * (README.md, index.js and env/*.env) next to the Monaco editor used for
 * flows.
 */
export function ApplicationSource({ slug, onSaved }) {
  const { theme } = useTheme();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [originals, setOriginals] = useState({});
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  const { roots, folders } = useMemo(() => groupFiles(files), [files]);

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
      {/* Explorer */}
      {/* The application sidebar already uses --sidebar, so keep this one on
          muted to avoid the two panels blending into one another. */}
      <aside className="bg-muted/40 flex w-56 shrink-0 flex-col border-r">
        <div className="text-muted-foreground shrink-0 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide">
          Explorer
        </div>
        <div className="min-h-0 flex-1 overflow-auto pb-2">
          {roots.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              label={file.path}
              depth={0}
              isActive={file.path === selected}
              isDirty={dirtyFor(file.path)}
              onSelect={(target) => openFile(target, drafts)}
            />
          ))}

          {folders.map(([folder, folderFiles]) => (
            <div key={folder}>
              <div className="text-muted-foreground flex items-center gap-1 px-2 py-1 font-mono text-xs">
                <ChevronDown className="size-3.5 shrink-0" />
                <Folder className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">{folder}</span>
              </div>
              {folderFiles.map((file) => (
                <FileRow
                  key={file.path}
                  file={file}
                  label={baseNameOf(file.path)}
                  depth={1.5}
                  isActive={file.path === selected}
                  isDirty={dirtyFor(file.path)}
                  onSelect={(target) => openFile(target, drafts)}
                />
              ))}
            </div>
          ))}
        </div>
      </aside>

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
    </div>
  );
}

export default ApplicationSource;
