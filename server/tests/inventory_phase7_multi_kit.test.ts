process.env.VETRX_FAST_TEST = '1';

import test from 'node:test';
import assert from 'node:assert/strict';
import { InventoryService } from '../src/inventory/inventory.service.js';

test('VetRx Phase 7: Multiple Field Kits, Mobile Vans & Vehicle Stock Suite', async (t) => {
  const practiceId = 'test_practice_phase7_p1';
  const userId = 'vet_shameem_dr';

  t.beforeEach(() => {
    InventoryService.clearMockStore();
  });

  await t.test('1. Preserves default Practice Bag and allows creating additional named Field Kits & Vans', async () => {
    // Initial defaults
    const defaults = await InventoryService.ensureDefaultLocations(practiceId);
    assert.equal(defaults.bagLocation.name, 'Practice Bag');

    // Create Vehicle 1 (Mobile Clinic Van)
    const van1 = await InventoryService.createLocation(
      practiceId,
      {
        name: 'Mobile Clinic Van 1',
        description: 'Large animal ambulatory service van',
        type: 'VEHICLE',
        vehicleNumber: 'KA-04-E-2026',
        assignedUserId: 'vet_user_1',
        assignedUserName: 'Dr. Ramesh Patil',
      },
      userId
    );

    assert.ok(van1.id);
    assert.equal(van1.name, 'Mobile Clinic Van 1');
    assert.equal(van1.type, 'VEHICLE');
    assert.equal(van1.vehicleNumber, 'KA-04-E-2026');
    assert.equal(van1.assignedUserName, 'Dr. Ramesh Patil');

    // Create Emergency Doctor Bag
    const bag2 = await InventoryService.createLocation(
      practiceId,
      {
        name: 'Emergency Field Bag (Dr. Shameem)',
        description: 'Night shift calving & emergency kit',
        type: 'FIELD_KIT',
        assignedUserId: userId,
        assignedUserName: 'Dr. Shameem',
      },
      userId
    );

    assert.ok(bag2.id);
    assert.equal(bag2.name, 'Emergency Field Bag (Dr. Shameem)');
    assert.equal(bag2.type, 'FIELD_KIT');

    // List all locations
    const allLocations = await InventoryService.listLocations(practiceId);
    assert.equal(allLocations.length, 4); // Store Stock, Practice Bag, Van 1, Emergency Bag
  });

  await t.test('2. Prevents duplicate location names in the same practice', async () => {
    await InventoryService.createLocation(
      practiceId,
      { name: 'Mobile Van 1', type: 'VEHICLE' },
      userId
    );

    await assert.rejects(
      async () => {
        await InventoryService.createLocation(
          practiceId,
          { name: 'Mobile Van 1', type: 'VEHICLE' },
          userId
        );
      },
      {
        message: /already exists/i,
      }
    );
  });

  await t.test('3. Transfers stock from Store Stock into a specific Field Kit / Van', async () => {
    // 1. Stock In medicine into Store Stock
    const stockInRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Meloxicam 5mg/ml',
        category: 'MEDICINE',
        presentation: '100ml vial',
        stockUnit: 'Vial',
        batchNumber: 'MEL-2026-V1',
        expiryDate: '2027-12-31',
        quantity: 50,
        purchaseRate: 150,
        mrp: 220,
      },
      userId
    );

    // 2. Create custom vehicle location
    const van = await InventoryService.createLocation(
      practiceId,
      { name: 'Ambulatory Van A', type: 'VEHICLE', vehicleNumber: 'KA-01-V-1234' },
      userId
    );

    // 3. Transfer 10 vials from Store Stock into Ambulatory Van A
    const transferRes = await InventoryService.transferStock(
      practiceId,
      {
        itemId: stockInRes.item.id,
        batchNumber: 'MEL-2026-V1',
        quantity: 10,
        targetLocationId: van.id,
        notes: 'Pre-shift van loading for morning farm rounds',
      },
      userId
    );

    assert.equal(transferRes.success, true);
    assert.equal(transferRes.quantity, 10);
    assert.equal(transferRes.destinationBatch.currentQuantity, 10);
    assert.equal(transferRes.sourceBatch.currentQuantity, 40);

    // 4. Verify stock query for that specific van
    const vanStock = await InventoryService.getPracticeBagStock(practiceId, {}, van.id);
    assert.equal(vanStock.bagLocation.name, 'Ambulatory Van A');
    assert.equal(vanStock.items.length, 1);
    assert.equal(vanStock.items[0].currentStock, 10);

    // 5. Default Practice Bag should still have 0 units
    const defaultBagStock = await InventoryService.getPracticeBagStock(practiceId);
    assert.equal(defaultBagStock.bagLocation.name, 'Practice Bag');
    assert.equal(defaultBagStock.items.length, 0);
  });

  await t.test('4. Transfers stock between field kits (Kit to Kit)', async () => {
    // Stock in 30 vials
    const stockInRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Ceftiofur Sodium 1g',
        category: 'MEDICINE',
        presentation: 'Vial',
        stockUnit: 'Vial',
        batchNumber: 'CEF-2026-B1',
        expiryDate: '2028-01-01',
        quantity: 30,
        purchaseRate: 350,
        mrp: 450,
      },
      userId
    );

    // Create Kit 1 and Kit 2
    const kit1 = await InventoryService.createLocation(practiceId, { name: 'Kit 1 - Day Shift' }, userId);
    const kit2 = await InventoryService.createLocation(practiceId, { name: 'Kit 2 - Night Shift' }, userId);

    // Load 15 into Kit 1
    await InventoryService.transferStock(
      practiceId,
      {
        itemId: stockInRes.item.id,
        batchNumber: 'CEF-2026-B1',
        quantity: 15,
        targetLocationId: kit1.id,
      },
      userId
    );

    // Transfer 5 vials from Kit 1 directly into Kit 2
    const kitToKitRes = await InventoryService.transferStock(
      practiceId,
      {
        itemId: stockInRes.item.id,
        batchNumber: 'CEF-2026-B1',
        quantity: 5,
        sourceLocationId: kit1.id,
        targetLocationId: kit2.id,
        notes: 'Handover from day shift to night emergency kit',
      },
      userId
    );

    assert.equal(kitToKitRes.success, true);
    assert.equal(kitToKitRes.quantity, 5);
    assert.equal(kitToKitRes.sourceBatch.currentQuantity, 10);
    assert.equal(kitToKitRes.destinationBatch.currentQuantity, 5);

    // Verify Kit 1 stock
    const kit1Stock = await InventoryService.getPracticeBagStock(practiceId, {}, kit1.id);
    assert.equal(kit1Stock.items[0].currentStock, 10);

    // Verify Kit 2 stock
    const kit2Stock = await InventoryService.getPracticeBagStock(practiceId, {}, kit2.id);
    assert.equal(kit2Stock.items[0].currentStock, 5);
  });

  await t.test('5. Returns unused stock from a specific Field Kit back to Store Stock', async () => {
    const stockInRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Enrofloxacin 100mg/ml',
        category: 'MEDICINE',
        presentation: '100ml vial',
        stockUnit: 'Vial',
        batchNumber: 'ENRO-2026-X1',
        expiryDate: '2027-10-31',
        quantity: 20,
        purchaseRate: 180,
        mrp: 260,
      },
      userId
    );

    const van = await InventoryService.createLocation(
      practiceId,
      { name: 'Vaccination Van', type: 'VEHICLE' },
      userId
    );

    // Transfer 10 into van
    await InventoryService.transferStock(
      practiceId,
      {
        itemId: stockInRes.item.id,
        batchNumber: 'ENRO-2026-X1',
        quantity: 10,
        targetLocationId: van.id,
      },
      userId
    );

    // Return 6 back from van to store
    const returnRes = await InventoryService.returnUnusedStock(
      practiceId,
      {
        itemId: stockInRes.item.id,
        batchNumber: 'ENRO-2026-X1',
        quantity: 6,
        fromLocationId: van.id,
        reason: 'Post-campaign return to central pharmacy',
      },
      userId
    );

    assert.equal(returnRes.success, true);
    assert.equal(returnRes.quantity, 6);
    assert.equal(returnRes.sourceBatch.currentQuantity, 4); // Remaining in van
    assert.equal(returnRes.destinationBatch.currentQuantity, 16); // 10 initial remaining + 6 returned

    const vanStock = await InventoryService.getPracticeBagStock(practiceId, {}, van.id);
    assert.equal(vanStock.items[0].currentStock, 4);
  });

  await t.test('6. Deducts medicine usage from the designated Field Kit with idempotency', async () => {
    const stockInRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Ivermectin 1%',
        category: 'MEDICINE',
        presentation: '50ml vial',
        stockUnit: 'Vial',
        batchNumber: 'IVM-2026-D1',
        expiryDate: '2028-06-30',
        quantity: 15,
        purchaseRate: 90,
        mrp: 140,
      },
      userId
    );

    const kit = await InventoryService.createLocation(
      practiceId,
      { name: 'Dairy Route Bag #1', type: 'FIELD_KIT' },
      userId
    );

    // Transfer 10 into kit
    await InventoryService.transferStock(
      practiceId,
      {
        itemId: stockInRes.item.id,
        batchNumber: 'IVM-2026-D1',
        quantity: 10,
        targetLocationId: kit.id,
      },
      userId
    );

    const idempotencyKey = 'field_use_visit_9901_01';

    // Deduct 2 vials from Dairy Route Bag #1
    const deductRes = await InventoryService.deductFieldUsage(
      practiceId,
      {
        medicineName: 'Ivermectin 1%',
        batchNumber: 'IVM-2026-D1',
        quantity: 2,
        visitId: 'visit_9901',
        patientName: 'Buffalo #4',
        locationId: kit.id,
        idempotencyKey,
      },
      userId
    );

    assert.equal(deductRes.success, true);
    assert.equal(deductRes.deductedQuantity, 2);
    assert.equal(deductRes.remainingBagStock, 8);

    // Retry deduction with same idempotency key (must NOT deduct twice)
    const retryRes = await InventoryService.deductFieldUsage(
      practiceId,
      {
        medicineName: 'Ivermectin 1%',
        batchNumber: 'IVM-2026-D1',
        quantity: 2,
        visitId: 'visit_9901',
        patientName: 'Buffalo #4',
        locationId: kit.id,
        idempotencyKey,
      },
      userId
    );

    assert.equal(retryRes.success, true);
    assert.equal(retryRes.remainingBagStock, 8, 'Idempotency must prevent double deduction');

    const kitStock = await InventoryService.getPracticeBagStock(practiceId, {}, kit.id);
    assert.equal(kitStock.items[0].currentStock, 8);
  });

  await t.test('7. Prevents negative stock when transferring more than available in kit', async () => {
    const stockInRes = await InventoryService.stockIn(
      practiceId,
      {
        name: 'Atropine Sulphate',
        category: 'MEDICINE',
        presentation: '10ml vial',
        stockUnit: 'Vial',
        batchNumber: 'ATR-2026',
        expiryDate: '2027-05-31',
        quantity: 5,
        purchaseRate: 20,
        mrp: 35,
      },
      userId
    );

    const kit = await InventoryService.createLocation(practiceId, { name: 'Emergency Kit' }, userId);

    // Transfer all 5 into kit
    await InventoryService.transferStock(
      practiceId,
      {
        itemId: stockInRes.item.id,
        batchNumber: 'ATR-2026',
        quantity: 5,
        targetLocationId: kit.id,
      },
      userId
    );

    // Attempting to return 10 (exceeds balance of 5)
    await assert.rejects(
      async () => {
        await InventoryService.returnUnusedStock(
          practiceId,
          {
            itemId: stockInRes.item.id,
            batchNumber: 'ATR-2026',
            quantity: 10,
            fromLocationId: kit.id,
          },
          userId
        );
      },
      {
        message: /insufficient stock/i,
      }
    );
  });

  await t.test('8. Strict Multi-Tenant Practice Isolation for custom kits', async () => {
    const practiceA = 'practice_tenant_alpha';
    const practiceB = 'practice_tenant_beta';

    const vanA = await InventoryService.createLocation(
      practiceA,
      { name: 'Alpha Mobile Van', type: 'VEHICLE' },
      userId
    );

    const locationsB = await InventoryService.listLocations(practiceB);
    const hasVanAInB = locationsB.some((l) => l.name === 'Alpha Mobile Van' || l.id === vanA.id);
    assert.equal(hasVanAInB, false, 'Practice B must never see Practice A locations');

    // Attempting to access Van A under Practice B context
    await assert.rejects(
      async () => {
        await InventoryService.getPracticeBagStock(practiceB, {}, vanA.id);
      },
      {
        message: /not found/i,
      }
    );
  });
});
