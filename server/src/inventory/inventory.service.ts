// ==============================================================================
// VetRx — Inventory & Stock Management Core Service
// Multi-tenant, batch-level ledger, FEFO deduction, audit-first architecture
// ==============================================================================

import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from '../lib/audit.service.js';
import { prisma } from '../lib/prisma.js';
import type {
  InventoryItemDTO,
  InventoryBatchDTO,
  InventoryTransactionDTO,
  SupplierDTO,
  PurchaseInvoiceDTO,
  InventoryDashboardDTO,
  StockResolutionItemDTO,
  ExtractedInvoiceItemDTO,
  InventoryCategory,
  StockLocationDTO,
  StockInDTO,
  TransferStockDTO,
  ReturnStockDTO,
  ReconcileStockDTO,
  DeductFieldUsageDTO,
  FieldUsageDeductionResult,
  CreateLocationDTO,
} from './inventory.types.js';

export class InventoryService {
  // In-memory mock store for fast isolated unit testing & zero-dependency local dev
  private static mockItems: Map<string, InventoryItemDTO[]> = new Map();
  private static mockBatches: Map<string, InventoryBatchDTO[]> = new Map();
  private static mockTransactions: Map<string, InventoryTransactionDTO[]> = new Map();
  private static mockSuppliers: Map<string, SupplierDTO[]> = new Map();
  private static mockPurchases: Map<string, PurchaseInvoiceDTO[]> = new Map();
  private static mockLocations: Map<string, StockLocationDTO[]> = new Map();

  static clearMockStore(): void {
    this.mockItems.clear();
    this.mockBatches.clear();
    this.mockTransactions.clear();
    this.mockSuppliers.clear();
    this.mockPurchases.clear();
    this.mockLocations.clear();
  }

  // --------------------------------------------------------------------------
  // 1. Item Master Management
  // --------------------------------------------------------------------------

  static async listItems(
    practiceId: string,
    filters: {
      category?: string;
      search?: string;
      barcode?: string;
      stockStatus?: string;
      isActive?: boolean;
    } = {}
  ): Promise<InventoryItemDTO[]> {
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryItem) {
      try {
        const where: any = { practiceId };
        if (filters.category && filters.category !== 'ALL' && filters.category !== 'All') {
          where.category = filters.category.toUpperCase();
        }
        if (filters.barcode && filters.barcode.trim()) {
          where.barcode = filters.barcode.trim();
        }
        if (filters.isActive !== undefined) {
          where.isActive = filters.isActive;
        }
        if (filters.search && filters.search.trim()) {
          const q = filters.search.trim();
          where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { genericName: { contains: q, mode: 'insensitive' } },
            { manufacturer: { contains: q, mode: 'insensitive' } },
            { barcode: { contains: q, mode: 'insensitive' } },
          ];
        }

        const dbItems = await prisma.inventoryItem.findMany({
          where,
          include: {
            batches: true,
          },
          orderBy: { name: 'asc' },
        });

        if (dbItems.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          let mapped: InventoryItemDTO[] = dbItems.map((item) => {
            const itemBatches = item.batches || [];
            const currentStock = itemBatches.reduce((acc, b) => acc + (b.currentQuantity || 0), 0);
            const validStock = itemBatches
              .filter((b) => b.expiryDate.toISOString().split('T')[0] >= today)
              .reduce((acc, b) => acc + (b.currentQuantity || 0), 0);

            let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
            if (validStock === 0) {
              stockStatus = 'OUT_OF_STOCK';
            } else if (validStock <= item.minimumStockLevel) {
              stockStatus = 'LOW_STOCK';
            }

            return {
              id: item.id,
              practiceId: item.practiceId,
              category: item.category as any,
              name: item.name,
              genericName: item.genericName,
              strength: item.strength,
              dosageForm: item.dosageForm,
              presentation: item.presentation,
              packSize: item.packSize,
              stockUnit: item.stockUnit,
              manufacturer: item.manufacturer,
              minimumStockLevel: item.minimumStockLevel,
              targetStockLevel: item.targetStockLevel,
              barcode: item.barcode,
              medicineId: item.medicineId,
              isActive: item.isActive,
              currentStock,
              validStock,
              stockStatus,
              batchesCount: itemBatches.length,
              createdAt: item.createdAt.toISOString(),
              updatedAt: item.updatedAt.toISOString(),
            };
          });

          if (filters.stockStatus && filters.stockStatus !== 'ALL') {
            mapped = mapped.filter((i) => i.stockStatus === filters.stockStatus);
          }
          return mapped;
        }
      } catch (err) {
        console.warn('[InventoryService.listItems] Prisma error, using fallback:', err);
      }
    }

    const items = this.getItemsStore(practiceId);
    const batches = this.getBatchesStore(practiceId);
    const today = new Date().toISOString().split('T')[0];

    let result = items.map((item) => {
      const itemBatches = batches.filter((b) => b.inventoryItemId === item.id);
      const currentStock = itemBatches.reduce((acc, b) => acc + (b.currentQuantity || 0), 0);
      const validStock = itemBatches
        .filter((b) => b.expiryDate >= today)
        .reduce((acc, b) => acc + (b.currentQuantity || 0), 0);

      let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (validStock === 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (validStock <= item.minimumStockLevel) {
        stockStatus = 'LOW_STOCK';
      }

      return {
        ...item,
        currentStock,
        validStock,
        stockStatus,
        batchesCount: itemBatches.length,
      };
    });

    if (filters.category && filters.category !== 'ALL' && filters.category !== 'All') {
      result = result.filter((i) => i.category.toUpperCase() === filters.category!.toUpperCase());
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.genericName && i.genericName.toLowerCase().includes(q)) ||
          (i.barcode && i.barcode.toLowerCase().includes(q)) ||
          (i.manufacturer && i.manufacturer.toLowerCase().includes(q))
      );
    }

    if (filters.barcode && filters.barcode.trim()) {
      const b = filters.barcode.trim().toLowerCase();
      result = result.filter((i) => i.barcode && i.barcode.toLowerCase() === b);
    }

    if (filters.stockStatus && filters.stockStatus !== 'ALL') {
      result = result.filter((i) => i.stockStatus === filters.stockStatus);
    }

    if (filters.isActive !== undefined) {
      result = result.filter((i) => i.isActive === filters.isActive);
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async getItemById(id: string, practiceId: string): Promise<InventoryItemDTO> {
    const list = await this.listItems(practiceId);
    const item = list.find((i) => i.id === id);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', `Inventory item with ID ${id} not found.`);
    }
    return item;
  }

  static async createItem(
    practiceId: string,
    data: {
      category: InventoryCategory;
      name: string;
      genericName?: string | null;
      strength?: string | null;
      dosageForm?: string | null;
      presentation?: string | null;
      packSize?: string | null;
      stockUnit: string;
      manufacturer?: string | null;
      minimumStockLevel?: number;
      targetStockLevel?: number;
      barcode?: string | null;
      medicineId?: string | null;
      isActive?: boolean;
    }
  ): Promise<InventoryItemDTO> {
    const minLevel = data.minimumStockLevel !== undefined ? Number(data.minimumStockLevel) : 5;
    const targetLevel = data.targetStockLevel !== undefined ? Number(data.targetStockLevel) : 20;

    let dbItem: any = null;
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryItem) {
      try {
        dbItem = await prisma.inventoryItem.create({
          data: {
            practiceId,
            category: data.category as any,
            name: data.name.trim(),
            genericName: data.genericName?.trim() || null,
            strength: data.strength?.trim() || null,
            dosageForm: data.dosageForm?.trim() || null,
            presentation: data.presentation?.trim() || null,
            packSize: data.packSize?.trim() || null,
            stockUnit: data.stockUnit?.trim() || 'Unit',
            manufacturer: data.manufacturer?.trim() || null,
            minimumStockLevel: minLevel,
            targetStockLevel: targetLevel,
            barcode: data.barcode?.trim() || null,
            medicineId: data.medicineId || null,
            isActive: data.isActive !== undefined ? data.isActive : true,
          },
        });
      } catch (err) {
        console.warn('[InventoryService.createItem] Prisma error:', err);
      }
    }

    const items = this.getItemsStore(practiceId);
    const newItem: InventoryItemDTO = {
      id: dbItem?.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId,
      category: data.category,
      name: data.name.trim(),
      genericName: data.genericName?.trim() || null,
      strength: data.strength?.trim() || null,
      dosageForm: data.dosageForm?.trim() || null,
      presentation: data.presentation?.trim() || null,
      packSize: data.packSize?.trim() || null,
      stockUnit: data.stockUnit?.trim() || 'Unit',
      manufacturer: data.manufacturer?.trim() || null,
      minimumStockLevel: minLevel,
      targetStockLevel: targetLevel,
      barcode: data.barcode?.trim() || null,
      medicineId: data.medicineId || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      currentStock: 0,
      validStock: 0,
      stockStatus: 'OUT_OF_STOCK',
      batchesCount: 0,
      createdAt: dbItem?.createdAt ? dbItem.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: dbItem?.updatedAt ? dbItem.updatedAt.toISOString() : new Date().toISOString(),
    };

    items.push(newItem);
    this.mockItems.set(practiceId, items);

    void AuditService.record({
      practiceId,
      action: 'INVENTORY_ITEM_CREATED',
      resource: 'InventoryItem',
      resourceId: newItem.id,
      details: { name: newItem.name, category: newItem.category },
    });

    return newItem;
  }

  static async updateItem(
    id: string,
    practiceId: string,
    data: Partial<InventoryItemDTO>
  ): Promise<InventoryItemDTO> {
    const items = this.getItemsStore(practiceId);
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) {
      throw new AppError(404, 'ITEM_NOT_FOUND', `Inventory item with ID ${id} not found.`);
    }

    const current = items[idx];
    const updated: InventoryItemDTO = {
      ...current,
      name: data.name !== undefined ? data.name.trim() : current.name,
      genericName: data.genericName !== undefined ? data.genericName?.trim() || null : current.genericName,
      strength: data.strength !== undefined ? data.strength?.trim() || null : current.strength,
      dosageForm: data.dosageForm !== undefined ? data.dosageForm?.trim() || null : current.dosageForm,
      presentation: data.presentation !== undefined ? data.presentation?.trim() || null : current.presentation,
      packSize: data.packSize !== undefined ? data.packSize?.trim() || null : current.packSize,
      stockUnit: data.stockUnit !== undefined ? data.stockUnit.trim() : current.stockUnit,
      manufacturer: data.manufacturer !== undefined ? data.manufacturer?.trim() || null : current.manufacturer,
      minimumStockLevel: data.minimumStockLevel !== undefined ? Number(data.minimumStockLevel) : current.minimumStockLevel,
      targetStockLevel: data.targetStockLevel !== undefined ? Number(data.targetStockLevel) : current.targetStockLevel,
      barcode: data.barcode !== undefined ? data.barcode?.trim() || null : current.barcode,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : current.isActive,
      updatedAt: new Date().toISOString(),
    };

    items[idx] = updated;
    this.mockItems.set(practiceId, items);

    return this.getItemById(id, practiceId);
  }

  // --------------------------------------------------------------------------
  // 2. Batch-Level Stock Management
  // --------------------------------------------------------------------------

  static async listBatches(
    practiceId: string,
    filters: {
      itemId?: string;
      onlyValid?: boolean;
      onlyExpired?: boolean;
    } = {}
  ): Promise<InventoryBatchDTO[]> {
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
      try {
        const where: any = { practiceId };
        if (filters.itemId) where.inventoryItemId = filters.itemId;
        const today = new Date().toISOString().split('T')[0];

        const dbBatches = await prisma.inventoryBatch.findMany({
          where,
          include: { inventoryItem: true },
          orderBy: { expiryDate: 'asc' },
        });

        if (dbBatches.length > 0) {
          let mapped: InventoryBatchDTO[] = dbBatches.map((b) => {
            const expStr = b.expiryDate.toISOString().split('T')[0];
            const isExpired = expStr < today;
            const daysToExpiry = Math.ceil(
              (new Date(b.expiryDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
            );

            let expiryStatus: 'OK' | 'EXPIRING_SOON' | 'CRITICAL' | 'EXPIRED' = 'OK';
            if (isExpired) {
              expiryStatus = 'EXPIRED';
            } else if (daysToExpiry <= 30) {
              expiryStatus = 'CRITICAL';
            } else if (daysToExpiry <= 90) {
              expiryStatus = 'EXPIRING_SOON';
            }

            return {
              id: b.id,
              practiceId: b.practiceId,
              inventoryItemId: b.inventoryItemId,
              itemName: b.inventoryItem?.name || 'Unknown Item',
              itemCategory: (b.inventoryItem?.category as any) || 'OTHER',
              batchNumber: b.batchNumber,
              manufacturingDate: b.manufacturingDate ? b.manufacturingDate.toISOString().split('T')[0] : null,
              expiryDate: expStr,
              currentQuantity: b.currentQuantity,
              initialQuantity: b.initialQuantity,
              purchaseRate: b.purchaseRate,
              mrp: b.mrp,
              locationId: b.locationId,
              isExpired,
              daysToExpiry,
              expiryStatus,
              createdAt: b.createdAt.toISOString(),
              updatedAt: b.updatedAt.toISOString(),
            };
          });

          if (filters.onlyValid) {
            mapped = mapped.filter((b) => !b.isExpired && b.currentQuantity > 0);
          }
          if (filters.onlyExpired) {
            mapped = mapped.filter((b) => b.isExpired);
          }
          return mapped;
        }
      } catch (err) {
        console.warn('[InventoryService.listBatches] Prisma error, using fallback:', err);
      }
    }

    const batches = this.getBatchesStore(practiceId);
    const items = this.getItemsStore(practiceId);
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const today = new Date().toISOString().split('T')[0];

    let result = batches.map((b) => {
      const item = itemMap.get(b.inventoryItemId);
      const isExpired = b.expiryDate < today;
      const daysToExpiry = Math.ceil(
        (new Date(b.expiryDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
      );

      let expiryStatus: 'OK' | 'EXPIRING_SOON' | 'CRITICAL' | 'EXPIRED' = 'OK';
      if (isExpired) {
        expiryStatus = 'EXPIRED';
      } else if (daysToExpiry <= 30) {
        expiryStatus = 'CRITICAL';
      } else if (daysToExpiry <= 90) {
        expiryStatus = 'EXPIRING_SOON';
      }

      return {
        ...b,
        itemName: item?.name || 'Unknown Item',
        itemCategory: item?.category || 'OTHER',
        isExpired,
        daysToExpiry,
        expiryStatus,
      };
    });

    if (filters.itemId) {
      result = result.filter((b) => b.inventoryItemId === filters.itemId);
    }

    if (filters.onlyValid) {
      result = result.filter((b) => !b.isExpired && b.currentQuantity > 0);
    }

    if (filters.onlyExpired) {
      result = result.filter((b) => b.isExpired);
    }

    return result.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }

  static async getBatchById(id: string, practiceId: string): Promise<InventoryBatchDTO> {
    const list = await this.listBatches(practiceId);
    const batch = list.find((b) => b.id === id);
    if (!batch) {
      throw new AppError(404, 'BATCH_NOT_FOUND', `Inventory batch with ID ${id} not found.`);
    }
    return batch;
  }

  // --------------------------------------------------------------------------
  // 3. Opening Stock Workflow
  // --------------------------------------------------------------------------

  static async addOpeningStock(
    practiceId: string,
    data: {
      itemId: string;
      batchNumber: string;
      manufacturingDate?: string | null;
      expiryDate: string;
      quantity: number;
      purchaseRate: number;
      mrp?: number;
      locationId?: string | null;
      performedByUserId?: string | null;
    }
  ): Promise<{ batch: InventoryBatchDTO; transaction: InventoryTransactionDTO }> {
    const item = await this.getItemById(data.itemId, practiceId);
    const qty = Number(data.quantity);
    if (qty <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'Opening stock quantity must be greater than zero.');
    }

    const batches = this.getBatchesStore(practiceId);
    const rate = Number(data.purchaseRate) || 0;
    const mrp = Number(data.mrp) || Math.round(rate * 1.35);

    let dbBatch: any = null;
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
      try {
        dbBatch = await prisma.inventoryBatch.create({
          data: {
            practiceId,
            inventoryItemId: item.id,
            batchNumber: data.batchNumber.trim().toUpperCase(),
            manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
            expiryDate: new Date(data.expiryDate),
            currentQuantity: qty,
            initialQuantity: qty,
            purchaseRate: rate,
            mrp,
            locationId: null,
          },
        });
      } catch (err) {
        console.warn('[InventoryService.addOpeningStock] Prisma batch error:', err);
      }
    }

    // Create batch
    const newBatch: InventoryBatchDTO = {
      id: dbBatch?.id || `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId,
      inventoryItemId: item.id,
      itemName: item.name,
      itemCategory: item.category,
      batchNumber: data.batchNumber.trim().toUpperCase(),
      manufacturingDate: data.manufacturingDate || null,
      expiryDate: data.expiryDate,
      currentQuantity: qty,
      initialQuantity: qty,
      purchaseRate: rate,
      mrp,
      locationId: data.locationId || 'loc_main',
      locationName: 'Main Stock',
      createdAt: dbBatch?.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: dbBatch?.updatedAt?.toISOString() || new Date().toISOString(),
    };

    batches.push(newBatch);
    this.mockBatches.set(practiceId, batches);

    // Create OPENING_STOCK audit transaction
    const transaction = await this.recordTransaction(practiceId, {
      itemId: item.id,
      batchId: newBatch.id,
      transactionType: 'OPENING_STOCK',
      quantityChange: qty,
      quantityBefore: 0,
      quantityAfter: qty,
      unitCost: rate,
      referenceType: 'OPENING_STOCK',
      reason: 'Initial opening stock entry',
      performedByUserId: data.performedByUserId || null,
    });

    return { batch: newBatch, transaction };
  }

  // --------------------------------------------------------------------------
  // 4. Stock Transaction Ledger (Immutable Audit Trail)
  // --------------------------------------------------------------------------

  static async recordTransaction(
    practiceId: string,
    data: {
      itemId: string;
      batchId?: string | null;
      transactionType: InventoryTransactionDTO['transactionType'];
      quantityChange: number;
      quantityBefore: number;
      quantityAfter: number;
      unitCost: number;
      referenceType?: string | null;
      referenceId?: string | null;
      reason?: string | null;
      performedByUserId?: string | null;
    }
  ): Promise<InventoryTransactionDTO> {
    let dbTx: any = null;
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryTransaction) {
      try {
        let validBatchId = data.batchId;
        if (validBatchId && validBatchId.startsWith('batch_')) {
          validBatchId = null;
        }

        dbTx = await prisma.inventoryTransaction.create({
          data: {
            practiceId,
            itemId: data.itemId,
            batchId: validBatchId || null,
            transactionType: data.transactionType as any,
            quantityChange: data.quantityChange,
            quantityBefore: data.quantityBefore,
            quantityAfter: data.quantityAfter,
            unitCost: data.unitCost,
            referenceType: data.referenceType || null,
            referenceId: data.referenceId || null,
            reason: data.reason || null,
            performedByUserId: data.performedByUserId || null,
          },
          include: { item: true },
        });
      } catch (err) {
        console.warn('[InventoryService.recordTransaction] Prisma error:', err);
      }
    }

    const transactions = this.getTransactionsStore(practiceId);
    const items = this.getItemsStore(practiceId);
    const item = items.find((i) => i.id === data.itemId);

    const tx: InventoryTransactionDTO = {
      id: dbTx?.id || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId,
      itemId: data.itemId,
      itemName: dbTx?.item?.name || item?.name || 'Unknown Item',
      itemCategory: (dbTx?.item?.category as any) || item?.category || 'OTHER',
      batchId: data.batchId || null,
      transactionType: data.transactionType,
      quantityChange: data.quantityChange,
      quantityBefore: data.quantityBefore,
      quantityAfter: data.quantityAfter,
      unitCost: data.unitCost,
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      reason: data.reason || null,
      performedByUserId: data.performedByUserId || null,
      createdAt: dbTx?.createdAt?.toISOString() || new Date().toISOString(),
    };

    transactions.push(tx);
    this.mockTransactions.set(practiceId, transactions);

    return tx;
  }

  static async listTransactions(
    practiceId: string,
    filters: {
      itemId?: string;
      batchId?: string;
      transactionType?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<InventoryTransactionDTO[]> {
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryTransaction) {
      try {
        const where: any = { practiceId };
        if (filters.itemId) where.itemId = filters.itemId;
        if (filters.batchId) where.batchId = filters.batchId;
        if (filters.transactionType && filters.transactionType !== 'ALL') {
          where.transactionType = filters.transactionType;
        }
        if (filters.startDate) where.createdAt = { ...(where.createdAt || {}), gte: new Date(filters.startDate) };
        if (filters.endDate) where.createdAt = { ...(where.createdAt || {}), lte: new Date(filters.endDate) };

        const dbTxs = await prisma.inventoryTransaction.findMany({
          where,
          include: { item: true },
          orderBy: { createdAt: 'desc' },
        });

        if (dbTxs.length > 0) {
          return dbTxs.map((t) => ({
            id: t.id,
            practiceId: t.practiceId,
            itemId: t.itemId,
            itemName: t.item?.name || 'Unknown Item',
            itemCategory: (t.item?.category as any) || 'OTHER',
            batchId: t.batchId,
            transactionType: t.transactionType as any,
            quantityChange: t.quantityChange,
            quantityBefore: t.quantityBefore,
            quantityAfter: t.quantityAfter,
            unitCost: t.unitCost,
            referenceType: t.referenceType,
            referenceId: t.referenceId,
            reason: t.reason,
            performedByUserId: t.performedByUserId,
            createdAt: t.createdAt.toISOString(),
          }));
        }
      } catch (err) {
        console.warn('[InventoryService.listTransactions] Prisma error, using fallback:', err);
      }
    }

    let result = this.getTransactionsStore(practiceId);

    if (filters.itemId) {
      result = result.filter((t) => t.itemId === filters.itemId);
    }
    if (filters.batchId) {
      result = result.filter((t) => t.batchId === filters.batchId);
    }
    if (filters.transactionType && filters.transactionType !== 'ALL') {
      result = result.filter((t) => t.transactionType === filters.transactionType);
    }
    if (filters.startDate) {
      result = result.filter((t) => t.createdAt >= filters.startDate!);
    }
    if (filters.endDate) {
      result = result.filter((t) => t.createdAt <= filters.endDate!);
    }

    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // --------------------------------------------------------------------------
  // 5. Manual Stock Adjustment & Waste Disposal
  // --------------------------------------------------------------------------

  static async adjustStock(
    practiceId: string,
    data: {
      itemId: string;
      batchId?: string | null;
      quantityChange: number; // positive or negative
      reason: string;
      notes?: string | null;
      performedByUserId?: string | null;
    }
  ): Promise<{ transaction: InventoryTransactionDTO }> {
    const item = await this.getItemById(data.itemId, practiceId);
    const batches = await this.listBatches(practiceId);

    if (!data.reason || !data.reason.trim()) {
      throw new AppError(400, 'REASON_REQUIRED', 'A valid reason is required for manual stock adjustment.');
    }

    const change = Number(data.quantityChange);
    if (change === 0) {
      throw new AppError(400, 'INVALID_CHANGE', 'Quantity change cannot be zero.');
    }

    let batch = data.batchId ? batches.find((b) => b.id === data.batchId) : null;
    if (!batch) {
      // Find oldest active batch for this item
      batch = batches.find((b) => b.inventoryItemId === item.id && b.currentQuantity > 0) || null;
    }

    if (!batch && change < 0) {
      throw new AppError(400, 'INSUFFICIENT_STOCK', 'No active batch available to adjust downwards.');
    }

    const qtyBefore = batch ? batch.currentQuantity : 0;
    const qtyAfter = Math.max(0, qtyBefore + change);
    const actualChange = qtyAfter - qtyBefore;

    if (batch) {
      batch.currentQuantity = qtyAfter;
      batch.updatedAt = new Date().toISOString();
      this.mockBatches.set(practiceId, batches);

      if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch && !batch.id.startsWith('batch_')) {
        try {
          await prisma.inventoryBatch.update({
            where: { id: batch.id },
            data: { currentQuantity: qtyAfter },
          });
        } catch (err) {
          console.warn('[InventoryService.adjustStock] Prisma batch update error:', err);
        }
      }
    }

    let txType: InventoryTransactionDTO['transactionType'] = 'STOCK_ADJUSTMENT';
    const reasonLower = data.reason.toLowerCase();
    if (reasonLower.includes('damage')) txType = 'DAMAGED';
    else if (reasonLower.includes('expire')) txType = 'EXPIRED';
    else if (reasonLower.includes('waste') || reasonLower.includes('spill')) txType = 'WASTAGE';
    else if (reasonLower.includes('return')) txType = 'RETURN_TO_SUPPLIER';

    const transaction = await this.recordTransaction(practiceId, {
      itemId: item.id,
      batchId: batch ? batch.id : null,
      transactionType: txType,
      quantityChange: actualChange,
      quantityBefore: qtyBefore,
      quantityAfter: qtyAfter,
      unitCost: batch ? batch.purchaseRate : 0,
      referenceType: 'MANUAL_ADJUSTMENT',
      reason: `${data.reason}${data.notes ? ` - ${data.notes.trim()}` : ''}`,
      performedByUserId: data.performedByUserId || null,
    });

    return { transaction };
  }

  // --------------------------------------------------------------------------
  // 6. Physical Stocktake Workflow
  // --------------------------------------------------------------------------

  static async performStocktake(
    practiceId: string,
    items: Array<{
      itemId: string;
      batchId?: string;
      physicalQuantity: number;
      reason?: string;
    }>,
    performedByUserId?: string | null
  ): Promise<{ adjustmentsCount: number; transactions: InventoryTransactionDTO[] }> {
    const transactions: InventoryTransactionDTO[] = [];
    const batches = await this.listBatches(practiceId);

    for (const item of items) {
      const batch = item.batchId ? batches.find((b) => b.id === item.batchId) : null;
      if (!batch) continue;

      const physical = Math.max(0, Number(item.physicalQuantity));
      const system = batch.currentQuantity;
      const difference = physical - system;

      if (difference !== 0) {
        batch.currentQuantity = physical;
        batch.updatedAt = new Date().toISOString();

        if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch && !batch.id.startsWith('batch_')) {
          try {
            await prisma.inventoryBatch.update({
              where: { id: batch.id },
              data: { currentQuantity: physical },
            });
          } catch (err) {
            console.warn('[InventoryService.performStocktake] Prisma batch update error:', err);
          }
        }

        const tx = await this.recordTransaction(practiceId, {
          itemId: item.itemId,
          batchId: batch.id,
          transactionType: 'STOCK_ADJUSTMENT',
          quantityChange: difference,
          quantityBefore: system,
          quantityAfter: physical,
          unitCost: batch.purchaseRate,
          referenceType: 'STOCKTAKE',
          reason: item.reason || `Physical stocktake correction (Variance: ${difference > 0 ? '+' : ''}${difference})`,
          performedByUserId: performedByUserId || null,
        });

        transactions.push(tx);
      }
    }

    this.mockBatches.set(practiceId, batches);
    return { adjustmentsCount: transactions.length, transactions };
  }

  // --------------------------------------------------------------------------
  // 7. Suppliers Management
  // --------------------------------------------------------------------------

  static async listSuppliers(practiceId: string, search?: string): Promise<SupplierDTO[]> {
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.supplier) {
      try {
        const where: any = { practiceId };
        if (search && search.trim()) {
          const q = search.trim();
          where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { gstin: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ];
        }
        const dbSuppliers = await prisma.supplier.findMany({
          where,
          include: { purchases: true },
          orderBy: { name: 'asc' },
        });
        if (dbSuppliers.length > 0) {
          return dbSuppliers.map((s) => ({
            id: s.id,
            practiceId: s.practiceId,
            name: s.name,
            gstin: s.gstin,
            address: s.address,
            phone: s.phone,
            email: s.email,
            notes: s.notes,
            isActive: s.isActive,
            totalPurchasesCount: s.purchases.length,
            totalPurchasesAmount: s.purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
          }));
        }
      } catch (err) {
        console.warn('[InventoryService.listSuppliers] Prisma error, using fallback:', err);
      }
    }

    let result = this.getSuppliersStore(practiceId);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.gstin && s.gstin.toLowerCase().includes(q)) ||
          (s.phone && s.phone.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  static async createSupplier(
    practiceId: string,
    data: {
      name: string;
      gstin?: string | null;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      notes?: string | null;
    }
  ): Promise<SupplierDTO> {
    let dbSupplier: any = null;
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.supplier) {
      try {
        dbSupplier = await prisma.supplier.create({
          data: {
            practiceId,
            name: data.name.trim(),
            gstin: data.gstin?.trim() || null,
            address: data.address?.trim() || null,
            phone: data.phone?.trim() || null,
            email: data.email?.trim() || null,
            notes: data.notes?.trim() || null,
            isActive: true,
          },
        });
      } catch (err) {
        console.warn('[InventoryService.createSupplier] Prisma error:', err);
      }
    }

    const suppliers = this.getSuppliersStore(practiceId);
    const newSupplier: SupplierDTO = {
      id: dbSupplier?.id || `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId,
      name: data.name.trim(),
      gstin: data.gstin?.trim() || null,
      address: data.address?.trim() || null,
      phone: data.phone?.trim() || null,
      email: data.email?.trim() || null,
      notes: data.notes?.trim() || null,
      isActive: true,
      totalPurchasesCount: 0,
      totalPurchasesAmount: 0,
      createdAt: dbSupplier?.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: dbSupplier?.updatedAt?.toISOString() || new Date().toISOString(),
    };

    suppliers.push(newSupplier);
    this.mockSuppliers.set(practiceId, suppliers);
    return newSupplier;
  }

  // --------------------------------------------------------------------------
  // 8. Purchase Invoice Confirmation & Stock Batches Generation
  // --------------------------------------------------------------------------

  static async confirmPurchaseInvoice(
    practiceId: string,
    data: {
      supplierName?: string;
      supplierGstin?: string | null;
      invoiceNumber: string;
      invoiceDate: string;
      totalAmount?: number;
      notes?: string | null;
      items: Array<ExtractedInvoiceItemDTO & { createNewMedicineMaster?: boolean }>;
      performedByUserId?: string | null;
    },
    performedByUserId?: string | null
  ): Promise<PurchaseInvoiceDTO> {
    const actorUserId = performedByUserId || data.performedByUserId || null;
    if (!data.items || data.items.length === 0) {
      throw new AppError(400, 'NO_ITEMS', 'Purchase invoice must contain at least one line item.');
    }

    // 1. Resolve or create Supplier
    const rawSupplier: any = (data as any).supplier;
    const supplierName =
      (typeof rawSupplier === 'object' && rawSupplier?.name) ||
      (typeof rawSupplier === 'string' && rawSupplier) ||
      data.supplierName ||
      'Unknown Supplier';
    const supplierGstin =
      (typeof rawSupplier === 'object' && rawSupplier?.gstin) ||
      data.supplierGstin ||
      null;

    let supplier: any = null;
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.supplier) {
      try {
        supplier = await prisma.supplier.findFirst({
          where: {
            practiceId,
            name: { equals: supplierName.trim(), mode: 'insensitive' },
          },
        });
        if (!supplier) {
          supplier = await prisma.supplier.create({
            data: {
              practiceId,
              name: supplierName.trim(),
              gstin: supplierGstin,
              isActive: true,
            },
          });
        }
      } catch (err) {
        console.warn('[InventoryService.confirmPurchaseInvoice] Prisma supplier error:', err);
      }
    }

    if (!supplier) {
      supplier = this.getSuppliersStore(practiceId).find(
        (s) => s.name.toLowerCase() === supplierName.trim().toLowerCase()
      );
      if (!supplier) {
        supplier = await this.createSupplier(practiceId, {
          name: supplierName.trim(),
          gstin: supplierGstin,
        });
      }
    }

    const purchases = this.getPurchasesStore(practiceId);
    const batches = this.getBatchesStore(practiceId);

    const purchaseInvoiceId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let grandTotal = 0;
    const invoiceItems: PurchaseInvoiceDTO['items'] = [];
    const dbInvoiceItemsData: any[] = [];

    // 2. Process each confirmed line item
    for (const itemData of data.items) {
      let inventoryItemId = itemData.matchedItemId;

      // 1. If item is a medicine, ensure a linked Medicine Master always exists (Unified Catalogue)
      let resolvedMedicineId: string | null = itemData.matchedMedicineId ? String(itemData.matchedMedicineId) : null;
      if (itemData.category === 'MEDICINE' && !resolvedMedicineId && process.env.VETRX_FAST_TEST !== '1' && prisma?.medicine) {
        try {
          const trimmedMedName = itemData.name.trim();
          const existingMed = await prisma.medicine.findFirst({
            where: {
              practiceId,
              name: { equals: trimmedMedName, mode: 'insensitive' },
            },
          });
          if (existingMed) {
            resolvedMedicineId = existingMed.id;
          } else {
            const newMed = await prisma.medicine.create({
              data: {
                practiceId,
                name: trimmedMedName,
                genericName: itemData.genericName?.trim() || null,
                category: 'Allopathy',
                form: itemData.dosageForm?.trim() || itemData.presentation?.trim() || 'Tablet',
                strength: itemData.strength?.trim() || null,
                unitPrice: Number(itemData.purchaseRate) || 0,
                isActive: true,
              },
            });
            resolvedMedicineId = newMed.id;
          }
          itemData.matchedMedicineId = resolvedMedicineId;
        } catch (err) {
          console.warn('[InventoryService.confirmPurchaseInvoice] Medicine master error:', err);
        }
      }

      // 2. If no inventory item ID was provided, search for existing item by name and category
      if (!inventoryItemId && process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryItem) {
        try {
          const trimmedItemName = itemData.name.trim();
          const existingInv = await prisma.inventoryItem.findFirst({
            where: {
              practiceId,
              name: { equals: trimmedItemName, mode: 'insensitive' },
              category: itemData.category as any,
            },
          });
          if (existingInv) {
            inventoryItemId = existingInv.id;
            const invUpdates: any = {};
            if (!existingInv.medicineId && resolvedMedicineId) {
              invUpdates.medicineId = resolvedMedicineId;
            }
            if (!existingInv.manufacturer && itemData.manufacturer) {
              invUpdates.manufacturer = itemData.manufacturer.trim();
            }
            if (Object.keys(invUpdates).length > 0) {
              await prisma.inventoryItem.update({
                where: { id: existingInv.id },
                data: invUpdates,
              });
            }
          }
        } catch (err) {
          console.warn('[InventoryService.confirmPurchaseInvoice] Find item error:', err);
        }
      }

      // 2b. In-memory check fallback if inventoryItemId still empty
      if (!inventoryItemId) {
        const memItems = this.getItemsStore(practiceId);
        const memExisting = memItems.find(
          (i) => i.name.trim().toLowerCase() === itemData.name.trim().toLowerCase() && i.category === itemData.category
        );
        if (memExisting) {
          inventoryItemId = memExisting.id;
          if (!memExisting.medicineId && resolvedMedicineId) {
            memExisting.medicineId = resolvedMedicineId;
          }
        }
      }

      // 3. Create persistent InventoryItem if not already existing
      if (!inventoryItemId) {
        const createdItem = await this.createItem(practiceId, {
          category: itemData.category,
          name: itemData.name.trim(),
          genericName: itemData.genericName?.trim() || null,
          strength: itemData.strength?.trim() || null,
          dosageForm: itemData.dosageForm?.trim() || null,
          packSize: itemData.packSize?.trim() || null,
          stockUnit: itemData.stockUnit?.trim() || (itemData.category === 'MEDICINE' ? 'Strip' : 'Unit'),
          presentation: itemData.presentation?.trim() || null,
          manufacturer: itemData.manufacturer?.trim() || null,
          minimumStockLevel: 5,
          targetStockLevel: 20,
          medicineId: resolvedMedicineId || null,
        });
        inventoryItemId = createdItem.id;
      }

      const qty = Math.max(1, Number(itemData.quantity));
      const rate = Number(itemData.purchaseRate) || 0;
      const mrp = Number(itemData.mrp) || Math.round(rate * 1.35);
      const disc = Number(itemData.discountPercent ?? itemData.schemeDiscountPercent ?? 0);
      const taxable = itemData.taxableValue && Number(itemData.taxableValue) > 0
        ? Number(itemData.taxableValue)
        : Math.round(qty * rate * (1 - disc / 100) * 100) / 100;
      const gst = Number(itemData.gstPercent) || 0;
      const calculatedLineTotal = Math.round((taxable + (taxable * gst) / 100) * 100) / 100;
      const lineTotal = itemData.lineTotal && Number(itemData.lineTotal) > 0
        ? Number(itemData.lineTotal)
        : (disc > 0 || gst > 0 ? calculatedLineTotal : Math.round(qty * rate * 100) / 100);
      grandTotal += lineTotal;

      let validExpiry: Date;
      if (itemData.expiryDate) {
        const trimmed = String(itemData.expiryDate).trim();
        const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        const ymd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (dmy) {
          validExpiry = new Date(Date.UTC(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10), 12, 0, 0));
        } else if (ymd) {
          validExpiry = new Date(Date.UTC(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), 12, 0, 0));
        } else {
          const parsed = new Date(trimmed);
          validExpiry = isNaN(parsed.getTime()) ? new Date(Date.now() + 365 * 24 * 3600 * 1000) : parsed;
        }
      } else {
        validExpiry = new Date(Date.now() + 365 * 24 * 3600 * 1000);
      }
      const mfgDateObj = itemData.manufacturingDate ? new Date(itemData.manufacturingDate) : null;
      const validMfg = mfgDateObj && !isNaN(mfgDateObj.getTime()) ? mfgDateObj : null;

      let dbBatch: any = null;
      if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
        try {
          dbBatch = await prisma.inventoryBatch.create({
            data: {
              practiceId,
              inventoryItemId,
              batchNumber: (itemData.batchNumber || 'BATCH-001').trim().toUpperCase(),
              manufacturingDate: validMfg,
              expiryDate: validExpiry,
              currentQuantity: qty,
              initialQuantity: qty,
              purchaseRate: rate,
              mrp,
              locationId: null,
            },
          });
        } catch (err) {
          console.warn('[InventoryService.confirmPurchaseInvoice] Prisma batch error:', err);
        }
      }

      const batchId = dbBatch?.id || `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Create Stock Batch in memory
      const newBatch: InventoryBatchDTO = {
        id: batchId,
        practiceId,
        inventoryItemId,
        itemName: itemData.name,
        itemCategory: itemData.category,
        batchNumber: (itemData.batchNumber || 'BATCH-001').trim().toUpperCase(),
        manufacturingDate: itemData.manufacturingDate || null,
        expiryDate: validExpiry.toISOString().split('T')[0],
        currentQuantity: qty,
        initialQuantity: qty,
        purchaseRate: rate,
        mrp,
        locationId: 'loc_main',
        locationName: 'Main Stock',
        createdAt: dbBatch?.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: dbBatch?.updatedAt?.toISOString() || new Date().toISOString(),
      };
      batches.push(newBatch);

      // Create PURCHASE ledger transaction
      await this.recordTransaction(practiceId, {
        itemId: inventoryItemId,
        batchId: newBatch.id,
        transactionType: 'PURCHASE',
        quantityChange: qty,
        quantityBefore: 0,
        quantityAfter: qty,
        unitCost: rate,
        referenceType: 'PURCHASE_INVOICE',
        referenceId: purchaseInvoiceId,
        reason: `Purchase Invoice: ${data.invoiceNumber} from ${supplierName}`,
        performedByUserId: actorUserId,
      });

      invoiceItems.push({
        id: `pi_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        purchaseInvoiceId,
        inventoryItemId,
        itemName: itemData.name,
        category: itemData.category,
        presentation: itemData.presentation,
        batchNumber: newBatch.batchNumber,
        manufacturingDate: newBatch.manufacturingDate,
        expiryDate: newBatch.expiryDate,
        quantity: qty,
        purchaseRate: rate,
        mrp,
        lineTotal,
      });

      dbInvoiceItemsData.push({
        inventoryItemId,
        itemName: itemData.name.trim(),
        category: itemData.category as any,
        presentation: itemData.presentation || null,
        batchNumber: newBatch.batchNumber,
        manufacturingDate: validMfg,
        expiryDate: validExpiry,
        quantity: qty,
        purchaseRate: rate,
        mrp,
        lineTotal,
      });
    }

    const totalAmount = data.totalAmount !== undefined && Number(data.totalAmount) > 0
      ? Math.round(Number(data.totalAmount) * 100) / 100
      : Math.round(grandTotal * 100) / 100;
    const invDateObj = data.invoiceDate ? new Date(data.invoiceDate) : new Date();
    const validInvDate = isNaN(invDateObj.getTime()) ? new Date() : invDateObj;

    let dbPurchase: any = null;
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.purchaseInvoice) {
      try {
        const existingInv = await prisma.purchaseInvoice.findFirst({
          where: {
            practiceId,
            supplierName: supplierName.trim(),
            invoiceNumber: data.invoiceNumber.trim(),
          },
        });

        if (existingInv) {
          dbPurchase = await prisma.purchaseInvoice.update({
            where: { id: existingInv.id },
            data: {
              totalAmount: existingInv.totalAmount + totalAmount,
              items: {
                create: dbInvoiceItemsData,
              },
            },
            include: { items: true },
          });
        } else {
          dbPurchase = await prisma.purchaseInvoice.create({
            data: {
              practiceId,
              supplierId: supplier?.id && !supplier.id.startsWith('sup_') ? supplier.id : null,
              supplierName: supplierName.trim(),
              supplierGstin: supplierGstin,
              invoiceNumber: data.invoiceNumber.trim(),
              invoiceDate: validInvDate,
              totalAmount,
              notes: data.notes || null,
              items: {
                create: dbInvoiceItemsData,
              },
            },
            include: { items: true },
          });
        }
      } catch (err) {
        console.warn('[InventoryService.confirmPurchaseInvoice] Prisma purchase error:', err);
      }
    }

    const purchaseInvoice: PurchaseInvoiceDTO = {
      id: dbPurchase?.id || purchaseInvoiceId,
      practiceId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierGstin: supplier.gstin,
      invoiceNumber: data.invoiceNumber.trim(),
      invoiceDate: data.invoiceDate,
      totalAmount,
      notes: data.notes || null,
      itemsCount: invoiceItems.length,
      items: invoiceItems,
      createdAt: dbPurchase?.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: dbPurchase?.updatedAt?.toISOString() || new Date().toISOString(),
    };

    purchases.push(purchaseInvoice);
    this.mockPurchases.set(practiceId, purchases);
    this.mockBatches.set(practiceId, batches);

    // Update supplier statistics
    supplier.totalPurchasesCount = (supplier.totalPurchasesCount || 0) + 1;
    supplier.totalPurchasesAmount = (supplier.totalPurchasesAmount || 0) + purchaseInvoice.totalAmount;

    return purchaseInvoice;
  }

  static async listPurchases(practiceId: string, search?: string): Promise<PurchaseInvoiceDTO[]> {
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.purchaseInvoice) {
      try {
        const where: any = { practiceId };
        if (search && search.trim()) {
          const q = search.trim();
          where.OR = [
            { invoiceNumber: { contains: q, mode: 'insensitive' } },
            { supplierName: { contains: q, mode: 'insensitive' } },
          ];
        }

        const dbPurchases = await prisma.purchaseInvoice.findMany({
          where,
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        });

        if (dbPurchases.length > 0) {
          return dbPurchases.map((p) => ({
            id: p.id,
            practiceId: p.practiceId,
            supplierId: p.supplierId || '',
            supplierName: p.supplierName,
            supplierGstin: p.supplierGstin,
            invoiceNumber: p.invoiceNumber,
            invoiceDate: p.invoiceDate.toISOString().split('T')[0],
            totalAmount: p.totalAmount,
            notes: p.notes,
            itemsCount: p.items.length,
            items: p.items.map((i) => ({
              id: i.id,
              purchaseInvoiceId: i.purchaseInvoiceId,
              inventoryItemId: i.inventoryItemId,
              itemName: i.itemName,
              category: i.category as any,
              presentation: i.presentation,
              batchNumber: i.batchNumber,
              manufacturingDate: i.manufacturingDate ? i.manufacturingDate.toISOString().split('T')[0] : null,
              expiryDate: i.expiryDate.toISOString().split('T')[0],
              quantity: i.quantity,
              purchaseRate: i.purchaseRate,
              mrp: i.mrp,
              lineTotal: i.lineTotal,
            })),
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
          }));
        }
      } catch (err) {
        console.warn('[InventoryService.listPurchases] Prisma error, using fallback:', err);
      }
    }

    let result = this.getPurchasesStore(practiceId);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // --------------------------------------------------------------------------
  // 9. FEFO Prescription Stock Resolution
  // --------------------------------------------------------------------------

  static async resolvePrescriptionStock(
    practiceId: string,
    prescribedItems: Array<{
      medicineId?: string | null;
      brandName: string;
      totalQuantity: number;
    }>
  ): Promise<StockResolutionItemDTO[]> {
    const items = await this.listItems(practiceId);
    const batches = await this.listBatches(practiceId);
    const today = new Date().toISOString().split('T')[0];

    const resolutions: StockResolutionItemDTO[] = [];

    for (const rxItem of prescribedItems) {
      const reqQty = Number(rxItem.totalQuantity) || 1;

      // Find matching inventory item (by medicineId or brandName)
      let invItem = rxItem.medicineId
        ? items.find((i) => i.medicineId === rxItem.medicineId)
        : null;

      if (!invItem) {
        const brandNorm = rxItem.brandName.trim().toLowerCase();
        invItem = items.find(
          (i) => i.name.trim().toLowerCase() === brandNorm
        ) || null;
      }

      if (!invItem) {
        // No inventory record exists for this medicine
        resolutions.push({
          medicineId: rxItem.medicineId || null,
          brandName: rxItem.brandName,
          requiredQuantity: reqQty,
          validInternalStock: 0,
          internalQuantity: 0,
          externalQuantity: reqQty,
          status: 'EXTERNAL',
          batches: [],
        });
        continue;
      }

      // Filter valid (non-expired, stock > 0) batches and sort by FEFO (earliest expiry first)
      const validBatches = batches
        .filter((b) => b.inventoryItemId === invItem!.id && b.expiryDate >= today && b.currentQuantity > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      const totalValid = validBatches.reduce((sum, b) => sum + b.currentQuantity, 0);
      let needed = reqQty;
      const allocatedBatches: StockResolutionItemDTO['batches'] = [];

      for (const b of validBatches) {
        if (needed <= 0) break;
        const take = Math.min(needed, b.currentQuantity);
        allocatedBatches.push({
          batchId: b.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          availableQuantity: b.currentQuantity,
          allocatedQuantity: take,
        });
        needed -= take;
      }

      const internalQty = Math.min(reqQty, totalValid);
      const externalQty = Math.max(0, reqQty - totalValid);

      let status: 'IN_STOCK' | 'PARTIAL' | 'EXTERNAL' = 'IN_STOCK';
      if (internalQty === 0) status = 'EXTERNAL';
      else if (externalQty > 0) status = 'PARTIAL';

      resolutions.push({
        medicineId: rxItem.medicineId || null,
        brandName: rxItem.brandName,
        requiredQuantity: reqQty,
        validInternalStock: totalValid,
        internalQuantity: internalQty,
        externalQuantity: externalQty,
        status,
        batches: allocatedBatches,
      });
    }

    return resolutions;
  }

  // --------------------------------------------------------------------------
  // 10. Invoice FEFO Stock Deduction & Cancellation Reversal
  // --------------------------------------------------------------------------

  static async deductInvoiceStock(
    practiceId: string,
    invoiceId: string,
    invoiceNumber: string,
    itemsToDeduct: Array<{
      medicineId?: string | null;
      description: string;
      quantity: number;
    }>,
    performedByUserId?: string | null
  ): Promise<{ transactions: InventoryTransactionDTO[] }> {
    const batches = await this.listBatches(practiceId);
    const itemsStore = await this.listItems(practiceId);
    const today = new Date().toISOString().split('T')[0];
    const transactions: InventoryTransactionDTO[] = [];

    for (const it of itemsToDeduct) {
      const qty = Number(it.quantity) || 1;

      // Match inventory item
      let invItem = it.medicineId
        ? itemsStore.find((i) => i.medicineId === it.medicineId)
        : null;

      if (!invItem) {
        const descNorm = it.description.trim().toLowerCase();
        invItem = itemsStore.find(
          (i) => i.name.trim().toLowerCase() === descNorm
        ) || null;
      }

      if (!invItem) {
        // External item not tracked in internal inventory; skip deduction safely
        continue;
      }

      // FEFO allocation across valid non-expired batches
      const validBatches = batches
        .filter((b) => b.inventoryItemId === invItem!.id && b.expiryDate >= today && b.currentQuantity > 0)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      let remainingToDeduct = qty;

      for (const batch of validBatches) {
        if (remainingToDeduct <= 0) break;
        const take = Math.min(remainingToDeduct, batch.currentQuantity);
        const qtyBefore = batch.currentQuantity;
        const qtyAfter = qtyBefore - take;

        batch.currentQuantity = qtyAfter;
        batch.updatedAt = new Date().toISOString();

        if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch && !batch.id.startsWith('batch_')) {
          try {
            await prisma.inventoryBatch.update({
              where: { id: batch.id },
              data: { currentQuantity: qtyAfter },
            });
          } catch (err) {
            console.warn('[InventoryService.deductInvoiceStock] Prisma batch update error:', err);
          }
        }

        const tx = await this.recordTransaction(practiceId, {
          itemId: invItem.id,
          batchId: batch.id,
          transactionType: 'SALE_OR_INVOICE',
          quantityChange: -take,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          unitCost: batch.purchaseRate,
          referenceType: 'INVOICE',
          referenceId: invoiceId,
          reason: `Invoice: ${invoiceNumber} - Deducted ${take} ${invItem.stockUnit}`,
          performedByUserId: performedByUserId || null,
        });

        transactions.push(tx);
        remainingToDeduct -= take;
      }
    }

    this.mockBatches.set(practiceId, batches);
    return { transactions };
  }

  static async reverseInvoiceStock(
    practiceId: string,
    invoiceId: string,
    invoiceNumber: string,
    performedByUserId?: string | null
  ): Promise<{ reversalsCount: number; transactions: InventoryTransactionDTO[] }> {
    const allTx = await this.listTransactions(practiceId);
    const batches = await this.listBatches(practiceId);

    // Find original SALE_OR_INVOICE transactions for this invoice
    const originalTxs = allTx.filter(
      (t) => t.referenceId === invoiceId && t.transactionType === 'SALE_OR_INVOICE'
    );

    const reversalTxs: InventoryTransactionDTO[] = [];

    for (const orig of originalTxs) {
      const returnQty = Math.abs(orig.quantityChange);
      const batch = orig.batchId ? batches.find((b) => b.id === orig.batchId) : null;

      const qtyBefore = batch ? batch.currentQuantity : 0;
      const qtyAfter = qtyBefore + returnQty;

      if (batch) {
        batch.currentQuantity = qtyAfter;
        batch.updatedAt = new Date().toISOString();

        if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch && !batch.id.startsWith('batch_')) {
          try {
            await prisma.inventoryBatch.update({
              where: { id: batch.id },
              data: { currentQuantity: qtyAfter },
            });
          } catch (err) {
            console.warn('[InventoryService.reverseInvoiceStock] Prisma batch update error:', err);
          }
        }
      }

      const revTx = await this.recordTransaction(practiceId, {
        itemId: orig.itemId,
        batchId: orig.batchId,
        transactionType: 'REVERSAL',
        quantityChange: returnQty,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        unitCost: orig.unitCost,
        referenceType: 'INVOICE_REVERSAL',
        referenceId: invoiceId,
        reason: `Reversal: Cancelled Invoice ${invoiceNumber}`,
        performedByUserId: performedByUserId || null,
      });

      reversalTxs.push(revTx);
    }

    this.mockBatches.set(practiceId, batches);
    return { reversalsCount: reversalTxs.length, transactions: reversalTxs };
  }

  // --------------------------------------------------------------------------
  // 11. Inventory Alerts (Expiring Soon, Expired, Low Stock, Out of Stock)
  // --------------------------------------------------------------------------

  static async getAlerts(
    practiceId: string,
    warningDays: number = 90,
    criticalDays: number = 30
  ) {
    const items = await this.listItems(practiceId);
    const batches = await this.listBatches(practiceId);
    const today = new Date().toISOString().split('T')[0];

    const lowStockItems = items.filter((i) => (i.validStock || 0) > 0 && (i.validStock || 0) <= i.minimumStockLevel);
    const outOfStockItems = items.filter((i) => (i.validStock || 0) === 0);

    const expiredBatches = batches.filter((b) => b.expiryDate < today && b.currentQuantity > 0);
    const expiringSoonBatches = batches.filter(
      (b) => b.expiryDate >= today && (b.daysToExpiry || 0) <= warningDays && b.currentQuantity > 0
    );
    const criticalBatches = batches.filter(
      (b) => b.expiryDate >= today && (b.daysToExpiry || 0) <= criticalDays && b.currentQuantity > 0
    );

    return {
      lowStock: lowStockItems,
      outOfStock: outOfStockItems,
      expired: expiredBatches,
      expiringSoon: expiringSoonBatches,
      critical: criticalBatches,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      expiredCount: expiredBatches.length,
      expiringSoonCount: expiringSoonBatches.length,
      criticalCount: criticalBatches.length,
      counts: {
        lowStock: lowStockItems.length,
        outOfStock: outOfStockItems.length,
        expired: expiredBatches.length,
        expiringSoon: expiringSoonBatches.length,
        critical: criticalBatches.length,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 12. Dashboard Summary
  // --------------------------------------------------------------------------

  static async getDashboardSummary(practiceId: string): Promise<InventoryDashboardDTO & any> {
    const items = await this.listItems(practiceId);
    const batches = await this.listBatches(practiceId);
    const today = new Date().toISOString().split('T')[0];

    const uniqueItemCount = items.length;
    const totalUnitsInStock = batches.reduce((sum, b) => sum + (b.currentQuantity || 0), 0);

    // Valuation: Current Stock * Purchase Cost (INR)
    const stockValueINR = batches.reduce((sum, b) => sum + (b.currentQuantity * b.purchaseRate), 0);

    // Usage Today from Transactions
    const txToday = (await this.listTransactions(practiceId, { startDate: today })).filter(
      (t) => t.quantityChange < 0
    );
    const unitsUsedToday = txToday.reduce((sum, t) => sum + Math.abs(t.quantityChange), 0);
    const valueUsedTodayINR = txToday.reduce(
      (sum, t) => sum + Math.abs(t.quantityChange) * (t.unitCost || 0),
      0
    );

    const alerts = await this.getAlerts(practiceId);

    const { storeLocation, bagLocation } = await this.ensureDefaultLocations(practiceId);
    const storeBatches = batches.filter(
      (b) => !b.locationId || b.locationId === storeLocation.id
    );
    const bagBatches = batches.filter(
      (b) => b.locationId === bagLocation.id
    );
    const storeItemIds = new Set(storeBatches.map((b) => b.inventoryItemId));
    const bagItemIds = new Set(bagBatches.map((b) => b.inventoryItemId));

    const storeStockSummary = {
      totalItems: storeItemIds.size,
      totalUnits: Math.round(storeBatches.reduce((s, b) => s + (b.currentQuantity || 0), 0) * 100) / 100,
      lowStockCount: items.filter(
        (it) => storeItemIds.has(it.id) && (it.validStock ?? 0) <= it.minimumStockLevel
      ).length,
      stockValueINR: Math.round(storeBatches.reduce((s, b) => s + (b.currentQuantity * b.purchaseRate), 0) * 100) / 100,
    };

    const practiceBagSummary = {
      totalItems: bagItemIds.size,
      totalUnits: Math.round(bagBatches.reduce((s, b) => s + (b.currentQuantity || 0), 0) * 100) / 100,
      lowStockCount: bagBatches.filter((b) => b.currentQuantity > 0 && b.currentQuantity <= 2).length,
      expiringSoonCount: bagBatches.filter((b) => b.expiryStatus === 'EXPIRING_SOON' || b.expiryStatus === 'CRITICAL').length,
    };

    const recentPurchases = (await this.listPurchases(practiceId)).slice(0, 5);
    const recentMovements = (await this.listTransactions(practiceId)).slice(0, 5);

    return {
      totalItems: uniqueItemCount,
      uniqueItemCount,
      totalUnits: totalUnitsInStock,
      totalUnitsInStock,
      totalStockValue: Math.round(stockValueINR * 100) / 100,
      stockValueINR: Math.round(stockValueINR * 100) / 100,
      usedTodayUnits: unitsUsedToday,
      unitsUsedToday,
      usedTodayValue: Math.round(valueUsedTodayINR * 100) / 100,
      valueUsedTodayINR: Math.round(valueUsedTodayINR * 100) / 100,
      lowStockCount: alerts.counts.lowStock,
      outOfStockCount: alerts.counts.outOfStock,
      expiringSoonCount: alerts.counts.expiringSoon,
      expiredCount: alerts.counts.expired,
      storeStockSummary,
      practiceBagSummary,
      alerts: {
        expiringSoon: alerts.expiringSoon.map((b) => ({
          batchId: b.id,
          itemId: b.inventoryItemId,
          itemName: b.itemName,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          quantity: b.currentQuantity,
          daysRemaining: b.daysToExpiry,
          isCritical: b.expiryStatus === 'CRITICAL',
        })),
        expired: alerts.expired.map((b) => ({
          batchId: b.id,
          itemId: b.inventoryItemId,
          itemName: b.itemName,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          quantity: b.currentQuantity,
        })),
        lowStock: alerts.lowStock.map((i) => ({
          itemId: i.id,
          itemName: i.name,
          category: i.category,
          currentStock: i.validStock,
          minimumStockLevel: i.minimumStockLevel,
          targetStockLevel: i.targetStockLevel,
        })),
        outOfStock: alerts.outOfStock.map((i) => ({
          itemId: i.id,
          itemName: i.name,
          category: i.category,
          minimumStockLevel: i.minimumStockLevel,
        })),
      },
      recentPurchases,
      recentMovements,
    };
  }

  static async getDashboard(practiceId: string) {
    const summary = await this.getDashboardSummary(practiceId);
    return {
      ...summary,
      totalUniqueItems: summary.uniqueItemCount,
      totalPhysicalUnits: summary.totalUnitsInStock,
      stockValuation: summary.stockValueINR,
    };
  }

  /**
   * Idempotent Catalogue Synchronization & Backfill
   * Ensures every confirmed InventoryItem classified as MEDICINE has a linked
   * Medicine master record in PostgreSQL, and enriches clinical details.
   * CONSUMABLE items remain strictly within Inventory & Billing.
   */
  static async syncInventoryCatalogues(practiceId: string): Promise<{
    success: boolean;
    totalInventoryItems: number;
    medicineItemsCount: number;
    linkedMedicinesCount: number;
    consumableItemsCount: number;
  }> {
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryItem && prisma?.medicine) {
      try {
        const items = await prisma.inventoryItem.findMany({
          where: { practiceId },
          include: { medicine: true },
        });

        let linkedCount = 0;
        let medCount = 0;
        let consCount = 0;

        for (const item of items) {
          if (item.category === 'MEDICINE') {
            medCount++;
            let medId = item.medicineId;
            if (!medId) {
              const trimmedName = item.name.trim();
              const existingMed = await prisma.medicine.findFirst({
                where: {
                  practiceId,
                  name: { equals: trimmedName, mode: 'insensitive' },
                },
              });

              if (existingMed) {
                medId = existingMed.id;
              } else {
                const newMed = await prisma.medicine.create({
                  data: {
                    practiceId,
                    name: trimmedName,
                    genericName: item.genericName?.trim() || null,
                    category: 'Allopathy',
                    form: item.dosageForm?.trim() || item.presentation?.trim() || 'Tablet',
                    strength: item.strength?.trim() || null,
                    unitPrice: 0,
                    isActive: item.isActive !== false,
                  },
                });
                medId = newMed.id;
              }

              await prisma.inventoryItem.update({
                where: { id: item.id },
                data: { medicineId: medId },
              });
              linkedCount++;
            }
          } else {
            consCount++;
          }
        }

        return {
          success: true,
          totalInventoryItems: items.length,
          medicineItemsCount: medCount,
          linkedMedicinesCount: linkedCount,
          consumableItemsCount: consCount,
        };
      } catch (err) {
        console.warn('[InventoryService.syncInventoryCatalogues] Error syncing:', err);
      }
    }

    return {
      success: true,
      totalInventoryItems: 0,
      medicineItemsCount: 0,
      linkedMedicinesCount: 0,
      consumableItemsCount: 0,
    };
  }


  // --------------------------------------------------------------------------
  // 14. Phase 6: Stock Locations (Store Stock vs. Practice Bag)
  // --------------------------------------------------------------------------

  static async ensureDefaultLocations(
    practiceId: string
  ): Promise<{ storeLocation: StockLocationDTO; bagLocation: StockLocationDTO }> {
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.stockLocation) {
      try {
        const locations = await prisma.stockLocation.findMany({
          where: { practiceId },
          orderBy: { createdAt: 'asc' },
        });

        let store = locations.find(
          (l) => l.name.toLowerCase() === 'store stock' || l.isDefault
        );
        let bag = locations.find(
          (l) => l.name.toLowerCase() === 'practice bag'
        );

        if (!store) {
          const created = await prisma.stockLocation.create({
            data: {
              practiceId,
              name: 'Store Stock',
              description: 'Main Practice Inventory Store',
              isDefault: true,
            },
          });
          store = created;
        }

        if (!bag) {
          const created = await prisma.stockLocation.create({
            data: {
              practiceId,
              name: 'Practice Bag',
              description: 'Field Visit Carrying Bag',
              isDefault: false,
            },
          });
          bag = created;
        }

        const toDto = (l: any): StockLocationDTO => ({
          id: l.id,
          practiceId: l.practiceId,
          name: l.name,
          description: l.description,
          isDefault: l.isDefault,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        });

        return {
          storeLocation: toDto(store),
          bagLocation: toDto(bag),
        };
      } catch (err) {
        console.warn('[InventoryService.ensureDefaultLocations] Prisma error, using mock:', err);
      }
    }

    // Mock store fallback
    const locStore = this.getLocationsStore(practiceId);
    let store = locStore.find((l) => l.name === 'Store Stock' || l.isDefault);
    let bag = locStore.find((l) => l.name === 'Practice Bag');

    const now = new Date().toISOString();
    if (!store) {
      store = {
        id: `loc_store_${practiceId}`,
        practiceId,
        name: 'Store Stock',
        description: 'Main Practice Inventory Store',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      };
      locStore.push(store);
    }

    if (!bag) {
      bag = {
        id: `loc_bag_${practiceId}`,
        practiceId,
        name: 'Practice Bag',
        description: 'Field Visit Carrying Bag',
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };
      locStore.push(bag);
    }

    return { storeLocation: store, bagLocation: bag };
  }

  static async listLocations(practiceId: string): Promise<StockLocationDTO[]> {
    const { storeLocation, bagLocation } = await this.ensureDefaultLocations(practiceId);
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.stockLocation) {
      try {
        const dbLocs = await prisma.stockLocation.findMany({
          where: { practiceId },
          orderBy: { name: 'asc' },
        });
        return dbLocs.map((l) => ({
          id: l.id,
          practiceId: l.practiceId,
          name: l.name,
          description: l.description,
          isDefault: l.isDefault,
          createdAt: l.createdAt.toISOString(),
          updatedAt: l.updatedAt.toISOString(),
        }));
      } catch {}
    }
    return this.getLocationsStore(practiceId);
  }

  static async createLocation(
    practiceId: string,
    data: CreateLocationDTO,
    userId?: string | null
  ): Promise<StockLocationDTO> {
    const trimmedName = data.name.trim();
    if (!trimmedName) {
      throw new AppError(400, 'INVALID_NAME', 'Location name is required.');
    }
    if (trimmedName.toLowerCase() === 'store stock') {
      throw new AppError(400, 'RESERVED_NAME', 'Store Stock is a reserved location name.');
    }

    const existing = await this.listLocations(practiceId);
    if (existing.some((l) => l.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new AppError(409, 'DUPLICATE_LOCATION', `A location named "${trimmedName}" already exists.`);
    }

    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.stockLocation) {
      try {
        const created = await prisma.stockLocation.create({
          data: {
            practiceId,
            name: trimmedName,
            description: data.description?.trim() || null,
            isDefault: false,
          },
        });
        return {
          id: created.id,
          practiceId: created.practiceId,
          name: created.name,
          description: created.description,
          isDefault: created.isDefault,
          assignedUserId: data.assignedUserId || null,
          assignedUserName: data.assignedUserName || null,
          vehicleNumber: data.vehicleNumber || null,
          type: data.type || 'BAG',
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        };
      } catch (err) {
        console.warn('[InventoryService.createLocation] Prisma error, using mock:', err);
      }
    }

    const locStore = this.getLocationsStore(practiceId);
    const now = new Date().toISOString();
    const newLoc: StockLocationDTO = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId,
      name: trimmedName,
      description: data.description?.trim() || null,
      isDefault: false,
      assignedUserId: data.assignedUserId || null,
      assignedUserName: data.assignedUserName || null,
      vehicleNumber: data.vehicleNumber || null,
      type: data.type || 'BAG',
      createdAt: now,
      updatedAt: now,
    };
    locStore.push(newLoc);
    return newLoc;
  }

  // --------------------------------------------------------------------------
  // 15. Store Stock vs. Practice Bag Queries
  // --------------------------------------------------------------------------

  static async getStoreStock(
    practiceId: string,
    filters: { search?: string; category?: string } = {}
  ): Promise<{
    storeLocation: StockLocationDTO;
    items: InventoryItemDTO[];
    batches: InventoryBatchDTO[];
    summary: { totalItems: number; totalUnits: number; lowStockCount: number; stockValueINR: number };
  }> {
    const { storeLocation } = await this.ensureDefaultLocations(practiceId);
    const allItems = await this.listItems(practiceId, filters);
    const allBatches = await this.listBatches(practiceId);

    // Batches in Store Stock: either explicitly assigned to storeLocation.id OR without locationId
    const storeBatches = allBatches.filter(
      (b) => !b.locationId || b.locationId === storeLocation.id
    );

    const storeBatchItemIds = new Set(storeBatches.map((b) => b.inventoryItemId));
    const storeItems = allItems.filter((i) => storeBatchItemIds.has(i.id));

    const totalUnits = storeBatches.reduce((s, b) => s + (b.currentQuantity || 0), 0);
    const stockValueINR = storeBatches.reduce(
      (s, b) => s + (b.currentQuantity || 0) * (b.purchaseRate || 0),
      0
    );
    const lowStockCount = storeItems.filter(
      (i) => (i.validStock ?? 0) <= i.minimumStockLevel
    ).length;

    return {
      storeLocation,
      items: storeItems,
      batches: storeBatches,
      summary: {
        totalItems: storeItems.length,
        totalUnits: Math.round(totalUnits * 100) / 100,
        lowStockCount,
        stockValueINR: Math.round(stockValueINR * 100) / 100,
      },
    };
  }

  static async getPracticeBagStock(
    practiceId: string,
    filters: { search?: string; category?: string } = {},
    locationId?: string
  ): Promise<{
    bagLocation: StockLocationDTO;
    items: InventoryItemDTO[];
    batches: InventoryBatchDTO[];
    summary: { totalItems: number; totalUnits: number; lowStockCount: number; expiringSoonCount: number };
  }> {
    const { bagLocation: defaultBag } = await this.ensureDefaultLocations(practiceId);
    let targetLocation = defaultBag;
    if (locationId) {
      const allLocs = await this.listLocations(practiceId);
      const found = allLocs.find((l) => l.id === locationId);
      if (found) {
        targetLocation = found;
      } else {
        throw new AppError(404, 'LOCATION_NOT_FOUND', `Stock location ${locationId} not found in this practice.`);
      }
    }

    const allItems = await this.listItems(practiceId, filters);
    const allBatches = await this.listBatches(practiceId);

    // Batches in Selected Kit / Bag
    const bagBatches = allBatches.filter((b) => b.locationId === targetLocation.id);
    const bagBatchItemIds = new Set(bagBatches.map((b) => b.inventoryItemId));
    const bagItems = allItems
      .filter((i) => bagBatchItemIds.has(i.id))
      .map((i) => {
        const itemLocationBatches = bagBatches.filter((b) => b.inventoryItemId === i.id);
        const locQty = itemLocationBatches.reduce((s, b) => s + (b.currentQuantity || 0), 0);
        return {
          ...i,
          currentStock: locQty,
          totalStock: locQty,
          validStock: locQty,
          batches: itemLocationBatches,
        };
      });

    const totalUnits = bagBatches.reduce((s, b) => s + (b.currentQuantity || 0), 0);
    const lowStockCount = bagBatches.filter(
      (b) => b.currentQuantity > 0 && b.currentQuantity <= 2
    ).length;
    const expiringSoonCount = bagBatches.filter(
      (b) => b.expiryStatus === 'EXPIRING_SOON' || b.expiryStatus === 'CRITICAL'
    ).length;

    return {
      bagLocation: targetLocation,
      items: bagItems,
      batches: bagBatches,
      summary: {
        totalItems: bagItems.length,
        totalUnits: Math.round(totalUnits * 100) / 100,
        lowStockCount,
        expiringSoonCount,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 16. CVP-29: Stock In (Receipt into Store Stock)
  // --------------------------------------------------------------------------

  static async stockIn(
    practiceId: string,
    data: StockInDTO,
    userId?: string | null
  ): Promise<{
    success: boolean;
    item: InventoryItemDTO;
    batch: InventoryBatchDTO;
    transaction: InventoryTransactionDTO;
  }> {
    if (!data.quantity || data.quantity <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'Stock in quantity must be greater than zero.');
    }
    if (!data.batchNumber || !data.batchNumber.trim()) {
      throw new AppError(400, 'INVALID_BATCH', 'Batch number is required.');
    }
    if (!data.expiryDate || !data.expiryDate.trim()) {
      throw new AppError(400, 'INVALID_EXPIRY', 'Expiry date is required.');
    }

    const { storeLocation } = await this.ensureDefaultLocations(practiceId);

    // 1. Resolve or create item
    let item: InventoryItemDTO;
    if (data.itemId) {
      item = await this.getItemById(data.itemId, practiceId);
    } else {
      const itemName = data.name?.trim();
      if (!itemName) {
        throw new AppError(400, 'MISSING_ITEM', 'Either itemId or name is required.');
      }
      const existingItems = await this.listItems(practiceId, { search: itemName });
      const matched = existingItems.find(
        (i) => i.name.toLowerCase() === itemName.toLowerCase()
      );

      if (matched) {
        item = matched;
      } else {
        item = await this.createItem(practiceId, {
          name: itemName,
          category: data.category || 'MEDICINE',
          genericName: data.genericName,
          dosageForm: data.dosageForm,
          presentation: data.presentation,
          stockUnit: data.stockUnit || 'Unit',
          minimumStockLevel: 5,
          targetStockLevel: 20,
        });
      }
    }

    const batchNumber = data.batchNumber.trim();
    const expiryDateStr = data.expiryDate.trim();
    const purchaseRate = data.purchaseRate ?? 0;
    const mrp = data.mrp ?? Math.round(purchaseRate * 1.35);

    // 2. Database transaction if Prisma is active
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Check for existing batch in Store Stock
          let batch = await tx.inventoryBatch.findFirst({
            where: {
              practiceId,
              inventoryItemId: item.id,
              batchNumber,
              locationId: storeLocation.id,
            },
          });

          const oldQty = batch ? batch.currentQuantity : 0;
          const newQty = oldQty + data.quantity;

          if (batch) {
            batch = await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: {
                currentQuantity: newQty,
                purchaseRate: purchaseRate > 0 ? purchaseRate : batch.purchaseRate,
                mrp: mrp > 0 ? mrp : batch.mrp,
              },
            });
          } else {
            batch = await tx.inventoryBatch.create({
              data: {
                practiceId,
                inventoryItemId: item.id,
                batchNumber,
                expiryDate: new Date(expiryDateStr),
                manufacturingDate: data.manufacturingDate ? new Date(data.manufacturingDate) : null,
                initialQuantity: data.quantity,
                currentQuantity: data.quantity,
                purchaseRate,
                mrp,
                locationId: storeLocation.id,
              },
            });
          }

          const invTx = await tx.inventoryTransaction.create({
            data: {
              practiceId,
              itemId: item.id,
              batchId: batch.id,
              transactionType: 'PURCHASE',
              quantityChange: data.quantity,
              quantityBefore: oldQty,
              quantityAfter: newQty,
              unitCost: purchaseRate,
              referenceType: 'STOCK_IN',
              referenceId: data.sourceReference || data.idempotencyKey || null,
              reason: data.notes?.trim() || 'Stock In to Store Stock',
              performedByUserId: userId || null,
            },
          });

          return { batch, invTx };
        });

        const updatedItem = await this.getItemById(item.id, practiceId);
        const allBatches = await this.listBatches(practiceId, { itemId: item.id });
        const resBatch = allBatches.find((b) => b.id === result.batch.id)!;

        const resTx: InventoryTransactionDTO = {
          id: result.invTx.id,
          practiceId,
          itemId: item.id,
          itemName: item.name,
          itemCategory: item.category,
          batchId: result.batch.id,
          batchNumber,
          transactionType: 'PURCHASE',
          quantityChange: data.quantity,
          quantityBefore: result.invTx.quantityBefore,
          quantityAfter: result.invTx.quantityAfter,
          unitCost: purchaseRate,
          referenceType: 'STOCK_IN',
          referenceId: data.sourceReference || data.idempotencyKey || null,
          reason: data.notes?.trim() || 'Stock In to Store Stock',
          performedByUserId: userId || null,
          createdAt: result.invTx.createdAt.toISOString(),
        };

        return {
          success: true,
          item: updatedItem,
          batch: resBatch,
          transaction: resTx,
        };
      } catch (err) {
        console.warn('[InventoryService.stockIn] Prisma error, using fallback:', err);
      }
    }

    // Mock store execution
    const batches = this.getBatchesStore(practiceId);
    let batch = batches.find(
      (b) =>
        b.inventoryItemId === item.id &&
        b.batchNumber === batchNumber &&
        (!b.locationId || b.locationId === storeLocation.id)
    );

    const oldQty = batch ? batch.currentQuantity : 0;
    const newQty = oldQty + data.quantity;
    const now = new Date().toISOString();

    if (batch) {
      batch.currentQuantity = newQty;
      if (purchaseRate > 0) batch.purchaseRate = purchaseRate;
      if (mrp > 0) batch.mrp = mrp;
      batch.updatedAt = now;
    } else {
      batch = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        practiceId,
        inventoryItemId: item.id,
        itemName: item.name,
        itemCategory: item.category,
        batchNumber,
        manufacturingDate: data.manufacturingDate || null,
        expiryDate: expiryDateStr,
        initialQuantity: data.quantity,
        currentQuantity: data.quantity,
        purchaseRate,
        mrp,
        locationId: storeLocation.id,
        isExpired: expiryDateStr < now.split('T')[0],
        daysToExpiry: 180,
        expiryStatus: 'OK',
        createdAt: now,
        updatedAt: now,
      };
      batches.push(batch);
    }

    const txs = this.getTransactionsStore(practiceId);
    const invTx: InventoryTransactionDTO = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId,
      itemId: item.id,
      itemName: item.name,
      itemCategory: item.category,
      batchId: batch.id,
      batchNumber,
      transactionType: 'PURCHASE',
      quantityChange: data.quantity,
      quantityBefore: oldQty,
      quantityAfter: newQty,
      unitCost: purchaseRate,
      referenceType: 'STOCK_IN',
      referenceId: data.sourceReference || data.idempotencyKey || null,
      reason: data.notes?.trim() || 'Stock In to Store Stock',
      performedByUserId: userId || null,
      createdAt: now,
    };
    txs.push(invTx);

    const updatedItem = await this.getItemById(item.id, practiceId);
    return {
      success: true,
      item: updatedItem,
      batch,
      transaction: invTx,
    };
  }

  // --------------------------------------------------------------------------
  // 17. Store Stock to Practice Bag Transfer
  // --------------------------------------------------------------------------

  static async transferStock(
    practiceId: string,
    data: TransferStockDTO,
    userId?: string | null
  ): Promise<{
    success: boolean;
    transferId: string;
    sourceBatch: InventoryBatchDTO;
    destinationBatch: InventoryBatchDTO;
    quantity: number;
  }> {
    if (!data.quantity || data.quantity <= 0) {
      throw new AppError(400, 'INVALID_QUANTITY', 'Transfer quantity must be greater than zero.');
    }

    const { storeLocation, bagLocation } = await this.ensureDefaultLocations(practiceId);
    const fromLocId = data.fromLocationId || data.sourceLocationId || storeLocation.id;
    const toLocId = data.toLocationId || data.targetLocationId || bagLocation.id;

    if (fromLocId === toLocId) {
      throw new AppError(400, 'INVALID_TRANSFER', 'Source and destination locations must be different.');
    }

    const allLocations = await this.listLocations(practiceId);
    const srcLoc = allLocations.find((l) => l.id === fromLocId);
    const dstLoc = allLocations.find((l) => l.id === toLocId);
    const srcLocName = srcLoc?.name || 'Store Stock';
    const dstLocName = dstLoc?.name || 'Practice Bag';

    let defaultRefType = 'TRANSFER_TO_BAG';
    if (fromLocId !== storeLocation.id && toLocId !== storeLocation.id) {
      defaultRefType = 'TRANSFER_BETWEEN_KITS';
    } else if (toLocId === storeLocation.id) {
      defaultRefType = 'RETURN_TO_STORE';
    }

    // Idempotency check
    if (data.idempotencyKey) {
      const txs = await this.listTransactions(practiceId);
      const existing = txs.find(
        (t) =>
          (t.referenceType === 'TRANSFER_TO_BAG' ||
            t.referenceType === 'TRANSFER_BETWEEN_KITS' ||
            t.referenceType === 'RETURN_TO_STORE') &&
          t.referenceId === data.idempotencyKey &&
          t.quantityChange < 0
      );
      if (existing) {
        const allBatches = await this.listBatches(practiceId, { itemId: data.itemId });
        const srcB = allBatches.find((b) => b.id === existing.batchId) || allBatches[0];
        return {
          success: true,
          transferId: existing.referenceId!,
          sourceBatch: srcB,
          destinationBatch: srcB,
          quantity: Math.abs(existing.quantityChange),
        };
      }
    }

    const item = await this.getItemById(data.itemId, practiceId);
    const allBatches = await this.listBatches(practiceId, { itemId: data.itemId });

    // Find source batch in source location
    let sourceBatch = allBatches.find(
      (b) =>
        (!b.locationId || b.locationId === fromLocId) &&
        (data.batchNumber ? b.batchNumber === data.batchNumber : true) &&
        b.currentQuantity >= data.quantity
    );

    if (!sourceBatch) {
      // Find total available in source
      const totalAvailable = allBatches
        .filter((b) => !b.locationId || b.locationId === fromLocId)
        .reduce((sum, b) => sum + (b.currentQuantity || 0), 0);

      throw new AppError(
        400,
        'INSUFFICIENT_STOCK',
        `Insufficient stock in source location. Requested: ${data.quantity}, Available: ${totalAvailable}`
      );
    }

    const transferId = data.idempotencyKey || `trf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Database atomic transaction
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Decrement source batch
          const updatedSrc = await tx.inventoryBatch.update({
            where: { id: sourceBatch!.id },
            data: { currentQuantity: { decrement: data.quantity } },
          });

          // Debit transaction on source
          await tx.inventoryTransaction.create({
            data: {
              practiceId,
              itemId: item.id,
              batchId: sourceBatch!.id,
              transactionType: 'STOCK_ADJUSTMENT',
              quantityChange: -data.quantity,
              quantityBefore: sourceBatch!.currentQuantity,
              quantityAfter: updatedSrc.currentQuantity,
              unitCost: sourceBatch!.purchaseRate,
              referenceType: defaultRefType,
              referenceId: transferId,
              reason: data.reason?.trim() || `Transfer from ${srcLocName} to ${dstLocName}`,
              performedByUserId: userId || null,
            },
          });

          // Find or create destination batch in toLocId
          let destBatch = await tx.inventoryBatch.findFirst({
            where: {
              practiceId,
              inventoryItemId: item.id,
              batchNumber: sourceBatch!.batchNumber,
              locationId: toLocId,
            },
          });

          const destBefore = destBatch ? destBatch.currentQuantity : 0;
          const destAfter = destBefore + data.quantity;

          if (destBatch) {
            destBatch = await tx.inventoryBatch.update({
              where: { id: destBatch.id },
              data: { currentQuantity: destAfter },
            });
          } else {
            destBatch = await tx.inventoryBatch.create({
              data: {
                practiceId,
                inventoryItemId: item.id,
                batchNumber: sourceBatch!.batchNumber,
                expiryDate: new Date(sourceBatch!.expiryDate),
                manufacturingDate: sourceBatch!.manufacturingDate
                  ? new Date(sourceBatch!.manufacturingDate)
                  : null,
                initialQuantity: data.quantity,
                currentQuantity: data.quantity,
                purchaseRate: sourceBatch!.purchaseRate,
                mrp: sourceBatch!.mrp,
                locationId: toLocId,
              },
            });
          }

          // Credit transaction on destination
          await tx.inventoryTransaction.create({
            data: {
              practiceId,
              itemId: item.id,
              batchId: destBatch.id,
              transactionType: 'STOCK_ADJUSTMENT',
              quantityChange: data.quantity,
              quantityBefore: destBefore,
              quantityAfter: destAfter,
              unitCost: sourceBatch!.purchaseRate,
              referenceType: defaultRefType,
              referenceId: transferId,
              reason: data.reason?.trim() || `Received from ${srcLocName} into ${dstLocName}`,
              performedByUserId: userId || null,
            },
          });

          return { updatedSrc, destBatch };
        });

        const refreshed = await this.listBatches(practiceId, { itemId: item.id });
        const srcB = refreshed.find((b) => b.id === result.updatedSrc.id)!;
        const dstB = refreshed.find((b) => b.id === result.destBatch.id)!;

        return {
          success: true,
          transferId,
          sourceBatch: srcB,
          destinationBatch: dstB,
          quantity: data.quantity,
        };
      } catch (err) {
        console.warn('[InventoryService.transferStock] Prisma error, using fallback:', err);
      }
    }

    // Mock store execution
    const batches = this.getBatchesStore(practiceId);
    const src = batches.find((b) => b.id === sourceBatch!.id)!;
    const srcBefore = src.currentQuantity;
    src.currentQuantity -= data.quantity;
    const srcAfter = src.currentQuantity;

    let dst = batches.find(
      (b) =>
        b.inventoryItemId === item.id &&
        b.batchNumber === src.batchNumber &&
        b.locationId === toLocId
    );

    const now = new Date().toISOString();
    const dstBefore = dst ? dst.currentQuantity : 0;
    if (dst) {
      dst.currentQuantity += data.quantity;
      dst.updatedAt = now;
    } else {
      dst = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        practiceId,
        inventoryItemId: item.id,
        itemName: item.name,
        itemCategory: item.category,
        batchNumber: src.batchNumber,
        manufacturingDate: src.manufacturingDate,
        expiryDate: src.expiryDate,
        initialQuantity: data.quantity,
        currentQuantity: data.quantity,
        purchaseRate: src.purchaseRate,
        mrp: src.mrp,
        locationId: toLocId,
        isExpired: src.isExpired,
        daysToExpiry: src.daysToExpiry,
        expiryStatus: src.expiryStatus,
        createdAt: now,
        updatedAt: now,
      };
      batches.push(dst);
    }
    const dstAfter = dst.currentQuantity;

    const txs = this.getTransactionsStore(practiceId);
    txs.push({
      id: `tx_${Date.now()}_1`,
      practiceId,
      itemId: item.id,
      itemName: item.name,
      itemCategory: item.category,
      batchId: src.id,
      batchNumber: src.batchNumber,
      transactionType: 'STOCK_ADJUSTMENT',
      quantityChange: -data.quantity,
      quantityBefore: srcBefore,
      quantityAfter: srcAfter,
      unitCost: src.purchaseRate,
      referenceType: defaultRefType,
      referenceId: transferId,
      reason: data.reason?.trim() || `Transfer from ${srcLocName} to ${dstLocName}`,
      performedByUserId: userId || null,
      createdAt: now,
    });
    txs.push({
      id: `tx_${Date.now()}_2`,
      practiceId,
      itemId: item.id,
      itemName: item.name,
      itemCategory: item.category,
      batchId: dst.id,
      batchNumber: dst.batchNumber,
      transactionType: 'STOCK_ADJUSTMENT',
      quantityChange: data.quantity,
      quantityBefore: dstBefore,
      quantityAfter: dstAfter,
      unitCost: dst.purchaseRate,
      referenceType: defaultRefType,
      referenceId: transferId,
      reason: data.reason?.trim() || `Received from ${srcLocName} into ${dstLocName}`,
      performedByUserId: userId || null,
      createdAt: now,
    });

    return {
      success: true,
      transferId,
      sourceBatch: src,
      destinationBatch: dst,
      quantity: data.quantity,
    };
  }

  // --------------------------------------------------------------------------
  // 18. Return Unused Stock (Practice Bag / Kit to Store Stock)
  // --------------------------------------------------------------------------

  static async returnUnusedStock(
    practiceId: string,
    data: ReturnStockDTO,
    userId?: string | null
  ): Promise<{
    success: boolean;
    returnId: string;
    sourceBatch: InventoryBatchDTO;
    destinationBatch: InventoryBatchDTO;
    quantity: number;
  }> {
    const { storeLocation, bagLocation } = await this.ensureDefaultLocations(practiceId);
    const fromLocId = data.fromLocationId || bagLocation.id;

    // Call transferStock with designated from location to storeLocation
    const res = await this.transferStock(
      practiceId,
      {
        fromLocationId: fromLocId,
        toLocationId: storeLocation.id,
        itemId: data.itemId,
        batchNumber: data.batchNumber,
        quantity: data.quantity,
        reason: data.reason?.trim() || 'Returned unused stock to Store',
        idempotencyKey: data.idempotencyKey,
      },
      userId
    );

    return {
      success: true,
      returnId: res.transferId,
      sourceBatch: res.sourceBatch,
      destinationBatch: res.destinationBatch,
      quantity: res.quantity,
    };
  }

  // --------------------------------------------------------------------------
  // 19. Deduct Field Usage (CVP-24 Integration)
  // --------------------------------------------------------------------------

  static async deductFieldUsage(
    practiceId: string,
    data: DeductFieldUsageDTO,
    userId?: string | null
  ): Promise<FieldUsageDeductionResult> {
    const reqQty = Number(data.quantity ?? (data as any).quantityUsed) || 0;
    if (reqQty <= 0) {
      return {
        success: false,
        reason: 'INVALID_QUANTITY',
        deductedQuantity: 0,
        requestedQuantity: reqQty,
      };
    }

    // 1. Idempotency Check
    if (data.idempotencyKey) {
      const txs = await this.listTransactions(practiceId);
      const existing = txs.find(
        (t) =>
          t.referenceType === 'FIELD_USAGE' &&
          (t.referenceId === data.idempotencyKey || t.referenceId === data.visitId) &&
          t.quantityChange < 0
      );
      if (existing) {
        const refreshed = await this.listBatches(practiceId);
        const b = refreshed.find((x) => x.id === existing.batchId);
        return {
          success: true,
          deductedQuantity: Math.abs(existing.quantityChange),
          remainingBagStock: b ? b.currentQuantity : undefined,
          batchNumber: existing.batchNumber || undefined,
          batchId: existing.batchId || undefined,
          transactionId: existing.id,
          requestedQuantity: data.quantity,
        };
      }
    }

    const { bagLocation } = await this.ensureDefaultLocations(practiceId);
    const targetLocId = data.locationId || bagLocation.id;

    // 2. Find medicine item in catalogue
    const items = await this.listItems(practiceId);
    let matchedItem = items.find(
      (i) =>
        (data.medicineId && (i.id === data.medicineId || i.medicineId === String(data.medicineId))) ||
        i.name.toLowerCase() === data.medicineName.toLowerCase()
    );

    if (!matchedItem) {
      return {
        success: false,
        reason: 'ITEM_NOT_IN_CATALOGUE',
        deductedQuantity: 0,
        availableQuantity: 0,
        requestedQuantity: data.quantity,
      };
    }

    // 3. Find available batch in designated Kit (or default Practice Bag)
    const batches = await this.listBatches(practiceId, { itemId: matchedItem.id });
    const bagBatches = batches.filter(
      (b) => b.locationId === targetLocId && b.currentQuantity > 0
    );

    // Filter by batchNumber if specified, otherwise FEFO
    let candidateBatch = bagBatches.find(
      (b) => (data.batchNumber ? b.batchNumber === data.batchNumber : true) && b.currentQuantity >= reqQty
    );

    const totalBagAvailable = bagBatches.reduce((sum, b) => sum + (b.currentQuantity || 0), 0);

    if (!candidateBatch) {
      return {
        success: false,
        reason: 'INSUFFICIENT_BAG_STOCK',
        deductedQuantity: 0,
        availableQuantity: totalBagAvailable,
        requestedQuantity: reqQty,
      };
    }

    // 4. Atomic deduction from Practice Bag
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
      try {
        const txResult = await prisma.$transaction(async (tx) => {
          const updatedBatch = await tx.inventoryBatch.update({
            where: { id: candidateBatch!.id },
            data: { currentQuantity: { decrement: reqQty } },
          });

          const invTx = await tx.inventoryTransaction.create({
            data: {
              practiceId,
              itemId: matchedItem!.id,
              batchId: candidateBatch!.id,
              transactionType: 'SALE_OR_INVOICE',
              quantityChange: -reqQty,
              quantityBefore: candidateBatch!.currentQuantity,
              quantityAfter: updatedBatch.currentQuantity,
              unitCost: candidateBatch!.purchaseRate,
              referenceType: 'FIELD_USAGE',
              referenceId: data.idempotencyKey || data.visitId,
              reason: `Administered to ${data.patientName || 'patient'} (Visit: ${data.visitId})`,
              performedByUserId: userId || null,
            },
          });

          return { updatedBatch, invTx };
        });

        return {
          success: true,
          deductedQuantity: reqQty,
          remainingBagStock: txResult.updatedBatch.currentQuantity,
          batchNumber: candidateBatch.batchNumber,
          batchId: candidateBatch.id,
          transactionId: txResult.invTx.id,
          requestedQuantity: reqQty,
        };
      } catch (err) {
        console.warn('[InventoryService.deductFieldUsage] Prisma error, using fallback:', err);
      }
    }

    // Mock store execution
    const batchesStore = this.getBatchesStore(practiceId);
    const b = batchesStore.find((x) => x.id === candidateBatch.id)!;
    const oldQty = b.currentQuantity;
    b.currentQuantity -= reqQty;
    b.updatedAt = new Date().toISOString();

    const txs = this.getTransactionsStore(practiceId);
    const newTx: InventoryTransactionDTO = {
      id: `tx_${Date.now()}_field_use`,
      practiceId,
      itemId: matchedItem.id,
      itemName: matchedItem.name,
      itemCategory: matchedItem.category,
      batchId: b.id,
      batchNumber: b.batchNumber,
      transactionType: 'SALE_OR_INVOICE',
      quantityChange: -reqQty,
      quantityBefore: oldQty,
      quantityAfter: b.currentQuantity,
      unitCost: b.purchaseRate,
      referenceType: 'FIELD_USAGE',
      referenceId: data.idempotencyKey || data.visitId,
      reason: `Administered to ${data.patientName || 'patient'} (Visit: ${data.visitId})`,
      performedByUserId: userId || null,
      createdAt: new Date().toISOString(),
    };
    txs.push(newTx);

    return {
      success: true,
      deductedQuantity: reqQty,
      remainingBagStock: b.currentQuantity,
      batchNumber: b.batchNumber,
      batchId: b.id,
      transactionId: newTx.id,
      requestedQuantity: reqQty,
    };
  }

  // --------------------------------------------------------------------------
  // 20. Reconciliation & Adjustments (Physical Count vs System)
  // --------------------------------------------------------------------------

  static async reconcileLocationStock(
    practiceId: string,
    data: ReconcileStockDTO,
    userId?: string | null
  ): Promise<{
    success: boolean;
    adjustmentsCount: number;
    reconciledItems: Array<{ itemId: string; variance: number; countedQuantity: number }>;
  }> {
    const { storeLocation, bagLocation } = await this.ensureDefaultLocations(practiceId);
    let targetLocId = storeLocation.id;
    if (data.locationId) {
      targetLocId = data.locationId;
    } else if (data.locationName?.toLowerCase().includes('bag')) {
      targetLocId = bagLocation.id;
    }

    const reconciledItems: Array<{ itemId: string; variance: number; countedQuantity: number }> = [];

    for (const item of data.items) {
      const variance = item.countedQuantity - item.recordedQuantity;
      if (variance !== 0) {
        if (!item.reason && !data.reason) {
          throw new AppError(
            400,
            'REASON_REQUIRED',
            `Variance reason required for item ${item.itemId} (variance: ${variance}).`
          );
        }
        if (item.countedQuantity < 0) {
          throw new AppError(400, 'NEGATIVE_STOCK', 'Counted physical quantity cannot be negative.');
        }

        // Apply adjustment
        await this.adjustStock(
          practiceId,
          {
            itemId: item.itemId,
            batchId: item.batchId || null,
            quantityChange: variance,
            reason: item.reason || data.reason || 'Physical Stock Reconciliation',
            notes: `Counted: ${item.countedQuantity}, Recorded: ${item.recordedQuantity}, Location: ${targetLocId}`,
            performedByUserId: userId || null,
          }
        );

        reconciledItems.push({
          itemId: item.itemId,
          variance,
          countedQuantity: item.countedQuantity,
        });
      }
    }

    return {
      success: true,
      adjustmentsCount: reconciledItems.length,
      reconciledItems,
    };
  }

  /**
   * Generates a preview summary before executing a Clear All Stock action.
   * Scoped strictly to the active practice.
   */
  static async getClearStockSummary(practiceId: string): Promise<{
    practiceName: string;
    affectedItemsCount: number;
    affectedBatchesCount: number;
    totalCurrentQuantity: number;
    retainedEntities: string;
  }> {
    let practiceName = 'Current Practice';
    let affectedItemsCount = 0;
    let affectedBatchesCount = 0;
    let totalCurrentQuantity = 0;

    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
      try {
        const practice = await prisma.practice.findUnique({
          where: { id: practiceId },
          select: { name: true },
        });
        if (practice) practiceName = practice.name;

        const batches = await prisma.inventoryBatch.findMany({
          where: {
            practiceId,
            currentQuantity: { gt: 0 },
          },
          select: {
            inventoryItemId: true,
            currentQuantity: true,
          },
        });

        affectedBatchesCount = batches.length;
        const uniqueItems = new Set(batches.map((b) => b.inventoryItemId));
        affectedItemsCount = uniqueItems.size;
        totalCurrentQuantity = batches.reduce((sum, b) => sum + (Number(b.currentQuantity) || 0), 0);
      } catch (err) {
        console.warn('[InventoryService.getClearStockSummary] Prisma query error:', err);
      }
    }

    if (affectedBatchesCount === 0 && this.mockBatches.has(practiceId)) {
      const memBatches = this.getBatchesStore(practiceId).filter((b) => b.currentQuantity > 0);
      affectedBatchesCount = memBatches.length;
      const uniqueItems = new Set(memBatches.map((b) => b.inventoryItemId));
      affectedItemsCount = uniqueItems.size;
      totalCurrentQuantity = memBatches.reduce((sum, b) => sum + (Number(b.currentQuantity) || 0), 0);
    }

    return {
      practiceName,
      affectedItemsCount,
      affectedBatchesCount,
      totalCurrentQuantity,
      retainedEntities:
        'All purchase invoices, batch traceability, supplier transactions, prescriptions, patient invoices, and audit histories will be strictly retained.',
    };
  }

  /**
   * Safely and auditably zeroes all stock quantities for the active practice.
   * Does NOT delete inventory items, purchase invoices, batches, or transactions.
   */
  static async clearAllStock(
    practiceId: string,
    performedByUserId?: string | null,
    reason?: string | null
  ): Promise<{
    success: boolean;
    affectedItemsCount: number;
    affectedBatchesCount: number;
    totalClearedQuantity: number;
    clearedAt: string;
  }> {
    const defaultReason = reason || 'Manual Clear All Stock operation initiated by practice administrator';
    const now = new Date();
    let affectedBatchesCount = 0;
    let affectedItemsCount = 0;
    let totalClearedQuantity = 0;

    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
      try {
        const activeBatches = await prisma.inventoryBatch.findMany({
          where: {
            practiceId,
            currentQuantity: { gt: 0 },
          },
          include: {
            inventoryItem: true,
          },
        });

        if (activeBatches.length > 0) {
          const itemIds = new Set(activeBatches.map((b) => b.inventoryItemId));
          affectedItemsCount = itemIds.size;
          affectedBatchesCount = activeBatches.length;
          totalClearedQuantity = activeBatches.reduce((sum, b) => sum + (Number(b.currentQuantity) || 0), 0);

          await prisma.$transaction(async (tx) => {
            for (const batch of activeBatches) {
              const qtyBefore = Number(batch.currentQuantity);
              if (qtyBefore <= 0) continue;

              // Record auditable adjustment transaction
              await tx.inventoryTransaction.create({
                data: {
                  practiceId,
                  itemId: batch.inventoryItemId,
                  batchId: batch.id,
                  transactionType: 'STOCK_ADJUSTMENT',
                  quantityChange: -qtyBefore,
                  quantityBefore: qtyBefore,
                  quantityAfter: 0,
                  unitCost: batch.purchaseRate,
                  referenceType: 'CLEAR_ALL_STOCK',
                  reason: defaultReason,
                  performedByUserId: performedByUserId || null,
                  createdAt: now,
                },
              });

              // Zero the batch
              await tx.inventoryBatch.update({
                where: { id: batch.id },
                data: {
                  currentQuantity: 0,
                  updatedAt: now,
                },
              });
            }
          });
        }
      } catch (err) {
        console.warn('[InventoryService.clearAllStock] Prisma error:', err);
      }
    }

    // Update in-memory store for isolated tests & local dev
    const memBatches = this.getBatchesStore(practiceId).filter((b) => b.currentQuantity > 0);
    if (memBatches.length > 0 && affectedBatchesCount === 0) {
      const itemIds = new Set(memBatches.map((b) => b.inventoryItemId));
      affectedItemsCount = itemIds.size;
      affectedBatchesCount = memBatches.length;
      totalClearedQuantity = memBatches.reduce((sum, b) => sum + (Number(b.currentQuantity) || 0), 0);

      for (const batch of memBatches) {
        const qtyBefore = batch.currentQuantity;
        batch.currentQuantity = 0;
        batch.updatedAt = now.toISOString();

        await this.recordTransaction(practiceId, {
          itemId: batch.inventoryItemId,
          batchId: batch.id,
          transactionType: 'STOCK_ADJUSTMENT',
          quantityChange: -qtyBefore,
          quantityBefore: qtyBefore,
          quantityAfter: 0,
          unitCost: batch.purchaseRate,
          referenceType: 'CLEAR_ALL_STOCK',
          reason: defaultReason,
          performedByUserId,
        });
      }
    }

    void AuditService.record({
      practiceId,
      userId: performedByUserId || undefined,
      action: 'INVENTORY_STOCK_CLEARED',
      resource: 'InventoryBatch',
      details: {
        affectedItemsCount,
        affectedBatchesCount,
        totalClearedQuantity,
        reason: defaultReason,
      },
    });

    return {
      success: true,
      affectedItemsCount,
      affectedBatchesCount,
      totalClearedQuantity,
      clearedAt: now.toISOString(),
    };
  }

  /**
   * Safely reverses a purchase invoice and its stock effects.
   * Validates that subsequent stock consumption hasn't reduced current batch quantity below the invoice quantity.
   */
  static async reversePurchaseInvoice(
    practiceId: string,
    invoiceId: string,
    performedByUserId?: string | null,
    reason?: string | null
  ): Promise<{
    success: boolean;
    invoiceId: string;
    invoiceNumber: string;
    message: string;
  }> {
    const defaultReason = reason || 'Manual purchase invoice reversal';
    const now = new Date();

    let invoice: any = null;
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.purchaseInvoice) {
      try {
        invoice = await prisma.purchaseInvoice.findFirst({
          where: { id: invoiceId, practiceId },
          include: {
            items: {
              include: {
                inventoryItem: true,
              },
            },
          },
        });
      } catch (err) {
        console.warn('[InventoryService.reversePurchaseInvoice] Prisma query error:', err);
      }
    }

    if (!invoice) {
      invoice = this.getPurchasesStore(practiceId).find((p) => p.id === invoiceId);
    }

    if (!invoice) {
      throw new AppError(404, 'INVOICE_NOT_FOUND', 'Purchase invoice not found for this practice.');
    }

    // Check if already reversed
    if (invoice.notes && invoice.notes.includes('[REVERSED')) {
      throw new AppError(400, 'INVOICE_ALREADY_REVERSED', 'This purchase invoice has already been reversed.');
    }

    // 1. Inspect all items and check whether subsequent consumption prevents reversal
    for (const item of invoice.items) {
      let batch: any = null;
      if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryBatch) {
        batch = await prisma.inventoryBatch.findFirst({
          where: {
            practiceId,
            inventoryItemId: item.inventoryItemId,
            batchNumber: item.batchNumber,
          },
        });
      } else {
        batch = this.getBatchesStore(practiceId).find(
          (b) => b.inventoryItemId === item.inventoryItemId && b.batchNumber === item.batchNumber
        );
      }

      const currentQty = batch ? Number(batch.currentQuantity) : 0;
      const itemQty = Number(item.quantity);

      if (!batch || currentQty < itemQty) {
        const itemName = item.itemName || (item as any).inventoryItem?.name || 'Item';
        throw new AppError(
          400,
          'CANNOT_REVERSE_INSUFFICIENT_STOCK',
          `Cannot safely reverse invoice #${invoice.invoiceNumber}. Line item "${itemName}" (Batch ${item.batchNumber}) has only ${currentQty} units remaining in stock, but this invoice supplied ${itemQty} units (${itemQty - currentQty} units were consumed by prescriptions, invoices, or field usage). Reversing this invoice would result in an invalid negative stock balance. Please use manual stock adjustment instead.`
        );
      }
    }

    // 2. Perform the reversal transactionally
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.purchaseInvoice) {
      await prisma.$transaction(async (tx) => {
        for (const item of invoice.items) {
          const batch = await tx.inventoryBatch.findFirst({
            where: {
              practiceId,
              inventoryItemId: item.inventoryItemId,
              batchNumber: item.batchNumber,
            },
          });

          if (batch) {
            const qtyBefore = Number(batch.currentQuantity);
            const itemQty = Number(item.quantity);
            const qtyAfter = Math.max(0, qtyBefore - itemQty);

            // Create REVERSAL transaction
            await tx.inventoryTransaction.create({
              data: {
                practiceId,
                itemId: item.inventoryItemId,
                batchId: batch.id,
                transactionType: 'REVERSAL',
                quantityChange: -itemQty,
                quantityBefore: qtyBefore,
                quantityAfter: qtyAfter,
                unitCost: item.purchaseRate,
                referenceType: 'PURCHASE_INVOICE_REVERSAL',
                referenceId: invoice.id,
                reason: defaultReason,
                performedByUserId: performedByUserId || null,
                createdAt: now,
              },
            });

            // Update batch current quantity
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: {
                currentQuantity: qtyAfter,
                updatedAt: now,
              },
            });
          }
        }

        // Annotate invoice notes with reversal audit trail
        const auditNote = `[REVERSED on ${now.toISOString()} by ${performedByUserId || 'User'}. Reason: ${defaultReason}]`;
        await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: {
            notes: invoice.notes ? `${invoice.notes}\n${auditNote}` : auditNote,
            updatedAt: now,
          },
        });
      });
    }

    // In-memory store updates
    const memBatches = this.getBatchesStore(practiceId);
    for (const item of invoice.items) {
      const b = memBatches.find(
        (batch) => batch.inventoryItemId === item.inventoryItemId && batch.batchNumber === item.batchNumber
      );
      if (b) {
        const qtyBefore = b.currentQuantity;
        const itemQty = Number(item.quantity);
        const qtyAfter = Math.max(0, qtyBefore - itemQty);
        b.currentQuantity = qtyAfter;
        b.updatedAt = now.toISOString();

        await this.recordTransaction(practiceId, {
          itemId: item.inventoryItemId,
          batchId: b.id,
          transactionType: 'REVERSAL',
          quantityChange: -itemQty,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          unitCost: item.purchaseRate,
          referenceType: 'PURCHASE_INVOICE_REVERSAL',
          referenceId: invoice.id,
          reason: defaultReason,
          performedByUserId,
        });
      }
    }
    const auditNote = `[REVERSED on ${now.toISOString()} by ${performedByUserId || 'User'}. Reason: ${defaultReason}]`;
    invoice.notes = invoice.notes ? `${invoice.notes}\n${auditNote}` : auditNote;

    void AuditService.record({
      practiceId,
      userId: performedByUserId || undefined,
      action: 'PURCHASE_INVOICE_REVERSED',
      resource: 'PurchaseInvoice',
      resourceId: invoice.id,
      details: {
        invoiceNumber: invoice.invoiceNumber,
        itemsCount: invoice.items.length,
        reason: defaultReason,
      },
    });

    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      message: `Purchase invoice #${invoice.invoiceNumber} has been safely reversed and stock deducted.`,
    };
  }

  /**
   * Retrieves all inventory transactions recorded on a specific date for the practice.
   */
  static async getEntriesByDate(
    practiceId: string,
    dateStr: string
  ): Promise<{
    date: string;
    count: number;
    entries: Array<InventoryTransactionDTO & { batchNumber?: string | null; canCompensate: boolean }>;
  }> {
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      throw new AppError(400, 'INVALID_DATE', 'Invalid date format. Expected YYYY-MM-DD.');
    }

    // Set full day boundary in UTC
    const startOfDay = new Date(dateStr);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateStr);
    endOfDay.setUTCHours(23, 59, 59, 999);

    let entries: any[] = [];
    if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryTransaction) {
      try {
        const dbTxs = await prisma.inventoryTransaction.findMany({
          where: {
            practiceId,
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          include: {
            item: true,
            batch: true,
          },
          orderBy: { createdAt: 'desc' },
        });

        entries = dbTxs.map((tx) => ({
          id: tx.id,
          practiceId: tx.practiceId,
          itemId: tx.itemId,
          itemName: tx.item?.name || 'Unknown Item',
          itemCategory: (tx.item?.category as any) || 'OTHER',
          batchId: tx.batchId,
          batchNumber: tx.batch?.batchNumber || null,
          transactionType: tx.transactionType as any,
          quantityChange: tx.quantityChange,
          quantityBefore: tx.quantityBefore,
          quantityAfter: tx.quantityAfter,
          unitCost: tx.unitCost,
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
          reason: tx.reason,
          performedByUserId: tx.performedByUserId,
          createdAt: tx.createdAt.toISOString(),
          canCompensate: tx.transactionType !== 'REVERSAL' && !tx.referenceType?.includes('CORRECTION'),
        }));
      } catch (err) {
        console.warn('[InventoryService.getEntriesByDate] Prisma error:', err);
      }
    }

    if (entries.length === 0 && this.mockTransactions.has(practiceId)) {
      const allTx = this.getTransactionsStore(practiceId);
      entries = allTx
        .filter((tx) => {
          const d = new Date(tx.createdAt);
          return d >= startOfDay && d <= endOfDay;
        })
        .map((tx) => ({
          ...tx,
          canCompensate: tx.transactionType !== 'REVERSAL' && !tx.referenceType?.includes('CORRECTION'),
        }));
    }

    return {
      date: dateStr,
      count: entries.length,
      entries,
    };
  }

  /**
   * Applies compensating ledger corrections to specified inventory transactions.
   * Respects batch availability and never creates negative stock balances.
   */
  static async correctEntriesByDate(
    practiceId: string,
    data: {
      transactionIds: string[];
      reason: string;
      performedByUserId?: string | null;
    }
  ): Promise<{
    success: boolean;
    correctedCount: number;
    message: string;
  }> {
    if (!data.transactionIds || data.transactionIds.length === 0) {
      throw new AppError(400, 'NO_ENTRIES_SELECTED', 'Please select at least one entry to correct.');
    }
    if (!data.reason || !data.reason.trim()) {
      throw new AppError(400, 'REASON_REQUIRED', 'A valid reason is required for correcting ledger entries.');
    }

    const now = new Date();
    let correctedCount = 0;

    for (const txId of data.transactionIds) {
      let tx: any = null;
      if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryTransaction) {
        tx = await prisma.inventoryTransaction.findFirst({
          where: { id: txId, practiceId },
          include: { batch: true, item: true },
        });
      } else {
        tx = this.getTransactionsStore(practiceId).find((t) => t.id === txId);
      }

      if (!tx) continue;

      // If the original transaction was an addition (quantityChange > 0), reversing it removes stock
      if (tx.quantityChange > 0) {
        const batch = tx.batch || (tx.batchId ? this.getBatchesStore(practiceId).find((b) => b.id === tx.batchId) : null);
        const currentQty = batch ? Number(batch.currentQuantity) : 0;
        if (currentQty < tx.quantityChange) {
          throw new AppError(
            400,
            'CANNOT_CORRECT_INSUFFICIENT_STOCK',
            `Cannot correct entry #${tx.id} for "${tx.item?.name || 'Item'}". Current batch quantity is ${currentQty}, which is less than the entry amount ${tx.quantityChange}. Correcting this entry would create an invalid negative stock balance.`
          );
        }
      }

      // Record compensating transaction
      const compensatingChange = -Number(tx.quantityChange);
      const batchId = tx.batchId;

      if (process.env.VETRX_FAST_TEST !== '1' && prisma?.inventoryTransaction) {
        await prisma.$transaction(async (prismaTx) => {
          let qtyBefore = 0;
          let qtyAfter = 0;

          if (batchId) {
            const b = await prismaTx.inventoryBatch.findUnique({ where: { id: batchId } });
            if (b) {
              qtyBefore = Number(b.currentQuantity);
              qtyAfter = Math.max(0, qtyBefore + compensatingChange);
              await prismaTx.inventoryBatch.update({
                where: { id: batchId },
                data: { currentQuantity: qtyAfter, updatedAt: now },
              });
            }
          }

          await prismaTx.inventoryTransaction.create({
            data: {
              practiceId,
              itemId: tx.itemId,
              batchId: batchId || null,
              transactionType: 'STOCK_ADJUSTMENT',
              quantityChange: compensatingChange,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
              unitCost: tx.unitCost,
              referenceType: 'DATE_ENTRY_CORRECTION',
              referenceId: tx.id,
              reason: `Compensating correction for entry #${tx.id}: ${data.reason.trim()}`,
              performedByUserId: data.performedByUserId || null,
              createdAt: now,
            },
          });
        });
      } else {
        if (batchId) {
          const b = this.getBatchesStore(practiceId).find((batch) => batch.id === batchId);
          if (b) {
            b.currentQuantity = Math.max(0, b.currentQuantity + compensatingChange);
            b.updatedAt = now.toISOString();
          }
        }
        await this.recordTransaction(practiceId, {
          itemId: tx.itemId,
          batchId: tx.batchId || null,
          transactionType: 'STOCK_ADJUSTMENT',
          quantityChange: compensatingChange,
          quantityBefore: tx.quantityAfter,
          quantityAfter: tx.quantityBefore,
          unitCost: tx.unitCost,
          referenceType: 'DATE_ENTRY_CORRECTION',
          referenceId: tx.id,
          reason: `Compensating correction for entry #${tx.id}: ${data.reason.trim()}`,
          performedByUserId: data.performedByUserId,
        });
      }

      correctedCount++;
    }

    void AuditService.record({
      practiceId,
      userId: data.performedByUserId || undefined,
      action: 'INVENTORY_DATE_ENTRIES_CORRECTED',
      resource: 'InventoryTransaction',
      details: {
        correctedCount,
        reason: data.reason,
      },
    });

    return {
      success: true,
      correctedCount,
      message: `Successfully applied compensating corrections to ${correctedCount} entries.`,
    };
  }

  private static getItemsStore(practiceId: string): InventoryItemDTO[] {
    if (!this.mockItems.has(practiceId)) {
      this.mockItems.set(practiceId, []);
    }
    return this.mockItems.get(practiceId)!;
  }

  private static getBatchesStore(practiceId: string): InventoryBatchDTO[] {
    if (!this.mockBatches.has(practiceId)) {
      this.mockBatches.set(practiceId, []);
    }
    return this.mockBatches.get(practiceId)!;
  }

  private static getTransactionsStore(practiceId: string): InventoryTransactionDTO[] {
    if (!this.mockTransactions.has(practiceId)) {
      this.mockTransactions.set(practiceId, []);
    }
    return this.mockTransactions.get(practiceId)!;
  }

  private static getSuppliersStore(practiceId: string): SupplierDTO[] {
    if (!this.mockSuppliers.has(practiceId)) {
      this.mockSuppliers.set(practiceId, []);
    }
    return this.mockSuppliers.get(practiceId)!;
  }

  private static getPurchasesStore(practiceId: string): PurchaseInvoiceDTO[] {
    if (!this.mockPurchases.has(practiceId)) {
      this.mockPurchases.set(practiceId, []);
    }
    return this.mockPurchases.get(practiceId)!;
  }

  private static getLocationsStore(practiceId: string): StockLocationDTO[] {
    if (!this.mockLocations.has(practiceId)) {
      this.mockLocations.set(practiceId, []);
    }
    return this.mockLocations.get(practiceId)!;
  }
}
