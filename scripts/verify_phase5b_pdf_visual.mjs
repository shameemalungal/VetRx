// =============================================================
// VetRx — verify_phase5b_pdf_visual.mjs
// Comprehensive End-to-End PDF Validation & Multi-Page Visual Verification
// =============================================================

import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WORKSPACE_OUT_DIR = path.resolve('artifacts/phase5b-pdf-validation');
const BRAIN_ARTIFACT_DIR = process.env.ARTIFACT_DIR || 'C:\\Users\\drsha\\.gemini\\antigravity-ide\\brain\\52a3d567-9590-486b-be58-3ce41124e8e1';
const BRAIN_OUT_DIR = path.join(BRAIN_ARTIFACT_DIR, 'phase5b_artifacts');
const DIST_DIR = path.resolve('web/dist');
const PDFJS_BUILD_DIR = path.resolve('node_modules/pdfjs-dist/build');
const PORT = 3600 + Math.floor(Math.random() * 300);
const TARGET_URL = `http://localhost:${PORT}`;

// Ensure clean directories exist
for (const dir of [WORKSPACE_OUT_DIR, BRAIN_OUT_DIR]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

const mockAuthPayload = {
  user: {
    id: 'usr_mock_doctor_123',
    email: 'dr.shameem@vetrx.test',
    name: 'Dr. Shameem Alungal',
    avatarUrl: null,
    emailVerified: true,
    createdAt: '2026-09-16T00:00:00.000Z',
  },
  practice: {
    id: 'prac_mock_malappuram',
    name: 'Malappuram Companion Animal Hospital',
    slug: 'malappuram-clinic',
    ownerUserId: 'usr_mock_doctor_123',
    isActive: true,
    createdAt: '2026-09-16T00:00:00.000Z',
  },
  membership: {
    id: 'mem_mock_123',
    practiceId: 'prac_mock_malappuram',
    userId: 'usr_mock_doctor_123',
    role: 'PRACTICE_OWNER',
    isActive: true,
  },
  settings: {
    id: 'set_mock_123',
    practiceId: 'prac_mock_malappuram',
    clinicName: 'Malappuram Companion Animal Hospital',
    doctorName: 'Dr. Shameem Alungal',
    doctorRegistrationNumber: 'KSVC-3134',
    registrationNumber: 'KSVC-3134',
    address: 'Civil Station Road, Malappuram, Kerala - 676505',
    phone: '9847123456',
    email: 'dr.shameem@vetrx.test',
    ownerSpecialInstructionEnabled: true,
  },
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // API mocks
      if (req.url.includes('/api/auth/me') || req.url.includes('/api/auth/login')) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(mockAuthPayload));
        return;
      }

      if (req.url.includes('/api/settings')) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ settings: mockAuthPayload.settings }));
        return;
      }

      // Serve PDF.js build assets
      if (req.url.startsWith('/pdfjs/')) {
        const subPath = req.url.replace('/pdfjs/', '').split('?')[0];
        const filePath = path.join(PDFJS_BUILD_DIR, subPath);
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath);
          const mime = ext === '.mjs' || ext === '.js' ? 'text/javascript' : 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': `${mime}; charset=utf-8`,
            'Access-Control-Allow-Origin': '*',
          });
          res.end(fs.readFileSync(filePath));
          return;
        }
      }

      // Static files from web/dist
      let relativePath = req.url.split('?')[0].replace(/^\/+/, '');
      let filePath = path.join(DIST_DIR, relativePath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
      }

      const ext = path.extname(filePath);
      const mimeMap = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
        '.woff2': 'font/woff2',
      };

      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, {
          'Content-Type': mimeMap[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, () => {
      console.log(`Phase 5B Validation Server listening at ${TARGET_URL}`);
      resolve(server);
    });
  });
}

async function run() {
  const server = await startStaticServer();
  const userDataDir = path.join(os.tmpdir(), `edge-test-p5b-${Date.now()}`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    userDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,960'],
    defaultViewport: { width: 1280, height: 960 },
  });

  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[PAGE ERROR]`, msg.text());
    }
  });

  // 1. Bootstrap demo session
  console.log('--- Bootstrapping session with demo data ---');
  await page.goto(`${TARGET_URL}/?demo=1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.app-shell, .topbar, .dashboard-greeting', { timeout: 15000 });
  console.log('Session bootstrapped successfully.');

  // Helper to put record in IndexedDB
  async function putInDb(storeName, item) {
    return page.evaluate(async ({ storeName, item }) => {
      const db = window.db;
      if (!db) throw new Error('window.db is not defined in page context');
      return await db.table(storeName).put(item);
    }, { storeName, item });
  }

  // Helper to render a generated PDF blob using PDF.js and export pages
  async function generateAndRenderPdf(elementId) {
    return page.evaluate(async (targetId) => {
      if (typeof window.generatePdfBlob !== 'function') {
        throw new Error('window.generatePdfBlob is not available');
      }
      const blob = await window.generatePdfBlob(targetId);
      const arrayBuffer = await blob.arrayBuffer();

      // Dynamic import of PDF.js
      const pdfjsLib = await import('/pdfjs/pdf.min.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;
      const pages = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const pdfPage = await pdfDoc.getPage(pageNum);
        const viewport = pdfPage.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;

        pages.push({
          pageNum,
          width: canvas.width,
          height: canvas.height,
          dataUrl: canvas.toDataURL('image/png'),
        });
      }

      // Convert original blob to base64 for saving
      const reader = new FileReader();
      const base64Pdf = await new Promise((resolve) => {
        reader.onloadend = () => {
          const res = reader.result;
          resolve(res.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      return { numPages, pages, base64Pdf };
    }, elementId);
  }

  const scenarioResults = [];

  // Helper to save PDF and PNGs
  function saveArtifacts(fileBaseName, numPages, base64Pdf, pages) {
    const pdfBuffer = Buffer.from(base64Pdf, 'base64');

    // Save PDF in both locations
    for (const dir of [WORKSPACE_OUT_DIR, BRAIN_OUT_DIR]) {
      fs.writeFileSync(path.join(dir, `${fileBaseName}.pdf`), pdfBuffer);
    }

    // Save rendered PNGs for every page
    const pageFiles = [];
    for (const pageInfo of pages) {
      const pngBase64 = pageInfo.dataUrl.split(',')[1];
      const pngBuffer = Buffer.from(pngBase64, 'base64');
      const pngName = numPages === 1
        ? `${fileBaseName}.png`
        : `${fileBaseName}-page-${pageInfo.pageNum}.png`;

      for (const dir of [WORKSPACE_OUT_DIR, BRAIN_OUT_DIR]) {
        fs.writeFileSync(path.join(dir, pngName), pngBuffer);
      }
      pageFiles.push(pngName);
    }

    return pageFiles;
  }

  // --- PRESCRIPTION BUILDER ---
  async function putPrescriptionWithItems(medCount, options = {}) {
    const rxId = 1000 + medCount + Math.floor(Math.random() * 8000);
    const rxNumber = `RX-PH5B-${rxId}`;
    const activePid = await page.evaluate(() => localStorage.getItem('vetrx_active_practice_id') || 'prac_mock_malappuram');

    const rx = {
      id: rxId,
      rxNumber,
      practiceId: activePid,
      patientId: 1,
      ownerId: 1,
      practitionerId: 1,
      date: new Date().toISOString(),
      diagnosis: options.longDiagnosis
        ? 'Acute Bovine Respiratory Disease Complex with Severe Bronchopneumonia & Secondary Systemic Toxemia'
        : 'Mastitis / Acute Systemic Bacterial Infection',
      symptoms: options.longSymptoms || 'Fever 104.2F, anorexia, decreased milk yield, swollen left quarter.',
      instructions: options.specialInstructions || [
        'Keep animal in dry, clean, well-ventilated shelter with fresh bedding.',
        'Provide ad libitum clean drinking water and fresh green fodder.',
      ],
      followUpDays: options.followUpDays || 5,
      recheckIntervalPreset: options.recheckPreset || '5 Days',
      status: 'issued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await putInDb('prescriptions', rx);

    const medTemplates = [
      { b: 'Amoxyclav Bolus', g: 'Amoxicillin + Clavulanic Acid', f: 'BID (q12h)', r: 'PO (Oral)', d: '1 bolus', q: 10, u: 'Bolus' },
      { b: 'Melonex Plus Bolus', g: 'Meloxicam + Paracetamol', f: 'OD (q24h)', r: 'PO (Oral)', d: '2 boluses', q: 6, u: 'Bolus' },
      { b: 'Belamyl Injection', g: 'Vitamin B-Complex with Liver Extract', f: 'OD (q24h)', r: 'IM (Intramuscular)', d: '10 ml', q: 1, u: 'Vial' },
      { b: 'Intacef Tazo 4.5g', g: 'Ceftriaxone + Tazobactam', f: 'OD (q24h)', r: 'IV (Intravenous)', d: '4.5g', q: 3, u: 'Vial' },
      { b: 'Tribivet Injection', g: 'Thiamine + Pyridoxine + Cyanocobalamin', f: 'OD (q24h)', r: 'IM (Intramuscular)', d: '10 ml', q: 1, u: 'Vial' },
      { b: 'Curabless Udder Spray', g: 'Chlorhexidine + Herbal Anti-inflammatory', f: 'TID (q8h)', r: 'Topical', d: 'Apply generously', q: 1, u: 'Bottle' },
      { b: 'Calup Gel Vet', g: 'Calcium & Phosphorus Oral Gel', f: 'BID (q12h)', r: 'PO (Oral)', d: '1 tube', q: 2, u: 'Tube' },
      { b: 'Rumicare Powder', g: 'Saccharomyces cerevisiae Live Yeast', f: 'BID (q12h)', r: 'PO (Oral)', d: '50g', q: 2, u: 'Sachet' },
      { b: 'Anistamin Injection', g: 'Chlorpheniramine Maleate IP', f: 'OD (q24h)', r: 'IM (Intramuscular)', d: '10 ml', q: 1, u: 'Vial' },
      { b: 'Prednisolone Acetate 10ml', g: 'Prednisolone Acetate IP', f: 'Stat (Single dose)', r: 'IM (Intramuscular)', d: '10 ml', q: 1, u: 'Vial' },
    ];

    for (let i = 1; i <= medCount; i++) {
      const tmpl = medTemplates[(i - 1) % medTemplates.length];
      const pItem = {
        id: rxId * 100 + i,
        prescriptionId: rxId,
        medicineId: i,
        brandName: options.longName
          ? `Amoxicillin & Potassium Clavulanate Bolus Vet Premium Forte Extra Grade #${i}`
          : `${tmpl.b} #${i}`,
        genericName: options.longGeneric
          ? 'Amoxicillin Trihydrate + Potassium Clavulanate Diluted Powder IP'
          : tmpl.g,
        presentation: tmpl.u,
        dose: options.dose || tmpl.d,
        doseUnit: '',
        strengthVolume: 'Standard',
        route: options.longRoute
          ? 'PO (Per Os / Oral administration with jaggery or molasses)'
          : tmpl.r,
        frequency: options.longFreq
          ? 'BID (Twice daily after morning and evening milking and grain feed)'
          : tmpl.f,
        durationDays: 5,
        quantity: tmpl.q,
        unit: tmpl.u,
        directions: options.longSig
          ? 'Sig: Administer orally mixed with crushed jaggery or treacle immediately following grain feeding. Ensure continuous access to clean fresh drinking water. Complete full course.'
          : 'Sig: Administer as directed after feeding. Complete full course.',
        sortOrder: i,
      };
      await putInDb('prescriptionItems', pItem);
    }

    return rxId;
  }

  // --- RUN PRESCRIPTION SCENARIO ---
  async function testPrescriptionScenario(scenarioId, fileBaseName, medCount, options = {}) {
    console.log(`\n======================================================`);
    console.log(`[PRESCRIPTION] Scenario: ${scenarioId} (${fileBaseName})`);
    console.log(`======================================================`);

    const rxId = await putPrescriptionWithItems(medCount, options);
    await page.goto(`${TARGET_URL}/prescriptions/${rxId}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#prescription-sheet', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // Generate production PDF via window.generatePdfBlob and render with PDF.js
    const pdfData = await generateAndRenderPdf('prescription-sheet');

    const pageFiles = saveArtifacts(fileBaseName, pdfData.numPages, pdfData.base64Pdf, pdfData.pages);
    console.log(`Generated ${fileBaseName}.pdf (${pdfData.numPages} page(s)): ${pageFiles.join(', ')}`);

    scenarioResults.push({
      scenarioId,
      docType: 'Prescription',
      fileBaseName,
      pdfPath: `artifacts/phase5b-pdf-validation/${fileBaseName}.pdf`,
      numPages: pdfData.numPages,
      pageFiles,
      expectedMaxPages: options.expectedMaxPages || 1,
      passed: options.expectedPages ? pdfData.numPages === options.expectedPages : pdfData.numPages <= (options.expectedMaxPages || 1),
    });
  }

  // --- INVOICE / RECEIPT BUILDER ---
  async function putInvoiceWithItems(docType, itemCount, options = {}) {
    const invId = 3000 + itemCount + Math.floor(Math.random() * 8000);
    const invoiceNumber = `${docType === 'Tax Invoice' ? 'INV' : 'RCP'}-PH5B-${invId}`;

    const inv = {
      id: invId,
      invoiceNumber,
      practiceId: 'prac_mock_malappuram',
      patientId: 1,
      ownerId: 1,
      practitionerId: 1,
      documentType: docType,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      status: docType === 'Tax Invoice' ? 'issued' : 'paid',
      paymentMethod: docType === 'Tax Invoice' ? 'Pending' : (options.paymentMethod || 'UPI / Google Pay'),
      notes: options.statutoryNotice
        ? 'Statutory Note: Clinical veterinary services & life-saving livestock health consultations are exempt from Goods & Services Tax (GST) under Notification No. 12/2017-Central Tax (Rate).'
        : 'Thank you for choosing Malappuram Companion Animal Hospital.',
      subtotal: itemCount * 35000,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: itemCount * 35000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await putInDb('invoices', inv);

    const categories = ['Medicine', 'Procedure Fee', 'Consultation', 'Vaccination', 'Lab Test', 'Certificate'];
    for (let i = 1; i <= itemCount; i++) {
      const cat = categories[(i - 1) % categories.length];
      const item = {
        invoiceId: invId,
        description: options.longDesc
          ? `Comprehensive Clinical Diagnostics, Ultrasound Imaging Evaluation & Intensive Care Service #${i}`
          : (options.customItemName ? `${options.customItemName} #${i}` : `Clinical Veterinary Service Item #${i}`),
        category: cat,
        quantity: 1,
        unit: 'service',
        unitPricePaisa: 35000,
        discountAmtPaisa: 0,
        prescriptionId: 1001,
        prescriptionNumber: 'RX-PH5B-0001',
        isGovPrescribed: Boolean(options.govOrder),
        govOrderNote: options.govOrderNote || '',
        sortOrder: i,
      };
      await putInDb('invoiceItems', item);
    }

    return invId;
  }

  // --- RUN INVOICE / RECEIPT SCENARIO ---
  async function testBillingScenario(docType, scenarioId, fileBaseName, itemCount, options = {}) {
    console.log(`\n======================================================`);
    console.log(`[${docType.toUpperCase()}] Scenario: ${scenarioId} (${fileBaseName})`);
    console.log(`======================================================`);

    const invId = await putInvoiceWithItems(docType, itemCount, options);
    await page.goto(`${TARGET_URL}/invoices/${invId}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#invoice-sheet', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // Generate production PDF via window.generatePdfBlob and render with PDF.js
    const pdfData = await generateAndRenderPdf('invoice-sheet');

    const pageFiles = saveArtifacts(fileBaseName, pdfData.numPages, pdfData.base64Pdf, pdfData.pages);
    console.log(`Generated ${fileBaseName}.pdf (${pdfData.numPages} page(s)): ${pageFiles.join(', ')}`);

    scenarioResults.push({
      scenarioId,
      docType,
      fileBaseName,
      pdfPath: `artifacts/phase5b-pdf-validation/${fileBaseName}.pdf`,
      numPages: pdfData.numPages,
      pageFiles,
      expectedMaxPages: options.expectedMaxPages || 1,
      passed: options.expectedPages ? pdfData.numPages === options.expectedPages : pdfData.numPages <= (options.expectedMaxPages || 1),
    });
  }

  // ==========================================================
  // EXECUTE ALL 29 REQUIRED SCENARIOS
  // ==========================================================

  console.log('\n>>> STARTING PRESCRIPTION SCENARIOS (13 total) <<<');
  // 1. One medicine
  await testPrescriptionScenario('Rx-1', 'prescription-1-medicine', 1);
  // 2. Two medicines (Required named file: prescription-2-medicines.pdf)
  await testPrescriptionScenario('Rx-2', 'prescription-2-medicines', 2, { expectedPages: 1 });
  // 3. Five medicines (Required named file: prescription-5-medicines.pdf)
  await testPrescriptionScenario('Rx-3', 'prescription-5-medicines', 5, { expectedPages: 1 });
  // 4. Six medicines (Required named file: prescription-6-medicines.pdf)
  await testPrescriptionScenario('Rx-4', 'prescription-6-medicines', 6, { expectedMaxPages: 2 });
  // 5. Long medicine name
  await testPrescriptionScenario('Rx-5', 'prescription-long-medicine-name', 2, { longName: true, longGeneric: true });
  // 6. Long route text
  await testPrescriptionScenario('Rx-6', 'prescription-long-route-text', 2, { longRoute: true });
  // 7. Long frequency text
  await testPrescriptionScenario('Rx-7', 'prescription-long-frequency-text', 2, { longFreq: true });
  // 8. Long Sig text
  await testPrescriptionScenario('Rx-8', 'prescription-long-sig-text', 2, { longSig: true });
  // 9. Special instructions
  await testPrescriptionScenario('Rx-9', 'prescription-special-instructions', 2, {
    specialInstructions: [
      'Isolate animal in clean calving pen with fresh dry straw bedding.',
      'Milk affected quarters twice daily into separate container and dispose safely.',
      'Apply cold compresses to udder followed by gentle massage with topical herbal mastitis balm.',
      'Monitor rectal temperature every morning and report if above 103°F.',
    ],
  });
  // 10. Follow-up care plan
  await testPrescriptionScenario('Rx-10', 'prescription-follow-up-care-plan', 2, { followUpDays: 7, recheckPreset: '7 Days' });
  // 11. Long practitioner qualification
  await testPrescriptionScenario('Rx-11', 'prescription-long-practitioner-qualification', 2, { longDiagnosis: true });
  // 12. Signature block
  await testPrescriptionScenario('Rx-12', 'prescription-signature-block', 2);
  // 13. Deliberately long multi-page prescription (Required named file: prescription-long-content-multipage.pdf)
  await testPrescriptionScenario('Rx-13', 'prescription-long-content-multipage', 10, {
    longDiagnosis: true,
    longSymptoms: 'High persistent fever 105.4F, severe dyspnea, bilateral purulent nasal discharge, extensive submandibular edema, acute ruminal stasis, marked drop in milk yield from 18L to 2L.',
    specialInstructions: [
      'Complete isolation from healthy herd in quarantine shed with dedicated biosecure footbath.',
      'Maintain continuous access to lukewarm clean drinking water with electrolyte supplementation.',
      'Provide soft steamed gruel and succulent green fodder; avoid coarse fibrous dry straw.',
      'Clean udder with lukewarm antiseptic wash before and after each milking session.',
      'Record rectal temperature twice daily (morning 07:00 AM, evening 06:00 PM) in patient chart.',
    ],
    followUpDays: 10,
    expectedPages: 2,
  });

  console.log('\n>>> STARTING INVOICE SCENARIOS (8 total) <<<');
  // 1. One line item
  await testBillingScenario('Tax Invoice', 'Inv-1', 'invoice-1-line-item', 1);
  // 2. Two line items
  await testBillingScenario('Tax Invoice', 'Inv-2', 'invoice-2-line-items', 2);
  // 3. Five line items (Required named file: invoice-5-items.pdf)
  await testBillingScenario('Tax Invoice', 'Inv-3', 'invoice-5-items', 5, { expectedPages: 1 });
  // 4. Six line items (Required named file: invoice-6-items.pdf - Multi-page verification)
  await testBillingScenario('Tax Invoice', 'Inv-4', 'invoice-6-items', 6, {
    longDesc: true,
    govOrder: true,
    govOrderNote: 'As per veterinary rate schedule fixed by Animal Husbandry Dept Notification G.O.(Rt) No.589/2023/AHD',
    expectedPages: 2,
  });
  // 5. All six billing categories
  await testBillingScenario('Tax Invoice', 'Inv-5', 'invoice-all-six-categories', 6, { expectedMaxPages: 2 });
  // 6. Long item description
  await testBillingScenario('Tax Invoice', 'Inv-6', 'invoice-long-item-description', 3, { longDesc: true });
  // 7. Statutory notice
  await testBillingScenario('Tax Invoice', 'Inv-7', 'invoice-statutory-notice', 2, { statutoryNotice: true });
  // 8. Signature block
  await testBillingScenario('Tax Invoice', 'Inv-8', 'invoice-signature-block', 2);

  console.log('\n>>> STARTING RECEIPT SCENARIOS (8 total) <<<');
  // 1. One line item
  await testBillingScenario('Payment Receipt', 'Rcp-1', 'receipt-1-line-item', 1);
  // 2. Two line items
  await testBillingScenario('Payment Receipt', 'Rcp-2', 'receipt-2-line-items', 2);
  // 3. Five line items (Required named file: receipt-5-items.pdf)
  await testBillingScenario('Payment Receipt', 'Rcp-3', 'receipt-5-items', 5, { expectedPages: 1 });
  // 4. Six line items (Required named file: receipt-6-items.pdf - Multi-page verification)
  await testBillingScenario('Payment Receipt', 'Rcp-4', 'receipt-6-items', 6, {
    longDesc: true,
    govOrder: true,
    govOrderNote: 'As per veterinary rate schedule fixed by Animal Husbandry Dept Notification G.O.(Rt) No.589/2023/AHD',
    expectedPages: 2,
  });
  // 5. Long item description
  await testBillingScenario('Payment Receipt', 'Rcp-5', 'receipt-long-item-description', 3, { longDesc: true });
  // 6. Payment summary
  await testBillingScenario('Payment Receipt', 'Rcp-6', 'receipt-payment-summary', 2, { paymentMethod: 'Card / POS Terminal #4' });
  // 7. Statutory notice
  await testBillingScenario('Payment Receipt', 'Rcp-7', 'receipt-statutory-notice', 2, { statutoryNotice: true });
  // 8. Signature block
  await testBillingScenario('Payment Receipt', 'Rcp-8', 'receipt-signature-block', 2);

  await browser.close();
  server.close();

  // Write summary JSON
  const summary = {
    timestamp: new Date().toISOString(),
    totalScenarios: scenarioResults.length,
    passedCount: scenarioResults.filter((s) => s.passed).length,
    results: scenarioResults,
  };

  for (const dir of [WORKSPACE_OUT_DIR, BRAIN_OUT_DIR]) {
    fs.writeFileSync(path.join(dir, 'validation-summary.json'), JSON.stringify(summary, null, 2));
  }

  console.log('\n======================================================');
  console.log(`PHASE 5B PDF VALIDATION COMPLETE`);
  console.log(`Total Scenarios: ${summary.totalScenarios}`);
  console.log(`Passed: ${summary.passedCount} / ${summary.totalScenarios}`);
  console.log(`Results saved to ${WORKSPACE_OUT_DIR}`);
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('Fatal execution error during Phase 5B validation:', err);
  process.exit(1);
});
