import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, TextField, Button, IconButton, Typography, Stack } from '@mui/material';
import { Close as CloseIcon, Save as SaveIcon, AddPhotoAlternate as AddPhotoIcon } from '@mui/icons-material';
import { updateFace, addFaceImages, deleteFaceImage, faceImageUrl, type AuthorizedFace } from '../../api/faces';

interface Props { face: AuthorizedFace; open: boolean; onClose: () => void; onChanged: () => void; }

export default function FaceModal({ face, open, onClose, onChanged }: Props) {
    const [name, setName] = useState(face.name);
    const [role, setRole] = useState(face.role ?? '');
    const [images, setImages] = useState<string[]>(face.images);
    const [busy, setBusy] = useState(false);

    useEffect(() => { setName(face.name); setRole(face.role ?? ''); setImages(face.images); }, [face]);

    const handleSave = async () => {
        setBusy(true);
        try { await updateFace(face.id, name.trim(), role.trim()); onChanged(); } catch (e) { console.error(e); } finally { setBusy(false); }
    };
    const handleAdd = async (files: File[]) => {
        if (!files.length) return;
        setBusy(true);
        try { setImages(await addFaceImages(face.id, files)); onChanged(); } catch (e) { console.error(e); } finally { setBusy(false); }
    };
    const handleDeleteImg = async (filename: string) => {
        setBusy(true);
        try { setImages(await deleteFaceImage(face.id, filename)); onChanged(); } catch (e) { console.error(e); } finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit person</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} size="small" fullWidth />
                    <TextField label="Role" value={role} onChange={(e) => setRole(e.target.value)} size="small" fullWidth />

                    <Typography variant="body2" color="text.secondary">Photos ({images.length})</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                        {images.length === 0 && <Typography variant="caption" color="text.disabled">No photos</Typography>}
                        {images.map((fn) => (
                            <Box key={fn} sx={{ position: 'relative' }}>
                                <Box component="img" src={faceImageUrl(face.id, fn)}
                                    sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }} />
                                <IconButton size="small" onClick={() => handleDeleteImg(fn)} disabled={busy}
                                    sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'error.main', color: '#fff', '&:hover': { bgcolor: 'error.dark' } }}>
                                    <CloseIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                            </Box>
                        ))}
                    </Box>

                    <Button component="label" startIcon={<AddPhotoIcon />} variant="outlined" disabled={busy} sx={{ textTransform: 'none', borderRadius: 2 }}>
                        Add photos
                        <input type="file" hidden accept="image/*" multiple onChange={(e) => handleAdd(Array.from(e.target.files ?? []))} />
                    </Button>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
                <Button onClick={handleSave} startIcon={<SaveIcon />} variant="contained" disabled={busy} sx={{ textTransform: 'none' }}>Save</Button>
            </DialogActions>
        </Dialog>
    );
}
