import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { VetRxLogo } from '../../components/ui/VetRxLogo';
import './Auth.css';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode: 'login' | 'forgot_request' | 'forgot_verify'
  const [viewMode, setViewMode] = useState<'login' | 'forgot_request' | 'forgot_verify'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('error');
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      await login(email, password);
      const params = new URLSearchParams(location.search);
      const redirectUrl = params.get('redirect') || '/';
      navigate(redirectUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    const params = new URLSearchParams(location.search);
    const redirectUrl = params.get('redirect') || '/';
    const safeReturnTo = redirectUrl.startsWith('/') && !redirectUrl.startsWith('//') ? redirectUrl : '/';
    window.location.href = `${API_BASE}/api/auth/google/start?returnTo=${encodeURIComponent(safeReturnTo)}`;
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send verification code.');
      }
      setSuccessMessage(data.message || 'Verification code sent if this account exists.');
      setViewMode('forgot_verify');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error sending verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Password reset failed.');
      }
      setSuccessMessage('Password reset successfully. You can now sign in with your new password.');
      setPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setViewMode('login');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <VetRxLogo size={30} />
          </div>
          <h1 className="auth-title">
            {viewMode === 'login' && 'Welcome to VetRx'}
            {viewMode === 'forgot_request' && 'Reset Your Password'}
            {viewMode === 'forgot_verify' && 'Verify Code & Set Password'}
          </h1>
          <p className="auth-subtitle">
            {viewMode === 'login' && 'Sign in to access your veterinary practice'}
            {viewMode === 'forgot_request' && 'Enter your email to receive a 6-digit verification code'}
            {viewMode === 'forgot_verify' && `Enter the 6-digit code sent to ${email}`}
          </p>
        </div>

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="auth-success-banner" role="status">
            {successMessage}
          </div>
        )}

        {/* MODE: LOGIN */}
        {viewMode === 'login' && (
          <>
            {/* Continue with Google */}
            <button
              type="button"
              className="btn-google"
              onClick={handleGoogleSignIn}
              aria-label="Continue with Google"
            >
              <svg className="google-icon" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="auth-divider">or continue with email</div>

            {/* Email / Password Form */}
            <form className="auth-form" onSubmit={handleLoginSubmit}>
              <div className="auth-form-group">
                <label className="auth-label" htmlFor="login-email">
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  className="auth-input"
                  placeholder="doctor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="auth-form-group">
                <div className="auth-field-header">
                  <label className="auth-label" htmlFor="login-password">
                    Password
                  </label>
                  <button
                    type="button"
                    className="auth-text-btn"
                    onClick={() => {
                      setErrorMessage(null);
                      setSuccessMessage(null);
                      setViewMode('forgot_request');
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="auth-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-auth-submit" disabled={loading}>
                {loading ? 'Signing In…' : 'Sign In'}
              </button>
            </form>

            <div className="auth-footer">
              Don't have an account?{' '}
              <button
                type="button"
                className="auth-link"
                onClick={() => navigate('/register')}
              >
                Create an account
              </button>
            </div>
          </>
        )}

        {/* MODE: FORGOT_REQUEST */}
        {viewMode === 'forgot_request' && (
          <form className="auth-form" onSubmit={handleRequestOtp}>
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="forgot-email">
                Registered Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                className="auth-input"
                placeholder="doctor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-auth-submit" disabled={loading}>
              {loading ? 'Sending Code…' : 'Send Verification Code'}
            </button>

            <div className="auth-footer">
              <button
                type="button"
                className="auth-text-btn"
                style={{ fontSize: '14px' }}
                onClick={() => {
                  setErrorMessage(null);
                  setViewMode('login');
                }}
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* MODE: FORGOT_VERIFY */}
        {viewMode === 'forgot_verify' && (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="reset-otp">
                6-Digit Verification Code
              </label>
              <input
                id="reset-otp"
                type="text"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                className="auth-input"
                placeholder="123456"
                style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center', fontWeight: 'bold' }}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="reset-new-password">
                New Password (min 8 characters)
              </label>
              <input
                id="reset-new-password"
                type="password"
                required
                minLength={8}
                className="auth-input"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="reset-confirm-password">
                Confirm New Password
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                required
                minLength={8}
                className="auth-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-auth-submit" disabled={loading}>
              {loading ? 'Resetting Password…' : 'Set New Password'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              <button
                type="button"
                className="auth-text-btn"
                onClick={handleRequestOtp}
                disabled={loading}
              >
                Resend Code
              </button>
              <button
                type="button"
                className="auth-text-btn"
                onClick={() => {
                  setErrorMessage(null);
                  setViewMode('login');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
