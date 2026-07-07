import React, { useCallback, useEffect, useState } from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
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
  InputLabel,
  MenuItem,
  Select,
  Stack,
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
import { api } from '../api';
import { useOrganizationAuth } from '../auth/OrganizationAuthProvider';
import { hasOrganizationPermission } from '../auth/permissions';
import AccessDenied from '../components/AccessDenied';
import PermissionGate from '../components/PermissionGate';
import { SecurityShift, SecurityShiftStatus } from '../organizationTypes';

interface ShiftFormState {
  name: string;
  shiftDate: string;
  assignedUserId: string;
  startAt: string;
  endAt: string;
  notes: string;
}

const emptyForm: ShiftFormState = {
  name: '',
  shiftDate: '',
  assignedUserId: '',
  startAt: '',
  endAt: '',
  notes: '',
};

const shiftTypes = [
  { name: 'Morning Shift', startTime: '06:00', endTime: '14:00', endsNextDay: false },
  { name: 'Evening Shift', startTime: '14:00', endTime: '22:00', endsNextDay: false },
  { name: 'Night Shift', startTime: '22:00', endTime: '06:00', endsNextDay: true },
];

const formatDateTime = (value?: string): string => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
};

const toDateTimeLocal = (value: string): string => {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toDateInput = (date: Date): string => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
};

const addDays = (dateValue: string, days: number): string => {
  const date = new Date(`${dateValue}T00:00`);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
};

const getShiftTypeFormValues = (name: string, shiftDate: string) => {
  const shiftType = shiftTypes.find(type => type.name === name);

  if (!shiftType || !shiftDate) {
    return {};
  }

  const endDate = shiftType.endsNextDay ? addDays(shiftDate, 1) : shiftDate;

  return {
    startAt: `${shiftDate}T${shiftType.startTime}`,
    endAt: `${endDate}T${shiftType.endTime}`,
  };
};

const getStatusChipSx = (status: SecurityShiftStatus) => {
  if (status === 'ACTIVE') {
    return { backgroundColor: '#E6F9F5', color: '#047857' };
  }

  if (status === 'CANCELLED') {
    return { backgroundColor: '#FDECEB', color: '#B91C1C' };
  }

  if (status === 'COMPLETED') {
    return { backgroundColor: '#EEF2FF', color: '#4338CA' };
  }

  return { backgroundColor: '#FFF9E6', color: '#B45309' };
};

const getWorkerName = (shift: SecurityShift): string => (
  shift.assignedUser?.fullName || shift.assignedUser?.email || 'Unassigned'
);

const SecurityShifts: React.FC = () => {
  const { user } = useOrganizationAuth();
  const allowedPages = user?.allowedPages;
  const canReadShifts = hasOrganizationPermission(allowedPages, 'organization_security_shifts', 'read');
  const canWriteShifts = hasOrganizationPermission(allowedPages, 'organization_security_shifts', 'write');
  const [shifts, setShifts] = useState<SecurityShift[]>([]);
  const [currentShift, setCurrentShift] = useState<SecurityShift | null>(null);
  const [securityOperators, setSecurityOperators] = useState<Array<{ id: string; fullName: string | null; email: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<SecurityShift | null>(null);
  const [form, setForm] = useState<ShiftFormState>(emptyForm);

  const fetchData = useCallback(async () => {
    if (!canReadShifts) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [shiftsResponse, currentResponse, operatorsResponse] = await Promise.all([
        api.get<SecurityShift[]>('/organization/security-shifts'),
        api.get<SecurityShift | null>('/organization/security-shifts/current'),
        canWriteShifts
          ? api.get<Array<{ id: string; fullName: string | null; email: string }>>('/organization/security-shifts/operators')
          : Promise.resolve({ data: [] }),
      ]);
      setShifts(shiftsResponse.data);
      setCurrentShift(currentResponse.data);
      setSecurityOperators(operatorsResponse.data);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Failed to load security shifts.');
    } finally {
      setLoading(false);
    }
  }, [canReadShifts, canWriteShifts]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    const shiftDate = toDateInput(new Date());
    setSelectedShift(null);
    setFormError('');
    setForm({ ...emptyForm, shiftDate });
    setModalOpen(true);
  };

  const openEditModal = (shift: SecurityShift) => {
    setSelectedShift(shift);
    setFormError('');
    setForm({
      name: shift.name,
      shiftDate: toDateInput(new Date(shift.startAt)),
      assignedUserId: shift.assignedUser?.id || '',
      startAt: toDateTimeLocal(shift.startAt),
      endAt: toDateTimeLocal(shift.endAt),
      notes: shift.notes || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (!saving) {
      setModalOpen(false);
    }
  };

  const updateShiftDate = (shiftDate: string) => {
    setForm(currentForm => ({
      ...currentForm,
      shiftDate,
      ...getShiftTypeFormValues(currentForm.name, shiftDate),
    }));
  };

  const updateShiftType = (name: string) => {
    setForm(currentForm => ({
      ...currentForm,
      name,
      ...getShiftTypeFormValues(name, currentForm.shiftDate),
    }));
  };

  const submitShift = async () => {
    setSaving(true);
    setFormError('');

    try {
      const payload = {
        name: form.name,
        assignedUserId: form.assignedUserId,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        notes: form.notes,
      };

      if (selectedShift) {
        await api.put(`/organization/security-shifts/${selectedShift.id}`, payload);
      } else {
        await api.post('/organization/security-shifts', payload);
      }

      setModalOpen(false);
      await fetchData();
    } catch (requestError: any) {
      setFormError(requestError.response?.data?.message || 'Failed to save security shift.');
    } finally {
      setSaving(false);
    }
  };

  const cancelShift = async (shift: SecurityShift) => {
    if (!window.confirm(`Cancel "${shift.name}"?`)) {
      return;
    }

    setError('');
    try {
      await api.delete(`/organization/security-shifts/${shift.id}`);
      await fetchData();
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Failed to cancel security shift.');
    }
  };

  return (
    <PermissionGate allowed={canReadShifts} fallback={<AccessDenied />}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', border: '1px solid #E7DEF8' }}>
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, background: '#FAF8FE', borderBottom: '1px solid #E7DEF8' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E' }}>
                Security Shift Management
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 500 }}>
                Define the single Security Operator responsible for each tenant coverage window.
              </Typography>
            </Box>
            <PermissionGate allowed={canWriteShifts}>
              <Button
                startIcon={<AddCircleOutlineIcon />}
                variant="contained"
                onClick={openCreateModal}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 2.5, backgroundColor: '#6D28D9', boxShadow: 'none', '&:hover': { backgroundColor: '#5B21B6' } }}
              >
                Create Shift
              </Button>
            </PermissionGate>
          </Box>
          <Box sx={{ p: 3 }}>
            {loading ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: '#7C3AED' }} />
              </Box>
            ) : currentShift ? (
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}>
                <Box>
                  <Typography sx={{ color: '#7E69A6', fontSize: '0.78rem', fontWeight: 850, letterSpacing: 0.5 }}>CURRENT ACTIVE SHIFT</Typography>
                  <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 850, color: '#20113E' }}>{currentShift.name}</Typography>
                  <Typography sx={{ color: '#6B5A7D', fontWeight: 600 }}>{getWorkerName(currentShift)}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: '#6B5A7D', fontWeight: 600 }}>{formatDateTime(currentShift.startAt)} - {formatDateTime(currentShift.endAt)}</Typography>
                  <Chip size="small" label={currentShift.status} sx={{ mt: 1, fontWeight: 800, borderRadius: '8px', ...getStatusChipSx(currentShift.status) }} />
                </Box>
              </Stack>
            ) : (
              <Alert severity="info">No Security Operator is currently on shift.</Alert>
            )}
          </Box>
        </Card>

        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E7DEF8' }}>
          <TableContainer component={Box} sx={{ maxHeight: 640, pl: { xs: 1.5, md: 2 }, pr: { xs: 3, md: 4 } }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { backgroundColor: '#FFFFFF', fontWeight: 850, color: '#7E69A6', py: 2.2, borderBottom: '1px solid #E7DEF8', fontSize: '0.76rem', letterSpacing: 0.5 } }}>
                  <TableCell>SHIFT TYPE</TableCell>
                  <TableCell>DATE / TIME</TableCell>
                  <TableCell>ASSIGNED WORKER</TableCell>
                  <TableCell>STATUS</TableCell>
                  <TableCell>NOTES</TableCell>
                  <TableCell align="center" sx={{ width: 128 }}>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                      <CircularProgress size={50} thickness={4} sx={{ color: '#7C3AED' }} />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && shifts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                      <BlockIcon sx={{ fontSize: 60, color: '#e2e8f0', mb: 2 }} />
                      <Typography variant="h6" color="#6B5A7D" sx={{ fontWeight: 700 }}>No security shifts found</Typography>
                      <Typography variant="body2" color="#a0aec0">Create a shift to assign one Security Operator to a time window.</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && shifts.map(shift => (
                  <TableRow key={shift.id} hover sx={{ '& td': { borderBottom: '1px solid #F1EBFF', py: 2.4 }, '&:hover td': { backgroundColor: '#FCFAFF' } }}>
                    <TableCell sx={{ fontWeight: 750, color: '#20113E', fontSize: '0.95rem' }}>{shift.name}</TableCell>
                    <TableCell sx={{ color: '#6B5A7D', fontWeight: 500 }}>{formatDateTime(shift.startAt)} - {formatDateTime(shift.endAt)}</TableCell>
                    <TableCell sx={{ color: '#6B5A7D', fontWeight: 650 }}>{getWorkerName(shift)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={shift.status} sx={{ fontWeight: 800, borderRadius: '8px', ...getStatusChipSx(shift.status) }} />
                    </TableCell>
                    <TableCell sx={{ color: '#6B5A7D', maxWidth: 260 }}>{shift.notes || '-'}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: 128 }}>
                      <PermissionGate allowed={canWriteShifts} fallback={<Typography component="span" sx={{ color: '#8B7AA8' }}>-</Typography>}>
                        <Tooltip title="Edit">
                          <span>
                            <IconButton
                              aria-label={`Edit ${shift.name}`}
                              onClick={() => openEditModal(shift)}
                              disabled={shift.status === 'CANCELLED'}
                              sx={{ color: '#8B7AA8', '&:hover': { backgroundColor: '#F3E8FF', color: '#7C3AED' } }}
                            >
                              <EditIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <span>
                            <IconButton
                              aria-label={`Cancel ${shift.name}`}
                              onClick={() => cancelShift(shift)}
                              disabled={shift.status === 'CANCELLED'}
                              sx={{ color: '#8B7AA8', '&:hover': { backgroundColor: '#FDECEB', color: '#B91C1C' } }}
                            >
                              <CancelIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Dialog open={modalOpen} onClose={closeModal} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 850, color: '#20113E' }}>{selectedShift ? 'Edit Shift' : 'Create Shift'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.2} sx={{ pt: 1 }}>
              {formError && <Alert severity="error">{formError}</Alert>}
              {securityOperators.length === 0 && <Alert severity="warning">No approved Security Operators are available.</Alert>}
              <TextField label="Shift date" type="date" value={form.shiftDate} onChange={event => updateShiftDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
              <FormControl fullWidth required>
                <InputLabel id="shift-type-label">Shift type</InputLabel>
                <Select
                  labelId="shift-type-label"
                  label="Shift type"
                  value={form.name}
                  onChange={event => updateShiftType(event.target.value)}
                >
                  {shiftTypes.map(shiftType => (
                    <MenuItem key={shiftType.name} value={shiftType.name}>
                      {shiftType.name} ({shiftType.startTime}-{shiftType.endTime}{shiftType.endsNextDay ? ' next day' : ''})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel id="security-operator-label">Assigned Security Operator</InputLabel>
                <Select
                  labelId="security-operator-label"
                  label="Assigned Security Operator"
                  value={form.assignedUserId}
                  onChange={event => setForm({ ...form, assignedUserId: event.target.value })}
                >
                  {securityOperators.map(operator => (
                    <MenuItem key={operator.id} value={operator.id}>{operator.fullName || operator.email}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Start date/time" type="datetime-local" value={form.startAt} onChange={event => setForm({ ...form, startAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
              <TextField label="End date/time" type="datetime-local" value={form.endAt} onChange={event => setForm({ ...form, endAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
              <TextField label="Notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} fullWidth multiline minRows={3} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={closeModal} disabled={saving} sx={{ textTransform: 'none', fontWeight: 800 }}>Cancel</Button>
            <Button
              onClick={submitShift}
              disabled={saving || securityOperators.length === 0}
              variant="contained"
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', backgroundColor: '#6D28D9', boxShadow: 'none', '&:hover': { backgroundColor: '#5B21B6' } }}
            >
              {saving ? 'Saving...' : 'Save Shift'}
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </PermissionGate>
  );
};

export default SecurityShifts;
