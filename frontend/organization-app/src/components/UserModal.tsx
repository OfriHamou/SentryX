import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
} from '@mui/material';
import { api } from '../api';
import { OrganizationRole, OrganizationTenantUser } from '../organizationTypes';

interface UserModalProps {
  open: boolean;
  roles: OrganizationRole[];
  rolesLoading: boolean;
  rolesError: string;
  user?: OrganizationTenantUser | null;
  onClose: () => void;
  onSaved: () => void;
  onRetryRoles: () => void;
}

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || 'Failed to save user.';
  }

  return 'Failed to save user.';
};

const UserModal: React.FC<UserModalProps> = ({ open, roles, rolesLoading, rolesError, user, onClose, onSaved, onRetryRoles }) => {
  const isEditMode = Boolean(user);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setFullName(user?.fullName || '');
    setEmail(user?.email || '');
    setPassword('');
    setRoleId(user?.roleId ? String(user.roleId) : roles[0]?.id ? String(roles[0].id) : '');
    setError('');
  }, [open, roles, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (isEditMode && user) {
        await api.put(`/organization/users/${user.id}`, { fullName, roleId });
      } else {
        await api.post('/organization/users', { fullName, email, password, roleId });
      }

      onSaved();
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '14px',
            border: '1px solid #E7DEF8',
            boxShadow: '0 20px 48px rgba(46, 16, 101, 0.14)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box sx={{ p: 1, background: '#FFFFFF' }}>
        <DialogTitle sx={{ fontWeight: 850, color: '#20113E', fontSize: '1.3rem' }}>
          {isEditMode ? 'Edit User' : 'Add User'}
        </DialogTitle>
        <DialogContent>
          <Stack component="form" id="organization-user-form" spacing={2.5} sx={{ pt: 1 }} onSubmit={handleSubmit}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Full name"
              value={fullName}
              onChange={event => setFullName(event.target.value)}
              required
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
            {!isEditMode && (
              <>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </>
            )}
            <FormControl fullWidth required>
              <InputLabel id="organization-user-role-label">Role</InputLabel>
              <Select
                labelId="organization-user-role-label"
                label="Role"
                value={roleId}
                onChange={event => setRoleId(event.target.value)}
                disabled={rolesLoading}
                sx={{ borderRadius: '10px' }}
              >
                {rolesLoading && (
                  <MenuItem value={roleId || ''} disabled>
                    Loading roles...
                  </MenuItem>
                )}
                {!rolesLoading && roles.length === 0 && (
                  <MenuItem value={roleId || ''} disabled>
                    No roles available
                  </MenuItem>
                )}
                {roles.map(role => (
                  <MenuItem key={role.id} value={String(role.id)}>
                    {role.roleName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {rolesError && (
              <Alert
                severity="warning"
                action={
                  <Button color="inherit" size="small" onClick={onRetryRoles}>
                    Retry
                  </Button>
                }
              >
                {rolesError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving} sx={{ color: '#6B5A7D', fontWeight: 700, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="organization-user-form"
            variant="contained"
            disabled={saving || rolesLoading || roles.length === 0 || !roleId}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 3, backgroundColor: '#6D28D9', boxShadow: 'none', '&:hover': { backgroundColor: '#5B21B6' } }}
          >
            {saving ? <CircularProgress size={22} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default UserModal;
