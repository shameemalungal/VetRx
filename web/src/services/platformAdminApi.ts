// ==============================================================================
// VetRx — Platform Super Admin API Client (web/src/services/platformAdminApi.ts)
// Canonical HTTP client for all platform SaaS management endpoints under /api/platform/admin.
// ==============================================================================

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let errMessage = `Request failed (${res.status}${res.statusText ? `: ${res.statusText}` : ''})`;
    try {
      const body = await res.json();
      if (body?.error) {
        if (typeof body.error === 'string') {
          errMessage = body.error;
        } else if (typeof body.error === 'object' && body.error !== null) {
          if (body.error.message && typeof body.error.message === 'string') {
            errMessage = body.error.message;
            if (Array.isArray(body.error.details) && body.error.details.length > 0) {
              const detailsMsg = body.error.details
                .map((d: any) => (d && typeof d === 'object' ? d.message || d.path : String(d)))
                .filter(Boolean)
                .join(', ');
              if (detailsMsg) errMessage += ` (${detailsMsg})`;
            }
          } else if (body.error.code) {
            errMessage = String(body.error.code).replace(/_/g, ' ');
          }
        }
      } else if (body?.message && typeof body.message === 'string') {
        errMessage = body.message;
      }
    } catch {
      // Fallback to HTTP status text if body is not JSON
    }
    throw new Error(errMessage);
  }

  return res.json() as Promise<T>;
}

export interface PlatformDashboardData {
  metrics: {
    totalPractices: number;
    activePractices: number;
    suspendedPractices: number;
    totalUsers: number;
    activeUsers: number;
    activeVeterinarians?: number;
    activeSubscriptions: number;
    openIssues: number;
    independentPractices?: number;
    clinicPractices?: number;
    enterprisePractices?: number;
  };
  practicesByType: {
    independent: number;
    clinic: number;
    enterprise: number;
  };
  recentPractices: Array<{
    id: string;
    name: string;
    slug?: string | null;
    practiceType: string;
    status: string;
    ownerName?: string;
    ownerEmail?: string;
    memberCount?: number;
    createdAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    resource: string;
    createdAt: string;
    practiceName?: string;
    actorEmail?: string;
  }>;
  recentPayments?: any[];
  recentIssues?: any[];
  securityEvents?: any[];
}

export interface PlatformPracticeListItem {
  id: string;
  name: string;
  slug: string | null;
  practiceType: 'INDEPENDENT' | 'CLINIC' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED';
  ownerUserId: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
  veterinarianCount: number;
  subscriptionPlan: string;
  subscriptionStatus: string;
}

export interface PlatformUserPracticeMembership {
  practiceId: string;
  practiceName: string;
  role: string;
  isClinicalApprover: boolean;
  isActive: boolean;
}

export interface PlatformUserListItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  emailVerified: boolean;
  platformRole: string | null;
  mustChangePassword?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  membershipCount?: number;
  practices?: PlatformUserPracticeMembership[];
  practiceMemberships?: PlatformUserPracticeMembership[];
}

export interface PlatformSubscriptionItem {
  id: string;
  practiceId: string;
  practiceName: string;
  planCode: string;
  planName: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  seatsUsed: number;
  seatsAllowed: number;
  isOwnerClinicalApprover: boolean;
  source?: string;
  notes?: string;
  isUnlimited?: boolean;
  metadata?: Record<string, any> | null;
  addons?: Record<string, any> | null;
  inventoryAddon?: any;
  isInventoryAddonActive?: boolean;
}

export interface PlatformPaymentItem {
  id: string;
  practiceId: string;
  practiceName: string;
  amountINR: number;
  amountRupees?: string;
  amountPaisa?: number;
  currency: string;
  status: string;
  paymentProvider?: string;
  gatewayTransactionId?: string;
  internalReference?: string;
  paymentMethod?: string;
  subscriptionPlan?: string;
  razorpayPaymentId?: string;
  razorpayInvoiceId?: string;
  createdAt: string;
}

export interface PlatformIssueItem {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: 'GENERAL' | 'LOGIN_AUTH' | 'CLINICAL_WORKFLOW' | 'BILLING' | 'PERMISSION_ACCESS' | 'DATA_BUG';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  practiceId?: string;
  practiceName?: string;
  userId?: string;
  reporterName?: string;
  reporterEmail?: string;
  internalNotes: Array<{
    id: string;
    authorName: string;
    note: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SupportSessionItem {
  id: string;
  sessionToken: string;
  superAdminUserId: string;
  superAdminName: string;
  superAdminEmail: string;
  targetPracticeId: string;
  targetPracticeName: string;
  reason: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CONCLUDED';
  isReadOnly: boolean;
  startedAt: string;
  expiresAt: string;
  concludedAt?: string;
}

export interface PlatformAuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  practiceId?: string;
  practiceName?: string;
  ipAddress?: string;
  metadata?: any;
  details?: any;
  user?: { id: string; email: string; name: string } | null;
  practice?: { id: string; name: string } | null;
  createdAt: string;
}

export interface PermissionMetadataItem {
  name: string;
  category: string;
  description: string;
  clinicalSafetyWarning?: boolean;
  isClinicalSafetyCritical?: boolean;
}

export interface PermissionMatrixData {
  roles: string[];
  permissions: {
    clinical: string[];
    practice: string[];
    commercial: string[];
    security: string[];
    platformOnly: string[];
  };
  metadata: Record<string, PermissionMetadataItem>;
  roleDefaults: Record<string, string[]>;
  assignablePermissions?: string[];
  categories?: {
    CLINICAL: string[];
    PRACTICE: string[];
    COMMERCIAL: string[];
    SECURITY: string[];
    PLATFORM: string[];
  };
}

export const platformAdminApi = {
  // Dashboard & Global Search
  getDashboard: async (): Promise<PlatformDashboardData> => {
    const raw = await request<any>('/api/platform/admin/dashboard');
    const metrics = raw.metrics || {};
    const practicesByType = raw.practicesByType || {
      independent: metrics.independentPractices || 0,
      clinic: metrics.clinicPractices || 0,
      enterprise: metrics.enterprisePractices || 0,
    };
    const recentAuditLogs = raw.recentAuditLogs || raw.securityEvents || [];
    const openIssues = metrics.openIssues ?? (raw.recentIssues?.length || 0);
    const activeUsers = metrics.activeUsers ?? metrics.totalUsers ?? 0;

    return {
      ...raw,
      metrics: {
        ...metrics,
        openIssues,
        activeUsers,
      },
      practicesByType,
      recentPractices: raw.recentPractices || [],
      recentAuditLogs,
    };
  },

  globalSearch: (q: string) =>
    request<{ practices: any[]; users: any[]; issues: any[] }>(`/api/platform/admin/search?q=${encodeURIComponent(q)}`),

  // Practices
  listPractices: async (params?: { search?: string; type?: string; status?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.type && params.type !== 'ALL') q.set('type', params.type);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));

    const res = await request<any>(`/api/platform/admin/practices?${q.toString()}`);
    const results: PlatformPracticeListItem[] = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
    const total: number = res?.total ?? results.length;
    const page: number = res?.page ?? 1;
    const pageSize: number = res?.pageSize ?? results.length;

    return { results, total, page, pageSize };
  },

  createPractice: (data: {
    name: string;
    practiceType: 'INDEPENDENT' | 'CLINIC' | 'ENTERPRISE';
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    address?: string;
    planCode?: string;
    isClinicalApprover?: boolean;
  }) => request<any>('/api/platform/admin/practices', { method: 'POST', body: JSON.stringify(data) }),

  getPracticeDetails: (id: string) => request<any>(`/api/platform/admin/practices/${id}`),

  updatePractice: (id: string, data: { name?: string; practiceType?: string; address?: string; phone?: string; email?: string }) =>
    request<any>(`/api/platform/admin/practices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  suspendPractice: (id: string, reason?: string) =>
    request<any>(`/api/platform/admin/practices/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason: reason || 'Administrative suspension' }) }),

  reactivatePractice: (id: string, reason?: string) =>
    request<any>(`/api/platform/admin/practices/${id}/reactivate`, { method: 'POST', body: JSON.stringify({ reason: reason || 'Administrative reactivation' }) }),

  transferOwnership: (id: string, targetMemberId: string, previousOwnerRole?: string, reason?: string) =>
    request<any>(`/api/platform/admin/practices/${id}/transfer-ownership`, {
      method: 'POST',
      body: JSON.stringify({
        newOwnerUserId: targetMemberId,
        targetMemberId,
        previousOwnerRole,
        reason: reason || 'Administrative ownership transfer',
      }),
    }),

  // Practice Members
  listPracticeMembers: (practiceId: string) => request<any[]>(`/api/platform/admin/practices/${practiceId}/users`),

  addMemberToPractice: (practiceId: string, data: { userId: string; role: string; isClinicalApprover?: boolean }) =>
    request<any>(`/api/platform/admin/practices/${practiceId}/users`, { method: 'POST', body: JSON.stringify(data) }),

  removeMemberFromPractice: (practiceId: string, memberId: string, reason?: string) =>
    request<any>(`/api/platform/admin/practices/${practiceId}/members/${memberId}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, { method: 'DELETE' }),

  updateMemberRole: (practiceId: string, memberId: string, role: string, isClinicalApprover?: boolean) =>
    request<any>(`/api/platform/admin/practices/${practiceId}/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role, isClinicalApprover }),
    }),

  updateMemberClinicalStatus: (practiceId: string, memberId: string, isClinicalApprover: boolean) =>
    request<any>(`/api/platform/admin/practices/${practiceId}/members/${memberId}/clinical-status`, {
      method: 'PATCH',
      body: JSON.stringify({ isClinicalApprover }),
    }),

  setMemberPermissionOverride: (practiceId: string, memberId: string, permission: string, effect: 'ALLOW' | 'DENY', reason?: string) =>
    request<any>(`/api/platform/admin/practices/${practiceId}/members/${memberId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permission, effect, reason }),
    }),

  removeMemberPermissionOverride: (practiceId: string, memberId: string, permission: string, reason?: string) =>
    request<any>(`/api/platform/admin/practices/${practiceId}/members/${memberId}/permissions/${permission}${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`, {
      method: 'DELETE',
    }),

  // Users
  listUsers: async (params?: { search?: string; status?: string; platformRole?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.platformRole && params.platformRole !== 'ALL') q.set('role', params.platformRole === 'PLATFORM_SUPER_ADMIN' ? 'SUPER_ADMIN' : params.platformRole);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));

    const res = await request<any>(`/api/platform/admin/users?${q.toString()}`);
    const rawResults = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
    const results: PlatformUserListItem[] = rawResults.map((u: any) => ({
      ...u,
      practiceMemberships: u.practiceMemberships || u.practices || [],
    }));
    const total: number = res?.total ?? results.length;
    const page: number = res?.page ?? 1;
    const pageSize: number = res?.pageSize ?? results.length;

    return { results, total, page, pageSize };
  },

  createUser: (data: {
    name: string;
    email: string;
    phone?: string;
    password?: string;
    practiceId?: string;
    role?: string;
    isClinicalApprover?: boolean;
    platformRole?: string | null;
  }) => request<any>('/api/platform/admin/users', { method: 'POST', body: JSON.stringify(data) }),

  getUserDetails: (id: string) => request<any>(`/api/platform/admin/users/${id}`),

  updateUser: (id: string, data: { name?: string; email?: string; phone?: string; platformRole?: string | null }) =>
    request<any>(`/api/platform/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  resetPassword: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/platform/admin/users/${id}/reset-password`, { method: 'POST' }),

  forcePasswordChange: (id: string) =>
    request<any>(`/api/platform/admin/users/${id}/force-password-change`, { method: 'POST' }),

  forceLogout: (id: string) =>
    request<any>(`/api/platform/admin/users/${id}/revoke-sessions`, { method: 'POST' }),

  activateUser: (id: string) =>
    request<any>(`/api/platform/admin/users/${id}/activate`, { method: 'POST' }),

  deactivateUser: (id: string, reason?: string) =>
    request<any>(`/api/platform/admin/users/${id}/deactivate`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Subscriptions & Payments
  listSubscriptions: async (params?: { search?: string; status?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));

    const res = await request<any>(`/api/platform/admin/subscriptions?${q.toString()}`);
    const results: PlatformSubscriptionItem[] = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
    const total: number = res?.total ?? results.length;
    const page: number = res?.page ?? 1;
    const pageSize: number = res?.pageSize ?? results.length;

    return { results, total, page, pageSize };
  },

  grantComplimentarySubscription: (data: {
    email: string;
    accessType: 'INDIVIDUAL' | 'CLINIC';
    durationMonths: number;
    reason?: string;
  }) =>
    request<{ success: boolean; message: string; practiceId: string; subscriptionId: string }>(
      '/api/platform/admin/subscriptions/complimentary',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  getPracticeInventoryAddon: (practiceId: string) =>
    request<{
      practiceId: string;
      practiceName?: string;
      hasSubscription: boolean;
      subscriptionId?: string;
      planCode?: string;
      planName?: string;
      subscriptionStatus?: string;
      isInventoryAddonActive: boolean;
      inventoryAddon: any;
      metadata: Record<string, any>;
    }>(`/api/platform/admin/practices/${practiceId}/addons/inventory`),

  grantInventoryAddon: (practiceId: string, data?: { reason?: string }) =>
    request<{
      practiceId: string;
      subscriptionId: string;
      inventoryAddon: {
        enabled: boolean;
        grantedBy: string;
        grantedAt: string;
        reason?: string;
        source: string;
      };
      metadata: Record<string, any>;
      message: string;
    }>(`/api/platform/admin/practices/${practiceId}/addons/inventory/grant`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  revokeInventoryAddon: (practiceId: string, data?: { reason?: string }) =>
    request<{
      practiceId: string;
      subscriptionId: string;
      inventoryAddon: {
        enabled: boolean;
        revokedBy: string;
        revokedAt: string;
        reason?: string;
      };
      metadata: Record<string, any>;
      message: string;
    }>(`/api/platform/admin/practices/${practiceId}/addons/inventory/revoke`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  listPayments: async (params?: { search?: string; status?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));

    const res = await request<any>(`/api/platform/admin/payments?${q.toString()}`);
    const rawResults = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
    const results: PlatformPaymentItem[] = rawResults.map((p: any) => ({
      ...p,
      amountINR: p.amountINR ?? (p.amountRupees ? Number(p.amountRupees) : p.amountPaisa ? p.amountPaisa / 100 : 0),
    }));
    const total: number = res?.total ?? results.length;
    const page: number = res?.page ?? 1;
    const pageSize: number = res?.pageSize ?? results.length;

    return { results, total, page, pageSize };
  },

  // Support Issues
  listIssues: async (params?: { status?: string; category?: string; priority?: string; practiceId?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.category && params.category !== 'ALL') q.set('category', params.category);
    if (params?.priority && params.priority !== 'ALL') q.set('priority', params.priority);
    if (params?.practiceId) q.set('practiceId', params.practiceId);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));

    const res = await request<any>(`/api/platform/admin/issues?${q.toString()}`);
    const results: PlatformIssueItem[] = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
    const total: number = res?.total ?? results.length;
    const page: number = res?.page ?? 1;
    const pageSize: number = res?.pageSize ?? results.length;

    return { results, total, page, pageSize };
  },

  createIssue: (data: {
    title: string;
    description: string;
    category?: string;
    priority?: string;
    practiceId?: string;
    userId?: string;
  }) => request<PlatformIssueItem>('/api/platform/admin/issues', { method: 'POST', body: JSON.stringify(data) }),

  getIssueDetails: (id: string) => request<PlatformIssueItem>(`/api/platform/admin/issues/${id}`),

  updateIssue: (id: string, data: { status?: string; priority?: string; category?: string; assignedToUserId?: string | null }) =>
    request<PlatformIssueItem>(`/api/platform/admin/issues/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  addIssueNote: (id: string, note: string) =>
    request<PlatformIssueItem>(`/api/platform/admin/issues/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),

  // Support Access Sessions
  startSupportSession: (data: { targetPracticeId: string; targetUserId?: string; reason: string; durationMinutes?: number }) =>
    request<SupportSessionItem>('/api/platform/admin/support-sessions', { method: 'POST', body: JSON.stringify(data) }),

  endSupportSession: (id: string) =>
    request<{ success: boolean; session: SupportSessionItem }>(`/api/platform/admin/support-sessions/${id}/end`, { method: 'POST' }),

  // Audit Logs
  listAuditLogs: async (params?: { action?: string; practiceId?: string; userId?: string; page?: number; pageSize?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.action) q.set('action', params.action);
    if (params?.practiceId) q.set('practiceId', params.practiceId);
    if (params?.userId) q.set('userId', params.userId);
    if (params?.page) q.set('page', String(params.page));
    const size = params?.pageSize || params?.limit || 25;
    q.set('pageSize', String(size));

    const res = await request<any>(`/api/platform/admin/audit?${q.toString()}`);
    const rawList = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
    const results: PlatformAuditLogItem[] = rawList.map((l: any) => ({
      ...l,
      userName: l.userName || l.user?.name,
      userEmail: l.userEmail || l.user?.email,
      practiceName: l.practiceName || l.practice?.name,
      metadata: l.metadata || l.details,
    }));
    const total: number = res?.total ?? results.length;
    const page: number = res?.page ?? 1;
    const pageSize: number = res?.pageSize ?? results.length;

    return { results, total, page, pageSize };
  },

  // Role Matrix
  getPermissionMatrix: async (): Promise<PermissionMatrixData> => {
    const raw = await request<any>('/api/platform/admin/permission-matrix');
    return {
      roles: ['PRACTICE_OWNER', 'PRACTICE_ADMIN', 'VETERINARIAN', 'STAFF', 'READ_ONLY', 'PRACTICE_STAFF'],
      permissions: {
        clinical: raw.categories?.CLINICAL || raw.permissions?.clinical || [],
        practice: raw.categories?.PRACTICE || raw.permissions?.practice || [],
        commercial: raw.categories?.COMMERCIAL || raw.permissions?.commercial || [],
        security: raw.categories?.SECURITY || raw.permissions?.security || [],
        platformOnly: raw.categories?.PLATFORM || raw.permissions?.platformOnly || [],
      },
      metadata: raw.metadata || {},
      roleDefaults: raw.rolePermissions || raw.roleDefaults || {},
      assignablePermissions: raw.assignablePermissions || [],
      categories: raw.categories,
    };
  },

  getRoleMatrix: async (): Promise<PermissionMatrixData> => platformAdminApi.getPermissionMatrix(),

  getPractice: (id: string) => platformAdminApi.getPracticeDetails(id),

  getMemberPermissions: (practiceId: string, memberId: string) =>
    request<any>(`/api/platform/admin/practices/${practiceId}/members/${memberId}/permissions`),

  setMemberOverride: (
    practiceId: string,
    memberId: string,
    data: { permission: string; effect: 'ALLOW' | 'DENY'; reason?: string }
  ) =>
    request<any>(`/api/platform/admin/practices/${practiceId}/members/${memberId}/permissions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeMemberOverride: (practiceId: string, memberId: string, permission: string, reason?: string) =>
    request<any>(
      `/api/platform/admin/practices/${practiceId}/members/${memberId}/permissions/${permission}${
        reason ? `?reason=${encodeURIComponent(reason)}` : ''
      }`,
      { method: 'DELETE' }
    ),
};
