// ==============================================================================
// VetRx — PlatformDashboardPage.tsx
// Central Executive Dashboard for Platform Super Admin
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi, type PlatformDashboardData } from '../../services/platformAdminApi';

export const PlatformDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await platformAdminApi.getDashboard();
        setData(res);
      } catch (err: any) {
        setError(err.message || 'Failed to load platform dashboard.');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ color: '#64748b' }}>Loading platform telemetry...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="platform-card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <Icon name="warning" size={32} color="#dc2626" style={{ margin: '0 auto 12px' }} />
        <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Telemetry Load Failure</h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{error || 'Unable to retrieve dashboard metrics.'}</p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 16 }}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const { metrics, practicesByType, recentPractices, recentAuditLogs } = data;

  return (
    <div>
      {/* Page Header */}
      <div className="platform-page-header">
        <div>
          <h1 className="platform-page-title">SaaS Platform Overview</h1>
          <div className="platform-page-subtitle">
            Executive oversight, multi-tenant practice health, and live platform telemetry.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/platform/issues')}
          >
            <Icon name="life-buoy" size={15} />
            <span>Support Tickets ({metrics.openIssues})</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/platform/practices?create=1')}
          >
            <Icon name="plus" size={15} />
            <span>Create Practice</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          marginBottom: 28,
        }}
      >
        <div className="platform-card" style={{ borderLeft: '4px solid #4f46e5' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Total Practices
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', margin: '6px 0' }}>
            {metrics.totalPractices}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
            {metrics.activePractices} Active • {metrics.suspendedPractices} Suspended
          </div>
        </div>

        <div className="platform-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Total Users
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', margin: '6px 0' }}>
            {metrics.totalUsers}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {metrics.activeUsers} Active Accounts
          </div>
        </div>

        <div className="platform-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Active Subscriptions
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', margin: '6px 0' }}>
            {metrics.activeSubscriptions}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
            Commercial Plans Active
          </div>
        </div>

        <div className="platform-card" style={{ borderLeft: '4px solid #eab308' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Open Support Tickets
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', margin: '6px 0' }}>
            {metrics.openIssues}
          </div>
          <div style={{ fontSize: '0.75rem', color: metrics.openIssues > 0 ? '#b45309' : '#15803d', fontWeight: 600 }}>
            {metrics.openIssues > 0 ? 'Requires attention' : 'All issues resolved'}
          </div>
        </div>
      </div>

      {/* Practices by Archetype */}
      <div className="platform-card" style={{ marginBottom: 28 }}>
        <div className="platform-card-header">
          <h2 className="platform-card-title">Practice Types Distribution</h2>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Tenants by Operational Archetype</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#7e22ce', fontWeight: 700, textTransform: 'uppercase' }}>
              Independent Practitioners
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {practicesByType.independent}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Solo veterinary practices</div>
          </div>

          <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#4338ca', fontWeight: 700, textTransform: 'uppercase' }}>
              Veterinary Clinics
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {practicesByType.clinic}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Multi-doctor clinics &amp; hospitals</div>
          </div>

          <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase' }}>
              Enterprise Networks
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
              {practicesByType.enterprise}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Multi-branch &amp; custom quotas</div>
          </div>
        </div>
      </div>

      {/* Two-Column Grid: Recent Practices & Recent Audits */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
        {/* Recent Practices */}
        <div className="platform-card">
          <div className="platform-card-header">
            <h2 className="platform-card-title">Recent Practices</h2>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              onClick={() => navigate('/platform/practices')}
            >
              View All
            </button>
          </div>

          {recentPractices.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              No practices registered yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentPractices.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    border: '1px solid #f1f5f9',
                    borderRadius: 6,
                    background: '#ffffff',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/platform/practices/${p.id}`)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Owner: {p.ownerName} ({p.ownerEmail})
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge-${p.status.toLowerCase()}`}>{p.status}</span>
                    <Icon name="chevron-right" size={14} color="#94a3b8" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Security Audits */}
        <div className="platform-card">
          <div className="platform-card-header">
            <h2 className="platform-card-title">Security &amp; Audit Trail</h2>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              onClick={() => navigate('/platform/audit')}
            >
              Full Trail
            </button>
          </div>

          {recentAuditLogs.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              No audit logs recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '8px 12px',
                    borderLeft: '3px solid #6366f1',
                    background: '#f8fafc',
                    borderRadius: '0 6px 6px 0',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{log.action}</span>
                    <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                      {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>
                    Resource: {log.resource} {log.practiceName ? `• Practice: ${log.practiceName}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
