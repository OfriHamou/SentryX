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
                    borderRadius: '14px',
                    boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)',
                    border: '1px solid #E7DEF8',
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
                        borderRadius: '12px',
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
                <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E', mb: 1 }}>
                    {title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#6B5A7D', fontWeight: 500 }}>
                    {message}
                </Typography>
            </Box>
        </Box>
    );
};

export default AccessDenied;
