// =============================================================
// VetRx — verify_phase5_pdf_layouts.mjs
// Phase 5 Validation Script for PDF Layouts, Pagination,
// Badge Alignments, and Visual Quality.
// =============================================================

import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || 'C:\\Users\\drsha\\.gemini\\antigravity-ide\\brain\\52a3d567-9590-486b-be58-3ce41124e8e1';
const OUT_DIR = path.join(ARTIFACT_DIR, 'phase5_artifacts');
const DIST_DIR = path.resolve('web/dist');
const PORT = 3500 + Math.floor(Math.random() * 500);
const TARGET_URL = `http://localhost:${PORT}`;

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
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
      // Mock auth endpoints
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
      console.log(`Static test server running on ${TARGET_URL}`);
      resolve(server);
    });
  });
}

async function run() {
  const server = await startStaticServer();
  const userDataDir = path.join(os.tmpdir(), `edge-test-p5-${Date.now()}`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    userDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,960'],
    defaultViewport: { width: 1280, height: 960 },
  });

  const page = await browser.newPage();
  page.on('console', (msg) => {
    console.log(`[PAGE ${msg.type().toUpperCase()}]`, msg.text());
  });
  page.on('pageerror', (err) => {
    console.log('[PAGE ERROR]', err.message, err.stack);
  });

  // 1. Bootstrap demo session
  console.log('--- Bootstrapping session with demo data ---');
  await page.goto(`${TARGET_URL}/?demo=1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.app-shell, .topbar, .dashboard-greeting', { timeout: 15000 });
  console.log('Session bootstrapped successfully.');

  const results = {
    prescriptions: [],
    invoices: [],
    receipts: [],
  };

  // Helper to put record in IndexedDB
  async function putInDb(storeName, item) {
    return page.evaluate(async ({ storeName, item }) => {
      const db = window.db;
      if (!db) {
        throw new Error('window.db is not defined in page context');
      }
      return await db.table(storeName).put(item);
    }, { storeName, item });
  }

  // Helper to put prescription items
  async function putPrescriptionWithItems(medCount, options = {}) {
    const rxId = 1000 + medCount + Math.floor(Math.random() * 8000);
    const rxNumber = `RX-PH5-${rxId}`;
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
        ? 'Acute Bovine Respiratory Disease Complex with Severe Bronchopneumonia & Systemic Toxemia'
        : 'Mastitis / Systemic Bacterial Infection',
      symptoms: 'Fever 104.2F, anorexia, decreased milk yield, swollen left quarter.',
      instructions: options.specialInstructions || [
        'Keep animal in dry, clean, well-ventilated shelter with fresh bedding.',
        'Provide ad libitum clean drinking water and green fodder.',
      ],
      followUpDays: options.followUpDays || 5,
      recheckIntervalPreset: '5 Days',
      status: 'issued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await putInDb('prescriptions', rx);

    for (let i = 1; i <= medCount; i++) {
      const pItem = {
        id: rxId * 100 + i,
        prescriptionId: rxId,
        medicineId: i,
        brandName: options.longName
          ? `Amoxicillin & Potassium Clavulanate Bolus Vet Premium Forte Extra #${i}`
          : `Amoxyclav Bolus ${i}`,
        genericName: options.longGeneric ? 'Amoxicillin Trihydrate + Potassium Clavulanate IP' : 'Amoxicillin + Clavulanate',
        presentation: 'Bolus',
        dose: options.dose || '1 bolus',
        doseUnit: '',
        strengthVolume: '1.75g',
        route: options.longRoute
          ? 'PO (Per Os / Oral administration with jaggery)'
          : (i % 2 === 0 ? 'IV (Intravenous)' : 'PO (Oral)'),
        frequency: options.longFreq ? 'BID (Twice daily after morning and evening feed)' : 'BID (q12h)',
        durationDays: 5,
        quantity: 10,
        unit: 'Bolus',
        directions: options.longSig
          ? 'Sig: Administer orally mixed with crushed jaggery or treacle immediately following grain feeding. Ensure continuous access to clean fresh drinking water. Complete full course.'
          : 'Sig: Give after food with drinking water. Complete full course.',
        sortOrder: i,
      };
      await putInDb('prescriptionItems', pItem);
    }

    return rxId;
  }

  // Test Prescription
  async function testPrescription(name, medCount, options = {}) {
    console.log(`\n--- Testing Prescription: ${name} (${medCount} meds) ---`);
    const rxId = await putPrescriptionWithItems(medCount, options);

    await page.goto(`${TARGET_URL}/prescriptions/${rxId}`, { waitUntil: 'networkidle0' });
    try {
      await page.waitForSelector('#prescription-sheet', { timeout: 8000 });
    } catch (e) {
      const pageContent = await page.evaluate(() => document.body.innerText);
      console.error(`Failed to find #prescription-sheet for rxId=${rxId}. Page content:\n`, pageContent.slice(0, 500));
      throw e;
    }
    await new Promise((r) => setTimeout(r, 600));

    const metrics = await page.evaluate(() => {
      const sheet = document.getElementById('prescription-sheet');
      const badge = document.querySelector('.document-badge');
      const regChip = document.querySelector('.letterhead-reg-chip');
      const tags = Array.from(document.querySelectorAll('.letterhead-block-tag'));
      const sigBlock = document.querySelector('.signature-block');
      const routeBox = document.querySelector('.stationery-route-box');
      const sigBox = document.querySelector('.stationery-sig-box');
      const rows = document.querySelectorAll('.stationery-meds-table tbody tr');

      // Check if stethoscope icon is in any letterhead-block-tag
      const hasStethoscopeInTag = tags.some((t) => t.innerHTML.includes('stethoscope'));

      return {
        sheetHeight: sheet.offsetHeight,
        sheetWidth: sheet.offsetWidth,
        badgeText: badge ? badge.textContent.trim() : null,
        badgeDisplay: badge ? window.getComputedStyle(badge).display : null,
        regChipText: regChip ? regChip.textContent.trim() : null,
        hasStethoscopeInTag,
        routeBoxWrap: routeBox ? window.getComputedStyle(routeBox).overflowWrap : null,
        sigBoxWrap: sigBox ? window.getComputedStyle(sigBox).overflowWrap : null,
        sigBlockBreak: sigBlock ? window.getComputedStyle(sigBlock).breakInside : null,
        rowCount: rows.length,
        childBreakdown: sheet ? Array.from(sheet.children[0]?.children || []).map(c => `${c.className || c.tagName}: ${c.offsetHeight}px`).concat([`SigRow: ${sheet.children[1]?.offsetHeight}px`]) : [],
      };
    });

    console.log(`[Result] ${name}: Height=${metrics.sheetHeight}px, Rows=${metrics.rowCount}, Badge="${metrics.badgeText}", StethoscopeInTag=${metrics.hasStethoscopeInTag}, SigBreak="${metrics.sigBlockBreak}"`);
    if (name === '1_medicine' || name === '2_medicines' || name === '5_medicines') {
      console.log(`  Breakdown for ${name}:`, metrics.childBreakdown);
    }

    // Screenshot
    const screenshotPath = path.join(OUT_DIR, `prescription_${name}.png`);
    const sheetHandle = await page.$('#prescription-sheet');
    if (sheetHandle) {
      await sheetHandle.screenshot({ path: screenshotPath });
    }

    // Single page threshold at 780px width is ~1077px
    const fitsOnePage = metrics.sheetHeight <= 1077;
    console.log(`Fits 1 A4 Page: ${fitsOnePage} (${metrics.sheetHeight}px <= 1077px)`);

    results.prescriptions.push({
      name,
      medCount,
      sheetHeight: metrics.sheetHeight,
      fitsOnePage,
      hasStethoscopeInTag: metrics.hasStethoscopeInTag,
      badgeText: metrics.badgeText,
      sigBlockBreak: metrics.sigBlockBreak,
      screenshot: `prescription_${name}.png`,
    });
  }

  // Helper to put invoice with items
  async function putInvoiceWithItems(docType, itemCount, options = {}) {
    const invId = 2000 + itemCount + Math.floor(Math.random() * 8000);
    const invoiceNumber = `${docType === 'Tax Invoice' ? 'INV' : 'RCP'}-PH5-${invId}`;

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
      paymentMethod: docType === 'Tax Invoice' ? 'Pending' : 'UPI / Cash',
      notes: options.statutoryNotice
        ? 'Statutory notice: Clinical examination & treatment exempt from GST.'
        : 'Thank you for consulting VetRx.',
      subtotal: itemCount * 45000,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: itemCount * 45000,
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
          ? `Comprehensive Clinical Examination & Ultrasound Diagnostic Evaluation #${i}`
          : `Clinical Service Item #${i}`,
        category: cat,
        quantity: 1,
        unit: 'service',
        unitPricePaisa: 45000,
        discountAmtPaisa: 0,
        prescriptionId: 1001,
        prescriptionNumber: 'RX-PH5-0001',
        patientName: 'Kaveri (Cow)',
        ownerName: 'Ramesh Kumar',
        sortOrder: i,
      };
      await putInDb('invoiceItems', item);
    }

    return invId;
  }

  // Test Billing Doc
  async function testBillingDoc(docType, name, itemCount, options = {}) {
    console.log(`\n--- Testing ${docType}: ${name} (${itemCount} items) ---`);
    const invId = await putInvoiceWithItems(docType, itemCount, options);

    await page.goto(`${TARGET_URL}/invoices/${invId}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.invoice-a4-sheet', { timeout: 8000 });
    await new Promise((r) => setTimeout(r, 600));

    const metrics = await page.evaluate(() => {
      const sheet = document.querySelector('.invoice-a4-sheet');
      const badge = document.querySelector('.document-badge');
      const regBadge = document.querySelector('.practitioner-header-reg-chip');
      const sigBlock = document.querySelector('.signature-block');
      const rows = document.querySelectorAll('.invoice-print-table tbody tr');

      return {
        sheetHeight: sheet.offsetHeight,
        sheetWidth: sheet.offsetWidth,
        badgeText: badge ? badge.textContent.trim() : null,
        badgeDisplay: badge ? window.getComputedStyle(badge).display : null,
        regBadgeText: regBadge ? regBadge.textContent.trim() : null,
        sigBlockBreak: sigBlock ? window.getComputedStyle(sigBlock).breakInside : null,
        rowCount: rows.length,
        childBreakdown: sheet ? Array.from(sheet.children).map(c => `${c.className || c.tagName}: ${c.offsetHeight}px`) : [],
      };
    });

    console.log(`[Result] ${docType} ${name}: Height=${metrics.sheetHeight}px, Rows=${metrics.rowCount}, Badge="${metrics.badgeText}", Reg="${metrics.regBadgeText}", SigBreak="${metrics.sigBlockBreak}"`);
    if (name === '5_line_items') {
      console.log(`  Breakdown for ${docType} ${name}:`, metrics.childBreakdown);
    }

    const filename = `${docType === 'Tax Invoice' ? 'invoice' : 'receipt'}_${name}.png`;
    const screenshotPath = path.join(OUT_DIR, filename);
    const sheetHandle = await page.$('.invoice-a4-sheet');
    if (sheetHandle) {
      await sheetHandle.screenshot({ path: screenshotPath });
    }

    const fitsOnePage = metrics.sheetHeight <= 1077;
    console.log(`Fits 1 A4 Page: ${fitsOnePage} (${metrics.sheetHeight}px <= 1077px)`);

    const targetList = docType === 'Tax Invoice' ? results.invoices : results.receipts;
    targetList.push({
      name,
      itemCount,
      sheetHeight: metrics.sheetHeight,
      fitsOnePage,
      badgeText: metrics.badgeText,
      sigBlockBreak: metrics.sigBlockBreak,
      screenshot: filename,
    });
  }

  // --- RUN TEST MATRIX ---
  console.log('\n======================================================');
  console.log('EXECUTING PRESCRIPTION MATRIX');
  console.log('======================================================');
  await testPrescription('1_medicine', 1);
  await testPrescription('2_medicines', 2);
  await testPrescription('5_medicines', 5);
  await testPrescription('6_medicines', 6);
  await testPrescription('long_medicine_name', 2, { longName: true, longGeneric: true });
  await testPrescription('long_route_text', 2, { longRoute: true });
  await testPrescription('long_frequency_text', 2, { longFreq: true });
  await testPrescription('long_sig_text', 2, { longSig: true });
  await testPrescription('special_instructions', 2, {
    specialInstructions: [
      'Isolate animal in clean calving pen with fresh straw bedding.',
      'Milk affected quarters twice daily into separate bucket and dispose safely.',
      'Apply cold compresses to udder followed by gentle topical herbal mastitis balm.',
    ]
  });
  await testPrescription('followup_care_plan', 2, { followUpDays: 7 });
  await testPrescription('long_practitioner_qualification', 2, { longDiagnosis: true });

  console.log('\n======================================================');
  console.log('EXECUTING INVOICE MATRIX');
  console.log('======================================================');
  await testBillingDoc('Tax Invoice', '1_line_item', 1);
  await testBillingDoc('Tax Invoice', '2_line_items', 2);
  await testBillingDoc('Tax Invoice', '5_line_items', 5);
  await testBillingDoc('Tax Invoice', '6_line_items', 6);
  await testBillingDoc('Tax Invoice', 'long_item_description', 2, { longDesc: true });
  await testBillingDoc('Tax Invoice', 'all_six_categories', 6);
  await testBillingDoc('Tax Invoice', 'statutory_notice', 2, { statutoryNotice: true });

  console.log('\n======================================================');
  console.log('EXECUTING RECEIPT MATRIX');
  console.log('======================================================');
  await testBillingDoc('Payment Receipt', '1_line_item', 1);
  await testBillingDoc('Payment Receipt', '2_line_items', 2);
  await testBillingDoc('Payment Receipt', '5_line_items', 5);
  await testBillingDoc('Payment Receipt', '6_line_items', 6);
  await testBillingDoc('Payment Receipt', 'long_item_description', 2, { longDesc: true });
  await testBillingDoc('Payment Receipt', 'payment_summary', 2);
  await testBillingDoc('Payment Receipt', 'statutory_notice', 2, { statutoryNotice: true });

  await browser.close();
  server.close();

  // Save results JSON
  fs.writeFileSync(path.join(OUT_DIR, 'phase5_results.json'), JSON.stringify(results, null, 2));
  console.log(`\nAll matrix tests complete! Results saved to ${path.join(OUT_DIR, 'phase5_results.json')}`);
}

run().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
