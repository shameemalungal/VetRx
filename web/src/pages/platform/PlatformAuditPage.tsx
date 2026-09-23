// ==============================================================================
// VetRx — PlatformAuditPage.tsx
// Comprehensive Security & Platform Administrative Audit Logs
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi, type PlatformAuditLogItem } from '../../services/platformAdminApi';

export const PlatformAuditPage: React.FC = () => {
  const [logs, setLogs] = useState<PlatformAuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await platformAdminApi.listAuditLogs({
        action: actionFilter.trim() || undefined,
        limit: 50,
      });
      setLogs(res.results || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve audit trail.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadLogs();
  };

  return (
    <div>
      <div className="platform-page-header">
        <div>
          <h1 className="platform-page-title">Security &amp; Audit Trail</h1>
          <div className="platform-page-subtitle">
            Immutable system logs of administrative modifications, security actions, and role changes.
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="platform-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          marginBottom: 20,
          padding: '12px 16px',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 400 }}>
          <div className="platform-search-input-wrap" style={{ flex: 1 }}>
            <Icon name="search" size={16} color="#64748b" />
            <input
              type="text"
              className="platform-search-input"
              placeholder="Filter by action (e.g. PRACTICE_SUSPENDED)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Filter
          </button>
        </form>

        <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          Showing latest {logs.length} of {total} audit records
        </div>
      </div>

      {/* Audit Logs Table */}
      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#64748b' }}>Loading security logs...</div>
        </div>
      ) : error ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 32, color: '#dc2626' }}>
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <Icon name="shield" size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>No audit records found</div>
          <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>
            System events matching your criteria will appear here.
          </div>
        </div>
      ) : (
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Actor</th>
                <th>Practice</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(log.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: log.action.includes('SUSPEND') || log.action.includes('DEACTIVATE')
                          ? '#fee2e2'
                          : log.action.includes('REACTIVATE') || log.action.includes('CREATE')
                          ? '#dcfce7'
                          : '#f1f5f9',
                        color: log.action.includes('SUSPEND') || log.action.includes('DEACTIVATE')
                          ? '#b91c1c'
                          : log.action.includes('REACTIVATE') || log.action.includes('CREATE')
                          ? '#15803d'
                          : '#334155',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#0f172a' }}>
                      {log.resource}
                    </div>
                    {log.resourceId && (
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }} className="data-mono">
                        {log.resourceId}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>
                      {log.userName || log.userEmail || 'System'}
                    </div>
                    {log.userEmail && log.userName && (
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{log.userEmail}</div>
                    )}
                  </td>
                  <td>
                    {log.practiceName ? (
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{log.practiceName}</div>
                    ) : log.practiceId ? (
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }} className="data-mono">
                        {log.practiceId}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Platform</span>
                    )}
                  </td>
                  <td>
                    {log.metadata ? (
                      <pre
                        style={{
                          margin: 0,
                          fontSize: '0.6875rem',
                          background: '#f8fafc',
                          padding: '4px 6px',
                          borderRadius: 4,
                          maxWidth: 240,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata, null, 2)}
                      >
                        {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)}
                      </pre>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>-</span>
                    )}
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
