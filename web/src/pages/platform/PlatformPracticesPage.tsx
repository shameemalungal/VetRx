// ==============================================================================
// VetRx — PlatformPracticesPage.tsx
// Central Multi-Tenant Practice Administration
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import {
  platformAdminApi,
  type PlatformPracticeListItem,
} from '../../services/platformAdminApi';

export const PlatformPracticesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [practices, setPractices] = useState<PlatformPracticeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    practiceType: 'CLINIC' as 'INDEPENDENT' | 'CLINIC' | 'ENTERPRISE',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    address: '',
    planCode: 'CLINIC_MONTHLY',
    isClinicalApprover: true,
  });

  // Action Confirmation Modal
  const [actionModal, setActionModal] = useState<{
    type: 'SUSPEND' | 'REACTIVATE';
    practice: PlatformPracticeListItem;
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  const loadPractices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await platformAdminApi.listPractices({
        search: search.trim() || undefined,
        type: typeFilter,
        status: statusFilter,
        page,
        pageSize,
      });
      // Supports both array and paginated object structure
      const results = (res as any).results || res;
      setPractices(Array.isArray(results) ? results : []);
      setTotal((res as any).total ?? (Array.isArray(results) ? results.length : 0));
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve practices.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPractices();
  }, [page, typeFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void loadPractices();
  };

  const handleCreatePractice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await platformAdminApi.createPractice(createForm);
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        practiceType: 'CLINIC',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        address: '',
        planCode: 'CLINIC_MONTHLY',
        isClinicalApprover: true,
      });
      await loadPractices();
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    try {
      setIsSubmitting(true);
      if (actionModal.type === 'SUSPEND') {
        await platformAdminApi.suspendPractice(actionModal.practice.id, suspendReason);
      } else {
        await platformAdminApi.reactivatePractice(actionModal.practice.id);
      }
      setActionModal(null);
      setSuspendReason('');
      await loadPractices();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="platform-page-header">
        <div>
          <h1 className="platform-page-title">Practice Tenants</h1>
          <div className="platform-page-subtitle">
            Manage veterinary clinics, independent practitioners, enterprise organizations, and practice statuses.
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Icon name="plus" size={15} />
          <span>New Practice</span>
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
              placeholder="Search by practice name, owner, or email..."
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
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Types</option>
              <option value="INDEPENDENT">Independent Practitioner</option>
              <option value="CLINIC">Veterinary Clinic</option>
              <option value="ENTERPRISE">Enterprise Practice</option>
            </select>
          </div>

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
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Practices Data Table */}
      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#64748b' }}>Loading practice registry...</div>
        </div>
      ) : error ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 32, color: '#dc2626' }}>
          {error}
        </div>
      ) : practices.length === 0 ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <Icon name="hospital" size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>No practices found</div>
          <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>
            Try adjusting your search criteria or register a new practice.
          </div>
        </div>
      ) : (
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Practice Name</th>
                <th>Archetype</th>
                <th>Status</th>
                <th>Owner Details</th>
                <th>Seats &amp; Staff</th>
                <th>Subscription Plan</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {practices.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                    {p.slug && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>/{p.slug}</div>}
                  </td>
                  <td>
                    <span className={`badge-${p.practiceType.toLowerCase()}`}>
                      {p.practiceType}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-${p.status.toLowerCase()}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.ownerName || 'Unknown'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.ownerEmail}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.veterinarianCount} Vets</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.memberCount} total members</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.subscriptionPlan}</div>
                    <div style={{ fontSize: '0.75rem', color: '#15803d' }}>{p.subscriptionStatus}</div>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {new Date(p.createdAt).toLocaleDateString('en-IN', {
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
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => navigate(`/platform/practices/${p.id}`)}
                      >
                        Manage
                      </button>

                      {p.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 8px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                          }}
                          onClick={() => setActionModal({ type: 'SUSPEND', practice: p })}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 8px',
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                          }}
                          onClick={() => setActionModal({ type: 'REACTIVATE', practice: p })}
                        >
                          Reactivate
                        </button>
                      )}
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
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} practices
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

      {/* Create Practice Modal */}
      {isCreateModalOpen && (
        <div className="platform-modal-overlay">
          <div className="platform-modal">
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Create Practice Tenant</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsCreateModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <form onSubmit={handleCreatePractice}>
              <div className="platform-modal-body">
                <div>
                  <label className="form-label">Practice Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Apex Pet Hospital"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Practice Archetype *</label>
                  <select
                    className="form-control"
                    value={createForm.practiceType}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        practiceType: e.target.value as any,
                        planCode:
                          e.target.value === 'INDEPENDENT'
                            ? 'INDIVIDUAL_MONTHLY'
                            : e.target.value === 'ENTERPRISE'
                            ? 'ENTERPRISE_CUSTOM'
                            : 'CLINIC_MONTHLY',
                      })
                    }
                  >
                    <option value="CLINIC">Veterinary Clinic (Multi-vet practice)</option>
                    <option value="INDEPENDENT">Independent Practitioner (Solo vet)</option>
                    <option value="ENTERPRISE">Enterprise Organization (Multi-branch)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Owner Full Name *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="Dr. Rajesh Sharma"
                      value={createForm.ownerName}
                      onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Owner Email *</label>
                    <input
                      type="email"
                      required
                      className="form-control"
                      placeholder="rajesh@clinic.vet"
                      value={createForm.ownerEmail}
                      onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Contact Phone</label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="+91 98765 43210"
                      value={createForm.ownerPhone}
                      onChange={(e) => setCreateForm({ ...createForm, ownerPhone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label">Initial Commercial Plan</label>
                    <select
                      className="form-control"
                      value={createForm.planCode}
                      onChange={(e) => setCreateForm({ ...createForm, planCode: e.target.value })}
                    >
                      <option value="CLINIC_MONTHLY">Clinic Monthly (5 seats)</option>
                      <option value="CLINIC_ANNUAL">Clinic Annual (5 seats)</option>
                      <option value="INDIVIDUAL_MONTHLY">Individual Monthly (1 seat)</option>
                      <option value="INDIVIDUAL_ANNUAL">Individual Annual (1 seat)</option>
                      <option value="ENTERPRISE_CUSTOM">Enterprise Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Clinic Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="12, High Street, Indiranagar, Bengaluru"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="isClinicalApprover"
                    checked={createForm.isClinicalApprover}
                    onChange={(e) => setCreateForm({ ...createForm, isClinicalApprover: e.target.checked })}
                  />
                  <label htmlFor="isClinicalApprover" style={{ fontSize: '0.875rem', color: '#0f172a', cursor: 'pointer' }}>
                    Practice Owner is a licensed practicing veterinarian (Clinical Approver)
                  </label>
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
                  {isSubmitting ? 'Creating...' : 'Create Practice Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend / Reactivate Confirmation Modal */}
      {actionModal && (
        <div className="platform-modal-overlay">
          <div className="platform-modal" style={{ maxWidth: 480 }}>
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                {actionModal.type === 'SUSPEND' ? 'Suspend Practice Tenant' : 'Reactivate Practice Tenant'}
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setActionModal(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="platform-modal-body">
              <p style={{ fontSize: '0.875rem', color: '#334155', margin: 0 }}>
                {actionModal.type === 'SUSPEND' ? (
                  <>
                    Are you sure you want to suspend <strong>{actionModal.practice.name}</strong>?
                    All member access into this practice will be disabled immediately.
                  </>
                ) : (
                  <>
                    Are you sure you want to reactivate <strong>{actionModal.practice.name}</strong>?
                    Active practice members will regain access according to their roles.
                  </>
                )}
              </p>

              {actionModal.type === 'SUSPEND' && (
                <div style={{ marginTop: 12 }}>
                  <label className="form-label">Suspension Reason (Audited)</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. Non-payment, violation of terms, investigation"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="platform-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSubmitting}
                onClick={() => setActionModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: actionModal.type === 'SUSPEND' ? '#dc2626' : '#16a34a',
                  color: '#ffffff',
                }}
                disabled={isSubmitting}
                onClick={handleConfirmAction}
              >
                {isSubmitting
                  ? 'Processing...'
                  : actionModal.type === 'SUSPEND'
                  ? 'Confirm Suspension'
                  : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
