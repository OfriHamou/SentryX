import React, { useEffect, useState } from 'react';
import BusinessIcon from '@mui/icons-material/Business';
import PeopleIcon from '@mui/icons-material/People';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import GroupsIcon from '@mui/icons-material/Groups';
import { Alert, Box, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import { api } from '../api';
import { useOrganizationAuth } from '../auth/OrganizationAuthProvider';
import { hasOrganizationPermission } from '../auth/permissions';
import AccessDenied from '../components/AccessDenied';
import PermissionGate from '../components/PermissionGate';

interface OrgSummary {
  usersCount: number;
  customerAccessCount: number;
  organizationAccessCount: number;
}

const cardSx = {
  borderRadius: '14px',
  boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)',
  border: '1px solid #E7DEF8',
  height: '100%',
  background: '#FFFFFF',
};

const Dashboard: React.FC = () => {
  const { user, tenant } = useOrganizationAuth();
  const canReadPortal = hasOrganizationPermission(user?.allowedPages, 'organization_portal', 'read');
  const [summary, setSummary] = useState<OrgSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      if (!canReadPortal) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/organization/summary');
        setSummary(data);
      } catch {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [canReadPortal]);

  const stats = [
    {
      title: 'Total Users',
      value: summary?.usersCount ?? 0,
      subtitle: 'Tenant-scoped accounts',
      subtitleColor: '#05CD99',
      icon: <PeopleIcon sx={{ fontSize: 26, color: '#7C3AED' }} />,
      bg: '#F3E8FF',
    },
    {
      title: 'Customer Access',
      value: summary?.customerAccessCount ?? 0,
      subtitle: 'Can enter Customer App',
      subtitleColor: '#05CD99',
      icon: <VerifiedUserIcon sx={{ fontSize: 26, color: '#05CD99' }} />,
      bg: '#E6F9F5',
    },
    {
      title: 'Portal Access',
      value: summary?.organizationAccessCount ?? 0,
      subtitle: 'Can enter this portal',
      subtitleColor: '#7C3AED',
      icon: <GroupsIcon sx={{ fontSize: 26, color: '#7C3AED' }} />,
      bg: '#F3E8FF',
    },
    {
      title: 'Your Role',
      value: user?.roleName || 'N/A',
      subtitle: 'Global SentryX role',
      subtitleColor: '#D97706',
      icon: <BusinessIcon sx={{ fontSize: 26, color: '#FFCE20' }} />,
      bg: '#FFF9E6',
    },
  ];

  return (
    <PermissionGate allowed={canReadPortal} fallback={<AccessDenied />}>
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
          {stats.map(stat => (
            <Card key={stat.title} sx={cardSx}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '12px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2, flexShrink: 0 }}>
                  {stat.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#8B7AA8', mb: 0.5 }}>
                    {stat.title}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 850, color: '#20113E', mb: 0.5, overflowWrap: 'anywhere' }}>
                    {loading ? '-' : stat.value}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 500, color: stat.subtitleColor }}>
                    {stat.subtitle}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Card sx={{ ...cardSx, overflow: 'hidden' }}>
          <Box
            sx={{
              p: 3,
              px: { xs: 3, md: 4 },
              background: '#FAF8FE',
              borderBottom: '1px solid #E7DEF8',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E' }}>
              Organization Profile
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 500 }}>
              Read-only details for the current organization context.
            </Typography>
          </Box>
          <CardContent sx={{ px: { xs: 3, md: 4 }, pb: 4, pt: 3 }}>
            {loading ? (
              <Box sx={{ py: 7, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={50} thickness={4} sx={{ color: '#7C3AED' }} />
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
                <Box sx={{ p: 3, border: '1px solid #E7DEF8', borderRadius: '12px', background: '#FCFAFF' }}>
                  <Typography variant="overline" sx={{ color: '#8B7AA8', fontWeight: 800 }}>
                    ORGANIZATION
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#20113E', fontWeight: 850 }}>
                    {tenant?.name || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#8B7AA8', fontFamily: "'Fira Code', monospace", fontSize: '0.85rem', fontWeight: 500 }}>
                    {tenant?.id || 'N/A'}
                  </Typography>
                </Box>
                <Box sx={{ p: 3, border: '1px solid #E7DEF8', borderRadius: '12px', background: '#FFFFFF' }}>
                  <Typography variant="overline" sx={{ color: '#8B7AA8', fontWeight: 800 }}>
                    CURRENT USER
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#20113E', fontWeight: 850 }}>
                    {user?.fullName || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6B5A7D', fontWeight: 500 }}>
                    {user?.email || 'N/A'} - {user?.roleName || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 1, fontWeight: 700 }}>
                    Status: {user?.status === 'PENDING_APPROVAL' ? 'Pending approval' : user?.status || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      </Stack>
    </PermissionGate>
  );
};

export default Dashboard;
