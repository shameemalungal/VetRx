// =============================================================
// VetRx — AppShell component
// Renders the sidebar (desktop) and bottom nav (mobile).
// Navigation items match the Stitch screen nav structure.
// Includes global shortcuts (Alt+N, Alt+F), live global search,
// real notifications, profile dropdown & logout, and persistent avatars.
// =============================================================

import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Icon } from '../ui/Icon';
import { VetRxLogo } from '../ui/VetRxLogo';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuth } from '../../context/AuthContext';
import { useInventoryEntitlement } from '../../context/InventoryEntitlementContext';
import type { Patient, Medicine, Prescription, Invoice, Owner } from '../../types';
import { formatAnimalSubtitle } from '../../utils/patientFormat';
import { PracticeSwitcher } from '../PracticeSwitcher/PracticeSwitcher';
import { SyncStatusIndicator } from '../common/SyncStatusIndicator';
import { PostCallPromptModal } from '../cvp/PostCallPromptModal';
import './AppShell.css';

// ── Bottom nav shows the 4 core mobile tabs plus dynamic 'More' menu ──────────
const PRIMARY_BOTTOM_NAV_ITEMS = [
  { label: 'Home',          path: '/dashboard',     icon: 'home',         ariaLabel: 'Home' },
  { label: 'Patients',      path: '/patients',      icon: 'patients',     ariaLabel: 'Patients' },
  { label: 'Prescriptions', path: '/prescriptions', icon: 'prescription', ariaLabel: 'Prescriptions' },
  { label: 'Calls & Visits',path: '/calls',         icon: 'phone',        ariaLabel: 'Calls & Visits' },
] as const;

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, practice, logout, isPlatformAdmin } = useAuth();
  const { practitioner, organisation } = useSettingsStore();
  const location = useLocation();
  const navigate = useNavigate();

  // ── Header State (Search, Notifications, Profile Menu) ───────
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Identity & Persistence Logic ─────────────────────────────
  const displayName = user?.name || practitioner?.name || 'Practitioner';
  const firstWord = displayName.split(' ').find((w) => !w.startsWith('Dr')) ?? displayName.split(' ')[0];
  const avatarLetters = initials(displayName);

  // CLINIC / PRACTICE ACTIVE RULE:
  const activePracticeName = practice?.name || organisation?.name;
  const isClinicActive = Boolean((activePracticeName && activePracticeName.trim()) || (organisation && organisation.isActive !== false && organisation.name?.trim()));
  const clinicPhoto = isClinicActive && organisation?.logoDataUrl ? organisation.logoDataUrl : null;
  const doctorPhoto = user?.avatarUrl || practitioner?.photoDataUrl || null;

  const activeAvatarPhoto = clinicPhoto || doctorPhoto;
  const activeIdentityName = isClinicActive ? (activePracticeName || displayName) : displayName;
  const headerInitials = isClinicActive ? initials(activePracticeName || 'CP') : avatarLetters;

  // ── Global Keyboard Shortcuts (Alt+N, Alt+F, ⌘K) ────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+N: New Prescription
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        navigate('/prescriptions/new');
        return;
      }

      // Alt+F: Formulary & MRN Search
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        const formularyInput = document.getElementById('dashboard-formulary-search') as HTMLInputElement | null;
        if (formularyInput) {
          formularyInput.focus();
          formularyInput.select();
        } else {
          // If not currently on dashboard, focus the top global search bar
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
        return;
      }

      // ⌘K or Ctrl+K: Focus top global search
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setIsSearchOpen(true);
      }

      // Escape closes floating overlays
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsNotificationsOpen(false);
        setIsProfileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // ── Close popovers on click outside ──────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileContainerRef.current && !profileContainerRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Live Search Across IndexedDB ─────────────────────────────
  const searchResults = useLiveQuery(async () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    // 1. Query Owners
    const allOwners = await db.owners.toArray();
    const matchingOwners = allOwners.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      (o.phone && o.phone.toLowerCase().includes(q)) ||
      (o.address && o.address.toLowerCase().includes(q))
    );
    const matchingOwnerIds = new Set(matchingOwners.map((o) => o.id).filter(Boolean));
    const ownerMap = new Map(allOwners.map((o) => [o.id!, o]));

    // 2. Query Patients (checks animal name, breed, species, chip, identification, and owner match)
    const allPatients = await db.patients.toArray();
    const matchingPatients = allPatients.filter((p) => {
      const ownerMatches = matchingOwnerIds.has(p.ownerId);
      const nameMatches = p.name.toLowerCase().includes(q);
      const breedMatches = p.breed?.toLowerCase().includes(q);
      const speciesMatches = p.species?.toLowerCase().includes(q);
      const chipMatches = p.microchipNumber?.toLowerCase().includes(q);
      const idMatches = p.identificationRef?.toLowerCase().includes(q);
      const numMatches = p.id && (typeof p.id === 'number' ? (`#can-${8800 + p.id}`.includes(q) || `#fel-${4200 + p.id}`.includes(q)) : String(p.id).toLowerCase().includes(q));

      return (
        nameMatches ||
        breedMatches ||
        speciesMatches ||
        chipMatches ||
        idMatches ||
        numMatches ||
        ownerMatches
      );
    }).slice(0, 5).map((p) => ({
      ...p,
      owner: ownerMap.get(p.ownerId),
    }));

    // 3. Medicines
    const medicines = await db.medicines.filter((m) =>
      Boolean(
        m.brandName.toLowerCase().includes(q) ||
        (m.genericName && m.genericName.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q))
      )
    ).limit(4).toArray();

    // 4. Prescriptions
    const prescriptions = await db.prescriptions.filter((r) =>
      r.rxNumber.toLowerCase().includes(q)
    ).limit(3).toArray();

    // 5. Invoices
    const invoices = await db.invoices.filter((i) =>
      i.invoiceNumber.toLowerCase().includes(q)
    ).limit(3).toArray();

    return {
      patients: matchingPatients,
      owners: matchingOwners.slice(0, 3),
      medicines,
      prescriptions,
      invoices,
    };
  }, [searchQuery]);

  // ── Live Notifications (Pending Approvals, Draft Prescriptions & Draft Invoices) ──
  const pendingRx = useLiveQuery(
    () => db.prescriptions.where('status').equals('Pending Approval').toArray(),
    []
  );
  const draftRx = useLiveQuery(
    () => db.prescriptions.where('status').equals('Draft').toArray(),
    []
  );
  const draftInvs = useLiveQuery(
    () => db.invoices.where('status').equals('Draft').toArray(),
    []
  );

  const pendingApprovalsCount = pendingRx?.length || 0;
  const totalNotifications = pendingApprovalsCount + (draftRx?.length || 0) + (draftInvs?.length || 0);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCalls = useLiveQuery(
    () => db.calls.where('preferredDate').equals(todayStr).filter(c => c.status !== 'CANCELLED').toArray(),
    []
  );
  const todayCallsCount = todayCalls?.length || 0;

  const { isEntitled: isInventoryEntitled } = useInventoryEntitlement();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Close more menu on route change
  useEffect(() => {
    setIsMoreMenuOpen(false);
  }, [location.pathname]);

  // Close more menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = React.useMemo(() => {
    const items = [
      { label: 'Home',               path: '/dashboard',       icon: 'home'        },
      { label: 'Calls & Visits',     path: '/calls',           icon: 'phone'       },
      { label: 'Follow-ups',         path: '/follow-ups',      icon: 'calendar'    },
      { label: 'Patients',           path: '/patients',        icon: 'patients'    },
      { label: 'Prescriptions',      path: '/prescriptions',   icon: 'prescription'},
      { label: 'Treatment Packages', path: '/packages',        icon: 'packages'    },
      { label: 'Medicines',          path: '/medicines',       icon: 'pill'        },
    ];
    if (isInventoryEntitled) {
      items.push({ label: 'Inventory', path: '/inventory', icon: 'inventory' });
      items.push({ label: 'Practice Bag', path: '/inventory/bag', icon: 'bag' });
    }
    items.push({ label: 'Invoices & Receipts', path: '/invoices', icon: 'invoices' });
    return items;
  }, [isInventoryEntitled]);

  // Secondary destinations rendered inside the mobile "More" menu
  const secondaryNavItems = React.useMemo(() => {
    const items = [
      {
        label: 'Follow-ups & Recurrence',
        path: '/follow-ups',
        icon: 'calendar',
        subtitle: 'Clinical rechecks & recurring visit schedules',
      },
      {
        label: 'Invoices & Receipts',
        path: '/invoices',
        icon: 'invoices',
        subtitle: 'Document billing & receipts',
      },
      {
        label: 'Treatment Packages',
        path: '/packages',
        icon: 'packages',
        subtitle: 'Prescribing templates & protocols',
      },
      {
        label: 'Medicines',
        path: '/medicines',
        icon: 'pill',
        subtitle: 'Clinical formulary & master list',
      },
    ];
    if (isInventoryEntitled) {
      items.push({
        label: 'Inventory',
        path: '/inventory',
        icon: 'inventory',
        subtitle: 'Stock balances, batches & suppliers',
      });
      items.push({
        label: 'Practice Bag',
        path: '/inventory/bag',
        icon: 'bag',
        subtitle: 'Field visit carrying bag & replenishment',
      });
    }
    return items;
  }, [isInventoryEntitled]);

  const isMoreActive = React.useMemo(() => {
    const morePaths = [
      '/follow-ups',
      '/invoices',
      '/packages',
      '/medicines',
      '/inventory',
      '/settings',
      '/platform',
    ];
    return morePaths.some((p) => location.pathname.startsWith(p));
  }, [location.pathname]);

  // Exact or route-aware matching so sibling/nested routes (e.g. /inventory and /inventory/bag) do not double-highlight
  const isRouteActive = React.useCallback((itemPath: string, currentPath: string): boolean => {
    if (itemPath === '/dashboard') {
      return currentPath === '/dashboard' || currentPath === '/';
    }
    if (itemPath === '/inventory') {
      // Active on /inventory, /inventory/items etc. EXCEPT /inventory/bag which is Practice Bag
      return currentPath === '/inventory' || (currentPath.startsWith('/inventory/') && !currentPath.startsWith('/inventory/bag'));
    }
    if (itemPath === '/inventory/bag') {
      return currentPath.startsWith('/inventory/bag') || currentPath === '/calls/bag';
    }
    return currentPath === itemPath || currentPath.startsWith(itemPath + '/');
  }, []);

  // ── Derive current page label for mobile header ──────────────
  const allPermittedNavItems = React.useMemo(() => {
    const list = [...navItems];
    list.push({ label: 'Settings', path: '/settings', icon: 'settings' });
    if (isPlatformAdmin?.()) {
      list.push({ label: 'Platform Console', path: '/platform', icon: 'swap-horiz' });
    }
    return list;
  }, [navItems, isPlatformAdmin]);

  const currentNav =
    [...allPermittedNavItems].reverse().find((n) =>
      n.path === '/dashboard'
        ? location.pathname === '/' || location.pathname === '/dashboard'
        : location.pathname.startsWith(n.path)
    ) ?? navItems[0];

  const handleSelectResult = (url: string) => {
    navigate(url);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleLogout = async () => {
    setIsProfileMenuOpen(false);
    setIsMoreMenuOpen(false);
    sessionStorage.clear();
    await logout();
  };

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <aside className="sidebar" aria-label="Main navigation">
        {/* Logo + clinic */}
        <div className="sidebar-header">
          <Link to="/dashboard" aria-label="VetRx Dashboard" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            <VetRxLogo size={28} />
          </Link>
          <div className="sidebar-clinic-tag">
            <span className="sidebar-clinic-dot" aria-hidden="true" />
            <span className="truncate">
              {(isClinicActive && organisation?.name?.trim()) || 'Independent Practitioner'}
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="sidebar-nav" aria-label="Sections">
          {navItems.map(({ label, path, icon }) => {
            const active = isRouteActive(path, location.pathname);
            return (
              <NavLink
                key={path}
                to={path}
                end={path === '/dashboard' || path === '/inventory'}
                className={() => `sidebar-nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
              <Icon name={icon} size={18} />
              <span style={{ flex: 1 }}>{label}</span>
              {path === '/calls' && todayCallsCount > 0 && (
                <span
                  style={{
                    background: '#ccfbf1',
                    color: '#0f766e',
                    border: '1px solid #99f6e4',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                  }}
                  title={`${todayCallsCount} calls scheduled today`}
                >
                  {todayCallsCount}
                </span>
              )}
              {path === '/prescriptions' && pendingApprovalsCount > 0 && (
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                  }}
                  title={`${pendingApprovalsCount} pending clinical approvals`}
                >
                  {pendingApprovalsCount}
                </span>
              )}
            </NavLink>
          );
        })}
        </nav>

        {/* Footer — Settings + practitioner */}
        <div className="sidebar-footer">
          {isPlatformAdmin?.() && (
            <button
              type="button"
              className="sidebar-nav-item"
              id="sidebar-switch-to-platform-btn"
              onClick={() => navigate('/platform/dashboard')}
              style={{
                background: 'rgba(0, 104, 95, 0.08)',
                color: 'var(--color-primary, #00685f)',
                border: '1px solid rgba(0, 104, 95, 0.2)',
                marginBottom: '8px',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 600,
              }}
              title="Switch to Platform Super Admin context"
            >
              <Icon name="swap-horiz" size={18} />
              <span style={{ flex: 1 }}>Switch to Platform</span>
              <span
                style={{
                  fontSize: '10px',
                  background: 'var(--color-primary, #00685f)',
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Admin
              </span>
            </button>
          )}

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
          >
            <Icon name="settings" size={18} />
            Settings
          </NavLink>

          <div className="sidebar-practitioner">
            {practitioner?.photoDataUrl ? (
              <img
                src={practitioner.photoDataUrl}
                alt={displayName}
                className="sidebar-practitioner-photo"
              />
            ) : (
              <div className="sidebar-practitioner-avatar" aria-hidden="true">
                {avatarLetters}
              </div>
            )}
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div className="sidebar-practitioner-name truncate">
                {displayName}
              </div>
              {practitioner?.qualifications && (
                <div className="sidebar-practitioner-role truncate">
                  {practitioner.qualifications}
                </div>
              )}
            </div>
            <Icon name="verified" size={16} className="sidebar-practitioner-badge" />
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────── */}
      <main className="app-main" id="main-content">
        {/* Desktop Top Header (Matches Stitch layout) */}
        <header className="desktop-header" aria-label="Application header">
          <div className="desktop-header-left">
            <span className="desktop-header-greeting">
              {getGreeting()}, {practitioner ? firstWord : 'Doctor'}
            </span>
            <div className="desktop-header-context" style={{ marginTop: '4px' }}>
              <PracticeSwitcher />
            </div>
          </div>

          <div className="desktop-header-right">
            <SyncStatusIndicator />
            {/* Top-Right Global Search */}
            <div className="desktop-search-bar" ref={searchContainerRef}>
              <Icon name="search" size={16} className="desktop-search-icon" />
              <input
                ref={searchInputRef}
                id="top-global-search"
                type="text"
                placeholder="Search patient, Rx, microchip..."
                className="desktop-search-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim().length >= 1) setIsSearchOpen(true);
                }}
                autoComplete="off"
              />
              <kbd className="desktop-search-kbd">⌘K</kbd>

              {/* Global Search Popover */}
              {isSearchOpen && searchQuery.trim().length >= 1 && searchResults && (
                <div className="desktop-search-popover">
                  {(!searchResults.patients.length &&
                    !searchResults.owners?.length &&
                    !searchResults.medicines.length &&
                    !searchResults.prescriptions.length &&
                    !searchResults.invoices.length) ? (
                    <div className="search-popover-empty">
                      <Icon name="search" size={20} />
                      <span>No clinical records matching "{searchQuery}"</span>
                    </div>
                  ) : (
                    <div className="search-popover-results">
                      {searchResults.owners && searchResults.owners.length > 0 && (
                        <div className="search-group">
                          <span className="search-group-title">Clients / Farmers</span>
                          {searchResults.owners.map((o: Owner) => (
                            <button
                              key={o.id}
                              type="button"
                              className="search-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectResult(`/patients?q=${encodeURIComponent(o.name)}`)}
                            >
                              <Icon name="user" size={15} className="text-primary" />
                              <div className="search-item-info">
                                <span className="search-item-name">{o.name}</span>
                                <span className="search-item-sub">
                                  {o.phone} {o.address ? `• ${o.address}` : ''}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.patients.length > 0 && (
                        <div className="search-group">
                          <span className="search-group-title">Patients</span>
                          {searchResults.patients.map((p: Patient & { owner?: Owner }) => (
                            <button
                              key={p.id}
                              type="button"
                              className="search-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectResult(`/patients/${p.id}`)}
                            >
                              <Icon name="paw" size={15} className="text-secondary" />
                              <div className="search-item-info">
                                <span className="search-item-name">
                                  {p.owner ? p.owner.name : 'Client'}
                                  {p.owner?.phone ? ` (${p.owner.phone})` : ''}
                                </span>
                                <span className="search-item-sub">
                                  {formatAnimalSubtitle(p)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.medicines.length > 0 && (
                        <div className="search-group">
                          <span className="search-group-title">Formulary Medicines</span>
                          {searchResults.medicines.map((m: Medicine) => (
                            <button
                              key={m.id}
                              type="button"
                              className="search-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectResult(`/medicines?search=${encodeURIComponent(m.brandName)}`)}
                            >
                              <Icon name="pill" size={15} className="text-primary" />
                              <div className="search-item-info">
                                <span className="search-item-name">{m.brandName}</span>
                                <span className="search-item-sub">
                                  {m.genericName ? `${m.genericName} • ` : ''}{m.category || m.presentation}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.prescriptions.length > 0 && (
                        <div className="search-group">
                          <span className="search-group-title">Prescriptions</span>
                          {searchResults.prescriptions.map((r: Prescription) => (
                            <button
                              key={r.id}
                              type="button"
                              className="search-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectResult(`/prescriptions/${r.id}`)}
                            >
                              <Icon name="prescription" size={15} className="text-primary" />
                              <div className="search-item-info">
                                <span className="search-item-name data-mono">{r.rxNumber}</span>
                                <span className="search-item-sub">Status: {r.status}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {searchResults.invoices.length > 0 && (
                        <div className="search-group">
                          <span className="search-group-title">Invoices &amp; Receipts</span>
                          {searchResults.invoices.map((inv: Invoice) => (
                            <button
                              key={inv.id}
                              type="button"
                              className="search-item"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectResult(`/invoices/${inv.id}`)}
                            >
                              <Icon name="invoices" size={15} className="text-secondary" />
                              <div className="search-item-info">
                                <span className="search-item-name data-mono">{inv.invoiceNumber}</span>
                                <span className="search-item-sub">Document Date: {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</span>
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

            {/* Notifications Button & Popover */}
            <div className="relative-wrap" ref={notifContainerRef}>
              <button
                className="desktop-header-icon-btn"
                aria-label="Notifications"
                title="Notifications"
                type="button"
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsProfileMenuOpen(false);
                }}
              >
                <Icon name="bell" size={18} />
                {totalNotifications > 0 && (
                  <span className="desktop-notification-dot" />
                )}
              </button>

              {isNotificationsOpen && (
                <div className="desktop-notifications-popover">
                  <div className="popover-header">
                    <div className="flex-center gap-xs">
                      <Icon name="bell" size={16} className="text-primary" />
                      <span className="popover-title">Clinical Tasks &amp; Alerts</span>
                    </div>
                    {totalNotifications > 0 && (
                      <span className="badge badge-warning">{totalNotifications} Pending</span>
                    )}
                  </div>

                  <div className="popover-body">
                    {totalNotifications === 0 ? (
                      <div className="popover-empty">
                        <Icon name="check-circle" size={24} className="text-tertiary" />
                        <span className="popover-empty-title">No new notifications</span>
                        <p className="popover-empty-desc">
                          All clinical prescriptions and invoices are up to date.
                        </p>
                      </div>
                    ) : (
                      <div className="popover-list">
                        {pendingRx?.map((rx) => (
                          <button
                            key={rx.id}
                            type="button"
                            className="popover-item"
                            style={{ background: '#fffbeb' }}
                            onClick={() => {
                              navigate(`/prescriptions/${rx.id}`);
                              setIsNotificationsOpen(false);
                            }}
                          >
                            <div className="popover-item-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
                              <Icon name="clock" size={14} />
                            </div>
                            <div className="popover-item-content">
                              <span className="popover-item-title" style={{ color: '#92400e', fontWeight: 600 }}>
                                Clinical Approval Needed
                              </span>
                              <span className="popover-item-sub data-mono">{rx.rxNumber} • Awaiting doctor sign-off</span>
                            </div>
                          </button>
                        ))}

                        {draftRx?.map((rx) => (
                          <button
                            key={rx.id}
                            type="button"
                            className="popover-item"
                            onClick={() => {
                              navigate(`/prescriptions/${rx.id}/edit`);
                              setIsNotificationsOpen(false);
                            }}
                          >
                            <div className="popover-item-icon icon-pill-primary">
                              <Icon name="prescription" size={14} />
                            </div>
                            <div className="popover-item-content">
                              <span className="popover-item-title">Draft Prescription Pending</span>
                              <span className="popover-item-sub data-mono">{rx.rxNumber} • Awaiting completion</span>
                            </div>
                          </button>
                        ))}

                        {draftInvs?.map((inv) => (
                          <button
                            key={inv.id}
                            type="button"
                            className="popover-item"
                            onClick={() => {
                              navigate(`/invoices/${inv.id}`);
                              setIsNotificationsOpen(false);
                            }}
                          >
                            <div className="popover-item-icon icon-pill-secondary">
                              <Icon name="invoices" size={14} />
                            </div>
                            <div className="popover-item-content">
                              <span className="popover-item-title">Draft Invoice Pending</span>
                              <span className="popover-item-sub data-mono">{inv.invoiceNumber} • Needs finalization</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Top-Right User Profile Avatar & Menu (with Visible Logout) */}
            <div className="relative-wrap" ref={profileContainerRef}>
              <button
                className="desktop-header-avatar-btn"
                aria-label={`${activeIdentityName} — profile and session`}
                onClick={() => {
                  setIsProfileMenuOpen(!isProfileMenuOpen);
                  setIsNotificationsOpen(false);
                }}
                title={`${activeIdentityName} — Options`}
                type="button"
              >
                {activeAvatarPhoto ? (
                  <img
                    src={activeAvatarPhoto}
                    alt={activeIdentityName}
                    className="desktop-header-avatar-img"
                  />
                ) : (
                  <span className="desktop-header-avatar-initials">{headerInitials}</span>
                )}
              </button>

              {isProfileMenuOpen && (
                <div className="desktop-profile-popover">
                  <div className="profile-popover-identity">
                    <div className="profile-popover-avatar-wrap">
                      {activeAvatarPhoto ? (
                        <img
                          src={activeAvatarPhoto}
                          alt={activeIdentityName}
                          className="profile-popover-avatar-img"
                        />
                      ) : (
                        <div className="profile-popover-avatar-fallback">
                          {headerInitials}
                        </div>
                      )}
                    </div>
                    <div className="profile-popover-details">
                      <span className="profile-popover-name truncate">{activeIdentityName}</span>
                      <span className="profile-popover-role truncate">
                        {isClinicActive
                          ? `Practitioner: ${displayName}`
                          : (practitioner?.qualifications || 'Veterinary Practitioner')}
                      </span>
                      <span className="profile-popover-reg data-mono">
                        {isClinicActive && organisation?.licenseNumber
                          ? `Licence: ${organisation.licenseNumber}`
                          : `Reg: ${practitioner?.registrationNumber || 'Registered'}`}
                      </span>
                    </div>
                  </div>

                  <div className="profile-popover-badge-strip">
                    <span className="sidebar-clinic-dot" />
                    <span>{isClinicActive ? 'Practice Identity Active' : 'Independent Clinical Practice'}</span>
                  </div>

                  <div className="profile-popover-actions">
                    <button
                      type="button"
                      className="profile-popover-item"
                      onClick={() => {
                        navigate('/settings');
                        setIsProfileMenuOpen(false);
                      }}
                    >
                      <Icon name="settings" size={16} />
                      <span>Workspace &amp; Practice Settings</span>
                    </button>

                    {isPlatformAdmin?.() && (
                      <button
                        type="button"
                        className="profile-popover-item"
                        id="switch-to-platform-btn"
                        data-testid="profile-menu-platform-console"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          navigate('/platform/dashboard');
                        }}
                      >
                        <Icon name="swap-horiz" size={16} />
                        <span>Switch to Platform</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="profile-popover-item profile-logout-btn"
                      onClick={handleLogout}
                    >
                      <Icon name="close" size={16} className="text-error" />
                      <span>Sign Out / Lock Workspace</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile top header (Rendered on subpages; on Dashboard the One UI 9 Clinical Hero Header renders inside DashboardPage) */}
        {!(location.pathname === '/' || location.pathname === '/dashboard') && (
          <header className="mobile-header" aria-label="Page header">
            <div className="mobile-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="mobile-header-back-btn"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  borderRadius: '50%',
                }}
              >
                <Icon name="arrow-back" size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="mobile-header-subtitle">
                  {getGreeting()},{' '}
                  {practitioner ? firstWord : 'Doctor'}
                </span>
                <span className="mobile-header-title">{currentNav.label}</span>
              </div>
            </div>
            <div className="mobile-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SyncStatusIndicator compact />
              <PracticeSwitcher />
              <button
                className="mobile-header-avatar"
                aria-label={`${displayName} — go to settings`}
                onClick={() => {
                  navigate('/settings');
                }}
              >
                {activeAvatarPhoto ? (
                  <img
                    src={activeAvatarPhoto}
                    alt={activeIdentityName}
                    className="mobile-header-avatar-img"
                  />
                ) : (
                  avatarLetters
                )}
              </button>
            </div>
          </header>
        )}

        {/* Page content */}
        <div className="page-content">{children}</div>
      </main>

      {/* ── Mobile Bottom Navigation ───────────────────────────── */}
      <nav className="bottom-nav" aria-label="Bottom navigation">
        <div className="bottom-nav-inner">
          {PRIMARY_BOTTOM_NAV_ITEMS.map(({ label, path, icon, ariaLabel }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/dashboard'}
              className={({ isActive }) =>
                `bottom-nav-item${isActive ? ' active' : ''}`
              }
              aria-label={ariaLabel || label}
            >
              <div className="bottom-nav-icon-wrapper" style={{ position: 'relative' }}>
                <Icon name={icon} size={20} aria-hidden />
                {path === '/calls' && todayCallsCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-8px',
                      background: '#0f766e',
                      color: '#ffffff',
                      fontSize: '9px',
                      fontWeight: 800,
                      borderRadius: '8px',
                      padding: '0 4px',
                      lineHeight: '13px',
                      minWidth: '13px',
                      textAlign: 'center',
                    }}
                    aria-label={`${todayCallsCount} calls today`}
                  >
                    {todayCallsCount}
                  </span>
                )}
                {path === '/prescriptions' && pendingApprovalsCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-8px',
                      background: '#b45309',
                      color: '#ffffff',
                      fontSize: '9px',
                      fontWeight: 800,
                      borderRadius: '8px',
                      padding: '0 4px',
                      lineHeight: '13px',
                      minWidth: '13px',
                      textAlign: 'center',
                    }}
                    aria-label={`${pendingApprovalsCount} pending approvals`}
                  >
                    {pendingApprovalsCount}
                  </span>
                )}
              </div>
              <span className="bottom-nav-label">{label}</span>
              <span className="bottom-nav-indicator" aria-hidden="true" />
            </NavLink>
          ))}

          {/* 5th destination: Polished More button */}
          <button
            type="button"
            className={`bottom-nav-item${isMoreActive || isMoreMenuOpen ? ' active' : ''}`}
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            aria-label="More navigation destinations"
            aria-expanded={isMoreMenuOpen}
            aria-controls="mobile-more-menu-sheet"
            id="mobile-nav-more-btn"
          >
            <div className="bottom-nav-icon-wrapper">
              <Icon name="more-horizontal" size={20} aria-hidden />
            </div>
            <span className="bottom-nav-label">More</span>
            <span className="bottom-nav-indicator" aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* ── Mobile Navigation More Sheet & Backdrop ──────────────── */}
      <div
        className={`mobile-nav-backdrop ${isMoreMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMoreMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="mobile-more-menu-sheet"
        className={`more-menu-sheet ${isMoreMenuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="More navigation destinations"
      >
        <div className="more-menu-drag-handle" aria-hidden="true" />

        <div className="more-menu-header">
          <div className="more-menu-title-group">
            <h2>More Destinations</h2>
            <p className="truncate">
              {(isClinicActive && organisation?.name?.trim()) || displayName}
            </p>
          </div>
          <button
            type="button"
            className="more-menu-close-btn"
            onClick={() => setIsMoreMenuOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="more-menu-content">
          <div>
            <div className="more-menu-section-label">Clinical &amp; Financial</div>
            <div className="more-menu-grid">
              {secondaryNavItems.map(({ label, path, icon, subtitle }) => {
                const isActive = isRouteActive(path, location.pathname);
                return (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === '/dashboard' || path === '/inventory'}
                    className={() => `more-menu-item${isActive ? ' active' : ''}`}
                    onClick={() => setIsMoreMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="more-menu-item-icon">
                      <Icon name={icon} size={20} />
                    </div>
                    <div className="more-menu-item-text">
                      <span className="more-menu-item-title">{label}</span>
                      <span className="more-menu-item-sub">{subtitle}</span>
                    </div>
                    {isActive && (
                      <span className="more-menu-badge">Active</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>

          <div>
            <div className="more-menu-section-label">Workspace &amp; Account</div>
            <div className="more-menu-grid">
              {isPlatformAdmin?.() && (
                <button
                  type="button"
                  className="more-menu-item"
                  id="mobile-switch-to-platform-btn"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    navigate('/platform/dashboard');
                  }}
                >
                  <div className="more-menu-item-icon">
                    <Icon name="swap-horiz" size={20} />
                  </div>
                  <div className="more-menu-item-text">
                    <span className="more-menu-item-title">Switch to Platform</span>
                    <span className="more-menu-item-sub">Super Admin Management Console</span>
                  </div>
                  <span className="more-menu-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                    Admin
                  </span>
                </button>
              )}

              <NavLink
                to="/settings"
                className={({ isActive }) => `more-menu-item${isActive ? ' active' : ''}`}
                onClick={() => setIsMoreMenuOpen(false)}
              >
                <div className="more-menu-item-icon">
                  <Icon name="settings" size={20} />
                </div>
                <div className="more-menu-item-text">
                  <span className="more-menu-item-title">Settings</span>
                  <span className="more-menu-item-sub">Practitioner, clinic, &amp; printer setup</span>
                </div>
                {location.pathname.startsWith('/settings') && (
                  <span className="more-menu-badge">Active</span>
                )}
              </NavLink>

              <button
                type="button"
                className="more-menu-item"
                style={{ color: 'var(--color-error, #b91c1c)' }}
                onClick={handleLogout}
              >
                <div className="more-menu-item-icon" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                  <Icon name="logout" size={20} />
                </div>
                <div className="more-menu-item-text">
                  <span className="more-menu-item-title">Sign Out / Lock Workspace</span>
                  <span className="more-menu-item-sub">End practitioner session</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </aside>
      <PostCallPromptModal />
    </div>
  );
};
