// ==============================================================================
// VetRx — Inventory & Stock Management REST Controller
// Strictly isolated by practiceId and gated by inventory_management entitlement
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePractice } from '../middleware/tenant.js';
import { AppError } from '../middleware/errorHandler.js';
import { EntitlementService } from '../commercial/entitlement.service.js';
import { InventoryService } from './inventory.service.js';
import { UniversalInvoiceParserService } from './universal-invoice-parser.service.js';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const inventoryRouter = Router();

// 1. Strict Authentication & Tenant Context Middleware
inventoryRouter.use(requireAuth, requirePractice);

// Helper to derive tenant practice ID
function getPracticeId(req: AuthenticatedRequest): string {
  if (!req.practice?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Tenant practice context required.');
  }
  return req.practice.id;
}

// 2. Strict Authoritative Server-Side Entitlement Guard
// Access requires: (Base subscription active) AND (inventory_management add-on active)
async function requireInventoryEntitlement(req: AuthenticatedRequest, _res: any, next: any) {
  try {
    const practiceId = getPracticeId(req);
    await EntitlementService.assertCanAccessInventory(practiceId);
    next();
  } catch (err) {
    next(err);
  }
}

inventoryRouter.use(requireInventoryEntitlement);

// ------------------------------------------------------------------------------
// Dashboard & Analytics
// ------------------------------------------------------------------------------

inventoryRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const summary = await InventoryService.getDashboardSummary(practiceId);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Items (Master Catalog)
// ------------------------------------------------------------------------------

inventoryRouter.get('/items', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const { category, search, barcode, stockStatus, isActive } = req.query;

    const items = await InventoryService.listItems(practiceId, {
      category: category as string,
      search: search as string,
      barcode: barcode as string,
      stockStatus: stockStatus as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    res.status(200).json(items);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get('/items/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const item = await InventoryService.getItemById(req.params.id as string, practiceId);
    res.status(200).json(item);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post('/items', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      category: z.enum(['MEDICINE', 'CONSUMABLE', 'LAB_MATERIAL', 'SURGICAL_MATERIAL', 'OTHER']),
      name: z.string().min(1).max(150),
      genericName: z.string().max(150).nullable().optional(),
      strength: z.string().max(50).nullable().optional(),
      dosageForm: z.string().max(50).nullable().optional(),
      presentation: z.string().max(100).nullable().optional(),
      packSize: z.string().max(50).nullable().optional(),
      stockUnit: z.string().min(1).max(30),
      manufacturer: z.string().max(100).nullable().optional(),
      minimumStockLevel: z.number().int().min(0).optional(),
      targetStockLevel: z.number().int().min(0).optional(),
      barcode: z.string().max(50).nullable().optional(),
      medicineId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const newItem = await InventoryService.createItem(practiceId, data);
    res.status(201).json(newItem);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.patch('/items/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const updated = await InventoryService.updateItem(req.params.id as string, practiceId, req.body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Batches & Stock Levels
// ------------------------------------------------------------------------------

inventoryRouter.get('/batches', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const { itemId, onlyValid, onlyExpired } = req.query;

    const batches = await InventoryService.listBatches(practiceId, {
      itemId: itemId as string,
      onlyValid: onlyValid === 'true',
      onlyExpired: onlyExpired === 'true',
    });
    res.status(200).json(batches);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Opening Stock Entry
// ------------------------------------------------------------------------------

inventoryRouter.post('/opening-stock', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      itemId: z.string().min(1),
      batchNumber: z.string().min(1).max(50),
      manufacturingDate: z.string().nullable().optional(),
      expiryDate: z.string().min(4).max(30),
      quantity: z.number().positive(),
      purchaseRate: z.number().min(0),
      mrp: z.number().min(0).optional(),
      locationId: z.string().nullable().optional(),
    });

    const data = schema.parse(req.body);
    const result = await InventoryService.addOpeningStock(practiceId, {
      ...data,
      performedByUserId: req.user?.id || null,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Stock Transaction Ledger
// ------------------------------------------------------------------------------

inventoryRouter.get('/transactions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const { itemId, batchId, transactionType, startDate, endDate } = req.query;

    const transactions = await InventoryService.listTransactions(practiceId, {
      itemId: itemId as string,
      batchId: batchId as string,
      transactionType: transactionType as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.status(200).json(transactions);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Manual Adjustments & Stocktake
// ------------------------------------------------------------------------------

inventoryRouter.post('/adjust', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      itemId: z.string().min(1),
      batchId: z.string().nullable().optional(),
      quantityChange: z.number(),
      reason: z.string().min(1).max(200),
      notes: z.string().max(500).nullable().optional(),
    });

    const data = schema.parse(req.body);
    const result = await InventoryService.adjustStock(practiceId, {
      ...data,
      performedByUserId: req.user?.id || null,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post('/stocktake', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      items: z.array(
        z.object({
          itemId: z.string().min(1),
          batchId: z.string().optional(),
          physicalQuantity: z.number().min(0),
          reason: z.string().optional(),
        })
      ).min(1),
    });

    const data = schema.parse(req.body);
    const result = await InventoryService.performStocktake(
      practiceId,
      data.items,
      req.user?.id || null
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Suppliers
// ------------------------------------------------------------------------------

inventoryRouter.get('/suppliers', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const suppliers = await InventoryService.listSuppliers(practiceId, search);
    res.status(200).json(suppliers);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post('/suppliers', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      name: z.string().min(1).max(120),
      gstin: z.string().max(20).nullable().optional(),
      address: z.string().max(300).nullable().optional(),
      phone: z.string().max(30).nullable().optional(),
      email: z.string().email().nullable().optional().or(z.literal('')),
      notes: z.string().max(500).nullable().optional(),
    });

    const data = schema.parse(req.body);
    const supplier = await InventoryService.createSupplier(practiceId, {
      ...data,
      email: data.email === '' ? null : data.email,
    });
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Universal Purchase Invoice Importer (Extraction & Confirmation)
// ------------------------------------------------------------------------------

inventoryRouter.post('/purchases/extract', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      content: z.string().min(1), // raw text / extracted OCR string from PDF or image
    });
    const { content } = schema.parse(req.body);

    // Build catalogue for fuzzy matching
    let catalogue: Array<{ id: string; name: string; genericName?: string | null; type: 'medicine' | 'item' }> = [];

    // Include existing medicines in practice
    if (process.env.VETRX_FAST_TEST !== '1') {
      try {
        const meds = await prisma.medicine.findMany({
          where: { practiceId, isActive: true },
          select: { id: true, name: true, genericName: true },
        });
        catalogue.push(...meds.map((m) => ({ id: m.id, name: m.name, genericName: m.genericName, type: 'medicine' as const })));
      } catch {}
    }

    // Include existing inventory items
    const invItems = await InventoryService.listItems(practiceId);
    catalogue.push(...invItems.map((i) => ({ id: i.id, name: i.name, genericName: i.genericName, type: 'item' as const })));

    // Existing purchases for duplicate detection
    const existingPurchases = await InventoryService.listPurchases(practiceId);
    const existingKeys = existingPurchases.map((p) => ({
      supplierName: p.supplierName,
      invoiceNumber: p.invoiceNumber,
      id: p.id,
    }));

    const result = UniversalInvoiceParserService.parseInvoice(content, catalogue, existingKeys);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post('/purchases/confirm', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      supplierName: z.string().min(1),
      supplierGstin: z.string().nullable().optional(),
      invoiceNumber: z.string().min(1),
      invoiceDate: z.string().min(4),
      notes: z.string().nullable().optional(),
      items: z.array(
        z.object({
          tempId: z.string(),
          name: z.string().min(1),
          category: z.enum(['MEDICINE', 'CONSUMABLE', 'LAB_MATERIAL', 'SURGICAL_MATERIAL', 'OTHER']),
          genericName: z.string().optional(),
          dosageForm: z.string().optional(),
          packSize: z.string().optional(),
          stockUnit: z.string(),
          presentation: z.string(),
          batchNumber: z.string().min(1),
          manufacturingDate: z.string().nullable().optional(),
          expiryDate: z.string().min(4),
          quantity: z.number().positive(),
          purchaseRate: z.number().min(0),
          mrp: z.number().min(0),
          matchedMedicineId: z.string().nullable().optional(),
          matchedItemId: z.string().nullable().optional(),
          createNewMedicineMaster: z.boolean().optional(),
          flags: z.array(z.string()).optional(),
          matchConfidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
        })
      ).min(1),
    });

    const data = schema.parse(req.body);
    const purchaseInvoice = await InventoryService.confirmPurchaseInvoice(
      practiceId,
      data as any,
      req.user?.id || null
    );
    res.status(201).json(purchaseInvoice);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get('/purchases', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const purchases = await InventoryService.listPurchases(practiceId, search);
    res.status(200).json(purchases);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Alerts (Expiring Soon, Expired, Low Stock, Out of Stock)
// ------------------------------------------------------------------------------

inventoryRouter.get('/alerts', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const warningDays = req.query.warningDays ? parseInt(req.query.warningDays as string, 10) : 90;
    const criticalDays = req.query.criticalDays ? parseInt(req.query.criticalDays as string, 10) : 30;

    const alerts = await InventoryService.getAlerts(practiceId, warningDays, criticalDays);
    res.status(200).json(alerts);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Prescription Stock Resolution (Internal vs External Quantity)
// ------------------------------------------------------------------------------

inventoryRouter.post('/prescriptions/resolve-stock', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      items: z.array(
        z.object({
          medicineId: z.string().nullable().optional(),
          brandName: z.string().min(1),
          totalQuantity: z.number().min(0),
        })
      ),
    });

    const { items } = schema.parse(req.body);
    const resolution = await InventoryService.resolvePrescriptionStock(practiceId, items);
    res.status(200).json(resolution);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Invoice Stock Deduction & Cancellation Reversal
// ------------------------------------------------------------------------------

inventoryRouter.post('/invoices/deduct', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      invoiceId: z.string().min(1),
      invoiceNumber: z.string().min(1),
      items: z.array(
        z.object({
          medicineId: z.string().nullable().optional(),
          description: z.string().min(1),
          quantity: z.number().positive(),
        })
      ),
    });

    const data = schema.parse(req.body);
    const result = await InventoryService.deductInvoiceStock(
      practiceId,
      data.invoiceId,
      data.invoiceNumber,
      data.items,
      req.user?.id || null
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

inventoryRouter.post('/invoices/reverse', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      invoiceId: z.string().min(1),
      invoiceNumber: z.string().min(1),
    });

    const data = schema.parse(req.body);
    const result = await InventoryService.reverseInvoiceStock(
      practiceId,
      data.invoiceId,
      data.invoiceNumber,
      req.user?.id || null
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
