import { Box, CircularProgress, CssBaseline } from '@mui/material'
import { AdminPage } from './AdminPage'
import { LoginPage } from './LoginPage'
import { AuthProvider, useAuth } from './auth/AuthContext'

const AppShell = () => {
  const { isAuthenticated, loading, logout } = useAuth()

  if (loading) {
    return (
      <>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7fe' }}>
          <CircularProgress size={48} thickness={4} sx={{ color: '#4318FF' }} />
        </Box>
      </>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <CssBaseline />
        <LoginPage />
      </>
    )
  }

  return (
    <>
      <CssBaseline />
      <AdminPage onLogout={logout} />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
