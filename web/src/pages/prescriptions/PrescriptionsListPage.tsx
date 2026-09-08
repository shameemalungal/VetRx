// =============================================================
// VetRx — PrescriptionsListPage.tsx
// Phase 3: Prescriptions Directory Screen
// Follows Stitch clinical history / list visual benchmarks
// =============================================================

import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Prescription, Patient, Owner } from '../../types';
import { Icon } from '../../components/ui/Icon';
import './Prescriptions.css';

type StatusFilter = 'all' | 'Issued' | 'Draft';

export const PrescriptionsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ── Database Queries ──────────────────────────────────────────
  const prescriptions = useLiveQuery(
    () => db.prescriptions.reverse().sortBy('createdAt'),
    []
  );

  const patients = useLiveQuery(() => db.patients.toArray(), []);
  const owners = useLiveQuery(() => db.owners.toArray(), []);

  // Map lookup caches for instant join
  const patientsMap = useMemo(() => {
    const map = new Map<number, Patient>();
    if (patients) {
      for (const p of patients) {
        if (p.id) map.set(p.id, p);
      }
    }
    return map;
  }, [patients]);

  const ownersMap = useMemo(() => {
    const map = new Map<number, Owner>();
    if (owners) {
      for (const o of owners) {
        if (o.id) map.set(o.id, o);
      }
    }
    return map;
  }, [owners]);

  // ── Counts ────────────────────────────────────────────────────
  const totalCount = prescriptions?.length || 0;
  const issuedCount = useMemo(
    () => prescriptions?.filter((rx) => rx.status === 'Issued').length || 0,
    [prescriptions]
  );
  const draftCount = useMemo(
    () => prescriptions?.filter((rx) => rx.status === 'Draft').length || 0,
    [prescriptions]
  );

  // ── Search & Filter Logic ─────────────────────────────────────
  const filteredPrescriptions = useMemo(() => {
    if (!prescriptions) return [];

    const q = searchQuery.toLowerCase().trim();

    return prescriptions.filter((rx) => {
      // Status filter
      if (statusFilter !== 'all' && rx.status !== statusFilter) {
        return false;
      }

      // Query filter
      if (!q) return true;

      const patient = patientsMap.get(rx.patientId);
      const owner = ownersMap.get(rx.ownerId);

      const matchesRx = rx.rxNumber.toLowerCase().includes(q);
      const matchesDiag = rx.diagnosis?.toLowerCase().includes(q) || false;
      const matchesSymptoms = rx.symptoms?.toLowerCase().includes(q) || false;
      const matchesPatient =
        patient?.name.toLowerCase().includes(q) ||
        patient?.species.toLowerCase().includes(q) ||
        patient?.breed?.toLowerCase().includes(q) ||
        false;
      const matchesOwner =
        owner?.name.toLowerCase().includes(q) ||
        owner?.phone.includes(q) ||
        false;

      return (
        matchesRx ||
        matchesDiag ||
        matchesSymptoms ||
        matchesPatient ||
        matchesOwner
      );
    });
  }, [prescriptions, patientsMap, ownersMap, searchQuery, statusFilter]);

  const formatDate = (d: Date | string | undefined) => {
    if (!d) return '—';
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (d: Date | string | undefined) => {
    if (!d) return '';
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="rx-page-container">
      {/* ── Top Level Header / Action Deck ──────────────────────── */}
      <div className="rx-header-deck">
        <div className="rx-header-left">
          <div className="rx-module-tag">
            <span>CLINICAL MODULE</span>
            <span>•</span>
            <span>PRESCRIPTION RECORDS</span>
          </div>
          <h1 className="rx-title">Prescriptions</h1>
          <p className="rx-subtitle">
            View and manage treatment regimens, medical instructions, and dispensation orders.
          </p>
        </div>

        <div className="rx-header-actions">
          <Link to="/prescriptions/new" className="btn btn-primary">
            <Icon name="plus" size={18} />
            <span>New Prescription</span>
          </Link>
        </div>
      </div>

      {/* ── Overview Metric Ribbon (3 Cards) ────────────────────── */}
      <div className="rx-metrics-ribbon">
        {/* Metric 1: Total Prescriptions */}
        <div className="rx-metric-card">
          <div className="rx-metric-top">
            <div className="rx-metric-icon primary">
              <Icon name="prescription" size={20} />
            </div>
            <span className="rx-metric-tag active">Total Registered</span>
          </div>
          <div>
            <span className="rx-metric-label">All Prescriptions</span>
            <div className="rx-metric-value-row">
              <span className="rx-metric-val">{totalCount}</span>
              <span className="rx-metric-unit">Orders</span>
            </div>
          </div>
          <div className="rx-metric-footer">
            <span>Historical &amp; active records</span>
            <span className="font-mono text-primary font-bold">VetRx</span>
          </div>
        </div>

        {/* Metric 2: Issued Prescriptions */}
        <div className="rx-metric-card">
          <div className="rx-metric-top">
            <div className="rx-metric-icon success">
              <Icon name="check-circle" size={20} />
            </div>
            <span className="rx-metric-tag" style={{ background: '#ecfdf5', color: '#065f46' }}>
              Finalized
            </span>
          </div>
          <div>
            <span className="rx-metric-label">Issued Prescriptions</span>
            <div className="rx-metric-value-row">
              <span className="rx-metric-val">{issuedCount}</span>
              <span className="rx-metric-unit">Issued</span>
            </div>
          </div>
          <div className="rx-metric-footer">
            <span>Ready to share or print</span>
            <span className="font-semibold text-success">
              {totalCount > 0 ? `${Math.round((issuedCount / totalCount) * 100)}% rate` : '0%'}
            </span>
          </div>
        </div>

        {/* Metric 3: Draft Prescriptions */}
        <div className="rx-metric-card">
          <div className="rx-metric-top">
            <div className="rx-metric-icon neutral">
              <Icon name="edit" size={18} />
            </div>
            <span className="rx-metric-tag" style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
              In Progress
            </span>
          </div>
          <div>
            <span className="rx-metric-label">Draft Prescriptions</span>
            <div className="rx-metric-value-row">
              <span className="rx-metric-val">{draftCount}</span>
              <span className="rx-metric-unit">Drafts</span>
            </div>
          </div>
          <div className="rx-metric-footer">
            <span>Pending consultation review</span>
            <span className="font-mono text-outline font-semibold">Editable</span>
          </div>
        </div>
      </div>

      {/* ── Filtration & Search Command Deck ────────────────────── */}
      <div className="rx-command-deck">
        {/* Search Bar */}
        <div className="rx-search-box">
          <div className="rx-search-icon">
            <Icon name="search" size={18} />
          </div>
          <input
            type="search"
            className="rx-search-input"
            placeholder="Search prescriptions, patients, owners, RX-..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="rx-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <Icon name="x-mark" size={14} />
            </button>
          )}
        </div>

        {/* Status Segment Chips */}
        <div className="rx-filter-chips">
          <button
            type="button"
            className={`rx-filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <span>All</span>
            <span className="rx-chip-count">({totalCount})</span>
          </button>
          <button
            type="button"
            className={`rx-filter-chip ${statusFilter === 'Issued' ? 'active' : ''}`}
            onClick={() => setStatusFilter('Issued')}
          >
            <span>Issued</span>
            <span className="rx-chip-count">({issuedCount})</span>
          </button>
          <button
            type="button"
            className={`rx-filter-chip ${statusFilter === 'Draft' ? 'active' : ''}`}
            onClick={() => setStatusFilter('Draft')}
          >
            <span>Draft</span>
            <span className="rx-chip-count">({draftCount})</span>
          </button>
        </div>
      </div>

      {/* ── Primary Prescriptions Table Surface ─────────────────── */}
      <div className="rx-table-surface">
        {filteredPrescriptions.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-outline)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--color-primary)' }}>
              <Icon name="prescription" size={24} />
            </div>
            <p className="font-heading font-bold text-on-surface text-base mb-1">
              {searchQuery ? 'No matching prescriptions found' : 'No prescriptions recorded yet'}
            </p>
            <p className="text-sm text-outline mb-4">
              {searchQuery ? 'Try clearing or modifying your search criteria.' : 'Create your first veterinary prescription to begin tracking patient treatments.'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            ) : (
              <Link to="/prescriptions/new" className="btn btn-primary btn-sm">
                <Icon name="plus" size={14} />
                <span>Create First Prescription</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="rx-table-wrap">
            <table className="rx-table">
              <thead>
                <tr>
                  <th>Prescription No</th>
                  <th>Patient &amp; Species</th>
                  <th>Owner &amp; Contact</th>
                  <th>Date Recorded</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrescriptions.map((rx: Prescription) => {
                  const patient = patientsMap.get(rx.patientId);
                  const owner = ownersMap.get(rx.ownerId);

                  return (
                    <tr key={rx.id}>
                      {/* Prescription Number & Diagnosis */}
                      <td>
                        <div className="rx-number-cell">
                          <Link
                            to={`/prescriptions/${rx.id}`}
                            className="rx-number-line hover:underline"
                          >
                            <Icon name="prescription" size={15} />
                            <span>{rx.rxNumber}</span>
                          </Link>
                          <span className="rx-diag-subline" title={rx.diagnosis || 'General Consultation'}>
                            {rx.diagnosis || 'General Clinical Review'}
                          </span>
                        </div>
                      </td>

                      {/* Patient & Species */}
                      <td>
                        <div className="rx-patient-cell">
                          <div className="rx-patient-avatar">
                            <Icon name="paw" size={16} />
                          </div>
                          <div className="rx-patient-info">
                            <Link
                              to={`/patients/${rx.patientId}`}
                              className="rx-patient-name hover:underline"
                            >
                              {patient ? patient.name : `Patient #${rx.patientId}`}
                            </Link>
                            <span className="rx-patient-species">
                              {patient ? `${patient.species}${patient.breed ? ` · ${patient.breed}` : ''}` : 'Animal'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Owner & Contact */}
                      <td>
                        <div className="rx-owner-cell">
                          <span className="rx-owner-name">
                            {owner ? owner.name : 'Unknown Client'}
                          </span>
                          {owner?.phone && (
                            <span className="rx-owner-phone">
                              <Icon name="phone" size={12} />
                              <span>{owner.phone}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date Recorded */}
                      <td>
                        <div className="rx-date-cell">
                          <span className="rx-date-main">
                            {formatDate(rx.issuedAt || rx.createdAt)}
                          </span>
                          <span className="rx-date-time">
                            {formatTime(rx.issuedAt || rx.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td>
                        <span className={`rx-status-pill ${rx.status === 'Issued' ? 'issued' : 'draft'}`}>
                          <span className="status-dot" />
                          <span>{rx.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="rx-actions-cell">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/prescriptions/${rx.id}`)}
                            title="View Prescription Sheet"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigate(`/prescriptions/${rx.id}/edit`)}
                            title="Edit Prescription"
                          >
                            Edit
                          </button>
                          <Link
                            to={`/prescriptions/${rx.id}`}
                            className="btn btn-ghost btn-sm btn-icon"
                            title="Print Document"
                          >
                            <Icon name="print" size={16} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
