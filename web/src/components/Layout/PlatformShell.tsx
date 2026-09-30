// ==============================================================================
// VetRx — PlatformShell.tsx
// Central layout shell for Platform Super Admin console (/platform/*).
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../ui/Icon';
import { VetRxLogo } from '../ui/VetRxLogo';
import { platformAdminApi, type SupportSessionItem } from '../../services/platformAdminApi';
import './PlatformShell.css';

interface PlatformShellProps {
  children: React.ReactNode;
}

const PLATFORM_NAV_ITEMS = [
  { label: 'Overview', path: '/platform/dashboard', icon: 'home' },
  { label: 'Practices', path: '/platform/practices', icon: 'hospital' },
  { label: 'Users', path: '/platform/users', icon: 'users' },
  { label: 'Subscriptions', path: '/platform/subscriptions', icon: 'credit-card' },
  { label: 'Payments', path: '/platform/payments', icon: 'receipt' },
  { label: 'Support & Issues', path: '/platform/issues', icon: 'life-buoy' },
  { label: 'Audit Trail', path: '/platform/audit', icon: 'shield' },
  { label: 'Platform Matrix', path: '/platform/permissions', icon: 'lock' },
];

export const PlatformShell: React.FC<PlatformShellProps> = ({ children }) => {
  const { user, practices, switchPractice, logout } = useAuth();
  const navigate = useNavigate();

  // ── Global Search State ─────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<{ practices: any[]; users: any[]; issues: any[] }>({
    practices: [],
    users: [],
    issues: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── Support Session Banner State ────────────────────────────
  const [activeSession, setActiveSession] = useState<SupportSessionItem | null>(null);
  const [isPracticeSwitcherOpen, setIsPracticeSwitcherOpen] = useState(false);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [isSwitchingPractice, setIsSwitchingPractice] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Default-select current or first practice when context switch modal opens
  useEffect(() => {
    if (isPracticeSwitcherOpen && practices && practices.length > 0) {
      if (!selectedPracticeId || !practices.some((p) => p.practiceId === selectedPracticeId)) {
        const defaultPractice = practices.find((p) => p.isCurrent) || practices[0];
        setSelectedPracticeId(defaultPractice.practiceId);
      }
      setSwitchError(null);
    }
  }, [isPracticeSwitcherOpen, practices, selectedPracticeId]);

  // Handle Escape key to dismiss context switcher modal
  useEffect(() => {
    if (!isPracticeSwitcherOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSwitchingPractice) {
        setIsPracticeSwitcherOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPracticeSwitcherOpen, isSwitchingPractice]);

  const handleEnterPractice = async () => {
    if (!selectedPracticeId || isSwitchingPractice) return;
    setIsSwitchingPractice(true);
    setSwitchError(null);
    try {
      await switchPractice(selectedPracticeId);
      setIsPracticeSwitcherOpen(false);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Failed to switch practice:', err);
      setSwitchError(err?.message || 'Failed to switch practice context. Please try again.');
    } finally {
      setIsSwitchingPractice(false);
    }
  };

  // Keyboard shortcut (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live global search debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ practices: [], users: [], issues: [] });
      setIsSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await platformAdminApi.globalSearch(searchQuery);
        setSearchResults(res);
        setIsSearchOpen(true);
      } catch (err) {
        console.error('Platform search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleEndSession = async () => {
    if (!activeSession) return;
    try {
      await platformAdminApi.endSupportSession(activeSession.id);
      setActiveSession(null);
    } catch (err: any) {
      alert(`Could not end support session: ${err.message}`);
    }
  };

  const handleSelectSearchResult = (path: string) => {
    navigate(path);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const hasResults =
    searchResults.practices.length > 0 ||
    searchResults.users.length > 0 ||
    searchResults.issues.length > 0;

  return (
    <div id="platform-shell-root" className="platform-shell-root">
      {/* ── Left Sidebar ──────────────────────────────────────── */}
      <aside className="platform-sidebar">
        <div className="platform-sidebar-header">
          <div className="platform-brand-row">
            <VetRxLogo size={26} />
            <span className="platform-brand-badge">Super Admin</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Central SaaS Administration
          </div>
        </div>

        <nav className="platform-sidebar-nav">
          <div className="platform-nav-heading">Platform Console</div>
          {PLATFORM_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              id={`platform-nav-${item.path.split('/').pop()}`}
              to={item.path}
              className={({ isActive }) => `platform-nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="platform-sidebar-footer">
          <button
            type="button"
            id="platform-sidebar-switch-btn"
            className="platform-switch-practice-btn"
            onClick={() => setIsPracticeSwitcherOpen(true)}
            title="Switch to veterinary practice"
          >
            <Icon name="swap-horiz" size={16} />
            <span>Switch to Practice</span>
          </button>
        </div>
      </aside>

      {/* ── Main Container ────────────────────────────────────── */}
      <div className="platform-main-container">
        {/* Support Access Banner if active */}
        {activeSession && (
          <div className="platform-support-banner" role="alert">
            <div className="platform-support-banner-content">
              <span className="platform-support-banner-badge">Audited Session</span>
              <span>
                Support Access Mode Active for <strong>{activeSession.targetPracticeName}</strong> (Read-Only)
              </span>
            </div>
            <button
              type="button"
              className="platform-support-banner-end-btn"
              onClick={handleEndSession}
            >
              End Support Session
            </button>
          </div>
        )}

        {/* Header */}
        <header className="platform-header">
          {/* Global Search Bar */}
          <div className="platform-search-bar" ref={searchContainerRef}>
            <div className="platform-search-input-wrap">
              <Icon name="search" size={16} color="#64748b" />
              <input
                ref={searchInputRef}
                type="text"
                className="platform-search-input"
                placeholder="Search practices, users, tickets (Ctrl+K)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim() && hasResults) setIsSearchOpen(true);
                }}
              />
              <span className="platform-search-shortcut">⌘K</span>
            </div>

            {/* Dropdown Results */}
            {isSearchOpen && (
              <div className="platform-search-dropdown">
                {isSearching ? (
                  <div style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#64748b' }}>
                    Searching...
                  </div>
                ) : !hasResults ? (
                  <div style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#64748b' }}>
                    No matching records found.
                  </div>
                ) : (
                  <>
                    {searchResults.practices.length > 0 && (
                      <div>
                        <div className="platform-search-category">Practices</div>
                        {searchResults.practices.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="platform-search-row"
                            onClick={() => handleSelectSearchResult(`/platform/practices/${p.id}`)}
                          >
                            <div>
                              <div className="platform-search-row-title">{p.name}</div>
                              <div className="platform-search-row-sub">
                                Type: {p.practiceType} • Status: {p.status}
                              </div>
                            </div>
                            <Icon name="chevron-right" size={14} color="#94a3b8" />
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.users.length > 0 && (
                      <div>
                        <div className="platform-search-category">Users</div>
                        {searchResults.users.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className="platform-search-row"
                            onClick={() => handleSelectSearchResult(`/platform/users/${u.id}`)}
                          >
                            <div>
                              <div className="platform-search-row-title">{u.name}</div>
                              <div className="platform-search-row-sub">{u.email}</div>
                            </div>
                            <Icon name="chevron-right" size={14} color="#94a3b8" />
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.issues.length > 0 && (
                      <div>
                        <div className="platform-search-category">Support Tickets</div>
                        {searchResults.issues.map((i) => (
                          <button
                            key={i.id}
                            type="button"
                            className="platform-search-row"
                            onClick={() => handleSelectSearchResult(`/platform/issues`)}
                          >
                            <div>
                              <div className="platform-search-row-title">
                                #{i.ticketNumber} {i.title}
                              </div>
                              <div className="platform-search-row-sub">
                                {i.category} • Priority: {i.priority} • Status: {i.status}
                              </div>
                            </div>
                            <Icon name="chevron-right" size={14} color="#94a3b8" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Profile Controls */}
          <div className="platform-header-right">
            <div id="platform-user-identity" className="platform-user-identity">
              <div className="platform-user-avatar" aria-hidden="true">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SA'}
              </div>
              <div className="platform-user-details">
                <div id="platform-user-name" className="platform-user-name" title={user?.name || 'Super Admin'}>
                  {user?.name || 'Super Admin'}
                </div>
                <div className="platform-user-badges">
                  <span className="platform-context-badge">PLATFORM</span>
                  <span id="platform-user-role" className="platform-role-badge">SUPER ADMIN</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              id="platform-switch-practice-btn"
              className="platform-switch-practice-btn platform-header-switch-btn"
              onClick={() => setIsPracticeSwitcherOpen(true)}
              title="Switch to veterinary practice"
            >
              <Icon name="hospital" size={15} />
              <span>Switch to Practice</span>
            </button>

            <button
              type="button"
              className="platform-signout-btn"
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              title="Sign out of VetRx platform"
            >
              <Icon name="logout" size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="platform-content">
          {children}
        </main>
      </div>

      {/* Practice Switcher Modal */}
      {isPracticeSwitcherOpen && (
        <div
          id="platform-context-switch-modal"
          className="platform-modal-overlay"
          onClick={() => {
            if (!isSwitchingPractice) setIsPracticeSwitcherOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="platform-context-switch-title"
        >
          <div
            className="platform-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '460px', width: '100%', borderRadius: '12px' }}
          >
            <div className="platform-modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '16px 20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <VetRxLogo size={20} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary, #00685f)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Context Switch
                  </span>
                </div>
                <h3
                  id="platform-context-switch-title"
                  style={{ fontWeight: 800, fontSize: '1.25rem', margin: '2px 0 0', color: '#0f172a' }}
                >
                  MY PRACTICES
                </h3>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                onClick={() => {
                  if (!isSwitchingPractice) setIsPracticeSwitcherOpen(false);
                }}
                disabled={isSwitchingPractice}
                aria-label="Close dialog"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="platform-modal-body" style={{ padding: '20px' }}>
              <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 16px', lineHeight: 1.5 }}>
                Select your veterinary practice to enter normal clinical practice mode:
              </p>

              {switchError && (
                <div
                  role="alert"
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8125rem',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Icon name="alert-triangle" size={16} />
                  <span>{switchError}</span>
                </div>
              )}

              {practices && practices.length > 0 ? (
                <div
                  role="radiogroup"
                  aria-label="Select veterinary practice"
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  {practices.map((p) => {
                    const isSelected = selectedPracticeId === p.practiceId;
                    const isOwner = p.role === 'PRACTICE_OWNER' || p.role === 'Owner';
                    const roleLabel = isOwner
                      ? 'Owner • Veterinarian'
                      : p.role === 'VETERINARIAN'
                      ? 'Veterinarian'
                      : p.role?.replace(/_/g, ' ') || 'Staff';

                    return (
                      <div
                        key={p.practiceId}
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={0}
                        id={`platform-practice-card-${p.practiceId}`}
                        data-current={p.isCurrent ? 'true' : 'false'}
                        className={`platform-practice-card ${isSelected ? 'selected' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: isSelected
                            ? '2px solid var(--color-primary, #00685f)'
                            : p.isCurrent
                            ? '1.5px solid #cbd5e1'
                            : '1px solid #e2e8f0',
                          background: isSelected ? 'rgba(0, 104, 95, 0.06)' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          width: '100%',
                          outline: 'none',
                          boxShadow: isSelected ? '0 0 0 1px var(--color-primary, #00685f)' : 'none',
                        }}
                        onClick={() => setSelectedPracticeId(p.practiceId)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            setSelectedPracticeId(p.practiceId);
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              background: isSelected ? 'var(--color-primary, #00685f)' : 'rgba(0, 104, 95, 0.1)',
                              color: isSelected ? '#ffffff' : 'var(--color-primary, #00685f)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Icon name="hospital" size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                              {p.practiceName}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                              {roleLabel}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {p.isCurrent && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--color-primary, #00685f)',
                                fontWeight: 700,
                                background: 'rgba(0, 104, 95, 0.1)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                              }}
                            >
                              Current
                            </span>
                          )}
                          {isSelected ? (
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: 'var(--color-primary, #00685f)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Icon name="check" size={14} />
                            </div>
                          ) : (
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                border: '2px solid #cbd5e1',
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '0.875rem' }}>
                  No practice memberships found for your account.
                </div>
              )}
            </div>

            <div
              className="platform-modal-footer"
              style={{
                borderTop: '1px solid #e2e8f0',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                id="platform-context-cancel-btn"
                onClick={() => setIsPracticeSwitcherOpen(false)}
                disabled={isSwitchingPractice}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                id="platform-enter-practice-btn"
                disabled={!selectedPracticeId || isSwitchingPractice}
                onClick={handleEnterPractice}
                style={{ minWidth: '145px', gap: '8px', fontWeight: 600 }}
              >
                {isSwitchingPractice ? (
                  <>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid #ffffff',
                        borderRightColor: 'transparent',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.75s linear infinite',
                      }}
                    />
                    <span>Entering…</span>
                  </>
                ) : (
                  <>
                    <span>Enter Practice</span>
                    <Icon name="chevron-right" size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
