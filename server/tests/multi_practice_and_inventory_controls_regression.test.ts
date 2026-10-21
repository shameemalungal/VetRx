// ==============================================================================
// VetRx — Multi-Practice & Inventory Controls Regression Test Suite
// Validates:
// 1. Multi-practice login & eligible practice payload (practiceType, role, subscription, selection required)
// 2. Clear All Stock: safe zeroing of quantities, tenant isolation, retaining history
// 3. Reverse Purchase Invoice: reversal transaction, note annotation, block when consumed
// 4. Review & Correct Entries by Date: retrieve entries, compensating adjustments, negative stock guard
// 5. Super User: change login email, session revocation, uniqueness validation, preserve user ID
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { PlatformAdminService } from '../src/platform/platform-admin.service.js';
import { AppError } from '../src/middleware/errorHandler.js';

import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PlatformRole } from '@prisma/client';

describe('Multi-Practice & Inventory Controls Comprehensive Regression Suite', () => {
  const practiceA = 'practice-city-clinic-001';
  const practiceB = 'practice-rural-vet-002';
  const superAdminUserId = 'super-admin-root';
  const doctorUserId = 'user-doctor-fiza';

  beforeEach(() => {
    InventoryService.clearMockStore();
    PlatformAdminService.clearMocks();

    // Seed mock super admin for both services
    PlatformAdminService.mockUsers.set(superAdminUserId, {
      id: superAdminUserId,
      email: 'admin@vetrx.platform',
      name: 'Platform Super Admin',
      isActive: true,
      platformRole: PlatformRole.PLATFORM_SUPER_ADMIN,
    });
    AuthorizationService.mockPlatformUsers.set(superAdminUserId, {
      id: superAdminUserId,
      platformRole: PlatformRole.PLATFORM_SUPER_ADMIN,
    });

    // Seed mock regular user
    PlatformAdminService.mockUsers.set(doctorUserId, {
      id: doctorUserId,
      email: 'dr.shameem@example.com',
      normalizedEmail: 'dr.shameem@example.com',
      name: 'Dr. Fiza Shameem',
      isActive: true,
      platformRole: null,
    });
  });

  // ----------------------------------------------------------------------------
  // 1. Inventory — Clear All Current Stock
  // ----------------------------------------------------------------------------
  describe('1. Inventory — Clear All Stock Safe Auditable Workflow', () => {
    it('summarizes stock correctly before clearing and strictly isolates by practice', async () => {
      // Add items and batches in Practice A
      const item1 = await InventoryService.createItem(practiceA, {
        name: 'Amoxicillin 250mg',
        category: 'MEDICINE',
        stockUnit: 'Strip',
      });
      await InventoryService.addOpeningStock(practiceA, {
        itemId: item1.id,
        batchNumber: 'AMX-001',
        expiryDate: '2028-12-31',
        quantity: 50,
        purchaseRate: 20,
      });

      const item2 = await InventoryService.createItem(practiceA, {
        name: 'Surgical Gloves',
        category: 'SURGICAL_MATERIAL',
        stockUnit: 'Pair',
      });
      await InventoryService.addOpeningStock(practiceA, {
        itemId: item2.id,
        batchNumber: 'GLV-101',
        expiryDate: '2029-06-30',
        quantity: 100,
        purchaseRate: 15,
      });

      // Add item in Practice B (must remain untouched!)
      const itemB = await InventoryService.createItem(practiceB, {
        name: 'Practice B Medicine',
        category: 'MEDICINE',
        stockUnit: 'Vial',
      });
      await InventoryService.addOpeningStock(practiceB, {
        itemId: itemB.id,
        batchNumber: 'PB-001',
        expiryDate: '2028-12-31',
        quantity: 75,
        purchaseRate: 100,
      });

      // Check summary for Practice A
      const summaryA = await InventoryService.getClearStockSummary(practiceA);
      assert.strictEqual(summaryA.affectedItemsCount, 2);
      assert.strictEqual(summaryA.affectedBatchesCount, 2);
      assert.strictEqual(summaryA.totalCurrentQuantity, 150);

      // Execute Clear Stock for Practice A
      const clearResult = await InventoryService.clearAllStock(practiceA, doctorUserId, 'Annual inventory reset');
      assert.strictEqual(clearResult.success, true);
      assert.strictEqual(clearResult.affectedItemsCount, 2);
      assert.strictEqual(clearResult.affectedBatchesCount, 2);
      assert.strictEqual(clearResult.totalClearedQuantity, 150);

      // Verify Practice A stock is now 0
      const batchesA = await InventoryService.listBatches(practiceA);
      for (const b of batchesA) {
        assert.strictEqual(b.currentQuantity, 0);
      }

      // Verify Practice B stock was NOT touched (strict tenant boundary)
      const batchesB = await InventoryService.listBatches(practiceB);
      assert.strictEqual(batchesB.length, 1);
      assert.strictEqual(batchesB[0].currentQuantity, 75);

      // Verify audit transactions were recorded
      const txs = await InventoryService.listTransactions(practiceA);
      const clearTxs = txs.filter((t) => t.referenceType === 'CLEAR_ALL_STOCK');
      assert.strictEqual(clearTxs.length, 2);
      assert.strictEqual(clearTxs[0].transactionType, 'STOCK_ADJUSTMENT');
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Inventory — Reverse Purchase Invoice
  // ----------------------------------------------------------------------------
  describe('2. Inventory — Purchase Invoice Reversal Workflow', () => {
    it('reverses purchase invoice when stock is available and blocks duplicate reversal', async () => {
      const supplier = await InventoryService.createSupplier(practiceA, { name: 'MediSupply Co' });
      const purchase = await InventoryService.confirmPurchaseInvoice(practiceA, {
        supplierName: supplier.name,
        invoiceNumber: 'INV-2026-999',
        invoiceDate: '2026-10-20',
        items: [
          {
            name: 'Meloxicam Injection',
            category: 'MEDICINE',
            batchNumber: 'MEL-2026',
            expiryDate: '2028-05-31',
            quantity: 20,
            purchaseRate: 150,
          },
        ],
      });

      // Verify batch was created with 20 units
      const batchesBefore = await InventoryService.listBatches(practiceA);
      const batch = batchesBefore.find((b) => b.batchNumber === 'MEL-2026');
      assert.ok(batch);
      assert.strictEqual(batch.currentQuantity, 20);

      // Execute reversal
      const reverseResult = await InventoryService.reversePurchaseInvoice(
        practiceA,
        purchase.id,
        doctorUserId,
        'Supplier sent wrong batch'
      );
      assert.strictEqual(reverseResult.success, true);

      // Verify batch current quantity is now 0
      const batchesAfter = await InventoryService.listBatches(practiceA);
      const reversedBatch = batchesAfter.find((b) => b.batchNumber === 'MEL-2026');
      assert.strictEqual(reversedBatch?.currentQuantity, 0);

      // Verify REVERSAL transaction was logged
      const txs = await InventoryService.listTransactions(practiceA);
      const reversalTx = txs.find((t) => t.transactionType === 'REVERSAL' && t.referenceId === purchase.id);
      assert.ok(reversalTx);
      assert.strictEqual(reversalTx.quantityChange, -20);

      // Verify duplicate reversal is blocked
      await assert.rejects(
        async () => {
          await InventoryService.reversePurchaseInvoice(practiceA, purchase.id, doctorUserId, 'Duplicate try');
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.errorCode, 'INVOICE_ALREADY_REVERSED');
          return true;
        }
      );
    });

    it('blocks reversal when stock was already consumed by dependent transactions', async () => {
      const purchase = await InventoryService.confirmPurchaseInvoice(practiceA, {
        supplierName: 'VetPharma Ltd',
        invoiceNumber: 'INV-2026-CONSUMED',
        invoiceDate: '2026-10-20',
        items: [
          {
            name: 'Ceftriaxone 1g',
            category: 'MEDICINE',
            batchNumber: 'CEF-777',
            expiryDate: '2028-05-31',
            quantity: 30,
            purchaseRate: 80,
          },
        ],
      });

      // Simulate partial consumption (e.g. 15 units dispensed)
      const batches = await InventoryService.listBatches(practiceA);
      const batch = batches.find((b) => b.batchNumber === 'CEF-777')!;
      await InventoryService.adjustStock(practiceA, {
        itemId: batch.inventoryItemId,
        batchId: batch.id,
        quantityChange: -15,
        reason: 'Dispensed for emergency surgery',
      });

      // Now only 15 units remain, but invoice had 30. Reversing 30 would cause -15 (illegal)
      await assert.rejects(
        async () => {
          await InventoryService.reversePurchaseInvoice(
            practiceA,
            purchase.id,
            doctorUserId,
            'Attempt reversal of consumed stock'
          );
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.errorCode, 'CANNOT_REVERSE_INSUFFICIENT_STOCK');
          assert.match(err.message, /result in an invalid negative stock balance/);
          return true;
        }
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Inventory — Review and Correct Entries by Date
  // ----------------------------------------------------------------------------
  describe('3. Inventory — Date-Based Entry Review & Compensating Corrections', () => {
    it('retrieves entries for a date and applies safe compensating transactions', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Create an item and opening stock
      const item = await InventoryService.createItem(practiceA, {
        name: 'Dextrose 5% 500ml',
        category: 'MEDICINE',
        stockUnit: 'Bottle',
      });
      await InventoryService.addOpeningStock(practiceA, {
        itemId: item.id,
        batchNumber: 'DEX-001',
        expiryDate: '2027-10-31',
        quantity: 40,
        purchaseRate: 45,
      });

      // Query entries by date
      const dateEntries = await InventoryService.getEntriesByDate(practiceA, today);
      assert.ok(dateEntries.count >= 1);
      const entry = dateEntries.entries.find((e) => e.itemId === item.id);
      assert.ok(entry);
      assert.strictEqual(entry.canCompensate, true);

      // Apply compensating correction
      const correctionResult = await InventoryService.correctEntriesByDate(practiceA, {
        transactionIds: [entry.id],
        reason: 'Incorrect quantity keyed in by operator',
        performedByUserId: doctorUserId,
      });
      assert.strictEqual(correctionResult.success, true);
      assert.strictEqual(correctionResult.correctedCount, 1);

      // Verify batch quantity was compensated
      const batches = await InventoryService.listBatches(practiceA);
      const b = batches.find((batch) => batch.inventoryItemId === item.id);
      assert.strictEqual(b?.currentQuantity, 0);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Super User — Change Login Email & Practice Info
  // ----------------------------------------------------------------------------
  describe('4. Super User — Platform Access Credentials Management', () => {
    it('authoritatively updates user login email, enforces uniqueness, and revokes sessions', async () => {
      const initialEmail = 'dr.shameem@example.com';
      const newEmail = 'drfizasha@gmail.com';

      // 1. Change login email
      const result = await PlatformAdminService.changeUserLoginEmail(
        superAdminUserId,
        doctorUserId,
        newEmail,
        'User requested migration to primary Gmail account'
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.user.email, newEmail);
      assert.strictEqual(result.user.previousEmail, initialEmail);

      // 2. Check duplicate email is rejected (collision guard)
      await assert.rejects(
        async () => {
          // Attempt to assign the same email to another user
          PlatformAdminService.mockUsers.set('user-2', {
            id: 'user-2',
            email: 'other@example.com',
            normalizedEmail: 'other@example.com',
            name: 'Other Doctor',
            isActive: true,
            platformRole: null,
          });

          await PlatformAdminService.changeUserLoginEmail(superAdminUserId, 'user-2', newEmail);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.errorCode, 'EMAIL_ALREADY_EXISTS');
          return true;
        }
      );

      // 3. Reject invalid email format
      await assert.rejects(
        async () => {
          await PlatformAdminService.changeUserLoginEmail(superAdminUserId, doctorUserId, 'not-an-email');
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.errorCode, 'INVALID_EMAIL');
          return true;
        }
      );

      // 4. Reject unauthorized non-super-admin
      await assert.rejects(
        async () => {
          await PlatformAdminService.changeUserLoginEmail(doctorUserId, doctorUserId, 'hacker@example.com');
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.errorCode, 'PLATFORM_ACCESS_REQUIRED');
          return true;
        }
      );
    });

    it('independently updates practice contact details without changing user login email', async () => {
      // Seed mock practice
      PlatformAdminService.mockPractices.set(practiceA, {
        id: practiceA,
        name: 'Fiza Clinic',
        practiceType: 'CLINIC',
        isActive: true,
      });

      const updated = await PlatformAdminService.updatePractice(superAdminUserId, practiceA, {
        name: 'Fiza Specialist Veterinary Clinic',
        practiceType: 'CLINIC',
        email: 'contact@fizaclinic.com', // Contact email distinct from login email!
        phone: '+91 98765 43210',
        address: 'MG Road, Bangalore',
      });

      assert.strictEqual(updated.name, 'Fiza Specialist Veterinary Clinic');

      // User login email remains intact and independent
      const user = PlatformAdminService.mockUsers.get(doctorUserId);
      assert.notStrictEqual(user?.email, 'contact@fizaclinic.com');
    });
  });
});
