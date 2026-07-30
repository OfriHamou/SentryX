import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
    Alert as MuiAlert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    CheckCircleOutlined,
    ContentCopy,
    ImageNotSupported,
    OpenInNew,
    Refresh,
    Schedule,
} from '@mui/icons-material';
import {
    getAdminAlert,
    getAdminAlertImage,
    getAdminAlerts,
    updateAdminAlertStatus,
} from '../api/adminAlerts';
import type {
    AdminAlert,
    AdminAlertCounts,
    AdminAlertsQueryParams,
    AdminAlertStatus,
    AdminAlertStatusFilter,
    AdminAlertTenant,
} from '../types/adminAlert';

interface AdminAlertsTabProps {
    canWrite: boolean;
    tenantOptions?: AdminAlertTenant[];
}

type TimeRange = 'all' | '24h' | '7d' | '30d' | 'custom';

const EMPTY_COUNTS: AdminAlertCounts = {
    all: 0,
    open: 0,
    inProgress: 0,
    active: 0,
    resolved: 0,
    tenantsWithActive: 0,
};

const PAGE_SIZE = 50;
const NO_TENANT_OPTIONS: AdminAlertTenant[] = [];

function errorMessage(error: unknown): string {
    if (axios.isAxiosError<{ error?: string; message?: string }>(error)) {
        return error.response?.data?.error || error.response?.data?.message || error.message;
    }
    return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function readableEventType(value: string | null | undefined): string {
    if (!value) return 'Unknown event type';
    return value
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function durationLabel(alert: AdminAlert): string {
    const start = new Date(alert.createdAt).getTime();
    const end = alert.status === 'RESOLVED' && alert.resolvedAt
        ? new Date(alert.resolvedAt).getTime()
        : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—';
    const minutes = Math.floor((end - start) / 60_000);
    if (minutes < 1) return '< 1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function statusChip(status: AdminAlertStatus) {
    const styles = {
        OPEN: { label: 'Open', color: '#C53030', backgroundColor: '#FFF5F5' },
        IN_PROGRESS: { label: 'In Progress', color: '#B7791F', backgroundColor: '#FFFAF0' },
        RESOLVED: { label: 'Resolved', color: '#047857', backgroundColor: '#ECFDF5' },
    }[status];
    return (
        <Chip
            size="small"
            label={styles.label}
            sx={{ fontWeight: 700, color: styles.color, backgroundColor: styles.backgroundColor }}
        />
    );
}

function metadataText(value: unknown): string {
    if (value === null || value === undefined) return 'No AI metadata available.';
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return JSON.stringify(parsed, null, 2);
    } catch {
        return typeof value === 'string' ? value : 'AI metadata could not be displayed.';
    }
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <Box>
            <Typography variant="caption" sx={{ color: '#A3AED0', fontWeight: 700, textTransform: 'uppercase' }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ color: '#2B3674', fontWeight: 600, mt: 0.4, overflowWrap: 'anywhere' }}>
                {value || '—'}
            </Typography>
        </Box>
    );
}

export const AdminAlertsTab = ({ canWrite, tenantOptions = NO_TENANT_OPTIONS }: AdminAlertsTabProps) => {
    const [status, setStatus] = useState<AdminAlertStatusFilter>('active');
    const [tenantId, setTenantId] = useState('');
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [offset, setOffset] = useState(0);
    const [alerts, setAlerts] = useState<AdminAlert[]>([]);
    const [counts, setCounts] = useState<AdminAlertCounts>(EMPTY_COUNTS);
    const [total, setTotal] = useState(0);
    const [discoveredTenants, setDiscoveredTenants] = useState<Map<string, AdminAlertTenant>>(new Map());
    const [rangeAnchor, setRangeAnchor] = useState(() => Date.now());
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [backgroundWarning, setBackgroundWarning] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [details, setDetails] = useState<AdminAlert | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageMissing, setImageMissing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [resolveAlert, setResolveAlert] = useState<AdminAlert | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [resolveError, setResolveError] = useState<string | null>(null);
    const [submittingResolve, setSubmittingResolve] = useState(false);
    const [actionId, setActionId] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const activeRequest = useRef<AbortController | null>(null);
    const requestNumber = useRef(0);
    const actionInProgress = useRef(false);
    const hasLoadedData = useRef(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setOffset(0);
        }, 400);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const query = useMemo<AdminAlertsQueryParams>(() => {
        const params: AdminAlertsQueryParams = {
            status,
            tenantId: tenantId || undefined,
            search: debouncedSearch || undefined,
            limit: PAGE_SIZE,
            offset,
        };
        if (timeRange !== 'all' && timeRange !== 'custom') {
            const duration = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
            params.from = new Date(rangeAnchor - duration * 86_400_000).toISOString();
        } else if (timeRange === 'custom') {
            if (customFrom) params.from = new Date(`${customFrom}T00:00:00`).toISOString();
            if (customTo) params.to = new Date(`${customTo}T23:59:59.999`).toISOString();
        }
        return params;
    }, [customFrom, customTo, debouncedSearch, offset, rangeAnchor, status, tenantId, timeRange]);

    const loadAlerts = useCallback(async (background = false) => {
        if (actionInProgress.current) return;
        activeRequest.current?.abort();
        const controller = new AbortController();
        activeRequest.current = controller;
        const requestId = ++requestNumber.current;

        if (background) {
            setRefreshing(true);
        } else if (!hasLoadedData.current) {
            setInitialLoading(true);
        }

        try {
            const result = await getAdminAlerts(query, controller.signal);
            if (requestId !== requestNumber.current) return;
            setAlerts(result.alerts);
            setCounts(result.counts);
            setTotal(result.pagination.total);
            hasLoadedData.current = true;
            setDiscoveredTenants((current) => {
                const next = new Map(current);
                result.alerts.forEach((item) => next.set(item.tenant.id, item.tenant));
                return next;
            });
            setError(null);
            setBackgroundWarning(null);
        } catch (loadError) {
            if (axios.isCancel(loadError) || requestId !== requestNumber.current) return;
            const message = errorMessage(loadError);
            if (hasLoadedData.current || background) {
                setBackgroundWarning(`Refresh failed: ${message}`);
            } else {
                setError(message);
            }
        } finally {
            if (requestId === requestNumber.current) {
                setInitialLoading(false);
                setRefreshing(false);
            }
        }
    }, [query]);

    useEffect(() => {
        // Initial/filter synchronization intentionally starts the remote query.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadAlerts(false);
        return () => activeRequest.current?.abort();
    }, [loadAlerts]);

    useEffect(() => {
        const interval = window.setInterval(() => void loadAlerts(true), 15_000);
        return () => window.clearInterval(interval);
    }, [loadAlerts]);

    useEffect(() => {
        if (!selectedId) {
            // Closing the dialog resets data owned by the previous selection.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDetails(null);
            setDetailsError(null);
            return;
        }
        const controller = new AbortController();
        setDetailsLoading(true);
        setDetailsError(null);
        getAdminAlert(selectedId, controller.signal)
            .then(setDetails)
            .catch((detailsLoadError) => {
                if (!axios.isCancel(detailsLoadError)) setDetailsError(errorMessage(detailsLoadError));
            })
            .finally(() => {
                if (!controller.signal.aborted) setDetailsLoading(false);
            });
        return () => controller.abort();
    }, [selectedId]);

    useEffect(() => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        // A changed Alert must never retain the prior authenticated Blob URL.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setImageUrl(null);
        setImageMissing(false);
        if (!selectedId || !details?.event?.imagePath) return;

        const controller = new AbortController();
        setImageLoading(true);
        getAdminAlertImage(selectedId, controller.signal)
            .then((blob) => {
                if (!controller.signal.aborted) setImageUrl(URL.createObjectURL(blob));
            })
            .catch((imageError) => {
                if (!axios.isCancel(imageError)) setImageMissing(true);
            })
            .finally(() => {
                if (!controller.signal.aborted) setImageLoading(false);
            });

        return () => controller.abort();
        // imageUrl is intentionally excluded: cleanup occurs before each new image and when the dialog closes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [details?.event?.imagePath, selectedId]);

    useEffect(() => () => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
    }, [imageUrl]);

    const applyUpdatedAlert = (updated: AdminAlert) => {
        setAlerts((current) => current.map((item) => item.id === updated.id ? updated : item));
        if (details?.id === updated.id) setDetails(updated);
    };

    const markInProgress = async (alert: AdminAlert) => {
        if (!canWrite || actionInProgress.current) return;
        actionInProgress.current = true;
        setActionId(alert.id);
        try {
            const updated = await updateAdminAlertStatus(alert.id, { status: 'IN_PROGRESS' });
            applyUpdatedAlert(updated);
            setSuccess('Alert marked In Progress.');
            actionInProgress.current = false;
            await loadAlerts(true);
        } catch (actionError) {
            setBackgroundWarning(errorMessage(actionError));
        } finally {
            actionInProgress.current = false;
            setActionId(null);
        }
    };

    const openResolve = (alert: AdminAlert) => {
        setResolveAlert(alert);
        setResolutionNotes(alert.resolutionNotes || '');
        setResolveError(null);
    };

    const submitResolve = async () => {
        if (!resolveAlert || submittingResolve) return;
        actionInProgress.current = true;
        setSubmittingResolve(true);
        setResolveError(null);
        try {
            const updated = await updateAdminAlertStatus(resolveAlert.id, {
                status: 'RESOLVED',
                resolutionNotes,
            });
            applyUpdatedAlert(updated);
            setResolveAlert(null);
            setResolutionNotes('');
            setSuccess('Alert marked Resolved.');
            actionInProgress.current = false;
            await loadAlerts(true);
        } catch (resolveFailure) {
            setResolveError(errorMessage(resolveFailure));
        } finally {
            actionInProgress.current = false;
            setSubmittingResolve(false);
        }
    };

    const sortedTenants = useMemo(() => {
        const options = new Map(discoveredTenants);
        tenantOptions.forEach((tenant) => options.set(tenant.id, tenant));
        return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [discoveredTenants, tenantOptions]);
    const firstDisplayed = total === 0 ? 0 : offset + 1;
    const lastDisplayed = Math.min(offset + alerts.length, total);
    const noPlatformAlerts = counts.all === 0
        && !tenantId
        && !debouncedSearch
        && timeRange === 'all';

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#2B3674' }}>Alerts Management</Typography>
                    <Typography variant="body1" sx={{ color: '#718096', mt: 0.5 }}>
                        Monitor and manage operational Alerts across all organizations.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={refreshing ? <CircularProgress size={17} color="inherit" /> : <Refresh />}
                    onClick={() => void loadAlerts(true)}
                    disabled={refreshing || Boolean(actionId) || submittingResolve}
                    sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, backgroundColor: '#4318FF' }}
                >
                    Refresh
                </Button>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, mb: 3 }}>
                {[
                    ['Total Alerts', counts.all],
                    ['Open', counts.open],
                    ['In Progress', counts.inProgress],
                    ['Resolved', counts.resolved],
                    ['Tenants With Active Alerts', counts.tenantsWithActive],
                ].map(([label, value]) => (
                    <Card key={String(label)} sx={{ borderRadius: '18px', boxShadow: '0 10px 30px rgba(112,144,176,.09)' }}>
                        <CardContent>
                            <Typography variant="body2" sx={{ color: '#A3AED0', fontWeight: 600 }}>{label}</Typography>
                            <Typography variant="h4" sx={{ color: '#2B3674', fontWeight: 800, mt: 1 }}>
                                {initialLoading ? '—' : value}
                            </Typography>
                        </CardContent>
                    </Card>
                ))}
            </Box>

            <Card sx={{ borderRadius: '20px', boxShadow: '0 10px 35px rgba(112,144,176,.1)', overflow: 'hidden' }}>
                <Box sx={{ px: 3, pt: 2 }}>
                    <Tabs
                        value={status}
                        onChange={(_, value: AdminAlertStatusFilter) => {
                            setStatus(value);
                            setOffset(0);
                        }}
                        variant="scrollable"
                        sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 } }}
                    >
                        <Tab value="all" label="All" />
                        <Tab value="active" label="Active" />
                        <Tab value="open" label="Open" />
                        <Tab value="in_progress" label="In Progress" />
                        <Tab value="resolved" label="Resolved" />
                    </Tabs>
                </Box>
                <Divider />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.2fr 1fr 2fr' }, gap: 2, p: 3 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Organization</InputLabel>
                        <Select
                            value={tenantId}
                            label="Organization"
                            onChange={(event) => {
                                setTenantId(event.target.value);
                                setOffset(0);
                            }}
                        >
                            <MenuItem value="">All Organizations</MenuItem>
                            {sortedTenants.map((tenant) => (
                                <MenuItem key={tenant.id} value={tenant.id}>{tenant.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth size="small">
                        <InputLabel>Time range</InputLabel>
                        <Select
                            value={timeRange}
                            label="Time range"
                            onChange={(event) => {
                                setTimeRange(event.target.value as TimeRange);
                                setRangeAnchor(Date.now());
                                setOffset(0);
                            }}
                        >
                            <MenuItem value="all">All time</MenuItem>
                            <MenuItem value="24h">Last 24 hours</MenuItem>
                            <MenuItem value="7d">Last 7 days</MenuItem>
                            <MenuItem value="30d">Last 30 days</MenuItem>
                            <MenuItem value="custom">Custom</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        label="Search Alerts"
                        placeholder="Tenant, Robot, location, Event type, operator, Alert ID"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value.slice(0, 100))}
                        helperText={`${searchInput.length}/100`}
                    />
                </Box>
                {timeRange === 'custom' && (
                    <Box sx={{ display: 'flex', gap: 2, px: 3, pb: 3, flexWrap: 'wrap' }}>
                        <TextField
                            size="small"
                            type="date"
                            label="From"
                            value={customFrom}
                            onChange={(event) => {
                                setCustomFrom(event.target.value);
                                setOffset(0);
                            }}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <TextField
                            size="small"
                            type="date"
                            label="To"
                            value={customTo}
                            onChange={(event) => {
                                setCustomTo(event.target.value);
                                setOffset(0);
                            }}
                            slotProps={{ inputLabel: { shrink: true } }}
                            error={Boolean(customFrom && customTo && customFrom > customTo)}
                            helperText={customFrom && customTo && customFrom > customTo ? 'From must not be later than To' : ''}
                        />
                    </Box>
                )}

                {backgroundWarning && (
                    <MuiAlert severity="warning" onClose={() => setBackgroundWarning(null)} sx={{ mx: 3, mb: 2 }}>
                        {backgroundWarning}
                    </MuiAlert>
                )}
                {error && !initialLoading && (
                    <MuiAlert
                        severity="error"
                        action={<Button color="inherit" onClick={() => void loadAlerts(false)}>Retry</Button>}
                        sx={{ mx: 3, mb: 2 }}
                    >
                        {error}
                    </MuiAlert>
                )}

                {initialLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
                ) : (
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ '& th': { color: '#A3AED0', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                                    <TableCell>Created</TableCell>
                                    <TableCell>Organization</TableCell>
                                    <TableCell>Alert</TableCell>
                                    <TableCell>Robot / Location</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Assigned To</TableCell>
                                    <TableCell>Age</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {alerts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 9 }}>
                                            <NotificationsEmptyIcon />
                                            <Typography variant="h6" sx={{ color: '#2B3674', fontWeight: 700, mt: 1 }}>
                                                {noPlatformAlerts ? 'No platform Alerts yet' : 'No Alerts match these filters'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#A3AED0', mt: 0.5 }}>
                                                {noPlatformAlerts
                                                    ? 'Operational Alerts will appear here when Events create them.'
                                                    : 'Adjust the status, organization, time range, or search.'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : alerts.map((alert) => (
                                    <TableRow key={alert.id} hover sx={{ '& td': { borderColor: '#F1F5F9', py: 2 } }}>
                                        <TableCell sx={{ whiteSpace: 'nowrap', color: '#475569' }}>{formatDateTime(alert.createdAt)}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#2B3674' }}>{alert.tenant.name}</Typography>
                                            <Typography variant="caption" sx={{ color: '#A3AED0' }}>{alert.tenant.id.slice(0, 8)}…</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#2B3674' }}>{alert.displayTitle}</Typography>
                                            <Typography variant="caption" sx={{ color: '#718096' }}>{readableEventType(alert.event?.eventType)}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2B3674' }}>{alert.event?.robot?.name || 'Robot unavailable'}</Typography>
                                            <Typography variant="caption" sx={{ color: '#718096' }}>{alert.event?.robot?.location || 'Location unavailable'}</Typography>
                                        </TableCell>
                                        <TableCell>{statusChip(alert.status)}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#2B3674' }}>
                                                {alert.assignedUser?.fullName || alert.assignedUser?.email || 'Unassigned'}
                                            </Typography>
                                            {alert.assignedUser?.fullName && (
                                                <Typography variant="caption" sx={{ color: '#718096' }}>{alert.assignedUser.email}</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{durationLabel(alert)}</TableCell>
                                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                            <Tooltip title="View Details">
                                                <IconButton onClick={() => setSelectedId(alert.id)} size="small"><OpenInNew /></IconButton>
                                            </Tooltip>
                                            {canWrite && alert.status === 'OPEN' && (
                                                <Button
                                                    size="small"
                                                    onClick={() => void markInProgress(alert)}
                                                    disabled={actionId === alert.id}
                                                    startIcon={actionId === alert.id ? <CircularProgress size={14} /> : <Schedule />}
                                                    sx={{ textTransform: 'none', fontWeight: 700 }}
                                                >
                                                    In Progress
                                                </Button>
                                            )}
                                            {canWrite && alert.status !== 'RESOLVED' && (
                                                <Button
                                                    size="small"
                                                    color="success"
                                                    onClick={() => openResolve(alert)}
                                                    startIcon={<CheckCircleOutlined />}
                                                    sx={{ textTransform: 'none', fontWeight: 700 }}
                                                >
                                                    Resolve
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, p: 2.5 }}>
                    <Typography variant="body2" sx={{ color: '#718096' }}>
                        {firstDisplayed}–{lastDisplayed} of {total}
                    </Typography>
                    <Button
                        disabled={offset === 0}
                        onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                        Previous
                    </Button>
                    <Button
                        disabled={offset + PAGE_SIZE >= total}
                        onClick={() => setOffset((current) => current + PAGE_SIZE)}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                        Next
                    </Button>
                </Box>
            </Card>

            <Dialog open={Boolean(selectedId)} onClose={() => setSelectedId(null)} fullWidth maxWidth="lg">
                <DialogTitle sx={{ pr: 7 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#2B3674' }}>
                        {details?.displayTitle || 'Alert Details'}
                    </Typography>
                    {details && <Box sx={{ mt: 1 }}>{statusChip(details.status)}</Box>}
                </DialogTitle>
                <DialogContent dividers>
                    {detailsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
                    ) : detailsError ? (
                        <MuiAlert severity="error">{detailsError}</MuiAlert>
                    ) : details && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#2B3674', mb: 2 }}>Alert & Organization</Typography>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                                        <DetailItem label="Organization" value={details.tenant.name} />
                                        <DetailItem label="Tenant ID" value={details.tenant.id} />
                                        <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <DetailItem label="Alert ID" value={details.id} />
                                            <Tooltip title={copied ? 'Copied' : 'Copy Alert ID'}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        void navigator.clipboard?.writeText(details.id);
                                                        setCopied(true);
                                                        window.setTimeout(() => setCopied(false), 1500);
                                                    }}
                                                >
                                                    <ContentCopy fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                        <DetailItem label="Created" value={formatDateTime(details.createdAt)} />
                                        <DetailItem label="Started" value={formatDateTime(details.startedAt)} />
                                        <DetailItem label="Resolved" value={formatDateTime(details.resolvedAt)} />
                                        <DetailItem label="Age / Duration" value={durationLabel(details)} />
                                    </Box>
                                </CardContent>
                            </Card>
                            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#2B3674', mb: 2 }}>Event & Robot</Typography>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                                        <DetailItem label="Event Type" value={readableEventType(details.event?.eventType)} />
                                        <DetailItem label="Event Timestamp" value={formatDateTime(details.event?.createdAt)} />
                                        <DetailItem label="Event Status" value={details.event?.status || 'Unavailable'} />
                                        <DetailItem label="Robot Status" value={details.event?.robot?.status || 'Unavailable'} />
                                        <DetailItem label="Robot Name" value={details.event?.robot?.name || 'Unavailable'} />
                                        <DetailItem label="Robot ID" value={details.event?.robot?.id || 'Unavailable'} />
                                        <DetailItem label="Location" value={details.event?.robot?.location || 'Unavailable'} />
                                    </Box>
                                </CardContent>
                            </Card>
                            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#2B3674', mb: 2 }}>Assignment & Resolution</Typography>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2 }}>
                                        <DetailItem
                                            label="Assigned Operator"
                                            value={details.assignedUser
                                                ? `${details.assignedUser.fullName || 'Unnamed'} (${details.assignedUser.email})`
                                                : 'Unassigned'}
                                        />
                                        <DetailItem
                                            label="Assigned Shift"
                                            value={details.assignedShift
                                                ? `${details.assignedShift.name} · ${formatDateTime(details.assignedShift.startAt)} – ${formatDateTime(details.assignedShift.endAt)}`
                                                : 'No shift assigned'}
                                        />
                                        <DetailItem
                                            label="Resolved By"
                                            value={details.resolvedBy
                                                ? `${details.resolvedBy.fullName || 'Unnamed'} (${details.resolvedBy.email})`
                                                : '—'}
                                        />
                                        <Box sx={{ gridColumn: '1 / -1' }}>
                                            <DetailItem label="Resolution Notes" value={details.resolutionNotes || 'No resolution notes.'} />
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#2B3674', mb: 2 }}>Event Image</Typography>
                                    <Box sx={{ minHeight: 220, borderRadius: 2, backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        {imageLoading ? <CircularProgress /> : imageUrl ? (
                                            <Box component="img" src={imageUrl} alt="Alert Event" sx={{ width: '100%', maxHeight: 420, objectFit: 'contain' }} />
                                        ) : (
                                            <Box sx={{ textAlign: 'center', color: '#A3AED0', p: 3 }}>
                                                <ImageNotSupported sx={{ fontSize: 48 }} />
                                                <Typography variant="body2" sx={{ mt: 1 }}>
                                                    {imageMissing || !details.event?.imagePath ? 'No Event image is available.' : 'Image unavailable.'}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                            <Card variant="outlined" sx={{ borderRadius: 3, gridColumn: { md: '1 / -1' } }}>
                                <CardContent>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#2B3674', mb: 2 }}>AI Metadata</Typography>
                                    <Box component="pre" sx={{ m: 0, p: 2, overflow: 'auto', borderRadius: 2, backgroundColor: '#111827', color: '#E5E7EB', fontSize: 13 }}>
                                        {metadataText(details.event?.aiMetadata)}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    {canWrite && details?.status === 'OPEN' && (
                        <Button onClick={() => void markInProgress(details)} disabled={actionId === details.id}>Mark In Progress</Button>
                    )}
                    {canWrite && details && details.status !== 'RESOLVED' && (
                        <Button color="success" onClick={() => openResolve(details)}>Resolve</Button>
                    )}
                    <Button onClick={() => setSelectedId(null)}>Close</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(resolveAlert)} onClose={() => !submittingResolve && setResolveAlert(null)} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontWeight: 800, color: '#2B3674' }}>Mark Alert Resolved?</DialogTitle>
                <DialogContent>
                    {resolveAlert && (
                        <Box sx={{ display: 'grid', gap: 1, mb: 3 }}>
                            <DetailItem label="Alert" value={resolveAlert.displayTitle} />
                            <DetailItem label="Organization" value={resolveAlert.tenant.name} />
                            <DetailItem label="Robot" value={resolveAlert.event?.robot?.name || 'Unavailable'} />
                            <Box>{statusChip(resolveAlert.status)}</Box>
                        </Box>
                    )}
                    <TextField
                        fullWidth
                        multiline
                        minRows={4}
                        label="Resolution Notes (optional)"
                        value={resolutionNotes}
                        onChange={(event) => setResolutionNotes(event.target.value.slice(0, 1000))}
                        helperText={`${resolutionNotes.length}/1,000`}
                        disabled={submittingResolve}
                    />
                    {resolveError && <MuiAlert severity="error" sx={{ mt: 2 }}>{resolveError}</MuiAlert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResolveAlert(null)} disabled={submittingResolve}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => void submitResolve()}
                        disabled={submittingResolve}
                        startIcon={submittingResolve ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlined />}
                    >
                        Mark Resolved
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(success)} autoHideDuration={3500} onClose={() => setSuccess(null)}>
                <MuiAlert severity="success" variant="filled" onClose={() => setSuccess(null)}>{success}</MuiAlert>
            </Snackbar>
        </Box>
    );
};

function NotificationsEmptyIcon() {
    return <ImageNotSupported sx={{ fontSize: 52, color: '#CBD5E1' }} />;
}
