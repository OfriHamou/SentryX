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

export type SecurityShiftStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface SecurityShiftAssignedUser {
  id: string;
  fullName: string | null;
  email: string;
  roleName: string;
}

export interface SecurityShift {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  status: SecurityShiftStatus;
  notes: string | null;
  assignedUser: SecurityShiftAssignedUser | null;
  createdAt: string;
  updatedAt: string;
}
