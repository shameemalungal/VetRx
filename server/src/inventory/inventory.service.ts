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
} from './inventory.types.js';

export class InventoryService {
  // In-memory mock store for fast isolated unit testing & zero-dependency local dev
  private static mockItems: Map<string, InventoryItemDTO[]> = new Map();
  private static mockBatches: Map<string, InventoryBatchDTO[]> = new Map();
  private static mockTransactions: Map<string, InventoryTransactionDTO[]> = new Map();
  private static mockSuppliers: Map<string, SupplierDTO[]> = new Map();
  private static mockPurchases: Map<string, PurchaseInvoiceDTO[]> = new Map();

  static clearMockStore(): void {
    this.mockItems.clear();
    this.mockBatches.clear();
    this.mockTransactions.clear();
    this.mockSuppliers.clear();
    this.mockPurchases.clear();
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
    const items = this.getItemsStore(practiceId);

    const minLevel = data.minimumStockLevel !== undefined ? Number(data.minimumStockLevel) : 5;
    const targetLevel = data.targetStockLevel !== undefined ? Number(data.targetStockLevel) : 20;

    const newItem: InventoryItemDTO = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

    // Create batch
    const newBatch: InventoryBatchDTO = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    const transactions = this.getTransactionsStore(practiceId);
    const items = this.getItemsStore(practiceId);
    const item = items.find((i) => i.id === data.itemId);

    const tx: InventoryTransactionDTO = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId,
      itemId: data.itemId,
      itemName: item?.name || 'Unknown Item',
      itemCategory: item?.category || 'OTHER',
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
      createdAt: new Date().toISOString(),
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
    const batches = this.getBatchesStore(practiceId);

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
    const batches = this.getBatchesStore(practiceId);

    for (const item of items) {
      const batch = item.batchId ? batches.find((b) => b.id === item.batchId) : null;
      if (!batch) continue;

      const physical = Math.max(0, Number(item.physicalQuantity));
      const system = batch.currentQuantity;
      const difference = physical - system;

      if (difference !== 0) {
        batch.currentQuantity = physical;
        batch.updatedAt = new Date().toISOString();

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
    const suppliers = this.getSuppliersStore(practiceId);
    const newSupplier: SupplierDTO = {
      id: `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

    let supplier = this.getSuppliersStore(practiceId).find(
      (s) => s.name.toLowerCase() === supplierName.trim().toLowerCase()
    );
    if (!supplier) {
      supplier = await this.createSupplier(practiceId, {
        name: supplierName.trim(),
        gstin: supplierGstin,
      });
    }

    const purchases = this.getPurchasesStore(practiceId);
    const batches = this.getBatchesStore(practiceId);
    const itemsStore = this.getItemsStore(practiceId);

    const purchaseInvoiceId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let grandTotal = 0;
    const invoiceItems: PurchaseInvoiceDTO['items'] = [];

    // 2. Process each confirmed line item
    for (const itemData of data.items) {
      let inventoryItemId = itemData.matchedItemId;

      // If item is a medicine and user requested creating a new Medicine Master
      if (itemData.category === 'MEDICINE' && itemData.createNewMedicineMaster && !itemData.matchedMedicineId) {
        if (process.env.VETRX_FAST_TEST !== '1') {
          try {
            const newMed = await prisma.medicine.create({
              data: {
                practiceId,
                name: itemData.name.trim(),
                genericName: itemData.genericName || null,
                category: 'Allopathy',
                form: itemData.dosageForm || 'Tablet',
                unitPrice: itemData.purchaseRate,
              },
            });
            itemData.matchedMedicineId = newMed.id;
          } catch {}
        }
      }

      // If no inventory item exists, create InventoryItem master record
      if (!inventoryItemId) {
        const createdItem = await this.createItem(practiceId, {
          category: itemData.category,
          name: itemData.name.trim(),
          genericName: itemData.genericName || null,
          dosageForm: itemData.dosageForm || null,
          packSize: itemData.packSize || null,
          stockUnit: itemData.stockUnit || 'Unit',
          presentation: itemData.presentation || null,
          minimumStockLevel: 5,
          targetStockLevel: 20,
          medicineId: itemData.matchedMedicineId || null,
        });
        inventoryItemId = createdItem.id;
      }

      const qty = Math.max(1, Number(itemData.quantity));
      const rate = Number(itemData.purchaseRate) || 0;
      const mrp = Number(itemData.mrp) || Math.round(rate * 1.35);
      const lineTotal = Math.round(qty * rate * 100) / 100;
      grandTotal += lineTotal;

      // Create Stock Batch
      const newBatch: InventoryBatchDTO = {
        id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        practiceId,
        inventoryItemId,
        itemName: itemData.name,
        itemCategory: itemData.category,
        batchNumber: (itemData.batchNumber || 'BATCH-001').trim().toUpperCase(),
        manufacturingDate: itemData.manufacturingDate || null,
        expiryDate: itemData.expiryDate,
        currentQuantity: qty,
        initialQuantity: qty,
        purchaseRate: rate,
        mrp,
        locationId: 'loc_main',
        locationName: 'Main Stock',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
        reason: `Purchase Invoice: ${data.invoiceNumber} from ${data.supplierName}`,
        performedByUserId: data.performedByUserId || null,
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
    }

    const purchaseInvoice: PurchaseInvoiceDTO = {
      id: purchaseInvoiceId,
      practiceId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierGstin: supplier.gstin,
      invoiceNumber: data.invoiceNumber.trim(),
      invoiceDate: data.invoiceDate,
      totalAmount: Math.round(grandTotal * 100) / 100,
      notes: data.notes || null,
      itemsCount: invoiceItems.length,
      items: invoiceItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    const items = this.getItemsStore(practiceId);
    const batches = this.getBatchesStore(practiceId);
    const today = new Date().toISOString().split('T')[0];

    const resolutions: StockResolutionItemDTO[] = [];

    for (const rxItem of prescribedItems) {
      const reqQty = Number(rxItem.totalQuantity) || 1;

      // Find matching inventory item (by medicineId or brandName)
      let invItem = rxItem.medicineId
        ? items.find((i) => i.medicineId === rxItem.medicineId)
        : null;

      if (!invItem) {
        invItem = items.find(
          (i) => i.name.toLowerCase() === rxItem.brandName.trim().toLowerCase()
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
    const batches = this.getBatchesStore(practiceId);
    const itemsStore = this.getItemsStore(practiceId);
    const today = new Date().toISOString().split('T')[0];
    const transactions: InventoryTransactionDTO[] = [];

    for (const it of itemsToDeduct) {
      const qty = Number(it.quantity) || 1;

      // Match inventory item
      let invItem = it.medicineId
        ? itemsStore.find((i) => i.medicineId === it.medicineId)
        : null;

      if (!invItem) {
        invItem = itemsStore.find(
          (i) => i.name.toLowerCase() === it.description.trim().toLowerCase()
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
    const allTx = this.getTransactionsStore(practiceId);
    const batches = this.getBatchesStore(practiceId);

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
    const txToday = this.getTransactionsStore(practiceId).filter(
      (t) => t.createdAt.startsWith(today) && t.quantityChange < 0
    );
    const unitsUsedToday = txToday.reduce((sum, t) => sum + Math.abs(t.quantityChange), 0);
    const valueUsedTodayINR = txToday.reduce(
      (sum, t) => sum + Math.abs(t.quantityChange) * (t.unitCost || 0),
      0
    );

    const alerts = await this.getAlerts(practiceId);

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

  // --------------------------------------------------------------------------
  // In-Memory Partition Helpers
  // --------------------------------------------------------------------------

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
}
