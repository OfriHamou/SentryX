import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import CustomerApp from './app/CustomerApp';
import CustomerLoginPage from './pages/CustomerLoginPage';
import CustomerSignupPage from './pages/CustomerSignupPage';
import { CustomerAuthProvider, useCustomerAuth } from './auth/CustomerAuthProvider';

const AuthRoutes = () => (
  <Routes>
    <Route path="/login" element={<CustomerLoginPage />} />
    <Route path="/signup" element={<CustomerSignupPage />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

const AppShell = () => {
  const { isAuthenticated, loading } = useCustomerAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (location.pathname === '/login' || location.pathname === '/signup') {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at top, #1d2744 0%, #0b1020 45%, #070b16 100%)',
        }}
      >
        <CircularProgress size={46} thickness={4} sx={{ color: '#8B9BE8' }} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <AuthRoutes />;
  }

  return <CustomerApp />;
};

export default function App() { 
  return (
    <CustomerAuthProvider>
      <AppShell />
    </CustomerAuthProvider>
  );
}