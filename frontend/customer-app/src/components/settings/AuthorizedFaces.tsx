import { useState } from 'react';
import { Paper, Typography, Stack, Box, Avatar, IconButton, Button } from '@mui/material';
import { Face as FaceIcon, Delete as DeleteIcon, PersonAdd as AddIcon } from '@mui/icons-material';

interface Face { id: string; name: string; role: string; added: string; }
const INITIAL: Face[] = [{ id: '1', name: 'John Doe', role: 'Manager', added: '2024-01-15' }];

export default function AuthorizedFaces() {
    const [faces, setFaces] = useState<Face[]>(INITIAL);
    const remove = (id: string) => setFaces((prev) => prev.filter((f) => f.id !== id));
    return (
         <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'grey.200', mb: 3 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <FaceIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Authorized Faces</Typography>
            </Stack>
            <Stack spacing={1}>
                {faces.map((f) => (
                    <Box key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid', borderColor: 'grey.200', borderRadius: 2, p: 1.5 }}>
                        <Avatar>{f.name.charAt(0)}</Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography sx={{ fontWeight: 600 }}>{f.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{f.role} • Added {f.added}</Typography>
                        </Box>
                        <IconButton onClick={() => remove(f.id)} sx={{ color: 'error.main' }}><DeleteIcon /></IconButton>
                    </Box>
                ))}
            </Stack>
            <Button startIcon={<AddIcon />} disabled fullWidth sx={{ mt: 1.5, textTransform: 'none', border: '1px dashed', borderColor: 'grey.300', borderRadius: 2 }}>
                Add Person
            </Button>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                TODO: sync with the robot's face DB (needs robot-side API)
            </Typography>
        </Paper>
    );
}