// =============================================================
// VetRx — InventoryStockPage.tsx
// Stock management across 5 categories with batch tracking & barcode search.
// =============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';
import { InventoryHeader, InventorySubnav } from './InventoryHeader';
import { AddItemModal } from './AddItemModal';
import { OpeningStockModal } from './OpeningStockModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { StocktakeModal } from './StocktakeModal';
import { InvoiceImporterModal } from './InvoiceImporterModal';
import {
  inventoryApi,
  type InventoryItem,
  type InventoryBatch,
} from '../../services/inventoryApi';
import './Inventory.css';

const CATEGORY_TABS: Array<{ label: string; value: string }> = [
  { label: 'All Stock', value: 'ALL' },
  { label: 'Medicines', value: 'MEDICINE' },
  { label: 'Consumables', value: 'CONSUMABLE' },
  { label: 'Lab Materials', value: 'LAB_MATERIAL' },
  { label: 'Surgical Materials', value: 'SURGICAL_MATERIAL' },
  { label: 'Other', value: 'OTHER' },
];

export const InventoryStockPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<string>(searchParams.get('category') || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded batch viewer
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<InventoryBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isOpeningStockOpen, setIsOpeningStockOpen] = useState(false);
  const [preselectedItemId, setPreselectedItemId] = useState<string | undefined>(undefined);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [isStocktakeOpen, setIsStocktakeOpen] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await inventoryApi.getItems({
        category: category !== 'ALL' ? category : undefined,
        search: searchQuery.trim() || undefined,
      });
      setItems(res.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load stock items');
    } finally {
      setIsLoading(false);
    }
  }, [category, searchQuery]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handleTabChange = (cat: string) => {
    setCategory(cat);
    const params = new URLSearchParams(searchParams);
    if (cat === 'ALL') {
      params.delete('category');
    } else {
      params.set('category', cat);
    }
    setSearchParams(params);
  };

  const toggleExpandItem = async (item: InventoryItem) => {
    if (expandedItemId === item.id) {
      setExpandedItemId(null);
      setExpandedBatches([]);
      return;
    }

    try {
      setExpandedItemId(item.id);
      setIsLoadingBatches(true);
      const res = await inventoryApi.getBatches({ itemId: item.id });
      setExpandedBatches(res.batches || []);
    } catch {
      setExpandedBatches([]);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const openItemOpeningStock = (itemId: string) => {
    setPreselectedItemId(itemId);
    setIsOpeningStockOpen(true);
  };

  const openItemAdjustment = (itemId: string) => {
    setPreselectedItemId(itemId);
    setIsAdjustmentOpen(true);
  };

  return (
    <div className="inventory-page-container">
      <InventoryHeader
        title="Stock Catalogue"
        subtitle="Manage batch-level availability across medicines, consumables, lab & surgical materials"
        onOpenAddItem={() => setIsAddItemOpen(true)}
        onOpenOpeningStock={() => {
          setPreselectedItemId(undefined);
          setIsOpeningStockOpen(true);
        }}
        onOpenStocktake={() => setIsStocktakeOpen(true)}
        onOpenAdjustment={() => {
          setPreselectedItemId(undefined);
          setIsAdjustmentOpen(true);
        }}
        onOpenInvoiceImporter={() => setIsImporterOpen(true)}
      />

      <InventorySubnav />

      {/* Category Pills & Search Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="inventory-category-tabs">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`inventory-cat-pill ${category === tab.value ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.value)}
              id={`tab-cat-${tab.value.toLowerCase()}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px' }}
              placeholder="Search by product name, generic formula, barcode, or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const code = prompt('Enter or scan barcode:');
              if (code) setSearchQuery(code);
            }}
            title="Scan or enter barcode"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="scanner" size={16} />
            <span>Barcode Scan</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          <Icon name="alert-triangle" size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Stock Items Table */}
      <div className="inventory-card">
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <span>Fetching stock catalogue...</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <Icon name="box" size={36} color="#94a3b8" />
            <h3 style={{ marginTop: '12px', color: '#0f172a' }}>No stock items found</h3>
            <p style={{ fontSize: '13.5px', margin: '4px 0 16px' }}>
              {searchQuery ? 'Try changing your search query or category.' : 'Add your first inventory master item to get started.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsAddItemOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="plus" size={16} />
              <span>Add Inventory Item</span>
            </button>
          </div>
        ) : (
          <div className="inventory-table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Category</th>
                  <th>Presentation / Unit</th>
                  <th>Stock Status</th>
                  <th style={{ textAlign: 'center' }}>Physical Stock</th>
                  <th>Min / Target</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const currentStock = item.totalStock ?? 0;
                  const status =
                    currentStock === 0
                      ? 'OUT_OF_STOCK'
                      : currentStock <= item.minimumStockLevel
                      ? 'LOW_STOCK'
                      : 'IN_STOCK';

                  return (
                    <React.Fragment key={item.id}>
                      <tr>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>{item.name}</div>
                          {item.genericName && (
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{item.genericName}</div>
                          )}
                          {item.manufacturer && (
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mfr: {item.manufacturer}</div>
                          )}
                          {item.barcode && (
                            <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#0284c7' }}>
                              UPC: {item.barcode}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: '#f1f5f9',
                              color: '#475569',
                            }}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px', color: '#1e293b' }}>
                            {item.presentation || `${item.dosageForm || ''} ${item.packSize || ''} ${item.stockUnit}`}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`inv-status-pill ${
                              status === 'IN_STOCK'
                                ? 'inv-status-in_stock'
                                : status === 'LOW_STOCK'
                                ? 'inv-status-low_stock'
                                : 'inv-status-out_of_stock'
                            }`}
                          >
                            {status === 'IN_STOCK'
                              ? 'In Stock'
                              : status === 'LOW_STOCK'
                              ? 'Low Stock'
                              : 'Out of Stock'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '15px',
                              fontWeight: 800,
                              color: currentStock === 0 ? '#dc2626' : currentStock <= item.minimumStockLevel ? '#b45309' : '#0f172a',
                            }}
                          >
                            {currentStock}
                          </span>{' '}
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{item.stockUnit}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            Min: <strong>{item.minimumStockLevel}</strong> | Target: <strong>{item.targetStockLevel}</strong>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => void toggleExpandItem(item)}
                              title="View batch breakdown"
                            >
                              <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
                              <span>Batches</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => openItemOpeningStock(item.id)}
                              title="Enter opening stock for this item"
                            >
                              <Icon name="database" size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => openItemAdjustment(item.id)}
                              title="Adjust stock for this item"
                            >
                              <Icon name="edit" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Batch Details Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ background: '#f8fafc', padding: '16px 20px', borderBottom: '2px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                              <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                                Active Batches for {item.name} (FEFO Order)
                              </h4>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => openItemOpeningStock(item.id)}
                              >
                                + Add Batch Stock
                              </button>
                            </div>

                            {isLoadingBatches ? (
                              <div style={{ fontSize: '12.5px', color: '#64748b' }}>Loading batch breakdown...</div>
                            ) : expandedBatches.length === 0 ? (
                              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                                No physical batches on record for this item. Current stock is 0.
                              </div>
                            ) : (
                              <table className="inventory-table" style={{ background: '#ffffff', borderRadius: '8px' }}>
                                <thead>
                                  <tr>
                                    <th>Batch Number</th>
                                    <th>Expiry Date</th>
                                    <th>Days to Expiry</th>
                                    <th style={{ textAlign: 'center' }}>Units in Stock</th>
                                    <th>Purchase Cost (₹)</th>
                                    <th>MRP (₹)</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedBatches.map((batch) => {
                                    const expDate = new Date(batch.expiryDate);
                                    const now = new Date();
                                    const daysRemaining = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                    const isExpired = daysRemaining < 0;
                                    const isCritical = daysRemaining <= 30 && !isExpired;

                                    return (
                                      <tr key={batch.id}>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{batch.batchNumber}</td>
                                        <td>{batch.expiryDate.split('T')[0]}</td>
                                        <td>
                                          <span
                                            style={{
                                              color: isExpired ? '#dc2626' : isCritical ? '#ea580c' : '#475569',
                                              fontWeight: isExpired || isCritical ? 700 : 400,
                                            }}
                                          >
                                            {isExpired ? 'EXPIRED' : `${daysRemaining} days`}
                                          </span>
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                          {batch.quantity} {item.stockUnit}
                                        </td>
                                        <td>₹{batch.unitCost.toFixed(2)}</td>
                                        <td>{batch.mrp ? `₹${batch.mrp.toFixed(2)}` : '—'}</td>
                                        <td>
                                          <span
                                            className={`inv-status-pill ${
                                              isExpired
                                                ? 'inv-status-expired'
                                                : isCritical
                                                ? 'inv-status-low_stock'
                                                : 'inv-status-in_stock'
                                            }`}
                                          >
                                            {isExpired ? 'Expired' : isCritical ? 'Critical' : 'Valid'}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onSuccess={() => void fetchItems()}
      />

      <OpeningStockModal
        isOpen={isOpeningStockOpen}
        onClose={() => setIsOpeningStockOpen(false)}
        onSuccess={() => void fetchItems()}
        preselectedItemId={preselectedItemId}
      />

      <StockAdjustmentModal
        isOpen={isAdjustmentOpen}
        onClose={() => setIsAdjustmentOpen(false)}
        onSuccess={() => void fetchItems()}
        preselectedItemId={preselectedItemId}
      />

      <StocktakeModal
        isOpen={isStocktakeOpen}
        onClose={() => setIsStocktakeOpen(false)}
        onSuccess={() => void fetchItems()}
      />

      <InvoiceImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onSuccess={() => void fetchItems()}
      />
    </div>
  );
};
