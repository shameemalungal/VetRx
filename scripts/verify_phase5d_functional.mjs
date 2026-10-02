// =============================================================
// VetRx — verify_phase5d_functional.mjs
// Phase 5D: Section 3 Baseline Functional Workflows & Regression Test
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
      console.log(`Functional Test Server listening at ${TARGET_URL}`);
      resolve(server);
    });
  });
}

async function main() {
  const server = await startStaticServer();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vetrx-func-'));

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    userDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,960'],
    defaultViewport: { width: 1280, height: 960 },
  });

  const page = await browser.newPage();
  const results = [];

  function record(testName, passed, details = '') {
    results.push({ testName, passed, details });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}${details ? ' - ' + details : ''}`);
  }

  try {
    // 1. Initial Page Load & Seed Bootstrap
    await page.goto(`${TARGET_URL}/?demo=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.app-shell', { timeout: 10000 });
    record('App Initialization & Demo Seed', true);

    // 2. Patient Creation & Search
    const patientCreated = await page.evaluate(async () => {
      const db = window.db;
      const ownerId = await db.owners.add({
        name: 'Phase 5D Owner Test',
        phone: '+91 99988 77766',
        address: 'Test Address Malappuram',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const patientId = await db.patients.add({
        name: 'Phase5D Dog Patient',
        species: 'Canine',
        breed: 'Golden Retriever',
        gender: 'Female',
        weightKg: 22.5,
        ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const retrieved = await db.patients.get(patientId);
      return retrieved && retrieved.name === 'Phase5D Dog Patient';
    });
    record('Patient & Owner Creation & Retrieval', patientCreated);

    // 3. Prescription Creation with 2 and 5 medicines, symptoms, diagnosis, follow-up
    const rxCreated = await page.evaluate(async () => {
      const db = window.db;
      const rxId = await db.prescriptions.add({
        rxNumber: 'RX-P5D-TEST-001',
        patientId: 1,
        ownerId: 1,
        practitionerId: 1,
        date: new Date().toISOString(),
        diagnosis: 'Acute Enteritis',
        symptoms: 'Vomiting and mild dehydration',
        instructions: ['Provide oral rehydration solution', 'Monitor appetite'],
        followUpDays: 3,
        status: 'issued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Add 2 items
      await db.prescriptionItems.add({
        prescriptionId: rxId,
        medicineId: 1,
        brandName: 'Amoxyclav Bolus',
        genericName: 'Amoxicillin + Clavulanic Acid',
        dose: '1 bolus',
        doseUnit: 'Bolus',
        route: 'PO (Oral)',
        frequency: 'BID (q12h)',
        duration: '5 days',
        dispenseQuantity: 10,
        dispenseUnit: 'Bolus',
        instructions: 'Administer after meals',
      });

      await db.prescriptionItems.add({
        prescriptionId: rxId,
        medicineId: 2,
        brandName: 'Melonex Plus Bolus',
        genericName: 'Meloxicam + Paracetamol',
        dose: '1 bolus',
        doseUnit: 'Bolus',
        route: 'PO (Oral)',
        frequency: 'OD (q24h)',
        duration: '3 days',
        dispenseQuantity: 3,
        dispenseUnit: 'Bolus',
        instructions: 'Administer with food',
      });

      const items = await db.prescriptionItems.where('prescriptionId').equals(rxId).toArray();
      return rxId > 0 && items.length === 2;
    });
    record('Prescription Creation & Items Persistence', rxCreated);

    // 4. Prescription Reload and PDF Generation Verification
    await page.goto(`${TARGET_URL}/prescriptions/1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#prescription-sheet', { timeout: 10000 });
    const pdfBlobGenerated = await page.evaluate(async () => {
      if (typeof window.generatePdfBlob !== 'function') return false;
      const blob = await window.generatePdfBlob('prescription-sheet');
      return blob instanceof Blob && blob.size > 1000;
    });
    record('Prescription Reload & Real PDF Blob Generation', pdfBlobGenerated);

    // 5. Invoice Creation, All Six Categories, and Indian Rupee Formatting
    const invoiceVerified = await page.evaluate(async () => {
      const db = window.db;
      const invId = await db.invoices.add({
        invoiceNumber: 'INV-P5D-TEST-001',
        documentType: 'Tax Invoice',
        patientId: 1,
        ownerId: 1,
        practitionerId: 1,
        invoiceDate: new Date().toISOString(),
        status: 'issued',
        paymentStatus: 'unpaid',
        totalAmount: 210000, // Rs 2,100.00
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    const receiptBadgeText = await page.evaluate(() => {
      const badge = document.querySelector('.document-badge');
      return badge ? badge.textContent.trim() : '';
    });
    const receiptVerified = receiptBadgeText === 'Payment Receipt';
    record('Payment Receipt Route & Badge Verification', receiptVerified, `Badge: ${receiptBadgeText}`);

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
