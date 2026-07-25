import React, { useEffect, useMemo, useState } from 'react';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api } from '../api';
import { Visitor, VisitorHost } from '../organizationTypes';

interface VisitorModalProps {
  open: boolean;
  visitor: Visitor | null;
  hosts: VisitorHost[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface VisitorFormState {
  name: string;
  phone: string;
  email: string;
  startAt: string;
  endAt: string;
  hostUserId: string;
  purpose: string;
  faceImage: File | null;
}

const emptyForm: VisitorFormState = {
  name: '',
  phone: '',
  email: '',
  startAt: '',
  endAt: '',
  hostUserId: '',
  purpose: '',
  faceImage: null,
};

const toDateTimeLocal = (value: string): string => {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || 'Failed to save visitor.';
  }

  return 'Failed to save visitor.';
};

const buildFormData = (form: VisitorFormState): FormData => {
  const formData = new FormData();
  formData.append('name', form.name.trim());
  formData.append('phone', form.phone.trim());
  formData.append('email', form.email.trim());
  formData.append('startAt', new Date(form.startAt).toISOString());
  formData.append('endAt', new Date(form.endAt).toISOString());
  formData.append('hostUserId', form.hostUserId);
  formData.append('purpose', form.purpose.trim());
  if (form.faceImage) {
    formData.append('faceImage', form.faceImage);
  }

  return formData;
};

const validateForm = (form: VisitorFormState, editing: boolean): string | null => {
  if (!form.name.trim()) return 'Visitor name is required.';
  if (!form.phone.trim()) return 'Phone number is required.';
  if (!form.hostUserId) return 'Host is required.';
  if (!form.purpose.trim()) return 'Visit purpose is required.';
  if (!form.startAt) return 'Visit start date/time is required.';
  if (!form.endAt) return 'Visit end date/time is required.';
  if (!editing && !form.faceImage) return 'Face image is required.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email must be valid.';
  if (new Date(form.endAt) <= new Date(form.startAt)) return 'Visit end must be after the start time.';
  return null;
};

const VisitorModal: React.FC<VisitorModalProps> = ({ open, visitor, hosts, onClose, onSaved }) => {
  const [form, setForm] = useState<VisitorFormState>(emptyForm);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormError('');
    setPreviewUrl(visitor?.faceImageUrl || '');
    setForm(visitor ? {
      name: visitor.name,
      phone: visitor.phone,
      email: visitor.email || '',
      startAt: toDateTimeLocal(visitor.startAt),
      endAt: toDateTimeLocal(visitor.endAt),
      hostUserId: visitor.host?.id || '',
      purpose: visitor.purpose,
      faceImage: null,
    } : emptyForm);
  }, [open, visitor]);

  useEffect(() => {
    if (!form.faceImage) {
      return undefined;
    }

    const url = URL.createObjectURL(form.faceImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [form.faceImage]);

  const validationError = useMemo(() => validateForm(form, Boolean(visitor)), [form, visitor]);

  const closeModal = () => {
    if (!saving) {
      onClose();
    }
  };

  const submitVisitor = async () => {
    const error = validateForm(form, Boolean(visitor));
    if (error) {
      setFormError(error);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const formData = buildFormData(form);
      if (visitor) {
        await api.put(`/organization/visitors/${visitor.id}`, formData);
      } else {
        await api.post('/organization/visitors', formData);
      }
      await onSaved();
      onClose();
    } catch (requestError) {
      setFormError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={closeModal} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 850, color: '#20113E' }}>
        {visitor ? 'Edit Expected Visit' : 'New Expected Visit'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.2} sx={{ pt: 1 }}>
          {formError && <Alert severity="error">{formError}</Alert>}
          {hosts.length === 0 && <Alert severity="warning">No approved hosts are available.</Alert>}
          <TextField label="Visitor name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} fullWidth required />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Phone number" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} fullWidth required />
            <TextField label="Email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Visit start" type="datetime-local" value={form.startAt} onChange={event => setForm({ ...form, startAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
            <TextField label="Visit end" type="datetime-local" value={form.endAt} onChange={event => setForm({ ...form, endAt: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth required />
          </Stack>
          <FormControl fullWidth required>
            <InputLabel id="visitor-host-label">Host / employee responsible</InputLabel>
            <Select
              labelId="visitor-host-label"
              label="Host / employee responsible"
              value={form.hostUserId}
              onChange={event => setForm({ ...form, hostUserId: event.target.value })}
            >
              {hosts.map(host => (
                <MenuItem key={host.id} value={host.id}>{host.fullName || host.email}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Visit purpose" value={form.purpose} onChange={event => setForm({ ...form, purpose: event.target.value })} fullWidth multiline minRows={3} required />
          <Box>
            <Button
              component="label"
              startIcon={<PhotoCameraIcon />}
              variant="outlined"
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', borderColor: '#C4B5FD', color: '#5B21B6' }}
            >
              {visitor ? 'Replace Face Image' : 'Upload Face Image'}
              <input
                hidden
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={event => setForm({ ...form, faceImage: event.target.files?.[0] || null })}
              />
            </Button>
            {previewUrl && (
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box component="img" src={previewUrl} alt={form.name || 'Visitor face preview'} sx={{ width: 88, height: 88, objectFit: 'cover', borderRadius: '10px', border: '1px solid #E7DEF8' }} />
                <Typography sx={{ color: '#6B5A7D', fontWeight: 650 }}>{form.faceImage?.name || 'Current visitor image'}</Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={closeModal} disabled={saving} sx={{ textTransform: 'none', fontWeight: 800 }}>Cancel</Button>
        <Button
          onClick={submitVisitor}
          disabled={saving || hosts.length === 0 || Boolean(validationError)}
          variant="contained"
          sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', backgroundColor: '#6D28D9', boxShadow: 'none', '&:hover': { backgroundColor: '#5B21B6' } }}
        >
          {saving ? 'Saving...' : 'Save Visit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VisitorModal;
