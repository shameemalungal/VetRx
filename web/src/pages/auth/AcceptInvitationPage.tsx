// ==============================================================================
// VetRx — Practice Invitation Acceptance Page (Phase 14)
// Allows invited users to preview practice details, sign in/register,
// verify email identity, and securely accept practice membership.
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { VetRxLogo } from '../../components/ui/VetRxLogo';
import { Icon } from '../../components/ui/Icon';
import './Auth.css';

interface InvitationPreview {
  practiceName: string;
  email: string;
  role: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  isExpired: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const AcceptInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshSession, logout } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided in URL.');
      setLoading(false);
      return;
    }

    async function fetchPreview() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/practice/invitations/preview/${token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || 'Invalid or expired invitation token.');
        }

        setPreview(data);
      } catch (err: any) {
        setError(err.message || 'Failed to validate invitation.');
      } finally {
        setLoading(false);
      }
    }

    void fetchPreview();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/practice/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to accept invitation.');
      }

      setSuccess(true);
      await refreshSession();
    } catch (err: any) {
      setError(err.message || 'Error accepting invitation.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    navigate(`/login?redirect=/invite/${token}`);
  };

  const formatRole = (role: string) => {
    switch (role) {
      case 'PRACTICE_OWNER':
        return 'Owner';
      case 'PRACTICE_ADMIN':
        return 'Clinic Admin';
      case 'VETERINARIAN':
        return 'Veterinarian';
      case 'STAFF':
      case 'PRACTICE_STAFF':
        return 'Staff';
      case 'READ_ONLY':
        return 'Read Only';
      default:
        return role;
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '480px' }}>
        <div className="auth-header">
          <div className="auth-logo-badge">
            <VetRxLogo size={30} />
          </div>
          <h1 className="auth-title">Practice Invitation</h1>
          <p className="auth-subtitle">Join your veterinary team on VetRx</p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '14px' }}>
              Verifying invitation details…
            </p>
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#dc2626',
                marginBottom: '16px',
              }}
            >
              <Icon name="alert-triangle" size={24} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
              Invitation Unavailable
            </h2>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, marginBottom: '24px' }}>
              {error}
            </p>
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ display: 'inline-block', textDecoration: 'none', padding: '10px 20px' }}
            >
              Go to Sign In
            </Link>
          </div>
        )}

        {!loading && !error && success && preview && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#f0fdf4',
                color: '#16a34a',
                marginBottom: '16px',
              }}
            >
              <Icon name="check" size={28} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              You're now a member of {preview.practiceName}.
            </h2>
            <p style={{ fontSize: '15px', color: '#475569', marginBottom: '24px' }}>
              Role: <strong>{formatRole(preview.role)}</strong>
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/')}
              style={{ width: '100%', padding: '12px 20px', fontSize: '15px', fontWeight: 600 }}
            >
              Go to Clinic
            </button>
          </div>
        )}

        {!loading && !error && !success && preview && (
          <div>
            {/* Invitation Status Alerts */}
            {preview.status === 'ACCEPTED' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ color: '#059669', fontWeight: 600, marginBottom: '16px' }}>
                  This invitation has already been accepted and consumed.
                </p>
                <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  Go to Practice Dashboard
                </Link>
              </div>
            ) : preview.status === 'REVOKED' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ color: '#dc2626', fontWeight: 600 }}>
                  This invitation has been revoked by practice administration.
                </p>
              </div>
            ) : preview.isExpired || preview.status === 'EXPIRED' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ color: '#dc2626', fontWeight: 600 }}>
                  This invitation has expired. Please contact your practice administrator for a new invitation.
                </p>
              </div>
            ) : (
              <div>
                {/* Practice Invitation Card */}
                <div
                  style={{
                    background: 'var(--color-surface-hover, #f8fafc)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '18px',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Practice
                    </span>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      {preview.practiceName}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Assigned Role</span>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#00685f' }}>
                        {formatRole(preview.role)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Invited Email</span>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                        {preview.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #edf2f7', fontSize: '12px', color: '#94a3b8' }}>
                    Expires: {new Date(preview.expiresAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Authentication Conditional Flow */}
                {!user ? (
                  <div>
                    <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px', textAlign: 'center' }}>
                      Sign in or create an account with <strong>{preview.email}</strong> to accept this invitation.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <Link
                        to={`/login?redirect=/invite/${token}`}
                        className="btn btn-primary"
                        style={{ textAlign: 'center', textDecoration: 'none', padding: '12px' }}
                      >
                        Sign In to Accept
                      </Link>
                      <Link
                        to={`/register?redirect=/invite/${token}`}
                        className="btn btn-secondary"
                        style={{ textAlign: 'center', textDecoration: 'none', padding: '12px' }}
                      >
                        Create Account
                      </Link>
                    </div>
                  </div>
                ) : user.email.toLowerCase() === preview.email.toLowerCase() ? (
                  <div>
                    <p style={{ fontSize: '14px', color: '#475569', marginBottom: '16px', textAlign: 'center' }}>
                      You are signed in as <strong>{user.email}</strong>. Click below to join the practice.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAccept}
                      disabled={accepting}
                      style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                    >
                      {accepting ? 'Joining Practice…' : 'Accept Invitation'}
                    </button>
                  </div>
                ) : (
                  <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#92400e', margin: '0 0 12px 0' }}>
                      You are logged in as <strong>{user.email}</strong>, but this invitation was sent to <strong>{preview.email}</strong>.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSwitchAccount}
                      style={{ width: '100%', fontSize: '13px', padding: '8px 12px' }}
                    >
                      Sign Out & Switch to {preview.email}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
