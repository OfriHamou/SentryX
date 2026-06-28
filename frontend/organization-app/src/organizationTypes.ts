import { AllowedPages } from './auth/permissions';

export interface OrganizationRole {
  id: string | number;
  roleName: string;
  allowedPages: AllowedPages;
}

export interface OrganizationTenantUser {
  id: string;
  fullName: string;
  email: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  roleId: string | number;
  roleName: string;
  allowedPages: AllowedPages;
}
