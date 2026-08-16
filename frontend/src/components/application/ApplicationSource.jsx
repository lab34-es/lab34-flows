import React, { useCallback, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import { AlertCircle, FileCode2, FileJson2, FileText, Save, Settings2 } from 'lucide-react';

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
  json: 'json',
  js: 'javascript',
  env: 'ini',
};

const FILE_ICONS = {
  md: FileText,
  json: FileJson2,
  js: FileCode2,
  env: Settings2,
};

const extensionOf = (filePath) => (filePath.split('.').pop() || '').toLowerCase();

// Starting content offered when a canonical file does not exist yet
const templateFor = (filePath, slug) => {
  const ext = extensionOf(filePath);

  if (ext === 'json') {
    return JSON.stringify({
      description: 'What this application is',
      methods: {},
    }, null, 2) + '\n';
  }

  if (ext === 'js') {
    return [
      "const { applications } = require('lab34-flows');",
      '',
      'module.exports.myMethod = applications.handler([',
      "  'What this method does',",
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
 * "Source" view of an application: browse and edit its files (README.md,
 * docs.json, index.js and env/*.env) with the same editor used for flows.
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

  const dirtyFor = (filePath) =>
    drafts[filePath] !== undefined && drafts[filePath] !== originals[filePath];

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
      <div className="space-y-3 pt-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const selectedExists = files.find((file) => file.path === selected)?.exists;
  const language = selected ? LANGUAGES[extensionOf(selected)] : 'plaintext';

  return (
    <div className="space-y-3 pt-4">
      {/* File picker + save */}
      <div className="flex flex-wrap items-center gap-2">
        {files.map((file) => {
          const Icon = FILE_ICONS[extensionOf(file.path)] || FileText;
          const isActive = file.path === selected;
          return (
            <Button
              key={file.path}
              variant={isActive ? 'secondary' : 'outline'}
              size="sm"
              className={cn('font-mono text-xs', !file.exists && 'border-dashed')}
              onClick={() => openFile(file, drafts)}
            >
              <Icon className="size-3.5" />
              {file.path}
              {dirtyFor(file.path) && <span className="bg-warning size-1.5 rounded-full" />}
              {!file.exists && <Badge variant="secondary" className="text-[10px]">new</Badge>}
            </Button>
          );
        })}

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
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Editor */}
      <div className="h-[65vh] min-h-[400px] overflow-hidden rounded-lg border">
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

      <p className="text-muted-foreground text-xs">
        Changes to <span className="font-mono">docs.json</span> and <span className="font-mono">README.md</span> update
        the Document view on save; <span className="font-mono">index.js</span> changes are picked up on the next run.
      </p>
    </div>
  );
}

export default ApplicationSource;
