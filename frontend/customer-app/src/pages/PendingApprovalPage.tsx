import { Box, Button, Card, CardContent, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import logoImg from '../assets/LOGO.png';

export default function PendingApprovalPage() {
  const navigate = useNavigate();

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
          <CardContent sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <Box
                component="img"
                src={logoImg}
                alt="SentryX"
                sx={{ height: { xs: 56, sm: 70 }, objectFit: 'contain' }}
              />
            </Box>

            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <CheckCircleIcon
                sx={{
                  fontSize: 64,
                  color: '#05CD99',
                }}
              />
            </Box>

            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#F8FAFC',
                mb: 2,
              }}
            >
              Registration Submitted
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: 'rgba(226, 232, 240, 0.75)',
                mb: 3,
                lineHeight: 1.6,
              }}
            >
              Your account is waiting for SentryX admin approval. You will be able to sign in after your request is approved. This typically takes 1-2 business days.
            </Typography>

            <Typography
              variant="body2"
              sx={{
                color: 'rgba(226, 232, 240, 0.6)',
                mb: 4,
              }}
            >
              You'll receive a confirmation email once your account has been approved.
            </Typography>

            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/login', { replace: true })}
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
              }}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
