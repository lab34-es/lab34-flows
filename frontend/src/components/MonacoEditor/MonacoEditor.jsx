import React, { useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Box } from '@mui/joy';

const MonacoEditor = ({
  value,
  onChange,
  language = 'text',
  height = '400px',
  theme = 'vs-dark',
  options = {},
  readOnly = false,
  ...props
}) => {
  const editorRef = useRef(null);

  const defaultOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineNumbers: 'on',
    roundedSelection: false,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
    },
    automaticLayout: true,
    wordWrap: 'on',
    readOnly,
    ...options,
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Configure environment variables language for .env files
    if (language === 'env') {
      monaco.languages.register({ id: 'env' });
      monaco.languages.setMonarchTokensProvider('env', {
        tokenizer: {
          root: [
            [/^#.*$/, 'comment'],
            [/^[A-Z_][A-Z0-9_]*(?==)/, 'key'],
            [/=/, 'delimiter'],
            [/.*$/, 'value'],
          ],
        },
      });
      
      monaco.editor.defineTheme('env-theme', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6A9955' },
          { token: 'key', foreground: '9CDCFE' },
          { token: 'delimiter', foreground: 'D4D4D4' },
          { token: 'value', foreground: 'CE9178' },
        ],
        colors: {
          'editor.background': '#1E1E1E',
        },
      });
      
      monaco.editor.setTheme('env-theme');
    }

    // Configure JSON language for flows
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [],
        enableSchemaRequest: false,
      });
    }

    // Configure YAML language for flows
    if (language === 'yaml') {
      // Basic YAML support is built-in
    }
  };

  const handleEditorChange = (newValue) => {
    if (onChange) {
      onChange(newValue || '');
    }
  };

  return (
    <Box
      sx={{
        overflow: 'hidden',
        '& .monaco-editor': {
          '& .margin': {
            backgroundColor: 'transparent',
          },
        },
      }}
      {...props}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        theme={theme}
        options={defaultOptions}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        loading={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: height,
              backgroundColor: 'background.surface',
            }}
          >
            Loading editor...
          </Box>
        }
      />
    </Box>
  );
};

export default MonacoEditor;
