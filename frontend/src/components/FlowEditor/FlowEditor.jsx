import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Modal,
  ModalDialog,
  ModalClose,
  Stack,
  Alert,
  FormControl,
  FormLabel,
  Input,
  Divider,
  Chip,
  IconButton,
} from '@mui/joy';
import {
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { flowsApi } from '../../services/api';
import MonacoEditor from '../MonacoEditor/MonacoEditor';

const FlowEditor = ({ flow, open, onClose, onSave }) => {
  const [flowContent, setFlowContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (open && flow) {
      loadFlowContent();
    }
  }, [open, flow]);

  useEffect(() => {
    setHasChanges(flowContent !== originalContent);
  }, [flowContent, originalContent]);

  const loadFlowContent = async () => {
    if (!flow?.path) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await flowsApi.getFlow(flow.path);
      const content = response.data.plainText || '';
      
      setFlowContent(content);
      setOriginalContent(content);
    } catch (error) {
      console.error('Error loading flow content:', error);
      setError('Failed to load flow content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Here you would implement the save functionality
      // For now, we'll just simulate a save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setOriginalContent(flowContent);
      setSuccess('Flow saved successfully');
      
      if (onSave) {
        onSave(flowContent);
      }
    } catch (error) {
      console.error('Error saving flow:', error);
      setError('Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    try {
      setError(null);
      
      const response = await flowsApi.start({
        value: flowContent,
        environment: 'default' // You might want to make this configurable
      });
      
      setSuccess(`Flow execution started: ${response.data.execution || 'Running'}`);
    } catch (error) {
      console.error('Error running flow:', error);
      setError('Failed to start flow execution');
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const getLanguageFromPath = (path) => {
    if (!path) return 'yaml';
    const ext = path.split('.').pop()?.toLowerCase();
    return ext === 'yml' || ext === 'yaml' ? 'yaml' : 'text';
  };

  if (!flow) return null;

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog sx={{ minWidth: '80vw', maxWidth: '95vw', minHeight: '80vh', maxHeight: '95vh' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography level="h4" startDecorator={<CodeIcon />}>
              Edit Flow
            </Typography>
            <Typography level="body-sm" color="neutral">
              {flow.name || flow.title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {hasChanges && (
              <Chip size="sm" color="warning" variant="soft">
                Unsaved changes
              </Chip>
            )}
            <IconButton size="sm" onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert color="danger" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert color="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Stack spacing={2} sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <FormLabel>Flow Definition</FormLabel>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="sm"
                variant="outlined"
                startDecorator={<PlayIcon />}
                onClick={handleRun}
                disabled={!flowContent.trim()}
              >
                Run Flow
              </Button>
              <Button
                size="sm"
                startDecorator={<SaveIcon />}
                onClick={handleSave}
                loading={saving}
                disabled={!hasChanges}
              >
                Save Changes
              </Button>
            </Box>
          </Box>

          <Box sx={{ flex: 1, minHeight: '500px' }}>
            {loading ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '500px',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 'sm',
                }}
              >
                Loading flow content...
              </Box>
            ) : (
              <MonacoEditor
                value={flowContent}
                onChange={setFlowContent}
                language={getLanguageFromPath(flow.path)}
                height="500px"
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  folding: true,
                  bracketMatching: 'always',
                  autoIndent: 'full',
                  formatOnPaste: true,
                  formatOnType: true,
                }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography level="body-xs" color="neutral">
              {flow.relativePath || flow.path}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={handleClose}
              >
                Close
              </Button>
            </Box>
          </Box>
        </Stack>
      </ModalDialog>
    </Modal>
  );
};

export default FlowEditor;
