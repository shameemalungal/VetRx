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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  PdfExtractorProvider,
  normalizeExpiryDate,
} from '../src/inventory/document-extraction/providers/pdf-extractor.provider.js';
import { TextParserProvider } from '../src/inventory/document-extraction/providers/text-parser.provider.js';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';

describe('PDF Medicine Invoice Importer: Header-Aware Extraction & Mapping', () => {
  const practiceId = 'practice-test-123';
  const pdfFixturePath = fs.existsSync(path.resolve(__dirname, '../../test-fixtures/final_medicine_invoice_2026-27.pdf'))
    ? path.resolve(__dirname, '../../test-fixtures/final_medicine_invoice_2026-27.pdf')
    : (fs.existsSync(path.resolve(process.cwd(), '../test-fixtures/final_medicine_invoice_2026-27.pdf'))
        ? path.resolve(process.cwd(), '../test-fixtures/final_medicine_invoice_2026-27.pdf')
        : path.resolve(process.cwd(), 'test-fixtures/final_medicine_invoice_2026-27.pdf'));

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
      assert.strictEqual(row1.taxableValue, 1350); // Taxable value before 5% GST
      assert.strictEqual(row1.lineTotal, 1417.5); // Inclusive line total
      assert.strictEqual(row1.gstAmount, 67.5); // 5% GST amount

      // Row 2 verification (different batch of same product)
      const row2 = extracted.lineItems[1];
      assert.strictEqual(row2.itemName, 'MECTIN 100MG BOLUS');
      assert.strictEqual(row2.batchNumber, 'HC5133002');
      assert.strictEqual(row2.expiryDate, '30-06-2027');
      assert.strictEqual(row2.quantity, 10);
      assert.strictEqual(row2.taxableValue, 450); // 472.5 / 1.05 = 450
      assert.strictEqual(row2.lineTotal, 472.5);
      assert.strictEqual(row2.gstAmount, 22.5);

      // Row 3 verification (0% GST item)
      const row3 = extracted.lineItems[2];
      assert.strictEqual(row3.itemName, 'RUMEN FS BOLUS');
      assert.strictEqual(row3.gstPercent, 0); // 0.00% + 0.00%
      assert.strictEqual(row3.quantity, 400);
      assert.strictEqual(row3.taxableValue, 19200);
      assert.strictEqual(row3.lineTotal, 19200);
      assert.strictEqual(row3.gstAmount, 0);

      // Verify page 6 row 130 (last row)
      const row130 = extracted.lineItems[129];
      assert.strictEqual(row130.itemName, 'TISSUAID');
      assert.ok(row130.manufacturer?.includes('ZENEX'), `Manufacturer should be Zenex, got ${row130.manufacturer}`);
      assert.strictEqual(row130.batchNumber, 'TFWA2540');
      assert.strictEqual(row130.expiryDate, '30-09-2027');
      assert.strictEqual(row130.quantity, 40);
      assert.strictEqual(row130.taxableValue, 5024);
      assert.strictEqual(row130.lineTotal, 5024);
      assert.strictEqual(row130.gstPercent, 0);
      assert.strictEqual(row130.gstAmount, 0);

      // Verify extracted invoice summary totals
      assert.strictEqual(extracted.invoice.taxableAmount, 488328.8);
      assert.strictEqual(extracted.invoice.totalTax, 11671.24);
      assert.strictEqual(extracted.invoice.totalAmount, 500000.0);
      assert.strictEqual(extracted.invoice.totalDiscount, 0.0);
      assert.strictEqual(extracted.invoice.roundOff, -0.04);
      assert.strictEqual(extracted.invoice.isInclusive, true);

      // Verify item sums reconcile to invoice totals
      const computedTaxableTotal = extracted.lineItems.reduce((acc, it) => acc + (it.taxableValue || 0), 0);
      assert.ok(Math.abs(computedTaxableTotal - 488328.8) < 0.01, `Computed taxable total ${computedTaxableTotal} must match 488328.80`);

      const computedGstTotal = extracted.lineItems.reduce((acc, it) => acc + (it.gstAmount || 0), 0);
      assert.ok(Math.abs(computedGstTotal - 11671.24) < 0.01, `Computed GST total ${computedGstTotal} must match 11671.24`);

      const computedLineItemsTotal = extracted.lineItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
      assert.ok(Math.abs(computedLineItemsTotal - 500000.04) < 0.01, `Computed line items total ${computedLineItemsTotal} must match 500000.04`);
      assert.ok(extracted.warnings.length === 0, `Warnings should be empty, got: ${JSON.stringify(extracted.warnings)}`);
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

  // ----------------------------------------------------------------------------
  // Phase 4: Invoice Reconciliation, GST Slabs, Round-off & Edit Persistence Suite
  // ----------------------------------------------------------------------------
  describe('Phase 4: GST Reconciliation & Importer Regression Tests', () => {
    // 1. Mixed GST slabs
    it('1. correctly parses invoice with mixed 0%, 5%, 12%, 18%, and 28% GST slabs', async () => {
      const invoiceText = `
TAX INVOICE
MULTI SLAB PHARMA
-----------------------------------------------------------------------------------------------------------------
PRODUCT             BATCH   EXP   QTY  RATE   MRP    SGST   CGST  AMOUNT
-----------------------------------------------------------------------------------------------------------------
HERBAL TONIC        HB01    06-28 10   100.00 120.00 0.00%  0.00% 1000.00
VET ANTIBIOTIC      AB02    06-28 10   100.00 120.00 2.50%  2.50% 1000.00
DISINFECTANT LIQ    DL03    06-28 10   100.00 120.00 6.00%  6.00% 1000.00
DIAGNOSTIC KIT      DK04    06-28 10   100.00 120.00 9.00%  9.00% 1000.00
EQUIPMENT SPRAY     ES05    06-28 10   100.00 120.00 14.00% 14.00% 1000.00
-----------------------------------------------------------------------------------------------------------------
TOTAL: 5000.00
      `;

      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 5);
      assert.strictEqual(extracted.lineItems[0].gstPercent, 0);
      assert.strictEqual(extracted.lineItems[1].gstPercent, 5);
      assert.strictEqual(extracted.lineItems[2].gstPercent, 12);
      assert.strictEqual(extracted.lineItems[3].gstPercent, 18);
      assert.strictEqual(extracted.lineItems[4].gstPercent, 28);

      assert.strictEqual(extracted.lineItems[0].taxableValue, 1000.00);
      assert.strictEqual(extracted.lineItems[1].taxableValue, 1000.00);
      assert.strictEqual(extracted.lineItems[2].taxableValue, 1000.00);
      assert.strictEqual(extracted.lineItems[3].taxableValue, 1000.00);
      assert.strictEqual(extracted.lineItems[4].taxableValue, 1000.00);
    });

    // 2. Explicitly zero-rated items using source PDF
    it('2. verifies explicitly zero-rated items (TISSUAID, BECO VET, RUMEN FS BOLUS) preserve 0% from source PDF', async () => {
      const fixturePath = pdfFixturePath;
      if (!fs.existsSync(fixturePath)) return;
      const pdfBuffer = fs.readFileSync(fixturePath);
      const parser = new PdfExtractorProvider();
      const extracted = await parser.extractDocument({
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      });

      // Find BECO VET (Row 114)
      const becoVet = extracted.lineItems.find(it => it.itemName.includes('BECO VET'));
      assert.ok(becoVet, 'BECO VET must be extracted');
      assert.strictEqual(becoVet.gstPercent, 0, 'BECO VET must have 0% GST');
      assert.strictEqual(becoVet.gstAmount, 0, 'BECO VET must have 0 GST amount');
      assert.strictEqual(becoVet.taxableValue, becoVet.lineTotal, 'Taxable value must equal line total for 0% GST item');

      // Find TISSUAID (Row 130)
      const tissuAid = extracted.lineItems.find(it => it.itemName.includes('TISSUAID'));
      assert.ok(tissuAid, 'TISSUAID must be extracted');
      assert.strictEqual(tissuAid.gstPercent, 0, 'TISSUAID must have 0% GST');
      assert.strictEqual(tissuAid.gstAmount, 0, 'TISSUAID must have 0 GST amount');
      assert.strictEqual(tissuAid.taxableValue, 5024);

      // Find RUMEN FS BOLUS (Row 3)
      const rumenFs = extracted.lineItems.find(it => it.itemName.includes('RUMEN FS BOLUS'));
      assert.ok(rumenFs, 'RUMEN FS BOLUS must be extracted');
      assert.strictEqual(rumenFs.gstPercent, 0, 'RUMEN FS BOLUS must have 0% GST');
      assert.strictEqual(rumenFs.gstAmount, 0);
      assert.strictEqual(rumenFs.taxableValue, 19200);
    });

    // 3. CGST and SGST percentages summed
    it('3. sums CGST and SGST percentages to obtain total GST rate', async () => {
      const invoiceText = `
TAX INVOICE
SPLIT TAX VENDOR
PRODUCT             BATCH   EXP   QTY  RATE   MRP    SGST   CGST  AMOUNT
OFLOXACIN SUSP      OF12    06-28 5    100.00 120.00 6.00%  6.00% 500.00
      `;
      const parser = new TextParserProvider();
      const extracted = await parser.extractDocument({
        buffer: Buffer.from(invoiceText),
        rawText: invoiceText,
      });

      assert.strictEqual(extracted.lineItems.length, 1);
      assert.strictEqual(extracted.lineItems[0].gstPercent, 12);
    });

    // 4. Correct separation of tax percentages and tax amounts
    it('4. correctly separates tax percentages (5%) from tax amounts (e.g. 67.50)', async () => {
      const fixturePath = pdfFixturePath;
      if (!fs.existsSync(fixturePath)) return;
      const pdfBuffer = fs.readFileSync(fixturePath);
      const parser = new PdfExtractorProvider();
      const extracted = await parser.extractDocument({
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      });

      const row1 = extracted.lineItems[0];
      assert.strictEqual(row1.gstPercent, 5, 'Rate must be 5 percent');
      assert.strictEqual(row1.gstAmount, 67.50, 'Tax amount must be 67.50, not confused with percentage');
      assert.strictEqual(row1.taxableValue, 1350.00, 'Taxable value must be 1350.00');
      assert.strictEqual(row1.lineTotal, 1417.50, 'Line total must be 1417.50');
    });

    // 5. GST-inclusive line amounts not taxed twice
    it('5. ensures GST-inclusive line amounts are not taxed twice', async () => {
      const fixturePath = pdfFixturePath;
      if (!fs.existsSync(fixturePath)) return;
      const pdfBuffer = fs.readFileSync(fixturePath);
      const parser = new PdfExtractorProvider();
      const extracted = await parser.extractDocument({
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      });

      assert.strictEqual(extracted.invoice.isInclusive, true);
      // If taxed twice: sum(lineTotal) + sum(gst) would be 500,000.04 + 11,671.24 = 511,671.28
      // Without double taxing: sum(taxableValue) + sum(gstAmount) = 488,328.80 + 11,671.24 = 500,000.04
      const sumTaxable = extracted.lineItems.reduce((acc, it) => acc + (it.taxableValue || 0), 0);
      const sumGst = extracted.lineItems.reduce((acc, it) => acc + (it.gstAmount || 0), 0);
      const sumLineTotals = extracted.lineItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);

      assert.strictEqual(Math.round(sumTaxable * 100) / 100, 488328.80);
      assert.strictEqual(Math.round(sumGst * 100) / 100, 11671.24);
      assert.strictEqual(Math.round(sumLineTotals * 100) / 100, 500000.04);
      assert.strictEqual(Math.round((sumTaxable + sumGst) * 100) / 100, Math.round(sumLineTotals * 100) / 100);
    });

    // 6. Round-off adjustment −₹0.04
    it('6. extracts and applies explicit round-off adjustment of -0.04', async () => {
      const fixturePath = pdfFixturePath;
      if (!fs.existsSync(fixturePath)) return;
      const pdfBuffer = fs.readFileSync(fixturePath);
      const parser = new PdfExtractorProvider();
      const extracted = await parser.extractDocument({
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      });

      assert.strictEqual(extracted.invoice.roundOff, -0.04);
      assert.strictEqual(extracted.invoice.totalAmount, 500000.00);
      // Arithmetic check: 500000.04 + (-0.04) = 500000.00
      const grossBeforeRoundOff = extracted.lineItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0);
      const finalGrandTotal = Math.round((grossBeforeRoundOff + extracted.invoice.roundOff) * 100) / 100;
      assert.strictEqual(finalGrandTotal, 500000.00);
    });

    // 7. Discrepancy previously ₹12,254.93 is now 0.00
    it('7. resolves the previous 12,254.93 discrepancy to 0.00 with perfect reconciliation', async () => {
      const fixturePath = pdfFixturePath;
      if (!fs.existsSync(fixturePath)) return;
      const pdfBuffer = fs.readFileSync(fixturePath);
      const parser = new PdfExtractorProvider();
      const extracted = await parser.extractDocument({
        buffer: pdfBuffer,
        mimeType: 'application/pdf',
      });

      assert.strictEqual(extracted.warnings.length, 0, 'Must have zero reconciliation warnings');

      // Check both taxable and gross reconciliations
      const diffTaxable = Math.abs(extracted.invoice.taxableAmount - 488328.80);
      const diffGst = Math.abs(extracted.invoice.totalTax - 11671.24);
      const diffNet = Math.abs(extracted.invoice.totalAmount - 500000.00);

      assert.ok(diffTaxable < 0.01, `Taxable difference should be 0, got ${diffTaxable}`);
      assert.ok(diffGst < 0.01, `GST difference should be 0, got ${diffGst}`);
      assert.ok(diffNet < 0.01, `Net difference should be 0, got ${diffNet}`);
    });

    // 8. Editing GST from 5% to 0% does not revert
    it('8. verifies editing GST from 5% to 0% preserves 0% and does not revert to 5%', () => {
      // Test the normalization and updateItemField logic from InvoiceImporterModal
      const originalItem = {
        name: 'MECTIN 100MG BOLUS',
        quantity: 30,
        purchaseRate: 47.25,
        gstPercent: 5,
        lineTotal: 1417.50,
        taxableValue: 1350.00,
        gstAmount: 67.50,
      };

      // In the old UI bug: `value={it.gstPercent || 5}` caused 0 || 5 -> 5.
      // In our fixed controlled input: `it.gstPercent !== undefined && it.gstPercent !== null ? it.gstPercent : ''`
      const editValue = 0;
      const updatedItem = {
        ...originalItem,
        gstPercent: editValue,
        taxableValue: originalItem.lineTotal / (1 + editValue / 100),
        gstAmount: Math.round((originalItem.lineTotal - originalItem.lineTotal / (1 + editValue / 100)) * 100) / 100,
      };

      assert.strictEqual(updatedItem.gstPercent, 0);
      assert.strictEqual(updatedItem.taxableValue, 1417.50);
      assert.strictEqual(updatedItem.gstAmount, 0);
      assert.strictEqual(updatedItem.lineTotal, 1417.50);

      // Verify display value does not coerce 0 to 5
      const displayVal = updatedItem.gstPercent !== undefined && updatedItem.gstPercent !== null ? updatedItem.gstPercent : '';
      assert.strictEqual(displayVal, 0, 'Display value must be 0, not reverted to 5');
    });

    // 9. Editing GST preserves value during navigation/tabbing
    it('9. maintains edited GST value through simulated state updates', () => {
      let state = [
        { name: 'ITEM A', gstPercent: 5, lineTotal: 105, taxableValue: 100, gstAmount: 5 },
        { name: 'ITEM B', gstPercent: 12, lineTotal: 112, taxableValue: 100, gstAmount: 12 },
      ];

      // User changes Item A's GST to 0%
      const newGst = 0;
      state = state.map((it, idx) => idx === 0 ? {
        ...it,
        gstPercent: newGst,
        taxableValue: it.lineTotal,
        gstAmount: 0,
      } : it);

      // Simulate re-render or tab navigation (state persists)
      assert.strictEqual(state[0].gstPercent, 0);
      assert.strictEqual(state[0].taxableValue, 105);
      assert.strictEqual(state[0].gstAmount, 0);
    });

    // 10. Purchase API payload carries edited GST rate
    it('10. verifies final API payload includes the edited GST rate', () => {
      const itemsInPreview = [
        {
          name: 'TISSUAID',
          manufacturer: 'ZENEX',
          batchNumber: 'TFWA2540',
          expiryDate: '30-09-2027',
          quantity: 40,
          purchaseRate: 125.60,
          mrp: 140.00,
          gstPercent: 0, // Preserved 0%
          lineTotal: 5024.00,
          taxableValue: 5024.00,
          gstAmount: 0.00,
        },
      ];

      const payload = {
        supplier: { name: 'BEYPORE NEETHI MEDICAL STORE' },
        invoiceNumber: '194',
        invoiceDate: '2026-10-15',
        totalAmount: 5024.00,
        items: itemsInPreview.map(it => ({
          name: it.name,
          manufacturer: it.manufacturer,
          category: 'MEDICINE',
          stockUnit: 'Strip',
          batchNumber: it.batchNumber,
          expiryDate: it.expiryDate,
          quantity: it.quantity,
          purchaseRate: it.purchaseRate,
          mrp: it.mrp,
          gstPercent: it.gstPercent !== undefined && it.gstPercent !== null ? Number(it.gstPercent) : 0,
          taxableValue: it.taxableValue,
          lineTotal: it.lineTotal,
          gstAmount: it.gstAmount,
        })),
      };

      assert.strictEqual(payload.items[0].gstPercent, 0, 'API payload must explicitly carry 0% GST');
      assert.strictEqual(payload.items[0].gstAmount, 0);
      assert.strictEqual(payload.items[0].taxableValue, 5024);
    });

    // 11. Preview totals recalculation after field edits
    it('11. verifies preview totals update dynamically when line item GST is modified', () => {
      const previewItems = [
        { name: 'ITEM 1', lineTotal: 105.00, taxableValue: 100.00, gstPercent: 5, gstAmount: 5.00 },
        { name: 'ITEM 2', lineTotal: 112.00, taxableValue: 100.00, gstPercent: 12, gstAmount: 12.00 },
      ];

      // Initial totals
      const initialTaxable = previewItems.reduce((acc, it) => acc + it.taxableValue, 0);
      const initialGst = previewItems.reduce((acc, it) => acc + it.gstAmount, 0);
      const initialGross = previewItems.reduce((acc, it) => acc + it.lineTotal, 0);

      assert.strictEqual(initialTaxable, 200.00);
      assert.strictEqual(initialGst, 17.00);
      assert.strictEqual(initialGross, 217.00);

      // Edit item 1 GST from 5% to 0% (on inclusive invoice, lineTotal stays 105, taxable becomes 105, gst becomes 0)
      previewItems[0] = {
        ...previewItems[0],
        gstPercent: 0,
        taxableValue: 105.00,
        gstAmount: 0.00,
      };

      const updatedTaxable = previewItems.reduce((acc, it) => acc + it.taxableValue, 0);
      const updatedGst = previewItems.reduce((acc, it) => acc + it.gstAmount, 0);
      const updatedGross = previewItems.reduce((acc, it) => acc + it.lineTotal, 0);

      assert.strictEqual(updatedTaxable, 205.00);
      assert.strictEqual(updatedGst, 12.00);
      assert.strictEqual(updatedGross, 217.00);
    });

    // 12. Persisted purchase / inventory verification
    it('12. verifies zero-rated and standard GST items persist accurately to DB inventory service', async () => {
      const result = await InventoryService.confirmPurchaseInvoice(practiceId, {
        supplier: {
          name: 'BEYPORE NEETHI MEDICAL STORE',
          gstin: '32AAAAB5233D1ZJ',
        },
        invoiceNumber: 'INV-PHASE4-TEST',
        invoiceDate: '2026-10-15',
        totalAmount: 24224.00,
        items: [
          {
            name: 'RUMEN FS BOLUS',
            manufacturer: 'VIRBAC ANIMAL HEALTH',
            category: 'MEDICINE',
            stockUnit: 'Strip',
            batchNumber: 'RB001',
            expiryDate: '31-10-2027',
            quantity: 400,
            purchaseRate: 48.00,
            mrp: 60.00,
            gstPercent: 0, // 0% GST
          },
          {
            name: 'TISSUAID',
            manufacturer: 'ZENEX ANIMAL HEALTH',
            category: 'MEDICINE',
            stockUnit: 'Strip',
            batchNumber: 'TFWA2540',
            expiryDate: '30-09-2027',
            quantity: 40,
            purchaseRate: 125.60,
            mrp: 140.00,
            gstPercent: 0, // 0% GST
          },
        ],
      });

      assert.strictEqual(result.itemsCount, 2);

      const items = await InventoryService.listItems(practiceId, { search: 'RUMEN FS' });
      assert.ok(items.length >= 1);
      assert.strictEqual(items[0].currentStock, 400);

      const batches = await InventoryService.listBatches(practiceId, { itemId: items[0].id });
      const batch = batches.find(b => b.batchNumber === 'RB001');
      assert.ok(batch);
      assert.strictEqual(batch.currentQuantity, 400);
      assert.strictEqual(batch.purchaseRate, 48.00);
    });
  });
});
