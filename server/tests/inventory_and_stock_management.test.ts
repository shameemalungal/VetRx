// ==============================================================================
// VetRx — Inventory & Stock Management V1 Comprehensive Test Suite
// Validates:
// 1. Module Entitlement & Access Gating (Dual requirement: Base Sub + Add-on)
// 2. Item Master vs Physical Stock Separation
// 3. 5 Categories: Medicine, Consumable, Lab Material, Surgical Material, Other
// 4. Batch-level Ledger & Auditability (OPENING_STOCK, PURCHASE, etc.)
// 5. Expiry Tracking & Non-Invoicable Expired Stock
// 6. FEFO (First Expiry, First Out) Stock Allocation
// 7. Manual Adjustments & Stocktake Variance Auditing
// 8. Universal Invoice Importer (Semantic Normalization & Safe Matching)
// 9. Prescription Resolution (Internal vs External)
// 10. Invoice Deduction & Cancellation Reversal
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { UniversalInvoiceParserService } from '../src/inventory/universal-invoice-parser.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { SubscriptionService } from '../src/commercial/subscription.service.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Inventory & Stock Management V1 Test Suite', () => {
  const practiceA = 'practice-vet-alpha-001';
  const practiceB = 'practice-vet-beta-002';
  const userDoctor = 'user-dr-patel';

  beforeEach(() => {
    InventoryService.clearMockStore();
    EntitlementService.setMockInventoryAddon(practiceA, false);
    EntitlementService.setMockInventoryAddon(practiceB, false);
  });

  // ----------------------------------------------------------------------------
  // 1. Module Type & Entitlement Gating
  // ----------------------------------------------------------------------------
  describe('1. Module Type & Entitlement Gating', () => {
    it('requires both active base subscription AND inventory_management add-on', async () => {
      // Setup practice with active subscription in mock
      await SubscriptionService.createPracticeSubscription(practiceA, 'PRO_CLINIC', 'ANNUAL');

      // 1. Base active, but Addon NOT active
      EntitlementService.setMockInventoryAddon(practiceA, false);
      const canAccessNoAddon = await EntitlementService.hasInventoryEntitlement(practiceA);
      assert.strictEqual(canAccessNoAddon, false);

      await assert.rejects(
        async () => {
          await EntitlementService.assertCanAccessInventory(practiceA);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.errorCode, 'INVENTORY_ADDON_REQUIRED');
          return true;
        }
      );

      // 2. Both Base active AND Addon active
      EntitlementService.setMockInventoryAddon(practiceA, true);
      const canAccessWithAddon = await EntitlementService.hasInventoryEntitlement(practiceA);
      assert.strictEqual(canAccessWithAddon, true);

      // Should not throw
      await EntitlementService.assertCanAccessInventory(practiceA);
    });

    it('denies access if base subscription is canceled even if addon was enabled', async () => {
      // Create subscription and cancel it
      const sub = await SubscriptionService.createPracticeSubscription(practiceB, 'PRO_CLINIC', 'MONTHLY');
      await SubscriptionService.cancelSubscription(sub.id, practiceB, 'No longer needed');

      // Enable addon
      EntitlementService.setMockInventoryAddon(practiceB, true);

      // Base is canceled/inactive
      const canAccess = await EntitlementService.hasInventoryEntitlement(practiceB);
      assert.strictEqual(canAccess, false);

      await assert.rejects(async () => {
        await EntitlementService.assertCanAccessInventory(practiceB);
      });
    });

    it('safe dev toggle enables and disables add-on without PayU dependencies', () => {
      assert.strictEqual(EntitlementService.getMockInventoryAddon(practiceA), false);
      EntitlementService.setMockInventoryAddon(practiceA, true);
      assert.strictEqual(EntitlementService.getMockInventoryAddon(practiceA), true);
      EntitlementService.setMockInventoryAddon(practiceA, false);
      assert.strictEqual(EntitlementService.getMockInventoryAddon(practiceA), false);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Item Master vs Physical Stock Separation & Categories
  // ----------------------------------------------------------------------------
  describe('2. Item Master vs Physical Stock Separation & Categories', () => {
    it('creates medicine master without physical stock (Current Stock = 0, OUT_OF_STOCK)', async () => {
      const item = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Ceftriaxone 1g Injection',
        genericName: 'Ceftriaxone Sodium',
        strength: '1g',
        dosageForm: 'Injection',
        presentation: 'Injection, 1 vial',
        packSize: '1 vial',
        stockUnit: 'Vial',
        manufacturer: 'Apex Pharma',
        minimumStockLevel: 5,
        targetStockLevel: 20,
      });

      assert.strictEqual(item.currentStock, 0);
      assert.strictEqual(item.validStock, 0);
      assert.strictEqual(item.stockStatus, 'OUT_OF_STOCK');
      assert.strictEqual(item.batchesCount, 0);
    });

    it('supports non-medicine categories without forcing pharmaceutical fields', async () => {
      // Consumable: Syringe
      const syringe = await InventoryService.createItem(practiceA, {
        category: 'CONSUMABLE',
        name: 'Dispovan 5ml Syringe with Needle',
        stockUnit: 'Piece',
        packSize: '100 pcs/box',
        manufacturer: 'HMD',
        minimumStockLevel: 50,
      });
      assert.strictEqual(syringe.category, 'CONSUMABLE');
      assert.strictEqual(syringe.genericName, null);
      assert.strictEqual(syringe.dosageForm, null);

      // Lab Material
      const slides = await InventoryService.createItem(practiceA, {
        category: 'LAB_MATERIAL',
        name: 'Microscope Glass Slides',
        stockUnit: 'Box',
        packSize: '50 slides',
      });
      assert.strictEqual(slides.category, 'LAB_MATERIAL');

      // Surgical Material
      const sutures = await InventoryService.createItem(practiceA, {
        category: 'SURGICAL_MATERIAL',
        name: 'Chromic Catgut 2-0 Suture',
        stockUnit: 'Foil Pack',
        packSize: '12 foils/box',
      });
      assert.strictEqual(sutures.category, 'SURGICAL_MATERIAL');

      // Other
      const cotton = await InventoryService.createItem(practiceA, {
        category: 'OTHER',
        name: 'Absorbent Cotton Wool 500g',
        stockUnit: 'Roll',
      });
      assert.strictEqual(cotton.category, 'OTHER');
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Batch-Level Stock & Opening Stock Workflow
  // ----------------------------------------------------------------------------
  describe('3. Batch-Level Stock & Opening Stock Workflow', () => {
    it('creates initial opening stock with immutable audit transaction', async () => {
      const item = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Opthocare Eye Drops',
        dosageForm: 'Eye drops',
        packSize: '5 ml',
        stockUnit: 'Bottle',
        presentation: 'Eye drops, 5 ml bottle',
        minimumStockLevel: 4,
      });

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);
      const expiry = futureDate.toISOString().split('T')[0];

      const { batch, transaction } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'OPG472',
        expiryDate: expiry,
        quantity: 10,
        purchaseRate: 85,
        mrp: 140,
        performedByUserId: userDoctor,
      });

      assert.strictEqual(batch.batchNumber, 'OPG472');
      assert.strictEqual(batch.currentQuantity, 10);
      assert.strictEqual(transaction.transactionType, 'OPENING_STOCK');
      assert.strictEqual(transaction.quantityChange, 10);
      assert.strictEqual(transaction.quantityBefore, 0);
      assert.strictEqual(transaction.quantityAfter, 10);
      assert.strictEqual(transaction.unitCost, 85);

      // Verify item reflects stock
      const updatedItem = await InventoryService.getItemById(item.id, practiceA);
      assert.strictEqual(updatedItem.currentStock, 10);
      assert.strictEqual(updatedItem.validStock, 10);
      assert.strictEqual(updatedItem.stockStatus, 'IN_STOCK');
    });

    it('maintains multiple batches for a single item without duplicating master records', async () => {
      const item = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Amoxicillin 250mg Capsules',
        stockUnit: 'Strip',
        minimumStockLevel: 5,
      });

      const exp1 = '2028-05-15';
      const exp2 = '2029-06-30';

      await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'AMX-001',
        expiryDate: exp1,
        quantity: 10,
        purchaseRate: 45,
      });

      await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'AMX-002',
        expiryDate: exp2,
        quantity: 15,
        purchaseRate: 48,
      });

      const updated = await InventoryService.getItemById(item.id, practiceA);
      assert.strictEqual(updated.currentStock, 25);
      assert.strictEqual(updated.batchesCount, 2);

      const batches = await InventoryService.listBatches(practiceA, { itemId: item.id });
      assert.strictEqual(batches.length, 2);
      assert.strictEqual(batches[0].batchNumber, 'AMX-001');
      assert.strictEqual(batches[1].batchNumber, 'AMX-002');
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Expiry Management & Non-Invoicable Expired Stock
  // ----------------------------------------------------------------------------
  describe('4. Expiry Management & Non-Invoicable Expired Stock', () => {
    it('flags expired stock and excludes it from valid stock', async () => {
      const item = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Cefavet Oral Suspension',
        stockUnit: 'Bottle',
        minimumStockLevel: 5,
      });

      // Add expired batch
      await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'OLD-EXP',
        expiryDate: '2023-01-01', // Expired
        quantity: 5,
        purchaseRate: 60,
      });

      // Add valid batch
      await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'NEW-VALID',
        expiryDate: '2028-10-01', // Valid
        quantity: 8,
        purchaseRate: 65,
      });

      const refreshed = await InventoryService.getItemById(item.id, practiceA);
      assert.strictEqual(refreshed.currentStock, 13); // Physical units
      assert.strictEqual(refreshed.validStock, 8); // Only non-expired units
      assert.strictEqual(refreshed.stockStatus, 'IN_STOCK');

      // Check alerts
      const alerts = await InventoryService.getAlerts(practiceA);
      assert.strictEqual(alerts.expiredCount, 1);
      assert.strictEqual(alerts.expired[0].batchNumber, 'OLD-EXP');
    });
  });

  // ----------------------------------------------------------------------------
  // 5. FEFO (First Expiry, First Out) Stock Deduction
  // ----------------------------------------------------------------------------
  describe('5. FEFO (First Expiry, First Out) Stock Deduction', () => {
    it('deducts from earliest expiring valid batch first and skips expired batches', async () => {
      const item = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Meloxicam 0.5% Injection',
        stockUnit: 'Vial',
      });

      // Batch 1: Expired (should NOT be deducted)
      await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'BATCH-EXPIRED',
        expiryDate: '2022-01-01',
        quantity: 10,
        purchaseRate: 50,
      });

      // Batch 2: Earlier expiry (2027-01-01) -> 10 vials
      const { batch: b2 } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'BATCH-FEFO-1',
        expiryDate: '2027-01-01',
        quantity: 10,
        purchaseRate: 55,
      });

      // Batch 3: Later expiry (2028-06-01) -> 10 vials
      const { batch: b3 } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'BATCH-FEFO-2',
        expiryDate: '2028-06-01',
        quantity: 10,
        purchaseRate: 60,
      });

      // Deduct 15 vials via invoice
      const invoiceId = 'inv-test-999';
      const invoiceNo = 'INV/2026/001';
      const { transactions } = await InventoryService.deductInvoiceStock(
        practiceA,
        invoiceId,
        invoiceNo,
        [{ medicineId: null, description: 'Meloxicam 0.5% Injection', quantity: 15 }]
      );

      // Verify transactions
      assert.strictEqual(transactions.length, 2);
      // First deduction: 10 from BATCH-FEFO-1
      assert.strictEqual(transactions[0].batchId, b2.id);
      assert.strictEqual(transactions[0].quantityChange, -10);
      assert.strictEqual(transactions[0].quantityAfter, 0);

      // Second deduction: 5 from BATCH-FEFO-2
      assert.strictEqual(transactions[1].batchId, b3.id);
      assert.strictEqual(transactions[1].quantityChange, -5);
      assert.strictEqual(transactions[1].quantityAfter, 5);

      // Check remaining batches
      const batchList = await InventoryService.listBatches(practiceA, { itemId: item.id });
      const b2Updated = batchList.find((b) => b.id === b2.id);
      const b3Updated = batchList.find((b) => b.id === b3.id);
      const expUpdated = batchList.find((b) => b.batchNumber === 'BATCH-EXPIRED');

      assert.strictEqual(b2Updated?.currentQuantity, 0);
      assert.strictEqual(b3Updated?.currentQuantity, 5);
      assert.strictEqual(expUpdated?.currentQuantity, 10); // Untouched
    });

    it('reverses invoice deduction upon cancellation with auditable REVERSAL transaction', async () => {
      const item = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Tramadol 50mg/ml Injection',
        stockUnit: 'Ampoule',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'TRM-101',
        expiryDate: '2028-12-31',
        quantity: 20,
        purchaseRate: 25,
      });

      const invoiceId = 'inv-to-cancel-01';
      await InventoryService.deductInvoiceStock(
        practiceA,
        invoiceId,
        'INV/CANCEL/001',
        [{ medicineId: null, description: 'Tramadol 50mg/ml Injection', quantity: 4 }]
      );

      let bCheck = await InventoryService.getBatchById(batch.id, practiceA);
      assert.strictEqual(bCheck.currentQuantity, 16);

      // Cancel invoice -> Reversal
      const { transactions: revTxs } = await InventoryService.reverseInvoiceStock(
        practiceA,
        invoiceId,
        'Client requested refund',
        userDoctor
      );

      assert.strictEqual(revTxs.length, 1);
      assert.strictEqual(revTxs[0].transactionType, 'REVERSAL');
      assert.strictEqual(revTxs[0].quantityChange, 4);
      assert.strictEqual(revTxs[0].quantityAfter, 20);

      bCheck = await InventoryService.getBatchById(batch.id, practiceA);
      assert.strictEqual(bCheck.currentQuantity, 20);
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Manual Stock Adjustment & Stocktake Auditing
  // ----------------------------------------------------------------------------
  describe('6. Manual Stock Adjustment & Stocktake Auditing', () => {
    it('requires a mandatory reason and records auditable transaction for manual adjustment', async () => {
      const item = await InventoryService.createItem(practiceA, {
        category: 'CONSUMABLE',
        name: 'IV Infusion Set Adult',
        stockUnit: 'Set',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'IV-01',
        expiryDate: '2029-01-01',
        quantity: 50,
        purchaseRate: 22,
      });

      // Attempt adjustment without reason -> should fail
      await assert.rejects(
        async () => {
          await InventoryService.adjustStock(practiceA, {
            itemId: item.id,
            batchId: batch.id,
            quantityChange: -2,
            reason: '',
          });
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.errorCode, 'REASON_REQUIRED');
          return true;
        }
      );

      // Successful adjustment with reason
      const { transaction } = await InventoryService.adjustStock(practiceA, {
        itemId: item.id,
        batchId: batch.id,
        quantityChange: -3,
        reason: 'Damaged packaging during handling',
        notes: 'Outer sterile pouch punctured',
        performedByUserId: userDoctor,
      });

      assert.strictEqual(transaction.transactionType, 'DAMAGED');
      assert.strictEqual(transaction.quantityChange, -3);
      assert.strictEqual(transaction.quantityBefore, 50);
      assert.strictEqual(transaction.quantityAfter, 47);

      const b = await InventoryService.getBatchById(batch.id, practiceA);
      assert.strictEqual(b.currentQuantity, 47);
    });

    it('performs stocktake variance calculation and records auditable adjustments', async () => {
      const item = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Doxycycline 100mg Tablets',
        stockUnit: 'Strip',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'DOX-202',
        expiryDate: '2028-09-01',
        quantity: 30,
        purchaseRate: 35,
      });

      // Stocktake: System says 30, physical count is 27 (variance -3)
      const result = await InventoryService.performStocktake(
        practiceA,
        [{ itemId: item.id, batchId: batch.id, physicalQuantity: 27 }],
        userDoctor
      );

      assert.strictEqual(result.adjustmentsCount, 1);
      assert.strictEqual(result.transactions[0].quantityChange, -3);
      assert.strictEqual(result.transactions[0].quantityBefore, 30);
      assert.strictEqual(result.transactions[0].quantityAfter, 27);

      const b = await InventoryService.getBatchById(batch.id, practiceA);
      assert.strictEqual(b.currentQuantity, 27);
    });
  });

  // ----------------------------------------------------------------------------
  // 7. Universal Purchase Invoice Importer & Normalization
  // ----------------------------------------------------------------------------
  describe('7. Universal Purchase Invoice Importer & Normalization', () => {
    it('semantically normalizes diverse supplier invoice formats without hardcoded columns', async () => {
      // Sample invoice text simulating multi-line pharmaceutical supplier bill
      const rawInvoiceText = `
        TAX INVOICE
        MYTHRI PHARMA DISTRIBUTORS
        GSTIN: 36ABCDE1234F1Z5
        Ph: +91 9876543210
        Invoice No: MY/26-27/6597   Date: 28/08/2026
        -------------------------------------------------------------
        Particulars               Pack      Batch No   Exp Date   Qty   Rate   MRP    Amount
        -------------------------------------------------------------
        OPTHOCARE EYE DROPS       5 ML      OPG472     05/2028    10    85.00  140.00 850.00
        CEFAVET ORAL SUSPENSION   60 ML     TSVCV2602  10/2027    15    92.50  160.00 1387.50
        DISPOVAN SYRINGE 2.5ML    100 PCS   SYR90      02/2029    2     220.00 350.00 440.00
        -------------------------------------------------------------
        Total Amount: Rs 2677.50
      `;

      const parsed = await UniversalInvoiceParserService.parseInvoiceText(rawInvoiceText, practiceA);

      // Verify Supplier Extraction
      assert.strictEqual(parsed.supplier.name, 'MYTHRI PHARMA DISTRIBUTORS');
      assert.strictEqual(parsed.supplier.gstin, '36ABCDE1234F1Z5');
      assert.strictEqual(parsed.invoiceNumber, 'MY/26-27/6597');
      assert.strictEqual(parsed.invoiceDate, '2026-08-28');
      assert.strictEqual(parsed.totalAmount, 2677.5);

      // Verify Line Items
      assert.strictEqual(parsed.items.length, 3);

      const item1 = parsed.items[0];
      assert.strictEqual(item1.name, 'OPTHOCARE EYE DROPS');
      assert.strictEqual(item1.category, 'MEDICINE');
      assert.strictEqual(item1.batchNumber, 'OPG472');
      assert.strictEqual(item1.expiryDate, '2028-05-01');
      assert.strictEqual(item1.quantity, 10);
      assert.strictEqual(item1.purchaseRate, 85);
      assert.strictEqual(item1.mrp, 140);
      assert.strictEqual(item1.packSize, '5 ML');

      const item3 = parsed.items[2];
      assert.strictEqual(item3.name, 'DISPOVAN SYRINGE 2.5ML');
      assert.strictEqual(item3.category, 'CONSUMABLE');
      assert.strictEqual(item3.quantity, 2);
    });

    it('detects duplicate invoice warning when supplier and invoice number match existing record', async () => {
      // First, confirm a purchase
      await InventoryService.confirmPurchaseInvoice(
        practiceA,
        {
          supplier: { name: 'MYTHRI PHARMA', gstin: '36ABCDE1234F1Z5' },
          invoiceNumber: 'MY/26-27/6597',
          invoiceDate: '2026-08-28',
          totalAmount: 500,
          items: [
            {
              rawName: 'Sample Medicine',
              name: 'Sample Medicine',
              category: 'MEDICINE',
              stockUnit: 'Vial',
              batchNumber: 'B1',
              expiryDate: '2028-01-01',
              quantity: 5,
              purchaseRate: 100,
            },
          ],
        },
        userDoctor
      );

      // Now parse identical invoice again
      const text = `
        MYTHRI PHARMA
        Invoice No: MY/26-27/6597
        Date: 28/08/2026
        Item: Sample Medicine Qty: 5 Batch: B1 Exp: 01/2028 Rate: 100
      `;

      const parsed = await UniversalInvoiceParserService.parseInvoiceText(text, practiceA);
      assert.strictEqual(parsed.isDuplicateWarning, true);
      assert.ok(parsed.duplicateMessage?.includes('MY/26-27/6597'));
    });
  });

  // ----------------------------------------------------------------------------
  // 8. Prescription Stock Resolution (Internal vs External)
  // ----------------------------------------------------------------------------
  describe('8. Prescription Stock Resolution (Internal vs External)', () => {
    it('accurately resolves internal stock vs external quantity for prescribed items', async () => {
      // Item A: Fully in stock (Stock: 10, Required: 5)
      const medA = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Amoxicillin Oral Drops',
        stockUnit: 'Bottle',
      });
      await InventoryService.addOpeningStock(practiceA, {
        itemId: medA.id,
        batchNumber: 'AMX-DROPS',
        expiryDate: '2028-01-01',
        quantity: 10,
        purchaseRate: 50,
      });

      // Item B: Partially in stock (Stock: 4, Required: 10)
      const medB = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Prednisolone 5mg Tablets',
        stockUnit: 'Tablet',
      });
      await InventoryService.addOpeningStock(practiceA, {
        itemId: medB.id,
        batchNumber: 'PRED-5',
        expiryDate: '2028-06-01',
        quantity: 4,
        purchaseRate: 2,
      });

      // Item C: Zero stock (Not in inventory or stock = 0, Required: 2)

      const resolutions = await InventoryService.resolvePrescriptionStock(practiceA, [
        { brandName: 'Amoxicillin Oral Drops', totalQuantity: 5 },
        { brandName: 'Prednisolone 5mg Tablets', totalQuantity: 10 },
        { brandName: 'Specialty Canine Vitamin Gel', totalQuantity: 2 },
      ]);

      assert.strictEqual(resolutions.length, 3);

      // Item A
      assert.strictEqual(resolutions[0].status, 'IN_STOCK');
      assert.strictEqual(resolutions[0].internalQuantity, 5);
      assert.strictEqual(resolutions[0].externalQuantity, 0);

      // Item B
      assert.strictEqual(resolutions[1].status, 'PARTIAL');
      assert.strictEqual(resolutions[1].internalQuantity, 4);
      assert.strictEqual(resolutions[1].externalQuantity, 6);

      // Item C
      assert.strictEqual(resolutions[2].status, 'EXTERNAL');
      assert.strictEqual(resolutions[2].internalQuantity, 0);
      assert.strictEqual(resolutions[2].externalQuantity, 2);
    });
  });

  // ----------------------------------------------------------------------------
  // 9. Dashboard Metrics & Valuation (Cost-based Valuation in ₹)
  // ----------------------------------------------------------------------------
  describe('9. Dashboard Metrics & Valuation', () => {
    it('calculates total physical units, unique items, and purchase cost valuation in INR', async () => {
      const item1 = await InventoryService.createItem(practiceA, {
        category: 'MEDICINE',
        name: 'Item 1',
        stockUnit: 'Vial',
      });
      await InventoryService.addOpeningStock(practiceA, {
        itemId: item1.id,
        batchNumber: 'B1',
        expiryDate: '2028-01-01',
        quantity: 10,
        purchaseRate: 100, // ₹1,000
        mrp: 180,
      });

      const item2 = await InventoryService.createItem(practiceA, {
        category: 'CONSUMABLE',
        name: 'Item 2',
        stockUnit: 'Piece',
      });
      await InventoryService.addOpeningStock(practiceA, {
        itemId: item2.id,
        batchNumber: 'B2',
        expiryDate: '2028-01-01',
        quantity: 20,
        purchaseRate: 15, // ₹300
        mrp: 30,
      });

      const dashboard = await InventoryService.getDashboard(practiceA);

      assert.strictEqual(dashboard.totalUniqueItems, 2);
      assert.strictEqual(dashboard.totalPhysicalUnits, 30);
      // Valuation = (10 * 100) + (20 * 15) = 1000 + 300 = 1300
      assert.strictEqual(dashboard.stockValuation, 1300);
      assert.strictEqual(dashboard.outOfStockCount, 0);
      assert.strictEqual(dashboard.lowStockCount, 0);
    });
  });
});
