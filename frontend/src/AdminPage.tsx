import { useEffect, useState } from 'react';
import {
    Typography, Button, Box, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Select, MenuItem, FormControl, InputLabel,
    Card, CardContent, Chip, Tooltip, Dialog, DialogTitle,
    DialogContent, DialogActions, Divider, CircularProgress,
    Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton, Avatar, Grid
} from '@mui/material';
import {
    Delete as DeleteIcon,
    Edit as EditIcon,
    Settings as SettingsIcon,
    AddCircleOutlined as AddCircleOutlineIcon,
    Business as BusinessIcon,
    Block as BlockIcon,
    Dashboard as DashboardIcon,
    People as PeopleIcon,
    Assessment as AssessmentIcon,
    Notifications as NotificationsIcon,
    Memory as MemoryIcon,
    VerifiedUser as VerifiedUserIcon,
    TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import * as api from './api';
// @ts-ignore
import logoImg from './assets/LOGO.PNG';

const drawerWidth = 260;

// Helper to deterministically assign beautiful colors to License licenses based on string hash
const getLicenseColor = (code: string) => {
    const colors = [
        { bg: '#E6F9F5', color: '#05CD99', border: 'rgba(5, 205, 153, 0.2)' }, // Teal
        { bg: '#F4F7FE', color: '#4318FF', border: 'rgba(67, 24, 255, 0.2)' }, // Blue
        { bg: '#F3E8FF', color: '#7C3AED', border: 'rgba(124, 58, 237, 0.2)' }, // Purple
        { bg: '#FFF0F6', color: '#EC4899', border: 'rgba(236, 72, 153, 0.2)' }, // Pink
        { bg: '#FFF9E6', color: '#D97706', border: 'rgba(217, 119, 6, 0.2)' }, // Amber
        { bg: '#F0F9FF', color: '#0284C7', border: 'rgba(2, 132, 199, 0.2)' }, // Sky
    ];
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
        hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const isExpired = (dateString?: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
};

const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const AdminPage = () => {
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [alerts, setAlerts] = useState<any[]>([]);

    const [tenants, setTenants] = useState<any[]>([]);
    const [availableLicenses, setAvailableLicenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    // Modals state
    const [openAddModal, setOpenAddModal] = useState(false);
    const [openEditModal, setOpenEditModal] = useState<{ open: boolean, tenant: any }>({ open: false, tenant: null });
    const [openLicenseModal, setOpenLicenseModal] = useState<{ open: boolean, tenant: any }>({ open: false, tenant: null });
    // Form state
    const [tenantName, setTenantName] = useState('');
    const [selectedLicense, setSelectedLicense] = useState('');
    const [expirationDate, setExpirationDate] = useState('');
    useEffect(() => {
        loadData();
    }, []);
    const loadData = async () => {
        setLoading(true);
        try {
            const [tenantData, licenseData, alertsData] = await Promise.all([
                api.getTenants(),
                api.getLicenses(),
                api.getAlerts()
            ]);
            setTenants(tenantData);
            setAvailableLicenses(licenseData);
            setAlerts(alertsData || []);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };
    const handleCreateTenant = async () => {
        if (!tenantName) return;
        await api.createTenant(tenantName);
        setTenantName('');
        setOpenAddModal(false);
        loadData();
    };
    const handleEditTenant = async () => {
        if (!tenantName || !openEditModal.tenant) return;
        await api.updateTenant(openEditModal.tenant.id, tenantName);
        setTenantName('');
        setOpenEditModal({ open: false, tenant: null });
        loadData();
    };
    const handleDeleteTenant = async (id: string, name: string) => {
        if (window.confirm(`Are you sure you want to completely delete "${name}"? This action cannot be undone.`)) {
            await api.deleteTenant(id);
            loadData();
        }
    };
    const handleAddLicense = async () => {
        if (!selectedLicense || !openLicenseModal.tenant) return;
        try {
            await api.addTenantLicense(
                openLicenseModal.tenant.id,
                selectedLicense,
                expirationDate || undefined
            );
            setSelectedLicense('');
            setExpirationDate('');
            // Seamlessly update local modal state and background table without closing modal
            const updated = await api.getTenants();
            setTenants(updated);
            const t = updated.find((t: any) => t.id === openLicenseModal.tenant.id);
            setOpenLicenseModal({ open: true, tenant: t });
        } catch (e) {
            alert('Error mapping license. They might already possess it.');
        }
    };
    const handleRemoveLicense = async (licenseCode: string) => {
        if (!openLicenseModal.tenant) return;
        await api.removeTenantLicense(openLicenseModal.tenant.id, licenseCode);
        // Seamlessly update
        const updated = await api.getTenants();
        setTenants(updated);
        const t = updated.find((t: any) => t.id === openLicenseModal.tenant.id);
        setOpenLicenseModal({ open: true, tenant: t });
    };

    // Analytics calculations
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    const tenantsToday = tenants.filter(t => new Date(t.createdAt || 0) >= todayStart).length;
    const tenantsYesterday = tenants.filter(t => {
        const d = new Date(t.createdAt || 0);
        return d >= yesterdayStart && d < todayStart;
    }).length;

    const tenantGrowth = tenantsYesterday === 0
        ? (tenantsToday > 0 ? 100 : 0)
        : Math.round(((tenantsToday - tenantsYesterday) / tenantsYesterday) * 100);
    const tenantGrowthText = tenantGrowth >= 0 ? `+${tenantGrowth}% from yesterday` : `${tenantGrowth}% from yesterday`;
    const tenantGrowthColor = tenantGrowth >= 0 ? '#05CD99' : '#EE5D50';
    const tenantGrowthIcon = tenantGrowth >= 0 ? <TrendingUpIcon sx={{ fontSize: 14, color: tenantGrowthColor, mr: 0.5 }} /> : <TrendingUpIcon sx={{ fontSize: 14, color: tenantGrowthColor, mr: 0.5, transform: 'rotate(180deg)' }} />;

    const allLicenses = tenants.flatMap(t => t.tenantLicenses || []);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const licensesExpiringSoon = allLicenses.filter((l: any) => l.expirationDate && new Date(l.expirationDate) > now && new Date(l.expirationDate) <= nextMonth).length;
    const licenseSubtitle = licensesExpiringSoon > 0 ? "Expiring within 30 days" : "All licenses valid";
    const licenseSubtitleColor = licensesExpiringSoon > 0 ? '#EE5D50' : '#05CD99';

    const allRobots = tenants.flatMap(t => t.robots || []);
    const failedRobots = allRobots.filter(r => r.status && ['error', 'offline', 'failure', 'down'].includes(r.status.toLowerCase()));
    const robotSubtitle = failedRobots.length > 0 ? `${failedRobots.length} systems impaired` : 'All systems operational';
    const robotSubtitleColor = failedRobots.length > 0 ? '#EE5D50' : '#05CD99';

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f7fe', fontFamily: "'Inter', sans-serif" }}>
            {/* Dark Professional Sidebar Navigation */}
            <Drawer
                variant="permanent"
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', backgroundColor: '#1A1E29', color: '#fff', borderRight: 'none', boxShadow: '4px 0 20px rgba(0,0,0,0.05)' },
                }}
            >
                <Box sx={{ mb: 2, mt: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
                    <img src={logoImg} alt="SentryX Logo" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }} />
                </Box>
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 3, mt: 2 }} />
                <Box sx={{ overflow: 'auto', px: 2 }}>
                    <Typography variant="overline" sx={{ color: '#718096', px: 2, fontWeight: 700, mb: 1, display: 'block' }}>OVERVIEW</Typography>
                    <List>
                        {[
                          { text: 'Dashboard', icon: <DashboardIcon /> },
                          { text: 'Tenants', icon: <PeopleIcon /> },
                          { text: 'Analytics', icon: <AssessmentIcon /> }
                        ].map((item) => (
                            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    onClick={() => setActiveTab(item.text)}
                                    sx={{
                                    borderRadius: 2,
                                    backgroundColor: activeTab === item.text ? 'rgba(0, 114, 255, 0.15)' : 'transparent',
                                    color: activeTab === item.text ? '#0072FF' : '#a0aec0',
                                    '&:hover': { backgroundColor: activeTab === item.text ? 'rgba(0, 114, 255, 0.2)' : 'rgba(255,255,255,0.05)', color: activeTab === item.text ? '#0072FF' : '#fff' }
                                }}>
                                    <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText disableTypography primary={<Typography sx={{ fontWeight: activeTab === item.text ? 700 : 500, fontSize: '0.95rem' }}>{item.text}</Typography>} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                    <Typography variant="overline" sx={{ color: '#718096', px: 2, fontWeight: 700, mt: 3, mb: 1, display: 'block' }}>MANAGEMENT</Typography>
                    <List>
                        {[
                          { text: 'Alerts', icon: <NotificationsIcon /> },
                          { text: 'Settings', icon: <SettingsIcon /> }
                        ].map((item) => (
                            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    onClick={() => setActiveTab(item.text)}
                                    sx={{
                                    borderRadius: 2,
                                    backgroundColor: activeTab === item.text ? 'rgba(0, 114, 255, 0.15)' : 'transparent',
                                    color: activeTab === item.text ? '#0072FF' : '#a0aec0',
                                    '&:hover': { backgroundColor: activeTab === item.text ? 'rgba(0, 114, 255, 0.2)' : 'rgba(255,255,255,0.05)', color: activeTab === item.text ? '#0072FF' : '#fff' }
                                }}>
                                    <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText disableTypography primary={<Typography sx={{ fontWeight: activeTab === item.text ? 700 : 500, fontSize: '0.95rem' }}>{item.text}</Typography>} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </Box>
            </Drawer>
            {/* Main Content Workspace */}
            <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, width: `calc(100% - ${drawerWidth}px)`, backgroundColor: '#F4F7FE' }}>
                {/* Header Profile Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 5 }}>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: '#2B3674' }}>
                            {activeTab}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#A3AED0', fontWeight: 500, mt: 0.5 }}>
                            Welcome back, here is your {activeTab.toLowerCase()} overview.
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, backgroundColor: '#fff', p: 1, borderRadius: '30px', boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)' }}>
                        <IconButton sx={{ color: '#A3AED0', width: 40, height: 40 }}>
                            <NotificationsIcon />
                        </IconButton>
                        <Avatar sx={{ bgcolor: '#11047A', width: 40, height: 40, fontWeight: 'bold' }}>AD</Avatar>
                    </Box>
                </Box>

                {activeTab === 'Dashboard' && (
                    <>
                        {/* Dashboard Metric KPI Cards */}
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            {[
                                { title: 'Total Tenants', val: tenants.length.toString(), subtitle: tenantGrowthText, subtitleColor: tenantGrowthColor, trendIcon: tenantGrowthIcon, icon: <BusinessIcon sx={{ fontSize: 26, color: '#4318FF' }}/>, bg: '#F4F7FE' },
                                { title: 'Active Robots', val: allRobots.length.toString(), subtitle: robotSubtitle, subtitleColor: robotSubtitleColor, trendIcon: null, icon: <MemoryIcon sx={{ fontSize: 26, color: '#05CD99' }}/>, bg: '#E6F9F5' },
                                { title: 'Expiring Licenses', val: licensesExpiringSoon.toString(), subtitle: licenseSubtitle, subtitleColor: licenseSubtitleColor, trendIcon: null, icon: <VerifiedUserIcon sx={{ fontSize: 26, color: '#FFCE20' }}/>, bg: '#FFF9E6' },
                                { title: 'Critical Alerts', val: alerts.length.toString(), subtitle: 'Requires attention', subtitleColor: '#EE5D50', trendIcon: null, icon: <NotificationsIcon sx={{ fontSize: 26, color: '#EE5D50' }}/>, bg: '#FDECEB' }
                            ].map((stat, i) => (
                                <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={i}>
                                    <Card sx={{ borderRadius: '20px', boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)', border: 'none', height: '100%', backgroundColor: '#fff' }}>
                                        <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3, '&:last-child': { pb: 3 } }}>
                                            <Box sx={{ width: 56, height: 56, borderRadius: '50%', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                                                {stat.icon}
                                            </Box>
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 500, color: '#A3AED0', mb: 0.5 }}>{stat.title}</Typography>
                                                <Typography variant="h4" sx={{ fontWeight: 700, color: '#2B3674', mb: 0.5 }}>{loading ? '-' : stat.val}</Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                    {stat.trendIcon}
                                                    <Typography variant="caption" sx={{ fontWeight: 500, color: stat.subtitleColor }}>{stat.subtitle}</Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>

                        {/* Recent Unread Alerts */}
                        <Grid container spacing={3} sx={{ mb: 5 }}>
                            <Grid size={{ xs: 12 }}>
                                <Card sx={{ borderRadius: '20px', boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)', backgroundColor: '#fff', border: 'none' }}>
                                    <Box sx={{ p: 3, pt: 4, px: 4 }}>
                                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#2B3674' }}>
                                            Recent System Alerts
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#A3AED0', mt: 0.5, fontWeight: 500 }}>Unread alerts fetched from /api/alerts</Typography>
                                    </Box>
                                    <TableContainer component={Box} sx={{ px: 2, pb: 2, minHeight: 300 }}>
                                        <Table>
                                            <TableHead>
                                                <TableRow sx={{ '& th': { backgroundColor: '#fff', fontWeight: 600, color: '#A3AED0', py: 2.5, borderBottom: '1px solid #E2E8F0', fontSize: '0.8rem', letterSpacing: 0.5 } }}>
                                                    <TableCell width="15%">TIMESTAMP</TableCell>
                                                    <TableCell width="15%">TENANT</TableCell>
                                                    <TableCell width="15%">ROBOT ID</TableCell>
                                                    <TableCell width="15%">ROBOT NAME</TableCell>
                                                    <TableCell width="10%">SEVERITY</TableCell>
                                                    <TableCell width="30%">MESSAGE</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {alerts.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                                                            <NotificationsIcon sx={{ fontSize: 40, color: '#e2e8f0', mb: 1 }} />
                                                            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#718096' }}>No active alerts</Typography>
                                                            <Typography variant="body2" color="#a0aec0">System is running completely optimal.</Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    alerts.map((alert: any, i: number) => (
                                                        <TableRow key={i} hover sx={{ '& td': { borderBottom: '1px solid #F4F7FE', py: 2 } }}>
                                                            <TableCell sx={{ color: '#A3AED0', fontWeight: 500 }}>{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'N/A'}</TableCell>
                                                            <TableCell sx={{ color: '#2B3674', fontWeight: 600 }}>{alert.tenantName || alert.tenantId || 'N/A'}</TableCell>
                                                            <TableCell sx={{ color: '#A3AED0', fontFamily: "'Fira Code', monospace", fontSize: '0.85rem' }}>{alert.robotId || 'N/A'}</TableCell>
                                                            <TableCell sx={{ color: '#2B3674', fontWeight: 600 }}>{alert.robotName || 'N/A'}</TableCell>
                                                            <TableCell>
                                                                <Chip label={alert.severity || 'Low'} size="small" sx={{ fontWeight: 700, backgroundColor: alert.severity === 'Critical' ? '#FDECEB' : '#F4F7FE', color: alert.severity === 'Critical' ? '#EE5D50' : '#4318FF', borderRadius: '8px' }} />
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: '#2B3674' }}>{alert.message}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Card>
                            </Grid>
                        </Grid>
                    </>
                )}

                {activeTab === 'Tenants' && (
                    <Card sx={{ borderRadius: '20px', boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)', overflow: 'hidden', backgroundColor: '#fff', border: 'none' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pt: 4, px: 4, backgroundColor: '#fff' }}>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#2B3674' }}>
                                    Organizations Directory
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#A3AED0', mt: 0.5, fontWeight: 500 }}>Manage platform tenants and License sets</Typography>
                            </Box>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<AddCircleOutlineIcon />}
                                onClick={() => { setTenantName(''); setOpenAddModal(true); }}
                                sx={{ borderRadius: '12px', textTransform: 'none', px: 3, py: 1.5, backgroundColor: '#4318FF', boxShadow: '0 4px 12px rgba(67, 24, 255, 0.3)', fontWeight: 700, '&:hover': { backgroundColor: '#3311db' } }}
                            >
                                New Organization
                            </Button>
                        </Box>
                        <TableContainer component={Box} sx={{ maxHeight: 600, px: 2 }}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ '& th': { backgroundColor: '#fff', fontWeight: 600, color: '#A3AED0', py: 2.5, borderBottom: '1px solid #E2E8F0', fontSize: '0.8rem', letterSpacing: 0.5 } }}>
                                        <TableCell width="15%">ORGANIZATION</TableCell>
                                        <TableCell width="30%">TENANT ID</TableCell>
                                        <TableCell align="center" width="10%">ROBOTS</TableCell>
                                        <TableCell width="20%">LICENSES</TableCell>
                                        <TableCell align="right" width="25%">ACTIONS</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                                                <CircularProgress size={50} thickness={4} sx={{ color: '#4318FF' }} />
                                            </TableCell>
                                        </TableRow>
                                    ) : tenants.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                                                <BlockIcon sx={{ fontSize: 60, color: '#e2e8f0', mb: 2 }} />
                                                <Typography variant="h6" color="#718096" sx={{ fontWeight: 700}}>Datastore is empty</Typography>
                                                <Typography variant="body2" color="#a0aec0">Create your first organization to populate this view.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        tenants.map(tenant => (
                                            <TableRow key={tenant.id} hover sx={{ '& td': { borderBottom: '1px solid #F4F7FE', py: 2.5 } }}>
                                                <TableCell sx={{ fontWeight: 700, color: '#2B3674', fontSize: '0.95rem' }}>{tenant.name}</TableCell>
                                                <TableCell sx={{ color: '#A3AED0', fontFamily: "'Fira Code', monospace", fontSize: '0.8rem', fontWeight: 500 }}>{tenant.id}</TableCell>
                                                <TableCell align="center">
                                                    <Box sx={{ backgroundColor: tenant.robots?.length > 0 ? '#E6F9F5' : '#F4F7FE', color: tenant.robots?.length > 0 ? '#05CD99' : '#A3AED0', display: 'inline-flex', padding: '6px 16px', borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem' }}>
                                                        {tenant.robots?.length || 0}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                        {tenant.tenantLicenses?.length === 0 ? (
                                                            <Typography variant="body2" color="#A3AED0" sx={{ fontStyle: 'italic', fontSize: '0.85rem' }}>None Assigned</Typography>
                                                        ) : (
                                                            tenant.tenantLicenses?.map((tl: any) => {
                                                                const expired = isExpired(tl.expirationDate);
                                                                const style = expired
                                                                    ? { bg: '#FDECEB', color: '#EE5D50', border: 'rgba(238, 93, 80, 0.4)' }
                                                                    : getLicenseColor(tl.license.code);
                                                                return (
                                                                    <Chip
                                                                        key={tl.license.code}
                                                                        label={tl.license.code}
                                                                        size="small"
                                                                        sx={{
                                                                            fontWeight: 700,
                                                                            fontSize: '0.75rem',
                                                                            letterSpacing: 0.5,
                                                                            backgroundColor: style.bg,
                                                                            color: style.color,
                                                                            border: `1px solid ${style.border}`,
                                                                            borderRadius: '6px',
                                                                            px: 0.5
                                                                        }}
                                                                    />
                                                                );
                                                            })
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                    <Tooltip title="Manage Licenses">
                                                        <IconButton onClick={() => setOpenLicenseModal({ open: true, tenant })} sx={{ color: '#4318FF', mr: 1, '&:hover': { backgroundColor: '#F4F7FE' } }}>
                                                            <SettingsIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Edit">
                                                        <IconButton onClick={() => { setTenantName(tenant.name); setOpenEditModal({ open: true, tenant }); }} sx={{ color: '#A3AED0', mr: 1, '&:hover': { backgroundColor: '#F4F7FE' } }}>
                                                            <EditIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <IconButton onClick={() => handleDeleteTenant(tenant.id, tenant.name)} sx={{ color: '#EE5D50', '&:hover': { backgroundColor: '#FDECEB' } }}>
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                )}
            </Box>
            {/* Create / Edit / Manage Modals... (Preserved Logic, Polished Looks) */}
            {/* Create Tenant Dialog */}
            <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="sm" fullWidth>
                <Box sx={{ borderRadius: 4, p: 1 }}>
                    <DialogTitle sx={{ fontWeight: 800, color: '#2d3748', fontSize: '1.3rem' }}>Create Organization</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="#718096" sx={{ mb: 4 }}>
                            Create new customer within the platform.
                        </Typography>
                        <TextField
                            autoFocus fullWidth variant="outlined"
                            label="Organization Name" placeholder="Acme Corp"
                            value={tenantName} onChange={e => setTenantName(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={() => setOpenAddModal(false)} sx={{ color: '#718096', fontWeight: 700, textTransform: 'none' }}>Cancel</Button>
                        <Button onClick={handleCreateTenant} variant="contained" disabled={!tenantName} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3, backgroundColor: '#4318FF' }}>Create</Button>
                    </DialogActions>
                </Box>
            </Dialog>
            {/* Edit Tenant Dialog */}
            <Dialog open={openEditModal.open} onClose={() => setOpenEditModal({ open: false, tenant: null })} maxWidth="sm" fullWidth>
                <Box sx={{ borderRadius: 4, p: 1 }}>
                    <DialogTitle sx={{ fontWeight: 800, color: '#2d3748', fontSize: '1.3rem' }}>Edit Organization</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus fullWidth variant="outlined"
                            label="Organization Name"
                            value={tenantName} onChange={e => setTenantName(e.target.value)}
                            sx={{ mt: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button onClick={() => setOpenEditModal({ open: false, tenant: null })} sx={{ color: '#718096', fontWeight: 700, textTransform: 'none' }}>Cancel</Button>
                        <Button onClick={handleEditTenant} variant="contained" disabled={!tenantName} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3, backgroundColor: '#4318FF' }}>Save Changes</Button>
                    </DialogActions>
                </Box>
            </Dialog>
            {/* Manage Licenses Dialog */}
            <Dialog open={openLicenseModal.open} onClose={() => setOpenLicenseModal({ open: false, tenant: null })} maxWidth="md" fullWidth>
                <Box sx={{ borderRadius: 4, overflow: 'hidden' }}>
                    <Box sx={{ backgroundColor: '#f8fafc', px: 4, py: 3, borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: 40, height: 40, backgroundColor: '#e0e7ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                            <SettingsIcon sx={{ color: '#4318FF' }} />
                        </Box>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#2d3748' }}>License Control Center</Typography>
                            <Typography variant="body2" sx={{ color: '#718096', fontWeight: 500 }}>Configuring license for tenant: {openLicenseModal.tenant?.name}</Typography>
                        </Box>
                    </Box>
                    <DialogContent sx={{ p: 4 }}>
                        <Typography variant="overline" sx={{ fontWeight: 800, color: '#a0aec0', display: 'block', mb: 2 }}>ACTIVE SUBSCRIPTIONS</Typography>
                        {openLicenseModal.tenant?.tenantLicenses?.length === 0 ? (
                            <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: 3, border: '2px dashed #e2e8f0', mb: 4 }}>
                                <BlockIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 700}} color="#64748b">No Activated Licenses</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2, mb: 5 }}>
                                {openLicenseModal.tenant?.tenantLicenses?.map((tl: any) => {
                                    const expired = isExpired(tl.expirationDate);
                                    return (
                                        <Box key={tl.license.code} sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid', borderColor: expired ? 'rgba(238, 93, 80, 0.3)' : '#e2e8f0', borderRadius: 3, backgroundColor: expired ? '#FFF5F5' : '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                            <Box>
                                                <Typography variant="body1" sx={{ fontWeight: 800, color: expired ? '#EE5D50' : '#2d3748' }}>{tl.license.code}</Typography>
                                                {tl.expirationDate ? (
                                                    <Typography variant="caption" sx={{ color: expired ? '#EE5D50' : '#718096', fontWeight: 600, display: 'block', mt: 0.5 }}>
                                                        {expired ? 'Expired on: ' : 'Expires: '} {formatDate(tl.expirationDate)}
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="caption" sx={{ color: '#38A169', fontWeight: 600, display: 'block', mt: 0.5 }}>Lifetime Access</Typography>
                                                )}
                                            </Box>
                                            <IconButton size="small" onClick={() => handleRemoveLicense(tl.license.code)} sx={{ color: '#a0aec0', '&:hover': { color: '#E53E3E', backgroundColor: '#fff5f5' } }}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    );
                                })}
                            </Box>
                        )}
                        <Divider sx={{ my: 4 }} />
                        <Typography variant="overline" sx={{ fontWeight: 800, color: '#a0aec0', display: 'block', mb: 2 }}>GRANT NEW LICENSE</Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
                            <FormControl fullWidth size="medium">
                                <InputLabel>Select License</InputLabel>
                                <Select
                                    value={selectedLicense}
                                    label="Select License"
                                    onChange={e => setSelectedLicense(e.target.value)}
                                    sx={{ borderRadius: 2 }}
                                >
                                    {availableLicenses.map(l => {
                                        const hasLicense = openLicenseModal.tenant?.tenantLicenses?.some((tl: any) => tl.license.code === l.code);
                                        return (
                                            <MenuItem key={l.code} value={l.code} disabled={hasLicense}>
                                                <strong style={{ color: hasLicense ? '#a0aec0' : '#2d3748' }}>{l.code}</strong> <span style={{ color: '#a0aec0', marginLeft: '8px', fontSize: '0.9rem' }}>— {l.description || 'System License'}</span>
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                            <TextField
                                size="medium"
                                label="Expiry Deadline"
                                type="date"
                                slotProps={{ inputLabel: { shrink: true } }}
                                value={expirationDate}
                                onChange={e => setExpirationDate(e.target.value)}
                                sx={{ minWidth: '220px', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                helperText="Leave empty for lifetime access"
                            />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button
                                variant="contained"
                                onClick={handleAddLicense}
                                disabled={!selectedLicense || openLicenseModal.tenant?.tenantLicenses?.some((tl: any) => tl.license.code === selectedLicense)}
                                startIcon={<AddCircleOutlineIcon />}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 4, backgroundColor: '#10b981', '&:hover': { backgroundColor: '#059669' }, '&:disabled': { backgroundColor: '#e2e8f0' } }}
                            >
                                Activate License
                            </Button>
                        </Box>
                    </DialogContent>
                    <Box sx={{ p: 2, px: 4, borderTop: '1px solid #edf2f7', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={() => setOpenLicenseModal({ open: false, tenant: null })} sx={{ textTransform: 'none', fontWeight: 700, color: '#4a5568' }}>Close</Button>
                    </Box>
                </Box>
            </Dialog>
        </Box>
    );
};
