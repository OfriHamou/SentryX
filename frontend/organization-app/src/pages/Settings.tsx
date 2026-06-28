import React from 'react';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import SecurityIcon from '@mui/icons-material/Security';
import { Box, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import { useOrganizationAuth } from '../auth/OrganizationAuthProvider';
import { hasOrganizationPermission } from '../auth/permissions';
import AccessDenied from '../components/AccessDenied';
import PermissionGate from '../components/PermissionGate';

const Settings: React.FC = () => {
  const { user, tenant } = useOrganizationAuth();
  const allowedPages = user?.allowedPages;
  const canReadSettings = hasOrganizationPermission(allowedPages, 'organization_settings', 'read') ||
    hasOrganizationPermission(allowedPages, 'organization_portal', 'read');

  const permissionSummary = [
    {
      label: 'Portal read',
      enabled: hasOrganizationPermission(allowedPages, 'organization_portal', 'read'),
    },
    {
      label: 'Users read',
      enabled: hasOrganizationPermission(allowedPages, 'organization_users', 'read'),
    },
    {
      label: 'Users write',
      enabled: hasOrganizationPermission(allowedPages, 'organization_users', 'write'),
    },
    {
      label: 'Settings read',
      enabled: hasOrganizationPermission(allowedPages, 'organization_settings', 'read'),
    },
  ];

  return (
    <PermissionGate allowed={canReadSettings} fallback={<AccessDenied />}>
      <Stack spacing={3}>
        <Card sx={{ borderRadius: '14px', boxShadow: '0 10px 28px rgba(46, 16, 101, 0.05)', background: '#FFFFFF', border: '1px solid #E7DEF8', overflow: 'hidden' }}>
          <Box sx={{ p: 3, px: { xs: 3, md: 4 }, background: '#FAF8FE', borderBottom: '1px solid #E7DEF8' }}>
            <Typography variant="h5" sx={{ fontWeight: 850, color: '#20113E' }}>
              Organization Settings
            </Typography>
            <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 500 }}>
              Read-only organization and current user details.
            </Typography>
          </Box>

          <Stack spacing={3} sx={{ px: { xs: 3, md: 4 }, py: 4 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 3 }}>
              <Box sx={{ p: 3, border: '1px solid #E7DEF8', borderRadius: '12px', background: '#FCFAFF', display: 'flex', gap: 2 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: '#F5F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BusinessIcon sx={{ color: '#7C3AED' }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" sx={{ color: '#8B7AA8', fontWeight: 800 }}>
                    ORGANIZATION
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#20113E', fontWeight: 850 }}>
                    {tenant?.name || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#8B7AA8', fontFamily: "'Fira Code', monospace", overflowWrap: 'anywhere' }}>
                    {tenant?.id || 'N/A'}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ p: 3, border: '1px solid #E7DEF8', borderRadius: '12px', background: '#FFFFFF', display: 'flex', gap: 2 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: '#E6F9F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PersonIcon sx={{ color: '#05CD99' }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" sx={{ color: '#8B7AA8', fontWeight: 800 }}>
                    CURRENT USER
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#20113E', fontWeight: 850 }}>
                    {user?.fullName || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6B5A7D', overflowWrap: 'anywhere' }}>
                    {user?.email || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 700 }}>
                    Role: {user?.roleName || 'N/A'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6B5A7D', mt: 0.5, fontWeight: 700 }}>
                    Status: {user?.status === 'PENDING_APPROVAL' ? 'Pending approval' : user?.status || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider />

            <Box sx={{ p: 3, border: '1px solid #E7DEF8', borderRadius: '12px', background: '#FFFFFF' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '12px', backgroundColor: '#FFF9E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SecurityIcon sx={{ color: '#FFCE20' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ color: '#20113E', fontWeight: 850 }}>
                    Portal Access Summary
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#6B5A7D', fontWeight: 500 }}>
                    Permissions are inherited from global SentryX-managed roles.
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {permissionSummary.map(permission => (
                  <Chip
                    key={permission.label}
                    label={`${permission.label}: ${permission.enabled ? 'Yes' : 'No'}`}
                    sx={{
                      fontWeight: 700,
                      borderRadius: '8px',
                      backgroundColor: permission.enabled ? '#E6F9F5' : '#F8F5FF',
                      color: permission.enabled ? '#05CD99' : '#8B7AA8',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        </Card>
      </Stack>
    </PermissionGate>
  );
};

export default Settings;
