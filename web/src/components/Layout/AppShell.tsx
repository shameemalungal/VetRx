// =============================================================
// VetRx — AppShell component
// Renders the sidebar (desktop) and bottom nav (mobile).
// Navigation items match the Stitch screen nav structure.
// Includes global shortcuts (Alt+N, Alt+F), live global search,
// real notifications, profile dropdown & logout, and persistent avatars.
// =============================================================

import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Icon } from '../ui/Icon';
import { VetRxLogo } from '../ui/VetRxLogo';
import { useSettingsStore } from '../../store/settingsStore';
import type { Patient, Medicine, Prescription, Invoice, Owner } from '../../types';
import { formatAnimalSubtitle } from '../../utils/patientFormat';
import './AppShell.css';

// ── Nav items — order and icons match Stitch screens ──────────
const NAV_ITEMS = [
  { label: 'Home',               path: '/',                icon: 'home'        },
  { label: 'Patients',           path: '/patients',        icon: 'patients'    },
  { label: 'Prescriptions',      path: '/prescriptions',   icon: 'prescription'},
  { label: 'Treatment Packages', path: '/packages',        icon: 'packages'    },
  { label: 'Medicines',          path: '/medicines',       icon: 'pill'        },
  { label: 'Invoices & Receipts',path: '/invoices',        icon: 'invoices'    },
] as const;

// Bottom nav shows the 4 most-used items (matches Stitch mobile)
const BOTTOM_NAV_ITEMS = [
  { label: 'Home',               path: '/',                icon: 'home'        },
  { label: 'Patients',           path: '/patients',        icon: 'patients'    },
  { label: 'Rx',                 path: '/prescriptions',   icon: 'prescription'},
  { label: 'Invoices & Receipts',path: '/invoices',        icon: 'invoices'    },
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
  const displayName = practitioner?.name ?? 'Practitioner';
  const firstWord = displayName.split(' ').find((w) => !w.startsWith('Dr')) ?? displayName.split(' ')[0];
  const avatarLetters = initials(displayName);

  // CLINIC ACTIVE RULE:
  // If Clinic is active and has a logo, show clinic logo and name in top-right
  // If clinic is off, do not display inactive clinic; use practitioner identity
  const isClinicActive = Boolean(organisation && organisation.isActive !== false && organisation.name?.trim());
  const clinicPhoto = isClinicActive && organisation?.logoDataUrl ? organisation.logoDataUrl : null;
  const doctorPhoto = practitioner?.photoDataUrl || null;

  const activeAvatarPhoto = clinicPhoto || doctorPhoto;
  const activeIdentityName = isClinicActive ? (organisation?.name || displayName) : displayName;
  const headerInitials = isClinicActive ? initials(organisation?.name || 'CP') : avatarLetters;

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
      const numMatches = p.id && (`#can-${8800 + p.id}`.includes(q) || `#fel-${4200 + p.id}`.includes(q));

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

  // ── Live Notifications (Draft Prescriptions & Draft Invoices) ──
  const draftRx = useLiveQuery(
    () => db.prescriptions.where('status').equals('Draft').toArray(),
    []
  );
  const draftInvs = useLiveQuery(
    () => db.invoices.where('status').equals('Draft').toArray(),
    []
  );

  const totalNotifications = (draftRx?.length || 0) + (draftInvs?.length || 0);

  // ── Derive current page label for mobile header ──────────────
  const currentNav =
    [...NAV_ITEMS].reverse().find((n) =>
      n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
    ) ?? NAV_ITEMS[0];

  const handleSelectResult = (url: string) => {
    navigate(url);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    // Clear any local temporary session state without faking a remote backend
    sessionStorage.clear();
    // Redirect to home or refresh workspace
    navigate('/');
  };

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <aside className="sidebar" aria-label="Main navigation">
        {/* Logo + clinic */}
        <div className="sidebar-header">
          <VetRxLogo size={28} />
          <div className="sidebar-clinic-tag">
            <span className="sidebar-clinic-dot" aria-hidden="true" />
            <span className="truncate">
              {(isClinicActive && organisation?.name?.trim()) || 'Independent Practitioner'}
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="sidebar-nav" aria-label="Sections">
          {NAV_ITEMS.map(({ label, path, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `sidebar-nav-item${isActive ? ' active' : ''}`
              }
            >
              <Icon name={icon} size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer — Settings + practitioner */}
        <div className="sidebar-footer">
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
            <div className="desktop-header-context">
              <Icon
                name={isClinicActive ? 'hospital' : 'verified'}
                size={14}
                className="text-primary"
              />
              <span className="desktop-header-clinic truncate">
                {isClinicActive
                  ? organisation!.name
                  : practitioner?.qualifications
                    ? `${practitioner.qualifications} • Independent Practitioner`
                    : 'Independent Clinical Practice'}
              </span>
            </div>
          </div>

          <div className="desktop-header-right">
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

        {/* Mobile top header */}
        <header className="mobile-header" aria-label="Page header">
          <div className="mobile-header-left">
            <span className="mobile-header-subtitle">
              {getGreeting()},{' '}
              {practitioner ? firstWord : 'Doctor'}
            </span>
            <span className="mobile-header-title">{currentNav.label}</span>
          </div>
          <div className="mobile-header-right">
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

        {/* Page content */}
        <div className="page-content">{children}</div>
      </main>

      {/* ── Mobile Bottom Navigation ───────────────────────────── */}
      <nav className="bottom-nav" aria-label="Bottom navigation">
        <div className="bottom-nav-inner">
          {BOTTOM_NAV_ITEMS.map(({ label, path, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `bottom-nav-item${isActive ? ' active' : ''}`
              }
              aria-label={label}
            >
              <Icon name={icon} size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
