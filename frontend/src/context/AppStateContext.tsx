import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { flowsApi, applicationsApi, environmentApi, contextApi } from '@/services/api';
import { indexChanges, scopedStatus } from '@/lib/git';

const AppStateContext = createContext<any>(null);

const ENV_STORAGE_KEY = 'lab34-flows:environment';

// Git state goes stale on its own -- a pull in a terminal, a file written by
// another tool -- so it is re-read on a timer as well as after our own writes.
const GIT_POLL_MS = 15000;

export function AppStateProvider({ children }) {
  const [tree, setTree] = useState<any[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [environments, setEnvironments] = useState<any[]>([]);
  const [environment, setEnvironmentState] = useState(
    () => localStorage.getItem(ENV_STORAGE_KEY) || ''
  );
  const [contextInfo, setContextInfo] = useState<any>(null);

  const refreshContext = useCallback(async () => {
    try {
      const response = await contextApi.get();
      setContextInfo(response.data || null);
    } catch (error) {
      console.error('Error loading context info:', error);
    }
  }, []);

  const refreshTree = useCallback(async () => {
    try {
      const response = await flowsApi.tree();
      setTree(response.data || []);
    } catch (error) {
      console.error('Error loading flows tree:', error);
    } finally {
      setTreeLoading(false);
    }
    // Whatever moved the tree moved the working copy with it
    refreshContext();
  }, [refreshContext]);

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
    // refreshTree() reads the context state too
  }, [refreshTree, refreshApplications, refreshEnvironments]);

  // Poll while the tab is in front, and catch up as soon as it comes back:
  // a background tab has nobody looking at its file decorations.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) { refreshContext(); }
    };

    const timer = window.setInterval(onVisible, GIT_POLL_MS);
    window.addEventListener('focus', refreshContext);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshContext);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshContext]);

  // The decorations the sidebar draws, rebuilt only when git state changes
  const gitIndex = useMemo(
    () => indexChanges(contextInfo?.git?.changes),
    [contextInfo]
  );

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
      contextInfo,
      refreshContext,
      gitIndex,
    }),
    [tree, treeLoading, refreshTree, applications, applicationsLoading, refreshApplications, environments, environment, setEnvironment, refreshEnvironments, contextInfo, refreshContext, gitIndex]
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

/**
 * Git decorations for one of the context's subtrees ('flows' or
 * 'applications'), keyed by the same relative paths the sidebar already uses.
 * @param {string} prefix
 */
export function useGitStatus(prefix) {
  const { gitIndex } = useAppState();
  return useMemo(() => scopedStatus(gitIndex, prefix), [gitIndex, prefix]);
}
