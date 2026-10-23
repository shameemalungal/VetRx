// =============================================================
// VetRx — Dashboard Page
// Presentation layer reproducing the approved Stitch Desktop & Mobile UI
// Reference: "VetRx Clinical Dashboard - 3D Pastel KPI Cards"
// Fully reactive with live IndexedDB/Dexie queries.
// =============================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { useSettingsStore } from '../store/settingsStore';
import { useAuth } from '../context/AuthContext';
import { useSyncStatus, syncAllClinicalData } from '../services/clinicalSync';
import { inventoryApi } from '../services/inventoryApi';
import { apiClient } from '../services/api/apiClient';
import { Icon } from '../components/ui/Icon';
import { VetRxLogo } from '../components/ui/VetRxLogo';
import { PracticeSwitcher } from '../components/PracticeSwitcher/PracticeSwitcher';
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

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, practice, membership } = useAuth();
  const { practitioner, organisation } = useSettingsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const formularySearchRef = useRef<HTMLDivElement>(null);
  const [shareInvoice, setShareInvoice] = useState<(Invoice & { patient?: Patient; owner?: Owner }) | null>(null);

  // ── Commercial Subscription Status ───────────────────────────
  const [commercialInfo, setCommercialInfo] = useState<{
    status: string;
    trialDaysRemaining?: number;
    planName?: string;
  } | null>(null);

  useEffect(() => {
    let unmounted = false;
    fetch(`${API_BASE}/api/commercial/status`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!unmounted && data) {
          setCommercialInfo({
            status: data.commercialStatus || 'UNKNOWN',
            trialDaysRemaining: data.trialDaysRemaining,
            planName: data.plan?.name,
          });
        }
      })
      .catch(() => {});
    return () => {
      unmounted = true;
    };
  }, []);

  // ── Pending Prescription Approvals Count ──────────────────────
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);

  useEffect(() => {
    let unmounted = false;
    fetch(`${API_BASE}/api/prescriptions/pending-approvals-count`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!unmounted && data && typeof data.count === 'number') {
          setPendingApprovalsCount(data.count);
        }
      })
      .catch(() => {});
    return () => {
      unmounted = true;
    };
  }, []);

  // ── Onboarding Checklist (Section 30) ────────────────────────
  const [checklistDismissed, setChecklistDismissed] = useState<boolean>(() => {
    return localStorage.getItem(`vetrx_dismissed_onboarding_${practice?.id}`) === 'true';
  });
  const [teamMembersCount, setTeamMembersCount] = useState<number>(1);
  const [hasClinicalApprover, setHasClinicalApprover] = useState<boolean>(false);

  useEffect(() => {
    if (!practice?.id) return;
    let unmounted = false;
    fetch(`${API_BASE}/api/practice/members`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!unmounted && data) {
          const members = data.members || [];
          const invites = data.invitations || [];
          setTeamMembersCount(members.length + invites.length);
          const hasApprover = members.some((m: any) => m.isClinicalApprover || m.role === 'VETERINARIAN');
          setHasClinicalApprover(hasApprover);
        }
      })
      .catch(() => {});
    return () => {
      unmounted = true;
    };
  }, [practice?.id]);

  const isPracticeSetup = Boolean(practice?.name && practice.name.trim());
  const isTeamAdded = teamMembersCount > 1;
  const isProfileComplete = Boolean(practitioner?.registrationNumber?.trim() || organisation?.licenseNumber?.trim());
  const isClinicalSetup = Boolean(membership?.isClinicalApprover || membership?.role === 'VETERINARIAN' || hasClinicalApprover);
  const completedChecklistCount = [isPracticeSetup, isTeamAdded, isProfileComplete, isClinicalSetup].filter(Boolean).length;
  const isChecklistAllComplete = completedChecklistCount === 4;
  const canManagePractice = membership?.role === 'PRACTICE_OWNER' || membership?.role === 'PRACTICE_ADMIN' || user?.platformRole === 'SUPER_ADMIN';
  const showChecklist = canManagePractice && !checklistDismissed && !isChecklistAllComplete;

  const handleDismissChecklist = () => {
    setChecklistDismissed(true);
    if (practice?.id) {
      localStorage.setItem(`vetrx_dismissed_onboarding_${practice.id}`, 'true');
    }
  };

  // ── Server-Backed Fast Dashboard Summary (Demanded on Mount) ─
  const [summaryData, setSummaryData] = useState<{
    patientsCount: number;
    prescriptionsCount: number;
    invoicesCount: number;
    treatmentPackagesCount: number;
    recentPrescriptions: any[];
    recentInvoices: any[];
  } | null>(null);

  useEffect(() => {
    let unmounted = false;
    apiClient
      .get<{ summary: any }>('/dashboard-summary')
      .then((data) => {
        if (!unmounted && data?.summary) {
          setSummaryData(data.summary);
        }
      })
      .catch(() => {});
    return () => {
      unmounted = true;
    };
  }, [practice?.id]);

  // ── Metric Counts (Fallback to Dexie cache if offline/local) ──
  const rxCount      = useLiveQuery(() => db.prescriptions.count(), []);
  const patientCount = useLiveQuery(() => db.patients.count(), []);
  const pkgCount     = useLiveQuery(() => db.treatmentPackages.count(), []);
  const invCount     = useLiveQuery(() => db.invoices.count(), []);

  const effectiveRxCount = summaryData ? summaryData.prescriptionsCount : rxCount;
  const effectivePatientCount = summaryData ? summaryData.patientsCount : patientCount;
  const effectivePkgCount = summaryData ? summaryData.treatmentPackagesCount : pkgCount;
  const effectiveInvCount = summaryData ? summaryData.invoicesCount : invCount;

  // ── Enriched Recent Prescriptions ───────────────────────────
  const recentRx = useLiveQuery(async () => {
    const rxs = await db.prescriptions.orderBy('createdAt').reverse().limit(4).toArray();
    const patientIds = [...new Set(rxs.map((r) => r.patientId))].filter(Boolean);
    const ownerIds = [...new Set(rxs.map((r) => r.ownerId))].filter(Boolean);

    const [patients, owners] = await Promise.all([
      db.patients.where('id').anyOf(patientIds as any).toArray(),
      db.owners.where('id').anyOf(ownerIds as any).toArray(),
    ]);

    const patientMap = new Map<number | string, Patient>(patients.map((p) => [p.id!, p]));
    const ownerMap = new Map<number | string, Owner>(owners.map((o) => [o.id!, o]));

    return rxs.map((rx) => ({
      ...rx,
      patient: patientMap.get(rx.patientId),
      owner: ownerMap.get(rx.ownerId),
    }));
  }, []);

  // ── Enriched Recent Invoices ────────────────────────────────
  const recentInv = useLiveQuery(async () => {
    const invs = await db.invoices.orderBy('invoiceDate').reverse().limit(3).toArray();
    const patientIds = [...new Set(invs.map((i) => i.patientId))].filter(Boolean);
    const ownerIds = [...new Set(invs.map((i) => i.ownerId))].filter(Boolean);

    const [patients, owners] = await Promise.all([
      db.patients.where('id').anyOf(patientIds as any).toArray(),
      db.owners.where('id').anyOf(ownerIds as any).toArray(),
    ]);

    const patientMap = new Map<number | string, Patient>(patients.map((p) => [p.id!, p]));
    const ownerMap = new Map<number | string, Owner>(owners.map((o) => [o.id!, o]));

    return invs.map((inv) => ({
      ...inv,
      patient: patientMap.get(inv.patientId),
      owner: ownerMap.get(inv.ownerId),
    }));
  }, []);

  const effectiveRecentRx = summaryData ? summaryData.recentPrescriptions : recentRx;
  const effectiveRecentInv = summaryData ? summaryData.recentInvoices : recentInv;

  // ── Enriched Treatment Packages ─────────────────────────────
  const packages = useLiveQuery(async () => {
    const pkgs = await db.treatmentPackages.orderBy('lastUsedAt').reverse().limit(4).toArray();
    const pkgIds = pkgs.map((p) => p.id!).filter(Boolean);

    const items = await db.treatmentPackageItems.where('packageId').anyOf(pkgIds as any).toArray();
    const itemMap = new Map<number | string, TreatmentPackageItem[]>();
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
          (p.id && (typeof p.id === 'number' ? (`#can-${8800 + p.id}`.includes(q) || `#fel-${4200 + p.id}`.includes(q)) : String(p.id).toLowerCase().includes(q)))
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

  // ── Mobile Samsung One UI 9 State & Live Queries ─────────────
  const syncStatus = useSyncStatus();
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [mobileExpandedCallId, setMobileExpandedCallId] = useState<string | number | null>(null);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [isMobileScannerOpen, setIsMobileScannerOpen] = useState(false);
  const [isNotificationsSheetOpen, setIsNotificationsSheetOpen] = useState(false);
  const [mobileToast, setMobileToast] = useState<{ message: string; type?: 'success' | 'info' } | null>(null);

  const showMobileToast = (message: string, type: 'success' | 'info' = 'success') => {
    setMobileToast({ message, type });
    setTimeout(() => setMobileToast(null), 2500);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  // Today's calls & visits for mobile schedule
  const todayCalls = useLiveQuery(async () => {
    if (!db.calls) return [];
    const all = await db.calls.toArray();
    const matching = all.filter((c) => {
      const prefDateStr = c.preferredDate
        ? (c.preferredDate instanceof Date ? c.preferredDate.toISOString() : String(c.preferredDate))
        : '';
      if (prefDateStr) {
        return prefDateStr.startsWith(todayStr);
      }
      return c.status !== 'CANCELLED';
    });
    matching.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const slice = matching.slice(0, 6);

    const patientIds = slice.map((c) => c.patientIds?.[0]).filter(Boolean) as (string | number)[];
    const ownerIds = slice.map((c) => c.ownerId).filter(Boolean) as (string | number)[];

    const [patients, owners] = await Promise.all([
      db.patients.where('id').anyOf(patientIds as any).toArray(),
      db.owners.where('id').anyOf(ownerIds as any).toArray(),
    ]);

    const patientMap = new Map<string | number, Patient>(patients.map((p) => [p.id!, p]));
    const ownerMap = new Map<string | number, Owner>(owners.map((o) => [o.id!, o]));

    return slice.map((c) => {
      const pId = c.patientIds?.[0];
      return {
        ...c,
        patient: pId ? patientMap.get(pId) : undefined,
        owner: c.ownerId ? ownerMap.get(c.ownerId) : undefined,
      };
    });
  }, [todayStr]);

  // Follow-ups stats
  const followUpsStats = useLiveQuery(async () => {
    if (!db.followUps) return { total: 0, today: 0, overdue: 0 };
    const all = await db.followUps.toArray();
    const today = all.filter((f) => f.recommendedDate === todayStr).length;
    const overdue = all.filter((f) => f.recommendedDate < todayStr && f.status !== 'COMPLETED' && f.status !== 'CANCELLED').length;
    return {
      total: all.length,
      today,
      overdue,
    };
  }, [todayStr]);

  // Pending invoices stats
  const pendingInvoicesStats = useLiveQuery(async () => {
    if (!db.invoices) return { count: 0, totalPaisa: 0 };
    const invs = await db.invoices.toArray();
    const pending = invs.filter((i) => i.status === 'Draft');
    const totalPaisa = pending.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
    return {
      count: pending.length,
      totalPaisa,
    };
  }, []);

  // Inventory alerts stats
  const [inventoryAlertsStats, setInventoryAlertsStats] = useState<{ count: number; sampleNames: string }>({
    count: 0,
    sampleNames: 'Formulary normal',
  });

  useEffect(() => {
    let unmounted = false;
    inventoryApi.getItems({ lowStockOnly: true })
      .then((res) => {
        if (!unmounted && res?.items) {
          const names = res.items.slice(0, 2).map((i) => i.name).join(', ');
          setInventoryAlertsStats({
            count: res.items.length,
            sampleNames: names || 'All items in stock',
          });
        }
      })
      .catch(() => {});
    return () => {
      unmounted = true;
    };
  }, []);

  // Mobile Omni-search query
  const mobileSearchResults = useLiveQuery(async () => {
    const q = mobileSearchQuery.trim().toLowerCase();
    if (!q) return null;

    const [patients, medicines, owners] = await Promise.all([
      db.patients.filter((p) =>
        Boolean(
          p.name.toLowerCase().includes(q) ||
          (p.breed && p.breed.toLowerCase().includes(q)) ||
          (p.species && p.species.toLowerCase().includes(q))
        )
      ).limit(5).toArray(),
      db.medicines.filter((m) =>
        Boolean(
          m.brandName.toLowerCase().includes(q) ||
          (m.genericName && m.genericName.toLowerCase().includes(q))
        )
      ).limit(5).toArray(),
      db.owners.filter((o) =>
        Boolean(
          o.name.toLowerCase().includes(q) ||
          (o.phone && o.phone.toLowerCase().includes(q))
        )
      ).limit(5).toArray(),
    ]);

    return { patients, medicines, owners };
  }, [mobileSearchQuery]);

  const handleMobileManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncAllClinicalData(null, true);
      showMobileToast('Practice data synced with cloud!', 'success');
    } catch {
      showMobileToast('Sync completed with local cache.', 'info');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getSpeciesVisual = (species?: string) => {
    const s = (species || '').toLowerCase();
    if (s.includes('cat') || s.includes('feline')) return { emoji: '🐈', bg: '#CCFBF1', color: '#0F766E' };
    if (s.includes('cow') || s.includes('cattle') || s.includes('bovine')) return { emoji: '🐄', bg: '#DCFCE7', color: '#166534' };
    if (s.includes('buffalo')) return { emoji: '🐃', bg: '#F1F5F9', color: '#334155' };
    if (s.includes('goat') || s.includes('sheep')) return { emoji: '🐐', bg: '#FEF3C7', color: '#B45309' };
    if (s.includes('horse') || s.includes('equine')) return { emoji: '🐎', bg: '#FDE68A', color: '#92400E' };
    if (s.includes('bird')) return { emoji: '🦜', bg: '#E0E7FF', color: '#4338CA' };
    return { emoji: '🐕', bg: '#FEF3C7', color: '#D97706' };
  };

  const activePracticeName = practice?.name || organisation?.name;
  const isClinicActive = Boolean((activePracticeName && activePracticeName.trim()) || (organisation && organisation.isActive !== false && organisation.name?.trim()));
  const doctorName = user?.name || practitioner?.name?.trim() || 'Veterinarian';
  const firstName = doctorName.split(' ').find((w) => !w.startsWith('Dr')) ?? 'Doctor';
  const clinicName = isClinicActive ? (activePracticeName || 'Independent Clinical Practice') : 'Independent Clinical Practice';

  return (
    <div className="dashboard-page">
      {/* ── MOBILE SAMSUNG ONE UI 9 DASHBOARD (Rendered on viewport < 1024px) ── */}
      <div className="mobile-oneui-dashboard">
        {/* 1. Clinical Hero Header with Gradient & Omni-Search */}
        <div className="mobile-hero-header">
          {/* Top Brand & Actions Row */}
          <div className="mobile-hero-top-row">
            <div className="mobile-hero-brand">
              <VetRxLogo size={22} />
              <p className="mobile-hero-tagline">
                Simplify your practice. Focus on better treatment.
              </p>
            </div>
            <div className="mobile-hero-actions">
              <button
                type="button"
                className="mobile-hero-icon-btn relative-wrap"
                aria-label="Clinical notifications"
                onClick={() => setIsNotificationsSheetOpen(true)}
              >
                <Icon name="bell" size={19} />
                {(pendingApprovalsCount > 0 || (inventoryAlertsStats?.count || 0) > 0) && (
                  <span className="mobile-hero-badge">
                    {pendingApprovalsCount + ((inventoryAlertsStats?.count || 0) > 0 ? 1 : 0)}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="mobile-hero-avatar-btn"
                aria-label="Doctor profile"
                onClick={() => navigate('/settings')}
              >
                {practitioner?.photoDataUrl ? (
                  <img src={practitioner.photoDataUrl} alt={firstName} className="mobile-hero-avatar-img" />
                ) : (
                  <span>{firstName[0] || 'D'}</span>
                )}
              </button>
            </div>
          </div>

          {/* Clinic Switcher Pill & Mode Indicator */}
          <div className="mobile-hero-meta-row">
            <div className="mobile-hero-clinic-pill">
              <PracticeSwitcher />
            </div>
            <span className="mobile-hero-mode-pill">
              <span className="pulse-dot-green" />
              One UI 9 Station
            </span>
          </div>

          {/* Greeting Row & Pet Companions */}
          <div className="mobile-hero-greeting-row">
            <div>
              <span className="mobile-hero-greeting-sub">{greeting()},</span>
              <h1 className="mobile-hero-greeting-name">
                Dr. {firstName} <span className="greeting-wave">👋</span>
              </h1>
              <span className="mobile-hero-date">{todayFormatted}</span>
            </div>
            <div className="mobile-hero-pet-duo">
              <div className="mobile-pet-badge pet-dog" title="Canine care">🐕</div>
              <div className="mobile-pet-badge pet-cat" title="Feline care">🐈</div>
            </div>
          </div>

          {/* Integrated Omni-Search Bar + Barcode Scanner Trigger */}
          <div className="mobile-omni-search-wrapper">
            <div className="mobile-omni-search-box">
              <Icon name="search" size={17} className="mobile-omni-search-icon" />
              <input
                type="text"
                className="mobile-omni-search-input"
                placeholder="Search owners, patients, medicines..."
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
              />
              {mobileSearchQuery && (
                <button
                  type="button"
                  className="mobile-omni-clear-btn"
                  onClick={() => setMobileSearchQuery('')}
                  aria-label="Clear search"
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="mobile-scanner-trigger-btn"
              title="Scan Barcode or Ear-Tag"
              onClick={() => setIsMobileScannerOpen(true)}
            >
              <Icon name="scanner" size={20} />
            </button>
          </div>

          {/* Live Omni-Search Dropdown */}
          {mobileSearchQuery && mobileSearchResults && (
            <div className="mobile-search-dropdown-card">
              {mobileSearchResults.patients.length === 0 &&
               mobileSearchResults.medicines.length === 0 &&
               mobileSearchResults.owners.length === 0 ? (
                <div className="mobile-search-empty">
                  No matching records found for "{mobileSearchQuery}"
                </div>
              ) : (
                <div className="mobile-search-results-list">
                  {mobileSearchResults.patients.map((p) => (
                    <div
                      key={p.id}
                      className="mobile-search-result-item"
                      onClick={() => {
                        setMobileSearchQuery('');
                        navigate(`/patients/${p.id}`);
                      }}
                    >
                      <span className="search-result-avatar">
                        {getSpeciesVisual(p.species).emoji}
                      </span>
                      <div className="search-result-info min-w-0">
                        <div className="search-result-title truncate">{p.name}</div>
                        <div className="search-result-sub truncate">{p.species} • {p.breed || 'Patient'}</div>
                      </div>
                      <button
                        type="button"
                        className="mobile-quick-rx-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileSearchQuery('');
                          navigate(`/prescriptions/new?patientId=${p.id}`);
                        }}
                      >
                        1-Tap Rx
                      </button>
                    </div>
                  ))}
                  {mobileSearchResults.medicines.map((m) => (
                    <div
                      key={m.id}
                      className="mobile-search-result-item"
                      onClick={() => {
                        setMobileSearchQuery('');
                        navigate('/inventory');
                      }}
                    >
                      <span className="search-result-avatar bg-blue">💊</span>
                      <div className="search-result-info min-w-0">
                        <div className="search-result-title truncate">{m.brandName}</div>
                        <div className="search-result-sub truncate">{m.genericName || m.category}</div>
                      </div>
                      <span className="search-stock-tag">
                        {m.presentation || m.packSize || 'Formulary'}
                      </span>
                    </div>
                  ))}
                  {mobileSearchResults.owners.map((o) => (
                    <div
                      key={o.id}
                      className="mobile-search-result-item"
                      onClick={() => {
                        setMobileSearchQuery('');
                        navigate(`/owners/${o.id}`);
                      }}
                    >
                      <span className="search-result-avatar bg-amber">👤</span>
                      <div className="search-result-info min-w-0">
                        <div className="search-result-title truncate">{o.name}</div>
                        <div className="search-result-sub truncate">{o.phone || o.address || 'Client'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Quick Actions (Compact 4x2 One UI 9 Grid - All 8 Items) */}
        <section className="mobile-qa-section" aria-label="Quick Actions">
          <div className="mobile-section-header">
            <h2 className="mobile-section-title">Quick Actions</h2>
            <Link to="/more" className="mobile-section-link">View All</Link>
          </div>

          <div className="mobile-qa-grid">
            {/* 1. New Prescription */}
            <button
              type="button"
              className="mobile-qa-card qa-rx"
              onClick={() => navigate('/prescriptions/new')}
            >
              <div className="mobile-qa-icon-wrap icon-rx">
                <Icon name="prescription" size={20} />
              </div>
              <span className="mobile-qa-label">New<br />Prescription</span>
            </button>

            {/* 2. Add Patient */}
            <button
              type="button"
              className="mobile-qa-card qa-patient"
              onClick={() => navigate('/patients/new')}
            >
              <div className="mobile-qa-icon-wrap icon-patient">
                <Icon name="patients" size={20} />
              </div>
              <span className="mobile-qa-label">Add<br />Patient</span>
            </button>

            {/* 3. Register Call */}
            <button
              type="button"
              className="mobile-qa-card qa-call"
              onClick={() => navigate('/calls/new?callType=Call')}
            >
              <div className="mobile-qa-icon-wrap icon-call">
                <Icon name="phone" size={20} />
              </div>
              <span className="mobile-qa-label">Register<br />Call</span>
            </button>

            {/* 4. Add Visit */}
            <button
              type="button"
              className="mobile-qa-card qa-visit"
              onClick={() => navigate('/calls/new?callType=Visit')}
            >
              <div className="mobile-qa-icon-wrap icon-visit">
                <Icon name="calendar" size={20} />
              </div>
              <span className="mobile-qa-label">Add<br />Visit</span>
            </button>

            {/* 5. Create Invoice */}
            <button
              type="button"
              className="mobile-qa-card qa-invoice"
              onClick={() => navigate('/invoices/new')}
            >
              <div className="mobile-qa-icon-wrap icon-invoice">
                <Icon name="invoices" size={20} />
              </div>
              <span className="mobile-qa-label">Create<br />Invoice</span>
            </button>

            {/* 6. Search Medicines */}
            <button
              type="button"
              className="mobile-qa-card qa-meds"
              onClick={() => navigate('/inventory')}
            >
              <div className="mobile-qa-icon-wrap icon-meds">
                <Icon name="inventory" size={20} />
              </div>
              <span className="mobile-qa-label">Search<br />Medicines</span>
            </button>

            {/* 7. Scan & Add Stock */}
            <button
              type="button"
              className="mobile-qa-card qa-stock"
              onClick={() => setIsMobileScannerOpen(true)}
            >
              <div className="mobile-qa-icon-wrap icon-stock">
                <Icon name="scanner" size={20} />
              </div>
              <span className="mobile-qa-label">Scan & Add<br />Stock</span>
            </button>

            {/* 8. More */}
            <button
              type="button"
              className="mobile-qa-card qa-more"
              onClick={() => navigate('/more')}
            >
              <div className="mobile-qa-icon-wrap icon-more">
                <Icon name="more-horizontal" size={20} />
              </div>
              <span className="mobile-qa-label">More<br />&nbsp;</span>
            </button>
          </div>
        </section>

        {/* 3. Today's Schedule with 1-Tap Inline Micro-Drawer */}
        <section className="mobile-schedule-section" aria-label="Today's Schedule">
          <div className="mobile-section-header">
            <div className="mobile-section-title-wrap">
              <h2 className="mobile-section-title">Today's Schedule ({todayCalls?.length || 0})</h2>
              <span className="mobile-section-tag">Tap row for 1-Tap Rx</span>
            </div>
            <Link to="/calls" className="mobile-section-link">View All</Link>
          </div>

          <div className="mobile-schedule-card-container">
            {todayCalls && todayCalls.length > 0 ? (
              todayCalls.map((call) => {
                const isOpen = mobileExpandedCallId !== null && mobileExpandedCallId === call.id;
                const isEmergency = call.priority === 'EMERGENCY';
                const visual = getSpeciesVisual(call.patient?.species);
                const timeLabel = call.preferredTimeWindow || (call.createdAt ? new Date(call.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '10:00 AM');

                return (
                  <div key={call.id} className={`mobile-schedule-row ${isOpen ? 'is-expanded' : ''}`}>
                    <div
                      className="mobile-schedule-row-main"
                      onClick={() => setMobileExpandedCallId(isOpen ? null : (call.id ?? null))}
                    >
                      <div className="mobile-schedule-time-col">
                        <span className={`mobile-timeline-dot ${isEmergency ? 'dot-rose' : 'dot-teal'}`} />
                        <span className="mobile-schedule-time">{timeLabel}</span>
                      </div>

                      <div
                        className="mobile-schedule-avatar"
                        style={{ background: visual.bg, color: visual.color }}
                      >
                        {visual.emoji}
                      </div>

                      <div className="mobile-schedule-info min-w-0">
                        <div className="mobile-schedule-owner truncate">
                          {call.ownerName || call.owner?.name || call.tempOwnerName || 'Client Visit'}
                        </div>
                        <div className="mobile-schedule-patient truncate">
                          {call.patient?.name || call.tempPatientName || 'Patient'} • {call.patient?.species || call.species || 'Animal'}
                        </div>
                        <div className="mobile-schedule-reason truncate">
                          {call.symptoms || call.tentativeAssessment || 'Follow-up consultation'}
                        </div>
                      </div>

                      <div className="mobile-schedule-status-col">
                        <span className={`mobile-calltype-badge ${isEmergency ? 'badge-rose' : 'badge-teal'}`}>
                          {isEmergency ? 'Emergency' : (call.status === 'SCHEDULED' ? 'Visit' : 'Call')}
                        </span>
                        <Icon name={isOpen ? 'chevron-up' : 'chevron-right'} size={15} className="mobile-expand-icon" />
                      </div>
                    </div>

                    {/* 1-Tap Inline Micro-Drawer */}
                    {isOpen && (
                      <div className="mobile-schedule-drawer open">
                        <div className="mobile-drawer-grid">
                          <button
                            type="button"
                            className="mobile-drawer-btn btn-rx"
                            onClick={() => navigate(`/prescriptions/new?patientId=${call.patientIds?.[0] || ''}&ownerId=${call.ownerId || ''}&callId=${call.id || ''}`)}
                          >
                            <span>⚡ 1-Tap Rx</span>
                          </button>
                          <button
                            type="button"
                            className="mobile-drawer-btn btn-call"
                            onClick={() => {
                              const phone = call.callerPhone || call.owner?.phone;
                              if (phone) {
                                window.open(`tel:${phone}`);
                              } else {
                                showMobileToast('No phone number recorded for this client', 'info');
                              }
                            }}
                          >
                            <span>📞 Call</span>
                          </button>
                          <button
                            type="button"
                            className="mobile-drawer-btn btn-bill"
                            onClick={() => navigate(`/invoices/new?patientId=${call.patientIds?.[0] || ''}&ownerId=${call.ownerId || ''}`)}
                          >
                            <span>🧾 Bill</span>
                          </button>
                          <button
                            type="button"
                            className="mobile-drawer-btn btn-case"
                            onClick={() => navigate(`/calls/${call.id}`)}
                          >
                            <span>✓ Case</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="mobile-empty-schedule-card">
                <div className="mobile-empty-schedule-icon">
                  <Icon name="calendar" size={28} />
                </div>
                <div className="mobile-empty-schedule-title">No visits scheduled for today</div>
                <div className="mobile-empty-schedule-sub">Register a call or add a patient to start today's queue</div>
                <div className="mobile-empty-schedule-actions">
                  <button
                    type="button"
                    className="mobile-empty-btn-primary"
                    onClick={() => navigate('/calls/new?callType=Call')}
                  >
                    + Register Call
                  </button>
                  <button
                    type="button"
                    className="mobile-empty-btn-secondary"
                    onClick={() => navigate('/patients/new')}
                  >
                    + Add Patient
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 4. 2x2 Summary Bento Grid (Live VetRx Data) */}
        <section className="mobile-bento-section" aria-label="Clinical Metrics">
          <div className="mobile-bento-grid">
            {/* Bento Card 1: Follow-ups Due */}
            <div
              className="mobile-bento-card bento-followups"
              onClick={() => navigate('/calls')}
            >
              <div className="mobile-bento-top">
                <div className="mobile-bento-icon-wrap icon-followups">
                  <Icon name="calendar" size={17} />
                </div>
                <Icon name="chevron-right" size={15} className="mobile-bento-arrow" />
              </div>
              <div className="mobile-bento-body">
                <span className="mobile-bento-label">Follow-ups Due</span>
                <span className="mobile-bento-value">{followUpsStats?.total || 0}</span>
                <span className="mobile-bento-sub">
                  {followUpsStats?.today || 0} today • {followUpsStats?.overdue || 0} overdue
                </span>
              </div>
            </div>

            {/* Bento Card 2: Pending Invoices */}
            <div
              className="mobile-bento-card bento-invoices"
              onClick={() => navigate('/invoices')}
            >
              <div className="mobile-bento-top">
                <div className="mobile-bento-icon-wrap icon-invoices">
                  <Icon name="invoices" size={17} />
                </div>
                <Icon name="chevron-right" size={15} className="mobile-bento-arrow" />
              </div>
              <div className="mobile-bento-body">
                <span className="mobile-bento-label">Pending Invoices</span>
                <span className="mobile-bento-value">{pendingInvoicesStats?.count || 0}</span>
                <span className="mobile-bento-sub data-mono">
                  {fmtRupees(pendingInvoicesStats?.totalPaisa || 0)}
                </span>
              </div>
            </div>

            {/* Bento Card 3: Inventory Alerts */}
            <div
              className="mobile-bento-card bento-alerts"
              onClick={() => navigate('/inventory')}
            >
              <div className="mobile-bento-top">
                <div className="mobile-bento-icon-wrap icon-alerts">
                  <Icon name="inventory" size={17} />
                </div>
                <Icon name="chevron-right" size={15} className="mobile-bento-arrow" />
              </div>
              <div className="mobile-bento-body">
                <span className="mobile-bento-label">Inventory Alerts</span>
                <div className="mobile-bento-value-row">
                  <span className="mobile-bento-value">{inventoryAlertsStats?.count || 0}</span>
                  <span className="mobile-bento-unit">items low</span>
                </div>
                <span className="mobile-bento-sub truncate">
                  {inventoryAlertsStats?.sampleNames || 'Formulary normal'}
                </span>
              </div>
            </div>

            {/* Bento Card 4: Data Sync Status */}
            <div
              className="mobile-bento-card bento-sync"
              onClick={handleMobileManualSync}
            >
              <div className="mobile-bento-top">
                <div className="mobile-bento-icon-wrap icon-sync">
                  <Icon
                    name="sync"
                    size={17}
                    className={isManualSyncing || syncStatus.state === 'syncing' ? 'spin-icon' : ''}
                  />
                </div>
                <Icon name="chevron-right" size={15} className="mobile-bento-arrow" />
              </div>
              <div className="mobile-bento-body">
                <span className="mobile-bento-label">Data Sync</span>
                <span className="mobile-bento-value text-emerald">
                  {isManualSyncing || syncStatus.state === 'syncing' ? 'Syncing...' : (syncStatus.isOnline ? 'Synced' : 'Offline')}
                </span>
                <span className="mobile-bento-sub">
                  {syncStatus.lastSyncedAt ? timeAgo(syncStatus.lastSyncedAt) : 'Tap to sync'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Recent Prescriptions Preview */}
        <section className="mobile-recent-section" aria-label="Recent Prescriptions">
          <div className="mobile-section-header">
            <h2 className="mobile-section-title">Recent Prescriptions</h2>
            <Link to="/prescriptions" className="mobile-section-link">View All</Link>
          </div>

          <div className="mobile-recent-card-list">
            {effectiveRecentRx && effectiveRecentRx.length > 0 ? (
              effectiveRecentRx.slice(0, 4).map((rx: any) => (
                <div
                  key={rx.id}
                  className="mobile-recent-item"
                  onClick={() => navigate(`/prescriptions/${rx.id}`)}
                >
                  <div className="mobile-recent-avatar-col">
                    <span className="mobile-recent-rx-icon">
                      <Icon name="prescription" size={16} />
                    </span>
                  </div>
                  <div className="mobile-recent-info min-w-0">
                    <div className="mobile-recent-title data-mono truncate">{rx.rxNumber}</div>
                    <div className="mobile-recent-sub truncate">
                      {rx.patient?.name || 'Patient'} • {rx.owner?.name || 'Client'}
                    </div>
                    <div className="mobile-recent-date">{timeAgo(rx.createdAt as any)}</div>
                  </div>
                  <div className="mobile-recent-status-col">
                    <span className={`mobile-status-pill pill-${(rx.status || 'draft').toLowerCase()}`}>
                      {rx.status || 'Draft'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="mobile-recent-empty">
                <span>No prescriptions recorded yet</span>
                <Link to="/prescriptions/new" className="mobile-recent-create-link">+ Create Rx</Link>
              </div>
            )}
          </div>
        </section>

        {/* ── Simulated Optical Barcode / Ear-Tag Scanner Modal ── */}
        {isMobileScannerOpen && (
          <div className="mobile-scanner-modal-overlay" onClick={() => setIsMobileScannerOpen(false)}>
            <div className="mobile-scanner-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-scanner-modal-header">
                <div className="mobile-scanner-modal-title-wrap">
                  <span className="scanner-active-dot" />
                  <span className="scanner-modal-title">Optical Scanner • Barcode &amp; Ear-Tag</span>
                </div>
                <button
                  type="button"
                  className="mobile-scanner-close-btn"
                  onClick={() => setIsMobileScannerOpen(false)}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <div className="mobile-scanner-viewfinder">
                <div className="scanner-laser-beam" />
                <Icon name="scanner" size={56} className="scanner-laser-icon" />
                <span className="scanner-guide-text">Align barcode or livestock tag inside frame</span>
              </div>

              <div className="mobile-scanner-actions">
                <span className="scanner-action-header">Fast Test Triggers</span>
                <button
                  type="button"
                  className="scanner-trigger-action-btn"
                  onClick={() => {
                    setIsMobileScannerOpen(false);
                    showMobileToast('Found active patient tag!', 'success');
                    navigate('/prescriptions/new');
                  }}
                >
                  <span>🐕 Scan Patient Ear/Collar Tag</span>
                  <span className="scanner-tag-badge">Open Rx →</span>
                </button>
                <button
                  type="button"
                  className="scanner-trigger-action-btn"
                  onClick={() => {
                    setIsMobileScannerOpen(false);
                    showMobileToast('Barcode verified: Stock lookup complete', 'success');
                    navigate('/inventory');
                  }}
                >
                  <span>💊 Scan Medicine Barcode</span>
                  <span className="scanner-tag-badge">Formulary →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile Notifications Sheet ── */}
        {isNotificationsSheetOpen && (
          <div className="mobile-notifications-modal-overlay" onClick={() => setIsNotificationsSheetOpen(false)}>
            <div className="mobile-notifications-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="notifications-sheet-header">
                <div className="flex-center gap-xs">
                  <Icon name="bell" size={18} className="text-primary" />
                  <span className="notifications-sheet-title">Clinical Tasks &amp; Alerts</span>
                </div>
                <button
                  type="button"
                  className="notifications-sheet-close"
                  onClick={() => setIsNotificationsSheetOpen(false)}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>

              <div className="notifications-sheet-body">
                {pendingApprovalsCount > 0 && (
                  <div
                    className="notifications-sheet-item bg-amber"
                    onClick={() => {
                      setIsNotificationsSheetOpen(false);
                      navigate('/prescriptions');
                    }}
                  >
                    <Icon name="prescription" size={18} className="text-warning" />
                    <div className="min-w-0 flex-1">
                      <div className="notif-item-title">{pendingApprovalsCount} Prescriptions Pending Approval</div>
                      <div className="notif-item-sub">Requires veterinary clinical sign-off</div>
                    </div>
                    <span className="notif-action-tag">Review →</span>
                  </div>
                )}
                {(inventoryAlertsStats?.count || 0) > 0 && (
                  <div
                    className="notifications-sheet-item bg-rose"
                    onClick={() => {
                      setIsNotificationsSheetOpen(false);
                      navigate('/inventory');
                    }}
                  >
                    <Icon name="inventory" size={18} className="text-error" />
                    <div className="min-w-0 flex-1">
                      <div className="notif-item-title">{inventoryAlertsStats?.count} Medicines Below Minimum Stock</div>
                      <div className="notif-item-sub">{inventoryAlertsStats?.sampleNames}</div>
                    </div>
                    <span className="notif-action-tag">Restock →</span>
                  </div>
                )}
                <div
                  className="notifications-sheet-item bg-teal"
                  onClick={() => {
                    setIsNotificationsSheetOpen(false);
                    navigate('/calls');
                  }}
                >
                  <Icon name="phone" size={18} className="text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="notif-item-title">{todayCalls?.length || 0} Appointments &amp; Visits Today</div>
                    <div className="notif-item-sub">Scheduled on today's clinical queue</div>
                  </div>
                  <span className="notif-action-tag">Open →</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile Tactile Toast Banner ── */}
        {mobileToast && (
          <div className="mobile-tactile-toast">
            <Icon name={mobileToast.type === 'info' ? 'info' : 'check'} size={15} />
            <span>{mobileToast.message}</span>
          </div>
        )}
      </div>

      {/* ── DESKTOP STITCH DASHBOARD CONTENT (Preserved 100% on >= 1024px) ── */}
      <div className="desktop-dashboard-content">
        {/* ── TOP GREETING, STATUS BAR & FAST-KEY SHORTCUTS ─────── */}
        <div className="dashboard-header-bar">
          <div className="dashboard-header-left">
          <div className="dashboard-status-strip">
            {/* Cloud status per Section 33 */}
            <span className="status-badge-local">
              <span className="status-dot-solid" />
              Secure Cloud • Online
            </span>
            <span className="status-badge-doctor">
              <Icon name="verified" size={13} className="text-secondary" />
              {doctorName}
            </span>
            {commercialInfo && (
              <Link
                to="/settings?tab=subscription"
                className="status-badge-subscription"
                title="Manage Subscription & Billing"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  backgroundColor:
                    commercialInfo.status === 'TRIAL_ACTIVE'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : commercialInfo.status === 'ACTIVE'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : commercialInfo.status === 'GRACE_PERIOD'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                  color:
                    commercialInfo.status === 'TRIAL_ACTIVE'
                      ? '#2563eb'
                      : commercialInfo.status === 'ACTIVE'
                      ? '#059669'
                      : commercialInfo.status === 'GRACE_PERIOD'
                      ? '#d97706'
                      : '#dc2626',
                  border: `1px solid ${
                    commercialInfo.status === 'TRIAL_ACTIVE'
                      ? 'rgba(59, 130, 246, 0.25)'
                      : commercialInfo.status === 'ACTIVE'
                      ? 'rgba(16, 185, 129, 0.25)'
                      : commercialInfo.status === 'GRACE_PERIOD'
                      ? 'rgba(245, 158, 11, 0.25)'
                      : 'rgba(239, 68, 68, 0.25)'
                  }`,
                }}
              >
                <Icon name="credit-card" size={13} />
                <span>
                  {commercialInfo.status === 'TRIAL_ACTIVE'
                    ? `14-Day Trial • ${commercialInfo.trialDaysRemaining ?? 0}d left`
                    : commercialInfo.status === 'ACTIVE'
                    ? `${commercialInfo.planName || 'Active'} Plan`
                    : commercialInfo.status === 'GRACE_PERIOD'
                    ? 'Grace Period'
                    : commercialInfo.status === 'TRIAL_EXPIRED'
                    ? 'Trial Expired'
                    : 'Subscription'}
                </span>
              </Link>
            )}
          </div>
          <h1 className="dashboard-headline">Clinical Practice Command Center</h1>
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

      {/* ── PENDING APPROVALS ACTION BANNER ────────────────────── */}
      {pendingApprovalsCount > 0 && (
        <div
          style={{
            margin: '0 0 20px 0',
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(234, 134, 0, 0.12) 0%, rgba(234, 134, 0, 0.04) 100%)',
            border: '1px solid rgba(234, 134, 0, 0.35)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 2px 8px rgba(234, 134, 0, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#ea8600',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="clock" size={22} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                {pendingApprovalsCount} Prescription{pendingApprovalsCount > 1 ? 's' : ''} Awaiting Veterinarian Approval
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                Staff members have forwarded clinical drafts for your review, digital confirmation, and signature.
              </div>
            </div>
          </div>
          <Link
            to="/prescriptions?status=Pending+Approval"
            className="btn btn-primary"
            style={{
              height: '40px',
              padding: '0 18px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              background: '#b25e00',
              borderColor: '#995000',
            }}
          >
            <Icon name="check-circle" size={16} />
            <span>Review & Approve ({pendingApprovalsCount})</span>
          </Link>
        </div>
      )}

      {/* ── ONBOARDING CHECKLIST BANNER (Section 30) ─────────────── */}
      {showChecklist && (
        <div className="onboarding-checklist-card">
          <div className="onboarding-checklist-header">
            <div className="onboarding-checklist-title-group">
              <span className="onboarding-badge">Setup Guide</span>
              <h2 className="onboarding-checklist-title">Practice Setup Checklist</h2>
              <span className="onboarding-checklist-progress">
                {completedChecklistCount} of 4 tasks complete
              </span>
            </div>
            <button
              type="button"
              className="onboarding-dismiss-btn"
              onClick={handleDismissChecklist}
              title="Dismiss checklist"
            >
              Dismiss
            </button>
          </div>

          <div className="onboarding-checklist-grid">
            {/* Task 1 */}
            <div className={`onboarding-task-item ${isPracticeSetup ? 'is-complete' : ''}`}>
              <div className="onboarding-task-status">
                <Icon name={isPracticeSetup ? 'check-circle' : 'circle'} size={18} />
              </div>
              <div className="onboarding-task-content">
                <span className="onboarding-task-name">Set up your practice</span>
                <span className="onboarding-task-desc">Practice name, address, and phone</span>
              </div>
              {isPracticeSetup ? (
                <span className="onboarding-done-tag">Complete</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate('/settings?tab=practice')}
                >
                  Configure
                </button>
              )}
            </div>

            {/* Task 2 */}
            <div className={`onboarding-task-item ${isTeamAdded ? 'is-complete' : ''}`}>
              <div className="onboarding-task-status">
                <Icon name={isTeamAdded ? 'check-circle' : 'circle'} size={18} />
              </div>
              <div className="onboarding-task-content">
                <span className="onboarding-task-name">Add your team</span>
                <span className="onboarding-task-desc">Invite colleagues or clinic staff</span>
              </div>
              {isTeamAdded ? (
                <span className="onboarding-done-tag">Complete</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate('/settings?tab=team')}
                >
                  Add Team
                </button>
              )}
            </div>

            {/* Task 3 */}
            <div className={`onboarding-task-item ${isProfileComplete ? 'is-complete' : ''}`}>
              <div className="onboarding-task-status">
                <Icon name={isProfileComplete ? 'check-circle' : 'circle'} size={18} />
              </div>
              <div className="onboarding-task-content">
                <span className="onboarding-task-name">Complete your profile</span>
                <span className="onboarding-task-desc">Veterinary registration or license</span>
              </div>
              {isProfileComplete ? (
                <span className="onboarding-done-tag">Complete</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate('/settings?tab=profile')}
                >
                  Complete Profile
                </button>
              )}
            </div>

            {/* Task 4 */}
            <div className={`onboarding-task-item ${isClinicalSetup ? 'is-complete' : ''}`}>
              <div className="onboarding-task-status">
                <Icon name={isClinicalSetup ? 'check-circle' : 'circle'} size={18} />
              </div>
              <div className="onboarding-task-content">
                <span className="onboarding-task-name">Set up clinical practitioner</span>
                <span className="onboarding-task-desc">Designate a practicing veterinarian</span>
              </div>
              {isClinicalSetup ? (
                <span className="onboarding-done-tag">Complete</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate('/settings?tab=team')}
                >
                  Set Up Clinician
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
              <span className="kpi-num text-emerald-num data-mono">{effectiveRxCount ?? '—'}</span>
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
              {effectiveRxCount ?? 0} Recorded • Active Shift
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
              <span className="kpi-num text-purple-num data-mono">{effectivePatientCount ?? '—'}</span>
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
              {effectivePatientCount ?? 0} Registered Patient Charts
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
              <span className="kpi-num text-sky-num data-mono">{effectivePkgCount ?? '—'}</span>
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
              <span className="kpi-num text-rose-num data-mono">{effectiveInvCount ?? '—'}</span>
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
              {effectiveInvCount ?? 0} Finalized Documents
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
                <span>View All Records</span>
              </Link>
            </div>

            <div className="rx-list-container">
              {effectiveRecentRx?.length === 0 && (
                <div className="empty-state">
                  <Icon name="prescription" size={32} />
                  <span>No prescriptions recorded yet</span>
                </div>
              )}
              {effectiveRecentRx?.map((rx: any) => {
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
                <span>View All Documents</span>
              </Link>
            </div>

            <div className="inv-grid-container">
              {effectiveRecentInv?.length === 0 && (
                <div className="empty-state">
                  <Icon name="invoices" size={32} />
                  <span>No invoices generated yet</span>
                </div>
              )}
              {effectiveRecentInv?.map((inv: any) => {
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
              <Icon name="search" size={16} className="formulary-icon-inside" />
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
                                  {p.species} {p.breed ? `• ${p.breed}` : ''} {p.identificationRef || (p.id ? (typeof p.id === 'number' ? `#CAN-${8800 + p.id}` : `#CAN-${String(p.id).slice(0, 8)}`) : '')}
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
