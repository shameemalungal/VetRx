// =============================================================
// VetRx — Dashboard Page
// Presentation layer reproducing the approved Stitch Desktop & Mobile UI
// Reference: "VetRx Clinical Dashboard - 3D Pastel KPI Cards"
// Fully reactive with live IndexedDB/Dexie queries.
// =============================================================

import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useSettingsStore } from '../store/settingsStore';
import { Icon } from '../components/ui/Icon';
import { ShareModal } from '../components/ui/ShareModal';
import type { Patient, Owner, TreatmentPackageItem, Medicine, Invoice } from '../types';
import { formatAnimalSubtitle, formatOwnerPrimary } from '../utils/patientFormat';
import './DashboardPage.css';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtRupees(paisa: number): string {
  return '₹' + (paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function timeAgo(d?: Date): string {
  if (!d) return '';
  const diffDays = Math.round((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 14) return '1w ago';
  if (diffDays < 30) return `${Math.round(diffDays / 7)}w ago`;
  return `${Math.round(diffDays / 30)}mo ago`;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { practitioner, organisation } = useSettingsStore();

  // ── Instant Formulary & MRN Search State ─────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const formularySearchRef = useRef<HTMLDivElement>(null);
  const [shareInvoice, setShareInvoice] = useState<(Invoice & { patient?: Patient; owner?: Owner }) | null>(null);

  // ── Metric Counts ───────────────────────────────────────────
  const rxCount      = useLiveQuery(() => db.prescriptions.count(), []);
  const patientCount = useLiveQuery(() => db.patients.count(), []);
  const pkgCount     = useLiveQuery(() => db.treatmentPackages.count(), []);
  const invCount     = useLiveQuery(() => db.invoices.count(), []);

  // ── Enriched Recent Prescriptions ───────────────────────────
  const recentRx = useLiveQuery(async () => {
    const rxs = await db.prescriptions.orderBy('createdAt').reverse().limit(4).toArray();
    const patientIds = [...new Set(rxs.map((r) => r.patientId))];
    const ownerIds = [...new Set(rxs.map((r) => r.ownerId))];

    const [patients, owners] = await Promise.all([
      db.patients.where('id').anyOf(patientIds).toArray(),
      db.owners.where('id').anyOf(ownerIds).toArray(),
    ]);

    const patientMap = new Map<number, Patient>(patients.map((p) => [p.id!, p]));
    const ownerMap = new Map<number, Owner>(owners.map((o) => [o.id!, o]));

    return rxs.map((rx) => ({
      ...rx,
      patient: patientMap.get(rx.patientId),
      owner: ownerMap.get(rx.ownerId),
    }));
  }, []);

  // ── Enriched Recent Invoices ────────────────────────────────
  const recentInv = useLiveQuery(async () => {
    const invs = await db.invoices.orderBy('invoiceDate').reverse().limit(3).toArray();
    const patientIds = [...new Set(invs.map((i) => i.patientId))];
    const ownerIds = [...new Set(invs.map((i) => i.ownerId))];

    const [patients, owners] = await Promise.all([
      db.patients.where('id').anyOf(patientIds).toArray(),
      db.owners.where('id').anyOf(ownerIds).toArray(),
    ]);

    const patientMap = new Map<number, Patient>(patients.map((p) => [p.id!, p]));
    const ownerMap = new Map<number, Owner>(owners.map((o) => [o.id!, o]));

    return invs.map((inv) => ({
      ...inv,
      patient: patientMap.get(inv.patientId),
      owner: ownerMap.get(inv.ownerId),
    }));
  }, []);

  // ── Enriched Treatment Packages ─────────────────────────────
  const packages = useLiveQuery(async () => {
    const pkgs = await db.treatmentPackages.orderBy('lastUsedAt').reverse().limit(4).toArray();
    const pkgIds = pkgs.map((p) => p.id!).filter(Boolean);

    const items = await db.treatmentPackageItems.where('packageId').anyOf(pkgIds).toArray();
    const itemMap = new Map<number, TreatmentPackageItem[]>();
    items.forEach((it) => {
      const list = itemMap.get(it.packageId) || [];
      list.push(it);
      itemMap.set(it.packageId, list);
    });

    return pkgs.map((pkg) => ({
      ...pkg,
      items: itemMap.get(pkg.id!) || [],
    }));
  }, []);

  // ── Live Instant Formulary & MRN Search Query ────────────────
  const formularyResults = useLiveQuery(async () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const [medicines, patients] = await Promise.all([
      db.medicines.filter((m) =>
        Boolean(
          m.brandName.toLowerCase().includes(q) ||
          (m.genericName && m.genericName.toLowerCase().includes(q)) ||
          (m.category && m.category.toLowerCase().includes(q))
        )
      ).limit(6).toArray(),

      db.patients.filter((p) =>
        Boolean(
          p.name.toLowerCase().includes(q) ||
          (p.breed && p.breed.toLowerCase().includes(q)) ||
          (p.species && p.species.toLowerCase().includes(q)) ||
          (p.microchipNumber && p.microchipNumber.toLowerCase().includes(q)) ||
          (p.identificationRef && p.identificationRef.toLowerCase().includes(q)) ||
          (p.id && (`#can-${8800 + p.id}`.includes(q) || `#fel-${4200 + p.id}`.includes(q)))
        )
      ).limit(6).toArray(),
    ]);

    return { medicines, patients };
  }, [searchQuery]);

  // Close search popover on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (formularySearchRef.current && !formularySearchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  // ── Share Invoice Handler ────────────────────────────────────
  const handleShareInvoice = async (inv: Invoice & { patient?: Patient; owner?: Owner }) => {
    const invUrl = `${window.location.origin}/invoices/${inv.id}`;
    const shareData = {
      title: `Tax Invoice ${inv.invoiceNumber}`,
      text: `VetRx Tax Invoice ${inv.invoiceNumber}${inv.patient?.name ? ` for ${inv.patient.name}` : ''} - Total: ${fmtRupees(inv.grandTotal)}`,
      url: invUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Fallback for desktop / unsupported browsers: open ShareModal
    setShareInvoice(inv);
  };

  const isClinicActive = Boolean(organisation && organisation.isActive !== false && organisation.name?.trim());
  const doctorName = practitioner?.name?.trim() || 'Veterinarian';
  const firstName = doctorName.split(' ').find((w) => !w.startsWith('Dr')) ?? 'Doctor';
  const clinicName = isClinicActive ? organisation!.name : 'Independent Clinical Practice';

  return (
    <div className="dashboard-page">
      {/* ── MOBILE CONTEXT GREETING (Visible on small screens) ── */}
      <div className="mobile-context-bar">
        <div className="mobile-context-meta">
          <span className="mobile-context-tag">Clinical Workspace</span>
          <span className="badge badge-active-shift">
            <span className="pulse-dot" />
            Active Session
          </span>
        </div>
        <h1 className="mobile-greeting">
          {greeting()}, {firstName}
        </h1>
        <p className="mobile-sub">
          {clinicName} • Clinical Station
        </p>
      </div>

      {/* ── TOP GREETING, STATUS BAR & FAST-KEY SHORTCUTS ─────── */}
      <div className="dashboard-header-bar">
        <div className="dashboard-header-left">
          <div className="dashboard-status-strip">
            {/* Real Offline-First status, NOT fake cloud sync */}
            <span className="status-badge-local">
              <span className="status-dot-solid" />
              Local Database (Offline-First)
            </span>
            <span className="status-badge-doctor">
              <Icon name="verified" size={13} className="text-secondary" />
              {doctorName}
            </span>
          </div>
          <h1 className="dashboard-headline">Clinical Command Desk</h1>
          <p className="dashboard-subheadline">
            {clinicName}
          </p>
        </div>

        {/* Quick Fast-Key Bar */}
        <div className="dashboard-fastkeys-bar">
          <div className="fastkey-item">
            <Icon name="keyboard" size={16} className="text-primary" />
            <span>New Rx: <kbd className="fastkey-kbd">Alt+N</kbd></span>
          </div>
          <div className="fastkey-item">
            <Icon name="search" size={16} className="text-secondary" />
            <span>Drug Search: <kbd className="fastkey-kbd">Alt+F</kbd></span>
          </div>
        </div>
      </div>

      {/* ── TOP HERO & CLINICAL ACTION SECTION (Gradient Ribbon) ─ */}
      <div className="hero-action-hub">
        <div className="hero-mesh-glow" aria-hidden="true" />
        <div className="hero-vector-lines" aria-hidden="true">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="100" cy="100" r="80" stroke="currentColor" strokeDasharray="6 6" strokeWidth="2.5" />
            <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1.5" />
            <path d="M100 20 L100 180 M20 100 L180 100" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="hero-inner">
          <div className="hero-copy-group">
            <div className="hero-kicker-badge">
              <Icon name="bolt" size={14} />
              <span>For your Govt Approved Private Practice</span>
            </div>
            <h2 className="hero-title-main">
              Clinical Prescription • Invoices • Receipts
            </h2>
            <p className="hero-desc-main">
              Generate electronic veterinary prescriptions with invoices and receipts for all your govt approved private practice needs based on private practice norms
            </p>
          </div>

          <div className="hero-buttons-row">
            <Link to="/prescriptions/new" className="btn-hero-white">
              <Icon name="plus" size={18} />
              <span>New Prescription</span>
            </Link>
            <Link to="/patients/new" className="btn-hero-glass">
              <span className="dot-secondary" />
              <span>New Patient</span>
            </Link>
            <Link to="/invoices/new" className="btn-hero-glass">
              <span className="dot-tertiary" />
              <span>New Invoice</span>
            </Link>
            <Link to="/packages" className="btn-hero-glass">
              <Icon name="packages" size={16} />
              <span>Browse Packages</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── CLINICAL WORKFLOW STEPPER STRIP ─────────────────── */}
      <div className="protocol-stepper-card">
        <div className="protocol-stepper-header">
          <div className="protocol-title-group">
            <Icon name="route" size={18} className="text-primary" />
            <span className="protocol-title">Standard Protocol Workflow</span>
          </div>
          <span className="protocol-badge data-mono">Validated ISO/DISPENSE Compliant</span>
        </div>

        <div className="protocol-steps-grid">
          <div className="protocol-step active-step">
            <span className="step-num">1</span>
            <div className="step-text">
              <span className="step-label">Patient</span>
            </div>
          </div>
          <div className="protocol-step">
            <span className="step-num">2</span>
            <div className="step-text">
              <span className="step-label">Symptoms</span>
            </div>
          </div>
          <div className="protocol-step">
            <span className="step-num">3</span>
            <div className="step-text">
              <span className="step-label">Diagnosis</span>
            </div>
          </div>
          <div className="protocol-step">
            <span className="step-num">4</span>
            <div className="step-text">
              <span className="step-label">Formulary</span>
            </div>
          </div>
          <div className="protocol-step">
            <span className="step-num">5</span>
            <div className="step-text">
              <span className="step-label">SIG Notes</span>
            </div>
          </div>
          <div className="protocol-step">
            <span className="step-num">6</span>
            <div className="step-text">
              <span className="step-label">Save &amp; Issue</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3D PASTEL KPI METRIC CARDS (Matches Stitch) ─────── */}
      <div className="pastel-kpi-grid">
        {/* KPI 1: Today's Prescriptions (Pastel Mint / Emerald 3D) */}
        <div
          className="kpi-card kpi-card-emerald"
          onClick={() => navigate('/prescriptions')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-card-top">
            <div className="kpi-header-row">
              <span className="kpi-title text-emerald-title">Today's Prescriptions</span>
              <div className="kpi-tactile-icon icon-emerald">
                <Icon name="prescription" size={24} />
              </div>
            </div>
            <div className="kpi-num-row">
              <span className="kpi-num text-emerald-num data-mono">{rxCount ?? '—'}</span>
              <span className="kpi-chip chip-emerald">
                <Icon name="check-circle" size={11} />
                Issued
              </span>
            </div>
            <p className="kpi-note text-emerald-note">Live clinical dispensing records</p>
          </div>

          <div className="kpi-card-footer footer-emerald">
            <span className="kpi-footer-text">
              <span className="kpi-dot-emerald" />
              {rxCount ?? 0} Recorded • Active Shift
            </span>
            <Icon name="arrow-right" size={15} className="kpi-arrow text-emerald-title" />
          </div>
        </div>

        {/* KPI 2: Active Patients (Pastel Soft Lavender / Purple 3D) */}
        <div
          className="kpi-card kpi-card-purple"
          onClick={() => navigate('/patients')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-card-top">
            <div className="kpi-header-row">
              <span className="kpi-title text-purple-title">Total Patients</span>
              <div className="kpi-tactile-icon icon-purple">
                <Icon name="patients" size={24} />
              </div>
            </div>
            <div className="kpi-num-row">
              <span className="kpi-num text-purple-num data-mono">{patientCount ?? '—'}</span>
              <span className="kpi-chip chip-purple">
                <Icon name="paw" size={11} />
                Active
              </span>
            </div>
            <p className="kpi-note text-purple-note">Canine, Feline &amp; Specialty cases</p>
          </div>

          <div className="kpi-card-footer footer-purple">
            <span className="kpi-footer-text">
              <span className="kpi-dot-purple" />
              {patientCount ?? 0} Registered Patient Charts
            </span>
            <Icon name="arrow-right" size={15} className="kpi-arrow text-purple-title" />
          </div>
        </div>

        {/* KPI 3: Treatment Packages (Pastel Sky Blue 3D) */}
        <div
          className="kpi-card kpi-card-sky"
          onClick={() => navigate('/packages')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-card-top">
            <div className="kpi-header-row">
              <span className="kpi-title text-sky-title">Treatment Packages</span>
              <div className="kpi-tactile-icon icon-sky">
                <Icon name="packages" size={24} />
              </div>
            </div>
            <div className="kpi-num-row">
              <span className="kpi-num text-sky-num data-mono">{pkgCount ?? '—'}</span>
              <span className="kpi-chip chip-sky">
                <Icon name="verified" size={11} />
                Ready
              </span>
            </div>
            <p className="kpi-note text-sky-note">Pre-calibrated dosage templates</p>
          </div>

          <div className="kpi-card-footer footer-sky">
            <span className="kpi-footer-text">
              <span className="kpi-dot-sky" />
              Otitis, Gastro, Skin, Deworming
            </span>
            <Icon name="arrow-right" size={15} className="kpi-arrow text-sky-title" />
          </div>
        </div>

        {/* KPI 4: Recent Invoices (Pastel Rose / Coral 3D) */}
        <div
          className="kpi-card kpi-card-rose"
          onClick={() => navigate('/invoices')}
          role="button"
          tabIndex={0}
        >
          <div className="kpi-card-top">
            <div className="kpi-header-row">
              <span className="kpi-title text-rose-title">Recent Invoices</span>
              <div className="kpi-tactile-icon icon-rose">
                <Icon name="invoices" size={24} />
              </div>
            </div>
            <div className="kpi-num-row">
              <span className="kpi-num text-rose-num data-mono">{invCount ?? '—'}</span>
              <span className="kpi-chip chip-rose">
                <Icon name="description" size={11} />
                Documents
              </span>
            </div>
            <p className="kpi-note text-rose-note">Itemized clinical tax records</p>
          </div>

          <div className="kpi-card-footer footer-rose">
            <span className="kpi-footer-text">
              <span className="kpi-dot-rose" />
              {invCount ?? 0} Finalized Documents
            </span>
            <Icon name="arrow-right" size={15} className="kpi-arrow text-rose-title" />
          </div>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN CLINICAL GRID (8 cols / 4 cols) ────── */}
      <div className="dashboard-main-grid">
        {/* =================================================== */}
        {/* LEFT COLUMN: PRESCRIPTIONS & INVOICE LEDGER (8 cols) */}
        {/* =================================================== */}
        <div className="dashboard-left-col">
          {/* SECTION: RECENT PRESCRIPTIONS CARD */}
          <div className="card dashboard-section-card">
            <div className="section-card-header">
              <div className="section-header-title-group">
                <div className="section-header-icon-wrap icon-wrap-teal">
                  <Icon name="history" size={18} />
                </div>
                <div>
                  <h3 className="section-title">Recent Prescriptions</h3>
                  <span className="section-subtitle">Live feed of dispensed electronic treatment protocols</span>
                </div>
              </div>
              <Link to="/prescriptions" className="section-view-all-link">
                <span>View All Records →</span>
              </Link>
            </div>

            <div className="rx-list-container">
              {recentRx?.length === 0 && (
                <div className="empty-state">
                  <Icon name="prescription" size={32} />
                  <span>No prescriptions recorded yet</span>
                </div>
              )}
              {recentRx?.map((rx) => {
                const ownerName = formatOwnerPrimary(rx.owner, 'Walk-in Client');
                const animalSubtitle = formatAnimalSubtitle(rx.patient);
                const isCat = rx.patient?.species === 'Feline';

                return (
                  <div key={rx.id} className="rx-item-row">
                    <div className="rx-item-left">
                      <div className={`pet-avatar-wrap ${isCat ? 'pet-avatar-cat' : 'pet-avatar-dog'}`}>
                        <Icon name={isCat ? 'cruelty-free' : 'paw'} size={20} />
                        <span className={`pet-species-indicator ${isCat ? 'species-f' : 'species-d'}`}>
                          {isCat ? 'F' : 'D'}
                        </span>
                      </div>
                      <div className="rx-item-info">
                        <div className="rx-patient-headline">
                          <span className="owner-name-primary">{ownerName}</span>
                          {rx.owner?.phone && <span className="owner-phone-sub">({rx.owner.phone})</span>}
                        </div>
                        <div className="rx-item-subline">
                          {animalSubtitle && <span className="animal-details-sub">{animalSubtitle}</span>}
                          {animalSubtitle && <span className="meta-bullet">•</span>}
                          <span className="rx-number-tag data-mono">{rx.rxNumber}</span>
                          <span className="meta-bullet">•</span>
                          <span>{timeAgo(rx.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rx-item-right">
                      <div className="rx-status-meta">
                        <span className={`badge-pill badge-pill-${rx.status?.toLowerCase() || 'issued'}`}>
                          <span className="badge-pill-dot" />
                          {rx.status || 'Issued'}
                        </span>
                        <span className="rx-time-sub data-mono">{timeAgo(rx.createdAt)}</span>
                      </div>
                      <div className="rx-action-buttons">
                        <button
                          type="button"
                          className="btn-action-small"
                          title="View Prescription"
                          onClick={() => navigate(`/prescriptions/${rx.id}`)}
                        >
                          <Icon name="eye" size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn-action-small"
                          title="Print Prescription"
                          onClick={() => navigate(`/prescriptions/${rx.id}?print=true`)}
                        >
                          <Icon name="print" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION: RECENT INVOICES (CLINICAL BILLING DOCUMENTS) */}
          <div className="card dashboard-section-card">
            <div className="section-card-header">
              <div className="section-header-title-group">
                <div className="section-header-icon-wrap icon-wrap-rose">
                  <Icon name="receipt" size={18} />
                </div>
                <div>
                  <h3 className="section-title">Recent Invoices</h3>
                  <span className="section-subtitle">Formal itemized clinical fee &amp; dispensing billing documents</span>
                </div>
              </div>
              <Link to="/invoices" className="section-view-all-link">
                <span>View All Documents →</span>
              </Link>
            </div>

            <div className="inv-grid-container">
              {recentInv?.length === 0 && (
                <div className="empty-state">
                  <Icon name="invoices" size={32} />
                  <span>No invoices generated yet</span>
                </div>
              )}
              {recentInv?.map((inv) => {
                const ownerName = formatOwnerPrimary(inv.owner, 'Direct Client');
                const animalSubtitle = formatAnimalSubtitle(inv.patient);

                return (
                  <div key={inv.id} className="inv-card-box">
                    <div className="inv-card-box-top">
                      <div className="inv-header-strip">
                        <span className="inv-badge-mono data-mono">{inv.invoiceNumber}</span>
                        <span className={`badge-pill badge-pill-${inv.status?.toLowerCase() || 'issued'}`}>
                          {inv.status || 'Issued'}
                        </span>
                      </div>
                      <div className="inv-patient-block">
                        <span className="inv-owner-primary truncate">{ownerName}</span>
                        <span className="inv-animal-sub truncate">{animalSubtitle}</span>
                      </div>
                    </div>

                    <div className="inv-card-box-bottom">
                      <span className="inv-total-sum data-mono">{fmtRupees(inv.grandTotal)}</span>
                      <div className="inv-action-row">
                        <button
                          type="button"
                          className="btn-inv-action btn-inv-view"
                          onClick={() => navigate(`/invoices/${inv.id}`)}
                          title="View Invoice"
                          aria-label={`View invoice ${inv.invoiceNumber}`}
                        >
                          <Icon name="eye" size={12} />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          className="btn-inv-action btn-inv-print"
                          onClick={() => navigate(`/invoices/${inv.id}?print=true`)}
                          title="Print Invoice"
                          aria-label={`Print invoice ${inv.invoiceNumber}`}
                        >
                          <Icon name="print" size={12} />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          className="btn-inv-action btn-inv-share"
                          onClick={() => handleShareInvoice(inv)}
                          title="Share Invoice Document"
                          aria-label={`Share invoice ${inv.invoiceNumber}`}
                        >
                          <Icon name="share" size={12} />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* =================================================== */}
        {/* RIGHT COLUMN: CLINICAL PACKAGES & FORMULARY (4 cols) */}
        {/* =================================================== */}
        <div className="dashboard-right-col">
          {/* FAST FORMULARY & MRN SEARCH WIDGET */}
          <div className="card formulary-widget-card" ref={formularySearchRef}>
            <div className="formulary-widget-header">
              <div className="flex-center gap-xs">
                <Icon name="search" size={18} className="text-primary" />
                <h3 className="formulary-widget-title">Instant Formulary &amp; MRN</h3>
              </div>
              <span className="formulary-search-kbd data-mono">Alt+F</span>
            </div>

            <div className="formulary-input-relative">
              <Icon name="pill" size={16} className="formulary-icon-inside" />
              <input
                id="dashboard-formulary-search"
                type="text"
                className="formulary-search-field"
                placeholder="Lookup drug (e.g. Apoquel, Meloxicam) or MRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                autoComplete="off"
              />

              {/* Formulary Search Live Results Popover */}
              {isSearchFocused && searchQuery.trim().length >= 1 && formularyResults && (
                <div className="formulary-popover-dropdown">
                  {(!formularyResults.medicines.length && !formularyResults.patients.length) ? (
                    <div className="formulary-popover-empty">
                      <span>No matching drugs or patients for "{searchQuery}"</span>
                    </div>
                  ) : (
                    <div className="formulary-popover-scroll">
                      {formularyResults.medicines.length > 0 && (
                        <div className="formulary-popover-section">
                          <span className="formulary-sec-title">Medicines</span>
                          {formularyResults.medicines.map((m: Medicine) => (
                            <button
                              key={m.id}
                              type="button"
                              className="formulary-popover-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                navigate(`/medicines?search=${encodeURIComponent(m.brandName)}`);
                                setIsSearchFocused(false);
                              }}
                            >
                              <Icon name="pill" size={15} className="text-primary" />
                              <div className="formulary-item-texts">
                                <span className="formulary-item-title">{m.brandName}</span>
                                <span className="formulary-item-sub">
                                  {m.genericName ? `${m.genericName} • ` : ''}{m.category || m.presentation}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {formularyResults.patients.length > 0 && (
                        <div className="formulary-popover-section">
                          <span className="formulary-sec-title">Patients &amp; MRN</span>
                          {formularyResults.patients.map((p: Patient) => (
                            <button
                              key={p.id}
                              type="button"
                              className="formulary-popover-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                navigate(`/patients/${p.id}`);
                                setIsSearchFocused(false);
                              }}
                            >
                              <Icon name="paw" size={15} className="text-secondary" />
                              <div className="formulary-item-texts">
                                <span className="formulary-item-title">{p.name}</span>
                                <span className="formulary-item-sub">
                                  {p.species} {p.breed ? `• ${p.breed}` : ''} {p.identificationRef || (p.id ? `#CAN-${8800 + p.id}` : '')}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Category Filters */}
            <div className="formulary-category-pills">
              <button
                type="button"
                className="cat-pill cat-pill-primary"
                onClick={() => setSearchQuery('Antibiotic')}
              >
                Antibiotics
              </button>
              <button
                type="button"
                className="cat-pill"
                onClick={() => setSearchQuery('NSAID')}
              >
                NSAIDs
              </button>
              <button
                type="button"
                className="cat-pill"
                onClick={() => setSearchQuery('Dermatology')}
              >
                Dermatology
              </button>
              <button
                type="button"
                className="cat-pill"
                onClick={() => setSearchQuery('Gastro')}
              >
                Gastro
              </button>
              <button
                type="button"
                className="cat-pill"
                onClick={() => setSearchQuery('Sedation')}
              >
                Sedation
              </button>
            </div>
          </div>

          {/* TREATMENT PACKAGES QUICK-LAUNCH WIDGET */}
          <div className="card dashboard-section-card">
            <div className="section-card-header">
              <div className="flex-center gap-xs">
                <Icon name="packages" size={18} className="text-primary" />
                <h3 className="section-title">Treatment Packages</h3>
              </div>
              <div className="pkg-header-actions">
                <Link to="/packages/new" className="btn-pkg-new" title="Create New Package">
                  <Icon name="plus" size={12} />
                  <span>New</span>
                </Link>
              </div>
            </div>

            <div className="pkg-list-container">
              {packages?.map((pkg) => {
                const medNames = pkg.items?.map((it) => it.brandName.split(' ')[0]).slice(0, 3).join(', ');
                const medCount = pkg.items?.length || 0;
                const desc = medCount > 0 ? `${medCount} medicines (${medNames}...)` : pkg.description || 'Custom prescription template';

                return (
                  <div key={pkg.id} className="pkg-item-box">
                    <div className="pkg-item-left min-w-0">
                      <span className="pkg-title truncate">{pkg.name}</span>
                      <span className="pkg-subline truncate">{desc}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-use-pkg-stitch"
                      onClick={() => navigate(`/prescriptions/new?packageId=${pkg.id}`)}
                    >
                      Use
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Share Document Dialog Fallback */}
      {shareInvoice && (
        <ShareModal
          isOpen={true}
          onClose={() => setShareInvoice(null)}
          documentTitle="Invoice"
          documentNumber={shareInvoice.invoiceNumber}
          documentUrl={`${window.location.origin}/invoices/${shareInvoice.id}`}
          patientName={shareInvoice.patient?.name}
          ownerName={shareInvoice.owner?.name}
          grandTotalPaisa={shareInvoice.grandTotal}
        />
      )}
    </div>
  );
};
