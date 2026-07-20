import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import { APP_URLS } from '../../config';
import logoImg from '../../assets/LOGO.png';

const LINKS = [
    { label: 'Customer App', href: APP_URLS.customer },
    { label: 'Organization Portal', href: APP_URLS.organization },
    { label: 'Admin Portal', href: APP_URLS.admin },
];


export default function FooterSection() {
    return (
        <Box component="footer" sx={{ bgcolor: '#1F2433', pb: 5 }}>
            <Container maxWidth={false} sx={{ maxWidth: 1200 }}>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 4 }} />
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={3}
                    sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
                >
                    <Box component="img" src={logoImg} alt="SentryX" sx={{ height: 26 }} />
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 3 }}>
                        {LINKS.map((link) => (
                            <Typography
                                key={link.label}
                                component="a"
                                href={link.href}
                                sx={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', '&:hover': { color: '#fff' } }}
                            >
                                {link.label}
                            </Typography>
                        ))}
                    </Stack>
                </Stack>
                <Typography sx={{ mt: 3, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                    SentryX — a student-built security robot platform.
                </Typography>
            </Container>
        </Box>
    );
}