// =============================================================
// VetRx — InventoryHeader.tsx
// Sub-navigation bar, title, and quick-action deck for Inventory.
// =============================================================

import React from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '../../components/ui/Icon';

interface InventoryHeaderProps {
  title?: string;
  subtitle?: string;
  alertCount?: number;
  onOpenAddItem?: () => void;
  onOpenOpeningStock?: () => void;
  onOpenStocktake?: () => void;
  onOpenAdjustment?: () => void;
  onOpenInvoiceImporter?: () => void;
}

export const InventoryHeader: React.FC<InventoryHeaderProps> = ({
  title = 'Inventory & Stock Management',
  subtitle = 'Batch-level inventory tracking, universal purchase invoicing & FEFO stock control',
  alertCount = 0,
  onOpenAddItem,
  onOpenOpeningStock,
  onOpenStocktake,
  onOpenAdjustment,
  onOpenInvoiceImporter,
}) => {
  return (
    <div className="inventory-header-row" style={{ marginBottom: '8px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="inventory-module-pill">
            <Icon name="box" size={14} />
            Add-on Module
          </span>
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              padding: '2px 8px',
              borderRadius: '9999px',
              background: '#e0f2fe',
              color: '#0369a1',
              fontWeight: 600,
            }}
          >
            INR (₹) Valuation
          </span>
          {alertCount > 0 && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: '#fee2e2',
                color: '#991b1b',
                fontWeight: 700,
              }}
            >
              {alertCount} Attention Required
            </span>
          )}
        </div>
        <h1 className="inventory-title">{title}</h1>
        <p className="inventory-subtitle">{subtitle}</p>
      </div>

      <div className="inventory-actions-deck">
        {onOpenInvoiceImporter && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onOpenInvoiceImporter}
            id="inv-btn-upload-invoice"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="upload" size={16} />
            <span>Upload Invoice</span>
          </button>
        )}
        {onOpenAddItem && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenAddItem}
            id="inv-btn-add-item"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="plus" size={16} />
            <span>Add Item</span>
          </button>
        )}
        {onOpenOpeningStock && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenOpeningStock}
            id="inv-btn-opening-stock"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="database" size={16} />
            <span>Opening Stock</span>
          </button>
        )}
        {onOpenStocktake && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenStocktake}
            id="inv-btn-stocktake"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="check-circle" size={16} />
            <span>Stocktake</span>
          </button>
        )}
        {onOpenAdjustment && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenAdjustment}
            id="inv-btn-adjust"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="edit" size={16} />
            <span>Adjust Stock</span>
          </button>
        )}
      </div>
    </div>
  );
};

export const InventorySubnav: React.FC<{ alertCount?: number }> = ({ alertCount = 0 }) => {
  return (
    <nav className="inventory-subnav-bar" aria-label="Inventory Sections">
      <NavLink
        to="/inventory"
        end
        className={({ isActive }) => `inventory-subnav-btn${isActive ? ' active' : ''}`}
        id="subnav-inventory-dashboard"
      >
        <Icon name="home" size={16} />
        <span>Dashboard</span>
      </NavLink>
      <NavLink
        to="/inventory/stock"
        className={({ isActive }) => `inventory-subnav-btn${isActive ? ' active' : ''}`}
        id="subnav-inventory-stock"
      >
        <Icon name="box" size={16} />
        <span>Stock</span>
      </NavLink>
      <NavLink
        to="/inventory/purchases"
        className={({ isActive }) => `inventory-subnav-btn${isActive ? ' active' : ''}`}
        id="subnav-inventory-purchases"
      >
        <Icon name="truck" size={16} />
        <span>Purchases</span>
      </NavLink>
      <NavLink
        to="/inventory/alerts"
        className={({ isActive }) => `inventory-subnav-btn${isActive ? ' active' : ''}`}
        id="subnav-inventory-alerts"
      >
        <Icon name="alert-triangle" size={16} />
        <span>Alerts</span>
        {alertCount > 0 && <span className="inventory-subnav-badge">{alertCount}</span>}
      </NavLink>
      <NavLink
        to="/inventory/movements"
        className={({ isActive }) => `inventory-subnav-btn${isActive ? ' active' : ''}`}
        id="subnav-inventory-movements"
      >
        <Icon name="history" size={16} />
        <span>Stock Movements</span>
      </NavLink>
      <NavLink
        to="/inventory/reports"
        className={({ isActive }) => `inventory-subnav-btn${isActive ? ' active' : ''}`}
        id="subnav-inventory-reports"
      >
        <Icon name="receipt" size={16} />
        <span>Reports</span>
      </NavLink>
    </nav>
  );
};
