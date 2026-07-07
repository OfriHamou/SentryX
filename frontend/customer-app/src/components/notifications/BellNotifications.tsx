import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Circle as UnreadIcon,
  Close as CloseIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type BellNotification,
} from '../../api/notifications';

const TARGET_APP = 'CUSTOMER' as const;
const POLL_MS = 30_000;

const isHandledStatus = (status?: string | null) => {
  const normalized = (status || '').toLowerCase();
  return ['handled', 'resolved', 'dismissed', 'closed', 'done'].includes(normalized);
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString();
};

const dialogPaperSx = {
  borderRadius: '28px !important',
  boxShadow: '0 28px 80px rgba(15, 23, 42, 0.24)',
  overflow: 'hidden',
  border: '1px solid rgba(226, 232, 240, 0.95)',
  backgroundColor: '#FFFFFF',
};

function EventDetailDialog({
  notification,
  onClose,
}: {
  notification: BellNotification | null;
  onClose: () => void;
}) {
  const status = notification?.event?.status ?? 'unknown';
  const handled = isHandledStatus(status);

  return (
    <Dialog
      open={Boolean(notification)}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
      sx={{ '& .MuiDialog-paper': dialogPaperSx }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 1, px: 3, py: 2.25 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, color: '#1F2937' }}>{notification?.title || 'Notification'}</Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDate(notification?.createdAt)}
          </Typography>
        </Box>
        <Chip
          label={status}
          color={handled ? 'success' : 'warning'}
          size="small"
          sx={{ fontWeight: 700, textTransform: 'capitalize' }}
        />
        <IconButton onClick={onClose} aria-label="Close notification details">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
        <Stack spacing={2}>
          {notification?.message && (
            <Typography color="text.secondary">{notification.message}</Typography>
          )}

          <Box>
            <Typography variant="overline" color="text.secondary">Event</Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">ID: {notification?.eventId || 'No linked event'}</Typography>
              <Typography variant="body2">Type: {notification?.event?.eventType || 'Unknown'}</Typography>
              <Typography variant="body2">Created: {formatDate(notification?.event?.createdAt)}</Typography>
              <Typography variant="body2">Image: {notification?.event?.imagePath || 'Not available'}</Typography>
            </Stack>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">Robot</Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">Name: {notification?.robot?.name || 'Unknown'}</Typography>
              <Typography variant="body2">Location: {notification?.robot?.location || 'Unknown'}</Typography>
              <Typography variant="body2">Status: {notification?.robot?.status || 'Unknown'}</Typography>
            </Stack>
          </Box>

          {notification?.metadata && (
            <Box>
              <Typography variant="overline" color="text.secondary">Metadata</Typography>
              <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: '#F6F7FB', borderRadius: 1, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(notification.metadata, null, 2)}
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default function BellNotifications() {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [notifications, setNotifications] = useState<BellNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<BellNotification | null>(null);
  const open = Boolean(anchorEl);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        getNotifications(TARGET_APP),
        getUnreadNotificationCount(TARGET_APP),
      ]);
      setNotifications(items);
      setUnreadCount(count);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    void refresh();
  };

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? now })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(TARGET_APP);
    } catch {
      setErrorMessage('Could not mark notifications as read');
    } finally {
      void refresh();
    }
  };

  const handleNotificationClick = async (notification: BellNotification) => {
    const now = new Date().toISOString();
    const optimistic = { ...notification, isRead: true, readAt: notification.readAt ?? now };
    setSelected(optimistic);
    if (!notification.isRead) {
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((items) => items.map((item) => (item.id === notification.id ? optimistic : item)));
    }

    try {
      const saved = await markNotificationRead(notification.id);
      setSelected(saved);
      setNotifications((items) => items.map((item) => (item.id === saved.id ? saved : item)));
    } catch {
      setErrorMessage('Could not update notification status');
    } finally {
      void refresh();
    }
  };

  const unreadLabel = useMemo(() => (unreadCount > 99 ? '99+' : unreadCount), [unreadCount]);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={handleOpen} sx={{ color: 'rgba(255, 255, 255, 0.85)' }} aria-label="Open notifications">
          <Badge badgeContent={unreadLabel} color="error" invisible={unreadCount === 0}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 360, maxWidth: 'calc(100vw - 32px)' }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', p: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Notifications</Typography>
              <Typography variant="caption" color="text.secondary">{unreadCount} unread</Typography>
            </Box>
            <Button size="small" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              Mark all read
            </Button>
          </Stack>
          <Divider />
          {errorMessage && (
            <Typography sx={{ px: 2, py: 1, bgcolor: '#FEF2F2' }} color="error" variant="body2">
              {errorMessage}
            </Typography>
          )}
          {loading && notifications.length === 0 ? (
            <Box sx={{ p: 3, display: 'grid', placeItems: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Typography sx={{ p: 3 }} color="text.secondary">No notifications</Typography>
          ) : (
            <List disablePadding sx={{ maxHeight: 420, overflow: 'auto' }}>
              {notifications.map((notification) => (
                <ListItemButton
                  key={notification.id}
                  onClick={() => void handleNotificationClick(notification)}
                  sx={{ alignItems: 'flex-start', gap: 1.25, py: 1.5, bgcolor: notification.isRead ? 'transparent' : '#FDECEC' }}
                >
                  <Box sx={{ pt: 0.4, color: notification.isRead ? 'text.disabled' : 'error.main' }}>
                    {notification.isRead ? <CheckCircleIcon fontSize="small" /> : <UnreadIcon sx={{ fontSize: 12 }} />}
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                      <Typography sx={{ fontWeight: notification.isRead ? 600 : 800, flexGrow: 1 }} noWrap>
                        {notification.title || 'Notification'}
                      </Typography>
                      <Chip
                        label={notification.event?.status || 'unknown'}
                        size="small"
                        color={isHandledStatus(notification.event?.status) ? 'success' : 'warning'}
                        sx={{ height: 22, textTransform: 'capitalize' }}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }} noWrap>
                      {notification.message || notification.event?.eventType || 'Event notification'}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">{formatDate(notification.createdAt)}</Typography>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Popover>

      <EventDetailDialog notification={selected} onClose={() => setSelected(null)} />
    </>
  );
}
