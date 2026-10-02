-- ============================================================================
-- Migration: 20261002000000_inventory_addon_v1
-- Description: Add Inventory & Stock Management V1 Add-On Module tables
--   - InventoryCategory enum
--   - InventoryTransactionType enum
--   - StockLocation table
--   - Supplier table
--   - InventoryItem table
--   - InventoryBatch table
--   - InventoryTransaction table
--   - PurchaseInvoice table
--   - PurchaseInvoiceItem table
--   - Back-relations on Practice model (no DDL needed, handled by Prisma)
--   - Back-relation on Medicine model (no DDL needed, handled by Prisma)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Enums
-- ────────────────────────────────────────────────────────────────────────────

CREATE TYPE "InventoryCategory" AS ENUM (
  'MEDICINE',
  'CONSUMABLE',
  'LAB_MATERIAL',
  'SURGICAL_MATERIAL',
  'OTHER'
);

CREATE TYPE "InventoryTransactionType" AS ENUM (
  'OPENING_STOCK',
  'PURCHASE',
  'SALE_OR_INVOICE',
  'STOCK_ADJUSTMENT',
  'RETURN_TO_SUPPLIER',
  'EXPIRED',
  'DAMAGED',
  'WASTAGE',
  'REVERSAL'
);

-- ────────────────────────────────────────────────────────────────────────────
-- StockLocation
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "StockLocation" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "practiceId"  TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "isDefault"   BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockLocation_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockLocation_practiceId_name_key" UNIQUE ("practiceId", "name")
);

CREATE INDEX "StockLocation_practiceId_idx" ON "StockLocation"("practiceId");

-- ────────────────────────────────────────────────────────────────────────────
-- Supplier
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "Supplier" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "practiceId" TEXT         NOT NULL,
  "name"       TEXT         NOT NULL,
  "gstin"      TEXT,
  "address"    TEXT,
  "phone"      TEXT,
  "email"      TEXT,
  "notes"      TEXT,
  "isActive"   BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Supplier_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Supplier_practiceId_idx" ON "Supplier"("practiceId");
CREATE INDEX "Supplier_practiceId_name_idx" ON "Supplier"("practiceId", "name");

-- ────────────────────────────────────────────────────────────────────────────
-- InventoryItem
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "InventoryItem" (
  "id"                TEXT                NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "practiceId"        TEXT                NOT NULL,
  "category"          "InventoryCategory" NOT NULL DEFAULT 'MEDICINE',
  "name"              TEXT                NOT NULL,
  "genericName"       TEXT,
  "strength"          TEXT,
  "dosageForm"        TEXT,
  "presentation"      TEXT,
  "packSize"          TEXT,
  "stockUnit"         TEXT                NOT NULL DEFAULT 'Unit',
  "manufacturer"      TEXT,
  "minimumStockLevel" INTEGER             NOT NULL DEFAULT 5,
  "targetStockLevel"  INTEGER             NOT NULL DEFAULT 20,
  "barcode"           TEXT,
  "medicineId"        TEXT,
  "isActive"          BOOLEAN             NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)        NOT NULL,

  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryItem_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryItem_medicineId_fkey"
    FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "InventoryItem_practiceId_idx"          ON "InventoryItem"("practiceId");
CREATE INDEX "InventoryItem_practiceId_category_idx" ON "InventoryItem"("practiceId", "category");
CREATE INDEX "InventoryItem_practiceId_barcode_idx"  ON "InventoryItem"("practiceId", "barcode");
CREATE INDEX "InventoryItem_medicineId_idx"           ON "InventoryItem"("medicineId");

-- ────────────────────────────────────────────────────────────────────────────
-- InventoryBatch
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "InventoryBatch" (
  "id"                TEXT         NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "practiceId"        TEXT         NOT NULL,
  "inventoryItemId"   TEXT         NOT NULL,
  "batchNumber"       TEXT         NOT NULL,
  "manufacturingDate" TIMESTAMP(3),
  "expiryDate"        TIMESTAMP(3) NOT NULL,
  "currentQuantity"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "initialQuantity"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "purchaseRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mrp"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "locationId"        TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryBatch_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryBatch_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryBatch_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "InventoryBatch_practiceId_idx"            ON "InventoryBatch"("practiceId");
CREATE INDEX "InventoryBatch_inventoryItemId_idx"        ON "InventoryBatch"("inventoryItemId");
CREATE INDEX "InventoryBatch_expiryDate_idx"             ON "InventoryBatch"("expiryDate");
CREATE INDEX "InventoryBatch_practiceId_batchNumber_idx" ON "InventoryBatch"("practiceId", "batchNumber");

-- ────────────────────────────────────────────────────────────────────────────
-- InventoryTransaction
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "InventoryTransaction" (
  "id"                 TEXT                        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "practiceId"         TEXT                        NOT NULL,
  "itemId"             TEXT                        NOT NULL,
  "batchId"            TEXT,
  "transactionType"    "InventoryTransactionType"  NOT NULL,
  "quantityChange"     DOUBLE PRECISION            NOT NULL,
  "quantityBefore"     DOUBLE PRECISION            NOT NULL,
  "quantityAfter"      DOUBLE PRECISION            NOT NULL,
  "unitCost"           DOUBLE PRECISION            NOT NULL DEFAULT 0,
  "referenceType"      TEXT,
  "referenceId"        TEXT,
  "reason"             TEXT,
  "performedByUserId"  TEXT,
  "createdAt"          TIMESTAMP(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryTransaction_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryTransaction_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryTransaction_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "InventoryTransaction_practiceId_idx"       ON "InventoryTransaction"("practiceId");
CREATE INDEX "InventoryTransaction_itemId_idx"           ON "InventoryTransaction"("itemId");
CREATE INDEX "InventoryTransaction_batchId_idx"          ON "InventoryTransaction"("batchId");
CREATE INDEX "InventoryTransaction_transactionType_idx"  ON "InventoryTransaction"("transactionType");
CREATE INDEX "InventoryTransaction_createdAt_idx"        ON "InventoryTransaction"("createdAt");

-- ────────────────────────────────────────────────────────────────────────────
-- PurchaseInvoice
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "PurchaseInvoice" (
  "id"               TEXT             NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "practiceId"       TEXT             NOT NULL,
  "supplierId"       TEXT,
  "supplierName"     TEXT             NOT NULL,
  "supplierGstin"    TEXT,
  "invoiceNumber"    TEXT             NOT NULL,
  "invoiceDate"      TIMESTAMP(3)     NOT NULL,
  "totalAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"            TEXT,
  "documentFileName" TEXT,
  "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseInvoice_practiceId_supplierName_invoiceNumber_key"
    UNIQUE ("practiceId", "supplierName", "invoiceNumber"),
  CONSTRAINT "PurchaseInvoice_practiceId_fkey"
    FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseInvoice_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PurchaseInvoice_practiceId_idx"  ON "PurchaseInvoice"("practiceId");
CREATE INDEX "PurchaseInvoice_invoiceDate_idx" ON "PurchaseInvoice"("invoiceDate");

-- ────────────────────────────────────────────────────────────────────────────
-- PurchaseInvoiceItem
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE "PurchaseInvoiceItem" (
  "id"                TEXT                NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "purchaseInvoiceId" TEXT                NOT NULL,
  "inventoryItemId"   TEXT                NOT NULL,
  "itemName"          TEXT                NOT NULL,
  "category"          "InventoryCategory" NOT NULL,
  "presentation"      TEXT,
  "batchNumber"       TEXT                NOT NULL,
  "manufacturingDate" TIMESTAMP(3),
  "expiryDate"        TIMESTAMP(3)        NOT NULL,
  "quantity"          DOUBLE PRECISION    NOT NULL DEFAULT 1,
  "purchaseRate"      DOUBLE PRECISION    NOT NULL DEFAULT 0,
  "mrp"               DOUBLE PRECISION    NOT NULL DEFAULT 0,
  "lineTotal"         DOUBLE PRECISION    NOT NULL DEFAULT 0,

  CONSTRAINT "PurchaseInvoiceItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseInvoiceItem_purchaseInvoiceId_fkey"
    FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseInvoiceItem_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PurchaseInvoiceItem_purchaseInvoiceId_idx" ON "PurchaseInvoiceItem"("purchaseInvoiceId");
CREATE INDEX "PurchaseInvoiceItem_inventoryItemId_idx"   ON "PurchaseInvoiceItem"("inventoryItemId");
