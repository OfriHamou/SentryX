import { Box, Typography } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';

interface AccessDeniedProps {
    title?: string;
    message?: string;
}

export const AccessDenied = ({
    title = 'Access denied',
    message = 'You do not have permission to view this page.'
}: AccessDeniedProps) => {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
            <Box
                sx={{
                    backgroundColor: '#fff',
                    borderRadius: '20px',
                    boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)',
                    border: '1px solid #E2E8F0',
                    px: 5,
                    py: 4,
                    maxWidth: 520,
                    textAlign: 'center'
                }}
            >
                <Box
                    sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '16px',
                        backgroundColor: '#FDECEB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2
                    }}
                >
                    <BlockIcon sx={{ color: '#EE5D50', fontSize: 32 }} />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#2B3674', mb: 1 }}>
                    {title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#A3AED0', fontWeight: 500 }}>
                    {message}
                </Typography>
            </Box>
        </Box>
    );
};
