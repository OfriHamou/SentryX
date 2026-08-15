import { useState } from 'react';
import { AppBar, Toolbar, Box, Button, Container, Typography, IconButton, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';
import logoImg from '../assets/LOGO.png';
import { hasCustomerPermission, useCustomerAuth } from '../auth/CustomerAuthProvider';
import { Dashboard as DashboardIcon, Videocam as LiveIcon, NotificationsActive as AlertsIcon, SportsEsports as ControlIcon, History as HistoryIcon, Settings as SettingsIcon, PhotoLibrary as MediaIcon, EventAvailable as DutyIcon, Menu as MenuIcon, Logout as LogoutIcon } from '@mui/icons-material';
import BellNotifications from '../components/notifications/BellNotifications';

const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, permissions: [{ resource: 'dashboard', action: 'read' }] },
    { label: 'Live', path: '/live', icon: <LiveIcon />, permissions: [{ resource: 'live', action: 'read' }] },
    { label: 'Alerts', path: '/alerts', icon: <AlertsIcon />, permissions: [{ resource: 'alerts', action: 'read' }] },
    { label: 'Shift Duty', path: '/shift-duty', icon: <DutyIcon />, permissions: [{ resource: 'on_call', action: 'read' }] },
    { label: 'Control', path: '/control', icon: <ControlIcon />, permissions: [{ resource: 'control', action: 'read' }] },
    { label: 'History', path: '/history', icon: <HistoryIcon />, permissions: [{ resource: 'history', action: 'read' }, { resource: 'events', action: 'read' }] },
    { label: 'Media', path: '/media', icon: <MediaIcon />, permissions: [{ resource: 'history', action: 'read' }, { resource: 'events', action: 'read' }] },
    { label: 'Settings', path: '/settings', icon: <SettingsIcon />, permissions: [{ resource: 'settings', action: 'read' }, { resource: 'robots', action: 'read' }, { resource: 'faces', action: 'read' }] },
] as const;

export default function AppLayout() {
    const { logout, user } = useCustomerAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const visibleNavItems = navItems.filter(item =>
        item.permissions.some(permission =>
            hasCustomerPermission(user?.allowedPages, permission.resource, permission.action)
        )
    );
    const canReadAlerts = hasCustomerPermission(user?.allowedPages, 'alerts', 'read');

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="static" sx={{ bgcolor: '#1F2433' }}>
                <Toolbar sx={{ gap: { xs: 1, md: 2 } }}>
                    <IconButton
                        edge="start"
                        aria-label="Open navigation"
                        onClick={() => setMobileNavOpen(true)}
                        sx={{ display: { md: 'none' }, color: 'rgba(255, 255, 255, 0.7)' }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Box component="img" src={logoImg} alt="SentryX" sx={{ height: { xs: 32, sm: 40, md: 50 }, mr: 1 , mt: 2, mb: 2 }}/>
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2 }}>
                        {visibleNavItems.map((item) => (
                            <Button
                                key={item.path}
                                component={NavLink}
                                to={item.path}
                                startIcon={item.icon}
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    textTransform: 'none',
                                    whiteSpace: 'nowrap',
                                    '&.active': { color: '#fff', fontWeight: 600 },
                                }}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </Box>
                    <Box sx={{ flexGrow: 1 }} />
                    {user?.fullName && (
                        <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, color: 'rgba(255, 255, 255, 0.7)', mr: 2 }}>
                            {user.fullName}
                        </Typography>
                    )}
                    {canReadAlerts && <BellNotifications />}
                    <Button
                        variant="contained"
                        sx={{
                            display: { xs: 'none', md: 'inline-flex' },
                            bgcolor: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { bgcolor: '#A01414' }
                        }}
                        onClick={logout}
                    >
                        Logout
                    </Button>
                </Toolbar>
            </AppBar>
            <Drawer
                open={mobileNavOpen}
                onClose={() => setMobileNavOpen(false)}
                sx={{ display: { md: 'none' } }}
                slotProps={{ paper: { sx: { width: 260 } } }}
            >
                <Box role="presentation" onClick={() => setMobileNavOpen(false)}>
                    {user?.fullName && (
                        <Typography sx={{ px: 2, py: 2, fontWeight: 700 }}>
                            {user.fullName}
                        </Typography>
                    )}
                    <Divider />
                    <List>
                        {visibleNavItems.map((item) => (
                            <ListItemButton
                                key={item.path}
                                component={NavLink}
                                to={item.path}
                                sx={{
                                    '&.active': {
                                        bgcolor: 'action.selected',
                                        '& .MuiListItemText-primary': { fontWeight: 700 },
                                    },
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        ))}
                    </List>
                    <Divider />
                    <List>
                        <ListItemButton onClick={logout}>
                            <ListItemIcon sx={{ minWidth: 40 }}><LogoutIcon /></ListItemIcon>
                            <ListItemText primary="Logout" />
                        </ListItemButton>
                    </List>
                </Box>
            </Drawer>
            <Container maxWidth={false} sx={{ maxWidth: 1400, py: 3 }}>
                <Outlet />
            </Container>
        </Box>
    );
}