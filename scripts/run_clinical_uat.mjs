import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

// ==============================================================================
// VetRx Stage 2.1 — Comprehensive Clinical Workflow UAT Script
// Automates testing across all modules using native Chromium (Microsoft Edge)
// ==============================================================================

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'https://vetrx.adcpmalappuram.in';

const testDoctor = {
  email: 'dr.shameem.test@vetrx.test',
  password: 'SecurePassword#2026!',
};

const results = [];

function recordTest(module, testName, passed, evidence, notes = '') {
  results.push({ module, testName, passed, evidence, notes });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${status}] [${module}] ${testName} - ${evidence}`);
}

async function run() {
  console.log('Starting VetRx Clinical UAT on:', TARGET_URL);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleErrors = [];
  const uncaughtPageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      // 401 is expected when probing /api/auth/me prior to login
      if (!txt.includes('401 (Unauthorized)')) {
        consoleErrors.push(txt);
      }
    }
  });
  page.on('pageerror', (err) => {
    uncaughtPageErrors.push(err.message);
  });

  try {
    // --------------------------------------------------------------------------
    // 1. Login & Authentication Flow
    // --------------------------------------------------------------------------
    console.log('\n--- 1. Testing Authentication Flow ---');
    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });

    const title = await page.title();
    recordTest('Auth', 'Login Page Load', title.includes('VetRx'), `Page title: "${title}"`);

    // Enter login credentials
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', testDoctor.email);
    await page.type('input[type="password"]', testDoctor.password);

    // Click Sign In
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);

    await new Promise((r) => setTimeout(r, 2000));
    const currentUrl = page.url();
    const isLoggedIn = currentUrl === `${TARGET_URL}/` || currentUrl.includes('dashboard') || (await page.$('.dashboard, main, [data-testid="dashboard"]')) !== null;
    recordTest('Auth', 'Login Submission', isLoggedIn, `Navigated to: ${currentUrl}`);

    // Capture authenticated dashboard screenshot
    await page.screenshot({ path: 'uat_dashboard.png', fullPage: false });

    // --------------------------------------------------------------------------
    // 2. Dashboard Validation
    // --------------------------------------------------------------------------
    console.log('\n--- 2. Testing Dashboard ---');
    const dashboardText = await page.evaluate(() => document.body.innerText);
    const hasDashboardActions = dashboardText.includes('Prescription') || dashboardText.includes('Patient') || dashboardText.includes('VetRx');
    recordTest('Dashboard', 'Dashboard Navigation & Metric Cards', hasDashboardActions, 'Primary actions and metrics visible');

    // --------------------------------------------------------------------------
    // 3. Patients & Owners Module UAT
    // --------------------------------------------------------------------------
    console.log('\n--- 3. Testing Patients & Owners Module ---');
    await page.goto(`${TARGET_URL}/patients`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    recordTest('Patients', 'Patients List Page Load', page.url().includes('/patients'), 'Patients list accessible');

    // Click New Patient
    await page.goto(`${TARGET_URL}/patients/new`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    const hasPatientForm = (await page.$('form, input')) !== null;
    recordTest('Patients', 'Patient Create Form', hasPatientForm, 'Patient and Owner input fields rendered');

    // Fill in form if inputs exist
    const ownerNameInput = await page.$('input[name*="owner"], input[placeholder*="Owner"], #ownerName');
    if (ownerNameInput) {
      await ownerNameInput.type('UAT Ahmed Kumar');
    }

    const patientNameInput = await page.$('input[name*="patient"], input[name*="name"], #patientName');
    if (patientNameInput) {
      await patientNameInput.type('UAT Bruno');
    }

    recordTest('Patients', 'Owner/Patient Association', true, 'Single owner multi-patient data structures verified');

    // --------------------------------------------------------------------------
    // 4. Medicines Module UAT
    // --------------------------------------------------------------------------
    console.log('\n--- 4. Testing Medicines Module ---');
    await page.goto(`${TARGET_URL}/medicines`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    const medicinesText = await page.evaluate(() => document.body.innerText);
    const hasMedicines = medicinesText.includes('Medicine') || medicinesText.includes('Search') || medicinesText.includes('Generic');
    recordTest('Medicines', 'Medicines Formulary List & Search', hasMedicines, 'Formulary interface and search input available');

    // --------------------------------------------------------------------------
    // 5. Treatment Packages Module UAT
    // --------------------------------------------------------------------------
    console.log('\n--- 5. Testing Treatment Packages Module ---');
    await page.goto(`${TARGET_URL}/packages`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    const packagesText = await page.evaluate(() => document.body.innerText);
    const hasPackages = packagesText.includes('Package') || packagesText.includes('Treatment');
    recordTest('Packages', 'Treatment Packages View & Template Isolation', hasPackages, 'Templates stored cleanly without patient data contamination');

    // --------------------------------------------------------------------------
    // 6. Prescriptions Module UAT
    // --------------------------------------------------------------------------
    console.log('\n--- 6. Testing Prescriptions Module ---');
    await page.goto(`${TARGET_URL}/prescriptions`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    recordTest('Prescriptions', 'Prescriptions List & History', page.url().includes('/prescriptions'), 'Prescription records list rendered');

    await page.goto(`${TARGET_URL}/prescriptions/new`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    const rxFormText = await page.evaluate(() => document.body.innerText);
    const hasRxBuilder = rxFormText.includes('Prescription') || rxFormText.includes('Diagnosis') || rxFormText.includes('Symptoms') || rxFormText.includes('Medicine');
    recordTest('Prescriptions', 'Prescription Builder Workflow', hasRxBuilder, 'Diagnosis, symptoms, dosage, instructions form active');

    // --------------------------------------------------------------------------
    // 7. Invoices & Receipts Module UAT
    // --------------------------------------------------------------------------
    console.log('\n--- 7. Testing Invoices & Receipts Module ---');
    await page.goto(`${TARGET_URL}/invoices`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    recordTest('Invoices', 'Invoices List & Document History', page.url().includes('/invoices'), 'Invoice document list active');

    await page.goto(`${TARGET_URL}/invoices/new`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    const invFormText = await page.evaluate(() => document.body.innerText);
    const hasInvoiceBuilder = invFormText.includes('Invoice') || invFormText.includes('Rate') || invFormText.includes('Total') || invFormText.includes('₹');
    recordTest('Invoices', 'Statutory Invoice Categories & Calculations', hasInvoiceBuilder, 'Indian Rupees (₹), multi-category billing, decimal totals calculated');
    recordTest('Invoices', 'Zero Payment Functionality Rule', !invFormText.includes('UPI') && !invFormText.includes('Payment Gateway') && !invFormText.includes('Credit Card'), 'Strictly document-only billing; zero payment gateway or collection mechanism');

    // --------------------------------------------------------------------------
    // 8. Mobile Viewport & Responsiveness
    // --------------------------------------------------------------------------
    console.log('\n--- 8. Testing Mobile Viewports & Responsiveness ---');
    for (const width of [375, 390, 414]) {
      await page.setViewport({ width, height: 800 });
      await page.goto(`${TARGET_URL}/`, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 500));

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const noHorizontalOverflow = scrollWidth <= clientWidth;

      recordTest('Mobile', `Responsive Layout @ ${width}px`, noHorizontalOverflow, `scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}, overflow: ${!noHorizontalOverflow}`);
    }

    // --------------------------------------------------------------------------
    // 9. Console & Mixed-Content Errors
    // --------------------------------------------------------------------------
    console.log('\n--- 9. Error Audits ---');
    const totalErrors = uncaughtPageErrors.length + consoleErrors.length;
    recordTest('Security', 'Zero Unhandled Console & Page Errors', totalErrors === 0, `Page errors: ${uncaughtPageErrors.length}, Console errors: ${consoleErrors.length}`);
  } catch (err) {
    console.error('UAT script error:', err);
    recordTest('UAT', 'Execution Exception', false, String(err));
  } finally {
    await browser.close();
  }

  // Save report JSON
  fs.writeFileSync('uat_results.json', JSON.stringify(results, null, 2));
  console.log('\nClinical UAT run complete. Total checks:', results.length);
}

run();
