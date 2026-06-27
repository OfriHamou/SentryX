import { useEffect, useState } from 'react';
import {
    Typography,
    Button,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Chip,
    Alert,
} from '@mui/material';
import {
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
} from '@mui/icons-material';
import * as api from '../api';

interface RegistrationRequest {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    jobTitle: string | null;
    status: string;
    createdAt: string;
    rejectedAt?: string | null;
    rejectionReason?: string | null;
    tenantId: string;
    tenantName: string;
    tenantInviteCode: string | null;
    roleId: number;
    roleName: string;
}

export const RegistrationRequestsTab = () => {
    const [requests, setRequests] = useState<RegistrationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; userId: string | null }>({ open: false, userId: null });
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const data = await api.getRegistrationRequests();
            setRequests(data);
        } catch (err: any) {
            setErrorMessage(err.response?.data?.message || 'Failed to load registration requests');
            console.error('Error loading requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (userId: string) => {
        setActionLoading(true);
        setErrorMessage('');
        try {
            await api.approveRegistrationRequest(userId);
            setSuccessMessage('Registration approved successfully');
            setTimeout(() => setSuccessMessage(''), 3000);
            await loadRequests();
        } catch (err: any) {
            setErrorMessage(err.response?.data?.message || 'Failed to approve registration');
            console.error('Error approving:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectClick = (userId: string) => {
        setRejectDialog({ open: true, userId });
        setRejectionReason('');
    };

    const handleRejectConfirm = async () => {
        if (!rejectDialog.userId) return;

        setActionLoading(true);
        setErrorMessage('');
        try {
            await api.rejectRegistrationRequest(rejectDialog.userId, rejectionReason || undefined);
            setSuccessMessage('Registration rejected successfully');
            setTimeout(() => setSuccessMessage(''), 3000);
            setRejectDialog({ open: false, userId: null });
            setRejectionReason('');
            await loadRequests();
        } catch (err: any) {
            setErrorMessage(err.response?.data?.message || 'Failed to reject registration');
            console.error('Error rejecting:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const getStatusChipStyles = (status: string) => {
        if (status === 'REJECTED') {
            return {
                backgroundColor: '#FDECEB',
                color: '#C53030',
                border: '1px solid #FEB2B2',
            };
        }

        return {
            backgroundColor: '#FFF8E1',
            color: '#B7791F',
            border: '1px solid #F6D365',
        };
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: '#1A202C' }}>
                Registration Requests
            </Typography>

            {successMessage && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
                    {successMessage}
                </Alert>
            )}

            {errorMessage && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage('')}>
                    {errorMessage}
                </Alert>
            )}

            {requests.length === 0 ? (
                <Box
                    sx={{
                        textAlign: 'center',
                        py: 4,
                        color: '#4A5568',
                    }}
                >
                    <Typography variant="body1">No pending or rejected registration requests</Typography>
                </Box>
            ) : (
                <TableContainer
                    sx={{
                        borderRadius: 2,
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        overflow: 'hidden',
                    }}
                >
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                                <TableCell sx={{ color: '#2D3748', fontWeight: 800 }}>Company</TableCell>
                                <TableCell sx={{ color: '#2D3748', fontWeight: 800 }}>Organization ID</TableCell>
                                <TableCell sx={{ color: '#2D3748', fontWeight: 800 }}>Full Name</TableCell>
                                <TableCell sx={{ color: '#2D3748', fontWeight: 800 }}>Email</TableCell>
                                <TableCell sx={{ color: '#2D3748', fontWeight: 800 }}>Status</TableCell>
                                <TableCell sx={{ color: '#2D3748', fontWeight: 800 }}>Reason</TableCell>
                                <TableCell sx={{ color: '#2D3748', fontWeight: 800 }}>Requested At</TableCell>
                                <TableCell sx={{ color: '#2D3748', fontWeight: 800 }} align="right">
                                    Actions
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {requests.map((request) => (
                                <TableRow
                                    key={request.id}
                                    sx={{
                                        backgroundColor: '#FFFFFF',
                                        '& td': {
                                            borderBottom: '1px solid #EDF2F7',
                                        },
                                        '&:hover': {
                                            backgroundColor: '#F8FAFC',
                                        },
                                    }}
                                >
                                    <TableCell sx={{ color: '#1A202C', fontWeight: 700 }}>{request.tenantName}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={request.tenantInviteCode || 'N/A'}
                                            size="small"
                                            sx={{
                                                backgroundColor: '#E8EEFF',
                                                color: '#3155D4',
                                                border: '1px solid #C7D2FE',
                                                fontWeight: 700,
                                                fontFamily: "'Fira Code', monospace",
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ color: '#2D3748' }}>{request.fullName || '-'}</TableCell>
                                    <TableCell sx={{ color: '#2D3748' }}>{request.email}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={request.status === 'REJECTED' ? 'Rejected' : 'Pending'}
                                            size="small"
                                            sx={{
                                                ...getStatusChipStyles(request.status),
                                                fontWeight: 700,
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ color: '#E2E8F0', maxWidth: 220 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: request.rejectionReason ? '#2D3748' : '#A0AEC0',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                            title={request.rejectionReason || undefined}
                                        >
                                            {request.rejectionReason || '-'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ color: '#4A5568', fontSize: '0.875rem' }}>
                                        {formatDate(request.createdAt)}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button
                                            startIcon={<CheckCircleIcon />}
                                            onClick={() => handleApprove(request.id)}
                                            disabled={actionLoading}
                                            sx={{
                                                color: '#05CD99',
                                                mr: 1,
                                                textTransform: 'none',
                                                '&:hover': { backgroundColor: 'rgba(5, 205, 153, 0.1)' },
                                            }}
                                            size="small"
                                        >
                                            Approve
                                        </Button>
                                        {request.status !== 'REJECTED' && (
                                            <Button
                                                startIcon={<CancelIcon />}
                                                onClick={() => handleRejectClick(request.id)}
                                                disabled={actionLoading}
                                                sx={{
                                                    color: '#FF6B6B',
                                                    textTransform: 'none',
                                                    '&:hover': { backgroundColor: 'rgba(255, 107, 107, 0.1)' },
                                                }}
                                                size="small"
                                            >
                                                Reject
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Reject Dialog */}
            <Dialog
                open={rejectDialog.open}
                onClose={() => setRejectDialog({ open: false, userId: null })}
                slotProps={{
                    paper: {
                        sx: {
                            backgroundColor: '#FFFFFF',
                            color: '#1A202C',
                            borderRadius: 2,
                            boxShadow: '0 24px 70px rgba(15, 23, 42, 0.35)',
                        },
                    },
                }}
            >
                <DialogTitle sx={{ backgroundColor: '#F8FAFC', color: '#1A202C', fontWeight: 700 }}>
                    Reject Registration Request
                </DialogTitle>
                <DialogContent sx={{ pt: 2.5, backgroundColor: '#FFFFFF' }}>
                    <Typography variant="body2" sx={{ mb: 2, color: '#4A5568' }}>
                        Provide an optional reason for rejecting this registration request.
                    </Typography>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Rejection Reason (Optional)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g., Company not verified, duplicate account, etc."
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                backgroundColor: '#FFFFFF',
                                color: '#1A202C',
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#4318FF',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#4318FF',
                                    borderWidth: 2,
                                },
                            },
                            '& .MuiInputLabel-root': {
                                color: '#4A5568',
                                '&.Mui-focused': {
                                    color: '#4318FF',
                                },
                            },
                            '& .MuiOutlinedInput-input': {
                                color: '#1A202C',
                                '&::placeholder': {
                                    color: '#718096',
                                    opacity: 1,
                                },
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#CBD5E0',
                            },
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', p: 2 }}>
                    <Button
                        onClick={() => setRejectDialog({ open: false, userId: null })}
                        disabled={actionLoading}
                        sx={{ color: '#4A5568', fontWeight: 700 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleRejectConfirm}
                        disabled={actionLoading}
                        variant="contained"
                        sx={{
                            backgroundColor: '#FF6B6B',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            '&:hover': { backgroundColor: '#E63946' },
                        }}
                    >
                        {actionLoading ? <CircularProgress size={20} /> : 'Reject'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
