// ==============================================================================
// VetRx — Practice Team & Permissions Section (Phase 14 Extension)
// Simplified team management, unified Manage Member modal, categorized
// permissions customization with clinical confirmation, and seat quota guards.
// ==============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../ui/Icon';
import { InviteUserModal } from './InviteUserModal';
import { TransferOwnershipModal } from './TransferOwnershipModal';
import { PermissionGate } from '../auth/PermissionGate';
import './UsersPermissionsSection.css';

interface MemberItem {
  id: string;
  practiceId: string;
  userId: string;
  role: 'PRACTICE_OWNER' | 'PRACTICE_ADMIN' | 'VETERINARIAN' | 'STAFF' | 'PRACTICE_STAFF' | 'READ_ONLY';
  isClinicalApprover?: boolean;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  createdAt: string;
}

interface InvitationItem {
  id: string;
  email: string;
  role: 'PRACTICE_ADMIN' | 'VETERINARIAN' | 'STAFF' | 'READ_ONLY';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
}

interface PermissionGroupItem {
  key: string;
  label: string;
  description: string;
  isClinicalSafetyCritical?: boolean;
}

interface PermissionGroup {
  id: 'CLINICAL' | 'PRACTICE' | 'ADMINISTRATION' | 'BILLING' | 'SECURITY';
  name: string;
  description: string;
  permissions: PermissionGroupItem[];
}

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const UsersPermissionsSection: React.FC = () => {
  const { user, isPracticeOwner } = useAuth();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Commercial entitlement seat info
  const [planName, setPlanName] = useState('Clinic Plan');
  const [maxVets, setMaxVets] = useState<number>(5);
  const [usedVets, setUsedVets] = useState<number>(1);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Unified Manage Member Modal State
  const [managingMember, setManagingMember] = useState<MemberItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('STAFF');
  const [isClinical, setIsClinical] = useState<boolean>(false);
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  // Customize Permissions Modal State
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
  const [initialRoleDefaults, setInitialRoleDefaults] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, 'ALLOW' | 'DENY' | 'DEFAULT'>>({});
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  // Clinical Safety Confirmation Modal
  const [pendingClinicalPermKey, setPendingClinicalPermKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invRes, entRes, usageRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE}/api/practice/members`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/practice/invitations`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/commercial/entitlements`, { credentials: 'include' }).catch(() => null),
        fetch(`${API_BASE}/api/commercial/usage`, { credentials: 'include' }).catch(() => null),
        fetch(`${API_BASE}/api/practice/permission-groups`, { credentials: 'include' }).catch(() => null),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data);
      }

      if (invRes.ok) {
        const data = await invRes.json();
        setInvitations(data);
      }

      if (entRes && entRes.ok) {
        const ent = await entRes.json();
        setPlanName(ent.planName || 'Clinic Plan');
        setMaxVets(ent.limits?.maxVeterinarianSeats ?? 5);
      }

      if (usageRes && usageRes.ok) {
        const usage = await usageRes.json();
        setUsedVets(usage.veterinarianSeatsCount || 1);
      }

      if (groupsRes && groupsRes.ok) {
        const groups = await groupsRes.json();
        setPermissionGroups(groups);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load practice users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Open Manage Member Modal
  const handleOpenManage = (member: MemberItem) => {
    setManagingMember(member);
    setSelectedRole(member.role === 'PRACTICE_STAFF' ? 'STAFF' : member.role);
    setIsClinical(Boolean(member.isClinicalApprover || member.role === 'VETERINARIAN'));
    setManageError(null);
  };

  // Calculate Projected Seats
  const calculateProjectedSeats = (targetRole: string, targetClinical: boolean) => {
    if (!managingMember) return usedVets;
    const currentConsumes = managingMember.role === 'VETERINARIAN' || Boolean(managingMember.isClinicalApprover);
    const targetConsumes = targetRole === 'VETERINARIAN' || targetClinical;
    const netChange = (targetConsumes ? 1 : 0) - (currentConsumes ? 1 : 0);
    return usedVets + netChange;
  };

  // Handle Save Member Role & Clinical Status
  const handleSaveMemberChanges = async () => {
    if (!managingMember) return;
    setIsUpdatingMember(true);
    setManageError(null);

    const projected = calculateProjectedSeats(selectedRole, isClinical);
    if (projected > maxVets) {
      setManageError(
        `Your ${planName} allows up to ${maxVets} veterinarian seat(s). You currently have ${usedVets} active veterinarian seat(s). Please upgrade to add more veterinarians.`
      );
      setIsUpdatingMember(false);
      return;
    }

    try {
      // 1. Update role if changed and member is not owner
      if (managingMember.role !== 'PRACTICE_OWNER' && selectedRole !== managingMember.role) {
        const roleRes = await fetch(`${API_BASE}/api/practice/members/${managingMember.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ role: selectedRole }),
        });
        const roleData = await roleRes.json();
        if (!roleRes.ok) {
          throw new Error(roleData.error?.message || 'Failed to update role.');
        }
      }

      // 2. Update clinical approver status if role is Owner or Clinic Admin
      const isOwnerOrAdmin = managingMember.role === 'PRACTICE_OWNER' || selectedRole === 'PRACTICE_ADMIN';
      if (isOwnerOrAdmin && isClinical !== managingMember.isClinicalApprover) {
        const clinicalRes = await fetch(`${API_BASE}/api/practice/members/${managingMember.id}/clinical-status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isClinicalApprover: isClinical }),
        });
        const clinicalData = await clinicalRes.json();
        if (!clinicalRes.ok) {
          throw new Error(clinicalData.error?.message || 'Failed to update clinical designation.');
        }
      }

      setManagingMember(null);
      await fetchData();
    } catch (err: any) {
      setManageError(err.message || 'Error updating member settings.');
    } finally {
      setIsUpdatingMember(false);
    }
  };

  // Handle Member Activation Toggle
  const handleToggleActive = async () => {
    if (!managingMember) return;
    if (managingMember.role === 'PRACTICE_OWNER') {
      alert('The Practice Owner cannot be deactivated.');
      return;
    }

    const action = managingMember.isActive ? 'deactivate' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${managingMember.user.name}?`)) return;

    setIsUpdatingMember(true);
    setManageError(null);
    try {
      const res = await fetch(`${API_BASE}/api/practice/members/${managingMember.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || `Failed to ${action} member.`);
      }
      setManagingMember(null);
      await fetchData();
    } catch (err: any) {
      setManageError(err.message || `Error ${action}ing member.`);
    } finally {
      setIsUpdatingMember(false);
    }
  };

  // Open Customize Permissions Modal
  const handleOpenPermissions = async () => {
    if (!managingMember) return;
    setShowPermissionsModal(true);
    setIsLoadingPermissions(true);
    setPermissionsError(null);

    try {
      const res = await fetch(`${API_BASE}/api/practice/members/${managingMember.id}/permissions`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to load permissions.');
      }

      setInitialRoleDefaults(data.defaultPermissions || []);
      setMemberPermissions(data.effectivePermissions || []);

      const overrideMap: Record<string, 'ALLOW' | 'DENY' | 'DEFAULT'> = {};
      if (Array.isArray(data.overrides)) {
        data.overrides.forEach((ov: any) => {
          overrideMap[ov.permission] = ov.effect;
        });
      }
      setOverrides(overrideMap);
    } catch (err: any) {
      setPermissionsError(err.message || 'Failed to load member permissions.');
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  // Toggle Single Permission in Customize Modal
  const handleTogglePermission = (permKey: string) => {
    const isCurrentlyEffective = memberPermissions.includes(permKey);
    const targetEnabled = !isCurrentlyEffective;

    // Check if critical clinical permission
    if (permKey === 'PRESCRIPTION_APPROVE' && targetEnabled) {
      setPendingClinicalPermKey(permKey);
      return;
    }

    applyPermissionToggle(permKey, targetEnabled);
  };

  const applyPermissionToggle = (permKey: string, targetEnabled: boolean) => {
    const isDefault = initialRoleDefaults.includes(permKey);

    // If targetEnabled matches default, effect is DEFAULT (remove override)
    let newEffect: 'ALLOW' | 'DENY' | 'DEFAULT' = 'DEFAULT';
    if (targetEnabled && !isDefault) {
      newEffect = 'ALLOW';
    } else if (!targetEnabled && isDefault) {
      newEffect = 'DENY';
    }

    setOverrides((prev) => ({
      ...prev,
      [permKey]: newEffect,
    }));

    setMemberPermissions((prev) =>
      targetEnabled ? [...prev, permKey] : prev.filter((k) => k !== permKey)
    );
  };

  // Save Permission Overrides
  const handleSavePermissions = async () => {
    if (!managingMember) return;
    setIsSavingPermissions(true);
    setPermissionsError(null);

    const payloadOverrides = Object.entries(overrides).map(([permission, effect]) => ({
      permission,
      effect,
    }));

    try {
      const res = await fetch(`${API_BASE}/api/practice/members/${managingMember.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ overrides: payloadOverrides }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update permissions.');
      }

      setShowPermissionsModal(false);
      await fetchData();
    } catch (err: any) {
      setPermissionsError(err.message || 'Error updating permissions.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Reset Permissions to Defaults
  const handleResetPermissions = async () => {
    if (!managingMember) return;
    if (!window.confirm('Reset all permission overrides back to role defaults?')) return;

    setIsSavingPermissions(true);
    setPermissionsError(null);

    try {
      const res = await fetch(`${API_BASE}/api/practice/members/${managingMember.id}/permissions/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to reset permissions.');
      }

      setShowPermissionsModal(false);
      await fetchData();
    } catch (err: any) {
      setPermissionsError(err.message || 'Error resetting permissions.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Handle Resend Invitation
  const handleResendInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/practice/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to resend invitation.');
      }

      alert(`Invitation resent successfully to ${data.email}.`);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error resending invitation.');
    }
  };

  // Handle Revoke Invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/practice/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to revoke invitation.');
      }

      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error revoking invitation.');
    }
  };

  // Render Combined Role Label
  const renderRoleLabel = (member: MemberItem) => {
    const isClin = Boolean(member.isClinicalApprover || member.role === 'VETERINARIAN');
    switch (member.role) {
      case 'PRACTICE_OWNER':
        return isClin ? 'Owner · Veterinarian' : 'Owner';
      case 'PRACTICE_ADMIN':
        return isClin ? 'Clinic Admin · Veterinarian' : 'Clinic Admin';
      case 'VETERINARIAN':
        return 'Veterinarian';
      case 'STAFF':
      case 'PRACTICE_STAFF':
        return 'Staff';
      case 'READ_ONLY':
        return 'Read Only';
      default:
        return member.role;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <p>Loading team & permissions...</p>
      </div>
    );
  }

  return (
    <div className="users-permissions-container">
      {/* Top Bar with actions */}
      <div className="users-top-bar">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
            Team & Permissions
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
            Manage your clinic staff, roles, clinical approvers, and permissions.
          </p>
        </div>

        <div className="users-top-actions">
          {/* Seat Quota Indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: '#334155',
            }}
          >
            <span>Veterinarian Seats:</span>
            <strong style={{ color: usedVets >= maxVets ? '#b91c1c' : '#00685f' }}>
              {usedVets} / {maxVets}
            </strong>
          </div>

          {isPracticeOwner() && members.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowTransferModal(true)}
              style={{ minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="shuffle" size={16} />
              <span>Transfer Ownership</span>
            </button>
          )}

          <PermissionGate permission="USER_INVITE">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowInviteModal(true)}
              style={{ minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="user-plus" size={16} />
              <span>+ Add Team Member</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Active Team Members Card */}
      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h3 className="users-table-title">Team Members ({members.length})</h3>
            <p className="users-table-sub">Active clinicians and staff members in your practice</p>
          </div>
        </div>

        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isCurrentUser = m.userId === user?.id;
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {m.user.name ? m.user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="user-name-col">
                          <span className="user-display-name">
                            {m.user.name} {isCurrentUser && <span style={{ color: '#00685f', fontSize: '11px' }}>(You)</span>}
                          </span>
                          <span className="user-display-email">{m.user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="role-badge owner" style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}>
                        {renderRoleLabel(m)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${m.isActive ? 'active' : 'disabled'}`}>
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: m.isActive ? '#137333' : '#ba1a1a',
                          }}
                        />
                        {m.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <PermissionGate permission="ROLE_ASSIGN">
                        <button
                          type="button"
                          className="action-btn-sm"
                          onClick={() => handleOpenManage(m)}
                          title="Manage role and permissions"
                        >
                          <Icon name="settings" size={14} />
                          <span>Manage</span>
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Card */}
      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h3 className="users-table-title">Pending Invitations ({invitations.filter((i) => i.status === 'PENDING').length})</h3>
            <p className="users-table-sub">Outstanding invitations sent to prospective team members</p>
          </div>
        </div>

        {invitations.filter((i) => i.status === 'PENDING').length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
            No pending invitations. Click <strong>+ Add Team Member</strong> above to invite new colleagues.
          </div>
        ) : (
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Invitee Email</th>
                  <th>Invited Role</th>
                  <th>Sent Date</th>
                  <th>Expires</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations
                  .filter((i) => i.status === 'PENDING')
                  .map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <strong>{inv.email}</strong>
                      </td>
                      <td>
                        <span className="role-badge staff">
                          {inv.role === 'PRACTICE_ADMIN'
                            ? 'Clinic Admin'
                            : inv.role === 'VETERINARIAN'
                            ? 'Veterinarian'
                            : inv.role === 'READ_ONLY'
                            ? 'Read Only'
                            : 'Staff'}
                        </span>
                      </td>
                      <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td style={{ color: '#64748b' }}>
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="action-btn-sm"
                            onClick={() => handleResendInvitation(inv.id)}
                            title="Resend invitation email"
                          >
                            <Icon name="refresh-cw" size={14} />
                            <span>Resend</span>
                          </button>
                          <button
                            type="button"
                            className="action-btn-sm danger"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            title="Revoke invitation"
                          >
                            <Icon name="trash" size={14} />
                            <span>Revoke</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          UNIFIED MANAGE MEMBER MODAL
          ========================================================================= */}
      {managingMember && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Manage Member: {managingMember.user.name}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setManagingMember(null)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              {manageError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px', marginBottom: '16px' }}>
                  {manageError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Email Address
                  </label>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#0f172a', marginTop: '2px' }}>
                    {managingMember.user.email}
                  </div>
                </div>

                {/* Role Selector */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                    Role Assignment
                  </label>
                  {managingMember.role === 'PRACTICE_OWNER' ? (
                    <div style={{ marginTop: '4px', fontSize: '13.5px', color: '#475569' }}>
                      <strong style={{ color: '#00685f' }}>Owner</strong> (Primary Account Authority)
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        To change the owner, use the <em>Transfer Ownership</em> button on the Team page.
                      </div>
                    </div>
                  ) : (
                    <select
                      className="auth-input"
                      style={{ marginTop: '4px', background: '#ffffff' }}
                      value={selectedRole}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setSelectedRole(newRole);
                        if (newRole === 'VETERINARIAN') {
                          setIsClinical(true);
                        } else if (newRole === 'STAFF' || newRole === 'READ_ONLY') {
                          setIsClinical(false);
                        }
                      }}
                    >
                      <option value="VETERINARIAN">Veterinarian</option>
                      <option value="PRACTICE_ADMIN">Clinic Admin</option>
                      <option value="STAFF">Staff</option>
                      <option value="READ_ONLY">Read Only</option>
                    </select>
                  )}
                </div>

                {/* Practicing Veterinarian Clinical Status */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor:
                        selectedRole === 'STAFF' || selectedRole === 'READ_ONLY' || selectedRole === 'VETERINARIAN'
                          ? 'default'
                          : 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ marginTop: '3px', accentColor: '#00685f' }}
                      checked={isClinical}
                      disabled={
                        selectedRole === 'STAFF' ||
                        selectedRole === 'READ_ONLY' ||
                        selectedRole === 'VETERINARIAN'
                      }
                      onChange={(e) => setIsClinical(e.target.checked)}
                    />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                        Practicing Veterinarian
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {selectedRole === 'VETERINARIAN'
                          ? 'Required for Veterinarians (Consumes 1 clinical seat).'
                          : selectedRole === 'STAFF' || selectedRole === 'READ_ONLY'
                          ? 'Staff cannot approve prescriptions.'
                          : 'Check this to allow this administrator to examine patients and approve prescriptions. Consumes 1 clinical seat.'}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Permissions Customization Button */}
                <div style={{ paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={handleOpenPermissions}
                  >
                    <Icon name="sliders" size={16} />
                    <span>Customize Permissions</span>
                  </button>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 0', textAlign: 'center' }}>
                    Configure specific feature access overrides for this team member
                  </p>
                </div>

                {/* Account Status / Deactivate */}
                {managingMember.role !== 'PRACTICE_OWNER' && (
                  <div style={{ paddingTop: '8px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                        Account Status
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {managingMember.isActive ? 'Active team member' : 'Deactivated (no login access)'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`action-btn-sm ${managingMember.isActive ? 'danger' : ''}`}
                      onClick={handleToggleActive}
                      disabled={isUpdatingMember}
                    >
                      {managingMember.isActive ? 'Deactivate Member' : 'Reactivate Member'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setManagingMember(null)}
                disabled={isUpdatingMember}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveMemberChanges}
                disabled={isUpdatingMember}
              >
                {isUpdatingMember ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CUSTOMIZE PERMISSIONS MODAL
          ========================================================================= */}
      {showPermissionsModal && managingMember && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                  Customize Permissions: {managingMember.user.name}
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Role: <strong>{renderRoleLabel(managingMember)}</strong>
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowPermissionsModal(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
              {permissionsError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px', marginBottom: '16px' }}>
                  {permissionsError}
                </div>
              )}

              {isLoadingPermissions ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Loading permissions…
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {permissionGroups.map((group) => (
                    <div
                      key={group.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          background: '#f8fafc',
                          padding: '10px 14px',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{group.name}</strong>
                          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                            {group.description}
                          </span>
                        </div>
                      </div>

                      <div style={{ padding: '8px 14px' }}>
                        {group.permissions.map((perm) => {
                          const isChecked = memberPermissions.includes(perm.key);
                          const isOverride = overrides[perm.key] && overrides[perm.key] !== 'DEFAULT';

                          return (
                            <label
                              key={perm.key}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                padding: '8px 0',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                style={{ marginTop: '3px', accentColor: '#00685f' }}
                                checked={isChecked}
                                onChange={() => handleTogglePermission(perm.key)}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>{perm.label}</span>
                                  {isOverride && (
                                    <span style={{ fontSize: '10.5px', padding: '1px 6px', background: '#e0f2fe', color: '#0284c7', borderRadius: '4px' }}>
                                      Customized
                                    </span>
                                  )}
                                  {perm.isClinicalSafetyCritical && (
                                    <span style={{ fontSize: '10.5px', padding: '1px 6px', background: '#fef3c7', color: '#b45309', borderRadius: '4px' }}>
                                      Clinical
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                  {perm.description}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#dc2626' }}
                onClick={handleResetPermissions}
                disabled={isSavingPermissions}
              >
                Reset to Role Defaults
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPermissionsModal(false)}
                  disabled={isSavingPermissions}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSavePermissions}
                  disabled={isSavingPermissions}
                >
                  {isSavingPermissions ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CLINICAL PERMISSION WARNING MODAL (Section 24)
          ========================================================================= */}
      {pendingClinicalPermKey && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-container" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309' }}>
                <Icon name="alert-triangle" size={20} />
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Clinical Permission Warning
                </h3>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5, margin: 0 }}>
                This permission allows the user to review and approve prescriptions created by other team members. Only qualified veterinary practitioners should be given this permission.
              </p>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPendingClinicalPermKey(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  applyPermissionToggle(pendingClinicalPermKey, true);
                  setPendingClinicalPermKey(null);
                }}
              >
                Confirm & Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <InviteUserModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={async () => {
            setShowInviteModal(false);
            await fetchData();
          }}
        />
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <TransferOwnershipModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          members={members.map((m) => ({
            id: m.id,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
          }))}
          currentUserId={user?.id || ''}
          onSuccess={async () => {
            setShowTransferModal(false);
            await fetchData();
          }}
        />
      )}
    </div>
  );
};
