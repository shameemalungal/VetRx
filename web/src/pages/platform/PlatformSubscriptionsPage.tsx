// ==============================================================================
// VetRx — PlatformSubscriptionsPage.tsx
// Platform-wide Commercial Subscriptions Oversight
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi, type PlatformSubscriptionItem } from '../../services/platformAdminApi';

export const PlatformSubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<PlatformSubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await platformAdminApi.listSubscriptions();
        setSubscriptions(Array.isArray(res) ? res : []);
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve subscriptions.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div>
      <div className="platform-page-header">
        <div>
          <h1 className="platform-page-title">Subscriptions Management</h1>
          <div className="platform-page-subtitle">
            Commercial plans, active subscriptions, and seat allocations across all practice tenants.
          </div>
        </div>
      </div>

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
    </div>
  );
};
