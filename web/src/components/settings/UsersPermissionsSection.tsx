// ==============================================================================
// VetRx — Practice Users & Permissions Section (Phase 14)
// Complete practice administration interface for members, roles, and invitations.
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

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const UsersPermissionsSection: React.FC = () => {
  const { user, isPracticeOwner } = useAuth();

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Commercial entitlement seat info
  const [planName, setPlanName] = useState('Clinic Plan');
  const [maxVets, setMaxVets] = useState<number | null>(5);
  const [usedVets, setUsedVets] = useState<number>(1);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Role Edit State
  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('STAFF');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Clinical Status Modal State
  const [clinicalModalMember, setClinicalModalMember] = useState<MemberItem | null>(null);
  const [isUpdatingClinical, setIsUpdatingClinical] = useState(false);
  const [clinicalError, setClinicalError] = useState<string | null>(null);

  // Deactivate Confirm State
  const [deactivatingMember, setDeactivatingMember] = useState<MemberItem | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invRes, entRes, usageRes] = await Promise.all([
        fetch(`${API_BASE}/api/practice/members`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/practice/invitations`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/commercial/entitlements`, { credentials: 'include' }).catch(() => null),
        fetch(`${API_BASE}/api/commercial/usage`, { credentials: 'include' }).catch(() => null),
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
    } catch (err: any) {
      setError(err.message || 'Failed to load practice users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Handle Role Change
  const handleSaveRole = async () => {
    if (!editingMember) return;
    setIsUpdatingRole(true);
    setRoleError(null);
    try {
      const res = await fetch(`${API_BASE}/api/practice/members/${editingMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update member role.');
      }

      setEditingMember(null);
      await fetchData();
    } catch (err: any) {
      setRoleError(err.message || 'Error updating role.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Handle Deactivate Member
  const handleConfirmDeactivate = async () => {
    if (!deactivatingMember) return;
    setIsDeactivating(true);
    try {
      const res = await fetch(`${API_BASE}/api/practice/members/${deactivatingMember.id}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to deactivate member.');
      }

      setDeactivatingMember(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error deactivating member.');
    } finally {
      setIsDeactivating(false);
    }
  };

  // Handle Reactivate Member
  const handleReactivate = async (memberId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/practice/members/${memberId}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to reactivate member.');
      }

      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error reactivating member.');
    }
  };

  // Handle Toggle Clinical Approver Status
  const handleToggleClinicalStatus = async (member: MemberItem, targetStatus: boolean) => {
    setIsUpdatingClinical(true);
    setClinicalError(null);
    try {
      const res = await fetch(`${API_BASE}/api/practice/members/${member.id}/clinical-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isClinicalApprover: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update clinical approver status.');
      }

      setClinicalModalMember(null);
      await fetchData();
    } catch (err: any) {
      setClinicalError(err.message || 'Error updating clinical status.');
    } finally {
      setIsUpdatingClinical(false);
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

      alert(`Invitation resent successfully! An invitation email has been sent to ${data.email}.`);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Error resending invitation.');
    }
  };

  // Handle Revoke Invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/practice/invitations/${invitationId}/revoke`, {
        method: 'POST',
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

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'PRACTICE_OWNER':
        return 'role-badge owner';
      case 'PRACTICE_ADMIN':
        return 'role-badge admin';
      case 'VETERINARIAN':
        return 'role-badge veterinarian';
      case 'STAFF':
      case 'PRACTICE_STAFF':
        return 'role-badge staff';
      case 'READ_ONLY':
        return 'role-badge read_only';
      default:
        return 'role-badge staff';
    }
  };

  const formatRoleName = (role: string) => {
    switch (role) {
      case 'PRACTICE_OWNER':
        return 'Owner';
      case 'PRACTICE_ADMIN':
        return 'Practice Admin';
      case 'VETERINARIAN':
        return 'Veterinarian';
      case 'STAFF':
      case 'PRACTICE_STAFF':
        return 'Staff';
      case 'READ_ONLY':
        return 'Read Only';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
        <p>Loading practice users & permissions...</p>
      </div>
    );
  }

  return (
    <div className="users-permissions-container">
      {/* Top Bar with actions */}
      <div className="users-top-bar">
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-on-surface)' }}>
            Practice Users & Roles
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', margin: 0 }}>
            Manage staff accounts, assign granular practice roles, and invite team members.
          </p>
        </div>

        <div className="users-top-actions">
          {isPracticeOwner() && members.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowTransferModal(true)}
              style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
              style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="user-plus" size={16} />
              <span>Invite User</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(186, 26, 26, 0.1)', color: '#ba1a1a', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Active Members Card */}
      <div className="users-table-card">
        <div className="users-table-header">
          <div>
            <h3 className="users-table-title">Members ({members.length})</h3>
            <p className="users-table-sub">Active and deactivated practitioners and staff</p>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-on-surface-variant)' }}>
            Plan: <strong>{planName}</strong> | Vets: <strong>{usedVets}</strong> / {maxVets ?? '∞'} | Staff: <strong style={{ color: '#137333' }}>Unlimited</strong>
          </div>
        </div>

        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = user?.id === m.userId;
                const isOwner = m.role === 'PRACTICE_OWNER';

                return (
                  <tr key={m.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {m.user.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="user-name-col">
                          <span className="user-display-name">
                            {m.user.name} {isSelf && <small style={{ color: 'var(--color-primary)' }}>(You)</small>}
                          </span>
                          <span className="user-display-email">{m.user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span className={getRoleBadgeClass(m.role)}>
                          {formatRoleName(m.role)}
                        </span>
                        {isOwner && (
                          m.isClinicalApprover ? (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#0d652d',
                                background: '#e6f4ea',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Icon name="check-circle" size={11} />
                              Clinical Approver (Practicing Vet)
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#5f6368',
                                background: '#f1f3f4',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              Non-clinical Administrator
                            </span>
                          )
                        )}
                        {m.role === 'VETERINARIAN' && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#1a73e8',
                              background: '#e8f0fe',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            1 Vet Seat
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${m.isActive ? 'active' : 'disabled'}`}>
                        {m.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--color-on-surface-variant)' }}>
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="user-actions-cell" style={{ justifyContent: 'flex-end' }}>
                        {/* Clinical Designation Toggle for Practice Owner */}
                        {isOwner && isPracticeOwner() && m.isActive && (
                          <button
                            type="button"
                            className="action-btn-sm"
                            style={{ color: m.isClinicalApprover ? '#c5221f' : '#137333' }}
                            onClick={() => {
                              setClinicalModalMember(m);
                              setClinicalError(null);
                            }}
                          >
                            <Icon name="stethoscope" size={14} />
                            <span>{m.isClinicalApprover ? 'Remove Clinical Designation' : 'Designate as Practicing Vet'}</span>
                          </button>
                        )}

                        {/* Edit Role Button */}
                        <PermissionGate permission="ROLE_ASSIGN">
                          {!isOwner && !isSelf && m.isActive && (
                            <button
                              type="button"
                              className="action-btn-sm"
                              onClick={() => {
                                setEditingMember(m);
                                setSelectedRole(m.role === 'PRACTICE_STAFF' ? 'STAFF' : m.role);
                                setRoleError(null);
                              }}
                            >
                              <Icon name="edit" size={14} />
                              <span>Role</span>
                            </button>
                          )}
                        </PermissionGate>

                        {/* Deactivate / Reactivate */}
                        {!isOwner && !isSelf && (
                          <>
                            {m.isActive ? (
                              <PermissionGate permission="USER_DEACTIVATE">
                                <button
                                  type="button"
                                  className="action-btn-sm danger"
                                  onClick={() => setDeactivatingMember(m)}
                                >
                                  <Icon name="user-x" size={14} />
                                  <span>Deactivate</span>
                                </button>
                              </PermissionGate>
                            ) : (
                              <PermissionGate permission="USER_REACTIVATE">
                                <button
                                  type="button"
                                  className="action-btn-sm"
                                  style={{ color: '#137333' }}
                                  onClick={() => handleReactivate(m.id)}
                                >
                                  <Icon name="user-check" size={14} />
                                  <span>Reactivate</span>
                                </button>
                              </PermissionGate>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Card */}
      {invitations.length > 0 && (
        <div className="users-table-card">
          <div className="users-table-header">
            <div>
              <h3 className="users-table-title">Invitations ({invitations.length})</h3>
              <p className="users-table-sub">Outstanding invites pending acceptance</p>
            </div>
          </div>

          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Invited Email</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.email}</strong>
                    </td>
                    <td>
                      <span className={getRoleBadgeClass(inv.role)}>
                        {formatRoleName(inv.role)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${inv.status.toLowerCase()}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--color-on-surface-variant)' }}>
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <PermissionGate permission="USER_INVITE">
                        {inv.status === 'PENDING' && (
                          <div className="user-actions-cell" style={{ justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="action-btn-sm"
                              onClick={() => handleResendInvitation(inv.id)}
                            >
                              <Icon name="mail" size={14} />
                              <span>Resend</span>
                            </button>
                            <button
                              type="button"
                              className="action-btn-sm danger"
                              onClick={() => handleRevokeInvitation(inv.id)}
                            >
                              <Icon name="trash" size={14} />
                              <span>Revoke</span>
                            </button>
                          </div>
                        )}
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Changer Modal */}
      {editingMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '24px', background: '#fff' }}>
            <h2 id="role-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>
              Edit Role: {editingMember.user.name}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginBottom: '16px' }}>
              Select the new practice permissions role for this user.
            </p>

            {roleError && (
              <div style={{ padding: '8px 12px', background: 'rgba(186, 26, 26, 0.1)', color: '#ba1a1a', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
                {roleError}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <select
                className="form-control"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                disabled={isUpdatingRole}
                style={{ width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px' }}
              >
                {isPracticeOwner() && <option value="PRACTICE_ADMIN">Practice Administrator</option>}
                <option value="VETERINARIAN">Veterinarian</option>
                <option value="STAFF">Staff (Operational & Front Desk)</option>
                <option value="READ_ONLY">Read Only</option>
              </select>
            </div>

            {selectedRole === 'VETERINARIAN' && editingMember.role !== 'VETERINARIAN' && (
              <div style={{ padding: '8px 12px', background: '#e8f0fe', color: '#1a73e8', borderRadius: '6px', fontSize: '12.5px', marginBottom: '14px' }}>
                Assigning the Veterinarian role consumes 1 veterinarian seat ({usedVets} / {maxVets ?? '∞'} currently used).
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingMember(null)}
                disabled={isUpdatingRole}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveRole}
                disabled={isUpdatingRole}
              >
                {isUpdatingRole ? 'Updating...' : 'Save Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Approver Designation Modal */}
      {clinicalModalMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clinical-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '460px', width: '100%', padding: '24px', background: '#fff' }}>
            <h2 id="clinical-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-on-surface)' }}>
              {clinicalModalMember.isClinicalApprover ? 'Remove Clinical Designation' : 'Designate as Practicing Veterinarian'}
            </h2>

            {clinicalError && (
              <div style={{ padding: '8px 12px', background: 'rgba(186, 26, 26, 0.1)', color: '#ba1a1a', borderRadius: '6px', fontSize: '13px', marginBottom: '14px' }}>
                {clinicalError}
              </div>
            )}

            <p style={{ fontSize: '13.5px', color: 'var(--color-on-surface)', lineHeight: 1.5, marginBottom: '16px' }}>
              {clinicalModalMember.isClinicalApprover ? (
                <>
                  Removing clinical designation from <strong>{clinicalModalMember.user.name}</strong> will return their role to a non-clinical practice administrator. They will no longer be eligible to review or approve prescriptions, and <strong>1 veterinarian seat</strong> will be released back to your practice.
                </>
              ) : (
                <>
                  Designating <strong>{clinicalModalMember.user.name}</strong> as a practicing veterinarian grants them clinical authority to directly review, create, request changes on, and approve prescriptions.
                  <br /><br />
                  This action consumes <strong>1 Veterinarian Seat</strong> under your <strong>{planName}</strong> plan ({usedVets} of {maxVets ?? '∞'} currently used).
                </>
              )}
            </p>

            {!clinicalModalMember.isClinicalApprover && maxVets !== null && usedVets >= maxVets && (
              <div style={{ padding: '8px 12px', background: '#fef7e0', color: '#b06000', borderRadius: '6px', fontSize: '12.5px', marginBottom: '16px' }}>
                <strong>Warning:</strong> All {maxVets} veterinarian seat(s) on your plan are currently occupied. If you proceed, this action may fail unless you upgrade or free up a seat.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setClinicalModalMember(null)}
                disabled={isUpdatingClinical}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: clinicalModalMember.isClinicalApprover ? '#c5221f' : 'var(--color-primary)',
                  borderColor: clinicalModalMember.isClinicalApprover ? '#c5221f' : 'var(--color-primary)',
                }}
                onClick={() => handleToggleClinicalStatus(clinicalModalMember, !clinicalModalMember.isClinicalApprover)}
                disabled={isUpdatingClinical}
              >
                {isUpdatingClinical
                  ? 'Saving...'
                  : clinicalModalMember.isClinicalApprover
                  ? 'Remove Designation'
                  : 'Confirm Designation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivatingMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px', background: '#fff' }}>
            <h2 id="deactivate-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#ba1a1a' }}>
              Deactivate Member?
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--color-on-surface)', lineHeight: 1.45, marginBottom: '16px' }}>
              Are you sure you want to deactivate <strong>{deactivatingMember.user.name}</strong> ({deactivatingMember.user.email})?
              They will immediately lose access to this practice. Historical clinical records created by this member are permanently preserved.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeactivatingMember(null)}
                disabled={isDeactivating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#ba1a1a', borderColor: '#ba1a1a' }}
                onClick={handleConfirmDeactivate}
                disabled={isDeactivating}
              >
                {isDeactivating ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => void fetchData()}
        planName={planName}
        maxVeterinarians={maxVets}
        usedVeterinarians={usedVets}
      />

      {/* Ownership Transfer Modal */}
      <TransferOwnershipModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSuccess={() => void fetchData()}
        members={members.map((m) => ({
          id: m.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        }))}
        currentUserId={user?.id || ''}
      />
    </div>
  );
};
