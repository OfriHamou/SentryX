import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { OrganizationAuthProvider, useOrganizationAuth } from './auth/OrganizationAuthProvider';
import LoginPage from './LoginPage';
import OrganizationPage from './OrganizationPage';

const AppRoutes: React.FC = () => {
    const { isAuthenticated, isLoading } = useOrganizationAuth();

    if (isLoading) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#F8F5FF' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/*" element={isAuthenticated ? <OrganizationPage /> : <Navigate to="/login" />} />
        </Routes>
    );
};

function App() {
    return (
        <OrganizationAuthProvider>
            <Router>
                <AppRoutes />
            </Router>
        </OrganizationAuthProvider>
    );
}

export default App;
