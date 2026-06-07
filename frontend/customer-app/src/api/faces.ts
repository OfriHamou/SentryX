import { customerApi, CUSTOMER_API_BASE_URL } from './customerApi';

export interface AuthorizedFace {
    id: string;
    name: string;
    role: string | null;
    addedAt: string;
    images: string[];   // relative paths like /api/faces/:id/images/:file
}

export const getFaces = async (): Promise<AuthorizedFace[]> => {
    const res = await customerApi.get<{ ok: boolean; faces: AuthorizedFace[] }>('/faces');
    return res.data.faces ?? [];
};

export const addFace = async (name: string, role: string, photos: File[]) => {
    const form = new FormData();
    form.append('name', name);
    if (role) form.append('role', role);
    photos.forEach((p) => form.append('photos', p));
    const res = await customerApi.post('/faces', form);
    return res.data;
};

export const deleteFace = async (id: string): Promise<void> => {
    await customerApi.delete(`/faces/${id}`);
};

// turn the API's relative image path into a full URL for <img src>
export const faceImageUrl = (faceId: string, filename: string) => `${CUSTOMER_API_BASE_URL.replace(/\/api$/, '')}/api/faces/${faceId}/images/${encodeURIComponent(filename)}`;

export const updateFace = async (id: string, name: string, role: string) => {
    const res = await customerApi.put(`/faces/${id}`, { name, role });
    return res.data;
};

export const addFaceImages = async (id: string, photos: File[]): Promise<string[]> => {
    const form = new FormData();
    photos.forEach((p) => form.append('photos', p));
    const res = await customerApi.post<{ ok: boolean; images: string[] }>(`/faces/${id}/images`, form);
    return res.data.images ?? [];
};

export const deleteFaceImage = async (id: string, filename: string): Promise<string[]> => {
    const res = await customerApi.delete<{ ok: boolean; images: string[] }>(`/faces/${id}/images/${encodeURIComponent(filename)}`);
    return res.data.images ?? [];
};