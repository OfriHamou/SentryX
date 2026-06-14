import { AppBar, Toolbar, Box, Button, Container, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';
import logoImg from '../assets/LOGO.png';
import { useCustomerAuth } from '../auth/CustomerAuthProvider';
import { Dashboard as DashboardIcon, Videocam as LiveIcon, NotificationsActive as AlertsIcon, SportsEsports as ControlIcon, History as HistoryIcon, Settings as SettingsIcon } from '@mui/icons-material';

const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
    { label: 'Live', path: '/live', icon: <LiveIcon /> },
    { label: 'Alerts', path: '/alerts', icon: <AlertsIcon /> },
    { label: 'Control', path: '/control', icon: <ControlIcon /> },
    { label: 'History', path: '/history', icon: <HistoryIcon /> },
    { label: 'Settings', path: '/settings', icon: <SettingsIcon /> },
];

export default function AppLayout() {
    const { logout, user } = useCustomerAuth();

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="static" sx={{ bgcolor: '#1F2433' }}>
                <Toolbar sx={{ gap: 2 }}>
                    <Box
                      component="img"
                      src={logoImg}
                      alt="SentryX"
                      sx={{ height: { xs: 32, sm: 40, md: 50 }, mr: 1 , mt: 2, mb: 2 }}
                    />
                    {navItems.map((item) => (
                        <Button
                            key={item.path}
                            component={NavLink}
                            to={item.path}
                            startIcon={item.icon}
                            sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                textTransform: 'none',
                                '&.active': { color: '#fff', fontWeight: 600 },
                            }}
                        >
                            {item.label}
                        </Button>
                    ))}
                    <Box sx={{ flexGrow: 1 }} />
                    {user?.fullName && (
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mr: 2 }}>
                            {user.fullName}
                        </Typography>
                    )}
                    <Button
                        variant="contained"
                        sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { bgcolor: '#A01414' }
                        }}
                        onClick={logout}
                    >
                        Logout
                    </Button>
                </Toolbar>
            </AppBar>

            <Container maxWidth={false} sx={{ maxWidth: 1400, py: 3 }}>
                <Outlet />
            </Container>
        </Box>
    );
}