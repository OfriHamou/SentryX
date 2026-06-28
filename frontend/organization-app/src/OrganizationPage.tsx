import React from 'react';
import NotificationsIcon from '@mui/icons-material/Notifications';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import { Avatar, Box, Button, Chip, IconButton, Typography } from '@mui/material';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useOrganizationAuth } from './auth/OrganizationAuthProvider';
import { hasOrganizationPermission } from './auth/permissions';
import AccessDenied from './components/AccessDenied';
import PermissionGate from './components/PermissionGate';
import Sidebar, { drawerWidth } from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import UsersAccess from './pages/UsersAccess';

const getInitials = (name?: string): string => {
  if (!name) {
    return 'SX';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'SX';
};

const getActiveTitle = (pathname: string): string => {
  if (pathname.startsWith('/users')) {
    return 'Users & Access';
  }

  if (pathname.startsWith('/settings')) {
    return 'Settings';
  }

  return 'Dashboard';
};

const OrganizationPage: React.FC = () => {
  const { user, logout } = useOrganizationAuth();
  const location = useLocation();
  const canReadPortal = hasOrganizationPermission(user?.allowedPages, 'organization_portal', 'read');
  const activeTitle = getActiveTitle(location.pathname);

  return (
    <PermissionGate allowed={canReadPortal} fallback={<Box sx={{ p: 3 }}><AccessDenied /></Box>}>
      <Box
        sx={{
          display: 'flex',
          minHeight: '100vh',
          background: '#F7F4FC',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <Sidebar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 3 },
            width: `calc(100% - ${drawerWidth}px)`,
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              mb: 2.5,
              gap: 2,
              px: { xs: 2, md: 3 },
              py: 2,
              borderRadius: '14px',
              background: '#FFFFFF',
              border: '1px solid #E7DEF8',
              boxShadow: '0 10px 28px rgba(46, 16, 101, 0.06)',
            }}
          >
            <Box>
              <Chip
                icon={<WorkspacesIcon sx={{ fontSize: 17 }} />}
                label="Tenant workspace"
                size="small"
                sx={{
                  mb: 1,
                  height: 28,
                  borderRadius: '6px',
                  backgroundColor: '#F1EBFF',
                  color: '#5B21B6',
                  fontWeight: 800,
                  '& .MuiChip-icon': { color: '#7C3AED' },
                }}
              />
              <Typography variant="h4" sx={{ fontWeight: 850, color: '#20113E', letterSpacing: 0 }}>
                {activeTitle}
              </Typography>
              <Typography variant="body2" sx={{ color: '#706282', fontWeight: 600, mt: 0.5 }}>
                A focused place to manage your tenant access and organization details.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                backgroundColor: '#FFFFFF',
                p: 0.5,
                borderRadius: '12px',
                border: '1px solid #E7DEF8',
                flexShrink: 0,
              }}
            >
              <IconButton sx={{ color: '#5B21B6', width: 38, height: 38, borderRadius: '8px' }}>
                <NotificationsIcon />
              </IconButton>
              <Avatar sx={{ bgcolor: '#4C1D95', width: 38, height: 38, fontWeight: 'bold' }}>
                {getInitials(user?.fullName)}
              </Avatar>
              <Button
                onClick={logout}
                sx={{
                  ml: 1,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#EE5D50',
                  fontSize: '0.9rem',
                  '&:hover': { backgroundColor: '#FDECEB' },
                }}
              >
                Logout
              </Button>
            </Box>
          </Box>

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<UsersAccess />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/access-denied" element={<AccessDenied />} />
          </Routes>
        </Box>
      </Box>
    </PermissionGate>
  );
};

export default OrganizationPage;
