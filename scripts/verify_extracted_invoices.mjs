import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const { DocumentExtractionService } = await import('../server/dist/inventory/document-extraction/document-extraction.service.js');

  console.log('===============================================================');
  console.log('TEST 1: MYTHRI PHARMA INVOICE (IMAGE)');
  console.log('===============================================================');

  const mythriPath = path.resolve(__dirname, '../test_assets/mythri_invoice.jpg');
  if (fs.existsSync(mythriPath)) {
    const mythriBuf = fs.readFileSync(mythriPath);
    const start = Date.now();
    const res = await DocumentExtractionService.extractDocument(mythriBuf, 'image/jpeg');
    const elapsed = Date.now() - start;

    console.log(`Extracted in ${elapsed}ms`);
    console.log('Supplier:', res.supplierName);
    console.log('GSTIN:', res.supplierGstin);
    console.log('Invoice No:', res.invoiceNumber);
    console.log('Invoice Date:', res.invoiceDate);
    console.log('Total Amount:', res.totalAmount);
    console.log(`Detected Items Count: ${res.items.length} (Expected: 9)`);

    console.table(
      res.items.map((it) => ({
        '#': it.lineNumber,
        Name: it.name,
        Packing: it.packing,
        HSN: it.hsnCode,
        Batch: it.batchNumber,
        Exp: it.expiryDate,
        Qty: it.quantity,
        MRP: it.mrp,
        Rate: it.purchaseRate,
        'Taxable (₹)': it.taxableValue,
      }))
    );

    if (res.items.length === 9) {
      console.log('✅ TEST 1 PASSED: Exactly 9 items extracted with 0 noise/contamination.');
    } else {
      console.error(`❌ TEST 1 FAILED: Expected 9 items, got ${res.items.length}`);
    }
  } else {
    console.warn('⚠️ Mythri invoice asset not found at:', mythriPath);
  }

  console.log('\n===============================================================');
  console.log('TEST 2: KIMS MEDICAL AGENCIES INVOICE (TEXT)');
  console.log('===============================================================');

  const kimsSample = `
TAX INVOICE
KIMS MEDICAL AGENCIES
PHARMA DISTRIBUTORS, CALICUT
GSTIN: 32AABCK1234F1Z5
Invoice No: KIMS/2026/1102    Date: 15-09-2026

SNo  Particulars                      Packing  HSN       Batch    Exp     Qty  MRP     Rate    GST%  Amount
1    CEFTRIAXONE 1G INJECTION         1 VIAL   30042099  CFX901   09/28   20   65.00   42.00   5     840.00
2    AMIKACIN 500MG INJECTION         2ML      30042099  AMK402   11/27   15   85.00   55.00   5     825.00
3    MELOXICAM 5MG/ML INJECTION       30ML     30049085  MLX109   04/28   10   120.00  78.00   5     780.00
4    TRAMADOL 50MG/ML INJ             2ML      30049099  TRM882   01/29   25   45.00   28.00   5     700.00
5    ENROFLOXACIN 10% INJECTION       50ML     30049085  ENR331   08/27   8    210.00  145.00  5     1160.00
6    IVERMECTIN 1% INJECTION          10ML     30049085  IVM552   06/28   12   95.00   62.00   5     744.00
7    DEXAMETHASONE 4MG/ML INJ         5ML      30049099  DEX119   10/28   30   25.00   14.50   5     435.00
8    ATROPINE SULPHATE INJ            10ML     30049099  ATR772   03/29   10   35.00   21.00   5     210.00
9    METRONIDAZOLE INFUSION 100ML     100ML    30049099  MTZ901   12/27   20   40.00   24.00   5     480.00
10   PANTOPRAZOLE 40MG INJECTION      1 VIAL   30049099  PAN663   05/28   15   55.00   34.00   5     510.00
11   FUROSEMIDE 10MG/ML INJECTION     2ML      30049099  FRS229   07/28   20   30.00   18.00   5     360.00
12   ONDANSETRON 2MG/ML INJECTION     2ML      30049099  OND881   02/29   25   38.00   22.50   5     562.50
13   VITAMIN B-COMPLEX + LIVER EXT    30ML     30049085  VBC104   09/27   10   110.00  72.00   5     720.00
14   NORMAL SALINE 0.9% 500ML BOTTLE  500ML    30049099  NS5001   11/29   50   48.00   29.00   5     1450.00

Total Items: 14   Total Qty: 280
Total Taxable: ₹9,776.50
Total GST: ₹488.83
Net Payable: ₹10,265.33
`;

  const kimsRes = await DocumentExtractionService.extractFromText(kimsSample);
  console.log('Supplier:', kimsRes.supplierName);
  console.log('Invoice No:', kimsRes.invoiceNumber);
  console.log('Detected Items Count:', kimsRes.items.length, '(Expected: 14)');

  console.table(
    kimsRes.items.map((it) => ({
      '#': it.lineNumber,
      Name: it.name,
      Packing: it.packing,
      HSN: it.hsnCode,
      Batch: it.batchNumber,
      Exp: it.expiryDate,
      Qty: it.quantity,
      MRP: it.mrp,
      Rate: it.purchaseRate,
      'Taxable (₹)': it.taxableValue,
    }))
  );

  if (kimsRes.items.length === 14) {
    console.log('✅ TEST 2 PASSED: Exactly 14 items extracted.');
  } else {
    console.error(`❌ TEST 2 FAILED: Expected 14 items, got ${kimsRes.items.length}`);
  }
}

run().catch(console.error);
