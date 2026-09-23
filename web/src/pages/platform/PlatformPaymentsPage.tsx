// ==============================================================================
// VetRx — PlatformPaymentsPage.tsx
// Safe Platform Billing & Payment Transactions Log (No Secret Leakage)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { platformAdminApi, type PlatformPaymentItem } from '../../services/platformAdminApi';

export const PlatformPaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PlatformPaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await platformAdminApi.listPayments();
        setPayments(Array.isArray(res) ? res : []);
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve payments.');
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
          <h1 className="platform-page-title">Platform Payments &amp; Invoices</h1>
          <div className="platform-page-subtitle">
            Authoritative billing records, subscription invoice receipts, and transaction history.
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ color: '#64748b' }}>Loading payment records...</div>
        </div>
      ) : error ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 32, color: '#dc2626' }}>
          {error}
        </div>
      ) : payments.length === 0 ? (
        <div className="platform-card" style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
          <Icon name="receipt" size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>No billing transactions found</div>
          <div style={{ fontSize: '0.8125rem', marginTop: 4 }}>
            Recorded Razorpay subscription settlements will appear here.
          </div>
        </div>
      ) : (
        <div className="platform-table-wrap">
          <table className="platform-table">
            <thead>
              <tr>
                <th>Practice</th>
                <th>Amount (INR)</th>
                <th>Status</th>
                <th>Gateway Reference</th>
                <th>Transaction Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.practiceName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }} className="data-mono">
                      {p.practiceId}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a' }}>
                      ₹{p.amountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>{p.currency}</div>
                  </td>
                  <td>
                    <span className={p.status === 'COMPLETED' ? 'badge-active' : 'badge-suspended'}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    {p.razorpayPaymentId ? (
                      <div className="data-mono" style={{ fontSize: '0.75rem', color: '#475569' }}>
                        {p.razorpayPaymentId}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Manual / Offline</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                    {new Date(p.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                      onClick={() => navigate(`/platform/practices/${p.practiceId}`)}
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
