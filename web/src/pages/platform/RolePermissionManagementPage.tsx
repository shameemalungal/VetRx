// ==============================================================================
// VetRx — RolePermissionManagementPage.tsx
// Platform Super Admin Role & Action Matrix Management (Section 9A)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

interface PracticeSummary {
  id: string;
  name: string;
  slug: string | null;
  ownerUserId: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    members: number;
    patients: number;
    prescriptions: number;
  };
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface PracticeMember {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

interface PermissionMetadataItem {
  name: string;
  category: string;
  description: string;
  clinicalSafetyWarning?: boolean;
}

interface PermissionMatrixData {
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
}

interface MemberOverrideItem {
  id: string;
  permission: string;
  effect: 'ALLOW' | 'DENY';
  reason?: string | null;
  createdAt: string;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface MemberPermissionsResponse {
  member: {
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  };
  defaults: string[];
  overrides: MemberOverrideItem[];
  effectivePermissions: string[];
}

export const RolePermissionManagementPage: React.FC = () => {
  const { user, isPlatformAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'member_overrides' | 'role_matrix'>('member_overrides');
  const [practices, setPractices] = useState<PracticeSummary[]>([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string>('');
  const [members, setMembers] = useState<PracticeMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');

  const [matrixData, setMatrixData] = useState<PermissionMatrixData | null>(null);
  const [memberPermissions, setMemberPermissions] = useState<MemberPermissionsResponse | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Override Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [targetPermission, setTargetPermission] = useState<string>('');
  const [targetEffect, setTargetEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [overrideReason, setOverrideReason] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Practices and Global Matrix on Mount
  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      try {
        const [practicesRes, matrixRes] = await Promise.all([
          fetch(`${API_BASE}/api/platform/admin/practices`, { credentials: 'include' }),
          fetch(`${API_BASE}/api/platform/admin/permission-matrix`, { credentials: 'include' }),
        ]);

        if (practicesRes.ok) {
          const pData = await practicesRes.json();
          setPractices(pData);
          if (pData.length > 0 && !selectedPracticeId) {
            setSelectedPracticeId(pData[0].id);
          }
        }

        if (matrixRes.ok) {
          const mData = await matrixRes.json();
          setMatrixData(mData);
        }
      } catch (err) {
        console.error('Failed to load platform matrix data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, []);

  // When selectedPracticeId changes, load practice members
  useEffect(() => {
    if (!selectedPracticeId) return;

    const loadPracticeMembers = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/platform/admin/practices/${selectedPracticeId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const mems: PracticeMember[] = data.members || [];
          setMembers(mems);
          if (mems.length > 0) {
            setSelectedMemberId(mems[0].id);
          } else {
            setSelectedMemberId('');
            setMemberPermissions(null);
          }
        }
      } catch (err) {
        console.error('Failed to load practice details:', err);
      }
    };

    void loadPracticeMembers();
  }, [selectedPracticeId]);

  // When selectedMemberId changes, load member effective permissions & overrides
  const loadMemberPermissions = async () => {
    if (!selectedPracticeId || !selectedMemberId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/platform/admin/practices/${selectedPracticeId}/members/${selectedMemberId}/permissions`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setMemberPermissions(data);
      }
    } catch (err) {
      console.error('Failed to fetch member permissions:', err);
    }
  };

  useEffect(() => {
    void loadMemberPermissions();
  }, [selectedPracticeId, selectedMemberId]);

  // Open Override Modal
  const handleOpenOverrideModal = (permission: string, defaultEffect: 'ALLOW' | 'DENY') => {
    setTargetPermission(permission);
    setTargetEffect(defaultEffect);
    setOverrideReason('');
    setModalOpen(true);
  };

  // Submit Override
  const handleSubmitOverride = async () => {
    if (!selectedPracticeId || !selectedMemberId || !targetPermission) return;
    setIsUpdating(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/platform/admin/practices/${selectedPracticeId}/members/${selectedMemberId}/permissions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            permission: targetPermission,
            effect: targetEffect,
            reason: overrideReason.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        showToast(`Override saved: ${targetPermission} is now ${targetEffect}.`);
        setModalOpen(false);
        await loadMemberPermissions();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.message || 'Failed to save override'}`);
      }
    } catch (err) {
      console.error('Failed to save override:', err);
      showToast('Network error saving override.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Remove Override (Reset to Role Default)
  const handleResetOverride = async (permission: string) => {
    if (!selectedPracticeId || !selectedMemberId) return;
    setIsUpdating(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/platform/admin/practices/${selectedPracticeId}/members/${selectedMemberId}/permissions/${permission}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (res.ok) {
        showToast(`Override removed. Reset to role default.`);
        await loadMemberPermissions();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.message || 'Failed to reset override'}`);
      }
    } catch (err) {
      console.error('Failed to reset override:', err);
      showToast('Network error removing override.');
    } finally {
      setIsUpdating(false);
    }
  };

  const selectedPractice = practices.find((p) => p.id === selectedPracticeId);
  const selectedMember = members.find((m) => m.id === selectedMemberId);

  // Grouped permissions
  const categories = [
    { key: 'clinical', label: 'Clinical Actions & Prescribing', icon: 'stethoscope' },
    { key: 'practice', label: 'Practice & Patient Operations', icon: 'hospital' },
    { key: 'commercial', label: 'Commercial & Financial Entitlements', icon: 'invoices' },
    { key: 'security', label: 'Practice Security & Member Management', icon: 'shield' },
  ];

  if (!isPlatformAdmin?.() && user?.platformRole !== 'PLATFORM_SUPER_ADMIN') {
    return (
      <div className="rx-page-container" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', background: '#fff', padding: '32px', borderRadius: '16px', border: '1px solid #fecaca' }}>
          <Icon name="block" size={36} color="#dc2626" />
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '16px 0 8px' }}>Access Denied</h2>
          <p style={{ fontSize: '13.5px', color: 'var(--color-on-surface-variant)' }}>
            This interface requires Platform Super Admin credentials. Practice-level users cannot access or modify global platform permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rx-page-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 9999,
            background: 'var(--color-on-surface)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <Icon name="check-circle" size={18} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Deck */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0, 104, 95, 0.1)',
                color: 'var(--color-primary)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <Icon name="shield" size={13} />
              Platform Super Admin Control
            </span>
            <span
              style={{
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              Section 9A RBAC
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-on-surface)', margin: 0, letterSpacing: '-0.02em' }}>
            Platform Role &amp; Action Matrix
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
            Inspect role default capabilities and configure granular, auditable account-level permission overrides across tenant practices.
            {isLoading && <span style={{ marginLeft: '10px', color: 'var(--color-primary)', fontWeight: 600 }}>Loading…</span>}
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--color-surface-container-high)', borderRadius: '10px', padding: '4px', gap: '4px' }}>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'member_overrides' ? '#fff' : 'transparent',
              color: activeTab === 'member_overrides' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              boxShadow: activeTab === 'member_overrides' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
            onClick={() => setActiveTab('member_overrides')}
          >
            Member Overrides
          </button>
          <button
            type="button"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'role_matrix' ? '#fff' : 'transparent',
              color: activeTab === 'role_matrix' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              boxShadow: activeTab === 'role_matrix' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
            onClick={() => setActiveTab('role_matrix')}
          >
            Role Default Matrix
          </button>
        </div>
      </div>

      {/* Tenant Practice Selection Strip */}
      <div
        style={{
          background: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-surface-container)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="hospital" size={18} color="var(--color-primary)" />
            <label htmlFor="select-tenant-practice" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
              Practice Tenant:
            </label>
          </div>
          <select
            id="select-tenant-practice"
            className="form-input"
            style={{ minWidth: '260px', height: '38px', fontSize: '13px', borderRadius: '8px' }}
            value={selectedPracticeId}
            onChange={(e) => setSelectedPracticeId(e.target.value)}
          >
            {practices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.owner?.name ? `(Owner: ${p.owner.name})` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedPractice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
            <span>Members: <strong>{selectedPractice._count?.members || members.length}</strong></span>
            <span>Patients: <strong>{selectedPractice._count?.patients || 0}</strong></span>
            <span>Prescriptions: <strong>{selectedPractice._count?.prescriptions || 0}</strong></span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: selectedPractice.isActive ? '#059669' : '#dc2626',
                fontWeight: 600,
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: selectedPractice.isActive ? '#10b981' : '#ef4444' }} />
              {selectedPractice.isActive ? 'Active' : 'Suspended'}
            </span>
          </div>
        )}
      </div>

      {activeTab === 'member_overrides' ? (
        /* ── Tab 1: Member Overrides View ──────────────────────────── */
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
          {/* Left Column: Practice Member Directory */}
          <div
            style={{
              background: 'var(--color-surface-container-lowest)',
              border: '1px solid var(--color-surface-container)',
              borderRadius: '16px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--color-on-surface)' }}>
                Practice Members
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                {members.length} {members.length === 1 ? 'user' : 'users'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {members.map((m) => {
                const isSelected = m.id === selectedMemberId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-surface-container)',
                      background: isSelected ? 'rgba(0, 104, 95, 0.05)' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setSelectedMemberId(m.id)}
                  >
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'var(--color-surface-container-high)',
                        color: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                        flexShrink: 0,
                      }}
                    >
                      {m.user?.name ? m.user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.user?.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.user?.email}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: m.role === 'VETERINARIAN' ? '#ecfdf5' : m.role === 'PRACTICE_OWNER' ? '#f5f3ff' : '#f1f5f9',
                            color: m.role === 'VETERINARIAN' ? '#047857' : m.role === 'PRACTICE_OWNER' ? '#6d28d9' : '#475569',
                          }}
                        >
                          {m.role.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Member Action Rights & Overrides Deck */}
          <div>
            {selectedMember ? (
              <div
                style={{
                  background: 'var(--color-surface-container-lowest)',
                  border: '1px solid var(--color-surface-container)',
                  borderRadius: '16px',
                  padding: '20px 24px',
                }}
              >
                {/* Member Profile Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--color-surface-container)', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Configuring Member Rights
                    </span>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--color-on-surface)' }}>
                      {selectedMember.user?.name}
                    </h2>
                    <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                      {selectedMember.user?.email} • Base Role: <strong>{selectedMember.role.replace(/_/g, ' ')}</strong>
                    </span>
                  </div>

                  {memberPermissions && memberPermissions.overrides.length > 0 && (
                    <div
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '10px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        color: '#1d4ed8',
                        fontWeight: 600,
                      }}
                    >
                      ⚡ {memberPermissions.overrides.length} Active Override{memberPermissions.overrides.length === 1 ? '' : 's'}
                    </div>
                  )}
                </div>

                {/* Filter Search Bar */}
                <div style={{ marginBottom: '20px' }}>
                  <input
                    type="text"
                    placeholder="Search permissions by code, name, or action..."
                    className="form-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', height: '40px', fontSize: '13px', borderRadius: '10px' }}
                  />
                </div>

                {/* Grouped Permission Categories */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {categories.map(({ key, label, icon }) => {
                    const permList = (matrixData?.permissions as any)?.[key] || [];
                    const filtered = permList.filter((code: string) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      const meta = matrixData?.metadata?.[code];
                      return (
                        code.toLowerCase().includes(q) ||
                        meta?.name.toLowerCase().includes(q) ||
                        meta?.description.toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) return null;

                    return (
                      <div key={key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <Icon name={icon} size={18} color="var(--color-primary)" />
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)', margin: 0 }}>
                            {label}
                          </h4>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                            ({filtered.length})
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {filtered.map((code: string) => {
                            const meta = matrixData?.metadata?.[code];
                            const isDefault = memberPermissions?.defaults?.includes(code);
                            const override = memberPermissions?.overrides?.find((o) => o.permission === code);

                            const isAllowOverride = override?.effect === 'ALLOW';

                            return (
                              <div
                                key={code}
                                style={{
                                  padding: '12px 16px',
                                  borderRadius: '10px',
                                  border: override
                                    ? isAllowOverride
                                      ? '1.5px solid #86efac'
                                      : '1.5px solid #fca5a5'
                                    : '1px solid var(--color-surface-container)',
                                  background: override
                                    ? isAllowOverride
                                      ? '#f0fdf4'
                                      : '#fef2f2'
                                    : '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '12px',
                                }}
                              >
                                <div style={{ minWidth: '240px', flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                                      {meta?.name || code}
                                    </span>
                                    {meta?.clinicalSafetyWarning && (
                                      <span
                                        style={{
                                          background: '#fee2e2',
                                          color: '#dc2626',
                                          fontSize: '10px',
                                          fontWeight: 700,
                                          padding: '1px 6px',
                                          borderRadius: '4px',
                                        }}
                                        title="Clinical Safety Sensitivity: Delegates legal prescription approval authority"
                                      >
                                        Clinical Safety Sensitive
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                                    {meta?.description}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                                    {code}
                                  </div>

                                  {override && override.reason && (
                                    <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic', marginTop: '4px' }}>
                                      Reason: "{override.reason}"
                                    </div>
                                  )}
                                </div>

                                {/* Status & Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {/* Status Chip */}
                                  {override ? (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        fontSize: '11.5px',
                                        fontWeight: 700,
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        background: isAllowOverride ? '#dcfce7' : '#fee2e2',
                                        color: isAllowOverride ? '#15803d' : '#b91c1c',
                                      }}
                                    >
                                      {isAllowOverride ? '⚡ OVERRIDE: ALLOW' : '⚡ OVERRIDE: DENY'}
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        background: isDefault ? '#f1f5f9' : '#f8fafc',
                                        color: isDefault ? '#334155' : '#94a3b8',
                                      }}
                                    >
                                      Default: {isDefault ? 'Granted' : 'Denied'}
                                    </span>
                                  )}

                                  {/* Action Buttons */}
                                  {override ? (
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
                                      onClick={() => handleResetOverride(code)}
                                      disabled={isUpdating}
                                    >
                                      Reset to Default
                                    </button>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      {!isDefault && (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ height: '32px', fontSize: '12px', padding: '0 10px', color: '#15803d', borderColor: '#bbf7d0' }}
                                          onClick={() => handleOpenOverrideModal(code, 'ALLOW')}
                                          disabled={isUpdating}
                                        >
                                          Grant (Allow)
                                        </button>
                                      )}
                                      {isDefault && (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ height: '32px', fontSize: '12px', padding: '0 10px', color: '#b91c1c', borderColor: '#fecaca' }}
                                          onClick={() => handleOpenOverrideModal(code, 'DENY')}
                                          disabled={isUpdating}
                                        >
                                          Revoke (Deny)
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '16px', border: '1px solid var(--color-surface-container)' }}>
                <Icon name="user" size={32} color="var(--color-outline)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '12px 0 4px' }}>No Member Selected</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                  Select a practice member from the left panel to inspect and customize their permission matrix.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Tab 2: Global Role Default Matrix Grid ─────────────────── */
        <div
          style={{
            background: 'var(--color-surface-container-lowest)',
            border: '1px solid var(--color-surface-container)',
            borderRadius: '16px',
            padding: '24px',
            overflowX: 'auto',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--color-on-surface)' }}>
              Baseline Practice Role Matrix
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>
              Standard system-level baseline capabilities assigned to tenant roles by default before account overrides.
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-surface-container)', textAlign: 'left' }}>
                <th style={{ padding: '12px 14px', color: 'var(--color-on-surface)' }}>Permission</th>
                <th style={{ padding: '12px 14px', color: 'var(--color-on-surface)' }}>Category</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Owner</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Admin</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Veterinarian</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Staff</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Read Only</th>
              </tr>
            </thead>
            <tbody>
              {matrixData &&
                Object.entries(matrixData.metadata).map(([code, meta]) => {
                  const isOwner = matrixData.roleDefaults['PRACTICE_OWNER']?.includes(code);
                  const isAdmin = matrixData.roleDefaults['PRACTICE_ADMIN']?.includes(code);
                  const isVet = matrixData.roleDefaults['VETERINARIAN']?.includes(code);
                  const isStaff = matrixData.roleDefaults['STAFF']?.includes(code);
                  const isReadOnly = matrixData.roleDefaults['READ_ONLY']?.includes(code);

                  return (
                    <tr key={code} style={{ borderBottom: '1px solid var(--color-surface-container)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-on-surface)' }}>{meta.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-outline)', fontFamily: 'var(--font-mono)' }}>{code}</div>
                      </td>
                      <td style={{ padding: '10px 14px', textTransform: 'capitalize', color: 'var(--color-on-surface-variant)' }}>
                        {meta.category}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {isOwner ? <span style={{ color: '#059669', fontWeight: 800 }}>✓</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {isAdmin ? <span style={{ color: '#059669', fontWeight: 800 }}>✓</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {isVet ? <span style={{ color: '#059669', fontWeight: 800 }}>✓</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {isStaff ? <span style={{ color: '#059669', fontWeight: 800 }}>✓</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {isReadOnly ? <span style={{ color: '#059669', fontWeight: 800 }}>✓</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Override Modal */}
      {modalOpen && (
        <div className="rx-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '500px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: targetEffect === 'ALLOW' ? '#ecfdf5' : '#fee2e2',
                  color: targetEffect === 'ALLOW' ? '#047857' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name={targetEffect === 'ALLOW' ? 'check' : 'close'} size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Configure Permission Override
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                  Account-level grant/revoke for {selectedMember?.user?.name}
                </span>
              </div>
            </div>

            {/* Clinical Safety Warning Banner */}
            {targetPermission === 'PRESCRIPTION_APPROVE' && targetEffect === 'ALLOW' && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fca5a5',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  lineHeight: 1.45,
                  color: '#991b1b',
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="alert-triangle" size={16} color="#dc2626" />
                  CLINICAL SAFETY WARNING
                </div>
                You are granting digital prescription approval authority. Under veterinary statutory regulations, digital sign-off and approval of controlled therapeutic regimens must only be delegated to registered, licensed veterinary clinicians.
              </div>
            )}

            <div style={{ background: 'var(--color-surface-container)', padding: '12px 14px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                {matrixData?.metadata?.[targetPermission]?.name || targetPermission}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                {matrixData?.metadata?.[targetPermission]?.description}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="override-effect-select">
                Override Effect *
              </label>
              <select
                id="override-effect-select"
                className="form-input"
                value={targetEffect}
                onChange={(e) => setTargetEffect(e.target.value as 'ALLOW' | 'DENY')}
                style={{ width: '100%', height: '38px', fontSize: '13px' }}
              >
                <option value="ALLOW">ALLOW (Grant permission regardless of role)</option>
                <option value="DENY">DENY (Revoke permission regardless of role)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="override-reason-input">
                Audit Reason / Clinical Justification <span style={{ color: 'var(--color-outline)', fontWeight: 400 }}>(recorded immutably)</span>
              </label>
              <textarea
                id="override-reason-input"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Authorized under clinical governance audit; veterinary license verified."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                style={{ fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '40px', minWidth: '100px' }}
                onClick={() => setModalOpen(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '40px', minWidth: '140px' }}
                onClick={handleSubmitOverride}
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving…' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
