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
          Subscription &amp; Quotas
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

      {/* TAB 2: BILLING & SEATS */}
      {activeTab === 'BILLING' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div className="platform-card">
            <h2 className="platform-card-title" style={{ marginBottom: 16 }}>Current Plan Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.875rem' }}>
              <div>
                <div style={{ color: '#64748b' }}>Plan</div>
                <div style={{ fontWeight: 600, fontSize: '1.125rem', color: '#0f172a' }}>
                  {sub?.plan?.name || 'Clinic Starter (Monthly)'}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748b' }}>Status</div>
                <div style={{ fontWeight: 600, color: '#15803d' }}>{sub?.status || 'ACTIVE'}</div>
              </div>
              <div>
                <div style={{ color: '#64748b' }}>Current Period</div>
                <div>
                  {sub?.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString('en-IN') : 'N/A'} –{' '}
                  {sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN') : 'N/A'}
                </div>
              </div>
            </div>
          </div>

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

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal">
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Add User to Practice</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsAddMemberModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="platform-modal-body">
                <div>
                  <label className="form-label">User ID or Email *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Enter registered user ID or email..."
                    value={addMemberForm.userId}
                    onChange={(e) => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Practice Role *</label>
                  <select
                    className="form-control"
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
                    <option value="VETERINARIAN">Veterinarian (Practicing doctor)</option>
                    <option value="PRACTICE_ADMIN">Practice Admin (Operations manager)</option>
                    <option value="STAFF">Practice Staff (Reception / assistant)</option>
                    <option value="READ_ONLY">Read Only (Auditor / view-only)</option>
                  </select>
                </div>

                {(addMemberForm.role === 'VETERINARIAN' || addMemberForm.role === 'PRACTICE_ADMIN') && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      id="clinicalAdd"
                      checked={addMemberForm.isClinicalApprover}
                      disabled={addMemberForm.role === 'VETERINARIAN'}
                      onChange={(e) =>
                        setAddMemberForm({ ...addMemberForm, isClinicalApprover: e.target.checked })
                      }
                    />
                    <label htmlFor="clinicalAdd" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                      Designate as Clinical Approver (Requires veterinarian seat)
                    </label>
                  </div>
                )}
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsAddMemberModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Member'}
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
    </div>
  );
};
