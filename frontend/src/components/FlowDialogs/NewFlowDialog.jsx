import React, { useState } from 'react';
import {
  Alert,
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
} from '@mui/joy';
import { Add as AddIcon } from '@mui/icons-material';
import { flowsApi } from '../../services/api';

/**
 * Dialog to create a new flow file from a starter template.
 * On success, calls onCreated(flow) with the created flow (including its path).
 */
const NewFlowDialog = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [folder, setFolder] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName('');
    setFolder('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await flowsApi.create({ name, folder });
      reset();
      onCreated(response.data);
    } catch (createError) {
      setError(createError.response?.data?.error || 'Failed to create flow');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog sx={{ minWidth: 400 }}>
        <ModalClose />
        <DialogTitle>New flow</DialogTitle>
        <DialogContent>
          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Name</FormLabel>
            <Input
              autoFocus
              placeholder="e.g. create-order"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && name.trim()) { handleCreate(); }
              }}
            />
            <FormHelperText>Saved as &lt;name&gt;.yaml in your flows directory</FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel>Folder (optional)</FormLabel>
            <Input
              placeholder="e.g. orders or orders/edge-cases"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            />
            <FormHelperText>Sub-folder inside the flows directory, used as category</FormHelperText>
          </FormControl>

          {error && (
            <Alert color="danger" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startDecorator={<AddIcon />}
            onClick={handleCreate}
            loading={creating}
            disabled={!name.trim()}
          >
            Create
          </Button>
          <Button variant="plain" color="neutral" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
};

export default NewFlowDialog;
