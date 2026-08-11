import { Box, Typography } from '@mui/material';
import RobotConfig from '../components/settings/RobotConfig';
import PatrolSchedule from '../components/settings/PatrolSchedule';
import NotificationsSettings from '../components/settings/NotificationsSettings';
import AuthorizedFaces from '../components/settings/AuthorizedFaces';
import AccessDenied from '../components/AccessDenied';
import { hasCustomerPermission, useCustomerAuth } from '../auth/CustomerAuthProvider';

export default function Settings() {
    const { user } = useCustomerAuth();
    const canReadGeneralSettings = hasCustomerPermission(user?.allowedPages, 'settings', 'read');
    const canReadRobots = hasCustomerPermission(user?.allowedPages, 'robots', 'read');
    const canReadFaces = hasCustomerPermission(user?.allowedPages, 'faces', 'read');
    const canReadSettings = canReadGeneralSettings || canReadRobots || canReadFaces;
    const canWriteSettings = hasCustomerPermission(user?.allowedPages, 'settings', 'write');
    const canWriteRobots = hasCustomerPermission(user?.allowedPages, 'robots', 'write');
    const canWriteFaces = hasCustomerPermission(user?.allowedPages, 'faces', 'write');

    if (!canReadSettings) {
        return <AccessDenied />;
    }

    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>Settings</Typography>
            {canReadRobots && <RobotConfig canWrite={canWriteRobots} />}
            {canReadGeneralSettings && <PatrolSchedule canWrite={canWriteSettings} />}
            {canReadGeneralSettings && <NotificationsSettings canWrite={canWriteSettings} />}
            {canReadFaces && <AuthorizedFaces canWrite={canWriteFaces} />}
        </Box>
    );
}
