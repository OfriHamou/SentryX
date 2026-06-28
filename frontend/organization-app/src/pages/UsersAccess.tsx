import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import BlockIcon from '@mui/icons-material/Block';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { api } from '../api';
import { useOrganizationAuth } from '../auth/OrganizationAuthProvider';
import { hasOrganizationPermission } from '../auth/permissions';
import AccessDenied from '../components/AccessDenied';
import PermissionGate from '../components/PermissionGate';
import UserModal from '../components/UserModal';
import { OrganizationRole, OrganizationTenantUser } from '../organizationTypes';

const formatDate = (value: string): string => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
};

const getStatusChipSx = (status: OrganizationTenantUser['status']) => {
  if (status === 'APPROVED') {
    return { backgroundColor: '#E6F9F5', color: '#05CD99' };
  }

  if (status === 'REJECTED') {
    return { backgroundColor: '#FDECEB', color: '#EE5D50' };
  }

  return { backgroundColor: '#FFF9E6', color: '#D97706' };
};

const UsersAccess: React.FC = () => {
  const { user } = useOrganizationAuth();
  const allowedPages = user?.allowedPages;
  const canReadUsers = hasOrganizationPermission(allowedPages, 'organization_users', 'read');
  const canWriteUsers = hasOrganizationPermission(allowedPages, 'organization_users', 'write');
  const [users, setUsers] = useState<OrganizationTenantUser[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [error, setError] = useState('');
  const [rolesError, setRolesError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrganizationTenantUser | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!canReadUsers) {
      return;
    }

    setRolesLoading(true);
    setRolesError('');

    try {
      const { data } = await api.get<OrganizationRole[]>('/organization/roles');
      setRoles(data);
      if (data.length === 0) {
        setRolesError('No assignable organization roles are available.');
      }
    } catch {
      setRoles([]);
      setRolesError('Failed to load roles.');
    } finally {
      setRolesLoading(false);
    }
  }, [canReadUsers]);

  const fetchData = useCallback(async () => {
    if (!canReadUsers) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.get<OrganizationTenantUser[]>('/organization/users');
      setUsers(data);
      fetchRoles();
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [canReadUsers, fetchRoles]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasRoles = useMemo(() => roles.length > 0, [roles]);

  const handleAdd = () => {
    if (roles.length === 0) {
      fetchRoles();
    }
    setSelectedUser(null);
    setModalOpen(true);
  };

  const handleEdit = (tenantUser: OrganizationTenantUser) => {
    if (roles.length === 0) {
      fetchRoles();
    }
    setSelectedUser(tenantUser);
    setModalOpen(true);
  };

  return (
    <PermissionGate allowed={canReadUsers} fallback={<AccessDenied />}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        {rolesError && !modalOpen && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={fetchRoles}>
                Retry
              </Button>
            }
          >
            {rolesError}
          </Alert>
        )}
        {!hasRoles && !loading && !rolesLoading && !rolesError && !error && (
          <Alert severity="info">No assignable organization roles are available.</Alert>
        )}

        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E7DEF8' }}>
          <Box
            sx={{
              p: 3,
              px: { xs: 3, md: 4 },
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
              background: '#FAF8FE',
              borderBottom: '1px solid #E7DEF8',
            }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E' }}>
                Organization Users
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 500 }}>
                Manage users and assign existing global SentryX roles.
              </Typography>
            </Box>
            <PermissionGate allowed={canWriteUsers}>
              <Button
                startIcon={<AddCircleOutlineIcon />}
                variant="contained"
                onClick={handleAdd}
                disabled={rolesLoading || !hasRoles}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 2.5, backgroundColor: '#6D28D9', boxShadow: 'none', '&:hover': { backgroundColor: '#5B21B6' } }}
              >
                Add User
              </Button>
            </PermissionGate>
          </Box>
          <TableContainer component={Box} sx={{ maxHeight: 640, px: { xs: 1.5, md: 2 } }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { backgroundColor: '#FFFFFF', fontWeight: 850, color: '#7E69A6', py: 2.2, borderBottom: '1px solid #E7DEF8', fontSize: '0.76rem', letterSpacing: 0.5 } }}>
                  <TableCell>FULL NAME</TableCell>
                  <TableCell>EMAIL</TableCell>
                  <TableCell>STATUS</TableCell>
                  <TableCell>ROLE</TableCell>
                  <TableCell>CUSTOMER APP</TableCell>
                  <TableCell>ORG PORTAL</TableCell>
                  <TableCell>CREATED AT</TableCell>
                  <TableCell align="right">ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                      <CircularProgress size={50} thickness={4} sx={{ color: '#7C3AED' }} />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 10 }}>
                      <BlockIcon sx={{ fontSize: 60, color: '#e2e8f0', mb: 2 }} />
                      <Typography variant="h6" color="#6B5A7D" sx={{ fontWeight: 700 }}>
                        No users found
                      </Typography>
                      <Typography variant="body2" color="#a0aec0">
                        Add an organization user to populate this view.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && users.map(tenantUser => {
                  const hasCustomerAccess = hasOrganizationPermission(tenantUser.allowedPages, 'customer_portal', 'read');
                  const hasPortalAccess = hasOrganizationPermission(tenantUser.allowedPages, 'organization_portal', 'read');

                  return (
                    <TableRow key={tenantUser.id} hover sx={{ '& td': { borderBottom: '1px solid #F1EBFF', py: 2.4 }, '&:hover td': { backgroundColor: '#FCFAFF' } }}>
                      <TableCell sx={{ fontWeight: 750, color: '#20113E', fontSize: '0.95rem' }}>{tenantUser.fullName}</TableCell>
                      <TableCell sx={{ color: '#6B5A7D', fontWeight: 500 }}>{tenantUser.email}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={tenantUser.status === 'PENDING_APPROVAL' ? 'Pending' : tenantUser.status === 'REJECTED' ? 'Rejected' : 'Approved'}
                          sx={{ fontWeight: 800, borderRadius: '8px', ...getStatusChipSx(tenantUser.status) }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={tenantUser.roleName}
                          size="small"
                          sx={{ fontWeight: 800, backgroundColor: '#F5F0FF', color: '#6D28D9', borderRadius: '8px' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={hasCustomerAccess ? 'Yes' : 'No'}
                          sx={{
                            fontWeight: 700,
                            borderRadius: '8px',
                            backgroundColor: hasCustomerAccess ? '#E6F9F5' : '#F8F5FF',
                            color: hasCustomerAccess ? '#05CD99' : '#8B7AA8',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={hasPortalAccess ? 'Yes' : 'No'}
                          sx={{
                            fontWeight: 700,
                            borderRadius: '8px',
                            backgroundColor: hasPortalAccess ? '#E6F9F5' : '#F8F5FF',
                            color: hasPortalAccess ? '#05CD99' : '#8B7AA8',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#8B7AA8', fontWeight: 500 }}>{formatDate(tenantUser.createdAt)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <PermissionGate allowed={canWriteUsers} fallback={<Typography component="span" sx={{ color: '#8B7AA8' }}>-</Typography>}>
                          <Tooltip title="Edit">
                            <IconButton
                              aria-label={`Edit ${tenantUser.fullName}`}
                              onClick={() => handleEdit(tenantUser)}
                              sx={{ color: '#8B7AA8', '&:hover': { backgroundColor: '#F3E8FF', color: '#7C3AED' } }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <UserModal
          open={modalOpen}
          roles={roles}
          rolesLoading={rolesLoading}
          rolesError={rolesError}
          user={selectedUser}
          onClose={() => setModalOpen(false)}
          onSaved={fetchData}
          onRetryRoles={fetchRoles}
        />
      </Stack>
    </PermissionGate>
  );
};

export default UsersAccess;
