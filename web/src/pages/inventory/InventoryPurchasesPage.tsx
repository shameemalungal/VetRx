// =============================================================
// VetRx — InventoryPurchasesPage.tsx
// Purchase Invoices & Supplier Management with Universal Importer integration.
// =============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { InventoryHeader, InventorySubnav } from './InventoryHeader';
import { InvoiceImporterModal } from './InvoiceImporterModal';
import {
  inventoryApi,
  type PurchaseInvoice,
  type Supplier,
} from '../../services/inventoryApi';
import './Inventory.css';

export const InventoryPurchasesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'purchases' | 'suppliers'>('purchases');
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  const fetchPurchases = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await inventoryApi.getPurchases();
      setPurchases(res.purchases || []);
      setSuppliers(res.suppliers || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load purchase invoices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPurchases();
  }, [fetchPurchases]);

  return (
    <div className="inventory-page-container">
      <InventoryHeader
        title="Purchases & Suppliers"
        subtitle="Universal purchase invoice records, supplier directory and procurement history"
        onOpenInvoiceImporter={() => setIsImporterOpen(true)}
      />

      <InventorySubnav />

      {/* View Tabs & Quick Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`inventory-cat-pill ${activeTab === 'purchases' ? 'active' : ''}`}
            onClick={() => setActiveTab('purchases')}
            id="tab-purchases-history"
          >
            Purchase Invoices ({purchases.length})
          </button>
          <button
            type="button"
            className={`inventory-cat-pill ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
            id="tab-purchases-suppliers"
          >
            Suppliers ({suppliers.length})
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsImporterOpen(true)}
          id="btn-upload-purchase-invoice"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="upload" size={16} />
          <span>Upload Purchase Invoice</span>
        </button>
      </div>

      {error && (
        <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <Icon name="alert-triangle" size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="inventory-card">
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <span>Loading purchase history...</span>
          </div>
        ) : activeTab === 'purchases' ? (
          purchases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <Icon name="truck" size={36} color="#94a3b8" />
              <h3 style={{ marginTop: '12px', color: '#0f172a' }}>No purchase invoices recorded yet</h3>
              <p style={{ fontSize: '13.5px', margin: '4px 0 16px' }}>
                Upload supplier purchase bills (PDF or image) to automatically extract line items and replenish stock.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsImporterOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon name="upload" size={16} />
                <span>Upload Invoice Now</span>
              </button>
            </div>
          ) : (
            <div className="inventory-table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Supplier</th>
                    <th>Invoice Date</th>
                    <th>Items</th>
                    <th style={{ textAlign: 'right' }}>Total Amount (₹)</th>
                    <th>Status</th>
                    <th>Imported At</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                        {p.invoiceNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{p.supplierName}</div>
                        {p.supplierGstin && (
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            GSTIN: {p.supplierGstin}
                          </div>
                        )}
                      </td>
                      <td>{p.invoiceDate}</td>
                      <td>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{p.items?.length || 0} line items</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary, #00685f)' }}>
                        ₹{p.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className="inv-status-pill inv-status-in_stock">Confirmed</span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#64748b' }}>
                        {new Date(p.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : suppliers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <Icon name="truck" size={36} color="#94a3b8" />
            <h3 style={{ marginTop: '12px', color: '#0f172a' }}>No suppliers registered yet</h3>
            <p style={{ fontSize: '13.5px', margin: '4px 0 16px' }}>
              Suppliers are automatically created and updated when you confirm uploaded purchase invoices.
            </p>
          </div>
        ) : (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>GSTIN</th>
                  <th>Contact Info</th>
                  <th>Address</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((sup) => (
                  <tr key={sup.id}>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{sup.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12.5px' }}>{sup.gstin || '—'}</td>
                    <td>
                      <div style={{ fontSize: '12.5px' }}>{sup.phone || sup.email || '—'}</div>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#64748b' }}>{sup.address || '—'}</td>
                    <td>
                      <span className="inv-status-pill inv-status-in_stock">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InvoiceImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onSuccess={() => void fetchPurchases()}
      />
    </div>
  );
};
