import { AppBar, Toolbar, Box, Button, Container, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';
import logoImg from '../assets/LOGO.png';
import { useCustomerAuth } from '../auth/CustomerAuthProvider';

const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Live', path: '/live' },
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