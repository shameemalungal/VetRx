// ==============================================================================
// VetRx — Platform Super Admin API Client (web/src/services/platformAdminApi.ts)
// Type-safe HTTP client for all platform SaaS management endpoints.
// ==============================================================================

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let errMessage = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) errMessage = body.message;
      else if (body?.error) errMessage = body.error;
    } catch {
      // fallback
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
    activeSubscriptions: number;
    openIssues: number;
  };
  practicesByType: {
    independent: number;
    clinic: number;
    enterprise: number;
  };
  recentPractices: Array<{
    id: string;
    name: string;
    slug: string | null;
    practiceType: string;
    status: string;
    ownerName: string;
    ownerEmail: string;
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
  practiceMemberships: Array<{
    practiceId: string;
    practiceName: string;
    role: string;
    isClinicalApprover: boolean;
    isActive: boolean;
  }>;
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
}

export interface PlatformPaymentItem {
  id: string;
  practiceId: string;
  practiceName: string;
  amountINR: number;
  currency: string;
  status: string;
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
  createdAt: string;
}

export const platformAdminApi = {
  // Dashboard & Global Search
  getDashboard: () => request<PlatformDashboardData>('/api/platform/dashboard'),
  globalSearch: (q: string) => request<{ practices: any[]; users: any[]; issues: any[] }>(`/api/platform/search?q=${encodeURIComponent(q)}`),

  // Practices
  listPractices: (params?: { search?: string; type?: string; status?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.type && params.type !== 'ALL') q.set('type', params.type);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    return request<{ results: PlatformPracticeListItem[]; total: number; page: number; pageSize: number }>(`/api/platform/practices?${q.toString()}`);
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
  }) => request<any>('/api/platform/practices', { method: 'POST', body: JSON.stringify(data) }),
  getPracticeDetails: (id: string) => request<any>(`/api/platform/practices/${id}`),
  updatePractice: (id: string, data: { name?: string; practiceType?: string; status?: string }) =>
    request<any>(`/api/platform/practices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  suspendPractice: (id: string, reason?: string) =>
    request<any>(`/api/platform/practices/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reactivatePractice: (id: string) =>
    request<any>(`/api/platform/practices/${id}/reactivate`, { method: 'POST' }),
  transferOwnership: (id: string, targetMemberId: string, previousOwnerRole?: string) =>
    request<any>(`/api/platform/practices/${id}/transfer-ownership`, { method: 'POST', body: JSON.stringify({ targetMemberId, previousOwnerRole }) }),

  // Practice Members
  listPracticeMembers: (practiceId: string) => request<any[]>(`/api/platform/practices/${practiceId}/members`),
  addMemberToPractice: (practiceId: string, data: { userId: string; role: string; isClinicalApprover?: boolean }) =>
    request<any>(`/api/platform/practices/${practiceId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  removeMemberFromPractice: (practiceId: string, memberId: string) =>
    request<any>(`/api/platform/practices/${practiceId}/members/${memberId}`, { method: 'DELETE' }),
  updateMemberRole: (practiceId: string, memberId: string, role: string) =>
    request<any>(`/api/platform/practices/${practiceId}/members/${memberId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  updateMemberClinicalStatus: (practiceId: string, memberId: string, isClinicalApprover: boolean) =>
    request<any>(`/api/platform/practices/${practiceId}/members/${memberId}/clinical-status`, { method: 'PUT', body: JSON.stringify({ isClinicalApprover }) }),
  setMemberPermissionOverride: (practiceId: string, memberId: string, permission: string, effect: 'ALLOW' | 'DENY', reason?: string) =>
    request<any>(`/api/platform/practices/${practiceId}/members/${memberId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permission, effect, reason }),
    }),
  removeMemberPermissionOverride: (practiceId: string, memberId: string, permission: string) =>
    request<any>(`/api/platform/practices/${practiceId}/members/${memberId}/permissions`, {
      method: 'DELETE',
      body: JSON.stringify({ permission }),
    }),

  // Users
  listUsers: (params?: { search?: string; status?: string; platformRole?: string; page?: number; pageSize?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.platformRole && params.platformRole !== 'ALL') q.set('platformRole', params.platformRole);
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    return request<{ results: PlatformUserListItem[]; total: number; page: number; pageSize: number }>(`/api/platform/users?${q.toString()}`);
  },
  createUser: (data: { name: string; email: string; password?: string; platformRole?: string | null }) =>
    request<any>('/api/platform/users', { method: 'POST', body: JSON.stringify(data) }),
  getUserDetails: (id: string) => request<any>(`/api/platform/users/${id}`),
  updateUser: (id: string, data: { name?: string; email?: string; platformRole?: string | null }) =>
    request<any>(`/api/platform/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword: (id: string) => request<{ success: boolean; message: string }>(`/api/platform/users/${id}/reset-password`, { method: 'POST' }),
  forcePasswordChange: (id: string) => request<any>(`/api/platform/users/${id}/force-password-change`, { method: 'POST' }),
  forceLogout: (id: string) => request<any>(`/api/platform/users/${id}/force-logout`, { method: 'POST' }),
  activateUser: (id: string) => request<any>(`/api/platform/users/${id}/activate`, { method: 'POST' }),
  deactivateUser: (id: string) => request<any>(`/api/platform/users/${id}/deactivate`, { method: 'POST' }),

  // Subscriptions & Payments
  listSubscriptions: () => request<PlatformSubscriptionItem[]>('/api/platform/subscriptions'),
  listPayments: () => request<PlatformPaymentItem[]>('/api/platform/payments'),

  // Support Issues
  listIssues: (params?: { status?: string; category?: string; priority?: string }) => {
    const q = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.category && params.category !== 'ALL') q.set('category', params.category);
    if (params?.priority && params.priority !== 'ALL') q.set('priority', params.priority);
    return request<PlatformIssueItem[]>(`/api/platform/issues?${q.toString()}`);
  },
  createIssue: (data: {
    title: string;
    description: string;
    category?: string;
    priority?: string;
    practiceId?: string;
    userId?: string;
  }) => request<PlatformIssueItem>('/api/platform/issues', { method: 'POST', body: JSON.stringify(data) }),
  getIssueDetails: (id: string) => request<PlatformIssueItem>(`/api/platform/issues/${id}`),
  updateIssue: (id: string, data: { status?: string; priority?: string; category?: string }) =>
    request<PlatformIssueItem>(`/api/platform/issues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addIssueNote: (id: string, note: string) =>
    request<PlatformIssueItem>(`/api/platform/issues/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),

  // Support Access Sessions
  startSupportSession: (data: { targetPracticeId: string; reason: string; durationMinutes?: number }) =>
    request<SupportSessionItem>('/api/platform/support-sessions', { method: 'POST', body: JSON.stringify(data) }),
  endSupportSession: (id: string) =>
    request<{ success: boolean; session: SupportSessionItem }>(`/api/platform/support-sessions/${id}/end`, { method: 'POST' }),

  // Audit Logs
  listAuditLogs: (params?: { action?: string; practiceId?: string; userId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.action) q.set('action', params.action);
    if (params?.practiceId) q.set('practiceId', params.practiceId);
    if (params?.userId) q.set('userId', params.userId);
    if (params?.limit) q.set('limit', String(params.limit));
    return request<{ results: PlatformAuditLogItem[]; total: number }>(`/api/platform/audit-logs?${q.toString()}`);
  },

  // Role Matrix
  getPermissionMatrix: () => request<any>('/api/platform/matrix'),
};
