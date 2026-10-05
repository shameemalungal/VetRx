// =============================================================
// VetRx — OpeningStockModal.tsx
// Records Opening Stock for items without requiring a supplier invoice.
// =============================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { inventoryApi, type InventoryItem } from '../../services/inventoryApi';
import { syncInventoryMedicinesToFormulary } from '../../services/inventorySync';

interface OpeningStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedItemId?: string;
}

export const OpeningStockModal: React.FC<OpeningStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedItemId,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(preselectedItemId || '');
  const [batchNumber, setBatchNumber] = useState('');
  const [manufacturingDate, setManufacturingDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [unitCost, setUnitCost] = useState(50);
  const [mrp, setMrp] = useState(75);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void (async () => {
        try {
          setIsLoadingItems(true);
          const res = await inventoryApi.getItems();
          setItems(res.items || []);
          if (preselectedItemId) {
            setSelectedItemId(preselectedItemId);
          } else if (res.items?.length > 0 && !selectedItemId) {
            setSelectedItemId(res.items[0].id);
          }
        } catch (err: any) {
          setError(err?.message || 'Failed to load items');
        } finally {
          setIsLoadingItems(false);
        }
      })();
    }
  }, [isOpen, preselectedItemId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      setError('Please select an item');
      return;
    }
    if (!batchNumber.trim()) {
      setError('Batch number is required');
      return;
    }
    if (!expiryDate) {
      setError('Expiry date is required');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await inventoryApi.addOpeningStock({
        itemId: selectedItemId,
        batchNumber: batchNumber.trim(),
        manufacturingDate: manufacturingDate || undefined,
        expiryDate,
        quantity: Number(quantity),
        unitCost: Number(unitCost) || 0,
        mrp: Number(mrp) || undefined,
      });

      try {
        await syncInventoryMedicinesToFormulary();
      } catch {}

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add opening stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedItemId);

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
                background: 'rgba(0, 104, 95, 0.1)',
                color: 'var(--color-primary, #00685f)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="database" size={18} />
            </div>
            <h2 className="inv-modal-title">Enter Opening Stock</h2>
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
            <label className="form-label" htmlFor="inv-select-item">
              Inventory Item *
            </label>
            <select
              id="inv-select-item"
              className="form-input"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              disabled={isLoadingItems}
              required
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.category}) - {item.presentation || item.stockUnit}
                </option>
              ))}
            </select>
            {selectedItem && (
              <span className="form-hint" style={{ marginTop: '4px', display: 'block' }}>
                Stock Unit: <strong>{selectedItem.stockUnit}</strong> | Min: {selectedItem.minimumStockLevel} | Target:{' '}
                {selectedItem.targetStockLevel}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label className="form-label" htmlFor="inv-batch-no">
                Batch Number *
              </label>
              <input
                id="inv-batch-no"
                type="text"
                className="form-input"
                placeholder="e.g. OPG472 or BATCH-01"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-expiry-date">
                Expiry Date *
              </label>
              <input
                id="inv-expiry-date"
                type="date"
                className="form-input"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-mfg-date">
                Mfg Date (Optional)
              </label>
              <input
                id="inv-mfg-date"
                type="date"
                className="form-input"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <div>
              <label className="form-label" htmlFor="inv-quantity">
                Initial Units *
              </label>
              <input
                id="inv-quantity"
                type="number"
                min="1"
                className="form-input"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-unit-cost">
                Purchase Cost (₹) *
              </label>
              <input
                id="inv-unit-cost"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-mrp">
                MRP (₹ Optional)
              </label>
              <input
                id="inv-mrp"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={mrp}
                onChange={(e) => setMrp(Number(e.target.value))}
              />
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '13px',
              color: '#475569',
            }}
          >
            Opening Stock Valuation: <strong style={{ color: '#0f172a' }}>₹{(quantity * unitCost).toLocaleString('en-IN')}</strong>{' '}
            (Calculated at Purchase Cost ₹{unitCost} × {quantity} {selectedItem?.stockUnit || 'units'}).
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-save-opening-stock">
              {isSubmitting ? 'Posting Opening Stock...' : 'Confirm Opening Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
