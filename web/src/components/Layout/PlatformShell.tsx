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
  { label: 'Role Matrix', path: '/platform/permissions', icon: 'lock' },
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
    <div className="platform-shell-root">
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
            <div className="platform-user-identity">
              <div className="platform-user-avatar" aria-hidden="true">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SA'}
              </div>
              <div className="platform-user-details">
                <div className="platform-user-name" title={user?.name || 'Super Admin'}>
                  {user?.name || 'Super Admin'}
                </div>
                <div className="platform-user-badges">
                  <span className="platform-context-badge">PLATFORM</span>
                  <span className="platform-role-badge">SUPER ADMIN</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              id="platform-context-switch-btn"
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
        <div className="platform-modal-overlay" onClick={() => setIsPracticeSwitcherOpen(false)}>
          <div className="platform-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
            <div className="platform-modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <VetRxLogo size={20} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary, #00685f)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Context Switch
                  </span>
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1.25rem', margin: '2px 0 0', color: '#0f172a' }}>
                  MY PRACTICES
                </h3>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setIsPracticeSwitcherOpen(false)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="platform-modal-body" style={{ padding: '16px 0' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 12px' }}>
                Select your veterinary practice to enter normal clinical practice mode:
              </p>
              {practices && practices.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {practices.map((p) => {
                    const isOwner = p.role === 'PRACTICE_OWNER' || p.role === 'Owner';
                    const roleLabel = isOwner
                      ? 'Owner • Veterinarian'
                      : p.role === 'VETERINARIAN'
                      ? 'Veterinarian'
                      : p.role?.replace(/_/g, ' ') || 'Staff';

                    return (
                      <button
                        key={p.practiceId}
                        type="button"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: p.isCurrent ? '1.5px solid var(--color-primary, #00685f)' : '1px solid #e2e8f0',
                          background: p.isCurrent ? 'rgba(0, 104, 95, 0.05)' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          width: '100%',
                        }}
                        id="switch-to-own-practice-item"
                        onClick={async () => {
                          try {
                            await switchPractice(p.practiceId);
                          } finally {
                            setIsPracticeSwitcherOpen(false);
                            window.location.href = '/';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '8px',
                              background: 'rgba(0, 104, 95, 0.1)',
                              color: 'var(--color-primary, #00685f)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {p.isCurrent ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-primary, #00685f)', fontWeight: 700, background: 'rgba(0, 104, 95, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                              Current
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-primary, #00685f)', fontWeight: 600 }}>
                              Enter →
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '0.875rem' }}>
                  No practice memberships found.
                </div>
              )}
            </div>
            <div className="platform-modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsPracticeSwitcherOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
