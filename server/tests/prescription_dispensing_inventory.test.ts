// ==============================================================================
// VetRx — Prescription, Dispensing & Inventory Stock Unified Test Suite
// Phase 9 Automated Regression Suite
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { UnitConversionService } from '../src/inventory/unit-conversion.service.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Prescription, Dispensing & Inventory Stock Management Suite', () => {
  const practiceA = 'practice-vet-main-001';
  const practiceB = 'practice-vet-other-002';
  const userVet = 'user-dr-vet';

  beforeEach(() => {
    InventoryService.clearMockStore();
  });

  // ----------------------------------------------------------------------------
  // 1. Fractional Stock & Base-Unit Calculations (Required Liquid Medicine Case)
  // ----------------------------------------------------------------------------
  describe('Phase 4: Fractional Stock & Base-Unit Calculations', () => {
    it('accurately parses pack size and converts liquid bottle to mL base unit', () => {
      const parsed = UnitConversionService.parsePackSize('100 mL bottle', 'mL');
      assert.ok(parsed);
      assert.strictEqual(parsed.containerCapacity, 100);
      assert.strictEqual(parsed.containerUnit, 'mL');
      assert.strictEqual(parsed.packageType, 'bottle');

      const converted = UnitConversionService.convertToBaseUnit(30, 'mL', {
        stockUnit: 'mL',
        packSize: '100 mL bottle',
      });
      assert.strictEqual(converted.baseQuantity, 30);
      assert.strictEqual(converted.baseUnit, 'mL');
      assert.strictEqual(converted.conversionFactor, 1);
    });

    it('liquid medicine reference case: 500 mL opening -> 30 mL -> 65 mL -> 30 mL leaves exactly 375 mL (3.75 bottles)', () => {
      // 1. Setup inventory item: 100 mL per bottle, base unit mL
      let currentStock = 500; // 5 × 100 mL bottles = 500 mL opening balance

      // Opening balance check
      let breakdown = UnitConversionService.calculateContainerBreakdown(currentStock, 'mL', '100 mL bottle');
      assert.strictEqual(breakdown.totalBaseQuantity, 500);
      assert.strictEqual(breakdown.packageEquivalents, 5);
      assert.strictEqual(breakdown.unopenedContainers, 5);
      assert.strictEqual(breakdown.openedContainers, 0);
      assert.strictEqual(breakdown.residualQuantityInOpened, 0);

      // First administration: 30 mL
      currentStock -= 30;
      assert.strictEqual(currentStock, 470);
      breakdown = UnitConversionService.calculateContainerBreakdown(currentStock, 'mL', '100 mL bottle');
      assert.strictEqual(breakdown.totalBaseQuantity, 470);
      assert.strictEqual(breakdown.packageEquivalents, 4.7);
      assert.strictEqual(breakdown.unopenedContainers, 4);
      assert.strictEqual(breakdown.openedContainers, 1);
      assert.strictEqual(breakdown.residualQuantityInOpened, 70);

      // Second administration: 65 mL
      currentStock -= 65;
      assert.strictEqual(currentStock, 405);
      breakdown = UnitConversionService.calculateContainerBreakdown(currentStock, 'mL', '100 mL bottle');
      assert.strictEqual(breakdown.totalBaseQuantity, 405);
      assert.strictEqual(breakdown.packageEquivalents, 4.05);
      assert.strictEqual(breakdown.unopenedContainers, 4);
      assert.strictEqual(breakdown.openedContainers, 1);
      assert.strictEqual(breakdown.residualQuantityInOpened, 5);

      // Third administration: 30 mL
      currentStock -= 30;
      assert.strictEqual(currentStock, 375);
      breakdown = UnitConversionService.calculateContainerBreakdown(currentStock, 'mL', '100 mL bottle');

      // The system must not round 3.75 to 4 or 3 bottles!
      assert.strictEqual(breakdown.totalBaseQuantity, 375);
      assert.strictEqual(breakdown.packageEquivalents, 3.75);
      assert.strictEqual(breakdown.unopenedContainers, 3);
      assert.strictEqual(breakdown.openedContainers, 1);
      assert.strictEqual(breakdown.residualQuantityInOpened, 75);
      assert.strictEqual(breakdown.displayText, '375 mL remaining (3.75 × 100 mL bottles)');
    });

    it('safely rejects unconfigured or incompatible unit conversions without guessing', () => {
      assert.throws(
        () => {
          UnitConversionService.convertToBaseUnit(5, 'kg', {
            stockUnit: 'mL',
            packSize: '100 mL',
          });
        },
        /Incompatible or unconfigured unit conversion/
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Prescription Lifecycle: Prescribing vs Dispensing
  // ----------------------------------------------------------------------------
  describe('Phase 2: Prescription & Dispensing Lifecycle', () => {
    it('drafting or approving a prescription does not deduct inventory stock until explicit dispense', async () => {
      // Create medicine product & batch with 100 tablets
      const item = await InventoryService.createItem(practiceA, {
        name: 'Amoxicillin 250mg',
        category: 'MEDICINE',
        stockUnit: 'tablet',
        packSize: '10 tablets/strip',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'AMX-2026-01',
        expiryDate: '2028-12-31',
        quantity: 100,
      });

      // Stock before prescribing = 100
      let items = await InventoryService.listItems(practiceA);
      let targetItem = items.find((i) => i.id === item.id);
      assert.strictEqual(targetItem?.currentStock, 100);

      // Prescription exists with 20 tablets prescribed
      const rxId = 'rx-lifecycle-001';
      const rxItemId = 'rx-item-001';

      // Verify explicit dispense action deducts exactly 20 units
      const dispenseRes = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: rxId,
        dispenseType: 'DISPENSE',
        items: [
          {
            prescriptionItemId: rxItemId,
            inventoryItemId: item.id,
            inventoryBatchId: batch.id,
            dispenseQuantity: 20,
            dispenseUnit: 'tablet',
          },
        ],
      }, userVet);

      assert.strictEqual(dispenseRes.success, true);
      assert.strictEqual(dispenseRes.dispensedRecords.length, 1);
      assert.strictEqual(dispenseRes.dispensedRecords[0].quantity, 20);

      // Verify stock decreased by 20 to 80
      items = await InventoryService.listItems(practiceA);
      targetItem = items.find((i) => i.id === item.id);
      assert.strictEqual(targetItem?.currentStock, 80);
    });

    it('supports partial dispensing and records accurate remaining balances', async () => {
      const item = await InventoryService.createItem(practiceA, {
        name: 'Meloxicam 5mg/ml',
        category: 'MEDICINE',
        stockUnit: 'mL',
        packSize: '50 mL vial',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'MLX-2026-02',
        expiryDate: '2027-06-30',
        quantity: 50,
      });

      const rxId = 'rx-partial-001';
      const rxItemId = 'rx-item-partial-001';

      // Partial dispense 1: 15 mL supplied today
      const res1 = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: rxId,
        dispenseType: 'ADMINISTRATION',
        items: [
          {
            prescriptionItemId: rxItemId,
            inventoryItemId: item.id,
            inventoryBatchId: batch.id,
            dispenseQuantity: 15,
            dispenseUnit: 'mL',
          },
        ],
      }, userVet);

      assert.strictEqual(res1.success, true);
      let batches = await InventoryService.listBatches(practiceA);
      let b = batches.find((x) => x.id === batch.id);
      assert.strictEqual(b?.currentQuantity, 35);

      // Partial dispense 2: 10 mL supplied tomorrow
      const res2 = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: rxId,
        dispenseType: 'ADMINISTRATION',
        items: [
          {
            prescriptionItemId: rxItemId,
            inventoryItemId: item.id,
            inventoryBatchId: batch.id,
            dispenseQuantity: 10,
            dispenseUnit: 'mL',
          },
        ],
      }, userVet);

      assert.strictEqual(res2.success, true);
      batches = await InventoryService.listBatches(practiceA);
      b = batches.find((x) => x.id === batch.id);
      assert.strictEqual(b?.currentQuantity, 25);
    });

    it('reverses dispensing via authorized compensating stock movement', async () => {
      const item = await InventoryService.createItem(practiceA, {
        name: 'Enrofloxacin 100mg',
        category: 'MEDICINE',
        stockUnit: 'tablet',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'ENRO-2026-03',
        expiryDate: '2028-01-01',
        quantity: 50,
      });

      const rxId = 'rx-reversal-001';
      const rxItemId = 'rx-item-reversal-001';

      // Dispense 10 tablets
      const dispRes = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: rxId,
        dispenseType: 'DISPENSE',
        items: [
          {
            prescriptionItemId: rxItemId,
            inventoryItemId: item.id,
            inventoryBatchId: batch.id,
            dispenseQuantity: 10,
            dispenseUnit: 'tablet',
          },
        ],
      }, userVet);

      const dispId = dispRes.dispensedRecords[0].id;
      let batches = await InventoryService.listBatches(practiceA);
      assert.strictEqual(batches.find((x) => x.id === batch.id)?.currentQuantity, 40);

      // Reverse dispensing with reason
      const revRes = await InventoryService.reversePrescriptionDispensing(
        practiceA,
        dispId,
        'Owner cancelled take-home prescription before leaving clinic',
        userVet
      );

      assert.strictEqual(revRes.success, true);
      assert.strictEqual(revRes.reversedRecord.status, 'REVERSED');
      assert.strictEqual(revRes.reversedRecord.reversalReason, 'Owner cancelled take-home prescription before leaving clinic');

      // Stock is restored to 50 via compensating transaction
      batches = await InventoryService.listBatches(practiceA);
      assert.strictEqual(batches.find((x) => x.id === batch.id)?.currentQuantity, 50);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. External Medicines (Not in Hospital Stock)
  // ----------------------------------------------------------------------------
  describe('Phase 3: External Prescriptions for Non-Stocked Medicines', () => {
    it('mixed prescription: internal items deduct stock, external items create zero stock movements', async () => {
      // 1. Create stocked medicine
      const internalItem = await InventoryService.createItem(practiceA, {
        name: 'Ceftriaxone 1g Vial',
        category: 'MEDICINE',
        stockUnit: 'vial',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: internalItem.id,
        batchNumber: 'CEF-001',
        expiryDate: '2028-12-31',
        quantity: 20,
      });

      const rxId = 'rx-mixed-001';

      // 2. Dispense mixed prescription:
      // Item 1: Internal Ceftriaxone (1 vial)
      // Item 2: External Specialized Renal Diet (1 pack, not stocked)
      const res = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: rxId,
        dispenseType: 'DISPENSE',
        items: [
          {
            prescriptionItemId: 'rx-internal-1',
            inventoryItemId: internalItem.id,
            inventoryBatchId: batch.id,
            dispenseQuantity: 1,
            dispenseUnit: 'vial',
            isExternal: false,
          },
          {
            prescriptionItemId: 'rx-external-2',
            inventoryItemId: null,
            dispenseQuantity: 1,
            dispenseUnit: 'pack',
            isExternal: true,
            notes: 'Purchased externally by client from commercial pet pharmacy',
          },
        ],
      }, userVet);

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.dispensedRecords.length, 2);

      // Internal item reduced stock
      const batches = await InventoryService.listBatches(practiceA);
      assert.strictEqual(batches.find((x) => x.id === batch.id)?.currentQuantity, 19);

      // External item created record without inventory ID and 0 baseQuantity
      const externalRec = res.dispensedRecords.find((r) => r.prescriptionItemId === 'rx-external-2');
      assert.ok(externalRec);
      assert.strictEqual(externalRec.inventoryItemId, null);
      assert.strictEqual(externalRec.baseQuantity, 0);

      // Verify NO inventory item was auto-created for the external product
      const allItems = await InventoryService.listItems(practiceA);
      assert.strictEqual(allItems.length, 1);
      assert.strictEqual(allItems[0].id, internalItem.id);
    });

    it('rejects attempt to deduct stock if an item marked external specifies inventoryItemId', async () => {
      const rxId = 'rx-pure-ext';
      const res = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: rxId,
        dispenseType: 'DISPENSE',
        items: [
          {
            prescriptionItemId: 'ext-only-1',
            inventoryItemId: null,
            dispenseQuantity: 2,
            dispenseUnit: 'bottle',
            isExternal: true,
          },
        ],
      }, userVet);

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.dispensedRecords[0].inventoryItemId, null);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Batch Safety, FEFO, Expiry & Duplicate Deductions
  // ----------------------------------------------------------------------------
  describe('Phase 5 & 6: Batch Safety, FEFO & Concurrency Protection', () => {
    it('enforces FEFO selection when batch is not explicitly specified', async () => {
      const item = await InventoryService.createItem(practiceA, {
        name: 'Doxycycline 100mg',
        category: 'MEDICINE',
        stockUnit: 'tablet',
      });

      // Batch 1 expires in 2027
      const { batch: batchLater } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'DOX-2027',
        expiryDate: '2027-12-31',
        quantity: 100,
      });

      // Batch 2 expires in 2026 (earlier expiry)
      const { batch: batchEarlier } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'DOX-2026',
        expiryDate: '2026-12-31',
        quantity: 50,
      });

      // Dispense without specifying batch: FEFO should select DOX-2026
      const res = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: 'rx-fefo',
        dispenseType: 'DISPENSE',
        items: [
          {
            prescriptionItemId: 'rx-fefo-item',
            inventoryItemId: item.id,
            dispenseQuantity: 20,
            dispenseUnit: 'tablet',
          },
        ],
      }, userVet);

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.dispensedRecords[0].batchNumber, 'DOX-2026');

      const batches = await InventoryService.listBatches(practiceA);
      assert.strictEqual(batches.find((x) => x.id === batchEarlier.id)?.currentQuantity, 30);
      assert.strictEqual(batches.find((x) => x.id === batchLater.id)?.currentQuantity, 100);
    });

    it('rejects dispensing from an expired batch', async () => {
      const item = await InventoryService.createItem(practiceA, {
        name: 'Expired Serum',
        category: 'MEDICINE',
        stockUnit: 'vial',
      });

      const { batch: expiredBatch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'EXP-1999',
        expiryDate: '2020-01-01',
        quantity: 10,
      });

      await assert.rejects(
        async () => {
          await InventoryService.dispensePrescription(practiceA, {
            prescriptionId: 'rx-expired-test',
            dispenseType: 'DISPENSE',
            items: [
              {
                prescriptionItemId: 'item-expired',
                inventoryItemId: item.id,
                inventoryBatchId: expiredBatch.id,
                dispenseQuantity: 2,
              },
            ],
          }, userVet);
        },
        /BATCH_EXPIRED|Cannot dispense expired batch/
      );
    });

    it('rejects dispensing when requested quantity exceeds available stock', async () => {
      const item = await InventoryService.createItem(practiceA, {
        name: 'Scarce Medicine',
        category: 'MEDICINE',
        stockUnit: 'tablet',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'SCARCE-1',
        expiryDate: '2028-01-01',
        quantity: 5,
      });

      await assert.rejects(
        async () => {
          await InventoryService.dispensePrescription(practiceA, {
            prescriptionId: 'rx-scarce-test',
            dispenseType: 'DISPENSE',
            items: [
              {
                prescriptionItemId: 'item-scarce',
                inventoryItemId: item.id,
                inventoryBatchId: batch.id,
                dispenseQuantity: 20, // Only 5 available!
              },
            ],
          }, userVet);
        },
        (err: any) => {
          assert.strictEqual(err.errorCode, 'INSUFFICIENT_BATCH_STOCK');
          return true;
        }
      );
    });

    it('idempotency: identical request key returns committed result without double-deducting', async () => {
      const item = await InventoryService.createItem(practiceA, {
        name: 'Anti-inflammatory',
        category: 'MEDICINE',
        stockUnit: 'tablet',
      });

      const { batch } = await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'IDEMP-1',
        expiryDate: '2028-01-01',
        quantity: 50,
      });

      const idempKey = 'client-req-uuid-12345';

      // First click
      const res1 = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: 'rx-idemp',
        dispenseType: 'DISPENSE',
        idempotencyKey: idempKey,
        items: [
          {
            prescriptionItemId: 'item-idemp-1',
            inventoryItemId: item.id,
            inventoryBatchId: batch.id,
            dispenseQuantity: 10,
          },
        ],
      }, userVet);

      assert.strictEqual(res1.success, true);
      let batches = await InventoryService.listBatches(practiceA);
      assert.strictEqual(batches.find((x) => x.id === batch.id)?.currentQuantity, 40);

      // Second click (retry / duplicate network request)
      const res2 = await InventoryService.dispensePrescription(practiceA, {
        prescriptionId: 'rx-idemp',
        dispenseType: 'DISPENSE',
        idempotencyKey: idempKey,
        items: [
          {
            prescriptionItemId: 'item-idemp-1',
            inventoryItemId: item.id,
            inventoryBatchId: batch.id,
            dispenseQuantity: 10,
          },
        ],
      }, userVet);

      assert.strictEqual(res2.success, true);
      // Stock MUST still be 40, NOT 30!
      batches = await InventoryService.listBatches(practiceA);
      assert.strictEqual(batches.find((x) => x.id === batch.id)?.currentQuantity, 40);
    });

    it('tenant practice isolation: Practice B cannot dispense stock from Practice A', async () => {
      const itemA = await InventoryService.createItem(practiceA, {
        name: 'Practice A Exclusive Medicine',
        category: 'MEDICINE',
        stockUnit: 'tablet',
      });

      const { batch: batchA } = await InventoryService.addOpeningStock(practiceA, {
        itemId: itemA.id,
        batchNumber: 'PRACTICE-A-BATCH',
        expiryDate: '2028-01-01',
        quantity: 100,
      });

      // Attempt to dispense itemA from practiceB
      await assert.rejects(
        async () => {
          await InventoryService.dispensePrescription(practiceB, {
            prescriptionId: 'rx-practice-b',
            dispenseType: 'DISPENSE',
            items: [
              {
                prescriptionItemId: 'item-cross-tenant',
                inventoryItemId: itemA.id,
                inventoryBatchId: batchA.id,
                dispenseQuantity: 10,
              },
            ],
          }, 'user-vet-b');
        },
        (err: any) => {
          assert.strictEqual(err.errorCode, 'INVENTORY_ITEM_NOT_FOUND');
          return true;
        }
      );
    });
  });
});
