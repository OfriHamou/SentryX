import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:4000/api',
});

export const getTenants = () => api.get('/tenants').then(res => res.data);
export const createTenant = (name: string) => api.post('/tenants', { name }).then(res => res.data);
export const updateTenant = (id: string, name: string) => api.put(`/tenants/${id}`, { name }).then(res => res.data);
export const deleteTenant = (id: string) => api.delete(`/tenants/${id}`).then(res => res.data);

export const addTenantLicense = (id: string, licenseCode: string, expirationDate?: string) =>
    api.post(`/tenants/${id}/licenses`, { licenseCode, expirationDate }).then(res => res.data);
export const removeTenantLicense = (id: string, licenseCode: string) =>
    api.delete(`/tenants/${id}/licenses/${licenseCode}`).then(res => res.data);

export const getLicenses = () => api.get('/licenses').then(res => res.data);

// Dor comment - we need to implement this.
export const getAlerts = () => api.get('/alerts').then(res => res.data).catch(() => {
    // Return empty array if endpoint is not fully implemented on backend yet
    console.warn("Could not fetch alerts from /api/alerts");
    return [];
});
