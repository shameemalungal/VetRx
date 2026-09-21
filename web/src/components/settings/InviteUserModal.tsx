// ==============================================================================
// VetRx — Invite User Modal (Phase 14)
// Secure invitation dialog displaying commercial seat quotas and role selection.
// ==============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../ui/Icon';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (invitation: any) => void;
  planName?: string;
  maxVeterinarians?: number | null;
  usedVeterinarians?: number;
}

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  planName = 'Clinic Plan',
  maxVeterinarians = 5,
  usedVeterinarians = 1,
}) => {
  const { isPracticeOwner } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'PRACTICE_ADMIN' | 'VETERINARIAN' | 'STAFF' | 'READ_ONLY'>('STAFF');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isVetCapReached = maxVeterinarians !== null && usedVeterinarians >= maxVeterinarians;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (role === 'VETERINARIAN' && isVetCapReached) {
      setError(`Cannot invite a Veterinarian. Your ${planName} is at capacity (${usedVeterinarians} / ${maxVeterinarians}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/practice/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to send invitation.');
      }

      onSuccess(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending the invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-md, 12px)',
          boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="invite-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-on-surface)' }}>
            Invite Practice Member
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-on-surface-variant)',
              padding: '4px',
            }}
            aria-label="Close modal"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Commercial Seat Quota Banner */}
        <div
          style={{
            background: 'var(--color-surface-variant, #f0f4f8)',
            borderRadius: 'var(--radius-sm, 8px)',
            padding: '12px 14px',
            marginBottom: '18px',
            border: '1px solid var(--color-outline-variant, #e1e7ec)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-primary, #006684)' }}>{planName}</span>
            <span style={{ color: 'var(--color-on-surface-variant)' }}>
              Veterinarians: <strong>{usedVeterinarians}</strong> / {maxVeterinarians ?? '∞'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
            Staff & Read-Only Seats: <strong style={{ color: '#137333' }}>Unlimited</strong>
          </div>
          {isVetCapReached && (
            <div
              style={{
                marginTop: '8px',
                padding: '6px 8px',
                background: 'rgba(217, 48, 37, 0.1)',
                color: '#d93025',
                fontSize: '11.5px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Icon name="alert-triangle" size={14} />
              <span>Veterinarian limit reached. Upgrade to Clinic plan to add more veterinarians.</span>
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm, 6px)',
              background: 'rgba(186, 26, 26, 0.1)',
              color: 'var(--color-error, #ba1a1a)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="invite-email" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Email Address <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
            </label>
            <input
              id="invite-email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@clinic.com"
              required
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid var(--color-outline, #c2c7ce)',
                fontSize: '14px',
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="invite-role" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Practice Role <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
            </label>
            <select
              id="invite-role"
              className="form-control"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid var(--color-outline, #c2c7ce)',
                fontSize: '14px',
                background: '#fff',
              }}
            >
              {isPracticeOwner() && <option value="PRACTICE_ADMIN">Practice Administrator</option>}
              <option value="VETERINARIAN" disabled={isVetCapReached}>
                Veterinarian {isVetCapReached ? '(Seat limit reached)' : ''}
              </option>
              <option value="STAFF">Staff (Operational & Front Desk)</option>
              <option value="READ_ONLY">Read Only (Observer / Auditor)</option>
            </select>
            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', display: 'block', marginTop: '4px' }}>
              {role === 'PRACTICE_ADMIN' && 'Can manage clinic operations, staff users, and permitted practice settings.'}
              {role === 'VETERINARIAN' && 'Can create clinical records, write prescriptions, and manage medical workflows.'}
              {role === 'STAFF' && 'Can view clinical records, register owners/patients, and manage operational invoices.'}
              {role === 'READ_ONLY' && 'Can view records and reports without mutation permissions.'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ minHeight: '44px', padding: '0 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || (role === 'VETERINARIAN' && isVetCapReached)}
              style={{ minHeight: '44px', padding: '0 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmitting ? (
                <span>Sending...</span>
              ) : (
                <>
                  <Icon name="mail" size={16} />
                  <span>Send Invitation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
