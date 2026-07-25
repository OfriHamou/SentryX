import React, { useCallback, useEffect, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useOrganizationAuth } from '../auth/OrganizationAuthProvider';
import { hasOrganizationPermission } from '../auth/permissions';
import AccessDenied from '../components/AccessDenied';
import PermissionGate from '../components/PermissionGate';
import VisitorModal from '../components/VisitorModal';
import { Visitor, VisitorHost } from '../organizationTypes';
import { getHostName, getVisitorStatusChipSx } from './Visitors';

const formatDateTime = (value?: string): string => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || fallback;
  }

  return fallback;
};

const VisitorDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useOrganizationAuth();
  const allowedPages = user?.allowedPages;
  const canReadVisitors = hasOrganizationPermission(allowedPages, 'organization_visitors', 'read');
  const canWriteVisitors = hasOrganizationPermission(allowedPages, 'organization_visitors', 'write');
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [hosts, setHosts] = useState<VisitorHost[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchVisitor = useCallback(async () => {
    if (!canReadVisitors || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [visitorResponse, hostsResponse] = await Promise.all([
        api.get<Visitor>(`/organization/visitors/${id}`),
        canWriteVisitors
          ? api.get<VisitorHost[]>('/organization/visitors/hosts')
          : Promise.resolve({ data: [] as VisitorHost[] }),
      ]);
      setVisitor(visitorResponse.data);
      setHosts(hostsResponse.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to load visitor details.'));
    } finally {
      setLoading(false);
    }
  }, [canReadVisitors, canWriteVisitors, id]);

  useEffect(() => {
    fetchVisitor();
  }, [fetchVisitor]);

  const cancelVisitor = async () => {
    if (!visitor || !window.confirm(`Cancel the expected visit for "${visitor.name}"?`)) {
      return;
    }

    setError('');
    try {
      await api.delete(`/organization/visitors/${visitor.id}`);
      await fetchVisitor();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to cancel visitor.'));
    }
  };

  return (
    <PermissionGate allowed={canReadVisitors} fallback={<AccessDenied />}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        <Box>
          <Button component={RouterLink} to="/visitors" startIcon={<ArrowBackIcon />} sx={{ textTransform: 'none', fontWeight: 800, color: '#5B21B6' }}>
            Back to Visitors
          </Button>
        </Box>
        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', border: '1px solid #E7DEF8', overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress sx={{ color: '#7C3AED' }} />
            </Box>
          ) : visitor ? (
            <>
              <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2, background: '#FAF8FE', borderBottom: '1px solid #E7DEF8' }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E' }}>{visitor.name}</Typography>
                  <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 600 }}>Authorization: Visitor - temporary</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Chip size="small" label={visitor.status} sx={{ fontWeight: 800, borderRadius: '8px', ...getVisitorStatusChipSx(visitor.status) }} />
                  <PermissionGate allowed={canWriteVisitors}>
                    <Button startIcon={<EditIcon />} variant="outlined" onClick={() => setModalOpen(true)} disabled={visitor.status === 'CANCELLED'} sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', borderColor: '#C4B5FD', color: '#5B21B6' }}>
                      Edit
                    </Button>
                    <Button startIcon={<CancelIcon />} variant="outlined" onClick={cancelVisitor} disabled={visitor.status === 'CANCELLED'} sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px', borderColor: '#FCA5A5', color: '#B91C1C' }}>
                      Cancel
                    </Button>
                  </PermissionGate>
                </Stack>
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ p: 3 }}>
                <Box component="img" src={visitor.faceImageUrl} alt={visitor.name} sx={{ width: { xs: '100%', md: 260 }, height: 260, objectFit: 'cover', borderRadius: '12px', border: '1px solid #E7DEF8', backgroundColor: '#F8F5FF' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography sx={{ color: '#7E69A6', fontSize: '0.76rem', fontWeight: 850 }}>CONTACT</Typography>
                      <Typography sx={{ color: '#20113E', fontWeight: 750 }}>{visitor.phone}</Typography>
                      {visitor.email && <Typography sx={{ color: '#6B5A7D', fontWeight: 600 }}>{visitor.email}</Typography>}
                    </Box>
                    <Divider />
                    <Box>
                      <Typography sx={{ color: '#7E69A6', fontSize: '0.76rem', fontWeight: 850 }}>HOST</Typography>
                      <Typography sx={{ color: '#20113E', fontWeight: 750 }}>{getHostName(visitor)}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: '#7E69A6', fontSize: '0.76rem', fontWeight: 850 }}>VISIT WINDOW</Typography>
                      <Typography sx={{ color: '#20113E', fontWeight: 750 }}>{formatDateTime(visitor.startAt)} - {formatDateTime(visitor.endAt)}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: '#7E69A6', fontSize: '0.76rem', fontWeight: 850 }}>PURPOSE</Typography>
                      <Typography sx={{ color: '#20113E', fontWeight: 650, whiteSpace: 'pre-wrap' }}>{visitor.purpose}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ color: '#7E69A6', fontSize: '0.76rem', fontWeight: 850 }}>CREATED</Typography>
                      <Typography sx={{ color: '#20113E', fontWeight: 650 }}>{formatDateTime(visitor.createdAt)}</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </>
          ) : (
            <Box sx={{ p: 4 }}>
              <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => navigate('/visitors')}>Back</Button>}>
                Visitor not found.
              </Alert>
            </Box>
          )}
        </Card>
        <VisitorModal open={modalOpen} visitor={visitor} hosts={hosts} onClose={() => setModalOpen(false)} onSaved={fetchVisitor} />
      </Stack>
    </PermissionGate>
  );
};

export default VisitorDetails;
