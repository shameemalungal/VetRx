import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth, type RegisterParams } from '../../context/AuthContext';
import { VetRxLogo } from '../../components/ui/VetRxLogo';
import './Auth.css';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

interface TeamMemberRow {
  name: string;
  email: string;
  role: 'VETERINARIAN' | 'PRACTICE_ADMIN' | 'STAFF' | 'READ_ONLY';
}

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const redirectUrl = params.get('redirect') || '/';
  let invitationToken: string | undefined;
  const inviteMatch = redirectUrl.match(/\/invite\/([a-zA-Z0-9_-]+)/);
  if (inviteMatch && inviteMatch[1]) {
    invitationToken = inviteMatch[1];
  }

  // Wizard state (Steps: 1: Type Selection, 2: Account Details, 3: Add Team)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [practiceType, setPracticeType] = useState<'INDEPENDENT' | 'CLINIC'>('INDEPENDENT');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isClinicalApprover, setIsClinicalApprover] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 3 Team Members
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([
    { name: '', email: '', role: 'STAFF' },
  ]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddTeamMember = () => {
    setTeamMembers([...teamMembers, { name: '', email: '', role: 'STAFF' }]);
  };

  const handleRemoveTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const handleUpdateTeamMember = (
    index: number,
    field: keyof TeamMemberRow,
    value: string
  ) => {
    const updated = [...teamMembers];
    (updated[index] as any)[field] = value;
    setTeamMembers(updated);
  };

  const executeRegistration = async (includeTeam: boolean) => {
    setErrorMessage(null);
    setLoading(true);

    try {
      const validTeam = includeTeam
        ? teamMembers.filter((tm) => tm.email && tm.email.trim().includes('@'))
        : [];

      const payload: RegisterParams = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        practiceName: practiceName.trim() || undefined,
        practiceType,
        isClinicalApprover: practiceType === 'INDEPENDENT' ? true : isClinicalApprover,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        teamMembers: validTeam.length > 0 ? validTeam : undefined,
        invitationToken,
      };

      await register(payload);
      navigate(redirectUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
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

    if (practiceType === 'INDEPENDENT') {
      await executeRegistration(false);
    } else {
      // Clinic setup moves to Step 3: Add Your Team
      setStep(3);
    }
  };

  const handleGoogleSignIn = () => {
    const safeReturnTo = redirectUrl.startsWith('/') && !redirectUrl.startsWith('//') ? redirectUrl : '/';
    window.location.href = `${API_BASE}/api/auth/google/start?returnTo=${encodeURIComponent(safeReturnTo)}`;
  };

  // If invited to an existing practice, display streamlined acceptance registration
  if (invitationToken) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo-badge">
              <VetRxLogo size={30} />
            </div>
            <h1 className="auth-title">Join Practice</h1>
            <p className="auth-subtitle">Create your account to accept your clinic invitation</p>
          </div>

          {errorMessage && (
            <div className="auth-error-banner" role="alert">
              {errorMessage}
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
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
                await register({
                  name: name.trim(),
                  email: email.trim().toLowerCase(),
                  password,
                  invitationToken,
                });
                navigate(redirectUrl);
              } catch (err: unknown) {
                setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
                setLoading(false);
              }
            }}
          >
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="invite-name">
                Full Name <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <input
                id="invite-name"
                type="text"
                required
                className="auth-input"
                placeholder="e.g. Dr. Anil Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="invite-email">
                Email Address <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <input
                id="invite-email"
                type="email"
                required
                className="auth-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="invite-password">
                Password (min 8 characters) <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <input
                id="invite-password"
                type="password"
                required
                minLength={8}
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="invite-confirm-password">
                Confirm Password <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <input
                id="invite-confirm-password"
                type="password"
                required
                className="auth-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-auth-submit" disabled={loading}>
              {loading ? 'Joining Practice...' : 'Create Account & Join Practice'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className={`auth-card ${step === 3 ? 'auth-card-wide' : ''}`}>
        <div className="auth-header">
          <div className="auth-logo-badge">
            <VetRxLogo size={30} />
          </div>
          <h1 className="auth-title">Create your VetRx practice</h1>
          <p className="auth-subtitle">
            {step === 1 && 'Welcome to VetRx — Choose your practice setup'}
            {step === 2 && (practiceType === 'INDEPENDENT' ? 'Independent Practitioner Profile' : 'Veterinary Clinic Details')}
            {step === 3 && 'Add your team members to get started'}
          </p>
        </div>

        {/* Step Progress Indicator */}
        <div className="onboarding-steps-indicator">
          <div className={`onboarding-step-dot ${step >= 1 ? (step === 1 ? 'active' : 'completed') : ''}`}>
            1
          </div>
          <div className="onboarding-step-line" />
          <div className={`onboarding-step-dot ${step >= 2 ? (step === 2 ? 'active' : 'completed') : ''}`}>
            2
          </div>
          {practiceType === 'CLINIC' && (
            <>
              <div className="onboarding-step-line" />
              <div className={`onboarding-step-dot ${step === 3 ? 'active' : ''}`}>
                3
              </div>
            </>
          )}
        </div>

        {errorMessage && (
          <div className="auth-error-banner" role="alert">
            {errorMessage}
          </div>
        )}

        {/* STEP 1: Practice Type Selection */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                What type of practice are you setting up?
              </p>
            </div>

            <div className="onboarding-type-options">
              <label
                className={`onboarding-type-card ${practiceType === 'INDEPENDENT' ? 'selected' : ''}`}
                onClick={() => setPracticeType('INDEPENDENT')}
              >
                <input
                  type="radio"
                  name="practiceType"
                  className="onboarding-type-radio"
                  checked={practiceType === 'INDEPENDENT'}
                  onChange={() => setPracticeType('INDEPENDENT')}
                />
                <div style={{ flex: 1 }}>
                  <div className="onboarding-type-title">Independent Practitioner</div>
                  <div className="onboarding-type-desc">For a veterinarian working independently.</div>
                  <span className="onboarding-badge">Owner + Practicing Veterinarian (1 Seat)</span>
                </div>
              </label>

              <label
                className={`onboarding-type-card ${practiceType === 'CLINIC' ? 'selected' : ''}`}
                onClick={() => setPracticeType('CLINIC')}
              >
                <input
                  type="radio"
                  name="practiceType"
                  className="onboarding-type-radio"
                  checked={practiceType === 'CLINIC'}
                  onChange={() => setPracticeType('CLINIC')}
                />
                <div style={{ flex: 1 }}>
                  <div className="onboarding-type-title">Veterinary Clinic</div>
                  <div className="onboarding-type-desc">For a clinic with multiple team members.</div>
                  <span className="onboarding-badge">Owner, Clinic Admin, Staff & Veterinarians</span>
                </div>
              </label>
            </div>

            <button
              type="button"
              className="btn-auth-submit"
              onClick={() => setStep(2)}
            >
              Continue &rarr;
            </button>

            <div className="auth-divider">or sign up with Google</div>

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
          </div>
        )}

        {/* STEP 2: Details */}
        {step === 2 && (
          <form className="auth-form" onSubmit={handleStep2Submit}>
            {practiceType === 'INDEPENDENT' ? (
              <>
                <div className="auth-form-group">
                  <label className="auth-label" htmlFor="reg-practitioner-name">
                    Practitioner Name <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    id="reg-practitioner-name"
                    type="text"
                    required
                    className="auth-input"
                    placeholder="e.g. Dr. Anil Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="auth-form-group">
                  <label className="auth-label" htmlFor="reg-practice-name">
                    Practice Name (Optional)
                  </label>
                  <input
                    id="reg-practice-name"
                    type="text"
                    className="auth-input"
                    placeholder="e.g. Dr. Anil's Veterinary Clinic"
                    value={practiceName}
                    onChange={(e) => setPracticeName(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="auth-form-group">
                  <label className="auth-label" htmlFor="reg-clinic-name">
                    Clinic Name <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    id="reg-clinic-name"
                    type="text"
                    required
                    className="auth-input"
                    placeholder="e.g. City Veterinary Hospital"
                    value={practiceName}
                    onChange={(e) => setPracticeName(e.target.value)}
                  />
                </div>

                <div className="auth-form-group">
                  <label className="auth-label" htmlFor="reg-owner-name">
                    Clinic Owner Name <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <input
                    id="reg-owner-name"
                    type="text"
                    required
                    className="auth-input"
                    placeholder="e.g. Dr. Rajesh Patel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="reg-phone">
                      Phone Number
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      className="auth-input"
                      placeholder="e.g. +91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label" htmlFor="reg-address">
                      Clinic Address
                    </label>
                    <input
                      id="reg-address"
                      type="text"
                      className="auth-input"
                      placeholder="e.g. Indiranagar, Bengaluru"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>

                {/* Practicing Veterinarian Checkbox for Clinic Owner */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '14px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ marginTop: '3px', accentColor: '#00685f' }}
                      checked={isClinicalApprover}
                      onChange={(e) => setIsClinicalApprover(e.target.checked)}
                    />
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                        Designate me as practicing veterinarian
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        Check this if you will be examining patients and approving prescriptions yourself. Consumes 1 clinical seat.
                      </div>
                    </div>
                  </label>
                </div>
              </>
            )}

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="reg-email">
                Login Email Address <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                className="auth-input"
                placeholder="doctor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="auth-form-group">
                <label className="auth-label" htmlFor="reg-password">
                  Password <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  className="auth-input"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="auth-form-group">
                <label className="auth-label" htmlFor="reg-confirm-password">
                  Confirm Password <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <input
                  id="reg-confirm-password"
                  type="password"
                  required
                  className="auth-input"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn-auth-submit"
                style={{ background: '#f1f5f9', color: '#475569', flex: 1 }}
                onClick={() => setStep(1)}
              >
                &larr; Back
              </button>
              <button
                type="submit"
                className="btn-auth-submit"
                style={{ flex: 2 }}
                disabled={loading}
              >
                {loading
                  ? 'Setting up...'
                  : practiceType === 'INDEPENDENT'
                  ? 'Complete & Enter Practice'
                  : 'Next: Add Your Team &rarr;'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Add Team Members (for Veterinary Clinic) */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
                You can invite your team now or skip and add them anytime later from <strong>Settings &rarr; Team</strong>.
              </p>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
              {teamMembers.map((tm, idx) => (
                <div key={idx} className="team-member-row">
                  <input
                    type="text"
                    className="auth-input"
                    style={{ padding: '8px 10px', fontSize: '13px' }}
                    placeholder="Name (e.g. Asha)"
                    value={tm.name}
                    onChange={(e) => handleUpdateTeamMember(idx, 'name', e.target.value)}
                  />
                  <input
                    type="email"
                    className="auth-input"
                    style={{ padding: '8px 10px', fontSize: '13px' }}
                    placeholder="Email (e.g. asha@example.com)"
                    value={tm.email}
                    onChange={(e) => handleUpdateTeamMember(idx, 'email', e.target.value)}
                  />
                  <select
                    className="auth-input"
                    style={{ padding: '8px 10px', fontSize: '13px', background: '#ffffff' }}
                    value={tm.role}
                    onChange={(e) =>
                      handleUpdateTeamMember(idx, 'role', e.target.value as any)
                    }
                  >
                    <option value="VETERINARIAN">Veterinarian</option>
                    <option value="PRACTICE_ADMIN">Clinic Admin</option>
                    <option value="STAFF">Staff</option>
                    <option value="READ_ONLY">Read Only</option>
                  </select>
                  {teamMembers.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove-row"
                      onClick={() => handleRemoveTeamMember(idx)}
                      title="Remove member"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="btn-add-member"
                onClick={handleAddTeamMember}
              >
                + Add Team Member
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="btn-auth-submit"
                onClick={() => executeRegistration(true)}
                disabled={loading}
              >
                {loading ? 'Creating Clinic & Sending Invites...' : 'Finish Setup & Send Invites'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-skip-link"
                  onClick={() => setStep(2)}
                >
                  &larr; Back to Details
                </button>

                <button
                  type="button"
                  className="btn-skip-link"
                  style={{ fontWeight: 600, color: '#00685f' }}
                  onClick={() => executeRegistration(false)}
                  disabled={loading}
                >
                  Skip for now &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
