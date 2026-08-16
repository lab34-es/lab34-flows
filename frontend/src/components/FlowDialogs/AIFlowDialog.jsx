import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  Textarea,
  Typography,
} from '@mui/joy';
import {
  AutoAwesome as AIIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import MonacoEditor from '../MonacoEditor/MonacoEditor';
import { flowsApi } from '../../services/api';

/**
 * Dialog to generate a flow from a natural-language prompt using the
 * configured AI provider, preview the YAML, and save it as a flow file.
 */
const AIFlowDialog = ({ open, onClose, onCreated }) => {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState('');
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setPrompt('');
    setGenerated('');
    setName('');
    setFolder('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await flowsApi.createWithAI({ prompt });
      setGenerated(response.data?.flow || '');
    } catch (generateError) {
      setError(generateError.response?.data?.error || 'Failed to generate flow');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await flowsApi.create({ name, folder, content: generated });
      reset();
      onCreated(response.data);
    } catch (saveError) {
      setError(saveError.response?.data?.error || 'Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog sx={{ width: '80vw', maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }}>
        <ModalClose />
        <DialogTitle>Generate flow with AI</DialogTitle>
        <DialogContent>
          <FormControl sx={{ mb: 1 }}>
            <FormLabel>Describe the scenario to test</FormLabel>
            <Textarea
              autoFocus
              minRows={3}
              placeholder='e.g. "Create an order for a random customer and verify the invoice endpoint returns it"'
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <FormHelperText>
              The AI knows your applications and their methods, and replies with a runnable flow.
            </FormHelperText>
          </FormControl>

          <Button
            startDecorator={<AIIcon />}
            onClick={handleGenerate}
            loading={generating}
            disabled={!prompt.trim()}
            sx={{ mb: 2, alignSelf: 'flex-start' }}
          >
            {generated ? 'Regenerate' : 'Generate'}
          </Button>

          {generating && (
            <Typography level="body-sm" color="neutral" sx={{ mb: 2 }}>
              Talking to the AI provider... this can take up to a minute.
            </Typography>
          )}

          {generated && (
            <>
              <Typography level="title-sm" sx={{ mb: 1 }}>
                Generated flow (editable)
              </Typography>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'sm', overflow: 'hidden', mb: 2 }}>
                <MonacoEditor
                  value={generated}
                  onChange={setGenerated}
                  language="yaml"
                  height="300px"
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl sx={{ flex: 1, minWidth: 180 }}>
                  <FormLabel>Save as</FormLabel>
                  <Input
                    placeholder="flow name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </FormControl>
                <FormControl sx={{ flex: 1, minWidth: 180 }}>
                  <FormLabel>Folder (optional)</FormLabel>
                  <Input
                    placeholder="e.g. ai-generated"
                    value={folder}
                    onChange={(event) => setFolder(event.target.value)}
                  />
                </FormControl>
              </Box>
            </>
          )}

          {error && (
            <Alert color="danger" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          {generated && (
            <Button
              startDecorator={<SaveIcon />}
              onClick={handleSave}
              loading={saving}
              disabled={!name.trim() || !generated.trim()}
            >
              Save flow
            </Button>
          )}
          <Button variant="plain" color="neutral" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
};

export default AIFlowDialog;
