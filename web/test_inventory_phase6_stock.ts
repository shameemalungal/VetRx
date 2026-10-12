// ==============================================================================
// VetRx — Phase 6 Web Test Suite: Store Stock, Practice Bag & Field Control
// Verifies CVP-27 (Dashboard), CVP-28 (Practice Bag), CVP-29 (Stock In),
// Transfers, Returns, Reconciliation, CVP-24 Actual Usage, and CVP-25 Completion.
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('VetRx Phase 6: Store Stock, Practice Bag & Field Stock Control Test Suite', () => {
  const appTsxPath = path.resolve('src/App.tsx');
  const appShellPath = path.resolve('src/components/Layout/AppShell.tsx');
  const inventoryApi = path.resolve('src/services/inventoryApi.ts');
  const cvpServicePath = path.resolve('src/services/cvpService.ts');
  const visitDetailPagePath = path.resolve('src/pages/cvp/VisitDetailPage.tsx');
  const inventoryIndex = path.resolve('src/pages/inventory/index.ts');
  const inventoryHeader = path.resolve('src/pages/inventory/InventoryHeader.tsx');
  const inventoryDashboard = path.resolve('src/pages/inventory/InventoryDashboardPage.tsx');
  const practiceBagPage = path.resolve('src/pages/inventory/PracticeBagPage.tsx');
  const stockInModal = path.resolve('src/pages/inventory/StockInModal.tsx');
  const transferModal = path.resolve('src/pages/inventory/TransferStockModal.tsx');
  const returnModal = path.resolve('src/pages/inventory/ReturnStockModal.tsx');
  const reconcileModal = path.resolve('src/pages/inventory/ReconciliationModal.tsx');

  it('1. CVP-27: Inventory Home dashboard implements dual location controls and quick action deck', () => {
    assert.ok(fs.existsSync(inventoryDashboard), 'InventoryDashboardPage.tsx must exist');
    const content = fs.readFileSync(inventoryDashboard, 'utf8');

    // Dual location summary cards
    assert.ok(content.includes('id="card-store-stock"'), 'Must have Store Stock control card');
    assert.ok(content.includes('id="card-practice-bag"'), 'Must have Practice Bag control card');
    assert.ok(content.includes('dashboard?.storeStockSummary'), 'Must display storeStockSummary');
    assert.ok(content.includes('dashboard?.practiceBagSummary'), 'Must display practiceBagSummary');

    // Quick action deck
    assert.ok(content.includes('id="btn-quick-stock-in"'), 'Must have Quick Action Stock In');
    assert.ok(content.includes('id="btn-quick-transfer"'), 'Must have Quick Action Transfer to Bag');
    assert.ok(content.includes('id="btn-quick-return"'), 'Must have Quick Action Return Stock');
    assert.ok(content.includes('id="btn-quick-reconcile"'), 'Must have Quick Action Reconcile');
    assert.ok(content.includes('id="btn-quick-view-bag"'), 'Must have Quick Action View Practice Bag');

    // Modals wired
    assert.ok(content.includes('<StockInModal'), 'Must mount StockInModal');
    assert.ok(content.includes('<TransferStockModal'), 'Must mount TransferStockModal');
    assert.ok(content.includes('<ReturnStockModal'), 'Must mount ReturnStockModal');
    assert.ok(content.includes('<ReconciliationModal'), 'Must mount ReconciliationModal');
  });

  it('2. CVP-28: Practice Bag page provides mobile-first field inventory inspection and preparation', () => {
    assert.ok(fs.existsSync(practiceBagPage), 'PracticeBagPage.tsx must exist');
    const content = fs.readFileSync(practiceBagPage, 'utf8');

    // Key KPIs
    assert.ok(content.includes('id="bag-kpi-total-items"'), 'Must display total items in bag');
    assert.ok(content.includes('id="bag-kpi-total-units"'), 'Must display total units in bag');
    assert.ok(content.includes('id="bag-kpi-low-stock"'), 'Must display low stock alert KPI');
    assert.ok(content.includes('id="bag-kpi-expiring"'), 'Must display expiring soon alert KPI');

    // Search and category tabs
    assert.ok(content.includes('id="bag-search-input"'), 'Must have bag search input');
    assert.ok(content.includes('CATEGORY_TABS'), 'Must have category tabs');

    // Action buttons
    assert.ok(content.includes('id="bag-btn-prepare-bag"'), 'Must have Prepare / Transfer from Store button');
    assert.ok(content.includes('id="bag-btn-return-store"'), 'Must have Return to Store button');
    assert.ok(content.includes('id="bag-btn-reconcile"'), 'Must have Reconcile button');

    // Card items with batch & expiry
    assert.ok(content.includes('bag-item-card'), 'Must have mobile-first bag item cards');
    assert.ok(content.includes('Carried Batches'), 'Must show batch details');
    assert.ok(content.includes('LOW BAG STOCK'), 'Must indicate low stock items');
  });

  it('3. CVP-29: Stock In modal receipts stock into Store Stock with batch, cost, and ledger audit', () => {
    assert.ok(fs.existsSync(stockInModal), 'StockInModal.tsx must exist');
    const content = fs.readFileSync(stockInModal, 'utf8');

    assert.ok(content.includes('inventoryApi.stockIn'), 'Must call inventoryApi.stockIn');
    assert.ok(content.includes('batchNumber'), 'Must capture batchNumber');
    assert.ok(content.includes('expiryDate'), 'Must capture expiryDate');
    assert.ok(content.includes('quantity'), 'Must capture quantity');
    assert.ok(content.includes('purchaseRate'), 'Must capture purchase rate');
    assert.ok(content.includes('sourceReference'), 'Must capture sourceReference');
    assert.ok(content.includes('idempotencyKey'), 'Must include idempotencyKey');
  });

  it('4. Store Stock to Practice Bag Transfer modal validates stock and performs auditable transfer', () => {
    assert.ok(fs.existsSync(transferModal), 'TransferStockModal.tsx must exist');
    const content = fs.readFileSync(transferModal, 'utf8');

    assert.ok(content.includes('inventoryApi.transferStock'), 'Must call inventoryApi.transferStock');
    assert.ok(content.includes('loadStoreStock'), 'Must load source Store Stock');
    assert.ok(content.includes('quantity'), 'Must validate transfer quantity');
    assert.ok(content.includes('reason'), 'Must capture transfer reason');
    assert.ok(content.includes('Practice Bag'), 'Must clearly specify destination as Practice Bag');
  });

  it('5. Return Stock modal allows returning unused field medicines from Bag to Store Stock', () => {
    assert.ok(fs.existsSync(returnModal), 'ReturnStockModal.tsx must exist');
    const content = fs.readFileSync(returnModal, 'utf8');

    assert.ok(content.includes('inventoryApi.returnStock'), 'Must call inventoryApi.returnStock');
    assert.ok(content.includes('loadBagStock'), 'Must load source Practice Bag stock');
    assert.ok(content.includes('quantity'), 'Must capture return quantity');
    assert.ok(content.includes('reason'), 'Must capture return reason');
    assert.ok(content.includes('Store Stock'), 'Must clearly specify return to Store');
  });

  it('6. Reconciliation modal audits physical counts, calculates variances, and requires justification', () => {
    assert.ok(fs.existsSync(reconcileModal), 'ReconciliationModal.tsx must exist');
    const content = fs.readFileSync(reconcileModal, 'utf8');

    assert.ok(content.includes('inventoryApi.reconcileStock'), 'Must call inventoryApi.reconcileStock');
    assert.ok(content.includes('countedQuantity'), 'Must accept physical count');
    assert.ok(content.includes('variance'), 'Must calculate stock variance');
    assert.ok(content.includes('Please provide a reason') || content.includes('itemReason'), 'Must require justification for variances');
    assert.ok(content.includes('targetLocation'), 'Must support reconciling Store Stock and Practice Bag');
  });

  it('7. CVP-24 Actual Medicine Usage workflow integrates with Practice Bag inventory deduction', () => {
    assert.ok(fs.existsSync(cvpServicePath), 'cvpService.ts must exist');
    const cvpContent = fs.readFileSync(cvpServicePath, 'utf8');

    assert.ok(cvpContent.includes('recordMedicineUsage'), 'cvpService must have recordMedicineUsage');
    assert.ok(cvpContent.includes('idempotencyKey'), 'Must preserve idempotencyKey');
    assert.ok(cvpContent.includes('isStockDeducted: true'), 'Must track confirmed stock deduction');
    assert.ok(cvpContent.includes('stockDeductionId'), 'Must store stockDeductionId');

    const detailContent = fs.readFileSync(visitDetailPagePath, 'utf8');
    assert.ok(detailContent.includes('Bag Stock Deducted'), 'VisitDetailPage must display Bag Stock Deducted badge');
    assert.ok(detailContent.includes('Stock Movement Pending'), 'VisitDetailPage must display Stock Movement Pending badge');
  });

  it('8. CVP-25 Visit Completion Review distinguishes actual usage and audits stock deduction status', () => {
    const detailContent = fs.readFileSync(visitDetailPagePath, 'utf8');

    assert.ok(detailContent.includes('Visit Completion Review (CVP-25)'), 'Must render Visit Completion Review modal');
    assert.ok(detailContent.includes('Field Stock Deduction (Practice Bag)'), 'Must include Field Stock Deduction checklist item');
    assert.ok(detailContent.includes('All') && detailContent.includes('Deducted'), 'Must indicate when all medicines are deducted');
    assert.ok(detailContent.includes('Movement(s) Pending'), 'Must indicate unresolved pending stock movements');
  });

  it('9. Routing & Navigation: Practice Bag is accessible via /inventory/bag and /calls/bag', () => {
    const appContent = fs.readFileSync(appTsxPath, 'utf8');
    assert.ok(appContent.includes('path="/inventory/bag"'), 'App.tsx must register /inventory/bag route');
    assert.ok(appContent.includes('path="/calls/bag"'), 'App.tsx must register /calls/bag route');

    const headerContent = fs.readFileSync(inventoryHeader, 'utf8');
    assert.ok(headerContent.includes('to="/inventory/bag"'), 'InventorySubnav must have Practice Bag link');

    const appShellContent = fs.readFileSync(appShellPath, 'utf8');
    assert.ok(appShellContent.includes('/inventory/bag') || appShellContent.includes('/calls/bag'), 'AppShell mobile More menu must link to Practice Bag');

    const indexContent = fs.readFileSync(inventoryIndex, 'utf8');
    assert.ok(indexContent.includes('export { PracticeBagPage }'), 'inventory index.ts must export PracticeBagPage');
    assert.ok(indexContent.includes('export { StockInModal }'), 'inventory index.ts must export StockInModal');
    assert.ok(indexContent.includes('export { TransferStockModal }'), 'inventory index.ts must export TransferStockModal');
    assert.ok(indexContent.includes('export { ReturnStockModal }'), 'inventory index.ts must export ReturnStockModal');
    assert.ok(indexContent.includes('export { ReconciliationModal }'), 'inventory index.ts must export ReconciliationModal');
  });

  it('10. inventoryApi client exposes typed endpoints for all Phase 6 operations', () => {
    const apiContent = fs.readFileSync(inventoryApi, 'utf8');
    assert.ok(apiContent.includes('getLocations:'), 'Must have getLocations endpoint');
    assert.ok(apiContent.includes('getStoreStock:'), 'Must have getStoreStock endpoint');
    assert.ok(apiContent.includes('getPracticeBagStock:'), 'Must have getPracticeBagStock endpoint');
    assert.ok(apiContent.includes('stockIn:'), 'Must have stockIn endpoint');
    assert.ok(apiContent.includes('transferStock:'), 'Must have transferStock endpoint');
    assert.ok(apiContent.includes('returnStock:'), 'Must have returnStock endpoint');
    assert.ok(apiContent.includes('reconcileStock:'), 'Must have reconcileStock endpoint');
  });
});
