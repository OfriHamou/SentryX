import React from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import { Box, Divider, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
// @ts-ignore
import logoImg from '../assets/LOGO.PNG';

export const drawerWidth = 260;

const navItemSx = (active: boolean) => ({
  borderRadius: '12px',
  minHeight: 48,
  backgroundColor: active ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
  color: active ? '#FFFFFF' : '#C4B5FD',
  border: active ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid transparent',
  '&:hover': {
    backgroundColor: active ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
  },
});

const Sidebar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }

    return location.pathname.startsWith(path);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #2E1065 0%, #3B0764 48%, #1E1335 100%)',
          color: '#FFFFFF',
          borderRight: 'none',
          boxShadow: '12px 0 34px rgba(46, 16, 101, 0.18)',
          p: 2,
        },
      }}
    >
      <Box sx={{ mt: 2.5, mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
        <img src={logoImg} alt="SentryX Logo" style={{ width: '92%', maxHeight: '132px', objectFit: 'contain' }} />
      </Box>
      <Box
        sx={{
          mx: 0.5,
          mb: 2.5,
          p: 2,
          borderRadius: '14px',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.2, alignItems: 'center' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', backgroundColor: '#7C3AED', color: '#FFFFFF' }}>
            <WorkspacesIcon fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 850, color: '#FFFFFF', fontSize: '0.94rem' }}>Tenant Portal</Typography>
            <Typography sx={{ color: '#C4B5FD', fontSize: '0.76rem', fontWeight: 600 }}>Workspace management</Typography>
          </Box>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(196, 181, 253, 0.16)', mb: 2.5 }} />
      <Box sx={{ overflow: 'auto', px: 0.5 }}>
        <Typography variant="overline" sx={{ color: '#A78BFA', px: 1.5, fontWeight: 800, mb: 1, display: 'block', letterSpacing: 1 }}>
          OVERVIEW
        </Typography>
        <List>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton component={RouterLink} to="/dashboard" sx={navItemSx(isActive('/dashboard'))}>
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText
                disableTypography
                primary={<Typography sx={{ fontWeight: isActive('/dashboard') ? 700 : 500, fontSize: '0.95rem' }}>Dashboard</Typography>}
              />
            </ListItemButton>
          </ListItem>
        </List>

        <Typography variant="overline" sx={{ color: '#A78BFA', px: 1.5, fontWeight: 800, mt: 3, mb: 1, display: 'block', letterSpacing: 1 }}>
          MANAGEMENT
        </Typography>
        <List>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton component={RouterLink} to="/users" sx={navItemSx(isActive('/users'))}>
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                <PeopleIcon />
              </ListItemIcon>
              <ListItemText
                disableTypography
                primary={<Typography sx={{ fontWeight: isActive('/users') ? 700 : 500, fontSize: '0.95rem' }}>Users & Access</Typography>}
              />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton component={RouterLink} to="/settings" sx={navItemSx(isActive('/settings'))}>
              <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText
                disableTypography
                primary={<Typography sx={{ fontWeight: isActive('/settings') ? 700 : 500, fontSize: '0.95rem' }}>Settings</Typography>}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
