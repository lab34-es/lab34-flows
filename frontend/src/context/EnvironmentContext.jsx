import React, { useEffect, useState } from 'react';
import { environmentApi } from '../services/api';
import { EnvironmentContext, STORAGE_KEY } from './environment';

// Provider for the shared environment selection. See ./environment.js for
// the context object, the useEnvironment hook and helpers.
export const EnvironmentProvider = ({ children }) => {
  const [environments, setEnvironments] = useState([]);
  const [environment, setEnvironmentState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        setLoading(true);
        const response = await environmentApi.getAllPossible();
        const list = response.data || [];
        setEnvironments(list);

        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && list.includes(stored)) {
          setEnvironmentState(stored);
        } else if (list.length > 0) {
          setEnvironmentState(list[0]);
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

  const setEnvironment = (value) => {
    setEnvironmentState(value || '');
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <EnvironmentContext.Provider value={{ environments, environment, setEnvironment, loading, error }}>
      {children}
    </EnvironmentContext.Provider>
  );
};
