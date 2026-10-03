// =============================================================
// VetRx — InventoryDashboardPage.tsx
// High-level operational overview: metrics, valuation in ₹, alerts, empty states.
// =============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { InventoryHeader, InventorySubnav } from './InventoryHeader';
import { AddItemModal } from './AddItemModal';
import { OpeningStockModal } from './OpeningStockModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { StocktakeModal } from './StocktakeModal';
import { InvoiceImporterModal } from './InvoiceImporterModal';
import { inventoryApi, type InventoryDashboardData } from '../../services/inventoryApi';
import './Inventory.css';

export const InventoryDashboardPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<InventoryDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal triggers
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isOpeningStockOpen, setIsOpeningStockOpen] = useState(false);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isStocktakeOpen, setIsStocktakeOpen] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await inventoryApi.getDashboard();
      setDashboard(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load inventory dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const alertCount =
    (dashboard?.expiringSoonCount || 0) +
    (dashboard?.expiredCount || 0) +
    (dashboard?.lowStockCount || 0) +
    (dashboard?.outOfStockCount || 0);

  const totalItems = dashboard?.totalItems ?? (dashboard as any)?.uniqueItemCount ?? 0;
  const totalUnits = dashboard?.totalUnits ?? (dashboard as any)?.totalUnitsInStock ?? 0;
  const isEmpty = totalItems === 0 && totalUnits === 0;

  return (
    <div className="inventory-page-container">
      <InventoryHeader
        title="Inventory Dashboard"
        subtitle="Real-time physical stock metrics, ₹ purchase-cost valuation & FEFO alerts"
        alertCount={alertCount}
        onOpenAddItem={() => setIsAddItemOpen(true)}
        onOpenOpeningStock={() => setIsOpeningStockOpen(true)}
        onOpenStocktake={() => setIsStocktakeOpen(true)}
        onOpenAdjustment={() => setIsAdjustmentOpen(true)}
        onOpenInvoiceImporter={() => setIsImporterOpen(true)}
      />

      <InventorySubnav alertCount={alertCount} />

      {error && (
        <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <Icon name="alert-triangle" size={18} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <span>Loading inventory telemetry...</span>
        </div>
      ) : isEmpty ? (
        /* Section 40: Useful empty state when practice has no inventory */
        <div className="inventory-empty-state">
          <div className="inventory-empty-icon">
            <Icon name="box" size={32} />
          </div>
          <h2 className="inventory-empty-title">Your inventory is empty.</h2>
          <p className="inventory-empty-sub">
            Add your opening stock or upload a purchase invoice to start tracking batch-level stock, FEFO
            dispensation, and purchase valuations in Indian Rupees (₹).
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsImporterOpen(true)}
              id="empty-btn-upload-invoice"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="upload" size={18} />
              <span>Upload Purchase Invoice</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddItemOpen(true)}
              id="empty-btn-add-item"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="plus" size={18} />
              <span>Add Item</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsOpeningStockOpen(true)}
              id="empty-btn-opening-stock"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Icon name="database" size={18} />
              <span>Enter Opening Stock</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="inventory-metrics-grid">
            {/* Total Stock */}
            <Link to="/inventory/stock" className="inventory-metric-card" id="metric-total-stock">
              <div>
                <div className="inventory-metric-top">
                  <span className="inventory-metric-label">Total Stock</span>
                  <div className="inventory-metric-icon" style={{ background: 'rgba(0, 104, 95, 0.08)', color: '#00685f' }}>
                    <Icon name="box" size={20} />
                  </div>
                </div>
                <div className="inventory-metric-val">{dashboard?.totalUnits ?? 0} units</div>
              </div>
              <div className="inventory-metric-sub">{dashboard?.totalItems ?? 0} unique items across categories</div>
            </Link>

            {/* Stock Value in INR (Purchase cost valuation) */}
            <Link to="/inventory/reports" className="inventory-metric-card" id="metric-stock-value">
              <div>
                <div className="inventory-metric-top">
                  <span className="inventory-metric-label">Stock Value (₹)</span>
                  <div className="inventory-metric-icon" style={{ background: 'rgba(2, 132, 199, 0.08)', color: '#0284c7' }}>
                    <Icon name="receipt" size={20} />
                  </div>
                </div>
                <div className="inventory-metric-val">
                  ₹{(dashboard?.totalStockValue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="inventory-metric-sub">Valuation: Current Stock × Purchase Cost</div>
            </Link>

            {/* Used Today */}
            <Link to="/inventory/movements" className="inventory-metric-card" id="metric-used-today">
              <div>
                <div className="inventory-metric-top">
                  <span className="inventory-metric-label">Used Today</span>
                  <div className="inventory-metric-icon" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                    <Icon name="history" size={20} />
                  </div>
                </div>
                <div className="inventory-metric-val">{dashboard?.usedTodayUnits ?? 0} units</div>
              </div>
              <div className="inventory-metric-sub">
                ₹{(dashboard?.usedTodayValue ?? 0).toLocaleString('en-IN')} purchase cost used
              </div>
            </Link>

            {/* Low Stock */}
            <Link to="/inventory/alerts?tab=low" className="inventory-metric-card" id="metric-low-stock">
              <div>
                <div className="inventory-metric-top">
                  <span className="inventory-metric-label">Low Stock</span>
                  <div className="inventory-metric-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    <Icon name="alert-triangle" size={20} />
                  </div>
                </div>
                <div className="inventory-metric-val" style={{ color: (dashboard?.lowStockCount ?? 0) > 0 ? '#b45309' : '#0f172a' }}>
                  {dashboard?.lowStockCount ?? 0}
                </div>
              </div>
              <div className="inventory-metric-sub">Items below minimum stock level</div>
            </Link>

            {/* Out of Stock */}
            <Link to="/inventory/alerts?tab=out" className="inventory-metric-card" id="metric-out-of-stock">
              <div>
                <div className="inventory-metric-top">
                  <span className="inventory-metric-label">Out of Stock</span>
                  <div className="inventory-metric-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                    <Icon name="alert-octagon" size={20} />
                  </div>
                </div>
                <div className="inventory-metric-val" style={{ color: (dashboard?.outOfStockCount ?? 0) > 0 ? '#dc2626' : '#0f172a' }}>
                  {dashboard?.outOfStockCount ?? 0}
                </div>
              </div>
              <div className="inventory-metric-sub">Items with zero valid stock</div>
            </Link>

            {/* Expiring Soon */}
            <Link to="/inventory/alerts?tab=expiring" className="inventory-metric-card" id="metric-expiring-soon">
              <div>
                <div className="inventory-metric-top">
                  <span className="inventory-metric-label">Expiring Soon</span>
                  <div className="inventory-metric-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                    <Icon name="clock" size={20} />
                  </div>
                </div>
                <div className="inventory-metric-val" style={{ color: (dashboard?.expiringSoonCount ?? 0) > 0 ? '#7e22ce' : '#0f172a' }}>
                  {dashboard?.expiringSoonCount ?? 0}
                </div>
              </div>
              <div className="inventory-metric-sub">Batches approaching expiry (90 days)</div>
            </Link>
          </div>

          {/* Actionable Sections: Expiring, Low Stock, Recent Movements */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Alerts & Low Stock card */}
            <div className="inventory-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="alert-triangle" size={18} color="#f59e0b" />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Actionable Stock Alerts</h3>
                </div>
                <Link to="/inventory/alerts" style={{ fontSize: '13px', color: 'var(--color-primary, #00685f)', fontWeight: 600 }}>
                  View All ({alertCount}) →
                </Link>
              </div>

              {alertCount === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#16a34a', fontSize: '13.5px' }}>
                  ✓ All stock levels optimal and no batches expiring soon.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(dashboard?.alerts?.expiringSoon || []).slice(0, 3).map((exp) => (
                    <div
                      key={exp.batchId}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: exp.isCritical ? '#fef2f2' : '#fffbeb',
                        border: `1px solid ${exp.isCritical ? '#fecaca' : '#fef3c7'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{exp.itemName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Batch: {exp.batchNumber} | Expiry: {exp.expiryDate.split('T')[0]} ({exp.daysRemaining} days remaining)
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: exp.isCritical ? '#dc2626' : '#f59e0b',
                          color: '#fff',
                        }}
                      >
                        {exp.isCritical ? 'CRITICAL' : 'EXPIRING'}
                      </span>
                    </div>
                  ))}

                  {dashboard?.alerts.lowStock.slice(0, 3).map((low) => (
                    <div
                      key={low.itemId}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{low.itemName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Current: {low.currentStock} | Min: {low.minimumStockLevel} | Target: {low.targetStockLevel}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#b45309', color: '#fff' }}>
                        LOW STOCK
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Purchases & Stock Movements */}
            <div className="inventory-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="truck" size={18} color="var(--color-primary, #00685f)" />
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Recent Purchases</h3>
                </div>
                <Link to="/inventory/purchases" style={{ fontSize: '13px', color: 'var(--color-primary, #00685f)', fontWeight: 600 }}>
                  Purchase History →
                </Link>
              </div>

              {(dashboard?.recentPurchases || []).length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                  No recent supplier invoices recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dashboard?.recentPurchases.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{p.supplierName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Inv #{p.invoiceNumber} | {p.invoiceDate}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
                          ₹{p.totalAmount.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '11px', color: '#15803d' }}>Confirmed</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onSuccess={() => void fetchDashboard()}
      />

      <OpeningStockModal
        isOpen={isOpeningStockOpen}
        onClose={() => setIsOpeningStockOpen(false)}
        onSuccess={() => void fetchDashboard()}
      />

      <StockAdjustmentModal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        onSuccess={() => void fetchDashboard()}
      />

      <StocktakeModal
        isOpen={isStocktakeOpen}
        onClose={() => setIsStocktakeOpen(false)}
        onSuccess={() => void fetchDashboard()}
      />

      <InvoiceImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onSuccess={() => void fetchDashboard()}
      />
    </div>
  );
};
