import { useEffect, useState } from 'react';
import { Paper, Typography, Stack, Box, Avatar, IconButton, Button, TextField } from '@mui/material';
import { Face as FaceIcon, Delete as DeleteIcon, PersonAdd as AddIcon } from '@mui/icons-material';
import { getFaces, addFace, deleteFace, faceImageUrl, type AuthorizedFace } from '../../api/faces';
import { Edit as EditIcon } from '@mui/icons-material';
import FaceModal from './FaceModal';

interface AuthorizedFacesProps {
    canWrite: boolean;
}

export default function AuthorizedFaces({ canWrite }: AuthorizedFacesProps) {
    const [faces, setFaces] = useState<AuthorizedFace[]>([]);
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [photos, setPhotos] = useState<File[]>([]);
    const [saving, setSaving] = useState(false);
    const [selected, setSelected] = useState<AuthorizedFace | null>(null);

    const load = async () => {
        try { setFaces(await getFaces()); } catch (e) { console.error('load faces', e); }
    };
    useEffect(() => { load(); }, []);

    const handleAdd = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await addFace(name.trim(), role.trim(), photos);
            setName(''); setRole(''); setPhotos([]);
            await load();
        } catch (e) { console.error('add face', e); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        try { await deleteFace(id); await load(); } catch (e) { console.error('delete face', e); }
    };

    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', mb: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <FaceIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Authorized Faces</Typography>
            </Stack>

            <Stack spacing={1}>
                {faces.length === 0 && (
                    <Typography variant="caption" color="text.disabled">No authorized faces yet</Typography>
                )}
                {faces.map((f) => (
                    <Box key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 1.5 }}>
                        <Avatar src={f.images[0] ? faceImageUrl(f.id, f.images[0]) : undefined}>{f.name.charAt(0)}</Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography sx={{ fontWeight: 600 }}>{f.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {f.role ?? '—'} • Added {new Date(f.addedAt).toLocaleDateString()}
                            </Typography>
                        </Box>
                        {canWrite && (
                            <>
                                <IconButton onClick={() => setSelected(f)} sx={{ color: 'text.secondary' }}><EditIcon /></IconButton>
                                <IconButton onClick={() => handleDelete(f.id)} sx={{ color: 'error.main' }}><DeleteIcon /></IconButton>
                            </>
                        )}
                    </Box>
                ))}
            </Stack>

            {/* Add person */}
            {canWrite && (
            <Stack spacing={1.5} sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'grey.200' }}>
                <Stack direction="row" spacing={1}>
                    <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
                    <TextField size="small" label="Role" value={role} onChange={(e) => setRole(e.target.value)} fullWidth />
                </Stack>
                <Button component="label" variant="outlined" sx={{ textTransform: 'none', borderRadius: 2 }}>
                    {photos.length ? `${photos.length} photos selected` : 'Choose photo'}
                    <input type="file" hidden accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files || []))} />
                </Button>
                <Button startIcon={<AddIcon />} variant="contained" onClick={handleAdd} disabled={saving || !name.trim()}
                    sx={{ textTransform: 'none', borderRadius: 2 }}>
                    {saving ? 'Adding…' : 'Add Person'}
                </Button>
            </Stack>
            )}
            {selected && <FaceModal face={selected} open onClose={() => setSelected(null)} onChanged={load} canWrite={canWrite} />}
        </Paper>
    );
}
