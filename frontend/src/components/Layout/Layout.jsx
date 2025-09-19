import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Sheet,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  Typography,
  Divider,
  IconButton,
} from '@mui/joy';
import {
  Dashboard as DashboardIcon,
  PlayArrow as FlowIcon,
  Apps as AppsIcon,
  Menu as MenuIcon,
} from '@mui/icons-material';
import EnvironmentSelector from '../EnvironmentSelector/EnvironmentSelector';

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const menuItems = [
    { path: '/flows', label: 'Flows', icon: <FlowIcon /> },
    { path: '/applications', label: 'Applications', icon: <AppsIcon /> },
  ];

  return (
    <>
      {/* Sidebar */}
      <Sheet
        sx={{
          width: sidebarOpen ? 240 : 60,
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
          transition: 'width 0.3s ease',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            variant="plain"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <MenuIcon />
          </IconButton>
          {sidebarOpen && (
            <Typography level="title-lg" fontWeight="bold">
              Lab34 Flows
            </Typography>
          )}
        </Box>
        
        <Divider />
        
        <List sx={{ p: 1, flex: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 'sm',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                }}
              >
                {item.icon}
                {sidebarOpen && (
                  <ListItemContent sx={{ ml: 1 }}>
                    {item.label}
                  </ListItemContent>
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        
        <EnvironmentSelector sidebarOpen={sidebarOpen} />
      </Sheet>

      {/* Main Content */}
      <Box
        sx={{
          ml: sidebarOpen ? '240px' : '60px',
          transition: 'margin-left 0.3s ease',
          flex: 1,
          p: 3,
          minHeight: '100vh',
          bgcolor: 'background.surface',
        }}
      >
        {children}
      </Box>
    </>
  );
};

export default Layout;
