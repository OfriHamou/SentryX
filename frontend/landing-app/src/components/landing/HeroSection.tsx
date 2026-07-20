import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material';
import { ArrowForwardRounded } from '@mui/icons-material';
import { APP_URLS, gradientText } from '../../config';
import logoImg from '../../assets/LOGO.png';

const CHIPS = [
    { label: 'Live 720p video streaming', dot: '#47BFFF' },
    { label: 'Automatic face recognition', dot: '#863BFF' },
    { label: 'Role-based user access', dot: '#8B9BE8' },
];

const backgroundSx = {
    position: 'relative',
    overflow: 'hidden',
    bgcolor: '#1F2433',
    '&::before': {
        content: '""', position: 'absolute', inset: -200, pointerEvents: 'none', zIndex: 1,
        background:
            'radial-gradient(600px circle at 18% 12%, rgba(134,59,255,0.40), transparent 60%),' +
            'radial-gradient(520px circle at 82% 88%, rgba(71,191,255,0.28), transparent 60%)',
        filter: 'blur(40px)',
    },
    '&::after': {
        content: '""', position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at 50% 0%, #000 0%, transparent 72%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, #000 0%, transparent 72%)',
    },
};

export default function HeroSection() {
    return (
        <Box component="header" sx={{ ...backgroundSx, pt: { xs: 5, md: 7 }, pb: { xs: 10, md: 14 } }}>
            <Box
                component="video"
                src="/robot.mp4"
                autoPlay
                muted
                loop
                playsInline
                sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.28,
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />

            <Container maxWidth={false} sx={{ maxWidth: 1200, position: 'relative', zIndex: 2 }}>
                <Box component="img" src={logoImg} alt="SentryX" sx={{ height: 72, mb: { xs: 5, md: 7 } }} />

                <Grid container spacing={6} sx={{ alignItems: 'center' }}>
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', mb: 2.5 }}>
                            SentryX · SMART SECURITY
                        </Typography>

                        <Typography component="h1" sx={{ fontSize: 'clamp(38px, 4.4vw, 58px)', fontWeight: 800, lineHeight: 1.06, letterSpacing: '-0.03em', color: '#fff' }}>
                            One robot you drive.<br />
                            Every face it sees, <Box component="span" sx={gradientText}>on record.</Box>
                        </Typography>

                        <Typography sx={{ mt: 3, fontSize: { xs: 17, md: 19 }, lineHeight: 1.6, color: 'rgba(255,255,255,0.68)', maxWidth: 540 }}>
                            SentryX is a real-time monitoring security robot. Live video streaming, remote
                            control, and automatic face recognition, all in one platform.
                        </Typography>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 5 }}>
                            <Button href={APP_URLS.customer} endIcon={<ArrowForwardRounded />} sx={{ px: 3.5, py: 1.4, borderRadius: 2, fontWeight: 700, fontSize: 15, color: '#fff', textTransform: 'none', background: 'linear-gradient(120deg, #863BFF 0%, #47BFFF 100%)', boxShadow: '0 10px 30px -10px rgba(134,59,255,0.7)', '&:hover': { filter: 'brightness(1.08)' } }}>
                                Open Customer App
                            </Button>
                            <Button href="#how" variant="outlined" sx={{ px: 3.5, py: 1.4, borderRadius: 2, fontWeight: 600, fontSize: 15, textTransform: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.25)', '&:hover': { borderColor: '#47BFFF', bgcolor: 'rgba(71,191,255,0.06)' } }}>
                                See how it works
                            </Button>
                        </Stack>

                        <Stack direction="row" sx={{ mt: 6, flexWrap: 'wrap', gap: 1.5 }}>
                            {CHIPS.map((chip) => (
                                <Box key={chip.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 0.75, borderRadius: 999, border: '1px solid rgba(255,255,255,0.14)', bgcolor: 'rgba(255,255,255,0.04)', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: chip.dot }} />
                                    {chip.label}
                                </Box>
                            ))}
                        </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, md: 5 }} />
                </Grid>
            </Container>
        </Box>
    );
}
