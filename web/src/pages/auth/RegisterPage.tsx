import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { VetRxLogo } from '../../components/ui/VetRxLogo';
import './Auth.css';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password, practiceName);
      navigate('/');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE}/api/auth/google/start`;
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <VetRxLogo size={30} />
          </div>
          <h1 className="auth-title">Create Practice Account</h1>
          <p className="auth-subtitle">Set up your veterinary practice and practitioner profile</p>
        </div>

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            {errorMessage}
          </div>
        )}

        {/* Continue with Google */}
        <button
          type="button"
          className="btn-google"
          onClick={handleGoogleSignIn}
          aria-label="Sign up with Google"
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
          Sign up with Google
        </button>

        <div className="auth-divider">or register with email</div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label className="auth-label" htmlFor="register-name">
              Doctor / Practitioner Name <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <input
              id="register-name"
              type="text"
              required
              autoComplete="name"
              className="auth-input"
              placeholder="e.g. Dr. Ahmed Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="auth-form-group">
            <label className="auth-label" htmlFor="register-practice-name">
              Practice / Clinic Name (Optional)
            </label>
            <input
              id="register-practice-name"
              type="text"
              className="auth-input"
              placeholder="e.g. Companion Care Veterinary Clinic"
              value={practiceName}
              onChange={(e) => setPracticeName(e.target.value)}
            />
          </div>

          <div className="auth-form-group">
            <label className="auth-label" htmlFor="register-email">
              Email Address <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <input
              id="register-email"
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
            <label className="auth-label" htmlFor="register-password">
              Password (Min. 8 characters) <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <input
              id="register-password"
              type="password"
              required
              autoComplete="new-password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="auth-form-group">
            <label className="auth-label" htmlFor="register-confirm-password">
              Confirm Password <span style={{ color: '#e11d48' }}>*</span>
            </label>
            <input
              id="register-confirm-password"
              type="password"
              required
              autoComplete="new-password"
              className="auth-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-auth-submit" disabled={loading}>
            {loading ? 'Creating Practice…' : 'Create Practice Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => navigate('/login')}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};
