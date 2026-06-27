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
  Container,
} from '@mui/material';
import { isAxiosError } from 'axios';
import logoImg from '../assets/LOGO.png';
import { useNavigate } from 'react-router-dom';
import { register } from '../auth/customerAuthService';
import { Link as RouterLink } from 'react-router-dom';

export default function CustomerSignupPage() {
  const navigate = useNavigate();
  const [organizationId, setOrganizationId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      await register({
        tenantInviteCode: organizationId,
        email,
        password,
        fullName: fullName.trim() ? fullName.trim() : undefined,
        phone: phone.trim() ? phone.trim() : undefined,
        jobTitle: jobTitle.trim() ? jobTitle.trim() : undefined,
      });

      // Navigate to pending approval page (not auto-login)
      navigate('/pending-approval', { replace: true });
    } catch (err) {
      if (isAxiosError(err)) {
        setError(err.response?.data?.message || 'Sign up failed. Please try again.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top left, #3a3f4e 0%, #2b2f3a 45%, #232733 100%)',
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="sm" sx={{ width: '100%' }}>
        <Card
          sx={{
            borderRadius: 3,
            background: 'rgba(108, 114, 136, 0.9)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(14px)',
            maxWidth: 440,
            mx: 'auto',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <Box
                component="img"
                src={logoImg}
                alt="SentryX"
                sx={{ height: { xs: 56, sm: 70 }, objectFit: 'contain' }}
              />
            </Box>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#F8FAFC',
                textAlign: 'left',
                mb: 1,
              }}
            >
              Sign Up
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: 'rgba(226, 232, 240, 0.75)',
                textAlign: 'left',
                mb: 3,
              }}
            >
              Register your organization
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSignup}>
              <TextField
                fullWidth
                label="Organization ID"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="e.g., ORG-ACME-A1B2C3"
                disabled={loading}
                required
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(226, 232, 240, 0.8)',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#F8FAFC',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(226, 232, 240, 0.2)',
                  },
                }}
              />

              <TextField
                fullWidth
                label="Full Name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your full name"
                disabled={loading}
                required
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(226, 232, 240, 0.8)',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#F8FAFC',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(226, 232, 240, 0.2)',
                  },
                }}
              />

              <TextField
                fullWidth
                label="Work Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                disabled={loading}
                required
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(226, 232, 240, 0.8)',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#F8FAFC',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(226, 232, 240, 0.2)',
                  },
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a password"
                disabled={loading}
                required
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(226, 232, 240, 0.8)',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#F8FAFC',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(226, 232, 240, 0.2)',
                  },
                }}
              />

              <TextField
                fullWidth
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your password"
                disabled={loading}
                required
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(226, 232, 240, 0.8)',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#F8FAFC',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(226, 232, 240, 0.2)',
                  },
                }}
              />

              <TextField
                fullWidth
                label="Phone (Optional)"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Your phone number"
                disabled={loading}
                sx={{
                  mb: 2.5,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(226, 232, 240, 0.8)',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#F8FAFC',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(226, 232, 240, 0.2)',
                  },
                }}
              />

              <TextField
                fullWidth
                label="Job Title (Optional)"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Your job title"
                disabled={loading}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(226, 232, 240, 0.8)',
                  },
                  '& .MuiOutlinedInput-input': {
                    color: '#F8FAFC',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(226, 232, 240, 0.2)',
                  },
                }}
              />

              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={
                  loading ||
                  !organizationId ||
                  !fullName ||
                  !email ||
                  !password ||
                  !confirmPassword ||
                  password !== confirmPassword
                }
                sx={{
                  backgroundColor: '#7C8FE8',
                  boxShadow: '0 12px 24px rgba(124, 143, 232, 0.3)',
                  fontWeight: 700,
                  py: 1.4,
                  textTransform: 'none',
                  fontSize: '1rem',
                  borderRadius: 2,
                  '&:hover': {
                    backgroundColor: '#6A7FE6',
                  },
                  '&:disabled': {
                    backgroundColor: 'rgba(148, 163, 184, 0.5)',
                  },
                }}
              >
                {loading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1, color: '#fff' }} />
                    Creating account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>
            </form>

            <Typography
              variant="caption"
              sx={{
                color: 'rgba(226, 232, 240, 0.6)',
                textAlign: 'center',
                display: 'block',
                mt: 3,
              }}
            >
              Already have an account?{' '}
              <Box
                component={RouterLink}
                to="/login"
                sx={{ color: '#E2E8F0', textDecoration: 'none', fontWeight: 600 }}
              >
                Sign in
              </Box>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
