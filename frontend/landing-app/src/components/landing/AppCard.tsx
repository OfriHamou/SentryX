import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { ArrowForwardRounded, CheckRounded } from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';

export type AppCardProps = {
    icon: SvgIconComponent;
    title: string;
    who: string;
    bullets: string[];
    href: string;
    accent: string;
    chip?: string;
    note?: string;
    featured?: boolean;
};

export default function AppCard({ icon: Icon, title, who, bullets, href, accent, chip, note, featured }: AppCardProps) {
    return (
        <Paper
            elevation={0}
            sx={{
                p: 3.5, height: '100%', borderRadius: 3, 
                display: 'flex', flexDirection: 'column', 
                border: '1px solid',
                borderColor: featured ? 'rgba(134,59,255,0.35)' : 'grey.200',
                boxShadow: featured ? '0 18px 50px -24px rgba(134,59,255,0.45)' : 'none',
                transition: 'transform .22s ease, box-shadow .22s ease, border-color .22s ease',
                '&:hover': {
                    transform: 'translateY(-6px)',
                    borderColor: 'rgba(134,59,255,0.45)',
                    boxShadow: '0 26px 60px -26px rgba(126,20,255,0.42)',
                },
            }}
        >
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${accent}1A`, color: accent }}>
                    <Icon />
                </Box>
                {chip && (
                    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', px: 1.25, py: 0.5, borderRadius: 999, bgcolor: 'grey.100', color: 'text.secondary' }}>
                        {chip}
                    </Typography>
                )}
            </Stack>

            <Typography sx={{ fontSize: 21, fontWeight: 800, color: 'text.primary' }}>{title}</Typography>
            <Typography sx={{ mt: 0.75, fontSize: 14.5, color: 'text.secondary' }}>{who}</Typography>

            <Stack spacing={1.25} sx={{ mt: 3, flexGrow: 1 }}>
                {bullets.map((bullet) => (
                    <Stack key={bullet} direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                        <CheckRounded sx={{ fontSize: 17, color: accent, mt: '2px', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 14, lineHeight: 1.55, color: 'text.secondary' }}>{bullet}</Typography>
                    </Stack>
                ))}
            </Stack>

            <Button
                href={href}
                endIcon={<ArrowForwardRounded />}
                variant={featured ? 'contained' : 'outlined'}
                sx={{
                    mt: 3.5, py: 1.2, borderRadius: 2, fontWeight: 700, fontSize: 14.5, textTransform: 'none',
                    ...(featured
                        ? { color: '#fff', background: 'linear-gradient(120deg, #863BFF 0%, #47BFFF 100%)', '&:hover': { filter: 'brightness(1.08)' } }
                        : { color: 'text.primary', borderColor: 'grey.300', '&:hover': { borderColor: accent, bgcolor: `${accent}0D` } }),
                }}
            >
                Open {title}
            </Button>

            {note && (
                <Typography sx={{ mt: 1.5, fontSize: 12.5, color: 'text.disabled', textAlign: 'center' }}>
                    {note}
                </Typography>
            )}
        </Paper>
    );
}