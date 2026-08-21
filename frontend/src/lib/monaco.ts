// Bundle monaco-editor with the app instead of letting @monaco-editor/react
// fetch it from a CDN: the tool must work fully offline.
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json') { return new jsonWorker(); }
    if (label === 'css' || label === 'scss' || label === 'less') { return new cssWorker(); }
    if (label === 'html' || label === 'handlebars' || label === 'razor') { return new htmlWorker(); }
    if (label === 'typescript' || label === 'javascript') { return new tsWorker(); }
    return new editorWorker();
  },
};

/* The editor painted with the brand palette: ink on white panels in light,
   bone on carbon in dark, warm token colours in both. */
monaco.editor.defineTheme('lab34-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '201f1d' },
    { token: 'comment', foreground: '9b9797', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7d5411' },
    { token: 'string', foreground: '3e7a4e' },
    { token: 'number', foreground: '8a5a2a' },
    { token: 'type', foreground: '3a6ea5' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#201f1d',
    'editorLineNumber.foreground': '#9b9797',
    'editorCursor.foreground': '#201f1d',
    'editor.selectionBackground': '#b6823548',
    'focusBorder': '#b68235',
  },
});

monaco.editor.defineTheme('lab34-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'f3f2f2' },
    { token: 'comment', foreground: '8f8b8a', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c99a55' },
    { token: 'string', foreground: '7cbe8d' },
    { token: 'number', foreground: 'd0a06a' },
    { token: 'type', foreground: '7fa9d6' },
  ],
  colors: {
    'editor.background': '#2d2b2b',
    'editor.foreground': '#f3f2f2',
    'editorLineNumber.foreground': '#8f8b8a',
    'editorCursor.foreground': '#f3f2f2',
    'editor.selectionBackground': '#b6823555',
    'focusBorder': '#c99a55',
  },
});

export const MONACO_FONT_FAMILY = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

loader.config({ monaco });
