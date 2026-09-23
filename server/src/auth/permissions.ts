// ==============================================================================
// VetRx — Centralized Permission Registry & Role-Permission Matrix (Phase 14)
// Authoritative definitions for granular permissions, role resolution, and security.
// ==============================================================================

import { Role, PlatformRole } from '@prisma/client';

export const PERMISSIONS = {
  // Clinical: Patients
  PATIENT_VIEW: 'PATIENT_VIEW',
  PATIENT_CREATE: 'PATIENT_CREATE',
  PATIENT_UPDATE: 'PATIENT_UPDATE',
  PATIENT_DELETE: 'PATIENT_DELETE',

  // Clinical: Animal Owners
  OWNER_VIEW: 'OWNER_VIEW',
  OWNER_CREATE: 'OWNER_CREATE',
  OWNER_UPDATE: 'OWNER_UPDATE',
  OWNER_DELETE: 'OWNER_DELETE',

  // Clinical: Prescriptions
  PRESCRIPTION_VIEW: 'PRESCRIPTION_VIEW',
  PRESCRIPTION_CREATE: 'PRESCRIPTION_CREATE',
  PRESCRIPTION_UPDATE: 'PRESCRIPTION_UPDATE',
  PRESCRIPTION_DELETE: 'PRESCRIPTION_DELETE',
  PRESCRIPTION_FORWARD_FOR_APPROVAL: 'PRESCRIPTION_FORWARD_FOR_APPROVAL',
  PRESCRIPTION_APPROVE: 'PRESCRIPTION_APPROVE',
  PRESCRIPTION_REQUEST_CHANGES: 'PRESCRIPTION_REQUEST_CHANGES',

  // Clinical: Formulary / Medicines
  MEDICINE_VIEW: 'MEDICINE_VIEW',
  MEDICINE_CREATE: 'MEDICINE_CREATE',
  MEDICINE_UPDATE: 'MEDICINE_UPDATE',
  MEDICINE_DELETE: 'MEDICINE_DELETE',

  // Clinical: Treatment Packages
  PACKAGE_VIEW: 'PACKAGE_VIEW',
  PACKAGE_CREATE: 'PACKAGE_CREATE',
  PACKAGE_UPDATE: 'PACKAGE_UPDATE',
  PACKAGE_DELETE: 'PACKAGE_DELETE',

  // Clinical & Practice: Invoices / Billing Documents
  INVOICE_VIEW: 'INVOICE_VIEW',
  INVOICE_CREATE: 'INVOICE_CREATE',
  INVOICE_UPDATE: 'INVOICE_UPDATE',
  INVOICE_DELETE: 'INVOICE_DELETE',

  // Clinical Reports
  REPORT_VIEW: 'REPORT_VIEW',

  // Practice & Administration
  PRACTICE_VIEW: 'PRACTICE_VIEW',
  PRACTICE_SETTINGS_MANAGE: 'PRACTICE_SETTINGS_MANAGE',

  // User Management
  USER_VIEW: 'USER_VIEW',
  USER_INVITE: 'USER_INVITE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  USER_REACTIVATE: 'USER_REACTIVATE',

  // Role Management
  ROLE_VIEW: 'ROLE_VIEW',
  ROLE_ASSIGN: 'ROLE_ASSIGN',

  // Security & Audit
  AUDIT_LOG_VIEW: 'AUDIT_LOG_VIEW',

  // Commercial & Subscriptions
  BILLING_VIEW: 'BILLING_VIEW',
  BILLING_MANAGE: 'BILLING_MANAGE',
  SUBSCRIPTION_VIEW: 'SUBSCRIPTION_VIEW',
  SUBSCRIPTION_MANAGE: 'SUBSCRIPTION_MANAGE',

  // Practice Ownership Transfer (Owner Only)
  OWNERSHIP_TRANSFER: 'OWNERSHIP_TRANSFER',

  // Platform Administration (Platform Super Admin Only)
  PLATFORM_PRACTICE_MANAGE: 'PLATFORM_PRACTICE_MANAGE',
  PLATFORM_USER_MANAGE: 'PLATFORM_USER_MANAGE',
  PLATFORM_BILLING_MANAGE: 'PLATFORM_BILLING_MANAGE',
  PLATFORM_AUDIT_VIEW: 'PLATFORM_AUDIT_VIEW',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ------------------------------------------------------------------------------
// Authoritative Role -> Permissions Matrix
// ------------------------------------------------------------------------------

const CLINICAL_BASE_PERMISSIONS: Permission[] = [
  PERMISSIONS.PATIENT_VIEW,
  PERMISSIONS.PATIENT_CREATE,
  PERMISSIONS.PATIENT_UPDATE,
  PERMISSIONS.PATIENT_DELETE,
  PERMISSIONS.OWNER_VIEW,
  PERMISSIONS.OWNER_CREATE,
  PERMISSIONS.OWNER_UPDATE,
  PERMISSIONS.OWNER_DELETE,
  PERMISSIONS.PRESCRIPTION_VIEW,
  PERMISSIONS.PRESCRIPTION_CREATE,
  PERMISSIONS.PRESCRIPTION_UPDATE,
  PERMISSIONS.PRESCRIPTION_DELETE,
  PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL,
  PERMISSIONS.MEDICINE_VIEW,
  PERMISSIONS.MEDICINE_CREATE,
  PERMISSIONS.MEDICINE_UPDATE,
  PERMISSIONS.MEDICINE_DELETE,
  PERMISSIONS.PACKAGE_VIEW,
  PERMISSIONS.PACKAGE_CREATE,
  PERMISSIONS.PACKAGE_UPDATE,
  PERMISSIONS.PACKAGE_DELETE,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_UPDATE,
  PERMISSIONS.INVOICE_DELETE,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.PRACTICE_VIEW,
];

const VIEW_ONLY_PERMISSIONS: Permission[] = [
  PERMISSIONS.PATIENT_VIEW,
  PERMISSIONS.OWNER_VIEW,
  PERMISSIONS.PRESCRIPTION_VIEW,
  PERMISSIONS.MEDICINE_VIEW,
  PERMISSIONS.PACKAGE_VIEW,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.PRACTICE_VIEW,
];

const STAFF_PERMISSIONS: Permission[] = [
  PERMISSIONS.PATIENT_VIEW,
  PERMISSIONS.PATIENT_CREATE,
  PERMISSIONS.PATIENT_UPDATE,
  PERMISSIONS.OWNER_VIEW,
  PERMISSIONS.OWNER_CREATE,
  PERMISSIONS.OWNER_UPDATE,
  PERMISSIONS.PRESCRIPTION_VIEW,
  PERMISSIONS.PRESCRIPTION_CREATE, // Staff can prepare draft prescriptions
  PERMISSIONS.PRESCRIPTION_UPDATE, // Staff can update draft prescriptions
  PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL, // Staff can forward prescriptions to clinicians
  // Explicitly EXCLUDES: PRESCRIPTION_APPROVE, PRESCRIPTION_REQUEST_CHANGES, PRESCRIPTION_DELETE
  PERMISSIONS.MEDICINE_VIEW,
  PERMISSIONS.PACKAGE_VIEW,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_UPDATE,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.PRACTICE_VIEW,
];

const VETERINARIAN_PERMISSIONS: Permission[] = [
  ...CLINICAL_BASE_PERMISSIONS,
  PERMISSIONS.PRESCRIPTION_APPROVE,
  PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES,
  // Veterinarians do not manage practice users, settings, billing, or ownership
];

const PRACTICE_ADMIN_PERMISSIONS: Permission[] = [
  ...CLINICAL_BASE_PERMISSIONS,
  // Note: Admins can forward and manage, but cannot clinically approve by default unless given override
  PERMISSIONS.PRACTICE_SETTINGS_MANAGE,
  PERMISSIONS.USER_VIEW,
  PERMISSIONS.USER_INVITE,
  PERMISSIONS.USER_UPDATE,
  PERMISSIONS.USER_DEACTIVATE,
  PERMISSIONS.USER_REACTIVATE,
  PERMISSIONS.ROLE_VIEW,
  PERMISSIONS.ROLE_ASSIGN,
  PERMISSIONS.AUDIT_LOG_VIEW,
  PERMISSIONS.BILLING_VIEW,
  PERMISSIONS.SUBSCRIPTION_VIEW,
  // Explicitly EXCLUDES: OWNERSHIP_TRANSFER, BILLING_MANAGE, SUBSCRIPTION_MANAGE, PRESCRIPTION_APPROVE
];

const PRACTICE_OWNER_PERMISSIONS: Permission[] = [
  ...PRACTICE_ADMIN_PERMISSIONS,
  PERMISSIONS.PRESCRIPTION_APPROVE,
  PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES,
  PERMISSIONS.BILLING_MANAGE,
  PERMISSIONS.SUBSCRIPTION_MANAGE,
  PERMISSIONS.OWNERSHIP_TRANSFER,
];

export const PLATFORM_SUPER_ADMIN_PERMISSIONS: Permission[] = [
  PERMISSIONS.PLATFORM_PRACTICE_MANAGE,
  PERMISSIONS.PLATFORM_USER_MANAGE,
  PERMISSIONS.PLATFORM_BILLING_MANAGE,
  PERMISSIONS.PLATFORM_AUDIT_VIEW,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.PRACTICE_OWNER]: PRACTICE_OWNER_PERMISSIONS,
  [Role.PRACTICE_ADMIN]: PRACTICE_ADMIN_PERMISSIONS,
  [Role.VETERINARIAN]: VETERINARIAN_PERMISSIONS,
  [Role.STAFF]: STAFF_PERMISSIONS,
  [Role.PRACTICE_STAFF]: STAFF_PERMISSIONS, // Legacy alias
  [Role.READ_ONLY]: VIEW_ONLY_PERMISSIONS,
};

// ------------------------------------------------------------------------------
// Permission Categorization & Metadata (for Role & Action Matrix UI)
// ------------------------------------------------------------------------------

export interface PermissionDefinition {
  key: Permission;
  label: string;
  description: string;
  category: 'CLINICAL' | 'PRACTICE' | 'COMMERCIAL' | 'SECURITY' | 'PLATFORM';
  isClinicalSafetyCritical?: boolean;
}

export const CLINICAL_PERMISSIONS: Permission[] = [
  PERMISSIONS.PATIENT_VIEW,
  PERMISSIONS.PATIENT_CREATE,
  PERMISSIONS.PATIENT_UPDATE,
  PERMISSIONS.PATIENT_DELETE,
  PERMISSIONS.OWNER_VIEW,
  PERMISSIONS.OWNER_CREATE,
  PERMISSIONS.OWNER_UPDATE,
  PERMISSIONS.OWNER_DELETE,
  PERMISSIONS.PRESCRIPTION_VIEW,
  PERMISSIONS.PRESCRIPTION_CREATE,
  PERMISSIONS.PRESCRIPTION_UPDATE,
  PERMISSIONS.PRESCRIPTION_DELETE,
  PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL,
  PERMISSIONS.PRESCRIPTION_APPROVE,
  PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES,
  PERMISSIONS.MEDICINE_VIEW,
  PERMISSIONS.MEDICINE_CREATE,
  PERMISSIONS.MEDICINE_UPDATE,
  PERMISSIONS.MEDICINE_DELETE,
  PERMISSIONS.PACKAGE_VIEW,
  PERMISSIONS.PACKAGE_CREATE,
  PERMISSIONS.PACKAGE_UPDATE,
  PERMISSIONS.PACKAGE_DELETE,
  PERMISSIONS.REPORT_VIEW,
];

export const PRACTICE_PERMISSIONS: Permission[] = [
  PERMISSIONS.PRACTICE_VIEW,
  PERMISSIONS.PRACTICE_SETTINGS_MANAGE,
  PERMISSIONS.USER_VIEW,
  PERMISSIONS.USER_INVITE,
  PERMISSIONS.USER_UPDATE,
  PERMISSIONS.USER_DEACTIVATE,
  PERMISSIONS.USER_REACTIVATE,
  PERMISSIONS.ROLE_VIEW,
  PERMISSIONS.ROLE_ASSIGN,
];

export const COMMERCIAL_PERMISSIONS: Permission[] = [
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_UPDATE,
  PERMISSIONS.INVOICE_DELETE,
  PERMISSIONS.BILLING_VIEW,
  PERMISSIONS.BILLING_MANAGE,
  PERMISSIONS.SUBSCRIPTION_VIEW,
  PERMISSIONS.SUBSCRIPTION_MANAGE,
  PERMISSIONS.OWNERSHIP_TRANSFER,
];

export const SECURITY_PERMISSIONS: Permission[] = [
  PERMISSIONS.AUDIT_LOG_VIEW,
];

export const PLATFORM_ONLY_PERMISSIONS: Permission[] = [
  PERMISSIONS.PLATFORM_PRACTICE_MANAGE,
  PERMISSIONS.PLATFORM_USER_MANAGE,
  PERMISSIONS.PLATFORM_BILLING_MANAGE,
  PERMISSIONS.PLATFORM_AUDIT_VIEW,
];

export const ALL_ASSIGNABLE_PERMISSIONS: Permission[] = [
  ...CLINICAL_PERMISSIONS,
  ...PRACTICE_PERMISSIONS,
  ...COMMERCIAL_PERMISSIONS,
  ...SECURITY_PERMISSIONS,
];

export const PERMISSION_METADATA: Record<Permission, PermissionDefinition> = {
  [PERMISSIONS.PATIENT_VIEW]: { key: PERMISSIONS.PATIENT_VIEW, label: 'View Patients', description: 'View patient records and history', category: 'CLINICAL' },
  [PERMISSIONS.PATIENT_CREATE]: { key: PERMISSIONS.PATIENT_CREATE, label: 'Create Patients', description: 'Register new patients', category: 'CLINICAL' },
  [PERMISSIONS.PATIENT_UPDATE]: { key: PERMISSIONS.PATIENT_UPDATE, label: 'Update Patients', description: 'Modify patient details and vitals', category: 'CLINICAL' },
  [PERMISSIONS.PATIENT_DELETE]: { key: PERMISSIONS.PATIENT_DELETE, label: 'Delete Patients', description: 'Archive or remove patient records', category: 'CLINICAL' },

  [PERMISSIONS.OWNER_VIEW]: { key: PERMISSIONS.OWNER_VIEW, label: 'View Owners', description: 'View pet owner directory', category: 'CLINICAL' },
  [PERMISSIONS.OWNER_CREATE]: { key: PERMISSIONS.OWNER_CREATE, label: 'Create Owners', description: 'Register new pet owners', category: 'CLINICAL' },
  [PERMISSIONS.OWNER_UPDATE]: { key: PERMISSIONS.OWNER_UPDATE, label: 'Update Owners', description: 'Update pet owner contact info', category: 'CLINICAL' },
  [PERMISSIONS.OWNER_DELETE]: { key: PERMISSIONS.OWNER_DELETE, label: 'Delete Owners', description: 'Remove pet owner profiles', category: 'CLINICAL' },

  [PERMISSIONS.PRESCRIPTION_VIEW]: { key: PERMISSIONS.PRESCRIPTION_VIEW, label: 'View Prescriptions', description: 'View prescriptions and draft orders', category: 'CLINICAL' },
  [PERMISSIONS.PRESCRIPTION_CREATE]: { key: PERMISSIONS.PRESCRIPTION_CREATE, label: 'Create Prescriptions', description: 'Prepare draft prescriptions', category: 'CLINICAL' },
  [PERMISSIONS.PRESCRIPTION_UPDATE]: { key: PERMISSIONS.PRESCRIPTION_UPDATE, label: 'Update Prescriptions', description: 'Edit draft prescriptions prior to approval', category: 'CLINICAL' },
  [PERMISSIONS.PRESCRIPTION_DELETE]: { key: PERMISSIONS.PRESCRIPTION_DELETE, label: 'Delete Prescriptions', description: 'Remove or cancel prescription records', category: 'CLINICAL' },
  [PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL]: { key: PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL, label: 'Forward for Approval', description: 'Forward draft prescriptions to clinicians with remarks', category: 'CLINICAL' },
  [PERMISSIONS.PRESCRIPTION_APPROVE]: { key: PERMISSIONS.PRESCRIPTION_APPROVE, label: 'Approve Prescriptions', description: 'Legally approve and digitally sign clinical prescriptions', category: 'CLINICAL', isClinicalSafetyCritical: true },
  [PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES]: { key: PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES, label: 'Request Rx Changes', description: 'Reject or request revisions on forwarded prescriptions with remarks', category: 'CLINICAL' },

  [PERMISSIONS.MEDICINE_VIEW]: { key: PERMISSIONS.MEDICINE_VIEW, label: 'View Formulary', description: 'Browse drug catalog and formulary', category: 'CLINICAL' },
  [PERMISSIONS.MEDICINE_CREATE]: { key: PERMISSIONS.MEDICINE_CREATE, label: 'Add Medicines', description: 'Add custom medications to formulary', category: 'CLINICAL' },
  [PERMISSIONS.MEDICINE_UPDATE]: { key: PERMISSIONS.MEDICINE_UPDATE, label: 'Update Medicines', description: 'Edit formulary dosages and details', category: 'CLINICAL' },
  [PERMISSIONS.MEDICINE_DELETE]: { key: PERMISSIONS.MEDICINE_DELETE, label: 'Delete Medicines', description: 'Remove medications from formulary', category: 'CLINICAL' },

  [PERMISSIONS.PACKAGE_VIEW]: { key: PERMISSIONS.PACKAGE_VIEW, label: 'View Treatment Packages', description: 'View bundled treatment templates', category: 'CLINICAL' },
  [PERMISSIONS.PACKAGE_CREATE]: { key: PERMISSIONS.PACKAGE_CREATE, label: 'Create Packages', description: 'Build reusable treatment packages', category: 'CLINICAL' },
  [PERMISSIONS.PACKAGE_UPDATE]: { key: PERMISSIONS.PACKAGE_UPDATE, label: 'Update Packages', description: 'Modify treatment package items', category: 'CLINICAL' },
  [PERMISSIONS.PACKAGE_DELETE]: { key: PERMISSIONS.PACKAGE_DELETE, label: 'Delete Packages', description: 'Remove treatment packages', category: 'CLINICAL' },

  [PERMISSIONS.INVOICE_VIEW]: { key: PERMISSIONS.INVOICE_VIEW, label: 'View Invoices', description: 'View client invoices and billing history', category: 'COMMERCIAL' },
  [PERMISSIONS.INVOICE_CREATE]: { key: PERMISSIONS.INVOICE_CREATE, label: 'Create Invoices', description: 'Generate invoices for clients', category: 'COMMERCIAL' },
  [PERMISSIONS.INVOICE_UPDATE]: { key: PERMISSIONS.INVOICE_UPDATE, label: 'Update Invoices', description: 'Adjust invoice items or apply discounts', category: 'COMMERCIAL' },
  [PERMISSIONS.INVOICE_DELETE]: { key: PERMISSIONS.INVOICE_DELETE, label: 'Delete Invoices', description: 'Void or remove client invoices', category: 'COMMERCIAL' },

  [PERMISSIONS.REPORT_VIEW]: { key: PERMISSIONS.REPORT_VIEW, label: 'View Reports', description: 'Access practice analytics and clinical reports', category: 'CLINICAL' },

  [PERMISSIONS.PRACTICE_VIEW]: { key: PERMISSIONS.PRACTICE_VIEW, label: 'View Practice Info', description: 'View practice profile and branch details', category: 'PRACTICE' },
  [PERMISSIONS.PRACTICE_SETTINGS_MANAGE]: { key: PERMISSIONS.PRACTICE_SETTINGS_MANAGE, label: 'Manage Practice Settings', description: 'Configure clinic branding, templates, and preferences', category: 'PRACTICE' },

  [PERMISSIONS.USER_VIEW]: { key: PERMISSIONS.USER_VIEW, label: 'View Team Members', description: 'View team members and invitation status', category: 'PRACTICE' },
  [PERMISSIONS.USER_INVITE]: { key: PERMISSIONS.USER_INVITE, label: 'Invite Users', description: 'Send invitations to join practice', category: 'PRACTICE' },
  [PERMISSIONS.USER_UPDATE]: { key: PERMISSIONS.USER_UPDATE, label: 'Update Users', description: 'Edit member role or practice details', category: 'PRACTICE' },
  [PERMISSIONS.USER_DEACTIVATE]: { key: PERMISSIONS.USER_DEACTIVATE, label: 'Deactivate Users', description: 'Disable member account without deleting records', category: 'PRACTICE' },
  [PERMISSIONS.USER_REACTIVATE]: { key: PERMISSIONS.USER_REACTIVATE, label: 'Reactivate Users', description: 'Reactivate previously disabled member', category: 'PRACTICE' },

  [PERMISSIONS.ROLE_VIEW]: { key: PERMISSIONS.ROLE_VIEW, label: 'View Roles', description: 'View available practice roles and definitions', category: 'PRACTICE' },
  [PERMISSIONS.ROLE_ASSIGN]: { key: PERMISSIONS.ROLE_ASSIGN, label: 'Assign Roles', description: 'Change member roles within allowed boundary', category: 'PRACTICE' },

  [PERMISSIONS.AUDIT_LOG_VIEW]: { key: PERMISSIONS.AUDIT_LOG_VIEW, label: 'View Audit Logs', description: 'Access tamper-evident practice audit logs', category: 'SECURITY' },

  [PERMISSIONS.BILLING_VIEW]: { key: PERMISSIONS.BILLING_VIEW, label: 'View Subscription', description: 'View practice subscription status and invoices', category: 'COMMERCIAL' },
  [PERMISSIONS.BILLING_MANAGE]: { key: PERMISSIONS.BILLING_MANAGE, label: 'Manage Billing', description: 'Update payment methods and pay invoices', category: 'COMMERCIAL' },
  [PERMISSIONS.SUBSCRIPTION_VIEW]: { key: PERMISSIONS.SUBSCRIPTION_VIEW, label: 'View Plans', description: 'View subscription tiers and seat usage', category: 'COMMERCIAL' },
  [PERMISSIONS.SUBSCRIPTION_MANAGE]: { key: PERMISSIONS.SUBSCRIPTION_MANAGE, label: 'Manage Subscription', description: 'Upgrade, downgrade, or cancel subscription', category: 'COMMERCIAL' },

  [PERMISSIONS.OWNERSHIP_TRANSFER]: { key: PERMISSIONS.OWNERSHIP_TRANSFER, label: 'Transfer Ownership', description: 'Transfer authoritative practice ownership', category: 'COMMERCIAL' },

  [PERMISSIONS.PLATFORM_PRACTICE_MANAGE]: { key: PERMISSIONS.PLATFORM_PRACTICE_MANAGE, label: 'Platform Practice Admin', description: 'Global practice management across all tenants', category: 'PLATFORM' },
  [PERMISSIONS.PLATFORM_USER_MANAGE]: { key: PERMISSIONS.PLATFORM_USER_MANAGE, label: 'Platform User Admin', description: 'Global user management and role assignment', category: 'PLATFORM' },
  [PERMISSIONS.PLATFORM_BILLING_MANAGE]: { key: PERMISSIONS.PLATFORM_BILLING_MANAGE, label: 'Platform Billing Admin', description: 'Global subscription and transaction administration', category: 'PLATFORM' },
  [PERMISSIONS.PLATFORM_AUDIT_VIEW]: { key: PERMISSIONS.PLATFORM_AUDIT_VIEW, label: 'Platform Audit View', description: 'Global platform security log review', category: 'PLATFORM' },
};

/**
 * Resolves effective permissions for a given practice role.
 */
export function getPermissionsForRole(role: Role | string): Permission[] {
  const normalized = (role === 'PRACTICE_STAFF' ? Role.STAFF : role) as Role;
  return ROLE_PERMISSIONS[normalized] || VIEW_ONLY_PERMISSIONS;
}

/**
 * Checks whether a practice role includes a given permission.
 */
export function roleHasPermission(role: Role | string, permission: Permission | string): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission as Permission);
}
