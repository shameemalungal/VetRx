// ==============================================================================
// VetRx — PlatformUsersPage.tsx
// Central Platform User Administration & Global Security Management
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi, type PlatformUserListItem } from '../../services/platformAdminApi';

export const PlatformUsersPage: React.FC = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<PlatformUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformRoleFilter, setPlatformRoleFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    platformRole: '',
  });

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await platformAdminApi.listUsers({
        search: search.trim() || undefined,
        status: statusFilter,
        platformRole: platformRoleFilter,
        page,
        pageSize,
      });
      const results = (res as any).results || res;
      setUsers(Array.isArray(results) ? results : []);
      setTotal((res as any).total ?? (Array.isArray(results) ? results.length : 0));
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve users.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [page, statusFilter, platformRoleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void loadUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await platformAdminApi.createUser({
        name: createForm.name,
        email: createForm.email,
        password: createForm.password || undefined,
        platformRole: createForm.platformRole || null,
      });
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', email: '', password: '', platformRole: '' });
      await loadUsers();
    } catch (err: any) {
      alert(`User creation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (user: PlatformUserListItem) => {
    if (!confirm(`Send password reset instructions to ${user.email}?`)) return;
    try {
      const res = await platformAdminApi.resetPassword(user.id);
      alert(res.message || 'Password reset email sent successfully.');
    } catch (err: any) {
      alert(`Password reset failed: ${err.message}`);
    }
  };

  const handleForcePasswordChange = async (user: PlatformUserListItem) => {
    if (!confirm(`Force ${user.name} to change their password on next sign-in?`)) return;
    try {
      await platformAdminApi.forcePasswordChange(user.id);
      alert('Password change flag set.');
      await loadUsers();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const handleForceLogout = async (user: PlatformUserListItem) => {
    if (!confirm(`Immediately invalidate all active sessions for ${user.name}?`)) return;
    try {
      await platformAdminApi.forceLogout(user.id);
      alert('Active user sessions revoked.');
    } catch (err: any) {
      alert(`Session revocation failed: ${err.message}`);
    }
  };

  const handleToggleActive = async (user: PlatformUserListItem) => {
    const action = user.isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${user.name}'s account?`)) return;
    try {
      if (user.isActive) {
        await platformAdminApi.deactivateUser(user.id);
      } else {
        await platformAdminApi.activateUser(user.id);
      }
      await loadUsers();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="platform-page-header">
        <div>
          <h1 className="platform-page-title">User Accounts</h1>
          <div className="platform-page-subtitle">
            Global directory of practitioners, clinic staff, and platform administrative users.
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Icon name="user-plus" size={15} />
          <span>New User</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="platform-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          padding: '12px 16px',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
          <div className="platform-search-input-wrap" style={{ flex: 1 }}>
            <Icon name="search" size={16} color="#64748b" />
            <input
              type="text"
              className="platform-search-input"
              placeholder="Search by user name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <select
              className="form-control"
              style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Accounts</option>
              <option value="INACTIVE">Deactivated Accounts</option>
            </select>
          </div>

          <div>
            <select
              className="form-control"
              style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
              value={platformRoleFilter}
              onChange={(e) => {
                setPlatformRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Roles</option>
              <option value="PLATFORM_SUPER_ADMIN">Platform Super Admin</option>
              <option value="USER">Standard User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#64748b' }}>Loading user directory...</div>
        </div>
      ) : error ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 32, color: '#dc2626' }}>
          {error}
        </div>
      ) : users.length === 0 ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <Icon name="user" size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>No users found</div>
          <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>
            Try adjusting your search criteria or register a new user.
          </div>
        </div>
      ) : (
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Status</th>
                <th>Platform Role</th>
                <th>Practice Memberships</th>
                <th>Joined Date</th>
                <th style={{ textAlign: 'right' }}>Security Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{u.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                  </td>
                  <td>
                    <span className={u.isActive ? 'badge-active' : 'badge-suspended'}>
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td>
                    {u.platformRole === 'PLATFORM_SUPER_ADMIN' ? (
                      <span className="platform-brand-badge">Super Admin</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Standard User</span>
                    )}
                  </td>
                  <td>
                    {u.practiceMemberships && u.practiceMemberships.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {u.practiceMemberships.map((pm, idx) => (
                          <div key={idx} style={{ fontSize: '0.75rem' }}>
                            <strong>{pm.practiceName}</strong> ({pm.role})
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No practice memberships</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 6px' }}
                        onClick={() => navigate(`/platform/users/${u.id}`)}
                      >
                        Profile
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 6px' }}
                        onClick={() => handleResetPassword(u)}
                        title="Send password reset email"
                      >
                        Reset PW
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 6px' }}
                        onClick={() => handleForcePasswordChange(u)}
                        title="Require password change on next login"
                      >
                        Force PW
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 6px' }}
                        onClick={() => handleForceLogout(u)}
                        title="Revoke all active sessions"
                      >
                        Revoke
                      </button>

                      <button
                        type="button"
                        className="btn"
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 6px',
                          background: u.isActive ? '#fee2e2' : '#dcfce7',
                          color: u.isActive ? '#b91c1c' : '#15803d',
                          border: `1px solid ${u.isActive ? '#fca5a5' : '#86efac'}`,
                        }}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} users
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 460 }}>
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Create User Account</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsCreateModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="platform-modal-body">
                <div>
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Dr. Ananya Sen"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="ananya@example.vet"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Initial Password (Optional)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Leave empty to send welcome setup invite"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Platform Role</label>
                  <select
                    className="form-control"
                    value={createForm.platformRole}
                    onChange={(e) => setCreateForm({ ...createForm, platformRole: e.target.value })}
                  >
                    <option value="">Standard User (Default)</option>
                    <option value="PLATFORM_SUPER_ADMIN">Platform Super Admin</option>
                  </select>
                </div>
              </div>

              <div className="platform-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
