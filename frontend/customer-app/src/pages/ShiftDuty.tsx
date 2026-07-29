import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert as MuiAlert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Paper,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import {
    AccessTime as TimeIcon,
    EventAvailable as DutyIcon,
    Notes as NotesIcon,
} from '@mui/icons-material';
import AlertCard from '../components/alerts/AlertCard';
import { updateAlertStatus } from '../api/alerts';
import { getCurrentDuty, getOnCallTasks } from '../api/onCall';
import { hasCustomerPermission, useCustomerAuth } from '../auth/CustomerAuthProvider';
import type { Alert, AlertStatus, AlertStatusFilter } from '../types/alert';
import type { CurrentDutyResponse, OnCallTasksResponse } from '../types/onCall';

const PAGE_SIZE = 50;
const TASK_POLL_INTERVAL_MS = 5_000;
const DUTY_POLL_INTERVAL_MS = 30_000;

function formatDate(value: string): string {
    return new Date(value).toLocaleString();
}

export default function ShiftDuty() {
    const navigate = useNavigate();
    const { user } = useCustomerAuth();
    const [tab, setTab] = useState<Extract<AlertStatusFilter, 'active' | 'resolved'>>('active');
    const [offset, setOffset] = useState(0);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [dutyRefreshVersion, setDutyRefreshVersion] = useState(0);
    const [duty, setDuty] = useState<CurrentDutyResponse | null>(null);
    const [tasks, setTasks] = useState<OnCallTasksResponse | null>(null);
    const [loadingDuty, setLoadingDuty] = useState(true);
    const [loadingTasks, setLoadingTasks] = useState(true);
    const [dutyError, setDutyError] = useState<string | null>(null);
    const [tasksError, setTasksError] = useState<string | null>(null);
    const [backgroundWarning, setBackgroundWarning] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const hasDutyData = useRef(false);
    const hasTaskData = useRef(false);
    const canWriteAlerts = hasCustomerPermission(user?.allowedPages, 'alerts', 'write');

    useEffect(() => {
        let active = true;
        let requestInFlight = false;
        let controller: AbortController | null = null;

        const loadDuty = async () => {
            if (requestInFlight) return;
            requestInFlight = true;
            const background = hasDutyData.current;
            controller = new AbortController();
            try {
                const nextDuty = await getCurrentDuty(controller.signal);
                if (active) {
                    hasDutyData.current = true;
                    setDuty(nextDuty);
                    setDutyError(null);
                    setBackgroundWarning(null);
                }
            } catch (requestError) {
                if (active && !controller.signal.aborted) {
                    const message = requestError instanceof Error ? requestError.message : 'Failed to load current duty';
                    if (background) setBackgroundWarning(message);
                    else setDutyError(message);
                }
            } finally {
                if (active && !background) setLoadingDuty(false);
                requestInFlight = false;
            }
        };

        void loadDuty();
        const intervalId = window.setInterval(() => void loadDuty(), DUTY_POLL_INTERVAL_MS);
        return () => {
            active = false;
            window.clearInterval(intervalId);
            controller?.abort();
        };
    }, [dutyRefreshVersion]);

    useEffect(() => {
        let active = true;
        let requestInFlight = false;
        let controller: AbortController | null = null;

        const loadTasks = async () => {
            if (requestInFlight) return;
            requestInFlight = true;
            const background = hasTaskData.current;
            controller = new AbortController();
            try {
                const nextTasks = await getOnCallTasks(
                    { status: tab, limit: PAGE_SIZE, offset },
                    controller.signal,
                );
                if (active) {
                    hasTaskData.current = true;
                    setTasks(nextTasks);
                    setTasksError(null);
                    setBackgroundWarning(null);
                }
            } catch (requestError) {
                if (active && !controller.signal.aborted) {
                    const message = requestError instanceof Error ? requestError.message : 'Failed to load assigned alerts';
                    if (background) setBackgroundWarning(message);
                    else setTasksError(message);
                }
            } finally {
                if (active && !background) setLoadingTasks(false);
                requestInFlight = false;
            }
        };

        void loadTasks();
        const intervalId = window.setInterval(() => void loadTasks(), TASK_POLL_INTERVAL_MS);
        return () => {
            active = false;
            window.clearInterval(intervalId);
            controller?.abort();
        };
    }, [offset, refreshVersion, tab]);

    const selectTab = useCallback((nextTab: Extract<AlertStatusFilter, 'active' | 'resolved'>) => {
        hasTaskData.current = false;
        setTasks(null);
        setLoadingTasks(true);
        setTasksError(null);
        setOffset(0);
        setTab(nextTab);
    }, []);

    const refreshTasks = useCallback(() => {
        setRefreshVersion((version) => version + 1);
    }, []);

    const changeStatus = async (
        alert: Alert,
        status: Extract<AlertStatus, 'IN_PROGRESS' | 'RESOLVED'>,
    ) => {
        if (!canWriteAlerts) return;
        setUpdatingId(alert.id);
        setActionError(null);
        try {
            await updateAlertStatus(alert.id, { status });
            refreshTasks();
        } catch (requestError) {
            setActionError(requestError instanceof Error ? requestError.message : 'Failed to update alert');
        } finally {
            setUpdatingId(null);
        }
    };

    const counts = tasks?.counts ?? { all: 0, active: 0, resolved: 0 };
    const alerts = tasks?.alerts ?? [];
    const pagination = tasks?.pagination;
    const hasPrevious = offset > 0;
    const hasNext = Boolean(pagination && pagination.offset + alerts.length < pagination.total);
    const loading = (loadingDuty && !duty) || (loadingTasks && !tasks);

    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>Shift Duty</Typography>

            {backgroundWarning && (
                <MuiAlert severity="warning" onClose={() => setBackgroundWarning(null)} sx={{ mb: 2 }}>
                    Could not refresh Shift Duty. Showing the latest available data; retrying automatically.
                </MuiAlert>
            )}
            {actionError && (
                <MuiAlert severity="error" onClose={() => setActionError(null)} sx={{ mb: 2 }}>
                    {actionError}
                </MuiAlert>
            )}

            <Paper
                elevation={0}
                sx={{
                    p: { xs: 2, sm: 2.5 },
                    mb: 3,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: duty?.isOnCall ? 'success.light' : 'divider',
                    bgcolor: duty?.isOnCall ? '#F2FAF5' : 'background.paper',
                }}
            >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <DutyIcon color={duty?.isOnCall ? 'success' : 'disabled'} />
                    <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography variant="h6" sx={{ fontWeight: 750 }}>Current Shift</Typography>
                            {duty?.isOnCall && <Chip label="On Duty" color="success" size="small" />}
                        </Stack>
                        {duty?.isOnCall && duty.currentShift ? (
                            <Stack spacing={1} sx={{ mt: 1.25 }}>
                                <Typography sx={{ fontWeight: 700 }}>{duty.currentShift.name}</Typography>
                                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                                    <TimeIcon sx={{ fontSize: 18 }} />
                                    <Typography variant="body2">
                                        {formatDate(duty.currentShift.startAt)} to {formatDate(duty.currentShift.endAt)}
                                    </Typography>
                                </Stack>
                                {duty.currentShift.notes && (
                                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start', color: 'text.secondary' }}>
                                        <NotesIcon sx={{ fontSize: 18, mt: '2px' }} />
                                        <Typography variant="body2">{duty.currentShift.notes}</Typography>
                                    </Stack>
                                )}
                            </Stack>
                        ) : duty ? (
                            <Typography color="text.secondary" sx={{ mt: 1 }}>
                                You are not currently on duty.
                            </Typography>
                        ) : dutyError ? (
                            <MuiAlert
                                severity="error"
                                sx={{ mt: 1 }}
                                action={
                                    <Button
                                        color="inherit"
                                        size="small"
                                        onClick={() => {
                                            setLoadingDuty(true);
                                            setDutyRefreshVersion((version) => version + 1);
                                        }}
                                    >
                                        Retry
                                    </Button>
                                }
                            >
                                Current duty could not be loaded.
                            </MuiAlert>
                        ) : null}
                    </Box>
                </Stack>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>My Tasks</Typography>
                <Tabs
                    value={tab}
                    onChange={(_, value: 'active' | 'resolved') => selectTab(value)}
                    aria-label="My Tasks status"
                >
                    <Tab value="active" label={`Active (${counts.active})`} />
                    <Tab value="resolved" label={`Resolved (${counts.resolved})`} />
                </Tabs>
            </Stack>
            <Divider sx={{ mb: 2 }} />

            {loading ? (
                <Stack sx={{ py: 6, alignItems: 'center' }} spacing={1.5}>
                    <CircularProgress size={30} />
                    <Typography color="text.secondary">Loading Shift Duty...</Typography>
                </Stack>
            ) : tasksError && !tasks ? (
                <MuiAlert severity="error" action={<Button color="inherit" size="small" onClick={refreshTasks}>Retry</Button>}>
                    {tasksError}
                </MuiAlert>
            ) : alerts.length === 0 ? (
                <Typography color="text.secondary">
                    {tab === 'active'
                        ? 'No active tasks assigned to you.'
                        : 'No resolved tasks assigned to you.'}
                </Typography>
            ) : (
                <>
                    <Stack spacing={2}>
                        {alerts.map((alert) => (
                            <AlertCard
                                key={alert.id}
                                alert={alert}
                                canManage={canWriteAlerts}
                                updating={updatingId === alert.id}
                                onViewDetails={() => navigate(`/alerts?alertId=${encodeURIComponent(alert.id)}`)}
                                onStartHandling={() => void changeStatus(alert, 'IN_PROGRESS')}
                                onResolve={() => void changeStatus(alert, 'RESOLVED')}
                            />
                        ))}
                    </Stack>
                    {(hasPrevious || hasNext) && (
                        <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                {offset + 1}-{offset + alerts.length} of {pagination?.total ?? 0}
                            </Typography>
                            <Button variant="outlined" disabled={!hasPrevious}
                                onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}>Previous</Button>
                            <Button variant="outlined" disabled={!hasNext}
                                onClick={() => setOffset((current) => current + PAGE_SIZE)}>Next</Button>
                        </Stack>
                    )}
                </>
            )}
        </Box>
    );
}
