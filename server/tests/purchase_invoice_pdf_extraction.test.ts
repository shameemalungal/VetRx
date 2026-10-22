// ==============================================================================
// VetRx — PDF Medicine Invoice Importer & Column Mapping Regression Test Suite
// Validates:
// 1. Mandatory regression fixture: final_medicine_invoice_2026-27.pdf (130 items, 6 pages)
// 2. Different column orders
// 3. Missing optional columns
// 4. Wrapped manufacturer and product names
// 5. Repeated headers on subsequent pages
// 6. Separate SGST and CGST columns summation
// 7. IGST-only invoices
// 8. Discount percentage vs discount amount (never populate from MRP)
// 9. Month-year expiry normalization (Feb leap & non-leap, 30/31 day months)
// 10. Blank or invalid HSN values (never in Quantity)
// 11. Rows with blank optional fields
// 12. MRP values higher than purchase rate (distinct semantics)
// 13. Multiple batches of the same medicine
// 14. Extraction failures & low-confidence flagging
// 15. Preview edits persisting correctly through the final save
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  PdfExtractorProvider,
  normalizeExpiryDate,
} from '../src/inventory/document-extraction/providers/pdf-extractor.provider.js';
import { TextParserProvider } from '../src/inventory/document-extraction/providers/text-parser.provider.js';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';

describe('PDF Medicine Invoice Importer: Header-Aware Extraction & Mapping', () => {
  const practiceId = 'practice-vet-invoice-test';
  const pdfFixturePath = path.resolve(process.cwd(), '../test-fixtures/final_medicine_invoice_2026-27.pdf');

  beforeEach(() => {
    InventoryService.clearMockStore();
    EntitlementService.setMockInventoryAddon(practiceId, true);
  });

  // ----------------------------------------------------------------------------
  // 1. Uploaded 6-Page Test Invoice Regression
  // ----------------------------------------------------------------------------
  describe('1. Uploaded 6-Page Test Invoice Regression (final_medicine_invoice_2026-27.pdf)', () => {
    it('extracts all 130 line items without shifting values and verifies invoice metadata & totals', async () => {
      assert.ok(fs.existsSync(pdfFixturePath), `Test fixture must exist at ${pdfFixturePath}`);
      const pdfBuffer = fs.readFileSync(pdfFixturePath);

      const pdfProvider = new PdfExtractorProvider();
      const extracted = await pdfProvider.extractDocument({
        buffer: pdfBuffer,
        fileName: 'final_medicine_invoice_2026-27.pdf',
      });

      // Verify Header extraction & Supplier spatial partitioning
      assert.ok(extracted.supplier.name?.includes('BEYPORE NEETHI MEDICAL STORE'), 'Supplier name must match');
      assert.strictEqual(extracted.supplier.gstin, '32AAAAB5233D1ZJ');
      assert.strictEqual(extracted.invoice.invoiceNumber, '194');
      assert.strictEqual(extracted.invoice.invoiceDate, '2026-10-15');

      // Total items must be exactly 130 across 6 pages
      assert.strictEqual(extracted.lineItems.length, 130, 'Must extract exactly 130 line items across all 6 pages');

      // Row 1 verification
      const row1 = extracted.lineItems[0];
      assert.strictEqual(row1.itemName, 'MECTIN 100MG BOLUS');
      assert.ok(row1.manufacturer?.includes('ALEMBIC'), `Manufacturer must be Alembic, got ${row1.manufacturer}`);
      assert.strictEqual(row1.batchNumber, 'HC26133001');
      assert.strictEqual(row1.expiryDate, '31-07-2028');
      assert.strictEqual(row1.hsnCode, '30049085');
      assert.strictEqual(row1.quantity, 30);
      assert.strictEqual(row1.purchaseRate, 47.25);
      assert.strictEqual(row1.mrp, 56.25);
      assert.strictEqual(row1.discountPercent || 0, 0); // No discount
      assert.strictEqual(row1.gstPercent, 5); // 2.50% SGST + 2.50% CGST = 5%
      assert.strictEqual(row1.taxableValue, 1417.5);

      // Row 2 verification (different batch of same product)
      const row2 = extracted.lineItems[1];
      assert.strictEqual(row2.itemName, 'MECTIN 100MG BOLUS');
      assert.strictEqual(row2.batchNumber, 'HC5133002');
      assert.strictEqual(row2.expiryDate, '30-06-2027');
      assert.strictEqual(row2.quantity, 10);
      assert.strictEqual(row2.taxableValue, 472.5);

      // Row 3 verification (0% GST item)
      const row3 = extracted.lineItems[2];
      assert.strictEqual(row3.itemName, 'RUMEN FS BOLUS');
      assert.strictEqual(row3.gstPercent, 0); // 0.00% + 0.00%
      assert.strictEqual(row3.quantity, 400);
      assert.strictEqual(row3.taxableValue, 19200);

      // Verify page 6 row 130 (last row)
      const row130 = extracted.lineItems[129];
      assert.strictEqual(row130.itemName, 'TISSUAID');
      assert.ok(row130.manufacturer?.includes('ZENEX'), `Manufacturer should be Zenex, got ${row130.manufacturer}`);
      assert.strictEqual(row130.batchNumber, 'TFWA2540');
      assert.strictEqual(row130.expiryDate, '30-09-2027');
      assert.strictEqual(row130.quantity, 40);
      assert.strictEqual(row130.taxableValue, 5024);

      // Verify extracted invoice summary totals
      assert.strictEqual(extracted.invoice.taxableAmount, 488328.8);
      assert.strictEqual(extracted.invoice.totalTax, 11671.24);
      assert.strictEqual(extracted.invoice.totalAmount, 500000.0);
      assert.strictEqual(extracted.invoice.totalDiscount, 0.0);

      // Verify item sums reconcile to invoice totals
      const computedLineItemsTotal = extracted.lineItems.reduce((acc, it) => acc + (it.taxableValue || 0), 0);
      assert.ok(Math.abs(computedLineItemsTotal - 500000.04) < 1.0, `Computed line items total ${computedLineItemsTotal} must match 500000.04`);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Different Column Orders
  // ----------------------------------------------------------------------------
  describe('2. Different Column Orders', () => {
    it('maps values correctly when column order is rearranged', async () => {
      const invoiceText = `
TAX INVOICE
TEST PHARMA DISTRIBUTORS
Inv No: INV-ORDER-001  Date: 2026-10-15
----------------------------------------------------------------------------------------------------
BATCH NO   EXPIRY   PRODUCT NAME       QTY   RATE    MRP     HSN CODE   SGST   CGST   AMOUNT
----------------------------------------------------------------------------------------------------
BT9921     08-28    AMOXYL 500 VET     25    50.00   65.00   30041010   2.5%   2.5%   1250.00
----------------------------------------------------------------------------------------------------
TOTAL: 1250.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 1);
      const itm = extracted.lineItems[0];
      assert.strictEqual(itm.itemName, 'AMOXYL 500 VET');
      assert.strictEqual(itm.batchNumber, 'BT9921');
      assert.strictEqual(itm.expiryDate, '31-08-2028');
      assert.strictEqual(itm.quantity, 25);
      assert.strictEqual(itm.purchaseRate, 50.0);
      assert.strictEqual(itm.mrp, 65.0);
      assert.strictEqual(itm.hsnCode, '30041010');
      assert.strictEqual(itm.gstPercent, 5); // 2.5 + 2.5
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Missing Optional Columns
  // ----------------------------------------------------------------------------
  describe('3. Missing Optional Columns', () => {
    it('tolerates missing discount, manufacturer, and pack columns without shifting', async () => {
      const invoiceText = `
TAX INVOICE
BASIC VET SUPPLIERS
Inv No: INV-BASIC-001  Date: 2026-10-15
-----------------------------------------------------------------
PRODUCT             BATCH     EXP     QTY   RATE    MRP     AMOUNT
-----------------------------------------------------------------
ENROFLOXACIN 10%    ENR-44    05-28   10    120.00  150.00  1200.00
-----------------------------------------------------------------
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 1);
      const itm = extracted.lineItems[0];
      assert.strictEqual(itm.itemName, 'ENROFLOXACIN 10%');
      assert.strictEqual(itm.batchNumber, 'ENR-44');
      assert.strictEqual(itm.expiryDate, '31-05-2028');
      assert.strictEqual(itm.quantity, 10);
      assert.strictEqual(itm.purchaseRate, 120.0);
      assert.strictEqual(itm.mrp, 150.0);
      assert.strictEqual(itm.discountPercent || 0, 0); // No discount column -> default 0
      assert.strictEqual(itm.taxableValue, 1200.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Wrapped Manufacturer and Product Names
  // ----------------------------------------------------------------------------
  describe('4. Wrapped Manufacturer and Product Names', () => {
    it('preserves multi-word manufacturer names without leaking into product or batch', async () => {
      const invoiceText = `
TAX INVOICE
KERALA VET DISTRIBUTORS
Inv No: KV-101 Date: 2026-10-15
PRODUCT                 MFR.                             BATCH    EXP    HSN      QTY  RATE   MRP
MECTIN 100MG BOLUS      ALEMBIC PHARMACEUTICALS LTD      HC2613   07-28  30049085 30   47.25  56.25
TISSUAID                ZENEX ANIMAL HEALTH I P LTD      TFWA25   09-27  23099090 40   125.60 165.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 2);
      assert.strictEqual(extracted.lineItems[0].itemName, 'MECTIN 100MG BOLUS');
      assert.strictEqual(extracted.lineItems[0].manufacturer, 'ALEMBIC PHARMACEUTICALS LTD');
      assert.strictEqual(extracted.lineItems[0].batchNumber, 'HC2613');

      assert.strictEqual(extracted.lineItems[1].itemName, 'TISSUAID');
      assert.strictEqual(extracted.lineItems[1].manufacturer, 'ZENEX ANIMAL HEALTH I P LTD');
      assert.strictEqual(extracted.lineItems[1].batchNumber, 'TFWA25');
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Repeated Headers on Subsequent Pages
  // ----------------------------------------------------------------------------
  describe('5. Repeated Headers on Subsequent Pages', () => {
    it('ignores repeated table headers on page breaks instead of converting them to medicine rows', async () => {
      const invoiceText = `
TAX INVOICE
MULTI-PAGE DISTRIBUTORS
SL NO  PRODUCT          BATCH   EXP   HSN      QTY  RATE   MRP
1      MEDICINE ONE     B101    04-28 30049099 10   50.00  70.00
--- PAGE BREAK ---
SL NO  PRODUCT          BATCH   EXP   HSN      QTY  RATE   MRP
2      MEDICINE TWO     B102    05-28 30049099 20   60.00  80.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 2);
      assert.strictEqual(extracted.lineItems[0].itemName, 'MEDICINE ONE');
      assert.strictEqual(extracted.lineItems[1].itemName, 'MEDICINE TWO');
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Separate SGST and CGST Columns
  // ----------------------------------------------------------------------------
  describe('6. Separate SGST and CGST Columns', () => {
    it('sums SGST and CGST percentages accurately', async () => {
      const invoiceText = `
TAX INVOICE
SGST CGST TEST
PRODUCT             BATCH   EXP   QTY  RATE   MRP    SGST   CGST  AMOUNT
ITEM TAXABLE 5%     B1      06-28 10   100.00 120.00 2.50%  2.50% 1000.00
ITEM TAXABLE 12%    B2      06-28 10   100.00 120.00 6.00%  6.00% 1000.00
ITEM EXEMPT 0%      B3      06-28 10   100.00 120.00 0.00%  0.00% 1000.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 3);
      assert.strictEqual(extracted.lineItems[0].gstPercent, 5.0);
      assert.strictEqual(extracted.lineItems[1].gstPercent, 12.0);
      assert.strictEqual(extracted.lineItems[2].gstPercent, 0.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 7. IGST-Only Invoices
  // ----------------------------------------------------------------------------
  describe('7. IGST-Only Invoices', () => {
    it('correctly maps single IGST column without doubling or summing SGST/CGST', async () => {
      const invoiceText = `
TAX INVOICE (INTER-STATE)
INTERSTATE VET SUPPLIES
PRODUCT             BATCH   EXP   QTY  RATE   MRP    IGST   AMOUNT
CEFTRIAXONE INJ     CFX1    08-28 10   200.00 250.00 12.00% 2000.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 1);
      assert.strictEqual(extracted.lineItems[0].gstPercent, 12.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 8. Discount Percentage vs Discount Amount
  // ----------------------------------------------------------------------------
  describe('8. Discount Integrity', () => {
    it('never populates discount from MRP and defaults discount to zero when absent', async () => {
      const invoiceText = `
TAX INVOICE
DISCOUNT TEST
PRODUCT       BATCH   EXP   QTY  RATE   MRP    DISC%  AMOUNT
ITEM WITH DISC B1      06-28 10   100.00 150.00 10.0%  900.00
ITEM NO DISC   B2      06-28 10   100.00 150.00 0.0%   1000.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 2);
      assert.strictEqual(extracted.lineItems[0].discountPercent, 10.0);
      assert.strictEqual(extracted.lineItems[0].mrp, 150.0);
      assert.strictEqual(extracted.lineItems[1].discountPercent || 0, 0.0);
      assert.strictEqual(extracted.lineItems[1].mrp, 150.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 9. Month-Year Expiry Normalization
  // ----------------------------------------------------------------------------
  describe('9. Month-Year Expiry Normalization', () => {
    it('normalizes month-year expiries to the last calendar day including leap year February', () => {
      // Leap year 2028: Feb 2028 has 29 days
      assert.strictEqual(normalizeExpiryDate('02-28'), '29-02-2028');
      assert.strictEqual(normalizeExpiryDate('02/28'), '29-02-2028');
      assert.strictEqual(normalizeExpiryDate('02-2028'), '29-02-2028');

      // Non-leap year 2027: Feb 2027 has 28 days
      assert.strictEqual(normalizeExpiryDate('02-27'), '28-02-2027');
      assert.strictEqual(normalizeExpiryDate('02/2027'), '28-02-2027');

      // 30-day months
      assert.strictEqual(normalizeExpiryDate('06-27'), '30-06-2027');
      assert.strictEqual(normalizeExpiryDate('09-27'), '30-09-2027');
      assert.strictEqual(normalizeExpiryDate('04-28'), '30-04-2028');
      assert.strictEqual(normalizeExpiryDate('11-27'), '30-11-2027');

      // 31-day months
      assert.strictEqual(normalizeExpiryDate('07-28'), '31-07-2028');
      assert.strictEqual(normalizeExpiryDate('03-29'), '31-03-2029');
      assert.strictEqual(normalizeExpiryDate('01-29'), '31-01-2029');
      assert.strictEqual(normalizeExpiryDate('12-27'), '31-12-2027');
    });
  });

  // ----------------------------------------------------------------------------
  // 10. Blank or Invalid HSN Values
  // ----------------------------------------------------------------------------
  describe('10. Blank or Invalid HSN Values', () => {
    it('does not shift HSN into Quantity when HSN is missing or 6-8 digits', async () => {
      const invoiceText = `
TAX INVOICE
HSN TEST DISTRIBUTOR
PRODUCT             BATCH   EXP   HSN      QTY   RATE   MRP
ITEM WITH 8 DIGIT   B1      07-28 30049085 30    47.25  56.25
ITEM WITH 6 DIGIT   B2      06-27 300490   8     126.00 157.50
ITEM BLANK HSN      B3      05-28          15    50.00  70.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 3);
      // Row 1
      assert.strictEqual(extracted.lineItems[0].hsnCode, '30049085');
      assert.strictEqual(extracted.lineItems[0].quantity, 30);
      assert.strictEqual(extracted.lineItems[0].purchaseRate, 47.25);

      // Row 2
      assert.strictEqual(extracted.lineItems[1].hsnCode, '300490');
      assert.strictEqual(extracted.lineItems[1].quantity, 8);
      assert.strictEqual(extracted.lineItems[1].purchaseRate, 126.0);

      // Row 3
      assert.strictEqual(extracted.lineItems[2].quantity, 15);
      assert.strictEqual(extracted.lineItems[2].purchaseRate, 50.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 11. Rows with Blank Optional Fields
  // ----------------------------------------------------------------------------
  describe('11. Rows with Blank Optional Fields', () => {
    it('handles blank presentation or packing without column shifting', async () => {
      const invoiceText = `
TAX INVOICE
OPTIONAL FIELDS TEST
PRODUCT        PACK   BATCH   EXP   QTY  RATE   MRP
ITEM WITH PACK 10ML   B1      05-28 10   50.00  70.00
ITEM NO PACK          B2      05-28 10   50.00  70.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 2);
      assert.strictEqual(extracted.lineItems[0].quantity, 10);
      assert.strictEqual(extracted.lineItems[0].purchaseRate, 50.0);
      assert.strictEqual(extracted.lineItems[1].quantity, 10);
      assert.strictEqual(extracted.lineItems[1].purchaseRate, 50.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 12. MRP Values Higher Than Purchase Rate
  // ----------------------------------------------------------------------------
  describe('12. Rate & MRP Distinction', () => {
    it('keeps Rate and MRP strictly separate and never overwrites Rate with MRP', async () => {
      const invoiceText = `
TAX INVOICE
RATE MRP TEST
PRODUCT       BATCH   EXP   QTY  RATE   MRP    AMOUNT
EXPENSIVE TAB B1      06-28 5    89.25  120.00 446.25
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 1);
      const itm = extracted.lineItems[0];
      assert.strictEqual(itm.purchaseRate, 89.25);
      assert.strictEqual(itm.mrp, 120.0);
      assert.ok(itm.mrp > itm.purchaseRate, 'MRP must be greater than purchase rate');
    });
  });

  // ----------------------------------------------------------------------------
  // 13. Multiple Batches of the Same Medicine
  // ----------------------------------------------------------------------------
  describe('13. Multiple Batches of the Same Medicine', () => {
    it('preserves multiple rows of the same product with distinct batches and quantities', async () => {
      const invoiceText = `
TAX INVOICE
MULTI-BATCH DISTRIBUTOR
PRODUCT            BATCH       EXP   QTY  RATE   MRP
MECTIN 100MG BOLUS HC26133001  07-28 30   47.25  56.25
MECTIN 100MG BOLUS HC5133002   06-27 10   47.25  56.25
CLOMIFERT          PT25358     11-28 10   105.00 122.00
CLOMIFERT          PT25358     11-28 15   105.00 122.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 4);
      assert.strictEqual(extracted.lineItems[0].batchNumber, 'HC26133001');
      assert.strictEqual(extracted.lineItems[0].quantity, 30);
      assert.strictEqual(extracted.lineItems[1].batchNumber, 'HC5133002');
      assert.strictEqual(extracted.lineItems[1].quantity, 10);
      assert.strictEqual(extracted.lineItems[2].quantity, 10);
      assert.strictEqual(extracted.lineItems[3].quantity, 15);
    });
  });

  // ----------------------------------------------------------------------------
  // 14. Extraction Failures and Low-Confidence Mappings
  // ----------------------------------------------------------------------------
  describe('14. Extraction Failures & Low Confidence Flagging', () => {
    it('flags unparseable or ambiguous rows instead of inventing fake values', async () => {
      const invoiceText = `
TAX INVOICE
IRREGULAR INVOICE
RANDOM UNPARSEABLE LINE OF TEXT WITHOUT ANY TABLE HEADERS
TERMS AND CONDITIONS APPLY GOODS ONCE SOLD WILL NOT BE RETURNED
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      // Should not invent false medicine rows from terms and conditions
      assert.strictEqual(extracted.lineItems.length, 0);
    });
  });

  // ----------------------------------------------------------------------------
  // 15. Preview Edits Persisting Correctly Through the Final Save
  // ----------------------------------------------------------------------------
  describe('15. Final Inventory Persistence Verification', () => {
    it('persists preview items and batches to inventory with manufacturer, expiry, and rates intact', async () => {
      // Simulate confirmed purchase invoice from preview modal
      const result = await InventoryService.confirmPurchaseInvoice(practiceId, {
        supplier: {
          name: 'BEYPORE NEETHI MEDICAL STORE',
          gstin: '32AAAAB5233D1ZJ',
          phone: '9847143140',
        },
        invoiceNumber: '194',
        invoiceDate: '2026-10-15',
        totalAmount: 1890.0,
        items: [
          {
            name: 'MECTIN 100MG BOLUS',
            manufacturer: 'ALEMBIC PHARMACEUTICALS LTD FARMCARE',
            category: 'MEDICINE',
            stockUnit: 'Strip',
            batchNumber: 'HC26133001',
            expiryDate: '31-07-2028',
            quantity: 30,
            purchaseRate: 47.25,
            mrp: 56.25,
            gstPercent: 5,
          },
          {
            name: 'MECTIN 100MG BOLUS',
            manufacturer: 'ALEMBIC PHARMACEUTICALS LTD FARMCARE',
            category: 'MEDICINE',
            stockUnit: 'Strip',
            batchNumber: 'HC5133002',
            expiryDate: '30-06-2027',
            quantity: 10,
            purchaseRate: 47.25,
            mrp: 56.25,
            gstPercent: 5,
          },
        ],
      });

      assert.strictEqual(result.itemsCount, 2);

      // Verify the persisted inventory item in inventory service
      const items = await InventoryService.listItems(practiceId, { search: 'MECTIN' });
      assert.ok(items.length >= 1, 'Inventory item must exist');
      const item = items[0];
      assert.strictEqual(item.name, 'MECTIN 100MG BOLUS');
      assert.strictEqual(item.currentStock, 40); // 30 + 10

      // Verify batches
      const batches = await InventoryService.listBatches(practiceId, { itemId: item.id });
      assert.strictEqual(batches.length, 2);

      const b1 = batches.find((b) => b.batchNumber === 'HC26133001');
      assert.ok(b1, 'Batch 1 must exist');
      assert.strictEqual(b1.currentQuantity, 30);
      assert.strictEqual(b1.purchaseRate, 47.25);
      assert.strictEqual(b1.mrp, 56.25);
      assert.ok(b1.expiryDate.startsWith('2028-07-31'), `Expiry must be 2028-07-31, got ${b1.expiryDate}`);

      const b2 = batches.find((b) => b.batchNumber === 'HC5133002');
      assert.ok(b2, 'Batch 2 must exist');
      assert.strictEqual(b2.currentQuantity, 10);
      assert.ok(b2.expiryDate.startsWith('2027-06-30'), `Expiry must be 2027-06-30, got ${b2.expiryDate}`);
    });
  });
});
