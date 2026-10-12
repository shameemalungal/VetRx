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
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  vehicleNumber?: string | null;
  type?: 'STORE' | 'BAG' | 'VEHICLE' | 'FIELD_KIT';
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationDTO {
  name: string;
  description?: string | null;
  type?: 'BAG' | 'VEHICLE' | 'FIELD_KIT';
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  vehicleNumber?: string | null;
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
  storeStockSummary?: {
    totalItems: number;
    totalUnits: number;
    lowStockCount: number;
    stockValueINR: number;
  };
  practiceBagSummary?: {
    totalItems: number;
    totalUnits: number;
    lowStockCount: number;
    expiringSoonCount: number;
  };
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
  lineNumber?: number;
  name: string;
  category: InventoryCategory;
  genericName?: string;
  dosageForm?: string;
  strength?: string;
  manufacturer?: string;
  packSize?: string;
  packing?: string;
  hsnCode?: string;
  stockUnit: string;
  presentation: string;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate: string;
  quantity: number;
  schemeQuantity?: number;
  freeQuantity?: number;
  purchaseRate: number;
  mrp: number;
  schemeDiscountPercent?: number;
  discountPercent?: number;
  gstPercent?: number;
  taxableValue?: number;
  lineTotal?: number;
  rawDescription?: string;
  rawOcrText?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  // Matching fields
  matchedMedicineId?: string | null;
  matchedItemId?: string | null;
  matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  suggestedMatches?: Array<{ id: string; name: string; type: 'medicine' | 'item' }>;
  flags: string[];
}

export interface InvoiceExtractionResultDTO {
  supplier?: {
    name: string;
    gstin?: string | null;
    pan?: string | null;
    fssai?: string | null;
    phone?: string | null;
    email?: string | null;
    dlNo?: string | null;
    address?: string | null;
    state?: string | null;
  };
  supplierName: string;
  supplierGstin?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTime?: string | null;
  dueDate?: string | null;
  customerName?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  customerGstin?: string | null;
  paymentType?: string | null;
  taxableAmount?: number;
  totalTax?: number;
  totalDiscount?: number;
  totalItems?: number;
  totalQuantity?: number;
  netPayable?: number;
  totalAmount?: number;
  items: ExtractedInvoiceItemDTO[];
  isDuplicate: boolean;
  isDuplicateWarning?: boolean;
  duplicateMessage?: string | null;
  existingPurchaseId?: string | null;
  warnings: string[];
  detectedCount?: number;
  rawExtractedText?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ------------------------------------------------------------------------------
// Phase 6: Store Stock, Practice Bag & Field Usage DTOs
// ------------------------------------------------------------------------------

export interface StockInDTO {
  itemId?: string;
  name?: string;
  category?: InventoryCategory;
  genericName?: string | null;
  dosageForm?: string | null;
  presentation?: string | null;
  stockUnit?: string;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  purchaseRate?: number;
  mrp?: number;
  sourceReference?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}

export interface TransferStockDTO {
  fromLocationId?: string;
  toLocationId?: string;
  sourceLocationId?: string;
  targetLocationId?: string;
  fromLocationName?: string;
  toLocationName?: string;
  itemId: string;
  batchNumber?: string;
  quantity: number;
  reason?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ReturnStockDTO {
  fromLocationId?: string;
  itemId: string;
  batchNumber?: string;
  quantity: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface ReconcileStockDTO {
  locationId?: string;
  locationName?: string;
  items: Array<{
    itemId: string;
    batchId?: string;
    batchNumber?: string;
    recordedQuantity: number;
    countedQuantity: number;
    reason?: string;
  }>;
  reason?: string;
}

export interface DeductFieldUsageDTO {
  visitId: string;
  patientId?: string | null;
  patientName?: string | null;
  medicineId?: string | null;
  medicineName: string;
  batchNumber?: string | null;
  quantity: number;
  unit?: string | null;
  route?: string | null;
  idempotencyKey?: string | null;
  locationId?: string | null;
}

export interface FieldUsageDeductionResult {
  success: boolean;
  deductedQuantity: number;
  remainingBagStock?: number;
  batchNumber?: string;
  batchId?: string;
  transactionId?: string;
  reason?: string;
  availableQuantity?: number;
  requestedQuantity?: number;
}

