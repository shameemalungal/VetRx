// ==============================================================================
// VetRx — Web Inventory Add-on V1 Architecture Verification Test Suite
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Inventory Add-on V1 Frontend Architecture & Integration', () => {
  const appTsxPath = path.resolve('src/App.tsx');
  const appShellPath = path.resolve('src/components/Layout/AppShell.tsx');
  const entitlementContextPath = path.resolve('src/context/InventoryEntitlementContext.tsx');
  const inventoryApi = path.resolve('src/services/inventoryApi.ts');
  const inventoryPagesDir = path.resolve('src/pages/inventory');
  const rxBuilderPath = path.resolve('src/pages/prescriptions/PrescriptionBuilderPage.tsx');
  const externalRxModalPath = path.resolve('src/pages/prescriptions/ExternalPrescriptionModal.tsx');
  const medicinesListPagePath = path.resolve('src/pages/medicines/MedicinesListPage.tsx');
  const billingSectionPath = path.resolve('src/components/commercial/SubscriptionBillingSection.tsx');

  it('1. Entitlement context exists and exports useInventoryEntitlement', () => {
    assert.ok(fs.existsSync(entitlementContextPath), 'InventoryEntitlementContext.tsx must exist');
    const content = fs.readFileSync(entitlementContextPath, 'utf8');
    assert.ok(content.includes('export function useInventoryEntitlement'), 'Must export useInventoryEntitlement');
    assert.ok(content.includes('InventoryEntitlementProvider'), 'Must export InventoryEntitlementProvider');
    assert.ok(content.includes('inventory_management'), 'Must reference inventory_management entitlement');
  });

  it('2. AppShell conditionally renders Inventory navigation based on entitlement', () => {
    assert.ok(fs.existsSync(appShellPath), 'AppShell.tsx must exist');
    const content = fs.readFileSync(appShellPath, 'utf8');
    assert.ok(content.includes('useInventoryEntitlement'), 'AppShell must consume useInventoryEntitlement');
    assert.ok(content.includes("items.push({ label: 'Inventory', path: '/inventory'"), 'Must append Inventory nav item when entitled');
    assert.ok(content.includes('icon: \'inventory\''), 'Must use inventory icon');
  });

  it('3. App.tsx configures all required Inventory routes protected with InventoryRouteGate', () => {
    assert.ok(fs.existsSync(appTsxPath), 'App.tsx must exist');
    const content = fs.readFileSync(appTsxPath, 'utf8');
    assert.ok(content.includes('InventoryRouteGate'), 'App.tsx must import InventoryRouteGate');
    assert.ok(content.includes('path="/inventory"'), 'Must have route /inventory');
    assert.ok(content.includes('path="/inventory/stock"'), 'Must have route /inventory/stock');
    assert.ok(content.includes('path="/inventory/purchases"'), 'Must have route /inventory/purchases');
    assert.ok(content.includes('path="/inventory/alerts"'), 'Must have route /inventory/alerts');
    assert.ok(content.includes('path="/inventory/movements"'), 'Must have route /inventory/movements');
    assert.ok(content.includes('path="/inventory/reports"'), 'Must have route /inventory/reports');
  });

  it('4. All Inventory pages and interactive modals exist and export cleanly', () => {
    const requiredFiles = [
      'InventoryDashboardPage.tsx',
      'InventoryStockPage.tsx',
      'InventoryPurchasesPage.tsx',
      'InventoryAlertsPage.tsx',
      'InventoryMovementsPage.tsx',
      'InventoryReportsPage.tsx',
      'InventoryHeader.tsx',
      'AddItemModal.tsx',
      'OpeningStockModal.tsx',
      'StockAdjustmentModal.tsx',
      'StocktakeModal.tsx',
      'InvoiceImporterModal.tsx',
      'InventoryRouteGate.tsx',
      'Inventory.css',
      'index.ts',
    ];

    for (const f of requiredFiles) {
      const fullPath = path.join(inventoryPagesDir, f);
      assert.ok(fs.existsSync(fullPath), `Page or modal ${f} must exist in src/pages/inventory`);
    }
  });

  it('5. Prescription builder resolves internal vs external stock and provides External Purchase Rx generator', () => {
    assert.ok(fs.existsSync(rxBuilderPath), 'PrescriptionBuilderPage.tsx must exist');
    assert.ok(fs.existsSync(externalRxModalPath), 'ExternalPrescriptionModal.tsx must exist');

    const rxContent = fs.readFileSync(rxBuilderPath, 'utf8');
    assert.ok(rxContent.includes('inventoryApi'), 'PrescriptionBuilderPage must import inventoryApi');
    assert.ok(rxContent.includes('ExternalPrescriptionModal'), 'PrescriptionBuilderPage must render ExternalPrescriptionModal');

    const extContent = fs.readFileSync(externalRxModalPath, 'utf8');
    assert.ok(extContent.includes('External Purchase Prescription'), 'ExternalPrescriptionModal must generate legal external rx');
  });

  it('6. MedicinesListPage shows physical stock status when inventory is active', () => {
    assert.ok(fs.existsSync(medicinesListPagePath), 'MedicinesListPage.tsx must exist');
    const content = fs.readFileSync(medicinesListPagePath, 'utf8');
    assert.ok(content.includes('useInventoryEntitlement'), 'MedicinesListPage must check inventory entitlement');
    assert.ok(content.includes('inventoryApi.getItems'), 'MedicinesListPage must load inventory stock items');
    assert.ok(content.includes('In Stock'), 'Must display In Stock badge when inventory is valid');
  });

  it('7. SubscriptionBillingSection includes safe dev toggle for inventory_management add-on', () => {
    assert.ok(fs.existsSync(billingSectionPath), 'SubscriptionBillingSection.tsx must exist');
    const content = fs.readFileSync(billingSectionPath, 'utf8');
    assert.ok(content.includes('inventory_management'), 'Must reference inventory_management add-on');
    assert.ok(content.includes('toggleDevEntitlement'), 'Must consume toggleDevEntitlement');
  });
});
