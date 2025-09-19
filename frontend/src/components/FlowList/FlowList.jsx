import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Table,
  Sheet,
  Input,
  Select,
  Option,
  FormControl,
  FormLabel,
  IconButton,
} from '@mui/joy';
import {
  Description as FileIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterAlt as FilterIcon,
  Clear as ClearIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { flowsApi } from '../../services/api';

const FlowList = () => {
  const navigate = useNavigate();
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await flowsApi.list();
      setFlows(response.data || []);
    } catch (error) {
      console.error('Error fetching flows:', error);
      setError('Failed to load flows. Please check your API connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFlow = (flow) => {
    // Navigate to the flow viewer page with the flow path as a query parameter
    console.log('Opening flow:', flow);
    console.log('Flow path:', flow.path);
    const flowPath = encodeURIComponent(flow.path);
    console.log('Encoded flow path:', flowPath);
    navigate(`/flows/user?file=${flowPath}`);
  };

  // Get unique categories for the dropdown
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(flows.map(flow => flow.category || 'root'))];
    return uniqueCategories.sort((a, b) => {
      if (a === 'root') return -1;
      if (b === 'root') return 1;
      return a.localeCompare(b);
    });
  }, [flows]);

  // Filter flows based on search text and selected category
  const filteredFlows = useMemo(() => {
    return flows.filter(flow => {
      const matchesSearch = !searchText || 
        (flow.name && flow.name.toLowerCase().includes(searchText.toLowerCase())) ||
        (flow.title && flow.title.toLowerCase().includes(searchText.toLowerCase())) ||
        (flow.description && flow.description.toLowerCase().includes(searchText.toLowerCase())) ||
        (flow.relativePath && flow.relativePath.toLowerCase().includes(searchText.toLowerCase()));
      
      const matchesCategory = !selectedCategory || 
        (flow.category || 'root') === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [flows, searchText, selectedCategory]);

  const handleResetFilters = () => {
    setSearchText('');
    setSelectedCategory('');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography level="h1">Flow Definitions</Typography>
        <Button
          startDecorator={<RefreshIcon />}
          variant="outlined"
          onClick={fetchFlows}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {flows.length === 0 ? (
        <Sheet variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 'md' }}>
          <FileIcon sx={{ fontSize: 48, color: 'text.tertiary', mb: 2 }} />
          <Typography level="title-md" sx={{ mb: 1 }}>
            No flows found
          </Typography>
          <Typography level="body-sm" color="neutral">
            Create your first flow definition or check your flows directory.
          </Typography>
        </Sheet>
      ) : (
        <>
          {/* Filter Toolbar */}
          <Sheet variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 'md' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'end', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200, flex: 1 }}>
                <FormLabel>Search flows</FormLabel>
                <Input
                  placeholder="Search by name, description, or path..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  startDecorator={<SearchIcon />}
                />
              </FormControl>
              
              <FormControl sx={{ minWidth: 150 }}>
                <FormLabel>Category</FormLabel>
                <Select
                  placeholder="All categories"
                  value={selectedCategory}
                  onChange={(e, value) => setSelectedCategory(value || '')}
                  startDecorator={<FilterIcon />}
                >
                  {categories.map((category) => (
                    <Option key={category} value={category}>
                      {category === 'root' ? 'Root' : category.replace(/\//g, ' / ')}
                    </Option>
                  ))}
                </Select>
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
              Showing {filteredFlows.length} of {flows.length} flows
            </Typography>
          </Sheet>

          {/* Flows Table */}
          <Sheet variant="outlined" sx={{ borderRadius: 'md', overflow: 'hidden' }}>
            <Table stickyHeader hoverRow>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Name</th>
                  <th style={{ width: '40%' }}>Description</th>
                  <th style={{ width: '15%' }}>Category</th>
                  <th style={{ width: '10%' }}>Steps</th>
                  <th style={{ width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlows.map((flow, index) => (
                  <tr key={`${flow.category}-${index}`}>
                    <td>
                      <Typography level="title-sm">
                        {flow.name || flow.title || flow.path || `Flow ${index + 1}`}
                      </Typography>
                      <Typography level="body-xs" color="neutral">
                        {flow.relativePath}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-sm" color="neutral">
                        {flow.description || 'No description available'}
                      </Typography>
                    </td>
                    <td>
                      <Chip size="sm" variant="soft" color="neutral">
                        {(flow.category || 'root') === 'root' ? 'Root' : (flow.category || 'root').replace(/\//g, ' / ')}
                      </Chip>
                    </td>
                    <td>
                      {flow.steps && (
                        <Chip size="sm" variant="soft" color="primary">
                          {flow.steps.length}
                        </Chip>
                      )}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="solid"
                        startDecorator={<OpenIcon />}
                        onClick={() => handleOpenFlow(flow)}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Sheet>
        </>
      )}

    </Box>
  );
};

export default FlowList;
