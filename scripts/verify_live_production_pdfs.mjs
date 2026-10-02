// =============================================================
// VetRx — verify_live_production_pdfs.mjs
// Phase 5B Live Production PDF Smoke Test Script
// Targets: https://vetrx.brightbase.in
// =============================================================

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'https://vetrx.brightbase.in';

const WORKSPACE_OUT_DIR = path.resolve('artifacts/live-production-smoke-test');
const BRAIN_ARTIFACT_DIR = 'C:\\Users\\drsha\\.gemini\\antigravity-ide\\brain\\bcbe612a-a750-41e6-9f79-07c795aa1a05\\live_smoke_artifacts';

for (const dir of [WORKSPACE_OUT_DIR, BRAIN_ARTIFACT_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const timestamp = Date.now();
const testAccount = {
  name: 'Dr. Shameem Alungal',
  practiceName: 'Malappuram Companion Animal Hospital',
  email: `smoke.p5b.${timestamp}@vetrx.test`,
  password: 'LiveSmokePass#2026!',
};

async function run() {
  console.log(`=============================================================`);
  console.log(`Starting Phase 5B Live Production PDF Smoke Test`);
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`Account: ${testAccount.email}`);
  console.log(`=============================================================\n`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,1000'],
    defaultViewport: { width: 1280, height: 1000 },
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const uncaughtExceptions = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('401 (Unauthorized)')) {
        consoleErrors.push(txt);
        console.log(`[PAGE CONSOLE ERROR]`, txt);
      }
    }
  });

  page.on('pageerror', (err) => {
    uncaughtExceptions.push(err.message);
    console.log(`[PAGE UNCAUGHT ERROR]`, err.message);
  });

  // 1. Register & Setup Practitioner Profile on Live Site
  console.log('--- Step 1: Registering live smoke test practitioner ---');
  await page.goto(`${TARGET_URL}/register`, { waitUntil: 'networkidle2' });

  await page.waitForSelector('#register-name', { timeout: 15000 });
  await page.type('#register-name', testAccount.name);
  await page.type('#register-practice-name', testAccount.practiceName);
  await page.type('#register-email', testAccount.email);
  await page.type('#register-password', testAccount.password);
  await page.type('#register-confirm-password', testAccount.password);

  await page.click('button[type="submit"]');
  await page.waitForSelector('.desktop-header, .sidebar, .app-shell', { timeout: 20000 });
  console.log('Successfully registered and logged in on live production.');

  // Update Practice Settings to have KSVC-3134 registration number & full clinic details
  console.log('--- Step 2: Updating practitioner & clinic settings ---');
  await page.evaluate(async () => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: 'Malappuram Companion Animal Hospital',
        doctorName: 'Dr. Shameem Alungal',
        doctorRegistrationNumber: 'KSVC-3134',
        registrationNumber: 'KSVC-3134',
        address: 'Civil Station Road, Malappuram, Kerala - 676505',
        phone: '9847123456',
        email: 'dr.shameem@vetrx.test',
        ownerSpecialInstructionEnabled: true,
      }),
    });
  });

  // Seed sample Patient, Owner, Practitioner in active tenant IndexedDB
  console.log('--- Step 3: Setting up patient, owner, and practitioner master data ---');
  await page.evaluate(async () => {
    const db = window.db;
    if (!db) throw new Error('window.db missing');

    await db.owners.put({
      id: 1,
      name: 'Kunjali Marakkar',
      phone: '9847112233',
      address: 'Manjeri Road, Malappuram',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.patients.put({
      id: 1,
      ownerId: 1,
      name: 'Appu',
      species: 'Bovine',
      breed: 'HF Cross',
      age: 4,
      ageUnit: 'years',
      gender: 'female',
      weightKg: 380,
      weight: 380,
      weightUnit: 'kg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.practitioners.put({
      id: 1,
      name: 'Dr. Shameem Alungal',
      qualification: 'BVSc & AH, MVSc (Clinical Medicine)',
      registrationNumber: 'KSVC-3134',
      phone: '9847123456',
      email: 'dr.shameem@vetrx.test',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  async function putInDb(table, record) {
    return page.evaluate(async ({ table, record }) => {
      return window.db.table(table).put(record);
    }, { table, record });
  }

  async function generateAndAnalyzePdf(sheetId) {
    const { base64Pdf } = await page.evaluate(async (targetId) => {
      if (typeof window.generatePdfBlob !== 'function') {
        throw new Error('window.generatePdfBlob is not available on window');
      }
      const sheet = document.getElementById(targetId);
      if (!sheet) {
        throw new Error(`Element #${targetId} not found in DOM`);
      }
      const blob = await window.generatePdfBlob(sheet);
      const reader = new FileReader();
      const b64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      return { base64Pdf: b64 };
    }, sheetId);

    const pdfBuffer = Buffer.from(base64Pdf, 'base64');
    const loadingTask = getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    return { numPages, pdfBuffer };
  }

  function saveArtifacts(fileBaseName, pdfBuffer, sheetScreenshot) {
    for (const dir of [WORKSPACE_OUT_DIR, BRAIN_ARTIFACT_DIR]) {
      fs.writeFileSync(path.join(dir, `${fileBaseName}.pdf`), pdfBuffer);
      if (sheetScreenshot) {
        fs.writeFileSync(path.join(dir, `${fileBaseName}.png`), sheetScreenshot);
      }
    }
  }

  const results = [];

  // =============================================================
  // 1. PRESCRIPTION TESTS
  // =============================================================
  const medTemplates = [
    { b: 'Amoxyclav Bolus', g: 'Amoxicillin + Clavulanic Acid', f: 'BID (q12h)', r: 'PO (Oral)', d: '1 bolus', q: 10, u: 'Bolus' },
    { b: 'Melonex Plus Bolus', g: 'Meloxicam + Paracetamol', f: 'OD (q24h)', r: 'PO (Oral)', d: '2 boluses', q: 6, u: 'Bolus' },
    { b: 'Belamyl Injection', g: 'Vitamin B-Complex with Liver Extract', f: 'OD (q24h)', r: 'IM (Intramuscular)', d: '10 ml', q: 1, u: 'Vial' },
    { b: 'Intacef Tazo 4.5g', g: 'Ceftriaxone + Tazobactam', f: 'OD (q24h)', r: 'IV (Intravenous)', d: '4.5g', q: 3, u: 'Vial' },
    { b: 'Tribivet Injection', g: 'Thiamine + Pyridoxine + Cyanocobalamin', f: 'OD (q24h)', r: 'IM (Intramuscular)', d: '10 ml', q: 1, u: 'Vial' },
    { b: 'Curabless Udder Spray', g: 'Chlorhexidine + Herbal Anti-inflammatory', f: 'TID (q8h)', r: 'Topical', d: 'Apply generously', q: 1, u: 'Bottle' },
  ];

  async function createPrescriptionWithItems(rxId, medCount, options = {}) {
    const rx = {
      id: rxId,
      rxNumber: `RX-LIVE-00${rxId}`,
      patientId: 1,
      ownerId: 1,
      practitionerId: 1,
      date: new Date().toISOString(),
      diagnosis: options.long
        ? 'Acute Bovine Respiratory Disease Complex with Severe Bronchopneumonia & Secondary Systemic Toxemia'
        : 'Mastitis / Acute Systemic Bacterial Infection',
      symptoms: options.long
        ? 'High fever 104.8F, severe dyspnea, purulent nasal discharge, lethargy, decreased rumination, drop in milk yield from 18L to 4L.'
        : 'Fever 104.2F, swollen left quarter.',
      instructions: options.long ? [
        'Complete isolation from healthy herd in quarantine shed with dedicated biosecure footbath.',
        'Maintain continuous access to lukewarm clean drinking water with electrolyte supplementation.',
        'Provide soft steamed gruel and succulent green fodder; avoid coarse fibrous dry straw.',
        'Clean udder with lukewarm antiseptic wash before and after each milking session.',
        'Record rectal temperature twice daily (morning 07:00 AM, evening 06:00 PM) in patient chart.',
      ] : [
        'Keep animal in dry, clean shelter.',
        'Provide ad libitum clean drinking water.',
      ],
      followUpDays: options.long ? 10 : 5,
      recheckIntervalPreset: options.long ? '10 Days' : '5 Days',
      status: 'Issued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putInDb('prescriptions', rx);

    for (let i = 1; i <= medCount; i++) {
      const tmpl = medTemplates[(i - 1) % medTemplates.length];
      const item = {
        id: rxId * 100 + i,
        prescriptionId: rxId,
        medicineId: i,
        brandName: `${tmpl.b} #${i}`,
        genericName: tmpl.g,
        presentation: tmpl.u,
        dose: tmpl.d,
        doseUnit: '',
        strengthVolume: 'Standard',
        route: tmpl.r,
        frequency: tmpl.f,
        durationDays: 5,
        duration: 5,
        durationUnit: 'days',
        timing: 'After food',
        directions: options.long
          ? 'Sig: Administer orally mixed with crushed jaggery or treacle immediately following grain feeding. Ensure continuous access to clean fresh drinking water. Complete full course.'
          : 'Sig: Administer as directed after feeding. Complete full course.',
        instructions: 'Administer strictly as instructed.',
        quantity: tmpl.q,
        unit: tmpl.u,
        sortOrder: i,
        isCustom: false,
      };
      await putInDb('prescriptionItems', item);
    }
  }

  async function testPrescription(name, fileBaseName, rxId, medCount, options = {}) {
    console.log(`\nTesting Prescription: ${name} (${medCount} meds)`);
    await createPrescriptionWithItems(rxId, medCount, options);
    await page.goto(`${TARGET_URL}/prescriptions/${rxId}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#prescription-sheet', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // Element visual & alignment verification
    const inspection = await page.evaluate(() => {
      const origBadge = Array.from(document.querySelectorAll('.document-badge, .stationery-doc-title'))
        .some((el) => el.textContent.includes('Original Prescription'));
      const regBadge = Array.from(document.querySelectorAll('.letterhead-reg-chip, .practitioner-header-reg-chip, .stationery-reg-no'))
        .some((el) => el.textContent.includes('KSVC-3134'));
      const routeBox = document.querySelector('.stationery-route-box');
      const sigBox = document.querySelector('.stationery-sig-box');
      const heroHeader = document.querySelector('.letterhead-practitioner-hero-row');
      const sigBlock = document.querySelector('.stationery-signoff-box, .stationery-signoff-row');

      return {
        hasOriginalBadge: origBadge,
        hasRegBadge: regBadge,
        noSymbolAboveDoctor: !heroHeader?.textContent.includes('●') && !heroHeader?.textContent.includes('▲'),
        routeBoxAligned: !!routeBox && routeBox.offsetWidth > 0,
        sigBoxAligned: !!sigBox && sigBox.offsetWidth > 0,
        sigBlockVisible: !!sigBlock,
      };
    });

    const sheetEl = await page.$('#prescription-sheet');
    const screenshot = await sheetEl.screenshot();
    const { numPages, pdfBuffer } = await generateAndAnalyzePdf('prescription-sheet');
    saveArtifacts(fileBaseName, pdfBuffer, screenshot);

    const passed = (options.expectedPages ? numPages === options.expectedPages : numPages <= (options.expectedMaxPages || 1))
      && inspection.hasOriginalBadge
      && inspection.hasRegBadge
      && inspection.noSymbolAboveDoctor
      && inspection.routeBoxAligned
      && inspection.sigBoxAligned
      && inspection.sigBlockVisible;

    console.log(`Result: ${fileBaseName}.pdf -> ${numPages} page(s) (Expected ${options.expectedPages || '<=' + options.expectedMaxPages}). Passed: ${passed}`);
    results.push({
      testName: name,
      fileBaseName,
      docType: 'Prescription',
      numPages,
      expectedPages: options.expectedPages || options.expectedMaxPages,
      passed,
      inspection,
    });
  }

  // 1. Prescription with 2 medicines (1 page)
  await testPrescription('Prescription with 2 medicines', 'prescription-2-medicines', 102, 2, { expectedPages: 1 });

  // 2. Prescription with 5 medicines (1 page)
  await testPrescription('Prescription with 5 medicines', 'prescription-5-medicines', 105, 5, { expectedPages: 1 });

  // 3. Prescription with 6 medicines (1 or 2 pages)
  await testPrescription('Prescription with 6 medicines', 'prescription-6-medicines', 106, 6, { expectedMaxPages: 2 });

  // 4. Prescription with deliberately long content requiring 2 pages
  await testPrescription('Prescription with long content multipage', 'prescription-long-content-multipage', 110, 10, { long: true, expectedPages: 2 });

  // =============================================================
  // 2. INVOICE & RECEIPT TESTS
  // =============================================================
  const billingCatalog = [
    { desc: 'Comprehensive Veterinary Clinical Examination & Consultation with Diagnostic Assessment', rate: 35000, cat: 'Consultation' },
    { desc: 'Amoxyclav Bolus Vet 3.3g Strip of 10 Tablets Broad Spectrum Antimicrobial Therapy', rate: 42000, cat: 'Medicine' },
    { desc: 'Melonex Plus Bolus Anti-inflammatory & Antipyretic Analgesic Strip', rate: 18000, cat: 'Medicine' },
    { desc: 'Belamyl Liver Extract with Vitamin B-Complex Parenteral Injection 30ml Vial', rate: 12500, cat: 'Medicine' },
    { desc: 'Surgical Wound Debridement, Antiseptic Lavage & Sterile Barrier Bandaging', rate: 25000, cat: 'Procedure Fee' },
    { desc: 'Post-Treatment Follow-up Clinical Monitoring & Comprehensive Nutritional Diet Protocol', rate: 20000, cat: 'Consultation' },
  ];

  async function createInvoiceWithItems(docType, invId, itemCount, options = {}) {
    const invoiceNumber = `${docType === 'Tax Invoice' ? 'INV' : 'RCP'}-LIVE-00${invId}`;
    const totalPaisa = itemCount * 35000;

    const inv = {
      id: invId,
      invoiceNumber,
      practiceId: 'prac_live',
      patientId: 1,
      ownerId: 1,
      practitionerId: 1,
      documentType: docType,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      status: docType === 'Tax Invoice' ? 'issued' : 'paid',
      paymentMethod: docType === 'Tax Invoice' ? 'Pending' : 'UPI / Google Pay',
      notes: options.statutoryNotice
        ? 'Statutory Note: Clinical veterinary services & life-saving livestock health consultations are exempt from Goods & Services Tax (GST) under Notification No. 12/2017-Central Tax (Rate).'
        : 'Thank you for choosing Malappuram Companion Animal Hospital.',
      subtotal: totalPaisa,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: totalPaisa,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putInDb('invoices', inv);

    for (let i = 1; i <= itemCount; i++) {
      const itemDef = billingCatalog[(i - 1) % billingCatalog.length];
      const item = {
        invoiceId: invId,
        description: options.longDesc
          ? `Comprehensive Clinical Diagnostics, Ultrasound Imaging Evaluation & Intensive Care Service Protocol #${i} - Clinical Administration`
          : `${itemDef.desc} #${i}`,
        category: itemDef.cat,
        quantity: 1,
        unit: 'service',
        unitPricePaisa: itemDef.rate,
        discountAmtPaisa: 0,
        prescriptionId: 102,
        prescriptionNumber: 'RX-LIVE-00102',
        isGovPrescribed: Boolean(options.govOrder),
        govOrderNote: options.govOrderNote || (options.govOrder ? 'As per veterinary rate schedule fixed by Animal Husbandry Dept Notification G.O.(Rt) No.589/2023/AHD' : ''),
        sortOrder: i,
      };
      await putInDb('invoiceItems', item);
    }
  }

  async function testBilling(docType, name, fileBaseName, invId, itemCount, options = {}) {
    console.log(`\nTesting ${docType}: ${name} (${itemCount} items)`);
    await createInvoiceWithItems(docType, invId, itemCount, options);
    await page.goto(`${TARGET_URL}/invoices/${invId}`, { waitUntil: 'networkidle2' });

    // If Receipt, switch tab
    if (docType === 'Payment Receipt') {
      await page.waitForSelector('.invoices-status-tabs button', { timeout: 10000 });
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('.invoices-status-tabs button'));
        const rcpBtn = buttons.find((b) => b.textContent.includes('Payment Receipt'));
        if (rcpBtn) rcpBtn.click();
      });
      await new Promise((r) => setTimeout(r, 600));
    }

    const sheetSelector = '#invoice-sheet';
    await page.waitForSelector(sheetSelector, { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    // Element visual & alignment verification
    const inspection = await page.evaluate((isReceipt) => {
      const docBadge = Array.from(document.querySelectorAll('.document-badge, .invoice-print-badge'))
        .some((el) => el.textContent.includes(isReceipt ? 'Receipt' : 'Recipient') || el.textContent.includes('INVOICE') || el.textContent.includes('RECEIPT'));
      const regChip = Array.from(document.querySelectorAll('.practitioner-header-reg-chip, .letterhead-reg-chip'))
        .some((el) => el.textContent.includes('KSVC-3134'));
      const ledger = document.querySelector('.invoice-print-ledger-grid, .invoice-print-ledger-and-signoff');
      const statutoryNotice = document.querySelector('.invoice-print-statutory-gst, .invoice-print-statutory-notice');
      const signature = document.querySelector('.invoice-print-signature-section, .invoice-print-signature-box, .invoice-print-ledger-and-signoff');

      return {
        hasBadge: docBadge,
        hasRegChip: regChip,
        ledgerPresent: !!ledger,
        statutoryNoticePresent: !!statutoryNotice,
        signaturePresent: !!signature,
      };
    }, docType === 'Payment Receipt');

    const targetSheetId = (await page.$('#printable-receipt')) ? 'printable-receipt' : 'invoice-sheet';
    const sheetEl = await page.$(`#${targetSheetId}`);
    const screenshot = await sheetEl.screenshot();
    const { numPages, pdfBuffer } = await generateAndAnalyzePdf(targetSheetId);
    saveArtifacts(fileBaseName, pdfBuffer, screenshot);

    const passed = numPages === options.expectedPages
      && inspection.hasBadge
      && inspection.hasRegChip
      && inspection.ledgerPresent
      && inspection.statutoryNoticePresent
      && inspection.signaturePresent;

    console.log(`Result: ${fileBaseName}.pdf -> ${numPages} page(s) (Expected ${options.expectedPages}). Passed: ${passed}. Checks:`, inspection);
    results.push({
      testName: name,
      fileBaseName,
      docType,
      numPages,
      expectedPages: options.expectedPages,
      passed,
      inspection,
    });
  }

  // Invoice 5 items (1 page)
  await testBilling('Tax Invoice', 'Invoice with 5 line items', 'invoice-5-items', 505, 5, { expectedPages: 1, statutoryNotice: true });

  // Invoice 6 items (2 pages)
  await testBilling('Tax Invoice', 'Invoice with 6 line items', 'invoice-6-items', 506, 6, {
    expectedPages: 2,
    longDesc: true,
    govOrder: true,
    govOrderNote: 'As per veterinary rate schedule fixed by Animal Husbandry Dept Notification G.O.(Rt) No.589/2023/AHD',
    statutoryNotice: true,
  });

  // Receipt 5 items (1 page)
  await testBilling('Payment Receipt', 'Receipt with 5 line items', 'receipt-5-items', 605, 5, { expectedPages: 1, statutoryNotice: true });

  // Receipt 6 items (2 pages)
  await testBilling('Payment Receipt', 'Receipt with 6 line items', 'receipt-6-items', 606, 6, {
    expectedPages: 2,
    longDesc: true,
    govOrder: true,
    govOrderNote: 'As per veterinary rate schedule fixed by Animal Husbandry Dept Notification G.O.(Rt) No.589/2023/AHD',
    statutoryNotice: true,
  });

  // Summary output
  const summary = {
    timestamp: new Date().toISOString(),
    targetUrl: TARGET_URL,
    consoleErrorsCount: consoleErrors.length,
    consoleErrors,
    uncaughtExceptionsCount: uncaughtExceptions.length,
    uncaughtExceptions,
    totalTests: results.length,
    passedTests: results.filter((r) => r.passed).length,
    failedTests: results.filter((r) => !r.passed).length,
    allPassed: results.every((r) => r.passed),
    results,
  };

  for (const dir of [WORKSPACE_OUT_DIR, BRAIN_ARTIFACT_DIR]) {
    fs.writeFileSync(path.join(dir, 'live-validation-summary.json'), JSON.stringify(summary, null, 2));
  }

  console.log('\n=============================================================');
  console.log(`FINAL LIVE SMOKE TEST RESULT: ${summary.passedTests}/${summary.totalTests} PASSED`);
  console.log(`Console Errors: ${consoleErrors.length}`);
  console.log(`Uncaught Exceptions: ${uncaughtExceptions.length}`);
  console.log(`All Passed: ${summary.allPassed}`);
  console.log('=============================================================\n');

  await browser.close();
}

run().catch((err) => {
  console.error('FATAL ERROR DURING LIVE PRODUCTION SMOKE TEST:', err);
  process.exit(1);
});
