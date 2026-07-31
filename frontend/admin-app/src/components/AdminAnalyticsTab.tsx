import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    AccessTime,
    CheckCircleOutlined,
    Face,
    HelpOutlined,
    Memory,
    Refresh,
    ReportProblemOutlined,
} from '@mui/icons-material';
import { getAdminAnalytics } from '../api/adminAnalytics';
import type {
    AdminAnalyticsQueryParams,
    AdminAnalyticsResponse,
    AnalyticsTenantOption,
} from '../types/adminAnalytics';

interface AdminAnalyticsTabProps {
    tenantOptions?: AnalyticsTenantOption[];
}

type DatePreset = '24h' | '7d' | '30d' | 'all' | 'custom';

const EMPTY_TENANTS: AnalyticsTenantOption[] = [];
const CARD_STYLE = {
    borderRadius: '20px',
    boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)',
    backgroundColor: '#fff',
};

function percent(value: number | null): string {
    return value === null ? 'N/A' : `${value.toFixed(1)}%`;
}

function minutes(value: number | null): string {
    return value === null ? 'N/A' : `${value.toFixed(1)} min`;
}

function dateTime(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString();
}

function apiError(error: unknown): string {
    if (axios.isAxiosError<{ error?: string; message?: string }>(error)) {
        return error.response?.data?.error || error.response?.data?.message || error.message;
    }
    return error instanceof Error ? error.message : 'Unable to load Analytics.';
}

function rangeParams(
    preset: DatePreset,
    anchor: number,
    customFrom: string,
    customTo: string,
): { params: Pick<AdminAnalyticsQueryParams, 'from' | 'to'>; error: string | null } {
    if (preset === 'all') return { params: {}, error: null };
    if (preset === 'custom') {
        if (!customFrom || !customTo) {
            return { params: {}, error: 'Choose both From and To dates for a custom range.' };
        }
        const from = new Date(`${customFrom}T00:00:00`);
        const to = new Date(`${customTo}T23:59:59.999`);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            return { params: {}, error: 'Enter valid From and To dates.' };
        }
        if (from > to) {
            return { params: {}, error: 'From date must be earlier than or equal to To date.' };
        }
        return {
            params: { from: from.toISOString(), to: to.toISOString() },
            error: null,
        };
    }
    const days = preset === '24h' ? 1 : preset === '7d' ? 7 : 30;
    return {
        params: {
            from: new Date(anchor - days * 86_400_000).toISOString(),
            to: new Date(anchor).toISOString(),
        },
        error: null,
    };
}

function MetricCard({
    title,
    value,
    secondary,
    icon,
}: {
    title: string;
    value: string;
    secondary: string;
    icon: React.ReactNode;
}) {
    return (
        <Card sx={{ ...CARD_STYLE, height: '100%' }}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Box>
                        <Typography variant="body2" sx={{ color: '#A3AED0', fontWeight: 700 }}>
                            {title}
                        </Typography>
                        <Typography variant="h4" sx={{ color: '#2B3674', fontWeight: 800, my: 1 }}>
                            {value}
                        </Typography>
                    </Box>
                    <Box sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        bgcolor: '#F4F7FE',
                        color: '#4318FF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        {icon}
                    </Box>
                </Box>
                <Typography variant="caption" sx={{ color: '#718096' }}>{secondary}</Typography>
            </CardContent>
        </Card>
    );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Card sx={{ ...CARD_STYLE, height: '100%' }}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                <Typography variant="h6" sx={{ color: '#2B3674', fontWeight: 800, mb: 2.5 }}>
                    {title}
                </Typography>
                {children}
            </CardContent>
        </Card>
    );
}

function TwoPartBar({
    firstLabel,
    firstCount,
    firstPercent,
    secondLabel,
    secondCount,
    secondPercent,
}: {
    firstLabel: string;
    firstCount: number;
    firstPercent: number | null;
    secondLabel: string;
    secondCount: number;
    secondPercent: number | null;
}) {
    const firstWidth = firstPercent ?? 0;
    const secondWidth = secondPercent ?? 0;
    return (
        <Box>
            <Box
                role="img"
                aria-label={`${firstLabel}: ${firstCount}, ${percent(firstPercent)}. ${secondLabel}: ${secondCount}, ${percent(secondPercent)}.`}
                sx={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', bgcolor: '#EDF2F7', mb: 2 }}
            >
                <Tooltip title={`${firstLabel}: ${firstCount} (${percent(firstPercent)})`}>
                    <Box sx={{ width: `${firstWidth}%`, bgcolor: '#4318FF' }} />
                </Tooltip>
                <Tooltip title={`${secondLabel}: ${secondCount} (${percent(secondPercent)})`}>
                    <Box sx={{ width: `${secondWidth}%`, bgcolor: '#A78BFA' }} />
                </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ color: '#2B3674', fontWeight: 700 }}>
                    <Box component="span" sx={{ color: '#4318FF' }}>●</Box> {firstLabel}: {firstCount} ({percent(firstPercent)})
                </Typography>
                <Typography variant="body2" sx={{ color: '#2B3674', fontWeight: 700 }}>
                    <Box component="span" sx={{ color: '#A78BFA' }}>●</Box> {secondLabel}: {secondCount} ({percent(secondPercent)})
                </Typography>
            </Box>
        </Box>
    );
}

function StatLine({ label, value }: { label: string; value: string | number }) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.75 }}>
            <Typography variant="body2" sx={{ color: '#718096' }}>{label}</Typography>
            <Typography variant="body2" sx={{ color: '#2B3674', fontWeight: 800, textAlign: 'right' }}>{value}</Typography>
        </Box>
    );
}

export const AdminAnalyticsTab = ({ tenantOptions = EMPTY_TENANTS }: AdminAnalyticsTabProps) => {
    const [preset, setPreset] = useState<DatePreset>('30d');
    const [tenantId, setTenantId] = useState('');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [anchor, setAnchor] = useState(() => Date.now());
    const [data, setData] = useState<AdminAnalyticsResponse | null>(null);
    const [discoveredTenants, setDiscoveredTenants] = useState<AnalyticsTenantOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestRef = useRef<AbortController | null>(null);

    const range = useMemo(
        () => rangeParams(preset, anchor, customFrom, customTo),
        [anchor, customFrom, customTo, preset],
    );
    const query = useMemo<AdminAnalyticsQueryParams>(() => ({
        tenantId: tenantId || undefined,
        ...range.params,
    }), [range.params, tenantId]);

    const load = useCallback(async () => {
        requestRef.current?.abort();
        if (range.error) {
            setData(null);
            setLoading(false);
            setError(range.error);
            return;
        }
        const controller = new AbortController();
        requestRef.current = controller;
        setData(null);
        setError(null);
        setLoading(true);
        try {
            const result = await getAdminAnalytics(query, controller.signal);
            if (!controller.signal.aborted) {
                setData(result);
                setDiscoveredTenants((current) => {
                    const values = new Map(current.map((tenant) => [tenant.id, tenant]));
                    result.organizations.forEach((organization) => values.set(organization.tenantId, {
                        id: organization.tenantId,
                        name: organization.tenantName,
                    }));
                    return [...values.values()];
                });
            }
        } catch (loadError) {
            if (!axios.isCancel(loadError) && !controller.signal.aborted) setError(apiError(loadError));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [query, range.error]);

    useEffect(() => {
        // Filter changes intentionally synchronize the workspace with the remote Analytics projection.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load();
        return () => requestRef.current?.abort();
    }, [load]);

    const availableTenants = useMemo(() => {
        const values = new Map(
            [...tenantOptions, ...discoveredTenants].map((tenant) => [tenant.id, tenant]),
        );
        return [...values.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [discoveredTenants, tenantOptions]);

    const refresh = () => {
        setAnchor(Date.now());
    };

    const isEmpty = Boolean(data)
        && data!.totals.totalEvents === 0
        && data!.totals.totalAlerts === 0
        && data!.totals.activeRobots === 0;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Box>
                    <Typography variant="h4" sx={{ color: '#2B3674', fontWeight: 800 }}>
                        Performance Analytics
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#718096', mt: 0.75, maxWidth: 760 }}>
                        Review recognition, Alert handling, Robot availability, and detection activity across all organizations.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
                    onClick={refresh}
                    disabled={loading}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                >
                    Refresh
                </Button>
            </Box>

            <Card sx={{ ...CARD_STYLE, mb: 3 }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 180 }}>
                            <InputLabel id="analytics-range-label">Date Range</InputLabel>
                            <Select
                                labelId="analytics-range-label"
                                value={preset}
                                label="Date Range"
                                onChange={(event) => setPreset(event.target.value as DatePreset)}
                            >
                                <MenuItem value="24h">Last 24 Hours</MenuItem>
                                <MenuItem value="7d">Last 7 Days</MenuItem>
                                <MenuItem value="30d">Last 30 Days</MenuItem>
                                <MenuItem value="all">All Time</MenuItem>
                                <MenuItem value="custom">Custom</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 220, flexGrow: { xs: 1, sm: 0 } }}>
                            <InputLabel id="analytics-tenant-label">Organization</InputLabel>
                            <Select
                                labelId="analytics-tenant-label"
                                value={tenantId}
                                label="Organization"
                                onChange={(event) => setTenantId(event.target.value)}
                            >
                                <MenuItem value="">All Organizations</MenuItem>
                                {availableTenants.map((tenant) => (
                                    <MenuItem key={tenant.id} value={tenant.id}>{tenant.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        {preset === 'custom' && (
                            <>
                                <TextField
                                    size="small"
                                    type="date"
                                    label="From"
                                    value={customFrom}
                                    onChange={(event) => setCustomFrom(event.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                                <TextField
                                    size="small"
                                    type="date"
                                    label="To"
                                    value={customTo}
                                    onChange={(event) => setCustomTo(event.target.value)}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                            </>
                        )}
                    </Box>
                </CardContent>
            </Card>

            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                Robot availability reflects current status. Event and Alert metrics reflect the selected date range.
            </Alert>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 3, borderRadius: 2 }}
                    action={<Button color="inherit" size="small" onClick={refresh} disabled={loading}>Retry</Button>}
                >
                    {error}
                </Alert>
            )}

            {loading && (
                <Box sx={{ py: 9, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress aria-label="Loading Analytics" />
                </Box>
            )}

            {!loading && isEmpty && (
                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                    {tenantId || preset !== 'all'
                        ? 'No Analytics data exists for the selected organization or period.'
                        : 'No Analytics data exists yet.'}
                </Alert>
            )}

            {!loading && data && !isEmpty && (
                <>
                    <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                            <MetricCard
                                title="Face Recognition Success"
                                value={percent(data.metrics.faceRecognitionSuccessRate)}
                                secondary={`${data.totals.recognizedFaces} out of ${data.totals.faceRecognitionAttempts} recognized`}
                                icon={<Face />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                            <MetricCard
                                title="Unknown Face Rate"
                                value={percent(data.metrics.unknownFaceRate)}
                                secondary={`${data.totals.unknownFaces} unknown detections`}
                                icon={<HelpOutlined />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                            <MetricCard
                                title="Alert Resolution Rate"
                                value={percent(data.metrics.alertResolutionRate)}
                                secondary={`${data.totals.resolvedAlerts} out of ${data.totals.totalAlerts} resolved`}
                                icon={<CheckCircleOutlined />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                            <MetricCard
                                title="Robot Online Rate"
                                value={percent(data.metrics.robotOnlineRate)}
                                secondary={`${data.totals.onlineRobots} out of ${data.totals.activeRobots} online`}
                                icon={<Memory />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                            <MetricCard
                                title="Robot Reporting Rate"
                                value={percent(data.metrics.robotReportingRate)}
                                secondary={`${data.totals.reportingRobots} out of ${data.totals.activeRobots} reported Events`}
                                icon={<ReportProblemOutlined />}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                            <MetricCard
                                title="Average Resolution Time"
                                value={minutes(data.metrics.averageResolutionMinutes)}
                                secondary="Based on resolved Alerts"
                                icon={<AccessTime />}
                            />
                        </Grid>
                    </Grid>

                    <Grid container spacing={2.5} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 12, lg: 4 }}>
                            <SectionCard title="Recognition Performance">
                                <TwoPartBar
                                    firstLabel="Recognized"
                                    firstCount={data.totals.recognizedFaces}
                                    firstPercent={data.metrics.faceRecognitionSuccessRate}
                                    secondLabel="Unknown"
                                    secondCount={data.totals.unknownFaces}
                                    secondPercent={data.metrics.unknownFaceRate}
                                />
                            </SectionCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <SectionCard title="Alert Handling">
                                <StatLine label="Resolved" value={data.alertBreakdown.resolved} />
                                <StatLine label="Open" value={data.alertBreakdown.open} />
                                <StatLine label="In Progress" value={data.alertBreakdown.inProgress} />
                                <StatLine label="Resolution rate" value={percent(data.metrics.alertResolutionRate)} />
                                <StatLine label="Unresolved Alert rate" value={percent(data.metrics.unresolvedAlertRate)} />
                                <StatLine label="Average response" value={minutes(data.metrics.averageResponseMinutes)} />
                                <StatLine label="Average resolution" value={minutes(data.metrics.averageResolutionMinutes)} />
                            </SectionCard>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                            <SectionCard title="Robot Availability">
                                <StatLine label="Online" value={data.robotStatusBreakdown.online} />
                                <StatLine label="Offline" value={data.robotStatusBreakdown.offline} />
                                <StatLine label="Other" value={data.robotStatusBreakdown.other} />
                                <StatLine label="Robot online rate" value={percent(data.metrics.robotOnlineRate)} />
                                <StatLine label="Robot reporting rate" value={percent(data.metrics.robotReportingRate)} />
                                <StatLine label="Robots with no Events" value={data.totals.robotsWithoutEvents} />
                                <StatLine label="No Events reported rate" value={percent(data.metrics.noEventsReportedRate)} />
                            </SectionCard>
                        </Grid>
                    </Grid>

                    <SectionCard title="Safety Detection Activity">
                        <Alert severity="info" icon={<HelpOutlined />} sx={{ mb: 2.5 }}>
                            Reporting coverage shows how many Robots submitted this Event type during the selected period. It does not measure missed real-world detections.
                        </Alert>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                                <StatLine label="Total smoke Events" value={data.totals.smokeEvents} />
                                <StatLine label="Smoke Event share" value={percent(data.metrics.smokeEventShare)} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                                <StatLine label="Total fire Events" value={data.totals.fireEvents} />
                                <StatLine label="Fire Event share" value={percent(data.metrics.fireEventShare)} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                                <StatLine label="Robots Reporting Smoke" value={data.totals.robotsReportingSmoke} />
                                <StatLine label="Smoke reporting coverage" value={percent(data.metrics.smokeReportingCoverage)} />
                                <StatLine label="Robots With No Smoke Reports" value={data.totals.robotsWithoutSmokeReports} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                                <StatLine label="Robots Reporting Fire" value={data.totals.robotsReportingFire} />
                                <StatLine label="Fire reporting coverage" value={percent(data.metrics.fireReportingCoverage)} />
                                <StatLine label="Robots With No Fire Reports" value={data.totals.robotsWithoutFireReports} />
                            </Grid>
                        </Grid>
                    </SectionCard>

                    <Box sx={{ mt: 3 }}>
                        <SectionCard title="Event Activity Trend">
                            {data.dailyTrend.length === 0 ? (
                                <Typography variant="body2" sx={{ color: '#718096' }}>No Event activity in this period.</Typography>
                            ) : (
                                <Box sx={{ display: 'grid', gap: 1.5 }}>
                                    {data.dailyTrend.map((point) => {
                                        const maxEvents = Math.max(...data.dailyTrend.map((item) => item.events), 1);
                                        return (
                                            <Box key={point.date}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                                                    <Typography variant="caption" sx={{ color: '#2B3674', fontWeight: 800 }}>
                                                        {point.date}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#718096' }}>
                                                        Events {point.events} · Recognized {point.recognizedFaces} · Unknown {point.unknownFaces} · Smoke {point.smoke} · Fire {point.fire}
                                                    </Typography>
                                                </Box>
                                                <Tooltip title={`Total Events: ${point.events}`}>
                                                    <Box sx={{ height: 10, borderRadius: 5, bgcolor: '#EDF2F7', overflow: 'hidden' }}>
                                                        <Box sx={{ height: '100%', width: `${(point.events / maxEvents) * 100}%`, bgcolor: '#4318FF' }} />
                                                    </Box>
                                                </Tooltip>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                        </SectionCard>
                    </Box>

                    <Card sx={{ ...CARD_STYLE, mt: 3, overflow: 'hidden' }}>
                        <CardContent sx={{ p: 3, pb: 1 }}>
                            <Typography variant="h6" sx={{ color: '#2B3674', fontWeight: 800 }}>Organization Performance</Typography>
                        </CardContent>
                        <TableContainer sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: 1050 }}>
                                <TableHead>
                                    <TableRow>
                                        {['Organization', 'Total Events', 'Recognition Success', 'Alert Resolution', 'Online Robots', 'Reporting Robots', 'Smoke / Fire', 'Avg. Resolution'].map((label) => (
                                            <TableCell key={label} sx={{ color: '#A3AED0', fontWeight: 800 }}>{label}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.organizations.map((organization) => (
                                        <TableRow key={organization.tenantId} hover>
                                            <TableCell sx={{ color: '#2B3674', fontWeight: 700 }}>{organization.tenantName}</TableCell>
                                            <TableCell>{organization.totalEvents}</TableCell>
                                            <TableCell>{percent(organization.faceRecognitionSuccessRate)}</TableCell>
                                            <TableCell>{percent(organization.alertResolutionRate)}</TableCell>
                                            <TableCell>{organization.onlineRobots} / {organization.activeRobots}</TableCell>
                                            <TableCell>{organization.reportingRobots} / {organization.activeRobots}</TableCell>
                                            <TableCell>{organization.smokeEvents} / {organization.fireEvents}</TableCell>
                                            <TableCell>{minutes(organization.averageResolutionMinutes)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>

                    <Card sx={{ ...CARD_STYLE, mt: 3, overflow: 'hidden' }}>
                        <CardContent sx={{ p: 3, pb: 1 }}>
                            <Typography variant="h6" sx={{ color: '#2B3674', fontWeight: 800 }}>Most Active Robots</Typography>
                        </CardContent>
                        <TableContainer sx={{ overflowX: 'auto' }}>
                            <Table size="small" sx={{ minWidth: 1050 }}>
                                <TableHead>
                                    <TableRow>
                                        {['Robot', 'Organization', 'Location', 'Total Events', 'Recognized', 'Unknown', 'Smoke', 'Fire', 'Last Event'].map((label) => (
                                            <TableCell key={label} sx={{ color: '#A3AED0', fontWeight: 800 }}>{label}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.topRobots.map((robot) => (
                                        <TableRow key={robot.robotId} hover>
                                            <TableCell sx={{ color: '#2B3674', fontWeight: 700 }}>{robot.robotName}</TableCell>
                                            <TableCell>{robot.tenantName}</TableCell>
                                            <TableCell>{robot.location || 'N/A'}</TableCell>
                                            <TableCell>{robot.totalEvents}</TableCell>
                                            <TableCell>{robot.recognizedFaces}</TableCell>
                                            <TableCell>{robot.unknownFaces}</TableCell>
                                            <TableCell>{robot.smokeEvents}</TableCell>
                                            <TableCell>{robot.fireEvents}</TableCell>
                                            <TableCell>{dateTime(robot.lastEventAt)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                </>
            )}
        </Box>
    );
};
