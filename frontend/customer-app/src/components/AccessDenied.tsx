import { Box, Paper, Typography } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';

export default function AccessDenied() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'grey.200',
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: 'grey.100',
          mx: 'auto',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LockIcon color="disabled" />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Access denied
      </Typography>
      <Typography color="text.secondary">
        You do not have permission to view this page.
      </Typography>
    </Paper>
  );
}
