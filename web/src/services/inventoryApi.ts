// ==============================================================================
// VetRx — Inventory API Client (web/src/services/inventoryApi.ts)
// Canonical client for the Inventory & Stock Management add-on module.
// ==============================================================================

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export async function inventoryRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let errMessage = `Request failed (${res.status}${res.statusText ? `: ${res.statusText}` : ''})`;
    try {
      const body = await res.json();
      if (body?.error) {
        if (typeof body.error === 'string') {
          errMessage = body.error;
        } else if (body.error.message) {
          errMessage = body.error.message;
        } else if (body.error.code) {
          errMessage = body.error.code.replace(/_/g, ' ');
        }
      } else if (body?.message) {
        errMessage = body.message;
      }
    } catch {
      // Body not JSON
    }
    const err = new Error(errMessage) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type InventoryCategory =
  | 'MEDICINE'
  | 'CONSUMABLE'
  | 'LAB_MATERIAL'
  | 'SURGICAL_MATERIAL'
  | 'OTHER';

export interface InventoryBatch {
  id: string;
  itemId: string;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  mrp?: number | null;
  locationId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  item?: InventoryItem;
}

export interface InventoryItem {
  id: string;
  practiceId: string;
  medicineId?: number | null;
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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  batches?: InventoryBatch[];
  totalStock?: number;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface InventoryTransaction {
  id: string;
  practiceId: string;
  itemId: string;
  batchId?: string | null;
  transactionType:
    | 'OPENING_STOCK'
    | 'PURCHASE'
    | 'SALE_OR_INVOICE'
    | 'STOCK_ADJUSTMENT'
    | 'RETURN_TO_SUPPLIER'
    | 'EXPIRED'
    | 'DAMAGED'
    | 'WASTAGE'
    | 'REVERSAL';
  quantityChange: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  performedBy?: string | null;
  createdAt: string;
  item?: {
    id: string;
    name: string;
    category: InventoryCategory;
    stockUnit: string;
  };
  batch?: {
    id: string;
    batchNumber: string;
    expiryDate: string;
  };
}

export interface Supplier {
  id: string;
  practiceId: string;
  name: string;
  gstin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PurchaseInvoiceItem {
  id: string;
  invoiceId: string;
  itemId?: string | null;
  medicineName: string;
  category: InventoryCategory;
  presentation?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  manufacturingDate?: string | null;
  quantity: number;
  purchaseRate: number;
  mrp?: number | null;
  discountPercent?: number | null;
  taxPercent?: number | null;
  totalAmount: number;
}

export interface PurchaseInvoice {
  id: string;
  practiceId: string;
  supplierId?: string | null;
  supplierName: string;
  supplierGstin?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  uploadedDocumentUrl?: string | null;
  totalAmount: number;
  status: string;
  createdAt: string;
  supplier?: Supplier;
  items?: PurchaseInvoiceItem[];
}

export interface InventoryDashboardData {
  totalItems: number;
  totalUnits: number;
  totalStockValue: number; // ₹ purchase cost valuation
  usedTodayUnits: number;
  usedTodayValue: number; // ₹ purchase cost
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  recentPurchases: PurchaseInvoice[];
  recentMovements: InventoryTransaction[];
  alerts: {
    expiringSoon: Array<{
      batchId: string;
      itemId: string;
      itemName: string;
      batchNumber: string;
      expiryDate: string;
      quantity: number;
      daysRemaining: number;
      isCritical: boolean;
    }>;
    expired: Array<{
      batchId: string;
      itemId: string;
      itemName: string;
      batchNumber: string;
      expiryDate: string;
      quantity: number;
    }>;
    lowStock: Array<{
      itemId: string;
      itemName: string;
      category: InventoryCategory;
      currentStock: number;
      minimumStockLevel: number;
      targetStockLevel: number;
    }>;
    outOfStock: Array<{
      itemId: string;
      itemName: string;
      category: InventoryCategory;
      minimumStockLevel: number;
    }>;
  };
}

export interface ParsedInvoiceData {
  supplier: {
    name: string;
    gstin?: string | null;
  };
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount?: number | null;
  isDuplicateWarning?: boolean;
  duplicateMessage?: string | null;
  items: Array<{
    name: string;
    category: InventoryCategory;
    presentation?: string | null;
    packSize?: string | null;
    stockUnit?: string | null;
    batchNumber?: string | null;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    quantity: number;
    purchaseRate: number;
    mrp?: number | null;
    matchedMedicineId?: number | null;
    matchedMedicineName?: string | null;
    confidence?: 'HIGH' | 'MEDIUM' | 'NONE';
    flags?: string[];
  }>;
}

export interface PrescriptionStockResolution {
  medicineId?: number;
  medicineName: string;
  requiredQuantity: number;
  internalStockQuantity: number;
  externalQuantity: number;
  status: 'IN_STOCK' | 'PARTIAL' | 'EXTERNAL';
  batchesUsed?: Array<{
    batchId: string;
    batchNumber: string;
    quantity: number;
    expiryDate: string;
  }>;
}

// ── API Methods ─────────────────────────────────────────────────────────────

export const inventoryApi = {
  // Entitlement & Dev Toggle
  getEntitlement: async () => {
    const res = await inventoryRequest<{
      entitled?: boolean;
      hasInventoryEntitlement?: boolean;
      reason?: string;
      mockMode?: boolean;
    }>('/api/commercial/entitlements/inventory');
    const entitled = Boolean(res.hasInventoryEntitlement ?? res.entitled);
    return {
      entitled,
      reason: res.reason,
      mockMode: res.mockMode ?? true,
    };
  },

  toggleDevEntitlement: async (enabled: boolean) => {
    const res = await inventoryRequest<{
      success?: boolean;
      entitled?: boolean;
      hasInventoryEntitlement?: boolean;
      mockMode?: boolean;
    }>('/api/commercial/entitlements/inventory/dev-toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    const entitled = Boolean(res.hasInventoryEntitlement ?? res.entitled);
    return {
      success: true,
      entitled,
      mockMode: res.mockMode ?? true,
    };
  },

  // Dashboard
  getDashboard: () =>
    inventoryRequest<InventoryDashboardData>('/api/inventory/dashboard'),

  // Items
  getItems: (params?: { category?: string; search?: string; lowStockOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.category && params.category !== 'ALL') q.set('category', params.category);
    if (params?.search) q.set('search', params.search);
    if (params?.lowStockOnly) q.set('lowStockOnly', 'true');
    const qs = q.toString();
    return inventoryRequest<{ items: InventoryItem[] }>(`/api/inventory/items${qs ? `?${qs}` : ''}`);
  },

  getItem: (id: string) =>
    inventoryRequest<{ item: InventoryItem; batches: InventoryBatch[]; transactions: InventoryTransaction[] }>(
      `/api/inventory/items/${id}`
    ),

  createItem: (data: Partial<InventoryItem>) =>
    inventoryRequest<{ item: InventoryItem }>('/api/inventory/items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateItem: (id: string, data: Partial<InventoryItem>) =>
    inventoryRequest<{ item: InventoryItem }>(`/api/inventory/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Batches
  getBatches: (params?: { itemId?: string; expiredOnly?: boolean; expiringDays?: number }) => {
    const q = new URLSearchParams();
    if (params?.itemId) q.set('itemId', params.itemId);
    if (params?.expiredOnly) q.set('expiredOnly', 'true');
    if (params?.expiringDays) q.set('expiringDays', String(params.expiringDays));
    const qs = q.toString();
    return inventoryRequest<{ batches: InventoryBatch[] }>(`/api/inventory/batches${qs ? `?${qs}` : ''}`);
  },

  // Stock operations
  addOpeningStock: (data: {
    itemId: string;
    batchNumber: string;
    expiryDate: string;
    manufacturingDate?: string;
    quantity: number;
    unitCost: number;
    mrp?: number;
  }) =>
    inventoryRequest<{ success: boolean; batch: InventoryBatch; transaction: InventoryTransaction }>(
      '/api/inventory/opening-stock',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  adjustStock: (data: {
    itemId: string;
    batchId?: string;
    quantityChange: number;
    reason:
      | 'Damaged'
      | 'Expired'
      | 'Wastage'
      | 'Spillage'
      | 'Missing'
      | 'Counting correction'
      | 'Other'
      | string;
    notes?: string;
  }) =>
    inventoryRequest<{ success: boolean; transaction: InventoryTransaction }>(
      '/api/inventory/adjust',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  performStocktake: (data: {
    items: Array<{
      itemId: string;
      batchId?: string;
      physicalQuantity: number;
      reason?: string;
    }>;
  }) =>
    inventoryRequest<{ success: boolean; adjustmentsCount: number }>(
      '/api/inventory/stocktake',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  // Transactions / Movements
  getTransactions: (params?: { itemId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.itemId) q.set('itemId', params.itemId);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return inventoryRequest<{ transactions: InventoryTransaction[] }>(
      `/api/inventory/transactions${qs ? `?${qs}` : ''}`
    );
  },

  // Purchases & Importer
  getPurchases: () =>
    inventoryRequest<{ purchases: PurchaseInvoice[]; suppliers: Supplier[] }>(
      '/api/inventory/purchases'
    ),

  parseInvoice: (data: { invoiceText?: string; fileName?: string; fileBase64?: string }) =>
    inventoryRequest<ParsedInvoiceData>('/api/inventory/purchases/parse-invoice', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  confirmPurchase: (data: {
    supplier: { name: string; gstin?: string; phone?: string; email?: string };
    invoiceNumber: string;
    invoiceDate: string;
    uploadedDocumentUrl?: string;
    totalAmount: number;
    items: Array<{
      name: string;
      category?: InventoryCategory;
      genericName?: string;
      strength?: string;
      dosageForm?: string;
      presentation?: string;
      packSize?: string;
      stockUnit?: string;
      batchNumber: string;
      manufacturingDate?: string;
      expiryDate: string;
      quantity: number;
      purchaseRate: number;
      mrp?: number;
      matchedMedicineId?: number;
      createNewMedicineMaster?: boolean;
    }>;
  }) =>
    inventoryRequest<{ success: boolean; purchaseInvoiceId: string; itemsCreated: number }>(
      '/api/inventory/purchases/confirm',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  // Alerts
  getAlerts: () =>
    inventoryRequest<{
      expiringSoon: Array<any>;
      expired: Array<any>;
      lowStock: Array<any>;
      outOfStock: Array<any>;
    }>('/api/inventory/alerts'),

  // Clinical & Invoicing Integration
  resolvePrescriptionStock: (
    items: Array<{ medicineId?: number; medicineName?: string; quantity: number }>
  ) =>
    inventoryRequest<{
      resolutions: PrescriptionStockResolution[];
      hasExternalPurchases: boolean;
    }>('/api/inventory/prescriptions/resolve-stock', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  deductInvoiceStock: (
    invoiceId: string,
    items: Array<{ itemId?: string; medicineId?: number; medicineName?: string; quantity: number }>
  ) =>
    inventoryRequest<{ success: boolean; deductions: any[] }>(
      '/api/inventory/invoices/deduct',
      {
        method: 'POST',
        body: JSON.stringify({ invoiceId, items }),
      }
    ),

  reverseInvoiceStock: (invoiceId: string, reason?: string) =>
    inventoryRequest<{ success: boolean; reversedCount: number }>(
      '/api/inventory/invoices/reverse',
      {
        method: 'POST',
        body: JSON.stringify({ invoiceId, reason }),
      }
    ),
};
