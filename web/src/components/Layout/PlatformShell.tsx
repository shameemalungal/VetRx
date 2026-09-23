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
            onClick={() => {
              if (practices && practices.length > 0) {
                setIsPracticeSwitcherOpen(true);
              } else {
                navigate('/');
              }
            }}
            title="Switch to clinical workspace"
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
              <div className="platform-user-avatar">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'SA'}
              </div>
              <div>
                <div className="platform-user-name">{user?.name || 'Super Admin'}</div>
                <div className="platform-user-role">Platform Super Admin</div>
              </div>
            </div>

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
        <div className="platform-modal-overlay">
          <div className="platform-modal">
            <div className="platform-modal-header">
              <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Switch to Practice</div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => setIsPracticeSwitcherOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="platform-modal-body">
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                Select a practice to enter clinical practitioner mode:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {practices.map((p) => (
                  <button
                    key={p.practiceId}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: p.isCurrent ? '#f1f5f9' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onClick={async () => {
                      await switchPractice(p.practiceId);
                      setIsPracticeSwitcherOpen(false);
                      navigate('/');
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.practiceName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        Role: {p.role} {p.isClinicalApprover ? '• Clinical Approver' : ''}
                      </div>
                    </div>
                    {p.isCurrent && (
                      <span style={{ fontSize: '0.75rem', color: '#4f46e5', fontWeight: 600 }}>Current</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="platform-modal-footer">
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
