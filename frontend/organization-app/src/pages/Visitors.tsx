import React, { useCallback, useEffect, useState } from 'react';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
import { Link as RouterLink } from 'react-router-dom';
import { api } from '../api';
import { useOrganizationAuth } from '../auth/OrganizationAuthProvider';
import { hasOrganizationPermission } from '../auth/permissions';
import AccessDenied from '../components/AccessDenied';
import PermissionGate from '../components/PermissionGate';
import VisitorModal from '../components/VisitorModal';
import { Visitor, VisitorHost, VisitorStatus } from '../organizationTypes';

const formatDateTime = (value?: string): string => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
};

export const getVisitorStatusChipSx = (status: VisitorStatus) => {
  if (status === 'ACTIVE') {
    return { backgroundColor: '#E6F9F5', color: '#047857' };
  }

  if (status === 'CANCELLED') {
    return { backgroundColor: '#FDECEB', color: '#B91C1C' };
  }

  if (status === 'EXPIRED') {
    return { backgroundColor: '#F1F5F9', color: '#475569' };
  }

  if (status === 'COMPLETED') {
    return { backgroundColor: '#EEF2FF', color: '#4338CA' };
  }

  return { backgroundColor: '#FFF9E6', color: '#B45309' };
};

export const getHostName = (visitor: Visitor): string => (
  visitor.host?.fullName || visitor.host?.email || 'Unassigned'
);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || fallback;
  }

  return fallback;
};

const Visitors: React.FC = () => {
  const { user } = useOrganizationAuth();
  const allowedPages = user?.allowedPages;
  const canReadVisitors = hasOrganizationPermission(allowedPages, 'organization_visitors', 'read');
  const canWriteVisitors = hasOrganizationPermission(allowedPages, 'organization_visitors', 'write');
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [hosts, setHosts] = useState<VisitorHost[]>([]);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!canReadVisitors) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [visitorsResponse, hostsResponse] = await Promise.all([
        api.get<Visitor[]>('/organization/visitors'),
        canWriteVisitors
          ? api.get<VisitorHost[]>('/organization/visitors/hosts')
          : Promise.resolve({ data: [] as VisitorHost[] }),
      ]);
      setVisitors(visitorsResponse.data);
      setHosts(hostsResponse.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to load visitors.'));
    } finally {
      setLoading(false);
    }
  }, [canReadVisitors, canWriteVisitors]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setSelectedVisitor(null);
    setModalOpen(true);
  };

  const openEditModal = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const cancelVisitor = async (visitor: Visitor) => {
    if (!window.confirm(`Cancel the expected visit for "${visitor.name}"?`)) {
      return;
    }

    setError('');
    try {
      await api.delete(`/organization/visitors/${visitor.id}`);
      await fetchData();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to cancel visitor.'));
    }
  };

  return (
    <PermissionGate allowed={canReadVisitors} fallback={<AccessDenied />}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', border: '1px solid #E7DEF8', overflow: 'hidden' }}>
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, background: '#FAF8FE', borderBottom: '1px solid #E7DEF8' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E' }}>
                Visitor Management
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 500 }}>
                Manage expected visits that are temporary within their approved visit windows.
              </Typography>
            </Box>
            <PermissionGate allowed={canWriteVisitors}>
              <Button
                startIcon={<AddCircleOutlineIcon />}
                variant="contained"
                onClick={openCreateModal}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', px: 2.5, backgroundColor: '#6D28D9', boxShadow: 'none', '&:hover': { backgroundColor: '#5B21B6' } }}
              >
                New Expected Visit
              </Button>
            </PermissionGate>
          </Box>
          <TableContainer component={Box} sx={{ maxHeight: 680, pl: { xs: 1.5, md: 2 }, pr: { xs: 3, md: 4 } }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { backgroundColor: '#FFFFFF', fontWeight: 850, color: '#7E69A6', py: 2.2, borderBottom: '1px solid #E7DEF8', fontSize: '0.76rem', letterSpacing: 0.5 } }}>
                  <TableCell>VISITOR</TableCell>
                  <TableCell>VISIT WINDOW</TableCell>
                  <TableCell>HOST</TableCell>
                  <TableCell>STATUS</TableCell>
                  <TableCell>AUTHORIZATION</TableCell>
                  <TableCell align="center" sx={{ width: 148 }}>ACTIONS</TableCell>
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
                {!loading && visitors.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 10 }}>
                      <BlockIcon sx={{ fontSize: 60, color: '#e2e8f0', mb: 2 }} />
                      <Typography variant="h6" color="#6B5A7D" sx={{ fontWeight: 700 }}>No current or upcoming visits</Typography>
                      <Typography variant="body2" color="#a0aec0">Create an expected visit to grant temporary recognition during a time window.</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && visitors.map(visitor => (
                  <TableRow key={visitor.id} hover sx={{ '& td': { borderBottom: '1px solid #F1EBFF', py: 2.4 }, '&:hover td': { backgroundColor: '#FCFAFF' } }}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 800, color: '#20113E', fontSize: '0.95rem' }}>{visitor.name}</Typography>
                      <Typography sx={{ color: '#8B7AA8', fontSize: '0.82rem', fontWeight: 600 }}>{visitor.phone}</Typography>
                    </TableCell>
                    <TableCell sx={{ color: '#6B5A7D', fontWeight: 500 }}>{formatDateTime(visitor.startAt)} - {formatDateTime(visitor.endAt)}</TableCell>
                    <TableCell sx={{ color: '#6B5A7D', fontWeight: 650 }}>{getHostName(visitor)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={visitor.status} sx={{ fontWeight: 800, borderRadius: '8px', ...getVisitorStatusChipSx(visitor.status) }} />
                    </TableCell>
                    <TableCell sx={{ color: '#6B5A7D', fontWeight: 650 }}>Visitor - temporary</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap', width: 148 }}>
                      <Tooltip title="Details">
                        <IconButton
                          component={RouterLink}
                          to={`/visitors/${visitor.id}`}
                          aria-label={`View ${visitor.name}`}
                          sx={{ color: '#8B7AA8', '&:hover': { backgroundColor: '#F3E8FF', color: '#7C3AED' } }}
                        >
                          <InfoOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                      <PermissionGate allowed={canWriteVisitors}>
                        <Tooltip title="Edit">
                          <span>
                            <IconButton
                              aria-label={`Edit ${visitor.name}`}
                              onClick={() => openEditModal(visitor)}
                              disabled={visitor.status === 'CANCELLED'}
                              sx={{ color: '#8B7AA8', '&:hover': { backgroundColor: '#F3E8FF', color: '#7C3AED' } }}
                            >
                              <EditIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <span>
                            <IconButton
                              aria-label={`Cancel ${visitor.name}`}
                              onClick={() => cancelVisitor(visitor)}
                              disabled={visitor.status === 'CANCELLED'}
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

        <VisitorModal open={modalOpen} visitor={selectedVisitor} hosts={hosts} onClose={closeModal} onSaved={fetchData} />
      </Stack>
    </PermissionGate>
  );
};

export default Visitors;
