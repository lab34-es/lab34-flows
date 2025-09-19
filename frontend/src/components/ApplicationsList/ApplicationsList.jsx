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
  Apps as AppsIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
  FilterAlt as FilterIcon,
  Clear as ClearIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { applicationsApi } from '../../services/api';

const ApplicationsList = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filter states
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await applicationsApi.list();
      const data = response.data;
      // Ensure we always have an array
      setApplications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      setError('Failed to load applications. Please check your API connection.');
      setApplications([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleOpenApplication = (app) => {
    // Navigate to the application-specific page
    console.log('Opening application:', app);
    const appSlug = app.slug || app.id || app.name;
    navigate(`/applications/${encodeURIComponent(appSlug)}`);
  };

  // Filter applications based on search text only
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch = !searchText || 
        (app.name && app.name.toLowerCase().includes(searchText.toLowerCase())) ||
        (app.id && app.id.toLowerCase().includes(searchText.toLowerCase())) ||
        (app.description && app.description.toLowerCase().includes(searchText.toLowerCase()));
      
      return matchesSearch;
    });
  }, [applications, searchText]);

  const handleResetFilters = () => {
    setSearchText('');
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
        <Typography level="h1">Applications</Typography>
        <Button
          startDecorator={<RefreshIcon />}
          variant="outlined"
          onClick={fetchApplications}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert color="danger" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {applications.length === 0 ? (
        <Sheet variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 'md' }}>
          <AppsIcon sx={{ fontSize: 48, color: 'text.tertiary', mb: 2 }} />
          <Typography level="title-md" sx={{ mb: 1 }}>
            No applications found
          </Typography>
          <Typography level="body-sm" color="neutral">
            Configure your first application or check your applications directory.
          </Typography>
        </Sheet>
      ) : (
        <>
          {/* Filter Toolbar */}
          <Sheet variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 'md' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'end', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 200, flex: 1 }}>
                <FormLabel>Search applications</FormLabel>
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
              Showing {filteredApplications.length} of {applications.length} applications
            </Typography>
          </Sheet>

          {/* Applications Table */}
          <Sheet variant="outlined" sx={{ borderRadius: 'md', overflow: 'hidden' }}>
            <Table stickyHeader hoverRow>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Name</th>
                  <th style={{ width: '45%' }}>Description</th>
                  <th style={{ width: '10%' }}>Methods</th>
                  <th style={{ width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((app, index) => (
                  <tr key={`${app.id || app.name}-${index}`}>
                    <td>
                      <Typography level="title-sm">
                        {app.name || app.id || `Application ${index + 1}`}
                      </Typography>
                      {app.version && (
                        <Typography level="body-xs" color="neutral">
                          v{app.version}
                        </Typography>
                      )}
                    </td>
                    <td>
                      <Typography level="body-sm" color="neutral">
                        {app.description || 'No description available'}
                      </Typography>
                    </td>
                    <td>
                      {app.methods && (
                        <Chip size="sm" variant="soft" color="primary">
                          {app.methods.length}
                        </Chip>
                      )}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="solid"
                        startDecorator={<OpenIcon />}
                        onClick={() => handleOpenApplication(app)}
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

export default ApplicationsList;
