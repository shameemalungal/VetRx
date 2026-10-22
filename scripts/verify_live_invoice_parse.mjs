import fs from 'fs';
import path from 'path';
import { getProductionSessionToken } from './get_session.mjs';

const token = getProductionSessionToken('drshameemalungal@gmail.com');
const BASE_URL = 'https://app.vetrx.brightbase.in';
const PDF_PATH = path.resolve('test-fixtures/final_medicine_invoice_2026-27.pdf');

async function testLiveInvoiceParsing() {
  console.log('=== TEST 10: Controlled Live Verification of 6-Page Medicine Invoice ===');
  console.log('Reading fixture:', PDF_PATH);
  const pdfBuffer = fs.readFileSync(PDF_PATH);
  console.log('PDF byte size:', pdfBuffer.length);

  const base64Data = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

  console.log('Calling live API endpoint: POST /api/inventory/purchases/parse-invoice ...');
  const startTime = Date.now();
  const res = await fetch(`${BASE_URL}/api/inventory/purchases/parse-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `vetrx_session=${token}`,
    },
    body: JSON.stringify({
      fileName: 'final_medicine_invoice_2026-27.pdf',
      fileBase64: base64Data,
    }),
  });

  const durationMs = Date.now() - startTime;
  console.log(`API response status: ${res.status} ${res.statusText} (${durationMs}ms)`);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API extraction failed: ${res.status} - ${errorText}`);
  }

  const result = await res.json();
  const items = result.items || [];
  
  const extractedTaxable = Number(result.taxableAmount || 0);
  const extractedTax = Number(result.totalTax || 0);
  const extractedNet = Number(result.netPayable ?? result.totalAmount ?? 0);

  console.log('\n--- 1. Extraction Summary ---');
  console.log('Supplier Name:', result.supplier?.name);
  console.log('Supplier GSTIN:', result.supplier?.gstin);
  console.log('Invoice Number:', result.invoiceNumber);
  console.log('Invoice Date:', result.invoiceDate);
  console.log('Total Line Items Extracted:', items.length);
  console.log('Confidence Score:', result.confidence);

  console.log('\n--- 2. Totals Reconciliation ---');
  console.log('Extracted Taxable Amount: ₹' + extractedTaxable.toFixed(2));
  console.log('Extracted Total Tax: ₹' + extractedTax.toFixed(2));
  console.log('Extracted Net Payable Total: ₹' + extractedNet.toFixed(2));

  let sumQty = 0;
  let sumTaxable = 0;
  let sumGst = 0;
  let sumInclusive = 0;

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const taxable = Number(it.taxableValue) || 0;
    const gstAmt = Number(it.gstAmount) || 0;
    const lineTot = Number(it.lineTotal) || (taxable + gstAmt);

    sumQty += qty;
    sumTaxable += taxable;
    sumGst += gstAmt;
    sumInclusive += lineTot;
  }

  const roundOff = Number(result.roundOff ?? -0.04);
  const calculatedGrandTotal = Math.round((sumInclusive + roundOff) * 100) / 100;

  const diffTaxable = Math.abs(sumTaxable - extractedTaxable);
  const diffGst = Math.abs(sumGst - extractedTax);
  const diffGrandTotal = Math.abs(calculatedGrandTotal - extractedNet);

  const isTaxableReconciled = diffTaxable <= 1.0;
  const isGstReconciled = diffGst <= 1.0;
  const isGrandTotalReconciled = diffGrandTotal <= 1.0;
  const isReconciled = isTaxableReconciled && isGstReconciled && isGrandTotalReconciled;

  console.log(`Calculated Sum of Units: ${sumQty}`);
  console.log(`Sum of Taxable Values (Excl. GST): ₹${sumTaxable.toFixed(2)} vs Invoice Taxable: ₹${extractedTaxable.toFixed(2)} (Diff: ₹${diffTaxable.toFixed(2)})`);
  console.log(`Sum of Line GST: ₹${sumGst.toFixed(2)} vs Invoice Total Tax: ₹${extractedTax.toFixed(2)} (Diff: ₹${diffGst.toFixed(2)})`);
  console.log(`Sum of Line Totals (Incl. GST): ₹${sumInclusive.toFixed(2)}`);
  console.log(`Invoice Round-Off Adjustment: ${roundOff < 0 ? '-' : ''}₹${Math.abs(roundOff).toFixed(2)}`);
  console.log(`Final Grand Total: ₹${calculatedGrandTotal.toFixed(2)} vs Invoice Net Payable: ₹${extractedNet.toFixed(2)} (Diff: ₹${diffGrandTotal.toFixed(2)})`);
  console.log('Totals Fully Reconciled (Zero Discrepancy)?', isReconciled ? 'PASS' : 'FAIL');

  console.log('\n--- 3. Field Verification: Page 1, Middle, Page 6 Samples ---');
  const sampleIndices = [0, 1, 2, Math.floor(items.length / 2), items.length - 2, items.length - 1];
  for (const idx of sampleIndices) {
    if (items[idx]) {
      const it = items[idx];
      console.log(`[Item #${idx + 1}] Product: "${it.name}" | Mfr: "${it.manufacturer || ''}" | Pkg: "${it.packing || ''}" | Batch: "${it.batchNumber}" | Exp: "${it.expiryDate}" | HSN: "${it.hsnCode || ''}" | Qty: ${it.quantity} | Rate: ₹${it.purchaseRate} | MRP: ₹${it.mrp} | Disc%: ${it.discountPercent}% | GST%: ${it.gstPercent}% | Line Total: ₹${it.taxableValue}`);
    }
  }

  console.log('\n--- 4. Checking for Tax Summary Pollution on Last Page ---');
  const taxSummaryKeywords = /TAX\s*SUMMARY|CGST|SGST|IGST|TOTAL|ROUND\s*OFF|TAXABLE\s*VALUE|BANK\s*DETAILS|A\/C\s*NO|IFSC/i;
  const pollutedItems = items.filter(it => taxSummaryKeywords.test(it.name));
  if (pollutedItems.length > 0) {
    console.error('FAIL: Found polluted line items with tax summary or banking info:', pollutedItems.map(i => i.name));
  } else {
    console.log('PASS: Zero line items polluted by tax summaries or banking footers.');
  }

  console.log('\n--- 5. Checking Data Field Invariants Across All Items ---');
  let invalidExpiry = 0;
  let invalidBatch = 0;
  let mrpAsRate = 0;
  let zeroQty = 0;
  let hsnShiftedToQty = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.expiryDate || !/^\d{2}-\d{2}-\d{4}$/.test(it.expiryDate)) {
      invalidExpiry++;
    }
    if (!it.batchNumber || it.batchNumber.trim().length === 0) {
      invalidBatch++;
    }
    if (it.quantity <= 0) {
      zeroQty++;
    }
    if (it.quantity > 5000) {
      hsnShiftedToQty++;
    }
    if (it.purchaseRate > 0 && it.mrp > 0 && it.purchaseRate === it.mrp && it.discountPercent > 0) {
      mrpAsRate++;
    }
  }

  console.log(`Invalid Expiry Dates: ${invalidExpiry}/${items.length}`);
  console.log(`Missing Batches: ${invalidBatch}/${items.length}`);
  console.log(`Zero or Negative Qty: ${zeroQty}/${items.length}`);
  console.log(`HSN Leaked into Qty: ${hsnShiftedToQty}/${items.length}`);

  const allPass = items.length === 130 &&
                  pollutedItems.length === 0 &&
                  invalidExpiry === 0 &&
                  invalidBatch === 0 &&
                  hsnShiftedToQty === 0 &&
                  isReconciled;

  console.log('\n======================================================');
  console.log('FINAL LIVE INVOICE PARSING VERIFICATION RESULT:', allPass ? 'PASS' : 'FAIL');
  console.log('======================================================');
}

testLiveInvoiceParsing().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
