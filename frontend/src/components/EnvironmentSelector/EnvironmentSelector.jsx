import React from 'react';
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
import { useEnvironment, getEnvironmentType } from '../../context/environment';

const typeDot = (color) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  bgcolor: color === 'primary' ? 'primary.500' :
    color === 'success' ? 'success.500' :
      color === 'warning' ? 'warning.500' :
        color === 'danger' ? 'danger.500' : 'neutral.500'
});

// Sidebar selector for the globally selected environment.
// The selection is shared through EnvironmentContext and used
// as the default environment when running flows.
const EnvironmentSelector = ({ sidebarOpen }) => {
  const { environments, environment, setEnvironment, loading, error } = useEnvironment();

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
            value={environment || null}
            onChange={(event, value) => setEnvironment(value)}
            size="sm"
            placeholder="Select environment"
            sx={{ width: '100%' }}
            renderValue={(option) => {
              if (!option) { return null; }
              const envType = getEnvironmentType(option.value);
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={typeDot(envType.color)} />
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
                    <Box sx={typeDot(envType.color)} />
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

          {environment && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                size="sm"
                color={getEnvironmentType(environment).color}
                variant="soft"
                sx={{ fontSize: '10px' }}
              >
                {getEnvironmentType(environment).type.toUpperCase()}
              </Chip>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default EnvironmentSelector;
