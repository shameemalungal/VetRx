// ==============================================================================
// VetRx — PlatformSubscriptionsPage.tsx
// Platform-wide Commercial Subscriptions Oversight
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi, type PlatformSubscriptionItem } from '../../services/platformAdminApi';
import { formatApiError } from '../../utils/formatError';

export const PlatformSubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<PlatformSubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Complimentary Access Modal State
  const [showComplimentaryModal, setShowComplimentaryModal] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantAccessType, setGrantAccessType] = useState<'INDIVIDUAL' | 'CLINIC'>('INDIVIDUAL');
  const [grantDuration, setGrantDuration] = useState(12);
  const [grantReason, setGrantReason] = useState('');
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

  const loadSubscriptions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await platformAdminApi.listSubscriptions();
      const results = (res as any)?.results || res;
      setSubscriptions(Array.isArray(results) ? results : []);
    } catch (err: unknown) {
      setError(formatApiError(err, 'Failed to retrieve subscriptions.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSubscriptions();
  }, []);

  const handleGrantComplimentary = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantError(null);
    if (!grantEmail || !grantEmail.includes('@')) {
      setGrantError('Please provide a valid recipient email address.');
      return;
    }

    try {
      setIsSubmittingGrant(true);
      const res = await platformAdminApi.grantComplimentarySubscription({
        email: grantEmail.trim().toLowerCase(),
        accessType: grantAccessType,
        durationMonths: Number(grantDuration),
        reason: grantReason.trim() || undefined,
      });

      setSuccessMsg(res.message || `Complimentary ${grantAccessType} subscription granted successfully.`);
      setShowComplimentaryModal(false);
      setGrantEmail('');
      setGrantReason('');
      setGrantDuration(12);
      await loadSubscriptions();
    } catch (err: unknown) {
      setGrantError(err instanceof Error ? err.message : 'Failed to grant complimentary subscription.');
    } finally {
      setIsSubmittingGrant(false);
    }
  };

  return (
    <div>
      <div className="platform-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="platform-page-title">Subscriptions Management</h1>
          <div className="platform-page-subtitle">
            Commercial plans, active subscriptions, and seat allocations across all practice tenants.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.875rem' }}
          onClick={() => {
            setGrantError(null);
            setShowComplimentaryModal(true);
          }}
        >
          <Icon name="award" size={16} />
          Grant Complimentary Access
        </button>
      </div>

      {successMsg && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontSize: '1.1rem' }}>&times;</button>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#64748b' }}>Loading subscriptions...</div>
        </div>
      ) : error ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 32, color: '#dc2626' }}>
          {error}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <Icon name="credit-card" size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>No subscriptions found</div>
          <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>All practices are currently on trial tier.</div>
        </div>
      ) : (
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Practice</th>
                <th>Plan Name</th>
                <th>Status</th>
                <th>Origin / Source</th>
                <th>Current Period</th>
                <th>Veterinarian Quota</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.practiceName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }} className="data-mono">
                      {s.practiceId}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.planName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.planCode}</div>
                  </td>
                  <td>
                    <span className={s.status === 'ACTIVE' ? 'badge-active' : 'badge-suspended'}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    {s.source === 'COMPLIMENTARY' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Icon name="award" size={12} />
                        Complimentary
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Commercial / PayU
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                    {new Date(s.currentPeriodStart).toLocaleDateString('en-IN')} –{' '}
                    {new Date(s.currentPeriodEnd).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {s.seatsUsed} / {s.seatsAllowed} Seats Used
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {s.isOwnerClinicalApprover ? 'Owner is Approver' : 'Admin Owner'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => navigate(`/platform/practices/${s.practiceId}`)}
                    >
                      View Practice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grant Complimentary Access Modal */}
      {showComplimentaryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="award" size={20} color="#00685f" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Grant Complimentary Access</h3>
              </div>
              <button
                type="button"
                onClick={() => !isSubmittingGrant && setShowComplimentaryModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleGrantComplimentary} style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>
                Grant complimentary access to a practitioner or clinic without requiring payment or generating payment records. Tracks internal audit metadata.
              </p>

              {grantError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 12px', borderRadius: '6px', fontSize: '0.8125rem', marginBottom: '14px' }}>
                  {grantError}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Recipient Email Address <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="practitioner@example.com"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Must match the registered practice owner account email.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Access Tier
                  </label>
                  <select
                    value={grantAccessType}
                    onChange={(e) => setGrantAccessType(e.target.value as 'INDIVIDUAL' | 'CLINIC')}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', background: '#fff' }}
                  >
                    <option value="INDIVIDUAL">Individual (1 Vet)</option>
                    <option value="CLINIC">Clinic (Up to 5 Vets)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Duration
                  </label>
                  <select
                    value={grantDuration}
                    onChange={(e) => setGrantDuration(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', background: '#fff' }}
                  >
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months (1 Year)</option>
                    <option value={24}>24 Months (2 Years)</option>
                    <option value={36}>36 Months (3 Years)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Internal Reason / Note
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Professional courtesy, Academic partnership, Clinical advisor"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={isSubmittingGrant}
                  onClick={() => setShowComplimentaryModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingGrant}
                >
                  {isSubmittingGrant ? 'Granting Access...' : 'Confirm Complimentary Grant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
