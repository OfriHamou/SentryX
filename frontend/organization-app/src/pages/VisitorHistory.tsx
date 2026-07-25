import React, { useCallback, useEffect, useState } from 'react';
import BlockIcon from '@mui/icons-material/Block';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Box,
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
import { Visitor } from '../organizationTypes';
import { getHostName, getVisitorStatusChipSx } from './Visitors';

const formatDateTime = (value?: string): string => {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString();
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    return response?.data?.message || 'Failed to load visitor history.';
  }

  return 'Failed to load visitor history.';
};

const VisitorHistory: React.FC = () => {
  const { user } = useOrganizationAuth();
  const canReadVisitors = hasOrganizationPermission(user?.allowedPages, 'organization_visitors', 'read');
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = useCallback(async () => {
    if (!canReadVisitors) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.get<Visitor[]>('/organization/visitors?view=history');
      setVisitors(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [canReadVisitors]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <PermissionGate allowed={canReadVisitors} fallback={<AccessDenied />}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', border: '1px solid #E7DEF8', overflow: 'hidden' }}>
          <Box sx={{ p: 3, background: '#FAF8FE', borderBottom: '1px solid #E7DEF8' }}>
            <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E' }}>Visitor History</Typography>
            <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 500 }}>
              Review expired, completed, and cancelled expected visits.
            </Typography>
          </Box>
          <TableContainer component={Box} sx={{ maxHeight: 680, pl: { xs: 1.5, md: 2 }, pr: { xs: 3, md: 4 } }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ '& th': { backgroundColor: '#FFFFFF', fontWeight: 850, color: '#7E69A6', py: 2.2, borderBottom: '1px solid #E7DEF8', fontSize: '0.76rem', letterSpacing: 0.5 } }}>
                  <TableCell>VISITOR</TableCell>
                  <TableCell>VISIT WINDOW</TableCell>
                  <TableCell>HOST</TableCell>
                  <TableCell>PURPOSE</TableCell>
                  <TableCell>STATUS</TableCell>
                  <TableCell align="center" sx={{ width: 84 }}>DETAILS</TableCell>
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
                      <Typography variant="h6" color="#6B5A7D" sx={{ fontWeight: 700 }}>No visitor history found</Typography>
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
                    <TableCell sx={{ color: '#6B5A7D', maxWidth: 320 }}>{visitor.purpose}</TableCell>
                    <TableCell>
                      <Chip size="small" label={visitor.status} sx={{ fontWeight: 800, borderRadius: '8px', ...getVisitorStatusChipSx(visitor.status) }} />
                    </TableCell>
                    <TableCell align="center">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Stack>
    </PermissionGate>
  );
};

export default VisitorHistory;
