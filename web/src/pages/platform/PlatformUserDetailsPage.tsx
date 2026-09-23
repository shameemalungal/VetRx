// ==============================================================================
// VetRx — PlatformUserDetailsPage.tsx
// Comprehensive Single-User Profile & Security Administration
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi } from '../../services/platformAdminApi';

export const PlatformUserDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Profile Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    platformRole: '',
  });

  const loadUserDetails = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await platformAdminApi.getUserDetails(id);
      setUser(res);
      setEditForm({
        name: res.name,
        email: res.email,
        platformRole: res.platformRole || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve user details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUserDetails();
  }, [id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setIsSubmitting(true);
      await platformAdminApi.updateUser(id, {
        name: editForm.name,
        email: editForm.email,
        platformRole: editForm.platformRole || null,
      });
      setIsEditModalOpen(false);
      await loadUserDetails();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;
    if (!confirm(`Send password reset email to ${user.email}?`)) return;
    try {
      const res = await platformAdminApi.resetPassword(user.id);
      alert(res.message || 'Password reset instructions sent.');
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  const handleForcePasswordChange = async () => {
    if (!user) return;
    try {
      await platformAdminApi.forcePasswordChange(user.id);
      alert('User will be required to change password on next login.');
      await loadUserDetails();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const handleForceLogout = async () => {
    if (!user) return;
    if (!confirm(`Revoke all active sessions for ${user.name}?`)) return;
    try {
      await platformAdminApi.forceLogout(user.id);
      alert('All active sessions revoked.');
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    const action = user.isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${user.name}'s account?`)) return;
    try {
      if (user.isActive) {
        await platformAdminApi.deactivateUser(user.id);
      } else {
        await platformAdminApi.activateUser(user.id);
      }
      await loadUserDetails();
    } catch (err: any) {
      alert(`Status change failed: ${err.message}`);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div style={{ color: '#64748b' }}>Loading user profile...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="platform-card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <Icon name="warning" size={32} color="#dc2626" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>User Account Not Found</h3>
        <p style={{ color: '#64748b' }}>{error || 'Unable to locate user details.'}</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/platform/users')}>
          Back to Users Directory
        </button>
      </div>
    );
  }

  const memberships = user.practiceMemberships || [];

  return (
    <div>
      {/* Header and Back navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            onClick={() => navigate('/platform/users')}
          >
            <Icon name="arrow-back" size={14} />
            <span>All Users</span>
          </button>
          <span style={{ color: '#94a3b8' }}>/</span>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{user.name}</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsEditModalOpen(true)}
          >
            <Icon name="edit" size={15} />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResetPassword}
          >
            <Icon name="mail" size={15} />
            <span>Reset Password</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleForcePasswordChange}
            title="Require password change on next login"
          >
            <Icon name="lock" size={15} />
            <span>Require Password Change</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleForceLogout}
          >
            <Icon name="logout" size={15} />
            <span>Force Logout</span>
          </button>
          <button
            type="button"
            className="btn"
            style={{
              background: user.isActive ? '#fee2e2' : '#dcfce7',
              color: user.isActive ? '#b91c1c' : '#15803d',
              border: `1px solid ${user.isActive ? '#fca5a5' : '#86efac'}`,
            }}
            onClick={handleToggleActive}
          >
            {user.isActive ? 'Deactivate Account' : 'Activate Account'}
          </button>
        </div>
      </div>

      {/* User Summary Card */}
      <div className="platform-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#312e81',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 700,
            }}
          >
            {user.name.slice(0, 2).toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {user.name}
              </h1>
              <span className={user.isActive ? 'badge-active' : 'badge-suspended'}>
                {user.isActive ? 'Active Account' : 'Deactivated'}
              </span>
              {user.platformRole === 'PLATFORM_SUPER_ADMIN' && (
                <span className="platform-brand-badge">Platform Super Admin</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.8125rem', color: '#64748b' }}>
              <div>Email: <strong>{user.email}</strong></div>
              <div>ID: <span className="data-mono">{user.id}</span></div>
              <div>Joined: {new Date(user.createdAt).toLocaleDateString('en-IN')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Practice Memberships Table */}
      <div className="platform-card" style={{ marginBottom: 24 }}>
        <div className="platform-card-header">
          <h2 className="platform-card-title">Practice Memberships ({memberships.length})</h2>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Practices where this user holds membership
          </span>
        </div>

        {memberships.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            User has no practice memberships.
          </div>
        ) : (
          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Practice Name</th>
                  <th>Role</th>
                  <th>Clinical Approval Status</th>
                  <th>Membership Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m: any) => (
                  <tr key={m.practiceId}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{m.practiceName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }} className="data-mono">
                        {m.practiceId}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: m.role === 'PRACTICE_OWNER' ? '#fef3c7' : '#e0e7ff',
                          color: m.role === 'PRACTICE_OWNER' ? '#b45309' : '#4338ca',
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
                        {m.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => navigate(`/platform/practices/${m.practiceId}`)}
                      >
                        Manage Practice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 440 }}>
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Edit User Profile</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsEditModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile}>
              <div className="platform-modal-body">
                <div>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Platform Role</label>
                  <select
                    className="form-control"
                    value={editForm.platformRole}
                    onChange={(e) => setEditForm({ ...editForm, platformRole: e.target.value })}
                  >
                    <option value="">Standard User</option>
                    <option value="PLATFORM_SUPER_ADMIN">Platform Super Admin</option>
                  </select>
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
