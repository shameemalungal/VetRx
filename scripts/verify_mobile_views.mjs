import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = path.resolve('artifacts/mobile_verification');
fs.mkdirSync(OUT_DIR, { recursive: true });

const DIST_DIR = fs.existsSync(path.resolve('web/dist'))
  ? path.resolve('web/dist')
  : path.resolve('dist');
const PORT = 3935;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url.includes('/api/auth/me') || req.url.includes('/api/auth/login')) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        return res.end(JSON.stringify({
          user: {
            id: 'usr_doc_test',
            email: 'vet@gmail.com',
            name: 'Dr Test Vet',
            createdAt: '2026-09-16T00:00:00.000Z',
          },
          practice: {
            id: 'prac_independent',
            name: 'Dr Test Vet Practice',
            slug: 'test-vet',
            ownerUserId: 'usr_doc_test',
            isActive: true,
            createdAt: '2026-09-16T00:00:00.000Z',
          },
          membership: {
            id: 'mem_1',
            practiceId: 'prac_independent',
            userId: 'usr_doc_test',
            role: 'PRACTICE_OWNER',
            isActive: true,
          },
          settings: {
            id: 'set_1',
            practiceId: 'prac_independent',
            doctorName: 'Dr Test Vet',
            doctorRegistrationNumber: 'KSVC-2222',
            registrationNumber: 'KSVC-2222',
            doctorDesignation: 'Independent Veterinary Practitioner',
            doctorPhone: '',
            doctorEmail: 'vet@gmail.com',
            doctorAddress: '',
            clinicName: '',
          },
        }));
      }

      if (req.url.includes('/api/settings')) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        return res.end(JSON.stringify({
          settings: {
            doctorName: 'Dr Test Vet',
            doctorRegistrationNumber: 'KSVC-2222',
            registrationNumber: 'KSVC-2222',
            doctorDesignation: 'Independent Veterinary Practitioner',
            doctorPhone: '',
            doctorEmail: 'vet@gmail.com',
            doctorAddress: '',
            clinicName: '',
          }
        }));
      }

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

async function run() {
  const server = await startServer();
  console.log(`Server running at http://localhost:${PORT}`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  // Simulate mobile phone viewport (390 x 844 like modern iPhone / Galaxy)
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  console.log('Bootstrapping session...');
  await page.goto(`http://localhost:${PORT}/?demo=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell, .topbar, .dashboard-greeting, #root', { timeout: 15000 });

  // Seed sample data for testing
  await page.evaluate(async () => {
    const db = window.db;
    if (!db) return;

    await db.practitioners.put({
      id: 1,
      name: 'Dr Test Vet',
      designation: 'Independent Veterinary Practitioner',
      registrationNumber: 'KSVC-2222',
      email: 'vet@gmail.com',
      isActive: true,
    });

    await db.owners.put({
      id: 1,
      name: 'lovo',
      phone: '9876543210',
      address: 'Near Town Hall',
      createdAt: new Date(),
    });

    await db.patients.put({
      id: 1,
      ownerId: 1,
      name: 'lovo',
      species: 'Canine',
      breed: 'Pug',
      sex: 'Male',
      weightKg: 5.0,
      ageNote: '3 years',
      createdAt: new Date(),
    });

    const invId = 1;
    await db.invoices.put({
      id: invId,
      invoiceNumber: 'INV-2026-00001',
      invoiceDate: new Date(),
      ownerId: 1,
      patientId: 1,
      practitionerId: 1,
      status: 'Issued',
      paymentMode: 'Cash',
      grandTotal: 45000,
      subtotalPaisa: 45000,
      discountTotal: 0,
      roundOffPaisa: 0,
      isFullyPaid: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.invoiceItems.where('invoiceId').equals(invId).delete();
    await db.invoiceItems.add({
      invoiceId: invId,
      itemType: 'Medicine',
      description: 'Amoxicillin 250mg (Prescription Medicine)',
      quantity: 10,
      unitPricePaisa: 2500,
      subtotalPaisa: 25000,
      sortOrder: 1,
    });
    await db.invoiceItems.add({
      invoiceId: invId,
      itemType: 'Service',
      description: 'General Clinical Consultation',
      quantity: 1,
      unitPricePaisa: 20000,
      subtotalPaisa: 20000,
      sortOrder: 2,
    });

    // Seed matching Screenshot 2 patient
    await db.owners.put({
      id: 2,
      name: 'dhjssb',
      phone: '98456785458',
      address: 'Town Clinic',
      createdAt: new Date(),
    });

    await db.patients.put({
      id: 2,
      ownerId: 2,
      name: 'lovo',
      species: 'Canine',
      breed: 'Golden retriever',
      sex: 'Male',
      weightKg: 5.0,
      ageNote: '1yr',
      createdAt: new Date(),
    });
  });

  // 1. Check Invoice Details Page and ShareModal on Mobile
  console.log('Testing Invoice Details Page & ShareModal on Mobile...');
  await page.goto(`http://localhost:${PORT}/invoices/1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.invoice-print-toolbar', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 600));

  // Disable native share in browser so ShareModal dialog opens directly
  await page.evaluate(() => {
    try {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true, writable: true });
    } catch (e) {
      console.log('Mock error:', e);
    }
  });

  // Trigger Share Modal
  console.log('Triggering Share Modal...');
  const shareBtn = await page.$('#btn-share-document');
  if (shareBtn) {
    await shareBtn.click();
    await page.waitForSelector('.rx-modal-card', { timeout: 15000 });
    await new Promise((r) => setTimeout(r, 600));
    const shareModalPath = path.join(OUT_DIR, '01_mobile_share_modal.png');
    await page.screenshot({ path: shareModalPath, fullPage: false });
    console.log(`Saved screenshot: ${shareModalPath}`);

    // Close modal
    const closeBtn = await page.$('.rx-modal-card button.btn-secondary');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 300));
  }

  // 2. Check Patients Directory List Page on 360px Mobile (exact Android width from Screenshot 2)
  console.log('Testing Patients List Page on 360px Mobile...');
  await page.setViewport({
    width: 360,
    height: 800,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  await page.goto(`http://localhost:${PORT}/patients`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.patients-header', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 600));

  const patientsListMetrics = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const card = document.querySelector('.patient-card');
    const search = document.querySelector('.patients-search-input');
    const toolbar = document.querySelector('.patients-toolbar');

    return {
      windowWidth: window.innerWidth,
      rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: body.scrollWidth,
      cardWidth: card ? card.getBoundingClientRect().width : 0,
      cardRight: card ? card.getBoundingClientRect().right : 0,
      toolbarWidth: toolbar ? toolbar.getBoundingClientRect().width : 0,
      toolbarRight: toolbar ? toolbar.getBoundingClientRect().right : 0,
      searchInputWidth: search ? search.getBoundingClientRect().width : 0,
    };
  });

  console.log('Patients List Metrics (360px):', patientsListMetrics);

  const patientsListScreenshotPath = path.join(OUT_DIR, '02_mobile_patients_list.png');
  await page.screenshot({ path: patientsListScreenshotPath, fullPage: false });
  console.log(`Saved screenshot: ${patientsListScreenshotPath}`);

  // 3. Check Patient Details Page on Mobile
  console.log('Testing Patient Details Page on Mobile...');
  await page.goto(`http://localhost:${PORT}/patients/2`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.patient-details-header', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 600));

  const patientScreenshotPath = path.join(OUT_DIR, '03_mobile_patient_details.png');
  await page.screenshot({ path: patientScreenshotPath, fullPage: false });
  console.log(`Saved screenshot: ${patientScreenshotPath}`);

  await browser.close();
  server.close();
  console.log('Done verification!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
