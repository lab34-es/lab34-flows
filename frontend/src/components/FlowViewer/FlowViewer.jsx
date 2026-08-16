import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Sheet,
  Chip,
  Link,
  Alert,
  CircularProgress,
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  Option,
  FormControl,
  FormLabel,
  Snackbar,
  Tabs,
  TabList,
  Tab,
} from '@mui/joy';
import { useColorScheme } from '@mui/joy/styles';
import {
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  AccountTree as FlowIcon,
  ArrowBack as BackIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import MonacoEditor from '../MonacoEditor/MonacoEditor';
import ExecutionView from '../ExecutionView/ExecutionView';
import { flowsApi } from '../../services/api';
import { getSocket, FLOW_EXECUTION_EVENT } from '../../services/socket';
import { useEnvironment, getEnvironmentType } from '../../context/environment';
import * as YAML from 'yaml';

const FlowViewer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flowPath = searchParams.get('file');
  const { mode } = useColorScheme();
  const { environments, environment, setEnvironment } = useEnvironment();

  const [flow, setFlow] = useState(null);
  const [flowContent, setFlowContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  // Execution state (fed by socket events)
  const [activeTab, setActiveTab] = useState('steps');
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runEnvironment, setRunEnvironment] = useState('');
  const [execution, setExecution] = useState(null);
  const [execSteps, setExecSteps] = useState([]);
  const [runError, setRunError] = useState(null);
  const executingRef = useRef(false);

  const isDirty = flowContent !== savedContent;
  const isRunning = execution?.status === 'running';

  // Parse YAML content in real-time to update the steps preview
  const parsedFlow = useMemo(() => {
    if (!flowContent.trim()) {
      return { ...flow, steps: [], parseError: null };
    }

    try {
      const parsed = YAML.parse(flowContent);
      return {
        ...flow,
        ...parsed,
        steps: parsed?.steps || [],
        parseError: null
      };
    } catch (parseError) {
      return {
        ...flow,
        steps: flow?.steps || [],
        parseError: parseError.message
      };
    }
  }, [flowContent, flow]);

  useEffect(() => {
    if (flowPath) {
      fetchFlowContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowPath]);

  // Live execution updates. The backend runs one execution at a time and
  // emits "flowexecution:update" events with topics: execution, diagram, step.
  useEffect(() => {
    const socket = getSocket();

    const handler = (event) => {
      // Only track events once a run was started from this view
      if (!event || !event.topic || !executingRef.current) { return; }

      if (event.topic === 'execution') {
        setExecution(event.data);
      }

      if (event.topic === 'diagram') {
        if (event.data?.steps) { setExecSteps(event.data.steps); }
        if (event.data?.execution) { setExecution(event.data.execution); }
      }

      if (event.topic === 'step' && event.data?.id) {
        setExecSteps(prev => {
          const next = [...prev];
          const index = next.findIndex(s => s.id === event.data.id);
          if (index >= 0) {
            next[index] = event.data.data;
          } else {
            next.push(event.data.data);
          }
          return next;
        });
      }
    };

    socket.on(FLOW_EXECUTION_EVENT, handler);
    return () => { socket.off(FLOW_EXECUTION_EVENT, handler); };
  }, []);

  const fetchFlowContent = async () => {
    if (!flowPath) { return; }

    setLoading(true);
    setError(null);
    try {
      const decodedFlowPath = decodeURIComponent(flowPath);
      const response = await flowsApi.getUserFlow(decodedFlowPath);
      const flowData = response.data;

      setFlow(flowData);
      setFlowContent(flowData?.plainText || '');
      setSavedContent(flowData?.plainText || '');
    } catch (fetchError) {
      console.error('Error fetching flow content:', fetchError);
      setError('Failed to load flow content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!flow?.path) { return; }

    setSaving(true);
    try {
      await flowsApi.save(flow.path, flowContent);
      setSavedContent(flowContent);
      setSnackbar({ color: 'success', message: 'Flow saved' });
    } catch (saveError) {
      setSnackbar({
        color: 'danger',
        message: saveError.response?.data?.error || 'Failed to save flow'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenRunDialog = () => {
    setRunEnvironment(environment || '');
    setRunDialogOpen(true);
  };

  const handleRun = async () => {
    setRunDialogOpen(false);

    if (runEnvironment && runEnvironment !== environment) {
      setEnvironment(runEnvironment);
    }

    // Reset the previous execution and switch to the execution tab
    setExecution({ status: 'running' });
    setExecSteps([]);
    setRunError(null);
    setActiveTab('execution');
    executingRef.current = true;

    try {
      const response = await flowsApi.start({
        value: flowContent,
        environment: runEnvironment
      });
      // The socket usually delivers fresher data before this arrives;
      // only set it if nothing came through yet.
      setExecution(prev => (prev && prev.id) ? prev : response.data.execution);
    } catch (startError) {
      executingRef.current = false;
      setExecution(null);
      setRunError(startError.response?.data?.error || startError.message);
    }
  };

  const handleBack = () => {
    navigate('/flows');
  };

  const renderFlowVisualization = () => {
    if (parsedFlow?.parseError) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert color="danger" startDecorator={<WarningIcon />}>
            <Box>
              <Typography level="title-sm" sx={{ mb: 1 }}>
                YAML Parsing Error
              </Typography>
              <Typography level="body-sm">
                {parsedFlow.parseError}
              </Typography>
            </Box>
          </Alert>
        </Box>
      );
    }

    if (!parsedFlow?.steps || parsedFlow.steps.length === 0) {
      return (
        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <FlowIcon sx={{ fontSize: 48, color: 'text.tertiary', mb: 2 }} />
            <Typography level="title-md" sx={{ mb: 1 }}>
              No steps defined
            </Typography>
            <Typography level="body-sm" color="neutral">
              This flow doesn't have any steps defined yet.
            </Typography>
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 1 }}>
        <Sheet
          variant="outlined"
          sx={{
            borderRadius: 'md',
            overflow: 'hidden',
            bgcolor: 'background.surface'
          }}
        >
          {parsedFlow.steps.map((step, index) => (
            <Box key={index}>
              <Box sx={{
                p: 3,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 3,
                borderBottom: index < parsedFlow.steps.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'background.level1'
                }
              }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: 'primary.500',
                  color: 'primary.contrastText',
                  fontSize: 'sm',
                  fontWeight: 'md',
                  flexShrink: 0
                }}>
                  {index + 1}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography level="title-sm" sx={{ mb: 1 }}>
                    {step.application ? (
                      <Link
                        component="button"
                        onClick={() => {
                          const appSlug = encodeURIComponent(step.application);
                          window.open(`#/applications/${appSlug}`, '_blank');
                        }}
                        sx={{
                          textDecoration: 'none',
                          color: 'primary.500',
                          cursor: 'pointer',
                          fontWeight: 'md',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {step.application}
                      </Link>
                    ) : (
                      'Unknown Application'
                    )}
                  </Typography>

                  <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                    <strong>Method:</strong> {step.method ? (
                      <Link
                        component="button"
                        onClick={() => {
                          const appSlug = encodeURIComponent(step.application);
                          const methodName = encodeURIComponent(step.method);
                          window.open(`#/applications/${appSlug}?method=${methodName}`, '_blank');
                        }}
                        sx={{
                          textDecoration: 'none',
                          color: 'primary.500',
                          cursor: 'pointer',
                          ml: 1,
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {step.method}
                      </Link>
                    ) : (
                      ' N/A'
                    )}
                  </Typography>

                  {step.description && (
                    <Typography level="body-sm" color="neutral" sx={{ mb: 1 }}>
                      <strong>Description:</strong> {step.description}
                    </Typography>
                  )}

                  {step.parameters && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>
                        <strong>Parameters:</strong>
                      </Typography>
                      <Sheet
                        variant="soft"
                        sx={{
                          p: 1.5,
                          borderRadius: 'sm',
                          bgcolor: 'background.level2',
                          border: '1px solid',
                          borderColor: 'neutral.outlinedBorder'
                        }}
                      >
                        <Box
                          component="pre"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: 'xs',
                            lineHeight: 1.5,
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: 'text.primary'
                          }}
                        >
                          {typeof step.parameters === 'object'
                            ? JSON.stringify(step.parameters, null, 2)
                            : step.parameters
                          }
                        </Box>
                      </Sheet>
                    </Box>
                  )}

                  {step.test && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography level="body-xs" color="neutral" sx={{ mb: 0.5 }}>
                        <strong>Test:</strong>
                      </Typography>
                      <Sheet
                        variant="soft"
                        sx={{
                          p: 1.5,
                          borderRadius: 'sm',
                          bgcolor: 'warning.softBg',
                          borderLeft: '3px solid',
                          borderColor: 'warning.500',
                          border: '1px solid',
                          borderLeftColor: 'warning.500'
                        }}
                      >
                        <Box
                          component="pre"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: 'xs',
                            lineHeight: 1.5,
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: 'text.primary'
                          }}
                        >
                          {typeof step.test === 'object'
                            ? JSON.stringify(step.test, null, 2)
                            : step.test
                          }
                        </Box>
                      </Sheet>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Sheet>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !flow) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color={error ? 'danger' : 'warning'} sx={{ mb: 3 }}>
          {error || 'Flow not found'}
        </Alert>
        <Button startDecorator={<BackIcon />} onClick={handleBack}>
          Back to Flows
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography level="h3">
              {parsedFlow?.title || parsedFlow?.name || flow?.name || flow?.title || 'Flow Editor'}
            </Typography>
            {isDirty && (
              <Chip size="sm" color="warning" variant="soft">unsaved changes</Chip>
            )}
          </Box>
          <Typography level="body-xs" color="neutral" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {flow.path}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            startDecorator={<BackIcon />}
            variant="outlined"
            color="neutral"
            onClick={handleBack}
          >
            Back
          </Button>
          <Button
            startDecorator={<SaveIcon />}
            variant="outlined"
            onClick={handleSave}
            loading={saving}
            disabled={!isDirty}
          >
            Save
          </Button>
          <Button
            startDecorator={<PlayIcon />}
            color="success"
            onClick={handleOpenRunDialog}
            disabled={Boolean(parsedFlow?.parseError) || isRunning}
            loading={isRunning}
          >
            Run flow
          </Button>
        </Box>
      </Box>

      {/* Editor + right panel */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, gap: 2 }}>
        <Sheet variant="outlined" sx={{ flex: 1, minWidth: 0, borderRadius: 'md', overflow: 'hidden' }}>
          <MonacoEditor
            value={flowContent}
            onChange={setFlowContent}
            language="yaml"
            height="100%"
            theme={mode === 'light' ? 'light' : 'vs-dark'}
            sx={{ height: '100%' }}
          />
        </Sheet>

        <Sheet variant="outlined" sx={{ flex: 1, minWidth: 0, borderRadius: 'md', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(event, value) => setActiveTab(value)}
            sx={{ bgcolor: 'transparent' }}
          >
            <TabList>
              <Tab value="steps">Steps</Tab>
              <Tab value="execution">
                Execution
                {execution && (
                  <Chip
                    size="sm"
                    variant="soft"
                    color={
                      execution.status === 'passed' ? 'success' :
                        execution.status === 'running' ? 'primary' : 'danger'
                    }
                    sx={{ ml: 1 }}
                  >
                    {execution.status}
                  </Chip>
                )}
              </Tab>
            </TabList>
          </Tabs>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {activeTab === 'steps'
              ? renderFlowVisualization()
              : <ExecutionView execution={execution} steps={execSteps} requestError={runError} />}
          </Box>
        </Sheet>
      </Box>

      {/* Run dialog */}
      <Modal open={runDialogOpen} onClose={() => setRunDialogOpen(false)}>
        <ModalDialog sx={{ minWidth: 360 }}>
          <ModalClose />
          <DialogTitle>Run flow</DialogTitle>
          <DialogContent>
            <Typography level="body-sm" sx={{ mb: 2 }}>
              The flow will run with the environment variables of the selected
              environment. Unsaved editor content is executed as-is.
            </Typography>
            <FormControl>
              <FormLabel>Environment</FormLabel>
              <Select
                value={runEnvironment || null}
                onChange={(event, value) => setRunEnvironment(value || '')}
                placeholder="Select environment"
              >
                {environments.map((env) => {
                  const envType = getEnvironmentType(env);
                  return (
                    <Option key={env} value={env}>
                      <Chip size="sm" color={envType.color} variant="soft">{envType.type}</Chip>
                      {env}
                    </Option>
                  );
                })}
              </Select>
            </FormControl>
            {environments.length === 0 && (
              <Alert color="warning" sx={{ mt: 2 }}>
                No environments found. Add .env files to your applications first.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              color="success"
              startDecorator={<PlayIcon />}
              onClick={handleRun}
              disabled={!runEnvironment}
            >
              Run
            </Button>
            <Button variant="plain" color="neutral" onClick={() => setRunDialogOpen(false)}>
              Cancel
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Save feedback */}
      <Snackbar
        open={Boolean(snackbar)}
        color={snackbar?.color}
        variant="soft"
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar?.message}
      </Snackbar>
    </Box>
  );
};

export default FlowViewer;
