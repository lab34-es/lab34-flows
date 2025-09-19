import React, { useState, useEffect } from 'react';
import {
  Box,
  Select,
  Option,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/joy';
import { Settings as EnvironmentIcon } from '@mui/icons-material';
import { environmentApi } from '../../services/api';

const EnvironmentSelector = ({ sidebarOpen }) => {
  const [environments, setEnvironments] = useState([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to determine environment type and color
  const getEnvironmentType = (envName) => {
    const name = envName.toLowerCase();
    
    // Local environments
    if (['local', 'localhost'].some(keyword => 
        name.includes(keyword))) {
      return { type: 'local', color: 'primary' };
    }
    
    // Development environments
    if (['dev', 'dv', 'development'].some(keyword => 
        name.includes(keyword))) {
      return { type: 'development', color: 'success' };
    }
    
    // Staging environments
    if (['st', 'stage', 'staging'].some(keyword => 
        name.includes(keyword))) {
      return { type: 'staging', color: 'warning' };
    }
    
    // UAT environments
    if (['ac', 'uat', 'ut'].some(keyword => 
        name.includes(keyword))) {
      return { type: 'uat', color: 'warning' };
    }
    
    // Production environments
    if (['pr', 'production', 'prod'].some(keyword => 
        name.includes(keyword))) {
      return { type: 'production', color: 'danger' };
    }
    
    // Default/unknown
    return { type: 'unknown', color: 'neutral' };
  };

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        setLoading(true);
        const response = await environmentApi.getAllPossible();
        setEnvironments(response.data);
        
        // Set first environment as default if available
        if (response.data.length > 0) {
          setSelectedEnvironment(response.data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch environments:', err);
        setError('Failed to load environments');
      } finally {
        setLoading(false);
      }
    };

    fetchEnvironments();
  }, []);

  const handleEnvironmentChange = (event, newValue) => {
    setSelectedEnvironment(newValue);
    // You can add logic here to handle environment changes globally
    console.log('Environment changed to:', newValue);
  };

  if (!sidebarOpen) {
    return (
      <Box
        sx={{
          p: 1,
          display: 'flex',
          justifyContent: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <EnvironmentIcon sx={{ color: 'text.secondary' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        borderTop: '1px solid',
        borderColor: 'divider',
        mt: 'auto',
      }}
    >
      <Typography level="body-sm" sx={{ mb: 1, color: 'text.secondary' }}>
        Environment
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size="sm" />
          <Typography level="body-sm">Loading...</Typography>
        </Box>
      ) : error ? (
        <Alert color="warning" size="sm">
          {error}
        </Alert>
      ) : environments.length === 0 ? (
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          No environments found
        </Typography>
      ) : (
        <Box>
          <Select
            value={selectedEnvironment}
            onChange={handleEnvironmentChange}
            size="sm"
            placeholder="Select environment"
            sx={{ width: '100%' }}
            renderValue={(option) => {
              if (!option) return null;
              const envType = getEnvironmentType(option.value);
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: envType.color === 'primary' ? 'primary.500' :
                              envType.color === 'success' ? 'success.500' :
                              envType.color === 'warning' ? 'warning.500' :
                              envType.color === 'danger' ? 'danger.500' : 'neutral.500'
                    }}
                  />
                  <Typography level="body-sm">{option.value}</Typography>
                </Box>
              );
            }}
          >
            {environments.map((env) => {
              const envType = getEnvironmentType(env);
              return (
                <Option key={env} value={env}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: envType.color === 'primary' ? 'primary.500' :
                                envType.color === 'success' ? 'success.500' :
                                envType.color === 'warning' ? 'warning.500' :
                                envType.color === 'danger' ? 'danger.500' : 'neutral.500'
                      }}
                    />
                    <Typography level="body-sm">{env}</Typography>
                    <Chip
                      size="sm"
                      color={envType.color}
                      variant="soft"
                      sx={{ ml: 'auto', fontSize: '10px', minHeight: '16px' }}
                    >
                      {envType.type.toUpperCase()}
                    </Chip>
                  </Box>
                </Option>
              );
            })}
          </Select>
          
          {/* Show current environment info */}
          {selectedEnvironment && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="sm"
                color={getEnvironmentType(selectedEnvironment).color}
                variant="soft"
                sx={{ fontSize: '10px' }}
              >
                {getEnvironmentType(selectedEnvironment).type.toUpperCase()}
              </Chip>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default EnvironmentSelector;
