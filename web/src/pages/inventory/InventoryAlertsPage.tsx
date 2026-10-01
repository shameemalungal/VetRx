// =============================================================
// VetRx — InventoryAlertsPage.tsx
// Actionable views for Expiring Soon, Expired, Low Stock & Out of Stock.
// =============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { InventoryHeader, InventorySubnav } from './InventoryHeader';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { OpeningStockModal } from './OpeningStockModal';
import { InvoiceImporterModal } from './InvoiceImporterModal';
import { inventoryApi } from '../../services/inventoryApi';
import './Inventory.css';

type AlertTab = 'expiring' | 'expired' | 'low' | 'out';

export const InventoryAlertsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<AlertTab>((searchParams.get('tab') as AlertTab) || 'expiring');
  const [alerts, setAlerts] = useState<{
    expiringSoon: any[];
    expired: any[];
    lowStock: any[];
    outOfStock: any[];
  }>({
    expiringSoon: [],
    expired: [],
    lowStock: [],
    outOfStock: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isOpeningStockOpen, setIsOpeningStockOpen] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [preselectedItemId, setPreselectedItemId] = useState<string | undefined>(undefined);
  const [preselectedBatchId, setPreselectedBatchId] = useState<string | undefined>(undefined);

  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await inventoryApi.getAlerts();
      setAlerts(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load stock alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const handleTabChange = (t: AlertTab) => {
    setTab(t);
    const params = new URLSearchParams(searchParams);
    params.set('tab', t);
    setSearchParams(params);
  };

  const openAdjustForBatch = (itemId: string, batchId?: string) => {
    setPreselectedItemId(itemId);
    setPreselectedBatchId(batchId);
    setIsAdjustmentOpen(true);
  };

  const totalAlerts =
    alerts.expiringSoon.length +
    alerts.expired.length +
    alerts.lowStock.length +
    alerts.outOfStock.length;

  return (
    <div className="inventory-page-container">
      <InventoryHeader
        title="Stock Alerts & Expiry Control"
        subtitle="Manage batch expiration deadlines, critical shortages and out-of-stock items"
        alertCount={totalAlerts}
        onOpenInvoiceImporter={() => setIsImporterOpen(true)}
      />

      <InventorySubnav alertCount={totalAlerts} />

      {/* Tabs */}
      <div className="inventory-category-tabs">
        <button
          type="button"
          className={`inventory-cat-pill ${tab === 'expiring' ? 'active' : ''}`}
          onClick={() => handleTabChange('expiring')}
          id="tab-alert-expiring"
        >
          Expiring Soon ({alerts.expiringSoon.length})
        </button>
        <button
          type="button"
          className={`inventory-cat-pill ${tab === 'expired' ? 'active' : ''}`}
          onClick={() => handleTabChange('expired')}
          id="tab-alert-expired"
        >
          Expired Stock ({alerts.expired.length})
        </button>
        <button
          type="button"
          className={`inventory-cat-pill ${tab === 'low' ? 'active' : ''}`}
          onClick={() => handleTabChange('low')}
          id="tab-alert-low"
        >
          Low Stock ({alerts.lowStock.length})
        </button>
        <button
          type="button"
          className={`inventory-cat-pill ${tab === 'out' ? 'active' : ''}`}
          onClick={() => handleTabChange('out')}
          id="tab-alert-out"
        >
          Out of Stock ({alerts.outOfStock.length})
        </button>
      </div>

      {error && (
        <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <Icon name="alert-triangle" size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Alerts Table */}
      <div className="inventory-card">
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <span>Scanning stock batches for alert thresholds...</span>
          </div>
        ) : tab === 'expiring' ? (
          alerts.expiringSoon.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#16a34a' }}>
              <Icon name="check-circle" size={36} color="#16a34a" />
              <h3 style={{ marginTop: '12px', color: '#0f172a' }}>No batches expiring within 90 days</h3>
              <p style={{ fontSize: '13.5px', color: '#64748b' }}>All registered batches have comfortable shelf life.</p>
            </div>
          ) : (
            <div className="inventory-table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Product & Batch</th>
                    <th>Expiry Date</th>
                    <th>Days Remaining</th>
                    <th style={{ textAlign: 'center' }}>Units in Stock</th>
                    <th>Urgency</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.expiringSoon.map((item) => (
                    <tr key={item.batchId}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.itemName}</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                          Batch: {item.batchNumber}
                        </div>
                      </td>
                      <td>{item.expiryDate.split('T')[0]}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: item.isCritical ? '#dc2626' : '#d97706' }}>
                          {item.daysRemaining} days left
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                      <td>
                        <span
                          className={`inv-status-pill ${
                            item.isCritical ? 'inv-status-out_of_stock' : 'inv-status-low_stock'
                          }`}
                        >
                          {item.isCritical ? 'Critical (≤ 30d)' : 'Warning (≤ 90d)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => openAdjustForBatch(item.itemId, item.batchId)}
                        >
                          Adjust / Dispose
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'expired' ? (
          alerts.expired.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#16a34a' }}>
              <Icon name="check-circle" size={36} color="#16a34a" />
              <h3 style={{ marginTop: '12px', color: '#0f172a' }}>No expired stock on record</h3>
              <p style={{ fontSize: '13.5px', color: '#64748b' }}>
                All physical inventory is valid and eligible for prescription dispensation and invoicing.
              </p>
            </div>
          ) : (
            <div className="inventory-table-container">
              <div
                style={{
                  padding: '12px 16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  marginBottom: '14px',
                  fontSize: '13px',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Icon name="alert-triangle" size={16} />
                <span>
                  <strong>Safety Invariant:</strong> Expired batches are automatically locked and can NEVER be invoiced or
                  dispensed to patients.
                </span>
              </div>
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Product & Batch</th>
                    <th>Expiry Date</th>
                    <th style={{ textAlign: 'center' }}>Expired Units</th>
                    <th>Eligible for Invoicing</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.expired.map((item) => (
                    <tr key={item.batchId}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.itemName}</div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                          Batch: {item.batchNumber}
                        </div>
                      </td>
                      <td style={{ color: '#dc2626', fontWeight: 600 }}>{item.expiryDate.split('T')[0]}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                      <td>
                        <span className="inv-status-pill inv-status-out_of_stock">NO (LOCKED)</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => openAdjustForBatch(item.itemId, item.batchId)}
                        >
                          Dispose / Return to Supplier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'low' ? (
          alerts.lowStock.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#16a34a' }}>
              <Icon name="check-circle" size={36} color="#16a34a" />
              <h3 style={{ marginTop: '12px', color: '#0f172a' }}>All items above minimum stock</h3>
              <p style={{ fontSize: '13.5px', color: '#64748b' }}>Stock levels satisfy configured practice thresholds.</p>
            </div>
          ) : (
            <div className="inventory-table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Current Stock</th>
                    <th>Min Level</th>
                    <th>Target Level</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.lowStock.map((item) => (
                    <tr key={item.itemId}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{item.itemName}</td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>{item.category}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#b45309' }}>{item.currentStock}</span>
                      </td>
                      <td>{item.minimumStockLevel}</td>
                      <td>{item.targetStockLevel}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={() => {
                            setPreselectedItemId(item.itemId);
                            setIsOpeningStockOpen(true);
                          }}
                        >
                          Replenish Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : alerts.outOfStock.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#16a34a' }}>
            <Icon name="check-circle" size={36} color="#16a34a" />
            <h3 style={{ marginTop: '12px', color: '#0f172a' }}>No items completely out of stock</h3>
            <p style={{ fontSize: '13.5px', color: '#64748b' }}>Every catalogued product has positive stock availability.</p>
          </div>
        ) : (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Physical Stock</th>
                  <th>Min Level</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.outOfStock.map((item) => (
                  <tr key={item.itemId}>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{item.itemName}</td>
                    <td>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>{item.category}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="inv-status-pill inv-status-out_of_stock">0 (Out of Stock)</span>
                    </td>
                    <td>{item.minimumStockLevel}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => {
                          setPreselectedItemId(item.itemId);
                          setIsOpeningStockOpen(true);
                        }}
                      >
                        Enter Stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StockAdjustmentModal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        onSuccess={() => void fetchAlerts()}
        preselectedItemId={preselectedItemId}
        preselectedBatchId={preselectedBatchId}
      />

      <OpeningStockModal
        isOpen={isOpeningStockOpen}
        onClose={() => setIsOpeningStockOpen(false)}
        onSuccess={() => void fetchAlerts()}
        preselectedItemId={preselectedItemId}
      />

      <InvoiceImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onSuccess={() => void fetchAlerts()}
      />
    </div>
  );
};
