// ==============================================================================
// VetRx — Inventory & Stock Management Domain Types & Interfaces
// V1 Plug-in Add-On Module
// ==============================================================================

export type InventoryCategory =
  | 'MEDICINE'
  | 'CONSUMABLE'
  | 'LAB_MATERIAL'
  | 'SURGICAL_MATERIAL'
  | 'OTHER';

export type InventoryTransactionType =
  | 'OPENING_STOCK'
  | 'PURCHASE'
  | 'SALE_OR_INVOICE'
  | 'STOCK_ADJUSTMENT'
  | 'RETURN_TO_SUPPLIER'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'WASTAGE'
  | 'REVERSAL';

export interface InventoryItemDTO {
  id: string;
  practiceId: string;
  category: InventoryCategory;
  name: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  presentation?: string | null;
  packSize?: string | null;
  stockUnit: string;
  manufacturer?: string | null;
  minimumStockLevel: number;
  targetStockLevel: number;
  barcode?: string | null;
  medicineId?: string | null;
  isActive: boolean;
  currentStock?: number;
  validStock?: number;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  batchesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryBatchDTO {
  id: string;
  practiceId: string;
  inventoryItemId: string;
  itemName?: string;
  itemCategory?: InventoryCategory;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate: string; // ISO 8601 YYYY-MM-DD
  currentQuantity: number;
  initialQuantity: number;
  purchaseRate: number; // in INR (₹)
  mrp: number; // in INR (₹)
  locationId?: string | null;
  locationName?: string;
  isExpired?: boolean;
  daysToExpiry?: number;
  expiryStatus?: 'OK' | 'EXPIRING_SOON' | 'CRITICAL' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransactionDTO {
  id: string;
  practiceId: string;
  itemId: string;
  itemName?: string;
  itemCategory?: InventoryCategory;
  batchId?: string | null;
  batchNumber?: string | null;
  transactionType: InventoryTransactionType;
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number;
  referenceType?: string | null; // e.g. "INVOICE", "PURCHASE_INVOICE", "STOCKTAKE", "MANUAL_ADJUSTMENT"
  referenceId?: string | null;
  reason?: string | null;
  performedByUserId?: string | null;
  performedByName?: string | null;
  createdAt: string;
}

export interface SupplierDTO {
  id: string;
  practiceId: string;
  name: string;
  gstin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive: boolean;
  totalPurchasesCount?: number;
  totalPurchasesAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInvoiceDTO {
  id: string;
  practiceId: string;
  supplierId?: string | null;
  supplierName: string;
  supplierGstin?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  notes?: string | null;
  documentFileName?: string | null;
  itemsCount?: number;
  items?: PurchaseInvoiceItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseInvoiceItemDTO {
  id: string;
  purchaseInvoiceId: string;
  inventoryItemId: string;
  itemName: string;
  category: InventoryCategory;
  presentation?: string | null;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate: string;
  quantity: number;
  purchaseRate: number;
  mrp: number;
  lineTotal: number;
}

export interface StockLocationDTO {
  id: string;
  practiceId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryDashboardDTO {
  uniqueItemCount: number;
  totalUnitsInStock: number;
  stockValueINR: number;
  unitsUsedToday: number;
  valueUsedTodayINR: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  recentPurchases: PurchaseInvoiceDTO[];
  recentMovements: InventoryTransactionDTO[];
}

export interface StockResolutionItemDTO {
  medicineId?: string | null;
  brandName: string;
  requiredQuantity: number;
  validInternalStock: number;
  internalQuantity: number;
  externalQuantity: number;
  status: 'IN_STOCK' | 'PARTIAL' | 'EXTERNAL';
  batches: Array<{
    batchId: string;
    batchNumber: string;
    expiryDate: string;
    availableQuantity: number;
    allocatedQuantity: number;
  }>;
}

export interface ExtractedInvoiceItemDTO {
  tempId: string;
  name: string;
  category: InventoryCategory;
  genericName?: string;
  dosageForm?: string;
  packSize?: string;
  stockUnit: string;
  presentation: string;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate: string;
  quantity: number;
  purchaseRate: number;
  mrp: number;
  lineTotal?: number;
  // Matching fields
  matchedMedicineId?: string | null;
  matchedItemId?: string | null;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  suggestedMatches?: Array<{ id: string; name: string; type: 'medicine' | 'item' }>;
  flags: string[];
}

export interface InvoiceExtractionResultDTO {
  supplierName: string;
  supplierGstin?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount?: number;
  items: ExtractedInvoiceItemDTO[];
  isDuplicate: boolean;
  existingPurchaseId?: string | null;
  warnings: string[];
}
