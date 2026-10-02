// =============================================================
// VetRx — InventoryReportsPage.tsx
// Financial & operational inventory reports: valuation in ₹, consumption, expiry.
// =============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { InventoryHeader, InventorySubnav } from './InventoryHeader';
import {
  inventoryApi,
  type InventoryItem,
  type InventoryBatch,
} from '../../services/inventoryApi';
import './Inventory.css';

type ReportType = 'valuation' | 'expiry' | 'shortages' | 'consumption';

export const InventoryReportsPage: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('valuation');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReportData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [itemsRes, batchesRes] = await Promise.all([
        inventoryApi.getItems(),
        inventoryApi.getBatches(),
      ]);
      setItems(itemsRes.items || []);
      setBatches(batchesRes.batches || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReportData();
  }, [fetchReportData]);

  // Calculations
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const totalStockValuation = batches.reduce(
    (sum, b) => sum + (Number(b.quantity) || 0) * (Number(b.unitCost) || 0),
    0
  );

  const totalMrpValuation = batches.reduce(
    (sum, b) => sum + (Number(b.quantity) || 0) * (Number(b.mrp) || Number(b.unitCost) || 0),
    0
  );

  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'valuation') {
      csvContent += 'Item Name,Category,Batch Number,Expiry Date,Stock Quantity,Stock Unit,Unit Purchase Cost (INR),Valuation (INR),MRP (INR)\n';
      batches.forEach((b) => {
        const item = itemMap.get(b.itemId);
        const val = (b.quantity * b.unitCost).toFixed(2);
        csvContent += `"${item?.name || 'Item'}","${item?.category || 'MEDICINE'}","${b.batchNumber}","${b.expiryDate.split('T')[0]}",${b.quantity},"${item?.stockUnit || 'Unit'}",${b.unitCost},${val},${b.mrp || ''}\n`;
      });
    } else if (reportType === 'expiry') {
      csvContent += 'Item Name,Category,Batch Number,Expiry Date,Days Remaining,Stock Quantity,Status\n';
      batches.forEach((b) => {
        const item = itemMap.get(b.itemId);
        const expDate = new Date(b.expiryDate);
        const days = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const status = days < 0 ? 'EXPIRED' : days <= 30 ? 'CRITICAL' : days <= 90 ? 'WARNING' : 'OK';
        csvContent += `"${item?.name || 'Item'}","${item?.category || 'MEDICINE'}","${b.batchNumber}","${b.expiryDate.split('T')[0]}",${days},${b.quantity},"${status}"\n`;
      });
    } else {
      csvContent += 'Item Name,Category,Current Stock,Min Stock,Target Stock,Status\n';
      items.forEach((item) => {
        const stock = item.totalStock ?? 0;
        const status = stock === 0 ? 'OUT_OF_STOCK' : stock <= item.minimumStockLevel ? 'LOW_STOCK' : 'OK';
        csvContent += `"${item.name}","${item.category}",${stock},${item.minimumStockLevel},${item.targetStockLevel},"${status}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vetrx_inventory_${reportType}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="inventory-page-container">
      <InventoryHeader
        title="Inventory Reports"
        subtitle="Financial valuation, stock status audits & regulatory batch expiry reporting"
      />

      <InventorySubnav />

      {/* Report Switcher & Export */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div className="inventory-category-tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={`inventory-cat-pill ${reportType === 'valuation' ? 'active' : ''}`}
            onClick={() => setReportType('valuation')}
            id="tab-rep-valuation"
          >
            Stock Valuation (₹)
          </button>
          <button
            type="button"
            className={`inventory-cat-pill ${reportType === 'expiry' ? 'active' : ''}`}
            onClick={() => setReportType('expiry')}
            id="tab-rep-expiry"
          >
            Expiry Schedule
          </button>
          <button
            type="button"
            className={`inventory-cat-pill ${reportType === 'shortages' ? 'active' : ''}`}
            onClick={() => setReportType('shortages')}
            id="tab-rep-shortages"
          >
            Low & Out of Stock
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="print" size={16} />
            <span>Print Report</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportCsv}
            id="btn-export-inventory-csv"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="save" size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <Icon name="alert-triangle" size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Highlight for Valuation */}
      {reportType === 'valuation' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '4px',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(0, 104, 95, 0.08) 0%, rgba(2, 132, 199, 0.08) 100%)',
              border: '1px solid rgba(0, 104, 95, 0.15)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#00685f', textTransform: 'uppercase' }}>
              Primary Inventory Valuation (Purchase Cost)
            </span>
            <div
              style={{
                fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                fontSize: '30px',
                fontWeight: 800,
                color: '#0f172a',
                marginTop: '4px',
              }}
            >
              ₹{totalStockValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Calculated on {batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)} physical units across{' '}
              {batches.length} active batches
            </div>
          </div>

          <div
            style={{
              padding: '16px 20px',
              borderRadius: '14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Estimated Retail Value (MRP)
            </span>
            <div
              style={{
                fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                fontSize: '28px',
                fontWeight: 800,
                color: '#475569',
                marginTop: '4px',
              }}
            >
              ₹{totalMrpValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Maximum retail price value (informational only; not primary valuation)
            </div>
          </div>
        </div>
      )}

      {/* Main Report Table */}
      <div className="inventory-card">
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <span>Compiling report analytics...</span>
          </div>
        ) : reportType === 'valuation' ? (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Batch Number</th>
                  <th>Expiry Date</th>
                  <th style={{ textAlign: 'center' }}>Units in Stock</th>
                  <th style={{ textAlign: 'right' }}>Purchase Cost (₹)</th>
                  <th style={{ textAlign: 'right' }}>Batch Valuation (₹)</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const item = itemMap.get(batch.itemId);
                  const batchVal = batch.quantity * batch.unitCost;
                  return (
                    <tr key={batch.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item?.name || 'Item'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{item?.presentation || item?.stockUnit}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>{item?.category || 'MEDICINE'}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{batch.batchNumber}</td>
                      <td>{batch.expiryDate.split('T')[0]}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {batch.quantity} {item?.stockUnit || 'units'}
                      </td>
                      <td style={{ textAlign: 'right' }}>₹{batch.unitCost.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary, #00685f)' }}>
                        ₹{batchVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : reportType === 'expiry' ? (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Batch Number</th>
                  <th>Expiry Date</th>
                  <th>Days Remaining</th>
                  <th style={{ textAlign: 'center' }}>Stock Units</th>
                  <th>Regulatory Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const item = itemMap.get(batch.itemId);
                  const expDate = new Date(batch.expiryDate);
                  const days = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isExpired = days < 0;
                  const isCritical = days <= 30 && !isExpired;
                  const isWarning = days <= 90 && !isCritical && !isExpired;

                  return (
                    <tr key={batch.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item?.name || 'Item'}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{batch.batchNumber}</td>
                      <td style={{ color: isExpired ? '#dc2626' : undefined, fontWeight: isExpired ? 700 : 400 }}>
                        {batch.expiryDate.split('T')[0]}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {isExpired ? (
                          <span style={{ color: '#dc2626' }}>EXPIRED</span>
                        ) : (
                          `${days} days`
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{batch.quantity}</td>
                      <td>
                        <span
                          className={`inv-status-pill ${
                            isExpired
                              ? 'inv-status-out_of_stock'
                              : isCritical
                              ? 'inv-status-low_stock'
                              : isWarning
                              ? 'inv-status-low_stock'
                              : 'inv-status-in_stock'
                          }`}
                        >
                          {isExpired ? 'Expired (Ineligible)' : isCritical ? 'Critical (≤ 30d)' : isWarning ? 'Warning (≤ 90d)' : 'Valid'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'center' }}>Physical Stock</th>
                  <th>Minimum Stock</th>
                  <th>Target Stock</th>
                  <th>Shortage Status</th>
                </tr>
              </thead>
              <tbody>
                {items
                  .filter((item) => (item.totalStock ?? 0) <= item.minimumStockLevel)
                  .map((item) => {
                    const isOut = (item.totalStock ?? 0) === 0;
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</td>
                        <td>{item.category}</td>
                        <td style={{ textAlign: 'center', fontWeight: 800 }}>
                          {item.totalStock ?? 0} {item.stockUnit}
                        </td>
                        <td>{item.minimumStockLevel}</td>
                        <td>{item.targetStockLevel}</td>
                        <td>
                          <span className={`inv-status-pill ${isOut ? 'inv-status-out_of_stock' : 'inv-status-low_stock'}`}>
                            {isOut ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
