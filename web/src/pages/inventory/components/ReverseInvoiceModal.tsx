// =============================================================
// VetRx — ReverseInvoiceModal.tsx
// Reverse purchase invoice modal with dependency verification and reason capture.
// =============================================================

import React, { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { inventoryApi, type PurchaseInvoice } from '../../../services/inventoryApi';

interface ReverseInvoiceModalProps {
  invoice: PurchaseInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReverseInvoiceModal: React.FC<ReverseInvoiceModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !invoice) return null;

  const isAlreadyReversed = Boolean(
    invoice.notes?.includes('[REVERSED') || (invoice as any).status === 'REVERSED'
  );

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for reversing this purchase invoice');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await inventoryApi.reversePurchaseInvoice(invoice.id, reason.trim());
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to reverse purchase invoice';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '600px', width: '100%', borderRadius: '16px' }}>
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
              <Icon name="arrow-back" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                Reverse Purchase Invoice
              </h2>
              <span style={{ fontSize: '12px', color: '#b91c1c' }}>
                Invoice #{invoice.invoiceNumber} • {invoice.supplierName}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" disabled={isSubmitting}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <Icon name="alert-circle" size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600 }}>Reversal Blocked</div>
                <div>{error}</div>
                {error.includes('consumed') && (
                  <div style={{ marginTop: '6px', fontSize: '12px', color: '#7f1d1d' }}>
                    Tip: Use <strong>Stock Adjustment</strong> or <strong>Review by Date</strong> to make a compensating entry without violating batch balance constraints.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoice Summary Details */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px', fontSize: '12px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>SUPPLIER</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{invoice.supplierName}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>INVOICE DATE</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{invoice.invoiceDate}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>TOTAL AMOUNT</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  ₹{invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Line items list */}
            <div style={{ fontSize: '12px', color: '#475569', fontWeight: 600, marginBottom: '6px' }}>
              Items to be reversed from stock:
            </div>
            <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>ITEM</th>
                    <th style={{ padding: '6px 10px' }}>BATCH</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>QTY</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items || []).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 500 }}>{it.medicineName || it.name || 'Item'}</td>
                      <td style={{ padding: '6px 10px', color: '#64748b' }}>{it.batchNumber || '—'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                        -{it.quantity}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        ₹{(it.purchaseRate ?? it.unitPrice ?? 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Preservation Notice */}
          <div
            style={{
              background: '#f0fdfa',
              border: '1px solid #ccfbf1',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icon name="check-circle" size={14} style={{ flexShrink: 0 }} />
            <span>
              The invoice document and audit trail are preserved. Reversal will record an auditable REVERSAL transaction in the inventory ledger.
            </span>
          </div>

          {isAlreadyReversed ? (
            <div
              style={{
                padding: '14px',
                background: '#fef9c3',
                border: '1px solid #fde047',
                borderRadius: '8px',
                color: '#854d0e',
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              This invoice has already been reversed. Duplicate reversals are strictly prevented.
            </div>
          ) : (
            <form onSubmit={handleReverse}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  htmlFor="reverse-invoice-reason"
                  style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                >
                  Reason for invoice reversal *
                </label>
                <textarea
                  id="reverse-invoice-reason"
                  className="form-input"
                  rows={2}
                  placeholder="e.g., Wrong supplier billing, duplicate entry uploaded, or returned order..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ background: '#dc2626', color: '#ffffff' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Reversing Stock...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
