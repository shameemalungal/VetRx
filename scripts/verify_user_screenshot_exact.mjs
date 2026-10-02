import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const WORKSPACE_OUT_DIR = path.resolve('artifacts/user_screenshot_verification');
fs.mkdirSync(WORKSPACE_OUT_DIR, { recursive: true });

const DIST_DIR = path.resolve('web/dist');
const PDFJS_BUILD_DIR = path.resolve('node_modules/pdfjs-dist/build');
const PORT = 3920;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];

      if (urlPath.startsWith('/pdfjs/')) {
        const subPath = req.url.replace('/pdfjs/', '').split('?')[0];
        const filePath = path.join(PDFJS_BUILD_DIR, subPath);
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath);
          const mime = ext === '.mjs' || ext === '.js' ? 'text/javascript' : 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': `${mime}; charset=utf-8`,
            'Access-Control-Allow-Origin': '*',
          });
          return res.end(fs.readFileSync(filePath));
        }
      }

      if (req.url.includes('/api/auth/me') || req.url.includes('/api/auth/login')) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        return res.end(JSON.stringify({
          user: {
            id: 'usr_doc_test',
            email: 'testvet@gmail.com',
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
            doctorEmail: 'testvet@gmail.com',
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
            doctorEmail: 'testvet@gmail.com',
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
  console.log(`Server started on http://localhost:${PORT}`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1200'],
    defaultViewport: { width: 1280, height: 1200 },
  });

  const page = await browser.newPage();

  const mockAuthPayload = {
    user: {
      id: 'usr_doc_test',
      email: 'testvet@gmail.com',
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
      doctorPhone: '',
      doctorEmail: 'testvet@gmail.com',
      doctorAddress: '',
      clinicName: '',
    },
  };

  // 1. Bootstrap demo session
  console.log('Bootstrapping session via ?demo=1...');
  await page.goto(`http://localhost:${PORT}/?demo=1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.app-shell, .topbar, .dashboard-greeting', { timeout: 15000 });

  // 2. Configure independent practitioner settings matching user's exact screenshot
  await page.evaluate(async () => {
    const customSettings = {
      doctorName: 'Dr Test Vet',
      doctorRegistrationNumber: 'KSVC-2222',
      registrationNumber: 'KSVC-2222',
      doctorDesignation: 'Independent Veterinary Practitioner',
      doctorEmail: 'testvet@gmail.com',
      doctorPhone: '',
      doctorAddress: '',
      clinicName: '',
    };
    localStorage.setItem('vetrx_settings', JSON.stringify(customSettings));

    const db = window.db;
    if (!db) throw new Error('window.db missing');

    await db.organisations.clear();

    await db.practitioners.put({
      id: 1,
      name: 'Dr Test Vet',
      designation: 'Independent Veterinary Practitioner',
      registrationNumber: 'KSVC-2222',
      email: 'testvet@gmail.com',
      address: '',
      isActive: true,
    });

    await db.owners.put({
      id: 1,
      name: 'dljfnskfjnlk',
      phone: '8734982788',
      address: 'djhasgdj',
      createdAt: '2026-09-19T10:00:00.000Z',
    });

    await db.patients.put({
      id: 1,
      ownerId: 1,
      name: 'dsfj',
      species: 'Bovine',
      breed: 'Jersey',
      sex: 'Female',
      ageNote: '2', // Raw '2' entered by user!
      weightKg: 125.0,
      createdAt: '2026-09-19T10:00:00.000Z',
    });

    const rxId = 1;
    await db.prescriptions.put({
      id: rxId,
      rxNumber: 'RX-2026-0001',
      patientId: 1,
      ownerId: 1,
      practitionerId: 1,
      status: 'Issued',
      issuedAt: '2026-09-19T10:00:00.000Z',
      symptoms: 'Pyrexia / Fever',
      diagnosis: 'E fever',
      specialInstructions: 'If not better for 3 days, Present for blood examination',
      followUpDays: 7,
      doctorName: 'Dr Test Vet',
      doctorRegistrationNumber: 'KSVC-2222',
      doctorDesignation: 'Independent Veterinary Practitioner',
      createdAt: '2026-09-19T10:00:00.000Z',
      updatedAt: '2026-09-19T10:00:00.000Z',
    });

    await db.prescriptionItems.where('prescriptionId').equals(rxId).delete();

    await db.prescriptionItems.add({
      prescriptionId: rxId,
      medicineId: 1,
      brandName: 'Meloxicam Bolus',
      dose: '1 bolus/boli',
      doseUnit: '',
      route: 'PO (Oral)',
      frequency: 'BID (q12h)',
      durationDays: 3,
      quantity: 10,
      dispenseUnit: 'tablet',
      directions: 'Sig: Give after food',
      sortOrder: 1,
    });

    await db.prescriptionItems.add({
      prescriptionId: rxId,
      medicineId: 2,
      brandName: 'Rumen FS Bolus',
      dose: '2 bolus/boli',
      doseUnit: '',
      route: 'PO (Oral)',
      frequency: 'BID (q12h)',
      durationDays: 5,
      quantity: 10,
      dispenseUnit: 'other',
      directions: 'Sig: Give after food',
      sortOrder: 2,
    });

  });

  // Navigate to Prescription Details page
  await page.goto(`http://localhost:${PORT}/prescriptions/1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#prescription-sheet', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Capture on-screen preview of EXACT user case (2 items)
  const sheetEl = await page.$('#prescription-sheet');
  if (sheetEl) {
    await sheetEl.screenshot({ path: path.join(WORKSPACE_OUT_DIR, '01_onscreen_preview.png') });
    console.log('Saved 01_onscreen_preview.png');
  }

  // 2. Extract PDF and render page 1 via pdf.js for EXACT user case
  async function renderCurrentPdf(pdfFilename, pngFilename) {
    const pdfData = await page.evaluate(async (port) => {
      const blob = await window.generatePdfBlob('prescription-sheet');
      const arrayBuffer = await blob.arrayBuffer();

      const pdfjsLib = await import('/pdfjs/pdf.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.mjs';
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const p1 = await pdf.getPage(1);
      const viewport = p1.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await p1.render({ canvasContext: ctx, viewport }).promise;

      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });

      return {
        base64Pdf: base64,
        dataUrl: canvas.toDataURL('image/png'),
        numPages: pdf.numPages
      };
    }, PORT);

    fs.writeFileSync(
      path.join(WORKSPACE_OUT_DIR, pdfFilename),
      Buffer.from(pdfData.base64Pdf, 'base64')
    );
    fs.writeFileSync(
      path.join(WORKSPACE_OUT_DIR, pngFilename),
      Buffer.from(pdfData.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
    );
    console.log(`Saved ${pdfFilename} and ${pngFilename} (${pdfData.numPages} page(s))`);
  }

  await renderCurrentPdf('02_saved_pdf.pdf', '03_saved_pdf_page1.png');

  // 3. Now add 3rd item with multi-line wrapping in dose, route, and sig
  console.log('Testing multi-line wrapping scenario...');
  await page.evaluate(async () => {
    const db = window.db;
    await db.prescriptionItems.add({
      prescriptionId: 1,
      medicineId: 3,
      brandName: 'Amoxicillin + Clavulanic Acid Powder',
      dose: '1.5 bolus twice daily',
      doseUnit: '',
      route: 'Intramuscular Deep Injection',
      frequency: 'TID (q8h)',
      durationDays: 7,
      quantity: 1,
      dispenseUnit: 'bottle',
      directions: 'Sig: Reconstitute with sterile water before administration and shake well',
      sortOrder: 3,
    });
  });

  await page.goto(`http://localhost:${PORT}/prescriptions/1`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#prescription-sheet', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 1000));

  const sheetEl2 = await page.$('#prescription-sheet');
  if (sheetEl2) {
    await sheetEl2.screenshot({ path: path.join(WORKSPACE_OUT_DIR, '04_multiline_wrapped_onscreen.png') });
  }
  await renderCurrentPdf('05_multiline_wrapped.pdf', '06_multiline_wrapped_page1.png');

  await browser.close();
  server.close();
  console.log('Verification completed successfully!');
}

run().catch(console.error);
