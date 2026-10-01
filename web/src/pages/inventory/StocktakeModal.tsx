// =============================================================
// VetRx — StocktakeModal.tsx
// Physical inventory audit and variance reconciliation.
// =============================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { inventoryApi } from '../../services/inventoryApi';

interface StocktakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StocktakeRow {
  itemId: string;
  itemName: string;
  category: string;
  stockUnit: string;
  batchId?: string;
  batchNumber?: string;
  systemQuantity: number;
  physicalQuantity: number;
  reason: string;
}

export const StocktakeModal: React.FC<StocktakeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [rows, setRows] = useState<StocktakeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void (async () => {
        try {
          setIsLoading(true);
          const [itemsRes, batchesRes] = await Promise.all([
            inventoryApi.getItems(),
            inventoryApi.getBatches(),
          ]);

          const itemMap = new Map((itemsRes.items || []).map((i) => [i.id, i]));
          const batchList = batchesRes.batches || [];

          const initialRows: StocktakeRow[] = [];

          if (batchList.length > 0) {
            batchList.forEach((b) => {
              const item = itemMap.get(b.itemId);
              if (item) {
                initialRows.push({
                  itemId: item.id,
                  itemName: item.name,
                  category: item.category,
                  stockUnit: item.stockUnit,
                  batchId: b.id,
                  batchNumber: b.batchNumber,
                  systemQuantity: b.quantity,
                  physicalQuantity: b.quantity,
                  reason: 'Physical Stocktake Reconciliation',
                });
              }
            });
          } else {
            (itemsRes.items || []).forEach((item) => {
              initialRows.push({
                itemId: item.id,
                itemName: item.name,
                category: item.category,
                stockUnit: item.stockUnit,
                systemQuantity: item.totalStock || 0,
                physicalQuantity: item.totalStock || 0,
                reason: 'Physical Stocktake Reconciliation',
              });
            });
          }

          setRows(initialRows);
        } catch (err: any) {
          setError(err?.message || 'Failed to initialize stocktake');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updatePhysicalQty = (index: number, val: number) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], physicalQuantity: Math.max(0, val) };
      return next;
    });
  };

  const updateReason = (index: number, val: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], reason: val };
      return next;
    });
  };

  const discrepancies = rows.filter((r) => r.physicalQuantity !== r.systemQuantity);

  const handleSubmit = async () => {
    if (discrepancies.length === 0) {
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await inventoryApi.performStocktake({
        items: discrepancies.map((d) => ({
          itemId: d.itemId,
          batchId: d.batchId,
          physicalQuantity: d.physicalQuantity,
          reason: d.reason || 'Counting correction (Stocktake)',
        })),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to reconcile stocktake');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inv-modal-overlay">
      <div className="inv-modal-card modal-large">
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
              <Icon name="check-circle" size={18} />
            </div>
            <div>
              <h2 className="inv-modal-title">Physical Stocktake & Reconciliation</h2>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Default Location: <strong>Main Stock</strong>
              </span>
            </div>
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

        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading stock levels...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No inventory items found.</div>
          ) : (
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Item & Batch</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>System Qty</th>
                  <th style={{ textAlign: 'center' }}>Physical Count</th>
                  <th style={{ textAlign: 'center' }}>Variance</th>
                  <th>Audit Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const diff = row.physicalQuantity - row.systemQuantity;
                  return (
                    <tr key={`${row.itemId}-${row.batchId || idx}`}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.itemName}</div>
                        {row.batchNumber && (
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            Batch: {row.batchNumber}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>{row.category}</span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>
                        {row.systemQuantity} {row.stockUnit}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ width: '90px', textAlign: 'center', padding: '4px 8px' }}
                          value={row.physicalQuantity}
                          onChange={(e) => updatePhysicalQty(idx, Number(e.target.value))}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: diff === 0 ? '#f1f5f9' : diff < 0 ? '#fee2e2' : '#dcfce7',
                            color: diff === 0 ? '#64748b' : diff < 0 ? '#dc2626' : '#15803d',
                          }}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                          value={row.reason}
                          onChange={(e) => updateReason(idx, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div
          style={{
            padding: '12px 16px',
            background: discrepancies.length > 0 ? '#fffbeb' : '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <div>
            Discrepancies Detected: <strong style={{ color: discrepancies.length > 0 ? '#b45309' : '#15803d' }}>{discrepancies.length}</strong> items
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Confirmed changes will generate immutable audit transactions in the stock ledger.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || isLoading}
            id="btn-confirm-stocktake"
          >
            {isSubmitting
              ? 'Reconciling Ledger...'
              : discrepancies.length > 0
              ? `Reconcile ${discrepancies.length} Discrepancies`
              : 'Finish (No Discrepancies)'}
          </button>
        </div>
      </div>
    </div>
  );
};
