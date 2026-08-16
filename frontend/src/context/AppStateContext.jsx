import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { flowsApi, applicationsApi, environmentApi } from '@/services/api';

const AppStateContext = createContext(null);

const ENV_STORAGE_KEY = 'lab34-flows:environment';

export function AppStateProvider({ children }) {
  const [tree, setTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [environments, setEnvironments] = useState([]);
  const [environment, setEnvironmentState] = useState(
    () => localStorage.getItem(ENV_STORAGE_KEY) || ''
  );

  const refreshTree = useCallback(async () => {
    try {
      const response = await flowsApi.tree();
      setTree(response.data || []);
    } catch (error) {
      console.error('Error loading flows tree:', error);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const refreshApplications = useCallback(async () => {
    try {
      const response = await applicationsApi.list();
      setApplications(response.data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setApplicationsLoading(false);
    }
  }, []);

  const refreshEnvironments = useCallback(async () => {
    try {
      const response = await environmentApi.getAllPossible();
      const list = response.data || [];
      setEnvironments(list);
      // Auto-select when nothing (valid) is selected yet
      setEnvironmentState((current) => {
        if (current && list.includes(current)) { return current; }
        const initial = list.includes('local') ? 'local' : list[0] || '';
        if (initial) { localStorage.setItem(ENV_STORAGE_KEY, initial); }
        return initial;
      });
    } catch (error) {
      console.error('Error loading environments:', error);
    }
  }, []);

  const setEnvironment = useCallback((value) => {
    setEnvironmentState(value);
    localStorage.setItem(ENV_STORAGE_KEY, value);
  }, []);

  useEffect(() => {
    refreshTree();
    refreshApplications();
    refreshEnvironments();
  }, [refreshTree, refreshApplications, refreshEnvironments]);

  const value = useMemo(
    () => ({
      tree,
      treeLoading,
      refreshTree,
      applications,
      applicationsLoading,
      refreshApplications,
      environments,
      environment,
      setEnvironment,
      refreshEnvironments,
    }),
    [tree, treeLoading, refreshTree, applications, applicationsLoading, refreshApplications, environments, environment, setEnvironment, refreshEnvironments]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
