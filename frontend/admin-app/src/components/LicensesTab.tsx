import { useEffect, useState } from 'react';
import {
    Typography, Button, Box, TextField,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Card, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
    Chip, IconButton
} from '@mui/material';
import {
    AddCircleOutlined as AddCircleOutlineIcon,
    Block as BlockIcon,
    VpnKey as VpnKeyIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import * as api from '../api'; // Adjust path if needed

// Helper to keep license colors consistent across the platform
const getLicenseColor = (code: string) => {
    const colors = [
        { bg: '#E6F9F5', color: '#05CD99', border: 'rgba(5, 205, 153, 0.2)' }, // Teal
        { bg: '#F4F7FE', color: '#4318FF', border: 'rgba(67, 24, 255, 0.2)' }, // Blue
        { bg: '#F3E8FF', color: '#7C3AED', border: 'rgba(124, 58, 237, 0.2)' }, // Purple
        { bg: '#FFF0F6', color: '#EC4899', border: 'rgba(236, 72, 153, 0.2)' }, // Pink
        { bg: '#FFF9E6', color: '#D97706', border: 'rgba(217, 119, 6, 0.2)' }, // Amber
        { bg: '#F0F9FF', color: '#0284C7', border: 'rgba(2, 132, 199, 0.2)' }, // Sky
    ];
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
        hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export const LicensesTab = () => {
    const [licenses, setLicenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal & Form State
    const [openAddModal, setOpenAddModal] = useState(false);
    const [licenseCode, setLicenseCode] = useState('');
    const [licenseDescription, setLicenseDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadLicenses();
    }, []);

    const loadLicenses = async () => {
        setLoading(true);
        try {
            const data = await api.getLicenses();
            setLicenses(data || []);
        } catch (error) {
            console.error("Failed to load licenses", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateLicense = async () => {
        if (!licenseCode) return;
        setIsSubmitting(true);
        try {
            await api.createLicense({
                code: licenseCode.trim().toUpperCase(),
                description: licenseDescription.trim()
            });

            // Clean up and refresh
            setLicenseCode('');
            setLicenseDescription('');
            setOpenAddModal(false);
            await loadLicenses();
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || 'Error creating license. The code might already exist.';
            alert(errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteLicense = async (code: string) => {
        if (window.confirm(`Are you sure you want to completely delete the "${code}" license? This will instantly remove it from all organizations currently using it.`)) {
            try {
                await api.deleteLicense(code);
                // Refresh the table to show it's gone
                await loadLicenses();
            } catch (error) {
                console.error("Failed to delete license", error);
                alert("An error occurred while trying to delete the license.");
            }
        }
    };

    return (
        <>
            <Card sx={{ borderRadius: '20px', boxShadow: '14px 17px 40px 4px rgba(112, 144, 176, 0.08)', overflow: 'hidden', backgroundColor: '#fff', border: 'none' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, pt: 4, px: 4, backgroundColor: '#fff' }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#2B3674' }}>
                            Platform Licenses
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#A3AED0', mt: 0.5, fontWeight: 500 }}>
                            Manage and create global license templates available for organizations
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddCircleOutlineIcon />}
                        onClick={() => {
                            setLicenseCode('');
                            setLicenseDescription('');
                            setOpenAddModal(true);
                        }}
                        sx={{ borderRadius: '12px', textTransform: 'none', px: 3, py: 1.5, backgroundColor: '#4318FF', boxShadow: '0 4px 12px rgba(67, 24, 255, 0.3)', fontWeight: 700, '&:hover': { backgroundColor: '#3311db' } }}
                    >
                        New License
                    </Button>
                </Box>

                <TableContainer component={Box} sx={{ maxHeight: 600, px: 2 }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow sx={{ '& th': { backgroundColor: '#fff', fontWeight: 600, color: '#A3AED0', py: 2.5, borderBottom: '1px solid #E2E8F0', fontSize: '0.8rem', letterSpacing: 0.5 } }}>
                                <TableCell width="25%">LICENSE CODE</TableCell>
                                <TableCell width="40%">DESCRIPTION</TableCell>
                                <TableCell width="25%">CREATED AT</TableCell>
                                <TableCell align="right" width="10%">ACTIONS</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                                        <CircularProgress size={50} thickness={4} sx={{ color: '#4318FF' }} />
                                    </TableCell>
                                </TableRow>
                            ) : licenses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                                        <BlockIcon sx={{ fontSize: 60, color: '#e2e8f0', mb: 2 }} />
                                        <Typography variant="h6" color="#718096" sx={{ fontWeight: 700}}>No Licenses Found</Typography>
                                        <Typography variant="body2" color="#a0aec0">Create your first license template to get started.</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                licenses.map((license) => {
                                    const style = getLicenseColor(license.code);
                                    return (
                                        <TableRow key={license.code} hover sx={{ '& td': { borderBottom: '1px solid #F4F7FE', py: 2.5 } }}>
                                            <TableCell>
                                                <Chip
                                                    icon={<VpnKeyIcon style={{ color: style.color, width: 16, height: 16 }} />}
                                                    label={license.code}
                                                    sx={{
                                                        fontWeight: 800,
                                                        fontSize: '0.85rem',
                                                        letterSpacing: 0.5,
                                                        backgroundColor: style.bg,
                                                        color: style.color,
                                                        border: `1px solid ${style.border}`,
                                                        borderRadius: '8px',
                                                        px: 1,
                                                        py: 2
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ color: '#2B3674', fontWeight: 500 }}>
                                                {license.description || <span style={{ color: '#A3AED0', fontStyle: 'italic' }}>No description provided</span>}
                                            </TableCell>
                                            <TableCell sx={{ color: '#A3AED0', fontWeight: 500, fontSize: '0.9rem' }}>
                                                {license.createdAt ? new Date(license.createdAt).toLocaleDateString() : 'N/A'}
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    onClick={() => handleDeleteLicense(license.code)}
                                                    sx={{ color: '#EE5D50', '&:hover': { backgroundColor: '#FDECEB' } }}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            {/* Create License Dialog */}
            <Dialog open={openAddModal} onClose={() => !isSubmitting && setOpenAddModal(false)} maxWidth="sm" fullWidth>
                <Box sx={{ borderRadius: 4, p: 1 }}>
                    <DialogTitle sx={{ fontWeight: 800, color: '#2d3748', fontSize: '1.3rem' }}>Create System License</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="#718096" sx={{ mb: 4 }}>
                            Define a new feature license that can be granted to organizations. The code acts as the unique identifier.
                        </Typography>
                        <TextField
                            autoFocus
                            fullWidth
                            variant="outlined"
                            label="License Code (e.g. SENTRYX_PRO)"
                            value={licenseCode}
                            onChange={e => setLicenseCode(e.target.value.toUpperCase())}
                            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            variant="outlined"
                            label="Description (Optional)"
                            placeholder="Unlocks premium analytics features..."
                            value={licenseDescription}
                            onChange={e => setLicenseDescription(e.target.value)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ px: 3, pb: 2 }}>
                        <Button
                            onClick={() => setOpenAddModal(false)}
                            disabled={isSubmitting}
                            sx={{ color: '#718096', fontWeight: 700, textTransform: 'none' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateLicense}
                            variant="contained"
                            disabled={!licenseCode.trim() || isSubmitting}
                            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3, backgroundColor: '#4318FF' }}
                        >
                            {isSubmitting ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Create License'}
                        </Button>
                    </DialogActions>
                </Box>
            </Dialog>
        </>
    );
};