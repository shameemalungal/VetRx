// ==============================================================================
// VetRx — PracticeBagPage.tsx (CVP-28: Practice Bag & Field Stock Control)
// Mobile-first field stock inspection, preparation, returns & reconciliation.
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { InventoryHeader, InventorySubnav } from './InventoryHeader';
import { TransferStockModal } from './TransferStockModal';
import { ReturnStockModal } from './ReturnStockModal';
import { ReconciliationModal } from './ReconciliationModal';
import { CreateKitModal } from './CreateKitModal';
import {
  inventoryApi,
  type InventoryItem,
  type InventoryBatch,
  type StockLocation,
} from '../../services/inventoryApi';
import './Inventory.css';

const CATEGORY_TABS: Array<{ label: string; value: string }> = [
  { label: 'All Items', value: 'ALL' },
  { label: 'Medicines', value: 'MEDICINE' },
  { label: 'Consumables', value: 'CONSUMABLE' },
  { label: 'Surgical & Lab', value: 'SURGICAL_MATERIAL' },
  { label: 'Other', value: 'OTHER' },
];

export const PracticeBagPage: React.FC = () => {
  const [category, setCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bagLocation, setBagLocation] = useState<StockLocation | null>(null);
  const [allLocations, setAllLocations] = useState<StockLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [summary, setSummary] = useState({
    totalItems: 0,
    totalUnits: 0,
    lowStockCount: 0,
    expiringSoonCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isCreateKitOpen, setIsCreateKitOpen] = useState(false);
  const [preselectedItemId, setPreselectedItemId] = useState<string | undefined>(undefined);

  const fetchLocations = useCallback(async () => {
    try {
      const locs = await inventoryApi.getLocations();
      // Only keep field locations (bags, vehicles, mobile kits)
      const fieldLocs = (locs || []).filter((l) => l.name !== 'Store Stock');
      setAllLocations(fieldLocs);
    } catch {
      // Fallback gracefully
    }
  }, []);

  const fetchBagStock = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await inventoryApi.getPracticeBagStock({
        locationId: selectedLocationId || undefined,
        category: category !== 'ALL' ? category : undefined,
        search: searchQuery.trim() || undefined,
      });
      setBagLocation(res.bagLocation || null);
      setItems(res.items || []);
      setBatches(res.batches || []);
      setSummary(
        res.summary || {
          totalItems: (res.items || []).length,
          totalUnits: (res.items || []).reduce((acc, i) => acc + (i.currentStock || 0), 0),
          lowStockCount: 0,
          expiringSoonCount: 0,
        }
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load Practice Bag stock');
    } finally {
      setIsLoading(false);
    }
  }, [category, searchQuery, selectedLocationId]);

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    void fetchBagStock();
  }, [fetchBagStock]);

  const handleOpenTransferForItem = (itemId: string) => {
    setPreselectedItemId(itemId);
    setIsTransferOpen(true);
  };

  const handleOpenReturnForItem = (itemId: string) => {
    setPreselectedItemId(itemId);
    setIsReturnOpen(true);
  };

  return (
    <div className="inventory-page-container" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      <InventoryHeader
        title="Field Kits & Practice Bags"
        subtitle="Manage field stock across doctor bags, mobile clinic vans, and emergency kits"
        onOpenTransfer={() => {
          setPreselectedItemId(undefined);
          setIsTransferOpen(true);
        }}
        onOpenReturn={() => {
          setPreselectedItemId(undefined);
          setIsReturnOpen(true);
        }}
        onOpenReconcile={() => setIsReconcileOpen(true)}
      />

      <InventorySubnav />

      {/* Bag Highlights / KPI Cards */}
      <div
        className="inventory-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginTop: '16px',
          marginBottom: '16px',
        }}
      >
        <div
          className="stat-card"
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', marginBottom: '6px' }}>
            <Icon name="bag" size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Items Carried</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#14532d' }} id="bag-kpi-total-items">
            {summary.totalItems}
          </div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
            Active in field bag
          </div>
        </div>

        <div
          className="stat-card"
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', marginBottom: '6px' }}>
            <Icon name="box" size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Total Units</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e3a8a' }} id="bag-kpi-total-units">
            {summary.totalUnits}
          </div>
          <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '2px' }}>
            Doses, vials & packs
          </div>
        </div>

        <div
          className="stat-card"
          style={{
            background: summary.lowStockCount > 0 ? '#fff7ed' : '#f8fafc',
            border: `1px solid ${summary.lowStockCount > 0 ? '#ffedd5' : '#e2e8f0'}`,
            borderRadius: '12px',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: summary.lowStockCount > 0 ? '#c2410c' : '#64748b', marginBottom: '6px' }}>
            <Icon name="alert-triangle" size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Low Bag Stock</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: summary.lowStockCount > 0 ? '#9a3412' : '#334155' }} id="bag-kpi-low-stock">
            {summary.lowStockCount}
          </div>
          <div style={{ fontSize: '11px', color: summary.lowStockCount > 0 ? '#ea580c' : '#94a3b8', marginTop: '2px' }}>
            Requires replenishment
          </div>
        </div>

        <div
          className="stat-card"
          style={{
            background: summary.expiringSoonCount > 0 ? '#fef2f2' : '#f8fafc',
            border: `1px solid ${summary.expiringSoonCount > 0 ? '#fee2e2' : '#e2e8f0'}`,
            borderRadius: '12px',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: summary.expiringSoonCount > 0 ? '#b91c1c' : '#64748b', marginBottom: '6px' }}>
            <Icon name="clock" size={18} />
            <span style={{ fontSize: '12px', fontWeight: 600 }}>Expiring Soon</span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: summary.expiringSoonCount > 0 ? '#991b1b' : '#334155' }} id="bag-kpi-expiring">
            {summary.expiringSoonCount}
          </div>
          <div style={{ fontSize: '11px', color: summary.expiringSoonCount > 0 ? '#dc2626' : '#94a3b8', marginTop: '2px' }}>
            Within 60 days
          </div>
        </div>
      </div>

      {/* Multiple Field Kits & Vehicles Selector Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: bagLocation?.type === 'VEHICLE' ? '#d97706' : '#0284c7',
                color: '#ffffff',
              }}
            >
              <Icon name={bagLocation?.type === 'VEHICLE' ? 'truck' : 'bag'} size={18} />
            </span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {bagLocation?.name || 'Practice Bag'}
                </span>
                {bagLocation?.type && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: bagLocation.type === 'VEHICLE' ? '#fef3c7' : '#e0f2fe',
                      color: bagLocation.type === 'VEHICLE' ? '#92400e' : '#0369a1',
                      textTransform: 'uppercase',
                    }}
                  >
                    {bagLocation.type}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {bagLocation?.vehicleNumber && (
                  <span style={{ marginRight: '8px' }}>
                    Reg: <strong>{bagLocation.vehicleNumber}</strong>
                  </span>
                )}
                {bagLocation?.assignedUserName && (
                  <span style={{ marginRight: '8px' }}>
                    Assigned: <strong>{bagLocation.assignedUserName}</strong>
                  </span>
                )}
                <span>Audited Ledger</span>
              </div>
            </div>
          </div>

          {/* Kit Switcher Dropdown */}
          {allLocations.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="field-kit-selector" style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                Active Kit:
              </label>
              <select
                id="field-kit-selector"
                value={bagLocation?.id || selectedLocationId || ''}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 600,
                }}
              >
                {allLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.vehicleNumber ? `(${loc.vehicleNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="bag-action-buttons-group">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPreselectedItemId(undefined);
              setIsTransferOpen(true);
            }}
            id="bag-btn-prepare-bag"
            style={{ fontSize: '13px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="swap-horiz" size={15} />
            <span>Transfer Stock</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPreselectedItemId(undefined);
              setIsReturnOpen(true);
            }}
            id="bag-btn-return-store"
            style={{ fontSize: '13px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="arrow-back" size={15} />
            <span>Return to Store</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsReconcileOpen(true)}
            id="bag-btn-reconcile"
            style={{ fontSize: '13px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="check-circle" size={15} />
            <span>Reconcile Count</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setIsCreateKitOpen(true)}
            id="bag-btn-create-kit"
            style={{
              fontSize: '13px',
              padding: '6px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px dashed #cbd5e1',
              borderRadius: '6px',
            }}
            title="Create a new vehicle or field kit"
          >
            <Icon name="add" size={15} />
            <span>+ New Kit / Van</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div
        className="inventory-filter-bar"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none',
              }}
            >
              <Icon name="search" size={16} />
            </span>
            <input
              type="text"
              className="input-field"
              placeholder="Search medicines, consumables, batch numbers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="bag-search-input"
              style={{
                width: '100%',
                paddingLeft: '36px',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
          </div>
          {searchQuery && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSearchQuery('')}
              style={{ fontSize: '12px' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div
          className="category-pill-group"
          style={{
            display: 'flex',
            overflowX: 'auto',
            gap: '6px',
            paddingBottom: '4px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`pill-btn ${category === tab.value ? 'active' : ''}`}
              onClick={() => setCategory(tab.value)}
              id={`bag-category-pill-${tab.value}`}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                borderRadius: '9999px',
                border: '1px solid',
                borderColor: category === tab.value ? '#0284c7' : '#cbd5e1',
                background: category === tab.value ? '#0284c7' : '#ffffff',
                color: category === tab.value ? '#ffffff' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: category === tab.value ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stock Content */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
          <Icon name="refresh-cw" size={28} className="spin" />
          <p style={{ marginTop: '12px', fontSize: '14px' }}>Loading Practice Bag inventory...</p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '24px',
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderRadius: '12px',
            textAlign: 'center',
            color: '#991b1b',
          }}
        >
          <Icon name="alert-circle" size={28} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginTop: '8px' }}>Unable to load bag inventory</h3>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>{error}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void fetchBagStock()}
            style={{ marginTop: '12px', fontSize: '13px' }}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: '48px 16px',
            textAlign: 'center',
            background: '#f8fafc',
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '28px',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <Icon name="bag" size={28} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>Practice Bag is Empty</h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '360px', margin: '6px auto 16px' }}>
            No medicines or consumables are currently loaded in your field bag. Transfer required items from Store Stock before heading out for calls.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPreselectedItemId(undefined);
              setIsTransferOpen(true);
            }}
            id="bag-btn-empty-prepare"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="swap-horiz" size={16} />
            <span>Prepare Practice Bag</span>
          </button>
        </div>
      ) : (
        <div className="bag-items-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item) => {
            const itemBatches = batches.filter(
              (b) => b.itemId === item.id || b.inventoryItemId === item.id
            );
            const totalStock = item.currentStock ?? item.totalStock ?? 0;
            const isLow = totalStock < (item.minimumStockLevel || 2);

            return (
              <div
                key={item.id}
                className="bag-item-card"
                id={`bag-item-${item.id}`}
                style={{
                  background: '#ffffff',
                  border: `1px solid ${isLow ? '#fed7aa' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Header row: Name, Category, Stock Level Badge */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: item.category === 'MEDICINE' ? '#e0e7ff' : '#f1f5f9',
                          color: item.category === 'MEDICINE' ? '#3730a3' : '#475569',
                        }}
                      >
                        {item.category}
                      </span>
                      {isLow && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#ffedd5',
                            color: '#9a3412',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Icon name="alert-triangle" size={10} />
                          LOW BAG STOCK
                        </span>
                      )}
                    </div>
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#0f172a',
                        marginTop: '4px',
                        marginBottom: '2px',
                      }}
                    >
                      {item.name}
                    </h3>
                    {item.genericName && (
                      <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                        {item.genericName}
                      </p>
                    )}
                  </div>

                  {/* Stock Quantity Badge */}
                  <div
                    style={{
                      textAlign: 'right',
                      background: totalStock > 0 ? '#f0fdf4' : '#fef2f2',
                      border: `1px solid ${totalStock > 0 ? '#bbf7d0' : '#fee2e2'}`,
                      borderRadius: '8px',
                      padding: '6px 12px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 700,
                        color: totalStock > 0 ? '#15803d' : '#991b1b',
                        lineHeight: 1.1,
                      }}
                    >
                      {totalStock} <span style={{ fontSize: '11px', fontWeight: 500 }}>{item.stockUnit}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      in practice bag
                    </div>
                  </div>
                </div>

                {/* Batches Breakdown in Bag */}
                {itemBatches.length > 0 && (
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '12px',
                      fontSize: '12px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Icon name="tag" size={12} />
                      Carried Batches ({itemBatches.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {itemBatches.map((b) => {
                        const expDate = new Date(b.expiryDate);
                        const isExpired = expDate.getTime() < Date.now();
                        const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 3600 * 24));
                        const isExpiringSoon = daysLeft <= 60 && !isExpired;

                        return (
                          <div
                            key={b.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '11px',
                              padding: '2px 0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e293b' }}>
                                #{b.batchNumber}
                              </span>
                              <span style={{ color: '#64748b' }}>
                                Exp: {expDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                              </span>
                              {isExpired ? (
                                <span style={{ color: '#dc2626', fontWeight: 600 }}>[EXPIRED]</span>
                              ) : isExpiringSoon ? (
                                <span style={{ color: '#ea580c', fontWeight: 600 }}>[{daysLeft}d left]</span>
                              ) : null}
                            </div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {b.currentQuantity ?? b.quantity} {item.stockUnit}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action buttons row */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleOpenTransferForItem(item.id)}
                    style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    id={`bag-action-transfer-${item.id}`}
                  >
                    <Icon name="swap-horiz" size={13} />
                    <span>Transfer More</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleOpenReturnForItem(item.id)}
                    style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    id={`bag-action-return-${item.id}`}
                  >
                    <Icon name="arrow-back" size={13} />
                    <span>Return to Store</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {isTransferOpen && (
        <TransferStockModal
          isOpen={isTransferOpen}
          onClose={() => {
            setIsTransferOpen(false);
            setPreselectedItemId(undefined);
          }}
          onSuccess={() => void fetchBagStock()}
          preselectedItemId={preselectedItemId}
          targetLocationId={bagLocation?.id || selectedLocationId || undefined}
        />
      )}

      {isReturnOpen && (
        <ReturnStockModal
          isOpen={isReturnOpen}
          onClose={() => {
            setIsReturnOpen(false);
            setPreselectedItemId(undefined);
          }}
          onSuccess={() => void fetchBagStock()}
          preselectedItemId={preselectedItemId}
          sourceLocationId={bagLocation?.id || selectedLocationId || undefined}
        />
      )}

      {isReconcileOpen && (
        <ReconciliationModal
          isOpen={isReconcileOpen}
          onClose={() => setIsReconcileOpen(false)}
          onSuccess={() => void fetchBagStock()}
          locationName={bagLocation?.name || 'Practice Bag'}
        />
      )}

      {isCreateKitOpen && (
        <CreateKitModal
          isOpen={isCreateKitOpen}
          onClose={() => setIsCreateKitOpen(false)}
          onSuccess={(created) => {
            void fetchLocations();
            setSelectedLocationId(created.id);
          }}
        />
      )}
    </div>
  );
};
