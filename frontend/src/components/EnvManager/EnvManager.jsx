import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Modal,
  ModalDialog,
  ModalClose,
  Stack,
  Alert,
  Chip,
  IconButton,
  Table,
  Sheet,
  Divider,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Code as CodeIcon,
  Storage as SettingsIcon,
} from '@mui/icons-material';
import { applicationsApi } from '../../services/api';
import MonacoEditor from '../MonacoEditor/MonacoEditor';

const EnvManager = ({ applicationSlug }) => {
  const [application, setApplication] = useState(null);
  const [envFiles, setEnvFiles] = useState([]);
  const [selectedEnv, setSelectedEnv] = useState(null);
  const [envContent, setEnvContent] = useState([]);
  const [rawContent, setRawContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [showRawEditor, setShowRawEditor] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState(new Set());
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (applicationSlug) {
      loadApplication();
    }
  }, [applicationSlug]);

  useEffect(() => {
    if (selectedEnv && envFiles.length > 0) {
      loadEnvFile();
    }
  }, [selectedEnv, envFiles]);

  const loadApplication = async () => {
    try {
      setLoading(true);
      const response = await applicationsApi.get(applicationSlug);
      setApplication(response.data);
      setEnvFiles(response.data.envFiles || []);
      
      // Select first env file by default
      if (response.data.envFiles && response.data.envFiles.length > 0) {
        setSelectedEnv(response.data.envFiles[0].name);
      }
    } catch (error) {
      console.error('Error loading application:', error);
      setError('Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const loadEnvFile = async () => {
    if (!selectedEnv) return;

    try {
      const response = await applicationsApi.getEnv(applicationSlug, selectedEnv);
      setEnvContent(response.data.contents || []);
    } catch (error) {
      console.error('Error loading env file:', error);
      setError('Failed to load environment file');
    }
  };

  const loadRawContent = async () => {
    if (!selectedEnv) return;

    try {
      const response = await fetch(`/applications/${applicationSlug}/envs/${selectedEnv}/raw`);
      const data = await response.json();
      setRawContent(data.content || '');
    } catch (error) {
      console.error('Error loading raw content:', error);
      setError('Failed to load raw content');
    }
  };

  const updateEnvVariable = async (key, value) => {
    try {
      setSaving(true);
      await fetch(`/applications/${applicationSlug}/envs/${selectedEnv}/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      });
      
      setSuccess(`Updated ${key} successfully`);
      await loadEnvFile(); // Reload to get updated content
    } catch (error) {
      console.error('Error updating env variable:', error);
      setError('Failed to update environment variable');
    } finally {
      setSaving(false);
    }
  };

  const updateRawContent = async () => {
    try {
      setSaving(true);
      await fetch(`/applications/${applicationSlug}/envs/${selectedEnv}/raw`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: rawContent }),
      });
      
      setSuccess('Environment file updated successfully');
      setShowRawEditor(false);
      await loadEnvFile(); // Reload to get updated content
    } catch (error) {
      console.error('Error updating env file:', error);
      setError('Failed to update environment file');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (key, value) => {
    setEditingKey(key);
    setEditingValue(value);
  };

  const handleSave = async () => {
    if (editingKey) {
      await updateEnvVariable(editingKey, editingValue);
      setEditingKey(null);
      setEditingValue('');
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditingValue('');
  };

  const toggleSecretVisibility = (key) => {
    const newVisible = new Set(visibleSecrets);
    if (newVisible.has(key)) {
      newVisible.delete(key);
    } else {
      newVisible.add(key);
    }
    setVisibleSecrets(newVisible);
  };

  const formatValue = (item) => {
    if (item.isSecret && !visibleSecrets.has(item.key)) {
      return '••••••••';
    }
    return item.value;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading environment configuration...</Typography>
      </Box>
    );
  }

  if (!application) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="warning">Application not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Typography level="h2" startDecorator={<SettingsIcon />}>
            Environment Variables
          </Typography>
          <Typography level="body-md" color="neutral">
            Manage environment variables for {application.name}
          </Typography>
        </Box>

        {error && (
          <Alert color="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert color="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {envFiles.length === 0 ? (
          <Alert color="neutral">
            No environment files found for this application.
          </Alert>
        ) : (
          <Tabs value={selectedEnv} onChange={(event, newValue) => setSelectedEnv(newValue)}>
            <TabList>
              {envFiles.map((envFile) => (
                <Tab key={envFile.name} value={envFile.name}>
                  {envFile.name}.env
                  <Chip size="sm" variant="soft" sx={{ ml: 1 }}>
                    {envFile.contents?.length || 0}
                  </Chip>
                </Tab>
              ))}
            </TabList>

            {envFiles.map((envFile) => (
              <TabPanel key={envFile.name} value={envFile.name} sx={{ px: 0 }}>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography level="title-md">
                      Variables in {envFile.name}.env
                    </Typography>
                    <Button
                      variant="outlined"
                      size="sm"
                      startDecorator={<CodeIcon />}
                      onClick={() => {
                        setShowRawEditor(true);
                        loadRawContent();
                      }}
                    >
                      Raw Editor
                    </Button>
                  </Box>

                  {envContent.length === 0 ? (
                    <Alert color="neutral">
                      No environment variables found in this file.
                    </Alert>
                  ) : (
                    <Table>
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>Key</th>
                          <th style={{ width: '50%' }}>Value</th>
                          <th style={{ width: '20%' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {envContent.map((item, index) => (
                          <tr key={index}>
                            <td>
                              <Typography level="body-sm" fontFamily="monospace">
                                {item.key}
                                {item.isSecret && (
                                  <Chip size="sm" color="warning" variant="soft" sx={{ ml: 1 }}>
                                    Secret
                                  </Chip>
                                )}
                              </Typography>
                            </td>
                            <td>
                              {editingKey === item.key ? (
                                <Input
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  size="sm"
                                  sx={{ fontFamily: 'monospace' }}
                                />
                              ) : (
                                <Typography level="body-sm" fontFamily="monospace">
                                  {formatValue(item)}
                                </Typography>
                              )}
                            </td>
                            <td>
                              <Stack direction="row" spacing={1}>
                                {editingKey === item.key ? (
                                  <>
                                    <IconButton
                                      size="sm"
                                      color="success"
                                      onClick={handleSave}
                                      loading={saving}
                                    >
                                      <SaveIcon />
                                    </IconButton>
                                    <IconButton
                                      size="sm"
                                      color="neutral"
                                      onClick={handleCancel}
                                    >
                                      <CancelIcon />
                                    </IconButton>
                                  </>
                                ) : (
                                  <>
                                    <IconButton
                                      size="sm"
                                      color="primary"
                                      onClick={() => handleEdit(item.key, item.value)}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                    {item.isSecret && (
                                      <IconButton
                                        size="sm"
                                        color="neutral"
                                        onClick={() => toggleSecretVisibility(item.key)}
                                      >
                                        {visibleSecrets.has(item.key) ? (
                                          <VisibilityOffIcon />
                                        ) : (
                                          <VisibilityIcon />
                                        )}
                                      </IconButton>
                                    )}
                                  </>
                                )}
                              </Stack>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Stack>
              </TabPanel>
            ))}
          </Tabs>
        )}

        {/* Raw Editor Modal */}
        <Modal open={showRawEditor} onClose={() => setShowRawEditor(false)}>
          <ModalDialog sx={{ minWidth: 600, maxWidth: '90vw' }}>
            <ModalClose />
            <Typography level="h4" sx={{ mb: 2 }}>
              Raw Editor - {selectedEnv}.env
            </Typography>
            
            <Stack spacing={2}>
              <FormControl>
                <FormLabel>File Content</FormLabel>
                <MonacoEditor
                  value={rawContent}
                  onChange={setRawContent}
                  language="env"
                  height="400px"
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                  }}
                />
              </FormControl>

              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowRawEditor(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={updateRawContent}
                  loading={saving}
                  startDecorator={<SaveIcon />}
                >
                  Save Changes
                </Button>
              </Box>
            </Stack>
          </ModalDialog>
        </Modal>
      </Stack>
    </Box>
  );
};

export default EnvManager;
