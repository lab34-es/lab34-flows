import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar/AppSidebar';
import TopBar from '@/components/shared/TopBar';
import HomePage from '@/pages/HomePage';
import FlowPage from '@/pages/FlowPage';
import FolderPage from '@/pages/FolderPage';
import TestRunsPage from '@/pages/TestRunsPage';
import TestRunPage from '@/pages/TestRunPage';
import TestRunFlowPage from '@/pages/TestRunFlowPage';
import ApplicationPage from '@/pages/ApplicationPage';
import SettingsPage from '@/pages/SettingsPage';
import AiSettings from '@/components/settings/AiSettings';
import XraySettings from '@/components/settings/XraySettings';
import UiSettings from '@/components/settings/UiSettings';
import HelpSection from '@/components/settings/help/HelpSection';
import { AppStateProvider } from '@/context/AppStateContext';
import { ExecutionProvider } from '@/context/ExecutionContext';
import { ThemeProvider } from '@/context/ThemeContext';

function Shell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <TopBar />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/flows/view" element={<FlowPage />} />
            <Route path="/flows/folder" element={<FolderPage />} />
            <Route path="/test-runs" element={<TestRunsPage />} />
            <Route path="/test-runs/:id" element={<TestRunPage />} />
            <Route path="/test-runs/:id/flow" element={<TestRunFlowPage />} />
            <Route path="/applications/:slug" element={<ApplicationPage />} />
            <Route path="/settings" element={<SettingsPage />}>
              <Route index element={<Navigate to="/settings/ai" replace />} />
              <Route path="ai" element={<AiSettings />} />
              <Route path="xray" element={<XraySettings />} />
              <Route path="ui" element={<UiSettings />} />
              <Route path="help" element={<HelpSection />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <ExecutionProvider>
          <BrowserRouter>
            <Shell />
          </BrowserRouter>
        </ExecutionProvider>
      </AppStateProvider>
    </ThemeProvider>
  );
}

export default App;
