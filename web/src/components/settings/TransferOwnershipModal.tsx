// ==============================================================================
// VetRx — Transfer Ownership Modal (Phase 14)
// High-security dialog for atomic practice ownership transfer with explicit confirmation.
// ==============================================================================

import React, { useState } from 'react';
import { Icon } from '../ui/Icon';

interface MemberOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  members: MemberOption[];
  currentUserId: string;
}

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const TransferOwnershipModal: React.FC<TransferOwnershipModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  members,
  currentUserId: _currentUserId,
}) => {
  const eligibleCandidates = members.filter((m) => m.role !== 'PRACTICE_OWNER');

  const [targetMemberId, setTargetMemberId] = useState<string>(eligibleCandidates[0]?.id || '');
  const [previousOwnerRole, setPreviousOwnerRole] = useState<'PRACTICE_ADMIN' | 'VETERINARIAN' | 'STAFF' | 'READ_ONLY'>('PRACTICE_ADMIN');
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmKeyword.trim().toUpperCase() === 'TRANSFER';

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) return;
    if (!targetMemberId) {
      setError('Please select an eligible member to receive ownership.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/practice/ownership/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targetMemberId, previousOwnerRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Ownership transfer failed.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during ownership transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-md, 12px)',
          boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.15))',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="transfer-modal-title" style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--color-error, #ba1a1a)' }}>
            Transfer Practice Ownership
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
            aria-label="Close modal"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(186, 26, 26, 0.08)',
            border: '1px solid rgba(186, 26, 26, 0.25)',
            borderRadius: 'var(--radius-sm, 8px)',
            marginBottom: '18px',
            fontSize: '13px',
            color: 'var(--color-error, #ba1a1a)',
            lineHeight: 1.45,
          }}
        >
          <strong>Warning: Irreversible Administrative Action</strong>
          <p style={{ margin: '4px 0 0 0' }}>
            Transferring ownership assigns full administrative and commercial authority over this practice to the selected member.
            You will become a {previousOwnerRole.replace('_', ' ')} and cannot reverse this action without the new owner's consent.
          </p>
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

        <form onSubmit={handleTransfer}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="target-member" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Select New Practice Owner <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
            </label>
            {eligibleCandidates.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                No eligible practice members available. Please invite and onboard a colleague first.
              </p>
            ) : (
              <select
                id="target-member"
                className="form-control"
                value={targetMemberId}
                onChange={(e) => setTargetMemberId(e.target.value)}
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
                {eligibleCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) — Currently {c.role}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="previous-role" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Your New Role After Transfer <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
            </label>
            <select
              id="previous-role"
              className="form-control"
              value={previousOwnerRole}
              onChange={(e) => setPreviousOwnerRole(e.target.value as any)}
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
              <option value="PRACTICE_ADMIN">Practice Administrator</option>
              <option value="VETERINARIAN">Veterinarian</option>
              <option value="STAFF">Staff</option>
              <option value="READ_ONLY">Read Only</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="confirm-keyword" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
              Type <strong>TRANSFER</strong> to confirm:
            </label>
            <input
              id="confirm-keyword"
              type="text"
              className="form-control"
              value={confirmKeyword}
              onChange={(e) => setConfirmKeyword(e.target.value)}
              placeholder="TRANSFER"
              required
              disabled={isSubmitting || eligibleCandidates.length === 0}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm, 8px)',
                border: '1px solid var(--color-outline, #c2c7ce)',
                fontSize: '14px',
              }}
            />
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
              className="btn"
              disabled={!isConfirmed || isSubmitting || eligibleCandidates.length === 0}
              style={{
                minHeight: '44px',
                padding: '0 20px',
                background: isConfirmed ? 'var(--color-error, #ba1a1a)' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm, 8px)',
                fontWeight: 600,
                cursor: isConfirmed ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSubmitting ? (
                <span>Transferring...</span>
              ) : (
                <>
                  <Icon name="check" size={16} />
                  <span>Confirm Ownership Transfer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
