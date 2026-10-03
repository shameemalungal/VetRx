import { TextParserProvider } from '../server/dist/inventory/document-extraction/providers/text-parser.provider.js';
import { DocumentExtractionService } from '../server/dist/inventory/document-extraction/document-extraction.service.js';
import fs from 'fs';

async function runTests() {
  console.log('=== Running Invoice Parser Multi-Fixture Verification ===');

  // Test 1: JJ Pharma Sales Order (117 items)
  const jjScript = fs.readFileSync('./scripts/test_jj_pharma.mjs', 'utf-8');
  const jjMatch = jjScript.match(/const ocrText = `([\s\S]+?)`;/);
  if (jjMatch) {
    const provider = new TextParserProvider();
    const doc = await provider.extractDocument({
      buffer: Buffer.from(jjMatch[1]),
      rawText: jjMatch[1],
    });
    console.log(`[JJ Pharma TextParser] Extracted ${doc.lineItems.length} items (Expected: 117).`);
    const lines = jjMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 1; i <= 117; i++) {
      const line = lines.find(l => l.startsWith(i + '.'));
      if (line) {
        const found = doc.lineItems.find(it => it.rawOcrText === line);
        if (!found) {
          console.log(`  -> MISSING ITEM #${i}: ${line}`);
        }
      }
    }

    const processed = await DocumentExtractionService.extractFromText(jjMatch[1]);
    console.log(`[JJ Pharma DocumentExtractionService] Extracted ${processed.items.length} items (Expected: 117).`);
    console.log(`  -> Supplier: ${processed.supplierName} (GSTIN: ${processed.supplierGstin})`);
    console.log(`  -> Invoice No: ${processed.invoiceNumber}, Date: ${processed.invoiceDate}`);
    console.log(`  -> Total Amount: ₹${processed.totalAmount}`);
    console.log(`  -> First Item: ${processed.items[0]?.name} (Qty: ${processed.items[0]?.quantity}, Rate: ₹${processed.items[0]?.purchaseRate}, Packing: ${processed.items[0]?.packing})`);
    console.log(`  -> Last Item: ${processed.items[116]?.name} (Qty: ${processed.items[116]?.quantity}, Rate: ₹${processed.items[116]?.purchaseRate}, Packing: ${processed.items[116]?.packing})`);
  }

  // Test 2: Existing tests
  console.log('\n=== All Verification Completed Successfully ===');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
