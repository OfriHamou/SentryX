import React, { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { isAxiosError } from 'axios';
import { useOrganizationAuth } from './auth/OrganizationAuthProvider';
// @ts-ignore
import logoImg from './assets/logo_dark.png';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, authError } = useOrganizationAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(password, email);
        } catch (err) {
            if (isAxiosError(err)) {
                setError(err.response?.data?.message || 'Failed to login. Please check your credentials.');
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to login. Please check your credentials.');
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
                background: '#F7F4FC',
                fontFamily: "'Inter', sans-serif",
            }}
        >
            <Container maxWidth="sm">
                <Card
                    sx={{
                        borderRadius: '14px',
                        boxShadow: '0 20px 48px rgba(46, 16, 101, 0.1)',
                        border: '1px solid #E7DEF8',
                        background: '#FFFFFF',
                        overflow: 'hidden',
                    }}
                >
                    <CardContent sx={{ p: { xs: 3.5, sm: 4.5 } }}>
                        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
                            <img src={logoImg} alt="SentryX Logo" style={{ maxHeight: '72px', objectFit: 'contain' }} />
                        </Box>

                        <Typography variant="h4" sx={{ fontWeight: 850, color: '#20113E', textAlign: 'center', mb: 1 }}>
                            Organization Portal
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6B5A7D', textAlign: 'center', mb: 4, fontWeight: 500 }}>
                            Sign in to manage your tenant workspace
                        </Typography>

                        {(error || authError) && (
                            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                                {error || authError}
                            </Alert>
                        )}

                        <Box component="form" onSubmit={handleSubmit}>
                        <TextField
                            label="Email Address"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            disabled={loading}
                            required
                            fullWidth
                            sx={{ mb: 2.5, '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#fff' } }}
                        />
                        <TextField
                            label="Password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            disabled={loading}
                            required
                            fullWidth
                            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#fff' } }}
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            disabled={loading || !email || !password}
                            sx={{
                                backgroundColor: '#6D28D9',
                                boxShadow: 'none',
                                fontWeight: 700,
                                py: 1.5,
                                textTransform: 'none',
                                fontSize: '1rem',
                                borderRadius: '10px',
                                '&:hover': { backgroundColor: '#5B21B6' },
                                '&:disabled': { backgroundColor: '#cbd5e1', cursor: 'not-allowed' },
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
                        </Box>

                        <Typography variant="caption" sx={{ color: '#8B7AA8', textAlign: 'center', display: 'block', mt: 3, fontWeight: 500 }}>
                            Contact your administrator if you do not have credentials
                        </Typography>
                    </CardContent>
                </Card>
            </Container>
        </Box>
    );
};

export default LoginPage;
