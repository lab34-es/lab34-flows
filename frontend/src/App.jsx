import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/joy';
import Layout from './components/Layout/Layout';
import FlowList from './components/FlowList/FlowList';
import FlowViewer from './components/FlowViewer/FlowViewer';
import ApplicationsList from './components/ApplicationsList/ApplicationsList';
import ApplicationViewer from './components/ApplicationViewer/ApplicationViewer';

function App() {
  return (
    <Router>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/flows" replace />} />
            <Route path="/flows" element={<FlowList />} />
            <Route path="/flows/user" element={<FlowViewer />} />
            <Route path="/applications" element={<ApplicationsList />} />
            <Route path="/applications/:appSlug" element={<ApplicationViewer />} />
          </Routes>
        </Layout>
      </Box>
    </Router>
  );
}

export default App;
