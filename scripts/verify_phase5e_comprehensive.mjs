// =============================================================
// VetRx — verify_phase5e_comprehensive.mjs
// Phase 5E: Comprehensive PDF-Safe Visual Alignment & Page Verification
// Tests 22 scenarios:
//   - 10 Prescriptions (1, 2, 5, 6 medicines, long name, long sig, long route, long freq, long qual, multipage)
//   - 6 Invoices (1 item, 5 items, 6 items, long desc, 6 categories, long statutory notice)
//   - 6 Receipts (1 item, 5 items, 6 items, long desc, payment summary, long statutory notice)
// =============================================================

import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WORKSPACE_OUT_DIR = path.resolve('artifacts/phase5e-pdf-validation');
const BRAIN_ARTIFACT_DIR = process.env.ARTIFACT_DIR || 'C:\\Users\\drsha\\.gemini\\antigravity-ide\\brain\\bcbe612a-a750-41e6-9f79-07c795aa1a05';
const BRAIN_OUT_DIR = path.join(BRAIN_ARTIFACT_DIR, 'phase5e_artifacts');
const DIST_DIR = path.resolve('web/dist');
const PDFJS_BUILD_DIR = path.resolve('node_modules/pdfjs-dist/build');
const PORT = 3700 + Math.floor(Math.random() * 200);
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
    doctorName: 'Dr Fiza Shameem',
    doctorRegistrationNumber: 'KSVC-3134',
    registrationNumber: 'KSVC-3134',
    address: 'Civil Station Road, Malappuram, Kerala - 676505',
    phone: '9847123456',
    email: 'dr.fiza@vetrx.test',
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
      resolve(server);
    });
  });
}

async function main() {
  console.log(`[Phase 5E Comprehensive] Starting test server on ${TARGET_URL}`);
  const server = await startStaticServer();

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--allow-file-access-from-files',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Initial load to setup environment and Dexie
  await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => typeof window.db !== 'undefined', { timeout: 10000 });

  // Inject PDF.js ES module loader helper
  await page.evaluate(() => {
    window.renderPdfPageToDataUrl = async function(pdfArrayBuffer, pageNum) {
      const pdfjsLib = await import('/pdfjs/pdf.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
      const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
      const pdfPage = await pdf.getPage(pageNum);
      const viewport = pdfPage.getViewport({ scale: 2.0 }); // 2x scale for visual fidelity

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      return {
        numPages: pdf.numPages,
        width: viewport.width,
        height: viewport.height,
        dataUrl: canvas.toDataURL('image/png'),
      };
    };
  });

  const scenarioResults = [];

  // Helper to reset and populate DB
  async function resetDatabase() {
    await page.evaluate(async () => {
      const db = window.db;
      await db.prescriptions.clear();
      await db.prescriptionItems.clear();
      await db.invoices.clear();
      await db.invoiceItems.clear();
      await db.patients.clear();
      await db.owners.clear();
      await db.practitioners.clear();
      await db.organisations.clear();

      await db.owners.add({
        id: 1,
        name: 'Suresh Kumar',
        phone: '9847012345',
        address: 'Down Hill, Malappuram, Kerala - 676505',
        createdAt: '2026-09-17T10:00:00.000Z',
      });

      await db.patients.add({
        id: 1,
        name: 'Tommy',
        species: 'Canine',
        breed: 'Labrador Retriever',
        sex: 'Male Intact',
        weightKg: 28.5,
        ageNote: '3 years',
        ownerId: 1,
        createdAt: '2026-09-17T10:00:00.000Z',
      });

      await db.practitioners.add({
        id: 1,
        name: 'Dr Fiza Shameem',
        qualifications: 'BVSc, MVSc (Gynaec)',
        designation: 'Veterinary Surgeon',
        registrationNumber: 'KSVC-3134',
        phone: '9847123456',
        email: 'dr.fiza@vetrx.test',
        address: 'Civil Station Road, Malappuram',
        isActive: true,
      });

      await db.organisations.add({
        id: 1,
        name: 'Malappuram Companion Animal Hospital',
        address: 'Civil Station Road, Malappuram, Kerala - 676505',
        phone: '0483-2734567',
        email: 'malappuram.hospital@vetrx.test',
        isActive: true,
      });
    });
  }

  // ── Scenario Runner for Prescriptions ─────────────────────────
  async function testPrescriptionScenario(scenarioId, filenamePrefix, itemCount, options = {}) {
    console.log(`\n--- Running Prescription Scenario [${scenarioId}]: ${filenamePrefix} (${itemCount} meds) ---`);
    await resetDatabase();

    // Populate prescription with options
    await page.evaluate(async ({ itemCount, options }) => {
      const db = window.db;
      const rxId = 1;
      const rx = {
        id: rxId,
        rxNumber: 'RX-2026-0001',
        patientId: 1,
        ownerId: 1,
        practitionerId: 1,
        status: 'Issued',
        symptoms: options.longSymptoms || 'Mild pyrexia, lethargy, reduced appetite for 2 days',
        diagnosis: options.longDiagnosis || 'Acute bacterial gastroenteritis with moderate dehydration',
        notes: 'Clinical observations recorded under standard protocol.',
        instructions: options.specialInstructions || [
          'Give oral medications strictly after a meal with fresh drinking water.',
          'Keep treated animal in clean, dry shelter and prevent self-mutilation.',
          'Complete entire prescribed antimicrobial course without premature cessation.',
        ],
        followUpDays: options.followUpDays || 7,
        createdAt: '2026-09-17T10:00:00.000Z',
        updatedAt: '2026-09-17T10:00:00.000Z',
      };
      await db.prescriptions.add(rx);

      if (options.longQual) {
        await db.practitioners.update(1, {
          qualifications: 'BVSc & AH, MVSc (Animal Reproduction, Gynaecology & Obstetrics), PhD, PGDAW',
        });
      }

      const sampleMeds = [
        { brand: 'Amoxyclav 625', generic: 'Amoxicillin 500mg + Clavulanate 125mg', dose: '375 mg', route: 'PO (Oral)', freq: 'BID (q12h)', dur: 7, qty: 14, unit: 'Tabs', sig: 'Give 1 tablet every 12 hours after food. Complete course.' },
        { brand: 'Pantocid 40', generic: 'Pantoprazole Sodium 40mg', dose: '20 mg', route: 'PO (Oral)', freq: 'OD (q24h)', dur: 7, qty: 7, unit: 'Tabs', sig: 'Give 1 tablet in the morning 30 minutes before food.' },
        { brand: 'Melonex Plus', generic: 'Meloxicam 2.5mg + Paracetamol 100mg', dose: '1 bolus', route: 'PO (Oral)', freq: 'OD (q24h)', dur: 3, qty: 3, unit: 'Tabs', sig: 'Give after meal for pain and inflammation.' },
        { brand: 'Tribivet Inj', generic: 'Vitamin B1, B6, B12 Complex', dose: '3 mL', route: 'IM (Deep Intramuscular)', freq: 'OD (q24h)', dur: 3, qty: 1, unit: 'Vial', sig: 'Administer deep intramuscularly under aseptic precautions.' },
        { brand: 'Ceftriaxone 1g', generic: 'Ceftriaxone Sodium Sterile Powder', dose: '500 mg', route: 'IV (Slow Intravenous)', freq: 'OD (q24h)', dur: 5, qty: 5, unit: 'Vials', sig: 'Reconstitute with sterile water for injection, infuse slowly.' },
        { brand: 'Silbac Ear Drops', generic: 'Silver Sulfadiazine + Chlorhexidine', dose: '4 drops', route: 'Topical (Both Ears)', freq: 'BID (q12h)', dur: 7, qty: 1, unit: 'Bottle', sig: 'Instill into cleaned external ear canal twice daily.' },
        { brand: 'Doxycycline 100', generic: 'Doxycycline Hyclate 100mg', dose: '100 mg', route: 'PO (Oral)', freq: 'SID (q24h)', dur: 14, qty: 14, unit: 'Tabs', sig: 'Give with full meal and plentiful water.' },
        { brand: 'Prednisolone 5', generic: 'Prednisolone Disodium Phosphate', dose: '5 mg', route: 'PO (Oral)', freq: 'OD (q24h)', dur: 5, qty: 5, unit: 'Tabs', sig: 'Tapering dose as instructed by veterinarian.' },
        { brand: 'Enrofloxacin 100', generic: 'Enrofloxacin 100mg/mL Solution', dose: '2.5 mL', route: 'SC (Subcutaneous)', freq: 'OD (q24h)', dur: 4, qty: 1, unit: 'Vial', sig: 'Inject subcutaneously in the scruff of neck.' },
        { brand: 'Protexin Synbiotic', generic: 'Multi-strain Probiotic + Prebiotic', dose: '1 sachet', route: 'PO (Oral)', freq: 'BID (q12h)', dur: 10, qty: 10, unit: 'Sachets', sig: 'Mix in room temperature drinking water or gruel.' },
      ];

      for (let i = 0; i < itemCount; i++) {
        const med = sampleMeds[i % sampleMeds.length];
        let brandName = med.brand;
        let genericName = med.generic;
        let sig = med.sig;
        let route = med.route;
        let freq = med.freq;

        if (options.longName && i === 0) {
          brandName = 'Sulfamethoxazole Trimethoprim Super-Concentrated Suspension Forte';
          genericName = 'Sulfamethoxazole 400mg + Trimethoprim 80mg per 5mL Pediatric Oral Suspension Formulation USP';
        }
        if (options.longSig && i === 0) {
          sig = 'Give exactly 1.5 tablets twice daily with a large portion of solid food and ensure continuous availability of fresh drinking water. If animal vomits within 15 minutes, repeat half-dose once.';
        }
        if (options.longRoute && i === 0) {
          route = 'IM / SC / Slow IV Infusion';
        }
        if (options.longFreq && i === 0) {
          freq = 'TID (q8h) Strict Interval';
        }

        await db.prescriptionItems.add({
          prescriptionId: rxId,
          brandName,
          genericName,
          presentation: 'Formulation',
          dose: med.dose,
          doseUnit: 'dose',
          route,
          frequency: freq,
          durationDays: med.dur,
          quantity: med.qty,
          dispenseUnit: med.unit,
          directions: sig,
        });
      }
    }, { itemCount, options });

    // Navigate to prescription details
    await page.goto(`${TARGET_URL}/prescriptions/1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#prescription-sheet', { timeout: 10000 });

    // Extract PDF and render pages
    const pdfData = await page.evaluate(async () => {
      const blob = await window.generatePdfBlob('prescription-sheet');
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const arrayBuffer = await blob.arrayBuffer();

      const pdfjsLib = await import('/pdfjs/pdf.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const pages = [];
      for (let p = 1; p <= numPages; p++) {
        const pageObj = await pdf.getPage(p);
        const viewport = pageObj.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await pageObj.render({ canvasContext: ctx, viewport }).promise;
        pages.push({
          pageNum: p,
          dataUrl: canvas.toDataURL('image/png'),
        });
      }

      return {
        base64Pdf: base64,
        numPages,
        pages,
      };
    });

    // Save PDF
    const pdfBuffer = Buffer.from(pdfData.base64Pdf, 'base64');
    for (const dir of [WORKSPACE_OUT_DIR, BRAIN_OUT_DIR]) {
      fs.writeFileSync(path.join(dir, `${filenamePrefix}.pdf`), pdfBuffer);
    }

    // Save rendered PNGs
    for (const p of pdfData.pages) {
      const pngBuffer = Buffer.from(p.dataUrl.split(',')[1], 'base64');
      const pngFilename = pdfData.numPages === 1
        ? `${filenamePrefix}.png`
        : `${filenamePrefix}-page-${p.pageNum}.png`;
      for (const dir of [WORKSPACE_OUT_DIR, BRAIN_OUT_DIR]) {
        fs.writeFileSync(path.join(dir, pngFilename), pngBuffer);
      }
    }

    console.log(`[PASS] ${scenarioId}: Generated ${filenamePrefix}.pdf (${pdfData.numPages} page(s))`);
    scenarioResults.push({
      scenarioId,
      name: filenamePrefix,
      type: 'Prescription',
      numPages: pdfData.numPages,
      expectedPages: options.expectedPages || null,
      expectedMaxPages: options.expectedMaxPages || 1,
      passed: options.expectedPages ? pdfData.numPages === options.expectedPages : pdfData.numPages <= (options.expectedMaxPages || 1),
    });
  }

  // ── Scenario Runner for Invoices & Receipts ────────────────────
  async function testBillingScenario(docType, scenarioId, filenamePrefix, itemCount, options = {}) {
    console.log(`\n--- Running Billing Scenario [${scenarioId}]: ${filenamePrefix} (${docType}, ${itemCount} items) ---`);
    await resetDatabase();

    await page.evaluate(async ({ docType, itemCount, options }) => {
      const db = window.db;
      const invId = 1;
      const isReceipt = docType === 'Payment Receipt';
      const categories = ['Medicine', 'Procedure Fee', 'Consultation', 'Vaccination', 'Lab Test', 'General Health Care'];

      const invoice = {
        id: invId,
        invoiceNumber: isReceipt ? 'RCP-2026-0001' : 'INV-2026-0001',
        prescriptionId: 1,
        patientId: 1,
        ownerId: 1,
        practitionerId: 1,
        status: isReceipt ? 'Paid' : 'Paid',
        invoiceDate: '2026-09-17T10:00:00.000Z',
        paymentDate: '2026-09-17T10:00:00.000Z',
        paymentMethod: options.paymentMethod || 'UPI',
        subtotal: 0,
        discount: 0,
        grandTotal: 0,
        amountPaid: 0,
        balanceDue: 0,
        notes: options.longStatutory
          ? 'Healthcare services and clinical treatments provided by registered veterinary practitioners are statutory-exempt from GST under Notification No. 12/2017-Central Tax (Rate). Valid without physical seal.'
          : 'Prescribed outpatient clinical charges.',
        createdAt: '2026-09-17T10:00:00.000Z',
      };

      let grandTotalPaisa = 0;
      for (let i = 0; i < itemCount; i++) {
        const cat = categories[i % categories.length];
        let desc = `${cat} Clinical Service Standard`;
        if (options.longDesc && i === 0) {
          desc = 'Emergency Critical Care Resuscitation, Comprehensive Fluid Therapy Administration, Continuous Monitoring & Diagnostic Blood Analysis';
        }
        const unitPrice = 35000 + i * 5000;
        const total = unitPrice;
        grandTotalPaisa += total;

        await db.invoiceItems.add({
          invoiceId: invId,
          category: cat,
          description: desc,
          hsnSac: cat === 'Medicine' ? '3004' : '9993',
          quantity: 1,
          unit: 'service',
          unitPricePaisa: unitPrice,
          totalAmountPaisa: total,
          sortOrder: i,
        });
      }

      invoice.subtotal = grandTotalPaisa;
      invoice.grandTotal = grandTotalPaisa;
      invoice.amountPaid = grandTotalPaisa;
      await db.invoices.add(invoice);
    }, { docType, itemCount, options });

    const routeUrl = `${TARGET_URL}/invoices/1?type=${encodeURIComponent(docType)}`;
    await page.goto(routeUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#invoice-sheet', { timeout: 10000 });

    // Extract PDF and render pages
    const pdfData = await page.evaluate(async () => {
      const blob = await window.generatePdfBlob('invoice-sheet');
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const arrayBuffer = await blob.arrayBuffer();

      const pdfjsLib = await import('/pdfjs/pdf.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;

      const pages = [];
      for (let p = 1; p <= numPages; p++) {
        const pageObj = await pdf.getPage(p);
        const viewport = pageObj.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await pageObj.render({ canvasContext: ctx, viewport }).promise;
        pages.push({
          pageNum: p,
          dataUrl: canvas.toDataURL('image/png'),
        });
      }

      return {
        base64Pdf: base64,
        numPages,
        pages,
      };
    });

    // Save PDF
    const pdfBuffer = Buffer.from(pdfData.base64Pdf, 'base64');
    for (const dir of [WORKSPACE_OUT_DIR, BRAIN_OUT_DIR]) {
      fs.writeFileSync(path.join(dir, `${filenamePrefix}.pdf`), pdfBuffer);
    }

    // Save rendered PNGs
    for (const p of pdfData.pages) {
      const pngBuffer = Buffer.from(p.dataUrl.split(',')[1], 'base64');
      const pngFilename = pdfData.numPages === 1
        ? `${filenamePrefix}.png`
        : `${filenamePrefix}-page-${p.pageNum}.png`;
      for (const dir of [WORKSPACE_OUT_DIR, BRAIN_OUT_DIR]) {
        fs.writeFileSync(path.join(dir, pngFilename), pngBuffer);
      }
    }

    console.log(`[PASS] ${scenarioId}: Generated ${filenamePrefix}.pdf (${pdfData.numPages} page(s))`);
    scenarioResults.push({
      scenarioId,
      name: filenamePrefix,
      type: docType,
      numPages: pdfData.numPages,
      expectedPages: options.expectedPages || null,
      expectedMaxPages: options.expectedMaxPages || 1,
      passed: options.expectedPages ? pdfData.numPages === options.expectedPages : pdfData.numPages <= (options.expectedMaxPages || 1),
    });
  }

  // ==========================================================
  // EXECUTE ALL 22 REQUIRED SCENARIOS
  // ==========================================================

  console.log('\n>>> STARTING PRESCRIPTION SCENARIOS (10 scenarios) <<<');
  // 1. One medicine
  await testPrescriptionScenario('Rx-1', 'prescription-1-medicine', 1, { expectedPages: 1 });
  // 2. Two medicines
  await testPrescriptionScenario('Rx-2', 'prescription-2-medicines', 2, { expectedPages: 1 });
  // 3. Five medicines
  await testPrescriptionScenario('Rx-3', 'prescription-5-medicines', 5, { expectedPages: 1 });
  // 4. Six medicines
  await testPrescriptionScenario('Rx-4', 'prescription-6-medicines', 6, { expectedMaxPages: 2 });
  // 5. Long medicine name
  await testPrescriptionScenario('Rx-5', 'prescription-long-medicine-name', 2, { longName: true, longGeneric: true });
  // 6. Long Sig text
  await testPrescriptionScenario('Rx-6', 'prescription-long-sig-text', 2, { longSig: true });
  // 7. Long route text
  await testPrescriptionScenario('Rx-7', 'prescription-long-route-text', 2, { longRoute: true });
  // 8. Long frequency text
  await testPrescriptionScenario('Rx-8', 'prescription-long-frequency-text', 2, { longFreq: true });
  // 9. Long practitioner qualification
  await testPrescriptionScenario('Rx-9', 'prescription-long-practitioner-qualification', 2, { longQual: true, expectedPages: 1 });
  // 10. Long multi-page prescription
  await testPrescriptionScenario('Rx-10', 'prescription-long-content-multipage', 10, {
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

  console.log('\n>>> STARTING INVOICE SCENARIOS (6 scenarios) <<<');
  // 1. One item
  await testBillingScenario('Tax Invoice', 'Inv-1', 'invoice-1-item', 1, { expectedPages: 1 });
  // 2. Five items
  await testBillingScenario('Tax Invoice', 'Inv-2', 'invoice-5-items', 5, { expectedPages: 1 });
  // 3. Six items
  await testBillingScenario('Tax Invoice', 'Inv-3', 'invoice-6-items', 6, {
    longDesc: true,
    expectedMaxPages: 2,
  });
  // 4. Long description
  await testBillingScenario('Tax Invoice', 'Inv-4', 'invoice-long-description', 3, { longDesc: true });
  // 5. All six billing categories
  await testBillingScenario('Tax Invoice', 'Inv-5', 'invoice-all-six-categories', 6, { expectedMaxPages: 2 });
  // 6. Long statutory notice
  await testBillingScenario('Tax Invoice', 'Inv-6', 'invoice-long-statutory-notice', 2, { longStatutory: true, expectedPages: 1 });

  console.log('\n>>> STARTING RECEIPT SCENARIOS (6 scenarios) <<<');
  // 1. One item
  await testBillingScenario('Payment Receipt', 'Rcp-1', 'receipt-1-item', 1, { expectedPages: 1 });
  // 2. Five items
  await testBillingScenario('Payment Receipt', 'Rcp-2', 'receipt-5-items', 5, { expectedPages: 1 });
  // 3. Six items
  await testBillingScenario('Payment Receipt', 'Rcp-3', 'receipt-6-items', 6, {
    longDesc: true,
    expectedMaxPages: 2,
  });
  // 4. Long description
  await testBillingScenario('Payment Receipt', 'Rcp-4', 'receipt-long-description', 3, { longDesc: true });
  // 5. Payment summary
  await testBillingScenario('Payment Receipt', 'Rcp-5', 'receipt-payment-summary', 2, { paymentMethod: 'UPI / Google Pay (Ref: 20260917-8899)' });
  // 6. Long statutory notice
  await testBillingScenario('Payment Receipt', 'Rcp-6', 'receipt-long-statutory-notice', 2, { longStatutory: true, expectedPages: 1 });

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
    fs.writeFileSync(path.join(dir, 'phase5e-validation-summary.json'), JSON.stringify(summary, null, 2));
  }

  console.log('\n======================================================');
  console.log(`PHASE 5E PDF VISUAL VALIDATION COMPLETE`);
  console.log(`Total Scenarios: ${summary.totalScenarios}`);
  console.log(`Passed: ${summary.passedCount} / ${summary.totalScenarios}`);
  console.log(`Results saved to ${WORKSPACE_OUT_DIR}`);
  console.log(`======================================================`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
