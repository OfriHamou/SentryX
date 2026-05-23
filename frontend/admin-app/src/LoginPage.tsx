import { useState } from 'react';
import {
    Box,
    Button,
    TextField,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Container
} from '@mui/material';
import logoImg from './assets/logo_dark.png';
import { useAuth } from './auth/AuthContext';
import { isAxiosError } from 'axios';

export const LoginPage = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await login(email, password);
        } catch (err) {
            if (isAxiosError(err)) {
                setError(err.response?.data?.message || 'Login failed. Please try again.');
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: '#f4f7fe',
                fontFamily: "'Inter', sans-serif"
            }}
        >
            <Container maxWidth="sm">
                <Card
                    sx={{
                        borderRadius: '20px',
                        boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)',
                        border: 'none',
                        backgroundColor: '#fff'
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        {/* Logo */}
                        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
                            <img
                                src={logoImg}
                                alt="SentryX Logo"
                                style={{ maxHeight: '80px', objectFit: 'contain' }}
                            />
                        </Box>

                        {/* Title */}
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 800,
                                color: '#2B3674',
                                textAlign: 'center',
                                mb: 1
                            }}
                        >
                            Admin Portal
                        </Typography>

                        <Typography
                            variant="body2"
                            sx={{
                                color: '#A3AED0',
                                textAlign: 'center',
                                mb: 4,
                                fontWeight: 500
                            }}
                        >
                            Sign in to manage your organization
                        </Typography>

                        {/* Error Alert */}
                        {error && (
                            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {/* Login Form */}
                        <form onSubmit={handleLogin}>
                            <TextField
                                fullWidth
                                label="Email Address"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@example.com"
                                disabled={loading}
                                sx={{
                                    mb: 2.5,
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2
                                    }
                                }}
                            />

                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                disabled={loading}
                                sx={{
                                    mb: 3,
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2
                                    }
                                }}
                            />

                            <Button
                                fullWidth
                                variant="contained"
                                type="submit"
                                disabled={loading || !email || !password}
                                sx={{
                                    backgroundColor: '#4318FF',
                                    boxShadow: '0 4px 12px rgba(67, 24, 255, 0.3)',
                                    fontWeight: 700,
                                    py: 1.5,
                                    textTransform: 'none',
                                    fontSize: '1rem',
                                    borderRadius: 2,
                                    '&:hover': {
                                        backgroundColor: '#3311db'
                                    },
                                    '&:disabled': {
                                        backgroundColor: '#cbd5e1',
                                        cursor: 'not-allowed'
                                    }
                                }}
                            >
                                {loading ? (
                                    <>
                                        <CircularProgress size={20} sx={{ mr: 1 }} />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>

                        {/* Footer Note */}
                        <Typography
                            variant="caption"
                            sx={{
                                color: '#A3AED0',
                                textAlign: 'center',
                                display: 'block',
                                mt: 3,
                                fontWeight: 500
                            }}
                        >
                            Contact your administrator if you don't have credentials
                        </Typography>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
};
