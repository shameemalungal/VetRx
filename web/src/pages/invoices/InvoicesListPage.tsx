// =============================================================
// VetRx — InvoicesListPage (Phase 6: Invoices History & Overview)
// =============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { InvoiceStatus } from '../../types';
import { Icon } from '../../components/ui/Icon';
import { formatINR, ensureSampleInvoicesSeeded } from './invoiceUtils';
import './Invoices.css';

export const InvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | InvoiceStatus>('All');

  // Ensure sample seed exists
  useEffect(() => {
    void ensureSampleInvoicesSeeded();
  }, []);

  // Live queries
  const invoices = useLiveQuery(() => db.invoices.toArray(), []) || [];
  const patients = useLiveQuery(() => db.patients.toArray(), []) || [];
  const owners = useLiveQuery(() => db.owners.toArray(), []) || [];

  // Mappings
  const patientsById = useMemo(() => {
    return new Map(patients.map((p) => [p.id!, p]));
  }, [patients]);

  const ownersById = useMemo(() => {
    return new Map(owners.map((o) => [o.id!, o]));
  }, [owners]);

  // Metrics
  const metrics = useMemo(() => {
    const totalIssuedPaisa = invoices
      .filter((inv) => inv.status === 'Issued')
      .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    const totalAllPaisa = invoices
      .filter((inv) => inv.status !== 'Cancelled')
      .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    const issuedCount = invoices.filter((inv) => inv.status === 'Issued').length;
    const draftCount = invoices.filter((inv) => inv.status === 'Draft').length;

    return {
      totalInvoicedPaisa: totalAllPaisa > 0 ? totalAllPaisa : totalIssuedPaisa,
      issuedCount,
      draftCount,
      totalCount: invoices.length,
    };
  }, [invoices]);

  // Filtered list
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (statusFilter !== 'All' && inv.status !== statusFilter) {
          return false;
        }
        if (dateFilter) {
          const invDateStr = new Date(inv.invoiceDate).toISOString().slice(0, 10);
          if (invDateStr !== dateFilter) {
            return false;
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const p = patientsById.get(inv.patientId);
          const o = ownersById.get(inv.ownerId);

          const matchesNumber = inv.invoiceNumber.toLowerCase().includes(q);
          const matchesPatient = p?.name.toLowerCase().includes(q);
          const matchesOwner = o?.name.toLowerCase().includes(q) || o?.phone?.toLowerCase().includes(q);

          return matchesNumber || matchesPatient || matchesOwner;
        }
        return true;
      })
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
  }, [invoices, statusFilter, dateFilter, searchQuery, patientsById, ownersById]);

  // Quick export to CSV
  const handleExportCSV = () => {
    if (filteredInvoices.length === 0) return;
    const headers = ['Invoice No', 'Status', 'Date', 'Patient', 'Owner', 'Amount (INR)'];
    const rows = filteredInvoices.map((inv) => {
      const p = patientsById.get(inv.patientId);
      const o = ownersById.get(inv.ownerId);
      return [
        inv.invoiceNumber,
        inv.status,
        new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        `"${p?.name || '—'}"`,
        `"${o?.name || '—'}"`,
        ((inv.grandTotal || 0) / 100).toFixed(2),
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vetrx_invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="invoices-page-container">
      {/* Top Level Header / Action Deck */}
      <div className="invoices-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="invoices-module-pill">FINANCIAL MODULE</span>
            <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>•</span>
            <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>FY 2026-27</span>
          </div>
          <h1 className="invoices-title">Invoices</h1>
          <p className="invoices-subtitle">
            View and manage treatment invoices, medication dispensations, and split balances.
          </p>
        </div>

        <div className="invoices-actions-deck">
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={handleExportCSV}
            title="Export filtered records to CSV"
          >
            <Icon name="download" size={18} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => navigate('/invoices/new')}
            id="btn-create-invoice"
          >
            <Icon name="plus" size={18} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Metric / Overview Ribbon */}
      <div className="invoices-metrics-grid">
        {/* Metric 1 */}
        <div className="invoices-metric-card">
          <div className="invoices-metric-top">
            <div className="invoices-metric-icon">
              <Icon name="invoices" size={22} />
            </div>
            <span className="invoices-metric-chip success">
              <Icon name="trending-up" size={14} /> +14.2%
            </span>
          </div>
          <div>
            <span className="invoices-metric-label">Total Invoiced Value</span>
            <div className="invoices-metric-value">{formatINR(metrics.totalInvoicedPaisa)}</div>
          </div>
          <div className="invoices-metric-footer">
            <span>{metrics.totalCount} total issued &amp; draft</span>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>FY 2026-27</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="invoices-metric-card">
          <div className="invoices-metric-top">
            <div
              className="invoices-metric-icon"
              style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}
            >
              <Icon name="check" size={22} />
            </div>
            <span className="invoices-metric-chip neutral">Active</span>
          </div>
          <div>
            <span className="invoices-metric-label">Issued This Month</span>
            <div className="invoices-metric-value">{metrics.issuedCount} Invoices</div>
          </div>
          <div className="invoices-metric-footer">
            <span>Ready to share or print</span>
            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>Official records</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="invoices-metric-card">
          <div className="invoices-metric-top">
            <div
              className="invoices-metric-icon"
              style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}
            >
              <Icon name="edit" size={20} />
            </div>
            <span className="invoices-metric-chip neutral">In Review</span>
          </div>
          <div>
            <span className="invoices-metric-label">Draft Invoices</span>
            <div className="invoices-metric-value">{metrics.draftCount} Drafts</div>
          </div>
          <div className="invoices-metric-footer">
            <span>In preparation</span>
            <span>Pending review</span>
          </div>
        </div>
      </div>

      {/* Filtration & Search Command Deck */}
      <div className="invoices-control-bar">
        <div className="invoices-search-wrap">
          <span className="invoices-search-icon">
            <Icon name="search" size={18} />
          </span>
          <input
            type="text"
            className="invoices-search-input"
            placeholder="Search invoices, patients, owners, INV-..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Date Filter */}
        <div className="invoices-date-wrap">
          <span className="invoices-date-icon">
            <Icon name="calendar" size={16} />
          </span>
          <input
            type="date"
            className="invoices-date-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter by invoice date"
            aria-label="Filter by invoice date"
          />
          {dateFilter && (
            <button
              type="button"
              className="invoices-date-clear-btn"
              onClick={() => setDateFilter('')}
              title="Clear date filter"
            >
              <Icon name="x-mark" size={14} />
            </button>
          )}
        </div>

        <div className="invoices-filter-group">
          <div className="invoices-status-tabs">
            {(['All', 'Issued', 'Draft', 'Cancelled'] as const).map((st) => {
              const count =
                st === 'All'
                  ? invoices.length
                  : invoices.filter((i) => i.status === st).length;
              return (
                <button
                  key={st}
                  type="button"
                  className={`invoices-status-tab ${statusFilter === st ? 'active' : ''}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st} ({count})
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearchQuery('');
              setDateFilter('');
              setStatusFilter('All');
            }}
            title="Reset Filters"
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {/* Invoices Table Surface */}
      <div className="invoices-table-card">
        <div className="invoices-table-wrap">
          <table className="invoices-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Invoice No</th>
                <th style={{ width: '220px' }}>Owner &amp; Contact</th>
                <th>Patient &amp; Species</th>
                <th style={{ width: '150px' }}>Date Issued</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Amount (INR)</th>
                <th style={{ width: '110px' }}>Status</th>
                <th style={{ width: '180px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--color-outline)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Icon name="invoices" size={32} />
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>No invoices found matching criteria.</span>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate('/invoices/new')}
                        style={{ marginTop: '8px' }}
                      >
                        Create New Invoice
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const patient = patientsById.get(inv.patientId);
                  const owner = ownersById.get(inv.ownerId);
                  const statusClass = inv.status.toLowerCase();

                  return (
                    <tr key={inv.id}>
                      {/* Invoice No */}
                      <td>
                        <div className="invoices-num-cell">
                          <Icon name="invoices" size={16} />
                          <span>{inv.invoiceNumber}</span>
                        </div>
                        {inv.notes && (
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)', display: 'block', paddingLeft: '22px' }}>
                            {inv.notes}
                          </span>
                        )}
                      </td>

                      {/* Owner */}
                      <td>
                        <strong style={{ display: 'block', color: 'var(--color-on-surface)' }}>
                          {owner?.name || 'Walk-in Client'}
                        </strong>
                        {owner?.phone && (
                          <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Icon name="phone" size={12} /> {owner.phone}
                          </span>
                        )}
                      </td>

                      {/* Patient */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'var(--color-secondary-fixed)',
                              color: 'var(--color-on-secondary-fixed)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            <Icon name="paw" size={14} />
                          </div>
                          <div>
                            <strong style={{ display: 'block', color: 'var(--color-on-surface)' }}>
                              {patient?.name || 'Unknown Patient'}
                            </strong>
                            <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                              {patient?.species || 'Species'} {patient?.breed ? `· ${patient.breed}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date Issued */}
                      <td>
                        <span style={{ fontSize: '13px', display: 'block' }}>
                          {new Date(inv.invoiceDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-outline)', fontFamily: 'var(--font-data)' }}>
                          {new Date(inv.invoiceDate).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Amount */}
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                          {formatINR(inv.grandTotal)}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`invoices-status-pill ${statusClass}`}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'currentColor',
                            }}
                          />
                          <span>{inv.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="invoices-actions-cell">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/invoices/${inv.id}`)}
                            title="View / Print Document"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                            title="Edit Invoice"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/invoices/${inv.id}?print=true`)}
                            title="Print Tax Invoice"
                          >
                            <Icon name="print" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
