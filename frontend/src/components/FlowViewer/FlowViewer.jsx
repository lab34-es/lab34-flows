import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Sheet,
  Divider,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator,
  Breadcrumbs,
  Link,
  Alert,
  CircularProgress,
} from '@mui/joy';
import {
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  AccountTree as FlowIcon,
  Code as CodeIcon,
  ArrowBack as BackIcon,
  Home as HomeIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import MonacoEditor from '../MonacoEditor/MonacoEditor';
import { flowsApi } from '../../services/api';
import * as YAML from 'yaml';

const FlowViewer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flowPath = searchParams.get('file');
  
  const [flow, setFlow] = useState(null);
  const [flowContent, setFlowContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Parse YAML content in real-time to update steps
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
    } catch (error) {
      return {
        ...flow,
        steps: flow?.steps || [],
        parseError: error.message
      };
    }
  }, [flowContent, flow]);

  useEffect(() => {
    if (flowPath) {
      fetchFlowContent();
    }
  }, [flowPath]);

  const fetchFlowContent = async () => {
    if (!flowPath) return;
    
    setLoading(true);
    setError(null);
    try {
      // Decode the flow path since it was encoded when navigating
      const decodedFlowPath = decodeURIComponent(flowPath);
      console.log('Fetching flow content for path:', decodedFlowPath);
      
      const response = await flowsApi.getUserFlow(decodedFlowPath);
      const flowData = response.data;
      console.log('Flow data received:', flowData);
      
      setFlow(flowData);
      setFlowContent(flowData?.plainText || '');
    } catch (error) {
      console.error('Error fetching flow content:', error);
      setError('Failed to load flow content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // TODO: Implement save functionality
    console.log('Saving flow content:', flowContent);
    // You could add a success message here
  };

  const handleRun = async () => {
    // TODO: Implement run functionality
    console.log('Running flow:', flow);
    alert(`Flow execution started: ${flow?.name || flow?.title}`);
  };

  const handleBack = () => {
    navigate('/flows');
  };

  const renderFlowVisualization = () => {
    // Show YAML parsing error if present
    if (parsedFlow?.parseError) {
      return (
        <Box sx={{ height: '100%', p: 2 }}>
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
      <Box sx={{ height: '100%', overflow: 'auto', p: 1 }}>
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

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button startDecorator={<BackIcon />} onClick={handleBack}>
          Back to Flows
        </Button>
      </Box>
    );
  }

  if (!flow) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="warning" sx={{ mb: 3 }}>
          Flow not found
        </Alert>
        <Button startDecorator={<BackIcon />} onClick={handleBack}>
          Back to Flows
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh',
      position: 'fixed',
      top: 0,
      left: '240px', // Account for sidebar width
      right: 0,
      bottom: 0,
      zIndex: 999
    }}>
      {/* Left Panel - Monaco Editor */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <MonacoEditor
          value={flowContent}
          onChange={setFlowContent}
          language="yaml"
          height="100vh"
        />
      </Box>

      <Divider orientation="vertical" />

      {/* Right Panel - Header, Buttons, and Flow Steps */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <Box sx={{ p: 3, pb: 2 }}>
          <Typography level="h1" sx={{ mb: 2 }}>
            {parsedFlow?.title || parsedFlow?.name || flow?.name || flow?.title || 'Flow Editor'}
          </Typography>

          {flow.relativePath && (
            <Typography level="body-md" sx={{ mb: 3, color: 'text.secondary' }}>
              {flow.relativePath}
            </Typography>
          )}

          {/* Buttons */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              startDecorator={<SaveIcon />}
              variant="outlined"
              onClick={handleSave}
              disabled={loading}
            >
              Save
            </Button>
            <Button
              startDecorator={<PlayIcon />}
              onClick={handleRun}
              disabled={loading}
            >
              Run Flow
            </Button>
            <Button
              startDecorator={<BackIcon />}
              variant="outlined"
              onClick={handleBack}
            >
              Back to Flows
            </Button>
          </Box>
        </Box>

        <Divider />

        {/* Flow Steps */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          {renderFlowVisualization()}
        </Box>
      </Box>
    </Box>
  );
};

export default FlowViewer;
