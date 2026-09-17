// =============================================================
// VetRx — verify_phase5e_functional.mjs
// Phase 5E: Baseline Functional Workflows & Regression Test
// =============================================================

import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DIST_DIR = path.resolve('web/dist');
const PORT = 3920 + Math.floor(Math.random() * 50);
const TARGET_URL = `http://localhost:${PORT}`;

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
  console.log(`[Phase 5E] Starting test server on ${TARGET_URL}`);
  const server = await startStaticServer();

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const results = [];
  function record(testName, passed, detail = '') {
    results.push({ testName, passed, detail });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName} ${detail ? `(${detail})` : ''}`);
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // 1. App Loads and Seed / DB initialises
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
    const title = await page.title();
    record('App Initialization & DOM Shell', title.includes('VetRx'), `Title: ${title}`);

    // Wait for Dexie database availability
    await page.waitForFunction(() => typeof window.db !== 'undefined', { timeout: 10000 });

    // 2. Owner & Patient Creation via IndexedDB
    const patientCreated = await page.evaluate(async () => {
      const db = window.db;
      const ownerId = await db.owners.add({
        name: 'Suresh Kumar',
        phone: '9847012345',
        address: 'Down Hill, Malappuram',
        createdAt: new Date().toISOString(),
      });

      const patientId = await db.patients.add({
        name: 'Tommy',
        species: 'Canine',
        breed: 'Labrador Retriever',
        sex: 'Male Intact',
        weightKg: 28.5,
        ageNote: '3 years',
        ownerId: ownerId,
        createdAt: new Date().toISOString(),
      });

      const pat = await db.patients.get(patientId);
      return pat && pat.weightKg === 28.5;
    });
    record('Owner and Patient Entity Creation & Persistence', patientCreated);

    // 3. Prescription Creation with Dosages, Route, Frequency, Duration
    const rxCreated = await page.evaluate(async () => {
      const db = window.db;
      const rxId = await db.prescriptions.add({
        rxNumber: 'RX-2026-0001',
        patientId: 1,
        ownerId: 1,
        status: 'Issued',
        symptoms: 'Mild pyrexia, lethargy, reduced appetite for 2 days',
        diagnosis: 'Acute bacterial gastroenteritis',
        notes: 'Advised plenty of fluids',
        instructions: 'Give oral medications after food. Complete course.',
        followUpDays: 7,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.prescriptionItems.add({
        prescriptionId: rxId,
        brandName: 'Amoxyclav 625',
        genericName: 'Amoxicillin + Potassium Clavulanate',
        presentation: 'Tablet',
        dose: '375 mg',
        doseUnit: 'mg',
        route: 'PO (Oral)',
        frequency: 'BID (q12h)',
        durationDays: 7,
        quantity: 14,
        dispenseUnit: 'Tabs',
        directions: 'Give 1 tablet every 12 hours after meals.',
      });

      await db.prescriptionItems.add({
        prescriptionId: rxId,
        brandName: 'Pantocid 40',
        genericName: 'Pantoprazole Sodium',
        presentation: 'Tablet',
        dose: '20 mg',
        doseUnit: 'mg',
        route: 'PO (Oral)',
        frequency: 'OD (q24h)',
        durationDays: 7,
        quantity: 7,
        dispenseUnit: 'Tabs',
        directions: 'Give 1 tablet in the morning 30 minutes before food.',
      });

      const items = await db.prescriptionItems.where('prescriptionId').equals(rxId).toArray();
      return rxId > 0 && items.length === 2;
    });
    record('Prescription Creation with 2 Medicines', rxCreated);

    // 4. Prescription Reload & PDF Generation
    await page.goto(`${TARGET_URL}/prescriptions/1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#prescription-sheet', { timeout: 10000 });
    const rxPdfGenerated = await page.evaluate(async () => {
      if (typeof window.generatePdfBlob !== 'function') return false;
      const blob = await window.generatePdfBlob('prescription-sheet');
      return blob instanceof Blob && blob.size > 1000;
    });
    record('Prescription Reload & Real PDF Blob Generation', rxPdfGenerated);

    // 5. Invoice Creation with 6 Billing Categories & Paisa Amounts
    const invoiceVerified = await page.evaluate(async () => {
      const db = window.db;
      const invId = await db.invoices.add({
        invoiceNumber: 'INV-2026-0001',
        prescriptionId: 1,
        patientId: 1,
        ownerId: 1,
        status: 'Paid',
        invoiceDate: new Date().toISOString(),
        paymentDate: new Date().toISOString(),
        paymentMethod: 'UPI',
        subtotal: 210000,
        discount: 0,
        grandTotal: 210000,
        amountPaid: 210000,
        balanceDue: 0,
        notes: 'Statutory clinical charges applied.',
        createdAt: new Date().toISOString(),
      });

      const categories = ['Medicine', 'Procedure Fee', 'Consultation', 'Vaccination', 'Lab Test', 'General Health Care'];
      for (let i = 0; i < categories.length; i++) {
        await db.invoiceItems.add({
          invoiceId: invId,
          category: categories[i],
          description: `${categories[i]} Clinical Test Service`,
          hsnSac: categories[i] === 'Medicine' ? '3004' : '9993',
          quantity: 1,
          unit: 'service',
          unitPrice: 35000,
          totalAmount: 35000,
          sortOrder: i,
        });
      }

      const items = await db.invoiceItems.where('invoiceId').equals(invId).toArray();
      return invId > 0 && items.length === 6;
    });
    record('Invoice Creation with All 6 Categories & Paisa Storage', invoiceVerified);

    // 6. Invoice Reload & PDF Generation
    await page.goto(`${TARGET_URL}/invoices/1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#invoice-sheet', { timeout: 10000 });
    const invPdfGenerated = await page.evaluate(async () => {
      if (typeof window.generatePdfBlob !== 'function') return false;
      const blob = await window.generatePdfBlob('invoice-sheet');
      return blob instanceof Blob && blob.size > 1000;
    });
    record('Invoice Reload & Real PDF Blob Generation', invPdfGenerated);

    // 7. Receipt Creation & Payment Summary
    await page.goto(`${TARGET_URL}/invoices/1?type=Payment+Receipt`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#invoice-sheet', { timeout: 10000 });
    const receiptLabelText = await page.evaluate(() => {
      const badge = document.querySelector('.invoice-print-badge');
      const label = document.querySelector('.document-status-label') || document.querySelector('.document-badge');
      return `${badge ? badge.textContent.trim() : ''} ${label ? label.textContent.trim() : ''}`.trim();
    });
    const receiptVerified = receiptLabelText.toUpperCase().includes('PAYMENT RECEIPT');
    record('Payment Receipt Route & Status Label Verification', receiptVerified, `Label: ${receiptLabelText}`);

  } catch (err) {
    record('Execution Exception', false, err.message);
  } finally {
    await browser.close();
    server.close();
  }

  const allPassed = results.every((r) => r.passed);
  console.log(`\n======================================================`);
  console.log(`FUNCTIONAL REGRESSION SUITE: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
  console.log(`Total: ${results.length} | Passed: ${results.filter((r) => r.passed).length}`);
  console.log(`======================================================`);
  if (!allPassed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
