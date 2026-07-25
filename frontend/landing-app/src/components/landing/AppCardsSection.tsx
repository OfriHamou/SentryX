import { Box, Container, Grid, Typography } from '@mui/material';
import { VideocamOutlined, GroupsOutlined, AdminPanelSettingsOutlined } from '@mui/icons-material';
import AppCard from './AppCard';
import type { AppCardProps } from './AppCard';
import { APP_URLS } from '../../config';

const APPS: AppCardProps[] = [
    {
        icon: VideocamOutlined,
        title: 'Customer App',
        who: 'For the security team watching the site.',
        bullets: [
            'Live 720p video with a joystick to drive the robot',
            'An event history you can narrow by date',
            'A media gallery of every captured frame',
            'Manage authorized faces and robot settings',
        ],
        href: APP_URLS.customer,
        accent: '#47BFFF',
        chip: 'Most people start here',
        featured: true,
    },
    {
        icon: GroupsOutlined,
        title: 'Organization Portal',
        who: "For your organization's own administrators.",
        bullets: [
            'Create users and assign roles and permissions',
            'Schedule, view and cancel guard shifts',
            "See who's on shift right now",
        ],
        href: APP_URLS.organization,
        accent: '#863BFF',
        note: 'Requires the organization_portal:read permission.',
    },
    {
        icon: AdminPanelSettingsOutlined,
        title: 'Admin Portal',
        who: 'For SentryX operators running the platform.',
        bullets: [
            'Tenants, licenses and platform analytics',
            'Approve or reject registration requests',
            'Global platform settings',
        ],
        href: APP_URLS.admin,
        accent: '#8B9BE8',
        chip: 'SentryX staff',
    },
];

export default function AppCardsSection() {
    return (
        <Box component="section" sx={{ bgcolor: '#fff', py: { xs: 8, md: 12 } }}>
            <Container maxWidth={false} sx={{ maxWidth: 1200 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', color: 'primary.dark', mb: 1.5 }}>
                    WHERE DO YOU WANT TO GO?
                </Typography>
                <Typography component="h2" sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }}>
                    Three doors, one platform.
                </Typography>
                <Typography sx={{ mt: 1.5, fontSize: 16, color: 'text.secondary', maxWidth: 620 }}>
                    Every SentryX deployment ships with three web apps. Pick the one that matches your role.
                </Typography>

                <Grid container spacing={3} sx={{ mt: 5 }}>
                    {APPS.map((app) => (
                        <Grid key={app.title} size={{ xs: 12, md: 4 }}>
                            <AppCard {...app} />
                        </Grid>
                    ))}
                </Grid>

                <Typography sx={{ mt: 5, fontSize: 14, color: 'text.secondary' }}>
                    No account yet? Sign up inside the Customer App with your organization's invite code —
                    an admin approves you and you're in.
                </Typography>
            </Container>
        </Box>
    );
}