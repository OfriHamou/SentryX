import { Box, Container, Grid, Paper, Typography } from '@mui/material';
import { VideocamOutlined, SportsEsportsOutlined, FaceRetouchingNaturalOutlined, PhotoCameraOutlined, ManageAccountsOutlined, PhotoLibraryOutlined } from '@mui/icons-material';

const CAPABILITIES = [
    {
        icon: VideocamOutlined, tint: '#EEF0FB', color: '#6B7EE8',
        title: 'Live video streaming',
        body: "A live 720p stream from the robot's camera straight to your browser — no plugin, no install.",
    },
    {
        icon: SportsEsportsOutlined, tint: '#EAF2FE', color: '#3B82F6',
        title: 'Drive it from a browser',
        body: 'A touch joystick sends movement commands through the backend to the robot, from any device.',
    },
    {
        icon: FaceRetouchingNaturalOutlined, tint: '#F1E9FF', color: '#863BFF',
        title: 'Face recognition on the robot',
        body: 'The robot matches faces against your authorized list on-device, and updates the moment you change it.',
    },
    {
        icon: PhotoCameraOutlined, tint: '#FEF6E7', color: '#F59E0B',
        title: 'Events that file themselves',
        body: 'An unfamiliar face records an annotated frame automatically — at most one every ten seconds.',
    },
    {
        icon: ManageAccountsOutlined, tint: '#E9F9EF', color: '#22C55E',
        title: 'Roles, teams and shifts',
        body: 'A full role-and-permission system with user management and security shift scheduling.',
    },
    {
        icon: PhotoLibraryOutlined, tint: '#E7F7FF', color: '#47BFFF',
        title: 'Every frame, kept',
        body: 'Captured frames are stored and browsable in a media gallery you can narrow by date.',
    },
];

export default function CapabilitiesSection() {
    return (
        <Box component="section" sx={{ bgcolor: '#F3F4F6', py: { xs: 8, md: 12 } }}>
            <Container maxWidth={false} sx={{ maxWidth: 1200 }}>
                <Box sx={{ maxWidth: 680, mb: 6 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', color: 'primary.dark', mb: 1.5 }}>
                        WHAT IT ACTUALLY DOES
                    </Typography>
                    <Typography component="h2" sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
                        One platform for monitoring, control, and access management
                    </Typography>
                </Box>

                <Grid container spacing={3}>
                    {CAPABILITIES.map(({ icon: Icon, tint, color, title, body }) => (
                        <Grid key={title} size={{ xs: 12, sm: 6, md: 4 }}>
                            <Paper elevation={0} sx={{ p: 3, height: '100%', borderRadius: 3, border: '1px solid', borderColor: 'grey.200' }}>
                                <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: tint, color, mb: 2 }}>
                                    <Icon />
                                </Box>
                                <Typography sx={{ fontSize: 17, fontWeight: 700, color: 'text.primary' }}>{title}</Typography>
                                <Typography sx={{ mt: 1, fontSize: 14.5, lineHeight: 1.6, color: 'text.secondary' }}>{body}</Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Container>
        </Box>
    );
}