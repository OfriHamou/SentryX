import { Box, Container, Grid, Typography } from '@mui/material';
import { SmartToyOutlined, StorageOutlined, AutoAwesomeOutlined, DevicesOutlined } from '@mui/icons-material';
import { gradientText } from '../../config';

const STEPS = [
    { icon: SmartToyOutlined, title: 'Robot', body: 'The robot streams video and runs face recognition on-device.' },
    { icon: StorageOutlined, title: 'Backend', body: 'The event and its frame are stored securely against your account.' },
    { icon: AutoAwesomeOutlined, title: 'AI worker', body: 'A background worker analyses the captured frame.' },
    { icon: DevicesOutlined, title: 'Your apps', body: "The frame shows up in the Customer App's history and gallery." },
];

export default function HowItWorksSection() {
    return (
        <Box component="section" id="how" sx={{ bgcolor: '#1F2433', py: { xs: 8, md: 12 }, scrollMarginTop: 0 }}>
            <Container maxWidth={false} sx={{ maxWidth: 1200 }}>
                <Box sx={{ textAlign: 'center', maxWidth: 680, mx: 'auto', mb: 7 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.5)', mb: 1.5 }}>
                        HOW IT WORKS
                    </Typography>
                    <Typography component="h2" sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                        From an unfamiliar face to a record in your log.
                    </Typography>
                    <Typography sx={{ mt: 1.5, fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>
                        Four steps, and no one has to press anything.
                    </Typography>
                </Box>

                <Box sx={{ position: 'relative' }}>
                    <Box
                        sx={{
                            display: { xs: 'none', md: 'block' },
                            position: 'absolute', top: 28, left: '12%', right: '12%', height: '1px',
                            background: 'linear-gradient(90deg, #863BFF, #47BFFF)', opacity: 0.35,
                        }}
                    />
                    <Grid container spacing={4} sx={{ position: 'relative' }}>
                        {STEPS.map(({ icon: Icon, title, body }, index) => (
                            <Grid key={title} size={{ xs: 12, sm: 6, md: 3 }} sx={{ textAlign: { xs: 'left', md: 'center' } }}>
                                <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'center' }, mb: 2 }}>
                                    <Box sx={{ width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#1F2433', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}>
                                        <Icon />
                                    </Box>
                                </Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 800, ...gradientText, mb: 0.5 }}>
                                    {`0${index + 1}`}
                                </Typography>
                                <Typography sx={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{title}</Typography>
                                <Typography sx={{ mt: 1, fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.6)' }}>{body}</Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Container>
        </Box>
    );
}