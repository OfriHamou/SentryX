import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert as MuiAlert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import AlertCard from '../components/alerts/AlertCard';
import AiInsightPanel from '../components/alerts/AiInsightPanel';
import { getAlert, getAlerts, updateAlertStatus } from '../api/alerts';
import { eventDbImageUrl } from '../api/robot';
import { hasCustomerPermission, useCustomerAuth } from '../auth/CustomerAuthProvider';
import type { Alert, AlertsResponse, AlertStatus, AlertStatusFilter } from '../types/alert';

type TimeRange = '24h' | 'week' | 'month' | 'custom';

const PAGE_SIZE = 50;
const ALERT_POLL_INTERVAL_MS = 5_000;
const RANGE_MS: Record<Exclude<TimeRange, 'custom'>, number> = {
    '24h': 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
};

function getDateRange(timeRange: TimeRange, customFrom: string, customTo: string) {
    if (timeRange !== 'custom') {
        const to = new Date();
        return {
            from: new Date(to.getTime() - RANGE_MS[timeRange]).toISOString(),
            to: to.toISOString(),
            valid: true,
        };
    }

    const fromDate = customFrom ? new Date(`${customFrom}T00:00:00`) : undefined;
    const toDate = customTo ? new Date(`${customTo}T23:59:59.999`) : undefined;
    return {
        from: fromDate?.toISOString(),
        to: toDate?.toISOString(),
        valid: !fromDate || !toDate || fromDate <= toDate,
    };
}

function formatDate(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleString() : 'Not available';
}

function readableEventType(eventType: string): string {
    const readable = eventType.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    return readable ? readable.charAt(0).toUpperCase() + readable.slice(1) : 'Unknown event';
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ py: 0.75 }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 150 }}>{label}</Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
        </Stack>
    );
}

export default function Alerts() {
    const { user } = useCustomerAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const linkedAlertId = searchParams.get('alertId');
    const [status, setStatus] = useState<AlertStatusFilter>('all');
    const [timeRange, setTimeRange] = useState<TimeRange>('24h');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [offset, setOffset] = useState(0);
    const [reloadVersion, setReloadVersion] = useState(0);
    const [response, setResponse] = useState<AlertsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [backgroundError, setBackgroundError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [imageLoadFailed, setImageLoadFailed] = useState(false);
    const detailsRequestId = useRef(0);
    const hasAlertData = useRef(false);
    const loadedDeepLinkRef = useRef<string | null>(null);
    const canWriteAlerts = hasCustomerPermission(user?.allowedPages, 'alerts', 'write');

    const range = useMemo(
        () => getDateRange(timeRange, customFrom, customTo),
        [timeRange, customFrom, customTo],
    );

    const prepareForRequest = useCallback(() => {
        hasAlertData.current = false;
        setResponse(null);
        setError(null);
        setBackgroundError(null);
        setLoading(true);
    }, []);

    const refreshInBackground = useCallback(() => {
        setReloadVersion((version) => version + 1);
    }, []);

    const retryInitialLoad = useCallback(() => {
        prepareForRequest();
        setReloadVersion((version) => version + 1);
    }, [prepareForRequest]);

    useEffect(() => {
        if (!range.valid) return;

        let active = true;
        let requestInFlight = false;
        let controller: AbortController | null = null;

        const loadAlerts = async () => {
            if (requestInFlight) return;

            requestInFlight = true;
            const isBackgroundRefresh = hasAlertData.current;
            controller = new AbortController();
            const requestRange = getDateRange(timeRange, customFrom, customTo);

            try {
                const nextResponse = await getAlerts({
                    status,
                    from: requestRange.from,
                    to: requestRange.to,
                    limit: PAGE_SIZE,
                    offset,
                }, controller.signal);

                if (active) {
                    hasAlertData.current = true;
                    setResponse(nextResponse);
                    setError(null);
                    setBackgroundError(null);
                }
            } catch (requestError: unknown) {
                if (active && !controller.signal.aborted) {
                    const message = requestError instanceof Error ? requestError.message : 'Failed to load alerts';
                    if (isBackgroundRefresh) {
                        setBackgroundError(message);
                    } else {
                        setError(message);
                    }
                }
            } finally {
                if (active && !isBackgroundRefresh) setLoading(false);
                requestInFlight = false;
            }
        };

        void loadAlerts();
        const intervalId = window.setInterval(() => void loadAlerts(), ALERT_POLL_INTERVAL_MS);

        return () => {
            active = false;
            window.clearInterval(intervalId);
            controller?.abort();
        };
    }, [customFrom, customTo, offset, range.valid, reloadVersion, status, timeRange]);

    useEffect(() => {
        if (!linkedAlertId) {
            loadedDeepLinkRef.current = null;
            return;
        }
        if (loadedDeepLinkRef.current === linkedAlertId) return;

        loadedDeepLinkRef.current = linkedAlertId;
        const requestId = ++detailsRequestId.current;
        setDetailsLoading(true);
        setDetailsError(null);
        setActionError(null);
        setImageLoadFailed(false);

        void getAlert(linkedAlertId)
            .then((alert) => {
                if (detailsRequestId.current === requestId) setSelectedAlert(alert);
            })
            .catch((requestError: unknown) => {
                if (detailsRequestId.current === requestId) {
                    const message = requestError instanceof Error ? requestError.message : 'Linked alert could not be loaded';
                    setActionError(`Linked alert could not be opened: ${message}`);
                }
            })
            .finally(() => {
                if (detailsRequestId.current === requestId) setDetailsLoading(false);
            });
    }, [linkedAlertId]);

    const changeStatus = (nextStatus: AlertStatusFilter) => {
        prepareForRequest();
        setOffset(0);
        setStatus(nextStatus);
    };

    const changeTimeRange = (nextRange: TimeRange) => {
        prepareForRequest();
        setOffset(0);
        setTimeRange(nextRange);
    };

    const changeAlertStatus = async (
        alert: Alert,
        nextStatus: Extract<AlertStatus, 'IN_PROGRESS' | 'RESOLVED'>,
    ) => {
        if (!canWriteAlerts) return;
        setUpdatingId(alert.id);
        setActionError(null);
        try {
            const updated = await updateAlertStatus(alert.id, { status: nextStatus });
            if (selectedAlert?.id === updated.id) setSelectedAlert(updated);
            refreshInBackground();
        } catch (requestError) {
            setActionError(requestError instanceof Error ? requestError.message : 'Failed to update alert');
        } finally {
            setUpdatingId(null);
        }
    };

    const openDetails = async (alert: Alert) => {
        const requestId = ++detailsRequestId.current;
        setSelectedAlert(alert);
        setDetailsLoading(true);
        setDetailsError(null);
        setImageLoadFailed(false);
        try {
            const fullAlert = await getAlert(alert.id);
            if (detailsRequestId.current === requestId) setSelectedAlert(fullAlert);
        } catch (requestError) {
            if (detailsRequestId.current === requestId) {
                setDetailsError(requestError instanceof Error ? requestError.message : 'Failed to load alert details');
            }
        } finally {
            if (detailsRequestId.current === requestId) setDetailsLoading(false);
        }
    };

    const closeDetails = () => {
        detailsRequestId.current += 1;
        setSelectedAlert(null);
        setDetailsError(null);
        setDetailsLoading(false);
        setImageLoadFailed(false);
        loadedDeepLinkRef.current = null;
        if (searchParams.has('alertId')) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('alertId');
            setSearchParams(nextParams, { replace: true });
        }
    };

    const counts = response?.counts ?? { all: 0, active: 0, resolved: 0 };
    const tabs: { key: AlertStatusFilter; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: counts.all },
        { key: 'active', label: 'Active', count: counts.active },
        { key: 'resolved', label: 'Resolved', count: counts.resolved },
    ];
    const alerts = response?.alerts ?? [];
    const pagination = response?.pagination;
    const hasPrevious = offset > 0;
    const hasNext = Boolean(pagination && pagination.offset + alerts.length < pagination.total);
    const rangeError = range.valid ? null : 'The From date must be before the To date.';

    return (
        <Box>
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#E8EAEF', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Alerts &amp; Notifications</Typography>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}
                    sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                    <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                        {tabs.map((tab) => (
                            <Button key={tab.key} onClick={() => changeStatus(tab.key)} disableElevation
                                sx={{
                                    textTransform: 'none', borderRadius: 2, px: 2.5, fontWeight: 700,
                                    bgcolor: status === tab.key ? '#fff' : 'transparent',
                                    color: status === tab.key ? 'text.primary' : 'text.secondary',
                                    boxShadow: status === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                    '&:hover': { bgcolor: status === tab.key ? '#fff' : 'rgba(255,255,255,0.5)' },
                                }}>
                                {tab.label} ({tab.count})
                            </Button>
                        ))}
                    </Stack>

                    <FormControl size="small" sx={{ minWidth: 170 }}>
                        <Select value={timeRange} onChange={(event) => changeTimeRange(event.target.value as TimeRange)}
                            sx={{ bgcolor: '#fff', borderRadius: 2 }}>
                            <MenuItem value="24h">Last 24 hours</MenuItem>
                            <MenuItem value="week">Last week</MenuItem>
                            <MenuItem value="month">Last month</MenuItem>
                            <MenuItem value="custom">Custom</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>

                {timeRange === 'custom' && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                        <TextField type="date" size="small" label="From" value={customFrom}
                            onChange={(event) => { prepareForRequest(); setOffset(0); setCustomFrom(event.target.value); }}
                            slotProps={{ inputLabel: { shrink: true } }} sx={{ bgcolor: '#fff', borderRadius: 2 }} />
                        <TextField type="date" size="small" label="To" value={customTo}
                            onChange={(event) => { prepareForRequest(); setOffset(0); setCustomTo(event.target.value); }}
                            slotProps={{ inputLabel: { shrink: true } }} sx={{ bgcolor: '#fff', borderRadius: 2 }} />
                    </Stack>
                )}
            </Paper>

            {actionError && (
                <MuiAlert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
                    {actionError}
                </MuiAlert>
            )}

            {backgroundError && response && (
                <MuiAlert severity="warning" onClose={() => setBackgroundError(null)} sx={{ mb: 2 }}>
                    Could not refresh alerts. Showing the latest available data; retrying automatically.
                </MuiAlert>
            )}

            {rangeError ? (
                <MuiAlert severity="error">{rangeError}</MuiAlert>
            ) : loading ? (
                <Stack sx={{ py: 6, alignItems: 'center' }} spacing={1.5}>
                    <CircularProgress size={30} />
                    <Typography color="text.secondary">Loading alerts…</Typography>
                </Stack>
            ) : error ? (
                <MuiAlert severity="error" action={<Button color="inherit" size="small" onClick={retryInitialLoad}>Retry</Button>}>
                    {error}
                </MuiAlert>
            ) : alerts.length === 0 ? (
                <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <Typography color="text.secondary">
                        {counts.all === 0 ? 'No alerts found for the selected date range.' : 'No alerts matching the current filters.'}
                    </Typography>
                    {hasPrevious && (
                        <Button variant="outlined"
                            onClick={() => { prepareForRequest(); setOffset((current) => Math.max(0, current - PAGE_SIZE)); }}>
                            Previous page
                        </Button>
                    )}
                </Stack>
            ) : (
                <>
                    <Stack spacing={2}>
                        {alerts.map((alert) => (
                            <AlertCard
                                key={alert.id}
                                alert={alert}
                                canManage={canWriteAlerts}
                                updating={updatingId === alert.id}
                                onViewDetails={() => void openDetails(alert)}
                                onStartHandling={() => void changeAlertStatus(alert, 'IN_PROGRESS')}
                                onResolve={() => void changeAlertStatus(alert, 'RESOLVED')}
                            />
                        ))}
                    </Stack>

                    {(hasPrevious || hasNext) && (
                        <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                {offset + 1}–{offset + alerts.length} of {pagination?.total ?? 0}
                            </Typography>
                            <Button variant="outlined" disabled={!hasPrevious}
                                onClick={() => { prepareForRequest(); setOffset((current) => Math.max(0, current - PAGE_SIZE)); }}>Previous</Button>
                            <Button variant="outlined" disabled={!hasNext}
                                onClick={() => { prepareForRequest(); setOffset((current) => current + PAGE_SIZE); }}>Next</Button>
                        </Stack>
                    )}
                </>
            )}

            <Dialog open={Boolean(selectedAlert)} onClose={closeDetails} fullWidth maxWidth="md">
                <DialogTitle sx={{ fontWeight: 800 }}>
                    {selectedAlert?.displayTitle || (selectedAlert ? readableEventType(selectedAlert.event.eventType) : 'Alert details')}
                </DialogTitle>
                <DialogContent dividers>
                    {detailsLoading && (
                        <Stack direction="row" spacing={1.5} sx={{ py: 2, alignItems: 'center' }}>
                            <CircularProgress size={22} />
                            <Typography color="text.secondary">Loading full details…</Typography>
                        </Stack>
                    )}
                    {detailsError && <MuiAlert severity="warning" sx={{ mb: 2 }}>{detailsError}</MuiAlert>}
                    {selectedAlert && (
                        <Stack spacing={2}>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                <Chip
                                    label={selectedAlert.status === 'IN_PROGRESS' ? 'In progress' : selectedAlert.status === 'OPEN' ? 'Open' : 'Resolved'}
                                    color={selectedAlert.status === 'RESOLVED' ? 'success' : selectedAlert.status === 'IN_PROGRESS' ? 'info' : 'warning'}
                                    size="small"
                                />
                                {selectedAlert.assignedUser && (
                                    <Chip label={`Operator: ${selectedAlert.assignedUser.fullName || selectedAlert.assignedUser.email}`} size="small" />
                                )}
                            </Stack>

                            <Box>
                                <DetailRow label="Event type" value={readableEventType(selectedAlert.event.eventType)} />
                                <DetailRow label="Alert created" value={formatDate(selectedAlert.createdAt)} />
                                <DetailRow label="Event timestamp" value={formatDate(selectedAlert.event.createdAt)} />
                                <DetailRow label="Robot" value={selectedAlert.event.robot?.name || 'Not available'} />
                                <DetailRow label="Location" value={selectedAlert.event.robot?.location || 'Not available'} />
                                <DetailRow label="Event processing status" value={selectedAlert.event.status || 'Not available'} />
                                <DetailRow label="Started handling" value={formatDate(selectedAlert.startedAt)} />
                                <DetailRow label="Resolved" value={formatDate(selectedAlert.resolvedAt)} />
                                <DetailRow
                                    label="Assigned shift"
                                    value={selectedAlert.assignedShift
                                        ? `${selectedAlert.assignedShift.name} (${formatDate(selectedAlert.assignedShift.startAt)} – ${formatDate(selectedAlert.assignedShift.endAt)})`
                                        : 'Not assigned'}
                                />
                                <DetailRow label="Resolution notes" value={selectedAlert.resolutionNotes || 'None'} />
                            </Box>

                            <Divider />
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Event image</Typography>
                                {selectedAlert.event.imagePath && !imageLoadFailed ? (
                                    <Box
                                        component="img"
                                        src={eventDbImageUrl(selectedAlert.event.id)}
                                        alt={selectedAlert.displayTitle || 'Alert event'}
                                        onError={() => setImageLoadFailed(true)}
                                        sx={{
                                            display: 'block',
                                            width: '100%',
                                            maxHeight: 420,
                                            objectFit: 'contain',
                                            bgcolor: 'grey.100',
                                            borderRadius: 2,
                                        }}
                                    />
                                ) : (
                                    <Typography variant="body2" color="text.secondary">No event image is available.</Typography>
                                )}
                            </Box>

                            <Divider />
                            <AiInsightPanel
                                aiMetadata={selectedAlert.event.aiMetadata}
                                eventStatus={selectedAlert.event.status}
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    {selectedAlert && canWriteAlerts && selectedAlert.status === 'OPEN' && (
                        <Button disabled={updatingId === selectedAlert.id}
                            onClick={() => void changeAlertStatus(selectedAlert, 'IN_PROGRESS')}>Start Handling</Button>
                    )}
                    {selectedAlert && canWriteAlerts && selectedAlert.status !== 'RESOLVED' && (
                        <Button color="success" disabled={updatingId === selectedAlert.id}
                            onClick={() => void changeAlertStatus(selectedAlert, 'RESOLVED')}>Mark Resolved</Button>
                    )}
                    <Button onClick={closeDetails}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
