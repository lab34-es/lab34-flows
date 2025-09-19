import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Sheet,
  Chip,
  Alert,
  CircularProgress,
  Modal,
  ModalDialog,
  ModalClose,
  Table,
  Input,
  FormControl,
  FormLabel,
  IconButton,
  ToggleButtonGroup,
} from '@mui/joy';
import {
  ArrowBack as BackIcon,
  Storage as EnvIcon,
  Code as CodeIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ViewList as ChipsIcon,
  Code as YamlIcon,
} from '@mui/icons-material';
import { applicationsApi } from '../../services/api';
import EnvManager from '../EnvManager/EnvManager';
import MonacoEditor from '../MonacoEditor/MonacoEditor';

const ApplicationViewer = () => {
  const { appSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  
  // Filter states for methods table
  const [searchText, setSearchText] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [viewMode, setViewMode] = useState(new Map()); // 'chips' or 'yaml' per method

  useEffect(() => {
    if (appSlug) {
      fetchApplication();
    }
  }, [appSlug]);

  const fetchApplication = async () => {
    if (!appSlug) return;
    
    setLoading(true);
    setError(null);
    try {
      const decodedSlug = decodeURIComponent(appSlug);
      console.log('Fetching application for slug:', decodedSlug);
      
      const response = await applicationsApi.get(decodedSlug);
      const appData = response.data;
      console.log('Application data received:', appData);
      
      setApplication(appData);
    } catch (error) {
      console.error('Error fetching application:', error);
      setError('Failed to load application details');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/applications');
  };

  const handleOpenEnvManager = () => {
    setEnvModalOpen(true);
  };

  const handleCloseEnvManager = () => {
    setEnvModalOpen(false);
  };

  // Helper functions for methods table
  const handleToggleRow = (index) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(index)) {
      newExpandedRows.delete(index);
    } else {
      newExpandedRows.add(index);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleResetFilters = () => {
    setSearchText('');
  };

  // Filter methods based on search text
  const filteredMethods = useMemo(() => {
    if (!application?.methods) return [];
    
    return application.methods.filter(method => {
      const matchesSearch = !searchText || 
        (method.name && method.name.toLowerCase().includes(searchText.toLowerCase())) ||
        (method.description && method.description.toLowerCase().includes(searchText.toLowerCase()));
      
      return matchesSearch;
    });
  }, [application?.methods, searchText]);

  // Effect to handle method query parameter and auto-expand the corresponding row
  useEffect(() => {
    const methodName = searchParams.get('method');
    if (methodName && application?.methods && filteredMethods.length > 0) {
      const decodedMethodName = decodeURIComponent(methodName);
      const filteredMethodIndex = filteredMethods.findIndex(method => method.name === decodedMethodName);
      
      if (filteredMethodIndex !== -1) {
        setExpandedRows(prev => new Set([...prev, filteredMethodIndex]));
        
        // Scroll to the method row after a short delay to ensure the table is rendered
        setTimeout(() => {
          const methodRow = document.querySelector(`[data-method-index="${filteredMethodIndex}"]`);
          if (methodRow) {
            methodRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [searchParams, application, filteredMethods]);

  // Helper function to generate YAML representation with comments
  const generateYAML = (parameters, fallbacks = null, level = 0) => {
    if (!parameters || typeof parameters !== 'object') return '';

    const indent = '  '.repeat(level);
    let yaml = '';

    if (parameters.type === 'object' && parameters.properties) {
      Object.entries(parameters.properties).forEach(([key, value]) => {
        const comments = [];
        
        // Add type comment
        if (value.type) {
          comments.push(`type: ${value.type}`);
        }
        
        // Add required comment
        if (parameters.required?.includes(key)) {
          comments.push('required');
        }
        
        // Add fallback comments
        if (fallbacks && fallbacks[key]) {
          const fallbackDetails = fallbacks[key].map(fb => 
            fb.type === 'static' ? `static: ${fb.value}` : fb.type
          ).join(', ');
          comments.push(`fallbacks: ${fallbackDetails}`);
        }
        
        const commentStr = comments.length > 0 ? ` # ${comments.join(', ')}` : '';
        
        if (value.type === 'object' && value.properties) {
          yaml += `${indent}${key}:${commentStr}\n`;
          yaml += generateYAML(value, fallbacks, level + 1);
        } else {
          // Show appropriate placeholder values based on type
          let placeholderValue = '"value"';
          if (value.type === 'number' || value.type === 'integer') {
            placeholderValue = '123';
          } else if (value.type === 'boolean') {
            placeholderValue = 'true';
          } else if (value.type === 'array') {
            placeholderValue = '[]';
          }
          
          yaml += `${indent}${key}: ${placeholderValue}${commentStr}\n`;
        }
      });
    }

    return yaml;
  };

  // State for tracking collapsed parameters per method
  const [collapsedParams, setCollapsedParams] = useState(new Map());

  // Helper function to toggle parameter collapse state
  const toggleParameterCollapse = (methodIndex, paramPath) => {
    const key = `${methodIndex}-${paramPath}`;
    const newCollapsedParams = new Map(collapsedParams);
    const currentlyCollapsed = isParameterCollapsed(methodIndex, paramPath);
    
    if (currentlyCollapsed) {
      // If collapsed, expand it (set to false)
      newCollapsedParams.set(key, false);
    } else {
      // If expanded, collapse it (set to true or remove from map)
      newCollapsedParams.set(key, true);
    }
    setCollapsedParams(newCollapsedParams);
  };

  // Helper function to check if parameter is collapsed
  const isParameterCollapsed = (methodIndex, paramPath) => {
    const key = `${methodIndex}-${paramPath}`;
    // Default to collapsed (true) if not in the map
    return !collapsedParams.has(key) || collapsedParams.get(key);
  };

  // Helper function to render parameter structure with collapsible functionality
  const renderParameterStructure = (parameters, level = 0, fallbacks = null, methodIndex = 0, parentPath = '') => {
    if (!parameters || typeof parameters !== 'object') return null;

    const baseIndent = 16;
    const indent = level * baseIndent;
    
    if (parameters.type === 'object' && parameters.properties) {
      return (
        <Box sx={{ position: 'relative' }}>
          {Object.entries(parameters.properties).map(([key, value], index) => {
            const currentPath = parentPath ? `${parentPath}.${key}` : key;
            const isCollapsed = isParameterCollapsed(methodIndex, currentPath);
            const hasNestedObject = value.type === 'object' && value.properties;
            const isLastItem = index === Object.entries(parameters.properties).length - 1;

            return (
              <Box key={key} sx={{ position: 'relative' }}>
                {/* Connecting lines */}
                {level > 0 && (
                  <>
                    {/* Vertical line from parent */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: indent - baseIndent + 8,
                        top: 0,
                        bottom: isLastItem ? '50%' : '100%',
                        width: '2px',
                        backgroundColor: 'neutral.500',
                        opacity: 0.8,
                      }}
                    />
                    {/* Horizontal line to current item */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: indent - baseIndent + 8,
                        top: '50%',
                        width: baseIndent - 8,
                        height: '2px',
                        backgroundColor: 'neutral.500',
                        opacity: 0.8,
                        transform: 'translateY(-50%)',
                      }}
                    />
                  </>
                )}

                <Box sx={{ 
                  ml: `${indent}px`, 
                  mb: 1,
                  position: 'relative',
                  zIndex: 1,
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, 
                    flexWrap: 'wrap',
                    py: 0.5,
                    px: 1,
                    borderRadius: 'sm',
                    '&:hover': {
                      backgroundColor: 'background.level2',
                    },
                  }}>
                    {/* Collapse/Expand button for objects */}
                    {hasNestedObject ? (
                      <IconButton
                        size="sm"
                        variant="plain"
                        onClick={() => toggleParameterCollapse(methodIndex, currentPath)}
                        sx={{ 
                          minWidth: '20px', 
                          minHeight: '20px',
                          mr: 0.5,
                          '& svg': { fontSize: '16px' }
                        }}
                      >
                        {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                      </IconButton>
                    ) : (
                      <Box sx={{ width: '28px' }} /> // Spacer for alignment
                    )}
                    
                    {/* Property name - clickable if it has nested objects */}
                    <Typography 
                      level="body-sm" 
                      sx={{ 
                        fontWeight: 'bold',
                        cursor: hasNestedObject ? 'pointer' : 'default',
                        '&:hover': hasNestedObject ? { color: 'primary.500' } : {},
                      }}
                      onClick={hasNestedObject ? () => toggleParameterCollapse(methodIndex, currentPath) : undefined}
                    >
                      {key}
                    </Typography>
                    
                    {/* Type chip */}
                    <Chip size="sm" color="neutral" variant="outlined">
                      {value.type || 'unknown'}
                    </Chip>
                    
                    {/* Required chip */}
                    {parameters.required?.includes(key) && (
                      <Chip size="sm" color="danger" variant="soft">
                        required
                      </Chip>
                    )}
                    
                    {/* Description if available */}
                    {value.description && (
                      <Typography level="body-xs" color="neutral" sx={{ fontStyle: 'italic' }}>
                        {value.description}
                      </Typography>
                    )}
                    
                    {/* Fallback chips */}
                    {fallbacks && fallbacks[key] && (
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Typography level="body-xs" color="neutral">
                          fallbacks:
                        </Typography>
                        {fallbacks[key].map((fallback, index) => (
                          <Chip 
                            key={index} 
                            size="sm" 
                            color="success" 
                            variant="soft"
                            sx={{ fontSize: '0.75rem' }}
                          >
                            {fallback.type === 'static' ? `static: ${fallback.value}` : fallback.type}
                          </Chip>
                        ))}
                      </Box>
                    )}
                  </Box>
                  
                  {/* Nested parameters - only show if not collapsed */}
                  {hasNestedObject && !isCollapsed && (
                    <Box sx={{ mt: 1 }}>
                      {renderParameterStructure(value, level + 1, fallbacks, methodIndex, currentPath)}
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      );
    }
    
    return null;
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
          Back to Applications
        </Button>
      </Box>
    );
  }

  if (!application) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="warning" sx={{ mb: 3 }}>
          Application not found
        </Alert>
        <Button startDecorator={<BackIcon />} onClick={handleBack}>
          Back to Applications
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header - matching other pages */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography level="h1">
          {application.name || application.id || 'Application'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {application.envFiles && application.envFiles.length > 0 && (
            <Button
              startDecorator={<EnvIcon />}
              variant="outlined"
              onClick={handleOpenEnvManager}
            >
              Manage Environment
            </Button>
          )}
          <Button
            startDecorator={<BackIcon />}
            variant="outlined"
            onClick={handleBack}
          >
            Back to Applications
          </Button>
        </Box>
      </Box>

      {/* Methods Table */}
      {application.methods && application.methods.length > 0 ? (
        <>
          <Typography level="body-md" sx={{ mb: 3, color: 'text.secondary' }}>
            {application.methods.length} method{application.methods.length !== 1 ? 's' : ''} available
          </Typography>

          {/* Filter Toolbar */}
          <Sheet variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 'md' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'end', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200, flex: 1 }}>
                <FormLabel>Search methods</FormLabel>
                <Input
                  placeholder="Search by name or description..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  startDecorator={<SearchIcon />}
                />
              </FormControl>
              
              <IconButton
                variant="outlined"
                color="neutral"
                onClick={handleResetFilters}
                sx={{ alignSelf: 'end' }}
              >
                <ClearIcon />
              </IconButton>
            </Box>
            
            <Typography level="body-sm" color="neutral" sx={{ mt: 2 }}>
              Showing {filteredMethods.length} of {application.methods.length} methods
            </Typography>
          </Sheet>

          {/* Methods Table */}
          <Sheet variant="outlined" sx={{ borderRadius: 'md', overflow: 'hidden' }}>
            <Table stickyHeader hoverRow>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th style={{ width: '30%' }}>Method Name</th>
                  <th style={{ width: '50%' }}>Description</th>
                  <th style={{ width: '20%' }}>Parameters</th>
                </tr>
              </thead>
              <tbody>
                {filteredMethods.map((method, index) => (
                  <React.Fragment key={index}>
                    <tr data-method-index={index}>
                      <td>
                        <IconButton
                          size="sm"
                          variant="plain"
                          onClick={() => handleToggleRow(index)}
                        >
                          {expandedRows.has(index) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </td>
                      <td>
                        <Typography level="title-sm">
                          {method.name || `Method ${index + 1}`}
                        </Typography>
                      </td>
                      <td>
                        <Typography level="body-sm" color="neutral">
                          {method.description || 'No description available'}
                        </Typography>
                      </td>
                      <td>
                        {method.parameters?.body?.properties && (
                          <Chip size="sm" variant="soft" color="primary">
                            {Object.keys(method.parameters.body.properties).length} params
                          </Chip>
                        )}
                      </td>
                    </tr>
                    {expandedRows.has(index) && method.parameters?.body && (
                      <tr>
                        <td colSpan={4} style={{ padding: 0 }}>
                          <Box sx={{ p: 3, backgroundColor: 'background.level1' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                              <Typography level="title-sm">
                                Parameters Structure
                              </Typography>
                              <ToggleButtonGroup
                                size="sm"
                                value={viewMode.get(index) || 'chips'}
                                onChange={(event, newValue) => {
                                  if (newValue !== null) {
                                    const newViewMode = new Map(viewMode);
                                    newViewMode.set(index, newValue);
                                    setViewMode(newViewMode);
                                  }
                                }}
                              >
                                <Button value="chips" startDecorator={<ChipsIcon />}>
                                  Chips
                                </Button>
                                <Button value="yaml" startDecorator={<YamlIcon />}>
                                  YAML
                                </Button>
                              </ToggleButtonGroup>
                            </Box>
                            
                            {viewMode.get(index) === 'yaml' ? (
                              <MonacoEditor
                                value={generateYAML(method.parameters.body, method.parameters.body.fallbacks)}
                                language="yaml"
                                height="300px"
                                readOnly={true}
                                options={{
                                  minimap: { enabled: false },
                                  scrollBeyondLastLine: false,
                                  fontSize: 12,
                                  lineNumbers: 'on',
                                  folding: true,
                                  wordWrap: 'on',
                                  automaticLayout: true,
                                }}
                              />
                            ) : (
                              renderParameterStructure(method.parameters.body, 0, method.parameters.body.fallbacks, index)
                            )}
                          </Box>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </Table>
          </Sheet>
        </>
      ) : (
        <Sheet variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 'md' }}>
          <CodeIcon sx={{ fontSize: 48, color: 'text.tertiary', mb: 2 }} />
          <Typography level="title-md" sx={{ mb: 1 }}>
            No methods found
          </Typography>
          <Typography level="body-sm" color="neutral">
            This application doesn't have any methods defined.
          </Typography>
        </Sheet>
      )}

      {/* Environment Manager Modal */}
      <Modal 
        open={envModalOpen} 
        onClose={handleCloseEnvManager}
      >
        <ModalDialog sx={{ minWidth: '80vw', maxWidth: '90vw', maxHeight: '90vh' }}>
          <ModalClose />
          <EnvManager applicationSlug={application.slug || application.id || application.name} />
        </ModalDialog>
      </Modal>
    </Box>
  );
};

export default ApplicationViewer;
