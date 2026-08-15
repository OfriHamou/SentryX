import { Box, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import { AdminPanelSettings, InfoOutlined, Security } from '@mui/icons-material';
import { hasPermission, useAuth } from '../auth/AuthContext';

export const AdminSettings = () => {
    const { user } = useAuth();
    const canRead = (resource: string) => hasPermission(user?.allowedPages, resource, 'read');
    const permissionSummary = [
        { label: 'Dashboard', enabled: canRead('dashboard') || canRead('tenants') || canRead('licenses') || canRead('admin_alerts') },
        { label: 'Tenants', enabled: canRead('tenants') },
        { label: 'Registration Requests', enabled: canRead('registration_requests') },
        { label: 'Licenses', enabled: canRead('licenses') },
        { label: 'Analytics', enabled: canRead('admin_analytics') },
        { label: 'Alerts', enabled: canRead('admin_alerts') },
        { label: 'Settings', enabled: canRead('settings') || canRead('roles') },
    ];

    const administratorDetails = [
        user?.fullName ? { label: 'Full Name', value: user.fullName } : null,
        user?.email ? { label: 'Email', value: user.email } : null,
        user?.roleName ? { label: 'Role', value: user.roleName } : null,
        user?.id ? { label: 'User ID', value: user.id } : null,
    ].filter((detail): detail is { label: string; value: string } => detail !== null);

    return (
        <Stack spacing={3}>
            <Card sx={{ borderRadius: '20px', boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)', overflow: 'hidden', backgroundColor: '#fff', border: 'none' }}>
                <Box sx={{ px: { xs: 3, md: 4 }, py: 3, borderBottom: '1px solid #E2E8F0' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#2B3674' }}>
                        Settings
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#A3AED0', mt: 0.5, fontWeight: 500 }}>
                        Read-only platform and administrator access information.
                    </Typography>
                </Box>

                <Stack spacing={3} sx={{ px: { xs: 3, md: 4 }, py: 4 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 3 }}>
                        <Box sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: '#F4F7FE', display: 'flex', gap: 2 }}>
                            <Box sx={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: '#E9E3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <InfoOutlined sx={{ color: '#4318FF' }} />
                            </Box>
                            <Box>
                                <Typography variant="overline" sx={{ color: '#A3AED0', fontWeight: 800 }}>
                                    PLATFORM
                                </Typography>
                                <Typography variant="h6" sx={{ color: '#2B3674', fontWeight: 800 }}>
                                    SentryX
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>
                                    Administration Portal
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: '#FFFFFF', display: 'flex', gap: 2 }}>
                            <Box sx={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: '#E6F9F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AdminPanelSettings sx={{ color: '#05CD99' }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="overline" sx={{ color: '#A3AED0', fontWeight: 800 }}>
                                    CURRENT ADMINISTRATOR
                                </Typography>
                                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                                    {administratorDetails.map(detail => (
                                        <Typography key={detail.label} variant="body2" sx={{ color: '#718096', overflowWrap: 'anywhere' }}>
                                            <Box component="span" sx={{ color: '#2B3674', fontWeight: 700 }}>{detail.label}:</Box> {detail.value}
                                        </Typography>
                                    ))}
                                </Stack>
                            </Box>
                        </Box>
                    </Box>

                    <Divider />

                    <Box sx={{ p: 3, border: '1px solid #E2E8F0', borderRadius: '16px', backgroundColor: '#FFFFFF' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Box sx={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: '#FFF9E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Security sx={{ color: '#D97706' }} />
                            </Box>
                            <Box>
                                <Typography variant="h6" sx={{ color: '#2B3674', fontWeight: 800 }}>
                                    Admin Access Summary
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A3AED0', fontWeight: 500 }}>
                                    Read access available to the current administrator.
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {permissionSummary.map(permission => (
                                <Chip
                                    key={permission.label}
                                    label={`${permission.label}: ${permission.enabled ? 'Yes' : 'No'}`}
                                    sx={{
                                        fontWeight: 700,
                                        borderRadius: '8px',
                                        backgroundColor: permission.enabled ? '#E6F9F5' : '#F4F7FE',
                                        color: permission.enabled ? '#05CD99' : '#A3AED0',
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                </Stack>
            </Card>
        </Stack>
    );
};
