import fs from 'fs';
import path from 'path';

// Polyfill Promise.withResolvers
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

import { PdfExtractorProvider } from '../server/src/inventory/document-extraction/providers/pdf-extractor.provider.js';

async function main() {
  const pdfPath = 'C:/Users/drsha/.gemini/antigravity-ide/brain/f2281a6c-8c68-4aa2-b350-c676ddca4158/.user_uploaded/media_1791167207317.pdf';
  const buffer = fs.readFileSync(pdfPath);
  console.log(`Loaded PDF: ${pdfPath}, size: ${buffer.length} bytes`);

  const provider = new PdfExtractorProvider();
  const startTime = Date.now();
  const result = await provider.extractDocument({
    buffer,
    fileName: 'JJ_PHARMA_INVOICE.pdf',
    mimeType: 'application/pdf',
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n=== EXTRACTION RESULT (Completed in ${elapsed}s) ===`);
  console.log(`Supplier Name: ${result.supplier.name}`);
  console.log(`Supplier GSTIN: ${result.supplier.gstin}`);
  console.log(`Supplier Phone: ${result.supplier.phone}`);
  console.log(`Supplier DL No: ${result.supplier.dlNo}`);
  console.log(`Supplier State: ${result.supplier.state}`);
  console.log(`Customer:`, result.customer);
  console.log(`Invoice Number: ${result.invoice.invoiceNumber}`);
  console.log(`Invoice Date: ${result.invoice.invoiceDate}`);
  console.log(`Due Date: ${result.invoice.dueDate}`);
  console.log(`Total Amount: ${result.invoice.totalAmount}`);
  console.log(`Total Items Detected in Summary: ${result.invoice.totalItems}`);
  console.log(`Total Quantity: ${result.invoice.totalQuantity}`);
  console.log(`Total Line Items Extracted: ${result.lineItems.length}`);

  const foundNums = new Set();
  for (const item of result.lineItems) {
    const m = item.rawOcrText?.match(/^\s*(\d+)\./);
    if (m) foundNums.add(parseInt(m[1], 10));
  }
  const missing = [];
  for (let i = 1; i <= 117; i++) {
    if (!foundNums.has(i)) missing.push(i);
  }
  console.log(`\nMissing line numbers (out of 117):`, missing);

  if (result.lineItems.length > 0) {
    console.log(`\n--- First 3 Line Items ---`);
    console.log(result.lineItems.slice(0, 3));
    console.log(`\n--- Middle Items Around Page Boundaries (Items 29-32) ---`);
    console.log(result.lineItems.slice(28, 33));
    console.log(`\n--- Last 3 Line Items ---`);
    console.log(result.lineItems.slice(-3));
  }
}

main().catch(console.error);
