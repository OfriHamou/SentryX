import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestoreIcon from '@mui/icons-material/Restore';
import SearchIcon from '@mui/icons-material/Search';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Tabs,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { api } from '../api';
import { useOrganizationAuth } from '../auth/OrganizationAuthProvider';
import { hasOrganizationPermission } from '../auth/permissions';
import AccessDenied from '../components/AccessDenied';
import PermissionGate from '../components/PermissionGate';
import { OrganizationRobot, OrganizationRobotFormState } from '../organizationTypes';

type StatusFilter = 'all' | 'online' | 'offline' | 'other';
type RobotTab = 'active' | 'archived';

type RemoveRobotResult =
  | { action: 'deleted'; message: string }
  | { action: 'archived'; message: string; robot: OrganizationRobot };

interface RobotFormErrors {
  name?: string;
  location?: string;
}

interface SuccessNotice {
  message: string;
  robotId?: string;
}

const emptyForm: OrganizationRobotFormState = {
  name: '',
  location: '',
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }

  return fallback;
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return 'Never connected';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatUpdatedAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const shortenId = (id: string): string => (
  id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-8)}` : id
);

const normalizedStatus = (status: string): StatusFilter => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'online') {
    return 'online';
  }
  if (normalized === 'offline') {
    return 'offline';
  }
  return 'other';
};

const statusChipSx = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'online') {
    return { backgroundColor: '#E6F9F5', color: '#047857' };
  }
  if (normalized === 'offline') {
    return { backgroundColor: '#F2F0F5', color: '#62566F' };
  }
  if (['error', 'failure', 'failed', 'down'].includes(normalized)) {
    return { backgroundColor: '#FDECEB', color: '#B91C1C' };
  }
  return { backgroundColor: '#F5F0FF', color: '#6B5A7D' };
};

const validateForm = (form: OrganizationRobotFormState): RobotFormErrors => {
  const errors: RobotFormErrors = {};
  const name = form.name.trim();
  const location = form.location.trim();

  if (!name) {
    errors.name = 'Robot name is required.';
  } else if (name.length > 25) {
    errors.name = 'Robot name must be 25 characters or fewer.';
  }

  if (location.length > 35) {
    errors.location = 'Location must be 35 characters or fewer.';
  }

  return errors;
};

const Robots: React.FC = () => {
  const { user } = useOrganizationAuth();
  const allowedPages = user?.allowedPages;
  const canReadRobots = hasOrganizationPermission(allowedPages, 'organization_robots', 'read');
  const canWriteRobots = hasOrganizationPermission(allowedPages, 'organization_robots', 'write');
  const [activeRobots, setActiveRobots] = useState<OrganizationRobot[]>([]);
  const [archivedRobots, setArchivedRobots] = useState<OrganizationRobot[]>([]);
  const [activeTab, setActiveTab] = useState<RobotTab>('active');
  const [loadedTabs, setLoadedTabs] = useState<Record<RobotTab, boolean>>({
    active: false,
    archived: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshWarning, setRefreshWarning] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<OrganizationRobot | null>(null);
  const [detailsRobot, setDetailsRobot] = useState<OrganizationRobot | null>(null);
  const [form, setForm] = useState<OrganizationRobotFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<RobotFormErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removeRobot, setRemoveRobot] = useState<OrganizationRobot | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [restoringRobotId, setRestoringRobotId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [successNotice, setSuccessNotice] = useState<SuccessNotice | null>(null);
  const [copyNotice, setCopyNotice] = useState('');
  const mountedRef = useRef(true);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const requestInFlightRef = useRef(false);
  const requestStateRef = useRef<RobotTab | null>(null);

  const loadRobots = useCallback(async (state: RobotTab, background = false) => {
    if (!canReadRobots) {
      setLoading(false);
      return;
    }

    if (requestInFlightRef.current && requestStateRef.current === state) {
      return;
    }
    if (requestInFlightRef.current) {
      requestControllerRef.current?.abort();
    }

    const controller = new AbortController();
    requestControllerRef.current = controller;
    requestInFlightRef.current = true;
    requestStateRef.current = state;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (background) {
      setRefreshing(true);
      setRefreshWarning('');
    } else {
      setLoading(true);
      setLoadError('');
    }

    try {
      const { data } = await api.get<OrganizationRobot[]>('/organization/robots', {
        signal: controller.signal,
        params: { state },
      });
      if (mountedRef.current && requestId === requestIdRef.current) {
        if (state === 'active') {
          setActiveRobots(data);
        } else {
          setArchivedRobots(data);
        }
        setLoadedTabs(current => ({ ...current, [state]: true }));
        setLoadError('');
        setRefreshWarning('');
      }
    } catch (error: unknown) {
      if (!axios.isCancel(error) && mountedRef.current && requestId === requestIdRef.current) {
        const message = getErrorMessage(error, 'Failed to load Robots.');
        if (background) {
          setRefreshWarning(`${message} Existing Robot data is still displayed.`);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        requestInFlightRef.current = false;
        requestStateRef.current = null;
        requestControllerRef.current = null;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [canReadRobots]);

  useEffect(() => {
    mountedRef.current = true;
    void loadRobots(activeTab, loadedTabs[activeTab]);
    const pollId = window.setInterval(() => {
      void loadRobots(activeTab, true);
    }, 30_000);

    return () => {
      window.clearInterval(pollId);
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      requestInFlightRef.current = false;
      requestStateRef.current = null;
      requestIdRef.current += 1;
    };
  }, [activeTab, loadRobots]);

  useEffect(() => () => {
    mountedRef.current = false;
    requestControllerRef.current?.abort();
  }, []);

  const robots = activeTab === 'active' ? activeRobots : archivedRobots;

  const summary = useMemo(() => ({
    total: activeRobots.length,
    online: activeRobots.filter(robot => normalizedStatus(robot.status) === 'online').length,
    offline: activeRobots.filter(robot => normalizedStatus(robot.status) === 'offline').length,
    neverConnected: activeRobots.filter(robot => !robot.lastConnection).length,
  }), [activeRobots]);

  const filteredRobots = useMemo(() => {
    const query = search.trim().toLowerCase();
    return robots.filter(robot => {
      const matchesSearch = !query || [
        robot.name,
        robot.id,
        robot.location || '',
        robot.status,
        robot.archivedAt ? 'archived' : 'active',
      ].some(value => value.toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || normalizedStatus(robot.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [robots, search, statusFilter]);

  const copyRobotId = async (robotId: string) => {
    try {
      await navigator.clipboard.writeText(robotId);
      setCopyNotice('Robot ID copied to clipboard.');
    } catch {
      setCopyNotice('Could not copy the Robot ID. Select it from Robot details instead.');
    }
  };

  const openCreateDialog = () => {
    setSelectedRobot(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const openEditDialog = (robot: OrganizationRobot) => {
    setSelectedRobot(robot);
    setForm({ name: robot.name, location: robot.location || '' });
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  };

  const closeFormDialog = () => {
    if (!saving) {
      setFormOpen(false);
    }
  };

  const saveRobot = async () => {
    const validationErrors = validateForm(form);
    setFormErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSaving(true);
    setFormError('');
    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
    };

    try {
      if (selectedRobot) {
        const { data } = await api.put<OrganizationRobot>(
          `/organization/robots/${selectedRobot.id}`,
          payload,
        );
        setActiveRobots(current => current.map(robot => robot.id === data.id ? data : robot));
        setSuccessNotice({ message: 'Robot updated successfully.' });
      } else {
        const { data } = await api.post<OrganizationRobot>('/organization/robots', payload);
        setActiveRobots(current => [data, ...current]);
        setSuccessNotice({
          message: 'Robot created successfully. Configure the Robot to report events using this Robot ID.',
          robotId: data.id,
        });
      }

      setFormOpen(false);
      void loadRobots('active', true);
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, `Failed to ${selectedRobot ? 'update' : 'create'} Robot.`));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemoveRobot = async () => {
    if (!removeRobot || removing) {
      return;
    }

    setRemoving(true);
    setRemoveError('');
    try {
      const { data } = await api.delete<RemoveRobotResult>(
        `/organization/robots/${removeRobot.id}`,
      );

      setActiveRobots(current => current.filter(robot => robot.id !== removeRobot.id));
      if (data.action === 'archived') {
        setArchivedRobots(current => [
          data.robot,
          ...current.filter(robot => robot.id !== data.robot.id),
        ]);
        setLoadedTabs(current => ({ ...current, archived: true }));
        setSuccessNotice({ message: 'Robot has operational history and was moved to Archived.' });
      } else {
        setSuccessNotice({ message: 'Robot deleted permanently.' });
      }

      setRemoveRobot(null);
      void loadRobots('active', true);
    } catch (error: unknown) {
      setRemoveError(getErrorMessage(error, 'Failed to remove Robot.'));
    } finally {
      setRemoving(false);
    }
  };

  const restoreRobot = async (robot: OrganizationRobot) => {
    if (restoringRobotId) {
      return;
    }

    setRestoringRobotId(robot.id);
    setActionError('');
    try {
      const { data } = await api.patch<OrganizationRobot>(
        `/organization/robots/${robot.id}/restore`,
      );
      setArchivedRobots(current => current.filter(item => item.id !== data.id));
      setActiveRobots(current => [data, ...current.filter(item => item.id !== data.id)]);
      setLoadedTabs(current => ({ ...current, active: true }));
      setDetailsRobot(current => current?.id === data.id ? null : current);
      setSuccessNotice({ message: 'Robot restored successfully.' });
      void loadRobots('archived', true);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, 'Failed to restore Robot.'));
    } finally {
      setRestoringRobotId(null);
    }
  };

  const summaryItems = [
    { label: 'Total Robots', value: summary.total, color: '#6D28D9' },
    { label: 'Online', value: summary.online, color: '#047857' },
    { label: 'Offline', value: summary.offline, color: '#62566F' },
    { label: 'Never Connected', value: summary.neverConnected, color: '#B45309' },
  ];

  return (
    <PermissionGate allowed={canReadRobots} fallback={<AccessDenied />}>
      <Stack spacing={3}>
        {loadError && (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => void loadRobots(activeTab)}>Retry</Button>}
          >
            {loadError}
          </Alert>
        )}
        {refreshWarning && (
          <Alert
            severity="warning"
            onClose={() => setRefreshWarning('')}
            action={<Button color="inherit" size="small" onClick={() => void loadRobots(activeTab, true)}>Retry</Button>}
          >
            {refreshWarning}
          </Alert>
        )}
        {actionError && <Alert severity="error" onClose={() => setActionError('')}>{actionError}</Alert>}

        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', border: '1px solid #E7DEF8', overflow: 'hidden' }}>
          <Box sx={{ p: 3, px: { xs: 2.5, md: 4 }, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, background: '#FAF8FE', borderBottom: '1px solid #E7DEF8' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E' }}>Robot Management</Typography>
              <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 500 }}>
                Manage Robots registered to this tenant.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
              <Button
                startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                variant="outlined"
                onClick={() => void loadRobots(activeTab, true)}
                disabled={refreshing || loading}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', color: '#6D28D9', borderColor: '#C4B5FD' }}
              >
                Refresh
              </Button>
              <PermissionGate allowed={canWriteRobots && activeTab === 'active'}>
                <Button
                  startIcon={<AddCircleOutlineIcon />}
                  variant="contained"
                  onClick={openCreateDialog}
                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', backgroundColor: '#6D28D9', boxShadow: 'none', '&:hover': { backgroundColor: '#5B21B6' } }}
                >
                  Add Robot
                </Button>
              </PermissionGate>
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 2.5, md: 3 } }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
              {summaryItems.map(item => (
                <Box key={item.label} sx={{ p: 2, border: '1px solid #E7DEF8', borderRadius: '12px', backgroundColor: '#FFFFFF' }}>
                  <Typography sx={{ color: '#7E69A6', fontWeight: 750, fontSize: '0.78rem' }}>{item.label}</Typography>
                  <Typography variant="h5" sx={{ color: item.color, fontWeight: 850, mt: 0.5 }}>{item.value}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Card>

        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', border: '1px solid #E7DEF8', overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(_event, value: RobotTab) => {
              setActiveTab(value);
              setSearch('');
              setStatusFilter('all');
              setLoadError('');
              setRefreshWarning('');
            }}
            sx={{
              px: 2.5,
              borderBottom: '1px solid #E7DEF8',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 800 },
              '& .Mui-selected': { color: '#6D28D9' },
              '& .MuiTabs-indicator': { backgroundColor: '#7C3AED' },
            }}
          >
            <Tab value="active" label={`Active (${activeRobots.length})`} />
            <Tab value="archived" label={`Archived (${archivedRobots.length})`} />
          </Tabs>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2.5, borderBottom: '1px solid #E7DEF8' }}>
            <TextField
              fullWidth
              size="small"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name, Robot ID, location, or status"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#8B7AA8' }} /></InputAdornment> } }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 180 } }}>
              <InputLabel id="robot-status-filter-label">Status</InputLabel>
              <Select
                labelId="robot-status-filter-label"
                value={statusFilter}
                label="Status"
                onChange={event => setStatusFilter(event.target.value as StatusFilter)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="online">Online</MenuItem>
                <MenuItem value="offline">Offline</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 1050 }}>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 850, color: '#7E69A6', py: 2, borderBottom: '1px solid #E7DEF8', fontSize: '0.76rem', letterSpacing: 0.4 } }}>
                  <TableCell>ROBOT</TableCell>
                  <TableCell>ROBOT ID</TableCell>
                  <TableCell>LOCATION</TableCell>
                  <TableCell>STATUS</TableCell>
                  <TableCell>LAST CONNECTION</TableCell>
                  <TableCell>{activeTab === 'archived' ? 'ARCHIVED AT' : 'LAST UPDATED'}</TableCell>
                  <TableCell align="right">ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 10 }}>
                      <CircularProgress size={46} sx={{ color: '#7C3AED' }} />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !loadError && robots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 9 }}>
                      <SmartToyIcon sx={{ fontSize: 58, color: '#D8CEF0', mb: 1.5 }} />
                      <Typography variant="h6" sx={{ color: '#6B5A7D', fontWeight: 750 }}>
                        {activeTab === 'active' ? 'No Robots registered for this tenant.' : 'No archived Robots.'}
                      </Typography>
                      {canWriteRobots && activeTab === 'active' && (
                        <Typography variant="body2" sx={{ color: '#9A8AAA', mt: 0.5 }}>
                          Add the first Robot to begin receiving tenant-scoped events.
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !loadError && robots.length > 0 && filteredRobots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                      <Typography variant="h6" sx={{ color: '#6B5A7D', fontWeight: 750 }}>No Robots match your search.</Typography>
                      <Button onClick={() => { setSearch(''); setStatusFilter('all'); }} sx={{ mt: 1, textTransform: 'none' }}>Clear filters</Button>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !loadError && filteredRobots.map(robot => (
                  <TableRow key={robot.id} hover sx={{ '& td': { borderBottom: '1px solid #F1EBFF', py: 2 }, '&:hover td': { backgroundColor: '#FCFAFF' } }}>
                    <TableCell>
                      <Typography sx={{ color: '#20113E', fontWeight: 800 }}>{robot.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#9A8AAA' }}>{shortenId(robot.id)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Typography component="code" sx={{ color: '#6B5A7D', fontSize: '0.82rem' }}>{shortenId(robot.id)}</Typography>
                        <Tooltip title="Copy full Robot ID">
                          <IconButton size="small" aria-label={`Copy Robot ID for ${robot.name}`} onClick={() => void copyRobotId(robot.id)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: '#6B5A7D', fontWeight: 600 }}>{robot.location?.trim() || 'Not assigned'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={robot.archivedAt ? 'Archived' : robot.status}
                        sx={{
                          fontWeight: 800,
                          borderRadius: '8px',
                          ...(robot.archivedAt
                            ? { backgroundColor: '#F3E8FF', color: '#6D28D9' }
                            : statusChipSx(robot.status)),
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#6B5A7D' }}>{formatDateTime(robot.lastConnection)}</TableCell>
                    <TableCell sx={{ color: '#6B5A7D' }}>
                      {robot.archivedAt ? formatDateTime(robot.archivedAt) : formatUpdatedAt(robot.updatedAt)}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="View details">
                        <IconButton aria-label={`View ${robot.name}`} onClick={() => setDetailsRobot(robot)} sx={{ color: '#8B7AA8' }}>
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <PermissionGate allowed={canWriteRobots && activeTab === 'active'}>
                        <Tooltip title="Edit">
                          <IconButton aria-label={`Edit ${robot.name}`} onClick={() => openEditDialog(robot)} sx={{ color: '#8B7AA8', '&:hover': { color: '#7C3AED', backgroundColor: '#F3E8FF' } }}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </PermissionGate>
                      <PermissionGate allowed={canWriteRobots && activeTab === 'active'}>
                        <Tooltip title="Remove">
                          <IconButton
                            aria-label={`Remove ${robot.name}`}
                            onClick={() => {
                              setRemoveError('');
                              setRemoveRobot(robot);
                            }}
                            sx={{ color: '#8B7AA8', '&:hover': { color: '#B91C1C', backgroundColor: '#FDECEB' } }}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      </PermissionGate>
                      <PermissionGate allowed={canWriteRobots && activeTab === 'archived'}>
                        <Tooltip title="Restore">
                          <span>
                            <IconButton
                              aria-label={`Restore ${robot.name}`}
                              onClick={() => void restoreRobot(robot)}
                              disabled={Boolean(restoringRobotId)}
                              sx={{ color: '#6D28D9', '&:hover': { backgroundColor: '#F3E8FF' } }}
                            >
                              {restoringRobotId === robot.id
                                ? <CircularProgress size={20} />
                                : <RestoreIcon />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </PermissionGate>
                      <Tooltip title="Copy full Robot ID">
                        <IconButton aria-label={`Copy ID for ${robot.name}`} onClick={() => void copyRobotId(robot.id)} sx={{ color: '#8B7AA8' }}>
                          <ContentCopyIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Dialog open={formOpen} onClose={closeFormDialog} fullWidth maxWidth="sm">
          <DialogTitle sx={{ color: '#20113E', fontWeight: 850 }}>{selectedRobot ? 'Edit Robot' : 'Add Robot'}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField
                autoFocus
                required
                fullWidth
                label="Robot Name"
                value={form.name}
                onChange={event => {
                  setForm(current => ({ ...current, name: event.target.value }));
                  setFormErrors(current => ({ ...current, name: undefined }));
                }}
                error={Boolean(formErrors.name)}
                helperText={formErrors.name || `${form.name.trim().length}/25`}
                slotProps={{ htmlInput: { maxLength: 25 } }}
                disabled={saving}
              />
              <TextField
                fullWidth
                label="Location"
                placeholder="Main Lobby"
                value={form.location}
                onChange={event => {
                  setForm(current => ({ ...current, location: event.target.value }));
                  setFormErrors(current => ({ ...current, location: undefined }));
                }}
                error={Boolean(formErrors.location)}
                helperText={formErrors.location || `Optional · ${form.location.trim().length}/35`}
                slotProps={{ htmlInput: { maxLength: 35 } }}
                disabled={saving}
              />
              <Alert severity="info">
                Robot status and connectivity are managed by the system. The Robot ID is generated after creation.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={closeFormDialog} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Button
              variant="contained"
              onClick={() => void saveRobot()}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ textTransform: 'none', fontWeight: 800, backgroundColor: '#6D28D9' }}
            >
              {saving ? 'Saving…' : selectedRobot ? 'Save Changes' : 'Add Robot'}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(detailsRobot)} onClose={() => setDetailsRobot(null)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ color: '#20113E', fontWeight: 850 }}>Robot Details</DialogTitle>
          {detailsRobot && (
            <DialogContent dividers>
              <Stack spacing={2.25}>
                <Box>
                  <Typography variant="caption" sx={{ color: '#7E69A6', fontWeight: 800 }}>NAME</Typography>
                  <Typography sx={{ color: '#20113E', fontWeight: 750 }}>{detailsRobot.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#7E69A6', fontWeight: 800 }}>ROBOT ID</Typography>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography component="code" sx={{ color: '#20113E', overflowWrap: 'anywhere' }}>{detailsRobot.id}</Typography>
                    <Tooltip title="Copy full Robot ID">
                      <IconButton onClick={() => void copyRobotId(detailsRobot.id)}><ContentCopyIcon /></IconButton>
                    </Tooltip>
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#7E69A6', fontWeight: 800 }}>LOCATION</Typography>
                  <Typography sx={{ color: '#20113E' }}>{detailsRobot.location?.trim() || 'Not assigned'}</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#7E69A6', fontWeight: 800 }}>STATUS</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={detailsRobot.archivedAt ? 'Archived' : detailsRobot.status}
                        sx={{
                          fontWeight: 800,
                          ...(detailsRobot.archivedAt
                            ? { backgroundColor: '#F3E8FF', color: '#6D28D9' }
                            : statusChipSx(detailsRobot.status)),
                        }}
                      />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#7E69A6', fontWeight: 800 }}>LAST CONNECTION</Typography>
                    <Typography sx={{ color: '#20113E' }}>{formatDateTime(detailsRobot.lastConnection)}</Typography>
                  </Box>
                </Stack>
                <Box>
                  <Typography variant="caption" sx={{ color: '#7E69A6', fontWeight: 800 }}>LAST UPDATED</Typography>
                  <Typography sx={{ color: '#20113E' }}>{formatUpdatedAt(detailsRobot.updatedAt)}</Typography>
                </Box>
                {detailsRobot.archivedAt && (
                  <Box>
                    <Typography variant="caption" sx={{ color: '#7E69A6', fontWeight: 800 }}>ARCHIVED AT</Typography>
                    <Typography sx={{ color: '#20113E' }}>{formatDateTime(detailsRobot.archivedAt)}</Typography>
                  </Box>
                )}
              </Stack>
            </DialogContent>
          )}
          <DialogActions sx={{ px: 3, py: 2 }}>
            {detailsRobot && canWriteRobots && !detailsRobot.archivedAt && (
              <Button onClick={() => { const robot = detailsRobot; setDetailsRobot(null); openEditDialog(robot); }} startIcon={<EditIcon />} sx={{ mr: 'auto', textTransform: 'none' }}>
                Edit
              </Button>
            )}
            {detailsRobot && canWriteRobots && detailsRobot.archivedAt && (
              <Button
                onClick={() => void restoreRobot(detailsRobot)}
                startIcon={restoringRobotId === detailsRobot.id ? <CircularProgress size={16} /> : <RestoreIcon />}
                disabled={Boolean(restoringRobotId)}
                sx={{ mr: 'auto', textTransform: 'none' }}
              >
                Restore
              </Button>
            )}
            <Button onClick={() => setDetailsRobot(null)} sx={{ textTransform: 'none' }}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(removeRobot)}
          onClose={() => {
            if (!removing) {
              setRemoveRobot(null);
              setRemoveError('');
            }
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle sx={{ color: '#20113E', fontWeight: 850 }}>Remove Robot?</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {removeError && <Alert severity="error">{removeError}</Alert>}
              <Typography sx={{ color: '#6B5A7D' }}>
                If this Robot has no operational history, it will be permanently deleted. If it has existing Events or Notifications, it will be moved to Archived and its history will be preserved.
              </Typography>
              {removeRobot && (
                <Box sx={{ p: 2, borderRadius: '10px', backgroundColor: '#FAF8FE', border: '1px solid #E7DEF8' }}>
                  <Typography sx={{ color: '#20113E', fontWeight: 800 }}>{removeRobot.name}</Typography>
                  <Typography component="code" variant="caption" sx={{ color: '#6B5A7D' }}>{removeRobot.id}</Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => {
                setRemoveRobot(null);
                setRemoveError('');
              }}
              disabled={removing}
              sx={{ textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => void confirmRemoveRobot()}
              disabled={removing}
              startIcon={removing ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineIcon />}
              sx={{ textTransform: 'none', fontWeight: 800 }}
            >
              {removing ? 'Removing…' : 'Remove Robot'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(successNotice)}
          autoHideDuration={successNotice?.robotId ? 12_000 : 5000}
          onClose={() => setSuccessNotice(null)}
          message={
            successNotice && (
              <Box>
                <Typography variant="body2">{successNotice.message}</Typography>
                {successNotice.robotId && <Typography component="code" variant="caption">{successNotice.robotId}</Typography>}
              </Box>
            )
          }
          action={successNotice?.robotId ? (
            <Button color="secondary" size="small" onClick={() => void copyRobotId(successNotice.robotId!)}>
              Copy Robot ID
            </Button>
          ) : undefined}
        />
        <Snackbar
          open={Boolean(copyNotice)}
          autoHideDuration={3500}
          onClose={() => setCopyNotice('')}
          message={copyNotice}
        />
      </Stack>
    </PermissionGate>
  );
};

export default Robots;
