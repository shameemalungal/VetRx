// ==============================================================================
// VetRx — PlatformPracticeDetailsPage.tsx
// Comprehensive Single-Tenant Practice Administration & Team Governance
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi } from '../../services/platformAdminApi';

export const PlatformPracticeDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [practice, setPractice] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'MEMBERS' | 'BILLING' | 'SETTINGS' | 'AUDIT'>('MEMBERS');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isTransferOwnerModalOpen, setIsTransferOwnerModalOpen] = useState(false);
  const [isSupportSessionModalOpen, setIsSupportSessionModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [addMemberForm, setAddMemberForm] = useState({
    userId: '',
    role: 'VETERINARIAN',
    isClinicalApprover: true,
  });
  const [transferOwnerForm, setTransferOwnerForm] = useState({
    targetMemberId: '',
    previousOwnerRole: 'PRACTICE_ADMIN',
  });
  const [supportSessionForm, setSupportSessionForm] = useState({
    reason: '',
    durationMinutes: 30,
  });

  // Role Edit & Clinical status
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [newRole, setNewRole] = useState('VETERINARIAN');

  // Permission Override Modal
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overridePermission, setOverridePermission] = useState('MEDICINE_UPDATE');
  const [overrideEffect, setOverrideEffect] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [overrideReason, setOverrideReason] = useState('');

  // Inventory Add-on Modals
  const [isGrantInventoryModalOpen, setIsGrantInventoryModalOpen] = useState(false);
  const [isRevokeInventoryModalOpen, setIsRevokeInventoryModalOpen] = useState(false);
  const [inventoryReason, setInventoryReason] = useState('');

  // Complimentary Access Modal for this Practice
  const [isComplimentaryModalOpen, setIsComplimentaryModalOpen] = useState(false);
  const [compAccessType, setCompAccessType] = useState<'INDIVIDUAL' | 'CLINIC'>('CLINIC');
  const [compDuration, setCompDuration] = useState(12);
  const [compReason, setCompReason] = useState('');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadDetails = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await platformAdminApi.getPracticeDetails(id);
      setPractice(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load practice details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDetails();
  }, [id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIsSubmitting(true);
      await platformAdminApi.addMemberToPractice(id, addMemberForm);
      setIsAddMemberModalOpen(false);
      setAddMemberForm({ userId: '', role: 'VETERINARIAN', isClinicalApprover: true });
      await loadDetails();
    } catch (err: any) {
      alert(`Could not add member: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIsSubmitting(true);
      await platformAdminApi.transferOwnership(id, transferOwnerForm.targetMemberId, transferOwnerForm.previousOwnerRole);
      setIsTransferOwnerModalOpen(false);
      await loadDetails();
    } catch (err: any) {
      alert(`Ownership transfer failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartSupportSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIsSubmitting(true);
      await platformAdminApi.startSupportSession({
        targetPracticeId: id,
        reason: supportSessionForm.reason,
        durationMinutes: Number(supportSessionForm.durationMinutes),
      });
      setIsSupportSessionModalOpen(false);
      alert('Audited read-only support session activated for this practice.');
      await loadDetails();
    } catch (err: any) {
      alert(`Support session initiation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedMember) return;
    try {
      setIsSubmitting(true);
      await platformAdminApi.updateMemberRole(id, selectedMember.id, newRole);
      setIsEditRoleModalOpen(false);
      setSelectedMember(null);
      await loadDetails();
    } catch (err: any) {
      alert(`Role change failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleClinical = async (member: any) => {
    if (!id) return;
    try {
      await platformAdminApi.updateMemberClinicalStatus(id, member.id, !member.isClinicalApprover);
      await loadDetails();
    } catch (err: any) {
      alert(`Clinical approver update failed: ${err.message}`);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!id) return;
    if (!confirm('Are you sure you want to remove this user from the practice?')) return;
    try {
      await platformAdminApi.removeMemberFromPractice(id, memberId);
      await loadDetails();
    } catch (err: any) {
      alert(`Removal failed: ${err.message}`);
    }
  };

  const handleSetOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedMember) return;
    try {
      setIsSubmitting(true);
      await platformAdminApi.setMemberPermissionOverride(
        id,
        selectedMember.id,
        overridePermission,
        overrideEffect,
        overrideReason || undefined
      );
      setIsOverrideModalOpen(false);
      setSelectedMember(null);
      setOverrideReason('');
      await loadDetails();
    } catch (err: any) {
      alert(`Override failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveOverride = async (memberId: string, perm: string) => {
    if (!id) return;
    try {
      await platformAdminApi.removeMemberPermissionOverride(id, memberId, perm);
      await loadDetails();
    } catch (err: any) {
      alert(`Removing override failed: ${err.message}`);
    }
  };

  const handleGrantInventoryAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIsSubmitting(true);
      const res = await platformAdminApi.grantInventoryAddon(id, {
        reason: inventoryReason.trim() || undefined,
      });
      setIsGrantInventoryModalOpen(false);
      setInventoryReason('');
      setSuccessMsg(res.message || 'Inventory Add-on granted successfully.');
      await loadDetails();
    } catch (err: any) {
      alert(`Failed to grant Inventory Add-on: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeInventoryAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIsSubmitting(true);
      const res = await platformAdminApi.revokeInventoryAddon(id, {
        reason: inventoryReason.trim() || undefined,
      });
      setIsRevokeInventoryModalOpen(false);
      setInventoryReason('');
      setSuccessMsg(res.message || 'Inventory Add-on revoked successfully. Existing records remain preserved.');
      await loadDetails();
    } catch (err: any) {
      alert(`Failed to revoke Inventory Add-on: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGrantComplimentary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practice?.owner?.email) {
      alert('Practice owner email not found.');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await platformAdminApi.grantComplimentarySubscription({
        email: practice.owner.email,
        accessType: compAccessType,
        durationMonths: Number(compDuration),
        reason: compReason.trim() || undefined,
      });
      setIsComplimentaryModalOpen(false);
      setCompReason('');
      setSuccessMsg(res.message || 'Complimentary access granted successfully.');
      await loadDetails();
    } catch (err: any) {
      alert(`Failed to grant complimentary subscription: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: '#64748b' }}>Loading practice profile...</div>
      </div>
    );
  }

  if (error || !practice) {
    return (
      <div className="platform-card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <Icon name="warning" size={32} color="#dc2626" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Practice Not Found</h3>
        <p style={{ color: '#64748b' }}>{error || 'The requested practice tenant could not be loaded.'}</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/platform/practices')}>
          Back to Practices
        </button>
      </div>
    );
  }

  const sub = practice.subscriptions?.[0];
  const members = practice.members || [];
  const meta = (sub?.metadata as Record<string, any>) || {};
  const isInventoryActive = Boolean(
    practice.isInventoryAddonActive ||
    meta.addons?.inventory_management ||
    (typeof meta.inventoryAddon === 'object' && meta.inventoryAddon !== null
      ? meta.inventoryAddon.enabled
      : meta.inventoryAddon)
  );
  const inventoryMeta = (typeof meta.inventoryAddon === 'object' && meta.inventoryAddon !== null)
    ? meta.inventoryAddon
    : null;

  return (
    <div>
      {/* Top Breadcrumb & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            onClick={() => navigate('/platform/practices')}
          >
            <Icon name="arrow-back" size={14} />
            <span>All Practices</span>
          </button>
          <span style={{ color: '#94a3b8' }}>/</span>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{practice.name}</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsSupportSessionModalOpen(true)}
            title="Start audited temporary read-only support session"
          >
            <Icon name="shield" size={15} />
            <span>Support Access</span>
          </button>

          {members.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsTransferOwnerModalOpen(true)}
            >
              <Icon name="swap-horiz" size={15} />
              <span>Transfer Ownership</span>
            </button>
          )}

          {practice.status === 'ACTIVE' ? (
            <button
              type="button"
              className="btn"
              style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}
              onClick={async () => {
                const reason = prompt('Reason for suspension (audited):');
                if (reason) {
                  await platformAdminApi.suspendPractice(practice.id, reason);
                  await loadDetails();
                }
              }}
            >
              Suspend Practice
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}
              onClick={async () => {
                await platformAdminApi.reactivatePractice(practice.id);
                await loadDetails();
              }}
            >
              Reactivate Practice
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
            <Icon name="check" size={18} color="#059669" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>&times;</button>
        </div>
      )}

      {/* Practice Header Card */}
      <div className="platform-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {practice.name}
              </h1>
              <span className={`badge-${practice.status.toLowerCase()}`}>{practice.status}</span>
              <span className={`badge-${practice.practiceType.toLowerCase()}`}>{practice.practiceType}</span>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.8125rem', color: '#64748b' }}>
              <div>ID: <span className="data-mono">{practice.id}</span></div>
              {practice.slug && <div>Slug: <span className="data-mono">/{practice.slug}</span></div>}
              <div>Created: {new Date(practice.createdAt).toLocaleDateString('en-IN')}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                Authoritative Owner
              </div>
              <div style={{ fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                {practice.owner?.name || 'Unassigned'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{practice.owner?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
        <button
          type="button"
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'MEMBERS' ? '2px solid #4f46e5' : '2px solid transparent',
            color: activeTab === 'MEMBERS' ? '#4f46e5' : '#64748b',
          }}
          onClick={() => setActiveTab('MEMBERS')}
        >
          Team &amp; Members ({members.length})
        </button>

        <button
          type="button"
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'BILLING' ? '2px solid #4f46e5' : '2px solid transparent',
            color: activeTab === 'BILLING' ? '#4f46e5' : '#64748b',
          }}
          onClick={() => setActiveTab('BILLING')}
        >
          Practice Access &amp; Quotas
        </button>

        <button
          type="button"
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'SETTINGS' ? '2px solid #4f46e5' : '2px solid transparent',
            color: activeTab === 'SETTINGS' ? '#4f46e5' : '#64748b',
          }}
          onClick={() => setActiveTab('SETTINGS')}
        >
          Practice Profile &amp; Settings
        </button>
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'MEMBERS' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
              Practice Membership Roster
            </h2>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '0.8125rem', padding: '6px 12px' }}
              onClick={() => setIsAddMemberModalOpen(true)}
            >
              <Icon name="user-plus" size={15} />
              <span>Add User to Practice</span>
            </button>
          </div>

          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Practice Role</th>
                  <th>Clinical Approval</th>
                  <th>Status</th>
                  <th>Permission Overrides</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{m.user?.name || 'User'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.user?.email}</div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: m.role === 'PRACTICE_OWNER' ? '#fef3c7' : m.role === 'VETERINARIAN' ? '#e0e7ff' : '#f1f5f9',
                          color: m.role === 'PRACTICE_OWNER' ? '#b45309' : m.role === 'VETERINARIAN' ? '#4338ca' : '#475569',
                        }}
                      >
                        {m.role}
                      </span>
                    </td>
                    <td>
                      {m.isClinicalApprover ? (
                        <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.8125rem' }}>
                          ✓ Licensed Approver
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>Non-approver</span>
                      )}
                    </td>
                    <td>
                      <span className={m.isActive ? 'badge-active' : 'badge-suspended'}>
                        {m.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {m.permissionOverrides && m.permissionOverrides.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {m.permissionOverrides.map((ov: any) => (
                            <span
                              key={ov.id}
                              style={{
                                fontSize: '0.6875rem',
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: ov.effect === 'ALLOW' ? '#dcfce7' : '#fee2e2',
                                color: ov.effect === 'ALLOW' ? '#15803d' : '#b91c1c',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              {ov.permission}: {ov.effect}
                              <button
                                type="button"
                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                                onClick={() => handleRemoveOverride(m.id, ov.permission)}
                                title="Remove override"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Role defaults</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {m.role !== 'PRACTICE_OWNER' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '4px 6px' }}
                            onClick={() => {
                              setSelectedMember(m);
                              setNewRole(m.role);
                              setIsEditRoleModalOpen(true);
                            }}
                          >
                            Role
                          </button>
                        )}

                        {(m.role === 'PRACTICE_OWNER' || m.role === 'PRACTICE_ADMIN') && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '4px 6px' }}
                            onClick={() => handleToggleClinical(m)}
                            title="Toggle clinical approval status"
                          >
                            Approver
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 6px' }}
                          onClick={() => {
                            setSelectedMember(m);
                            setIsOverrideModalOpen(true);
                          }}
                        >
                          Override
                        </button>

                        {m.role !== 'PRACTICE_OWNER' && (
                          <button
                            type="button"
                            className="btn"
                            style={{
                              fontSize: '0.75rem',
                              padding: '4px 6px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                            }}
                            onClick={() => handleRemoveMember(m.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRACTICE ACCESS, BILLING & ADD-ONS */}
      {activeTab === 'BILLING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Practice Access Overview Card */}
          <div className="platform-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 className="platform-card-title" style={{ margin: 0 }}>Practice Access (Base Tier)</h2>
                <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4 }}>
                  Authoritative base subscription, clinical license terms, and tenant origin.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', padding: '6px 12px' }}
                onClick={() => setIsComplimentaryModalOpen(true)}
              >
                <Icon name="award" size={14} color="#00685f" />
                <span>Grant Complimentary Access</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, fontSize: '0.875rem' }}>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                  Current Plan
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
                  {sub?.plan?.name || (practice.subscriptions?.length ? 'Commercial Plan' : 'Foundation Mode (No subscription)')}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                  {sub?.plan?.code || 'NO_SUBSCRIPTION_RECORD'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                  Subscription Status
                </div>
                <div style={{ marginTop: 2 }}>
                  <span className={sub?.status === 'ACTIVE' ? 'badge-active' : 'badge-suspended'} style={{ fontWeight: 700 }}>
                    {sub?.status || 'NO_SUBSCRIPTION'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                  {sub?.trialEndsAt ? `Trial ends: ${new Date(sub.trialEndsAt).toLocaleDateString('en-IN')}` : sub?.status === 'TRIAL' ? 'Active 14-Day Trial' : sub ? 'Subscription Active' : 'No commercial record'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                  Access Origin
                </div>
                <div style={{ marginTop: 2 }}>
                  {meta.source === 'COMPLIMENTARY' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                      <Icon name="award" size={12} />
                      Complimentary Access
                    </span>
                  ) : sub?.status === 'TRIAL' ? (
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0284c7' }}>Standard Free Trial</span>
                  ) : sub ? (
                    <span style={{ fontSize: '0.8125rem', color: '#475569' }}>Commercial / Gateway</span>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Foundation Tier</span>
                  )}
                </div>
                {meta.reason && (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Note: {meta.reason}
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                  Current Period
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#0f172a', fontWeight: 600, marginTop: 2 }}>
                  {meta.isUnlimited
                    ? 'Unlimited Access'
                    : sub?.currentPeriodStart && sub?.currentPeriodEnd
                    ? `${new Date(sub.currentPeriodStart).toLocaleDateString('en-IN')} – ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN')}`
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Practice Add-ons Section */}
          <div className="platform-card" style={{ border: '1px solid #cbd5e1' }}>
            <div style={{ marginBottom: 16 }}>
              <h2 className="platform-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="box" size={20} color="#00685f" />
                <span>Practice Add-ons &amp; Modular Capabilities</span>
              </h2>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4 }}>
                Modular capability entitlements granted independently of the base subscription plan tier.
              </div>
            </div>

            {/* Inventory Add-on Row */}
            <div style={{ background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: isInventoryActive ? '#ecfdf5' : '#f1f5f9',
                        color: isInventoryActive ? '#059669' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="box" size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
                        Inventory &amp; Stock Management
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                        Pharmaceutical inventory, suppliers, invoice OCR ingestion, batch expiration tracking, automated reorder alerts, and movements ledger.
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>Current Status:</span>
                    {isInventoryActive ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                          padding: '3px 12px',
                          borderRadius: 14,
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                        }}
                      >
                        <Icon name="check" size={14} color="#059669" />
                        Enabled
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          padding: '3px 12px',
                          borderRadius: 14,
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                        }}
                      >
                        Not enabled
                      </span>
                    )}
                  </div>

                  {/* Metadata when Enabled */}
                  {isInventoryActive && inventoryMeta && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                      {inventoryMeta.grantedBy && (
                        <div>
                          <strong style={{ color: '#0f172a' }}>Granted By:</strong> {inventoryMeta.grantedBy}
                        </div>
                      )}
                      {inventoryMeta.grantedAt && (
                        <div>
                          <strong style={{ color: '#0f172a' }}>Granted Date:</strong> {new Date(inventoryMeta.grantedAt).toLocaleString('en-IN')}
                        </div>
                      )}
                      <div>
                        <strong style={{ color: '#0f172a' }}>Source:</strong> {inventoryMeta.source || 'Platform Super Admin'}
                      </div>
                      {inventoryMeta.reason && (
                        <div>
                          <strong style={{ color: '#0f172a' }}>Reason:</strong> {inventoryMeta.reason}
                        </div>
                      )}
                    </div>
                  )}

                  {!sub && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.8125rem', color: '#991b1b' }}>
                      ⚠️ <strong>Base subscription required:</strong> This practice has no subscription record. To enable Inventory, first grant Complimentary Access or activate a plan.
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  {isInventoryActive ? (
                    <button
                      type="button"
                      className="btn"
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        fontWeight: 600,
                        padding: '8px 16px',
                        fontSize: '0.875rem',
                      }}
                      onClick={() => {
                        setInventoryReason('');
                        setIsRevokeInventoryModalOpen(true);
                      }}
                    >
                      Revoke Inventory Add-on
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!sub}
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.875rem',
                        opacity: !sub ? 0.6 : 1,
                      }}
                      onClick={() => {
                        setInventoryReason('');
                        setIsGrantInventoryModalOpen(true);
                      }}
                    >
                      Grant Inventory Add-on
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Seat Quota Calculation */}
          <div className="platform-card">
            <h2 className="platform-card-title" style={{ marginBottom: 16 }}>Seat Quota Calculation</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.875rem' }}>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>Veterinarian Seats</div>
                <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 4 }}>
                  Occupied by all practicing veterinarians and designated clinical approvers. Non-clinical staff do not consume seats.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS */}
      {activeTab === 'SETTINGS' && (
        <div className="platform-card" style={{ maxWidth: 640 }}>
          <h2 className="platform-card-title" style={{ marginBottom: 16 }}>Practice Settings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.875rem' }}>
            <div>
              <div style={{ color: '#64748b' }}>Clinic Name</div>
              <div style={{ fontWeight: 600 }}>{practice.settings?.clinicName || practice.name}</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Address</div>
              <div>{practice.settings?.address || 'Not provided'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Phone</div>
              <div>{practice.settings?.phone || 'Not provided'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b' }}>Registration / Licence Number</div>
              <div>{practice.settings?.registrationNumber || 'Not provided'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal (VetRx Polished) */}
      {isAddMemberModalOpen && (
        <div className="platform-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
          <div className="create-practice-modal">
            <div className="create-practice-modal-header">
              <div>
                <h2 id="add-member-title" className="create-practice-modal-title">
                  Add User to Practice
                </h2>
                <p className="create-practice-modal-subtitle">
                  Assign a registered user to {practice.name} with specific clinical and administrative roles.
                </p>
              </div>
              <button
                type="button"
                className="create-practice-modal-close"
                onClick={() => setIsAddMemberModalOpen(false)}
                aria-label="Close dialog"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="create-practice-modal-body">
                {/* 1. User Selection */}
                <div className="create-practice-section">
                  <div className="create-practice-section-title">User Identification</div>
                  <div className="create-practice-field">
                    <label className="create-practice-label">
                      User Email or User ID <span className="required-indicator">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="create-practice-input"
                      placeholder="e.g. doctor@example.com or user-id"
                      value={addMemberForm.userId}
                      onChange={(e) => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
                      autoFocus
                    />
                  </div>
                </div>

                {/* 2. Practice Role */}
                <div className="create-practice-section">
                  <div className="create-practice-section-title">Role &amp; Responsibilities</div>
                  <div className="create-practice-field">
                    <label className="create-practice-label">Practice Role <span className="required-indicator">*</span></label>
                    <select
                      className="create-practice-select"
                      value={addMemberForm.role}
                      onChange={(e) => {
                        const r = e.target.value;
                        setAddMemberForm({
                          ...addMemberForm,
                          role: r,
                          isClinicalApprover: r === 'VETERINARIAN',
                        });
                      }}
                    >
                      <option value="VETERINARIAN">Veterinarian (Practicing doctor &amp; clinical approver)</option>
                      <option value="PRACTICE_ADMIN">Practice Admin (Operations manager)</option>
                      <option value="STAFF">Practice Staff (Reception / assistant)</option>
                      <option value="READ_ONLY">Read Only (Auditor / view-only)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Clinical Authority */}
                {(addMemberForm.role === 'VETERINARIAN' || addMemberForm.role === 'PRACTICE_ADMIN') && (
                  <div className="create-practice-section">
                    <div className="create-practice-section-title">Clinical Authority</div>
                    <label
                      htmlFor="clinicalAdd"
                      className={`create-practice-checkbox-card ${addMemberForm.isClinicalApprover ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        id="clinicalAdd"
                        className="create-practice-checkbox"
                        checked={addMemberForm.isClinicalApprover}
                        disabled={addMemberForm.role === 'VETERINARIAN'}
                        onChange={(e) =>
                          setAddMemberForm({ ...addMemberForm, isClinicalApprover: e.target.checked })
                        }
                      />
                      <div className="create-practice-checkbox-content">
                        <span className="create-practice-checkbox-title">
                          Designate as Clinical Prescription Approver
                        </span>
                        <span className="create-practice-checkbox-desc">
                          Authorizes this user to review, modify, approve, and digitally seal prescriptions for this practice.
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              <div className="create-practice-modal-footer">
                <button
                  type="button"
                  className="create-practice-btn-cancel"
                  disabled={isSubmitting}
                  onClick={() => setIsAddMemberModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="create-practice-btn-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Adding Member…' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {isTransferOwnerModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal">
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Transfer Practice Ownership</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsTransferOwnerModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleTransferOwnership}>
              <div className="platform-modal-body">
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                  Select an active practice member to promote to authoritative Practice Owner. The previous owner will be demoted to an administrator role.
                </p>

                <div>
                  <label className="form-label">New Owner *</label>
                  <select
                    className="form-control"
                    required
                    value={transferOwnerForm.targetMemberId}
                    onChange={(e) =>
                      setTransferOwnerForm({ ...transferOwnerForm, targetMemberId: e.target.value })
                    }
                  >
                    <option value="">Select member...</option>
                    {members
                      .filter((m: any) => m.role !== 'PRACTICE_OWNER' && m.isActive)
                      .map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.user?.name} ({m.user?.email}) — {m.role}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Previous Owner's New Role</label>
                  <select
                    className="form-control"
                    value={transferOwnerForm.previousOwnerRole}
                    onChange={(e) =>
                      setTransferOwnerForm({ ...transferOwnerForm, previousOwnerRole: e.target.value })
                    }
                  >
                    <option value="PRACTICE_ADMIN">Practice Admin</option>
                    <option value="VETERINARIAN">Veterinarian</option>
                    <option value="STAFF">Practice Staff</option>
                  </select>
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsTransferOwnerModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Transferring...' : 'Confirm Ownership Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {isEditRoleModalOpen && selectedMember && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 440 }}>
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Change Member Role</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsEditRoleModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateRole}>
              <div className="platform-modal-body">
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedMember.user?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedMember.user?.email}</div>
                </div>

                <div>
                  <label className="form-label">Assign Role</label>
                  <select
                    className="form-control"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  >
                    <option value="VETERINARIAN">Veterinarian</option>
                    <option value="PRACTICE_ADMIN">Practice Admin</option>
                    <option value="STAFF">Practice Staff</option>
                    <option value="READ_ONLY">Read Only</option>
                  </select>
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsEditRoleModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Update Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Override Modal */}
      {isOverrideModalOpen && selectedMember && (
        <div className="platform-modal-overlay">
          <div className="platform-modal">
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Grant / Deny Permission Override</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsOverrideModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleSetOverride}>
              <div className="platform-modal-body">
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedMember.user?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Current Role: {selectedMember.role}</div>
                </div>

                <div>
                  <label className="form-label">Target Permission *</label>
                  <select
                    className="form-control"
                    value={overridePermission}
                    onChange={(e) => setOverridePermission(e.target.value)}
                  >
                    <option value="MEDICINE_UPDATE">MEDICINE_UPDATE (Modify formulary)</option>
                    <option value="INVOICE_CREATE">INVOICE_CREATE (Generate invoices)</option>
                    <option value="INVOICE_UPDATE">INVOICE_UPDATE (Edit invoices)</option>
                    <option value="PATIENT_CREATE">PATIENT_CREATE (Add patients)</option>
                    <option value="PATIENT_UPDATE">PATIENT_UPDATE (Update patient records)</option>
                    <option value="PRESCRIPTION_CREATE">PRESCRIPTION_CREATE (Draft prescriptions)</option>
                    <option value="PRESCRIPTION_FORWARD_FOR_APPROVAL">PRESCRIPTION_FORWARD_FOR_APPROVAL</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Effect *</label>
                  <select
                    className="form-control"
                    value={overrideEffect}
                    onChange={(e) => setOverrideEffect(e.target.value as any)}
                  >
                    <option value="ALLOW">ALLOW (Explicitly grant permission)</option>
                    <option value="DENY">DENY (Explicitly restrict permission)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Reason (Audited)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Lead technician formulary manager"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsOverrideModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Set Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Support Session Modal */}
      {isSupportSessionModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 480 }}>
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Start Audited Support Session</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsSupportSessionModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleStartSupportSession}>
              <div className="platform-modal-body">
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                  Initiates a temporary, strictly audited, read-only session to inspect clinical and administrative data for <strong>{practice.name}</strong>.
                </p>

                <div>
                  <label className="form-label">Support Reason *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Diagnosing prescription sync discrepancy"
                    value={supportSessionForm.reason}
                    onChange={(e) => setSupportSessionForm({ ...supportSessionForm, reason: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Duration (Minutes)</label>
                  <select
                    className="form-control"
                    value={supportSessionForm.durationMinutes}
                    onChange={(e) => setSupportSessionForm({ ...supportSessionForm, durationMinutes: Number(e.target.value) })}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsSupportSessionModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Starting...' : 'Start Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Inventory Add-on Modal */}
      {isGrantInventoryModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 520 }}>
            <div className="platform-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="box" size={20} color="#00685f" />
                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
                  Grant Inventory Add-on
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => !isSubmitting && setIsGrantInventoryModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleGrantInventoryAddon}>
              <div className="platform-modal-body">
                <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#166534', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Grant Inventory &amp; Stock Management access to this practice?
                  </div>
                  <div>
                    This will enable Inventory, Stock, Purchases, Batches, Alerts, Movements and Inventory Reports for <strong>{practice.name}</strong>.
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                    Internal Reason / Note
                  </label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="e.g. Beta evaluation, Commercial add-on contract, Clinical request"
                    value={inventoryReason}
                    onChange={(e) => setInventoryReason(e.target.value)}
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Audited with administrator attribution.
                  </div>
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsGrantInventoryModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Granting...' : 'Grant Inventory Add-on'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Inventory Add-on Modal */}
      {isRevokeInventoryModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 520 }}>
            <div className="platform-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="warning" size={20} color="#dc2626" />
                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
                  Revoke Inventory Add-on
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => !isSubmitting && setIsRevokeInventoryModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleRevokeInventoryAddon}>
              <div className="platform-modal-body">
                <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.875rem', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Revoke Inventory &amp; Stock Management access from this practice?
                  </div>
                  <div>
                    Existing inventory records will <strong>NOT</strong> be deleted. The module will become inaccessible until the add-on is enabled again.
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                    Revocation Reason
                  </label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="e.g. Add-on trial ended, Customer requested removal"
                    value={inventoryReason}
                    onChange={(e) => setInventoryReason(e.target.value)}
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                    Audited with administrator attribution.
                  </div>
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsRevokeInventoryModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ background: '#dc2626', color: '#ffffff', border: '1px solid #b91c1c', fontWeight: 600 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Revoking...' : 'Revoke Inventory Add-on'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Complimentary Access Modal */}
      {isComplimentaryModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 520 }}>
            <div className="platform-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="award" size={20} color="#00685f" />
                <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
                  Grant Complimentary Base Access
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => !isSubmitting && setIsComplimentaryModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleGrantComplimentary}>
              <div className="platform-modal-body">
                <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 16px 0' }}>
                  Grant complimentary subscription access to <strong>{practice.name}</strong> ({practice.owner?.email}).
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label className="form-label">Access Tier</label>
                    <select
                      className="form-control"
                      value={compAccessType}
                      onChange={(e) => setCompAccessType(e.target.value as 'INDIVIDUAL' | 'CLINIC')}
                    >
                      <option value="INDIVIDUAL">Individual (1 Vet)</option>
                      <option value="CLINIC">Clinic (5 Vets + Staff)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Duration</label>
                    <select
                      className="form-control"
                      value={compDuration}
                      onChange={(e) => setCompDuration(Number(e.target.value))}
                    >
                      <option value={1}>1 Month</option>
                      <option value={3}>3 Months</option>
                      <option value={6}>6 Months</option>
                      <option value={12}>12 Months (1 Year)</option>
                      <option value={24}>24 Months (2 Years)</option>
                      <option value={36}>36 Months (3 Years)</option>
                      <option value={0}>Unlimited Access</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Internal Reason / Note</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="e.g. Clinical advisor, Academic partner, Super Admin grant"
                    value={compReason}
                    onChange={(e) => setCompReason(e.target.value)}
                    style={{ width: '100%', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsComplimentaryModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Granting...' : 'Confirm Complimentary Grant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
