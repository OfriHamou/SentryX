import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#8B9BE8',     
      dark: '#6B7EE8',
      light: '#A8B5F0',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F3F4F6',   
      paper: '#FFFFFF',     
    },
    text: {
      primary: '#1F2937',
      secondary: '#6B7280',
    },
    success: { main: '#22C55E' }, 
    warning: { main: '#F59E0B' }, 
    error:   { main: '#EF4444' }, 
  },
  shape: {
    borderRadius: 12,      
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
});
