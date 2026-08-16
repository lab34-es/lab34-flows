import { createContext, useContext } from 'react';

export const STORAGE_KEY = 'lab34-flows:environment';

// Shared "selected environment" state: the sidebar selector writes it,
// and the flow runner reads it when starting an execution.
export const EnvironmentContext = createContext({
  environments: [],
  environment: '',
  setEnvironment: () => {},
  loading: true,
  error: null,
});

export const useEnvironment = () => useContext(EnvironmentContext);

/**
 * Classify an environment name so the UI can color-code it
 * (local, development, staging, uat, production).
 */
export const getEnvironmentType = (envName) => {
  const name = (envName || '').toLowerCase();

  if (['local', 'localhost'].some(keyword => name.includes(keyword))) {
    return { type: 'local', color: 'primary' };
  }

  if (['dev', 'dv', 'development'].some(keyword => name.includes(keyword))) {
    return { type: 'development', color: 'success' };
  }

  if (['st', 'stage', 'staging'].some(keyword => name.includes(keyword))) {
    return { type: 'staging', color: 'warning' };
  }

  if (['ac', 'uat', 'ut'].some(keyword => name.includes(keyword))) {
    return { type: 'uat', color: 'warning' };
  }

  if (['pr', 'production', 'prod'].some(keyword => name.includes(keyword))) {
    return { type: 'production', color: 'danger' };
  }

  return { type: 'unknown', color: 'neutral' };
};
