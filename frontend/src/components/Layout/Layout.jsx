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
  Tooltip,
  Link,
} from '@mui/joy';
import { useColorScheme } from '@mui/joy/styles';
import {
  PlayArrow as FlowIcon,
  Apps as AppsIcon,
  Menu as MenuIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  MenuBook as DocsIcon,
} from '@mui/icons-material';
import EnvironmentSelector from '../EnvironmentSelector/EnvironmentSelector';
import { metaApi } from '../../services/api';

const DOCS_URL = 'https://github.com/lab34-es/lab34-flows/tree/master/docs';

const ModeToggle = () => {
  const { mode, setMode } = useColorScheme();

  return (
    <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        variant="plain"
        color="neutral"
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
      >
        {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
};

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    metaApi.get()
      .then(response => setMeta(response.data))
      .catch(() => {});
  }, []);

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

        {/* Footer: theme toggle, docs link, version */}
        <Divider />
        <Box
          sx={{
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            flexDirection: sidebarOpen ? 'row' : 'column',
            gap: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: sidebarOpen ? 'row' : 'column' }}>
            <ModeToggle />
            <Tooltip title="Documentation">
              <IconButton
                component="a"
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                variant="plain"
                color="neutral"
              >
                <DocsIcon />
              </IconButton>
            </Tooltip>
          </Box>
          {sidebarOpen && meta && (
            <Tooltip title={`Workspace: ${meta.contextDir}`}>
              <Link
                href="https://github.com/lab34-es/lab34-flows"
                target="_blank"
                rel="noreferrer"
                level="body-xs"
                color="neutral"
              >
                v{meta.version}
              </Link>
            </Tooltip>
          )}
        </Box>
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
