process.env.VETRX_FAST_TEST = '1';

import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryService } from '../src/inventory/inventory.service.js';

test('VetRx Phase 6: Store Stock, Practice Bag & Field Stock Control Suite', async (t) => {
  const practiceId = 'test_practice_phase6_p1';
  const userId = 'vet_shameem_dr';

  t.beforeEach(() => {
    InventoryService.clearMockStore();
  });

  await t.test('1. ensureDefaultLocations creates Store Stock and Practice Bag locations', async () => {
    const { storeLocation, bagLocation } = await InventoryService.ensureDefaultLocations(practiceId);

    assert.ok(storeLocation.id, 'Store Stock must have an ID');
    assert.equal(storeLocation.name, 'Store Stock');
    assert.equal(storeLocation.isDefault, true);

    assert.ok(bagLocation.id, 'Practice Bag must have an ID');
    assert.equal(bagLocation.name, 'Practice Bag');
    assert.equal(bagLocation.isDefault, false);
    assert.notEqual(storeLocation.id, bagLocation.id);

    // Repeated call returns identical locations (idempotent)
    const secondCall = await InventoryService.ensureDefaultLocations(practiceId);
    assert.equal(secondCall.storeLocation.id, storeLocation.id);
    assert.equal(secondCall.bagLocation.id, bagLocation.id);
  });

  await t.test('2. Stock In receipts medicine into Store Stock with batch, cost and ledger transaction', async () => {
    const result = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Oxytetracycline 20% LA',
        category: 'MEDICINE',
        presentation: 'Injectable 100ml',
        stockUnit: 'Vial',
        batchNumber: 'OXY-2026-A1',
        expiryDate: '2027-12-31',
        quantity: 20,
        purchaseRate: 250,
        mrp: 350,
        sourceReference: 'PO-9901',
        notes: 'Initial practice purchase',
      },
      userId
    );

    assert.equal(result.success, true);
    assert.equal(result.item.name, 'Oxytetracycline 20% LA');
    assert.equal(result.batch.batchNumber, 'OXY-2026-A1');
    assert.equal(result.batch.currentQuantity, 20);
    assert.equal(result.transaction.transactionType, 'PURCHASE');
    assert.equal(result.transaction.referenceType, 'STOCK_IN');
    assert.equal(result.transaction.quantityChange, 20);

    // Verify Store Stock query reflects the new items
    const storeStock = await InventoryService.getStoreStock(practiceId);
    assert.equal(storeStock.summary.totalUnits, 20);
    assert.equal(storeStock.items.length, 1);
    assert.equal(storeStock.batches[0].batchNumber, 'OXY-2026-A1');

    // Practice Bag must still be empty
    const bagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStock.summary.totalUnits, 0);
  });

  await t.test('3. Transfer Stock moves inventory from Store Stock to Practice Bag atomically', async () => {
    // 1. Stock In 10 vials into Store Stock
    const inRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Meloxicam 5mg/ml',
        category: 'MEDICINE',
        stockUnit: 'Vial',
        batchNumber: 'MEL-2026-B1',
        expiryDate: '2028-06-30',
        quantity: 10,
        purchaseRate: 120,
      },
      userId
    );

    // 2. Transfer 4 vials to Practice Bag
    const transferRes = await InventoryService.transferStock(
      practiceId,
      {
        itemId: inRes.item.id,
        batchNumber: 'MEL-2026-B1',
        quantity: 4,
        reason: 'Replenish field bag for morning visits',
        idempotencyKey: 'trf_key_001',
      },
      userId
    );

    assert.equal(transferRes.success, true);
    assert.equal(transferRes.quantity, 4);

    // Store Stock should now have 6 remaining
    const storeStock = await InventoryService.getStoreStock(practiceId);
    const storeBatch = storeStock.batches.find((b) => b.batchNumber === 'MEL-2026-B1');
    assert.equal(storeBatch?.currentQuantity, 6);

    // Practice Bag should now have 4
    const bagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStock.summary.totalUnits, 4);
    const bagBatch = bagStock.batches.find((b) => b.batchNumber === 'MEL-2026-B1');
    assert.equal(bagBatch?.currentQuantity, 4);

    // Verify ledger has two transfer records (debit Store, credit Bag)
    const txs = await InventoryService.listTransactions(practiceId);
    const transferTxs = txs.filter((t) => t.referenceType === 'TRANSFER_TO_BAG');
    assert.equal(transferTxs.length, 2);
    assert.ok(transferTxs.some((t) => t.quantityChange === -4));
    assert.ok(transferTxs.some((t) => t.quantityChange === 4));

    // Duplicate transfer with same idempotency key must not double-transfer
    const retryRes = await InventoryService.transferStock(
      practiceId,
      {
        itemId: inRes.item.id,
        batchNumber: 'MEL-2026-B1',
        quantity: 4,
        idempotencyKey: 'trf_key_001',
      },
      userId
    );
    assert.equal(retryRes.success, true);
    const bagStockAfterRetry = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStockAfterRetry.summary.totalUnits, 4, 'Idempotency prevents duplicate transfer');
  });

  await t.test('4. Transfer Stock strictly prevents negative balances when source stock is insufficient', async () => {
    const inRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Amoxicillin Trihydrate',
        category: 'MEDICINE',
        batchNumber: 'AMX-001',
        expiryDate: '2027-01-01',
        quantity: 3,
      },
      userId
    );

    // Attempt to transfer 10 when only 3 are available
    await assert.rejects(
      async () => {
        await InventoryService.transferStock(
          practiceId,
          {
            itemId: inRes.item.id,
            quantity: 10,
          },
          userId
        );
      },
      {
        name: 'AppError',
        statusCode: 400,
        code: 'INSUFFICIENT_STOCK',
      }
    );

    // Verify source stock remains untouched at 3
    const store = await InventoryService.getStoreStock(practiceId);
    const b = store.batches.find((x) => x.batchNumber === 'AMX-001');
    assert.equal(b?.currentQuantity, 3);
  });

  await t.test('5. Return Unused Stock transfers from Practice Bag back to Store Stock', async () => {
    // 1. Stock In 5 into store, transfer 5 to bag
    const inRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Ivermectin 1%',
        category: 'MEDICINE',
        batchNumber: 'IVM-88',
        expiryDate: '2028-01-01',
        quantity: 5,
      },
      userId
    );

    await InventoryService.transferStock(
      practiceId,
      {
        itemId: inRes.item.id,
        quantity: 5,
      },
      userId
    );

    // Bag has 5, store has 0
    let bagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStock.summary.totalUnits, 5);

    // 2. Return 2 unused vials from field bag to store
    const returnRes = await InventoryService.returnUnusedStock(
      practiceId,
      {
        itemId: inRes.item.id,
        quantity: 2,
        reason: 'Unused field stock returned after visit trip',
      },
      userId
    );

    assert.equal(returnRes.success, true);
    assert.equal(returnRes.quantity, 2);

    // Bag should now have 3, store should have 2
    bagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStock.summary.totalUnits, 3);

    const storeStock = await InventoryService.getStoreStock(practiceId);
    const storeB = storeStock.batches.find((b) => b.batchNumber === 'IVM-88');
    assert.equal(storeB?.currentQuantity, 2);
  });

  await t.test('6. deductFieldUsage (CVP-24) deducts medicine from Practice Bag with idempotency', async () => {
    // 1. Setup item in Store and transfer to Bag
    const inRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Ceftiofur Sodium',
        category: 'MEDICINE',
        batchNumber: 'CEF-77',
        expiryDate: '2027-05-15',
        quantity: 10,
      },
      userId
    );

    await InventoryService.transferStock(
      practiceId,
      {
        itemId: inRes.item.id,
        quantity: 6,
      },
      userId
    );

    // Bag has 6
    let bagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStock.summary.totalUnits, 6);

    // 2. Doctor administers 2 vials during a farm visit
    const usageRes = await InventoryService.deductFieldUsage(
      practiceId,
      {
        visitId: 'visit_999',
        patientName: 'Lactating Cow #402',
        medicineId: inRes.item.id,
        medicineName: 'Ceftiofur Sodium',
        quantity: 2,
        idempotencyKey: 'field_use_key_101',
      },
      userId
    );

    assert.equal(usageRes.success, true);
    assert.equal(usageRes.deductedQuantity, 2);
    assert.equal(usageRes.batchNumber, 'CEF-77');

    // Bag now has 4 remaining
    bagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStock.summary.totalUnits, 4);

    // 3. Repeat submission with same idempotencyKey does not double deduct
    const retryUsage = await InventoryService.deductFieldUsage(
      practiceId,
      {
        visitId: 'visit_999',
        medicineId: inRes.item.id,
        medicineName: 'Ceftiofur Sodium',
        quantity: 2,
        idempotencyKey: 'field_use_key_101',
      },
      userId
    );
    assert.equal(retryUsage.success, true);
    bagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStock.summary.totalUnits, 4, 'Must not double-deduct stock on duplicate call');
  });

  await t.test('7. deductFieldUsage returns INSUFFICIENT_BAG_STOCK when bag is empty without fabricating data', async () => {
    // Item exists in Store (5 vials), but 0 in Practice Bag
    const inRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Ketoprofen 10%',
        category: 'MEDICINE',
        batchNumber: 'KETO-10',
        expiryDate: '2027-08-01',
        quantity: 5,
      },
      userId
    );

    // Attempt to deduct 1 from Bag
    const usageRes = await InventoryService.deductFieldUsage(
      practiceId,
      {
        visitId: 'visit_888',
        medicineId: inRes.item.id,
        medicineName: 'Ketoprofen 10%',
        quantity: 1,
      },
      userId
    );

    assert.equal(usageRes.success, false);
    assert.equal(usageRes.reason, 'INSUFFICIENT_BAG_STOCK');
    assert.equal(usageRes.availableQuantity, 0);
    assert.equal(usageRes.requestedQuantity, 1);
  });

  await t.test('8. Stock Reconciliation enforces variance reasons and audits count adjustments', async () => {
    const inRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Syringes 10ml',
        category: 'CONSUMABLE',
        batchNumber: 'SYR-100',
        expiryDate: '2029-01-01',
        quantity: 50,
      },
      userId
    );

    // Physical count shows 48 (variance -2)
    // Attempt without reason -> must throw error
    await assert.rejects(
      async () => {
        await InventoryService.reconcileLocationStock(practiceId, {
          items: [
            {
              itemId: inRes.item.id,
              batchId: inRes.batch.id,
              recordedQuantity: 50,
              countedQuantity: 48,
            },
          ],
        });
      },
      {
        name: 'AppError',
        statusCode: 400,
        code: 'REASON_REQUIRED',
      }
    );

    // Reconciliation with authorized reason
    const recRes = await InventoryService.reconcileLocationStock(
      practiceId,
      {
        items: [
          {
            itemId: inRes.item.id,
            batchId: inRes.batch.id,
            recordedQuantity: 50,
            countedQuantity: 48,
            reason: 'Accidental packaging tear during transit',
          },
        ],
      },
      userId
    );

    assert.equal(recRes.success, true);
    assert.equal(recRes.adjustmentsCount, 1);
    assert.equal(recRes.reconciledItems[0].variance, -2);

    const store = await InventoryService.getStoreStock(practiceId);
    const b = store.batches.find((x) => x.batchNumber === 'SYR-100');
    assert.equal(b?.currentQuantity, 48);
  });

  await t.test('9. Inventory Dashboard provides Store vs Practice Bag dual metrics', async () => {
    // Prepare items in Store and Bag
    const in1 = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Item A',
        category: 'MEDICINE',
        batchNumber: 'B-A',
        expiryDate: '2028-01-01',
        quantity: 20,
        purchaseRate: 50,
      },
      userId
    );
    await InventoryService.transferStock(
      practiceId,
      { itemId: in1.item.id, quantity: 5 },
      userId
    );

    const dashboard = await InventoryService.getDashboardSummary(practiceId);

    assert.ok(dashboard.storeStockSummary, 'Must contain storeStockSummary');
    assert.ok(dashboard.practiceBagSummary, 'Must contain practiceBagSummary');

    assert.equal(dashboard.storeStockSummary?.totalUnits, 15);
    assert.equal(dashboard.practiceBagSummary?.totalUnits, 5);
  });

  await t.test('10. Duplicate transfers and returns return idempotent cached result without double deducting', async () => {
    const inRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Amoxicillin 15%',
        category: 'MEDICINE',
        batchNumber: 'AMX-001',
        expiryDate: '2028-05-15',
        quantity: 30,
        purchaseRate: 200,
      },
      userId
    );

    const idempotencyKey = 'unique_transfer_key_4455';
    // First transfer
    const res1 = await InventoryService.transferStock(
      practiceId,
      {
        itemId: inRes.item.id,
        quantity: 10,
        idempotencyKey,
      },
      userId
    );
    assert.equal(res1.success, true);
    assert.equal(res1.quantity, 10);

    // Repeated transfer with identical idempotencyKey
    const res2 = await InventoryService.transferStock(
      practiceId,
      {
        itemId: inRes.item.id,
        quantity: 10,
        idempotencyKey,
      },
      userId
    );
    assert.equal(res2.success, true);

    // Store stock must have deducted only ONCE (30 - 10 = 20)
    const store = await InventoryService.getStoreStock(practiceId);
    assert.equal(store.summary.totalUnits, 20);

    const bag = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bag.summary.totalUnits, 10);
  });

  await t.test('11. Tenant isolation strictly segregates practice stock locations and items', async () => {
    const practiceA = 'practice_alpha';
    const practiceB = 'practice_beta';

    // Stock in for Practice A
    await InventoryService.stockIn(
      practiceA,
      {
        name: 'Gentamicin 10%',
        category: 'MEDICINE',
        batchNumber: 'GEN-A',
        expiryDate: '2027-01-01',
        quantity: 15,
        purchaseRate: 80,
      },
      userId
    );

    // Practice B queries Store Stock and Practice Bag
    const storeB = await InventoryService.getStoreStock(practiceB);
    const bagB = await InventoryService.getPracticeBagStock(practiceB);

    assert.equal(storeB.summary.totalUnits, 0, 'Practice B cannot see Practice A store stock');
    assert.equal(bagB.summary.totalUnits, 0, 'Practice B cannot see Practice A bag stock');

    // Attempting cross-tenant transfer must fail
    const storeA = await InventoryService.getStoreStock(practiceA);
    const itemA = storeA.items[0];

    await assert.rejects(
      async () => {
        await InventoryService.transferStock(
          practiceB,
          { itemId: itemA.id, quantity: 2 },
          userId
        );
      },
      {
        name: 'AppError',
        statusCode: 404,
      }
    );
  });

  await t.test('12. Concurrent stock movements protect atomic balance integrity', async () => {
    const inRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Enrofloxacin 10%',
        category: 'MEDICINE',
        batchNumber: 'ENRO-CONC',
        expiryDate: '2029-01-01',
        quantity: 50,
        purchaseRate: 150,
      },
      userId
    );

    // Transfer 20 to Bag
    await InventoryService.transferStock(
      practiceId,
      { itemId: inRes.item.id, quantity: 20 },
      userId
    );

    // Run 5 simultaneous field usage deductions of 3 units each = 15 units
    const deductions = await Promise.all([
      InventoryService.deductFieldUsage(practiceId, { medicineName: 'Enrofloxacin 10%', quantityUsed: 3, visitId: 'v1' }, userId),
      InventoryService.deductFieldUsage(practiceId, { medicineName: 'Enrofloxacin 10%', quantityUsed: 3, visitId: 'v2' }, userId),
      InventoryService.deductFieldUsage(practiceId, { medicineName: 'Enrofloxacin 10%', quantityUsed: 3, visitId: 'v3' }, userId),
      InventoryService.deductFieldUsage(practiceId, { medicineName: 'Enrofloxacin 10%', quantityUsed: 3, visitId: 'v4' }, userId),
      InventoryService.deductFieldUsage(practiceId, { medicineName: 'Enrofloxacin 10%', quantityUsed: 3, visitId: 'v5' }, userId),
    ]);

    for (const d of deductions) {
      assert.equal(d.success, true);
      assert.equal(d.deductedQuantity, 3);
    }

    // Remaining in Bag: 20 - 15 = 5
    const bagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(bagStock.summary.totalUnits, 5);
  });

  await t.test('13. Unit and batch validation rejects invalid inputs', async () => {
    // Quantity <= 0
    await assert.rejects(
      async () => {
        await InventoryService.stockIn(
          practiceId,
          {
            name: 'Bad Item',
            category: 'MEDICINE',
            batchNumber: 'B1',
            expiryDate: '2028-01-01',
            quantity: 0,
          },
          userId
        );
      },
      {
        name: 'AppError',
        statusCode: 400,
      }
    );

    // Missing batch number
    await assert.rejects(
      async () => {
        await InventoryService.stockIn(
          practiceId,
          {
            name: 'Bad Item',
            category: 'MEDICINE',
            batchNumber: '',
            expiryDate: '2028-01-01',
            quantity: 10,
          },
          userId
        );
      },
      {
        name: 'AppError',
        statusCode: 400,
      }
    );
  });
});
