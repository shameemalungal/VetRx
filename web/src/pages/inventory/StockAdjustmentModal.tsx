// =============================================================
// VetRx — StockAdjustmentModal.tsx
// Manual stock adjustment with mandatory audit reasons.
// =============================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { inventoryApi, type InventoryItem, type InventoryBatch } from '../../services/inventoryApi';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedItemId?: string;
  preselectedBatchId?: string;
}

const ADJUSTMENT_REASONS = [
  'Damaged',
  'Expired',
  'Wastage',
  'Spillage',
  'Missing',
  'Counting correction',
  'Other',
] as const;

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedItemId,
  preselectedBatchId,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(preselectedItemId || '');
  const [selectedBatchId, setSelectedBatchId] = useState(preselectedBatchId || '');
  const [adjustmentType, setAdjustmentType] = useState<'DEDUCT' | 'ADD'>('DEDUCT');
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState<string>('Damaged');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void (async () => {
        try {
          setIsLoading(true);
          const res = await inventoryApi.getItems();
          setItems(res.items || []);
          const initItemId = preselectedItemId || (res.items?.[0]?.id ?? '');
          setSelectedItemId(initItemId);
          if (initItemId) {
            const batchRes = await inventoryApi.getBatches({ itemId: initItemId });
            setBatches(batchRes.batches || []);
            if (preselectedBatchId) {
              setSelectedBatchId(preselectedBatchId);
            } else if (batchRes.batches?.length > 0) {
              setSelectedBatchId(batchRes.batches[0].id);
            }
          }
        } catch (err: any) {
          setError(err?.message || 'Failed to load items');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen, preselectedItemId, preselectedBatchId]);

  const handleItemChange = async (itemId: string) => {
    setSelectedItemId(itemId);
    try {
      const batchRes = await inventoryApi.getBatches({ itemId });
      setBatches(batchRes.batches || []);
      setSelectedBatchId(batchRes.batches?.[0]?.id || '');
    } catch {
      setBatches([]);
    }
  };

  if (!isOpen) return null;

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const currentQuantity = selectedBatch ? selectedBatch.quantity : 0;
  const quantityChange = adjustmentType === 'DEDUCT' ? -Math.abs(amount) : Math.abs(amount);
  const resultingQuantity = Math.max(0, currentQuantity + quantityChange);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      setError('Please select an item');
      return;
    }
    if (!reason) {
      setError('Adjustment reason is mandatory');
      return;
    }
    if (amount <= 0) {
      setError('Adjustment quantity must be greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await inventoryApi.adjustStock({
        itemId: selectedItemId,
        batchId: selectedBatchId || undefined,
        quantityChange,
        reason,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to adjust stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inv-modal-overlay">
      <div className="inv-modal-card">
        <div className="inv-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="edit" size={18} />
            </div>
            <h2 className="inv-modal-title">Manual Stock Adjustment</h2>
          </div>
          <button type="button" className="inv-close-btn" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>

        {error && (
          <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
            <Icon name="alert-triangle" size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" htmlFor="adj-item">
              Item *
            </label>
            <select
              id="adj-item"
              className="form-input"
              value={selectedItemId}
              onChange={(e) => void handleItemChange(e.target.value)}
              disabled={isLoading}
              required
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="adj-batch">
              Batch
            </label>
            <select
              id="adj-batch"
              className="form-input"
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
            >
              {batches.length === 0 ? (
                <option value="">No active batches (Stock: 0)</option>
              ) : (
                batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    Batch {b.batchNumber} (Current: {b.quantity}, Exp: {b.expiryDate.split('T')[0]})
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <div>
              <label className="form-label">Adjustment Mode</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn ${adjustmentType === 'DEDUCT' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
                  onClick={() => setAdjustmentType('DEDUCT')}
                >
                  - Deduct
                </button>
                <button
                  type="button"
                  className={`btn ${adjustmentType === 'ADD' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
                  onClick={() => setAdjustmentType('ADD')}
                >
                  + Add
                </button>
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="adj-amount">
                Units Change *
              </label>
              <input
                id="adj-amount"
                type="number"
                min="1"
                className="form-input"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="adj-reason">
                Reason (Mandatory) *
              </label>
              <select
                id="adj-reason"
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label" htmlFor="adj-notes">
              Audit Notes / Incident Details
            </label>
            <input
              id="adj-notes"
              type="text"
              className="form-input"
              placeholder="e.g. Vial dropped during morning round"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              Current Quantity: <strong>{currentQuantity}</strong>
            </div>
            <div>
              Change:{' '}
              <strong style={{ color: quantityChange < 0 ? '#dc2626' : '#16a34a' }}>
                {quantityChange > 0 ? `+${quantityChange}` : quantityChange}
              </strong>
            </div>
            <div>
              After Adjustment: <strong style={{ color: '#0f172a' }}>{resultingQuantity}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-save-stock-adjustment">
              {isSubmitting ? 'Recording Adjustment...' : 'Record Audit Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
