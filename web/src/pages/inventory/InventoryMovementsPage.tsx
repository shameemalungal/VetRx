// =============================================================
// VetRx — InventoryMovementsPage.tsx
// Immutable stock transaction audit ledger.
// =============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { InventoryHeader, InventorySubnav } from './InventoryHeader';
import {
  inventoryApi,
  type InventoryTransaction,
} from '../../services/inventoryApi';
import './Inventory.css';

export const InventoryMovementsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await inventoryApi.getTransactions({ limit: 100 });
      setTransactions(res.transactions || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load stock movements');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const filtered = transactions.filter((t) => {
    if (filterType === 'ALL') return true;
    return t.transactionType === filterType;
  });

  const getTxBadge = (type: string) => {
    switch (type) {
      case 'OPENING_STOCK':
        return <span className="inv-status-pill" style={{ background: '#e0f2fe', color: '#0369a1' }}>OPENING STOCK</span>;
      case 'PURCHASE':
        return <span className="inv-status-pill inv-status-in_stock">+ PURCHASE</span>;
      case 'SALE_OR_INVOICE':
        return <span className="inv-status-pill" style={{ background: '#f3e8ff', color: '#7e22ce' }}>- SALE / INVOICE</span>;
      case 'STOCK_ADJUSTMENT':
        return <span className="inv-status-pill inv-status-low_stock">ADJUSTMENT</span>;
      case 'REVERSAL':
        return <span className="inv-status-pill" style={{ background: '#ecfdf5', color: '#047857' }}>↺ REVERSAL</span>;
      case 'EXPIRED':
      case 'DAMAGED':
      case 'WASTAGE':
        return <span className="inv-status-pill inv-status-out_of_stock">- {type}</span>;
      default:
        return <span className="inv-status-pill inv-status-expired">{type}</span>;
    }
  };

  return (
    <div className="inventory-page-container">
      <InventoryHeader
        title="Stock Movements & Ledger"
        subtitle="Complete immutable audit trail of all physical stock movements, purchases & clinical deductions"
      />

      <InventorySubnav />

      {/* Filter Chips */}
      <div className="inventory-category-tabs">
        {['ALL', 'PURCHASE', 'SALE_OR_INVOICE', 'OPENING_STOCK', 'STOCK_ADJUSTMENT', 'REVERSAL', 'DAMAGED', 'EXPIRED'].map(
          (t) => (
            <button
              key={t}
              type="button"
              className={`inventory-cat-pill ${filterType === t ? 'active' : ''}`}
              onClick={() => setFilterType(t)}
            >
              {t.replace(/_/g, ' ')}
            </button>
          )
        )}
      </div>

      {error && (
        <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <Icon name="alert-triangle" size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Transactions Table */}
      <div className="inventory-card">
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <span>Loading audit ledger...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <Icon name="history" size={36} color="#94a3b8" />
            <h3 style={{ marginTop: '12px', color: '#0f172a' }}>No stock transactions found</h3>
            <p style={{ fontSize: '13.5px', color: '#64748b' }}>
              Stock transactions are generated automatically when stock is received, adjusted, or invoiced.
            </p>
          </div>
        ) : (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Product & Batch</th>
                  <th>Transaction Type</th>
                  <th style={{ textAlign: 'center' }}>Change</th>
                  <th style={{ textAlign: 'center' }}>Before → After</th>
                  <th>Unit Cost (₹)</th>
                  <th>Reason / Reference</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '12.5px', color: '#475569' }}>
                      {new Date(tx.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {tx.item?.name || 'Inventory Item'}
                      </div>
                      {tx.batch?.batchNumber && (
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                          Batch: {tx.batch.batchNumber} (Exp: {tx.batch.expiryDate?.split('T')[0]})
                        </div>
                      )}
                    </td>
                    <td>{getTxBadge(tx.transactionType)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '14px',
                          color: tx.quantityChange > 0 ? '#15803d' : '#dc2626',
                        }}
                      >
                        {tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}{' '}
                        <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b' }}>
                          {tx.item?.stockUnit || 'units'}
                        </span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12.5px', fontFamily: 'monospace' }}>
                      {tx.quantityBefore} → <strong>{tx.quantityAfter}</strong>
                    </td>
                    <td>₹{tx.unitCost.toFixed(2)}</td>
                    <td>
                      <div style={{ fontSize: '12.5px', color: '#1e293b' }}>{tx.reason || '—'}</div>
                      {tx.referenceId && (
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                          Ref: {tx.referenceType || 'SYS'} #{tx.referenceId}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
