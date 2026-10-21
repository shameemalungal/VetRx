// =============================================================
// VetRx — ClearStockModal.tsx
// Safe, auditable 2-step stock zeroing modal matching Stitch design.
// =============================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { inventoryApi, type ClearStockSummary } from '../../../services/inventoryApi';

interface ClearStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClearStockModal: React.FC<ClearStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [summary, setSummary] = useState<ClearStockSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [reason, setReason] = useState('');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!isOpen) {
      setSummary(null);
      setReason('');
      setConfirmationInput('');
      setError(null);
      setStep(1);
      return;
    }

    const loadSummary = async () => {
      try {
        setIsLoadingSummary(true);
        setError(null);
        const res = await inventoryApi.getClearStockSummary();
        setSummary(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve stock summary');
      } finally {
        setIsLoadingSummary(false);
      }
    };

    void loadSummary();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProceedToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for clearing current stock');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleExecuteClearStock = async () => {
    if (confirmationInput.trim() !== 'CLEAR STOCK') {
      setError('Please type CLEAR STOCK exactly to confirm');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await inventoryApi.clearAllStock(reason.trim());
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to clear stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '560px', width: '100%', borderRadius: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #fee2e2',
            background: '#fef2f2',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="warning" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                Clear All Current Stock
              </h2>
              <span style={{ fontSize: '12px', color: '#b91c1c' }}>
                Practice: <strong>{summary?.practiceName || 'Current Practice'}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{ color: '#991b1b' }}
            disabled={isSubmitting}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Icon name="alert-circle" size={16} />
              <span>{error}</span>
            </div>
          )}

          {isLoadingSummary ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
              <span>Loading stock impact analysis...</span>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>
                    AFFECTED ITEMS
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    {summary?.affectedItemsCount ?? 0}
                  </span>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>
                    ACTIVE BATCHES
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    {summary?.affectedBatchesCount ?? 0}
                  </span>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>
                    TOTAL UNITS
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626' }}>
                    {summary?.totalCurrentQuantity ?? 0}
                  </span>
                </div>
              </div>

              {/* Data Retention Guarantee */}
              <div
                style={{
                  background: '#f0fdfa',
                  border: '1px solid #ccfbf1',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f766e', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>
                  <Icon name="check-circle" size={14} />
                  <span>Audit &amp; Historical Data Preservation</span>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#134e4a', lineHeight: 1.4 }}>
                  {summary?.retainedInformation ||
                    'All product items, purchase invoices, suppliers, and transaction ledger histories will be permanently retained. Current batch quantities will be zeroed with an auditable CLEAR_ALL_STOCK transaction entry.'}
                </p>
              </div>

              {step === 1 ? (
                <form onSubmit={handleProceedToConfirmation}>
                  <div style={{ marginBottom: '16px' }}>
                    <label
                      htmlFor="clear-stock-reason"
                      style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                    >
                      Reason for clearing stock *
                    </label>
                    <textarea
                      id="clear-stock-reason"
                      className="form-input"
                      rows={3}
                      placeholder="e.g., Annual inventory count reset, migration to electronic invoices, or physical audit recalibration..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                      Cancel
                    </button>
                    <button type="submit" className="btn" style={{ background: '#dc2626', color: '#fff' }}>
                      Continue to Step 2
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div
                    style={{
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '8px',
                      padding: '14px',
                      marginBottom: '16px',
                    }}
                  >
                    <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#881337', fontWeight: 600 }}>
                      Final Confirmation: This operation will set all {summary?.affectedBatchesCount ?? 0} batches to 0.
                    </p>
                    <label
                      htmlFor="clear-stock-confirm-input"
                      style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px' }}
                    >
                      To confirm, type <strong>CLEAR STOCK</strong> below:
                    </label>
                    <input
                      id="clear-stock-confirm-input"
                      type="text"
                      className="form-input"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      placeholder="CLEAR STOCK"
                      autoComplete="off"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setStep(1)}
                      disabled={isSubmitting}
                    >
                      Back
                    </button>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          background: confirmationInput.trim() === 'CLEAR STOCK' ? '#b91c1c' : '#cbd5e1',
                          color: '#ffffff',
                          cursor: confirmationInput.trim() === 'CLEAR STOCK' ? 'pointer' : 'not-allowed',
                        }}
                        onClick={handleExecuteClearStock}
                        disabled={confirmationInput.trim() !== 'CLEAR STOCK' || isSubmitting}
                      >
                        {isSubmitting ? 'Clearing Stock...' : 'Confirm & Clear Stock'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
