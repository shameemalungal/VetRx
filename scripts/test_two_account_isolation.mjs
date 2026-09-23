import puppeteer from 'puppeteer-core';

// ==============================================================================
// VetRx — Two-Account Browser Multi-Tenant Isolation Verification Script
// Tests complete isolation between Account A and Account B in the SAME browser:
// 1. Account A registration & patient creation
// 2. Logout
// 3. Account B registration & profile/patient verification (zero Account A bleed)
// 4. Logout & Account A re-login (zero Account B bleed)
// ==============================================================================

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = process.argv[2] || 'https://vetrx.brightbase.in';

const timestamp = Date.now();
const accountA = {
  name: 'Doctor Alpha',
  practiceName: 'Alpha Veterinary Clinic',
  email: `doc.alpha.${timestamp}@vetrx.test`,
  password: 'AlphaPassword#2026!',
  patientName: `Patient Alpha ${timestamp.toString().slice(-4)}`,
};

const accountB = {
  name: 'Doctor Beta',
  practiceName: 'Beta Veterinary Clinic',
  email: `doc.beta.${timestamp}@vetrx.test`,
  password: 'BetaPassword#2026!',
  patientName: `Patient Beta ${timestamp.toString().slice(-4)}`,
};

const results = [];

function recordCheck(step, testName, passed, details) {
  results.push({ step, testName, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${step}] ${testName}: ${details}`);
}

async function run() {
  console.log(`\n===============================================================`);
  console.log(`Starting Two-Account Isolation Test on: ${TARGET_URL}`);
  console.log(`Account A: ${accountA.email} (${accountA.name})`);
  console.log(`Account B: ${accountB.email} (${accountB.name})`);
  console.log(`===============================================================\n`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleErrors = [];
  const pageErrors = [];

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
    pageErrors.push(err.message);
  });

  try {
    // --------------------------------------------------------------------------
    // Phase 1: Register Account A
    // --------------------------------------------------------------------------
    console.log('--- Phase 1: Register & Setup Account A ---');
    await page.goto(`${TARGET_URL}/register`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#register-name', { timeout: 10000 });
    await page.type('#register-name', accountA.name);
    await page.type('#register-practice-name', accountA.practiceName);
    await page.type('#register-email', accountA.email);
    await page.type('#register-password', accountA.password);
    await page.type('#register-confirm-password', accountA.password);

    await page.click('button[type="submit"]');

    // If an error banner appears, report it
    try {
      await page.waitForSelector('.desktop-header, .sidebar', { timeout: 15000 });
    } catch (e) {
      const banner = await page.$('.auth-error-banner');
      if (banner) {
        const text = await page.evaluate(el => el.textContent, banner);
        throw new Error(`Registration failed with banner: "${text}"`);
      }
      throw e;
    }

    // Verify /api/auth/me for Account A
    const authMeA = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    recordCheck(
      'Auth A',
      'Account A Session & Identity Verification',
      authMeA.user?.name === accountA.name && authMeA.practice?.name === accountA.practiceName,
      `User: ${authMeA.user?.name}, Practice: ${authMeA.practice?.name}`
    );

    // Create Patient Alpha
    console.log('Registering Patient Alpha under Account A...');
    await page.goto(`${TARGET_URL}/patients/new`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.owner-select-tabs', { timeout: 8000 });

    // Switch to Create New Client tab
    const tabs = await page.$$('.owner-select-tabs button');
    if (tabs.length >= 2) {
      await tabs[1].click();
    }
    await page.waitForSelector('#new-owner-name', { timeout: 5000 });

    // Fill Owner & Patient details
    await page.type('#new-owner-name', 'Alpha Owner');
    await page.type('#new-owner-phone', '9847001111');
    await page.type('#patient-name', accountA.patientName);
    await page.select('#patient-species', 'Canine');

    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.startsWith('/patients/'), { timeout: 10000 });

    await page.goto(`${TARGET_URL}/patients`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.patients-page', { timeout: 8000 });

    const contentA = await page.content();
    const hasPatientAlphaInA = contentA.includes(accountA.patientName);
    recordCheck('Patient A', 'Patient Alpha Visible in Account A Directory', hasPatientAlphaInA, `Found: ${hasPatientAlphaInA}`);

    // --------------------------------------------------------------------------
    // Phase 2: Logout Account A
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 2: Logout Account A ---');
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    recordCheck('Logout A', 'Account A Logged Out and Navigated to /login', page.url().includes('/login'), `URL: ${page.url()}`);

    // --------------------------------------------------------------------------
    // Phase 3: Register & Setup Account B
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 3: Register & Verify Account B (Isolation Check) ---');
    await page.goto(`${TARGET_URL}/register`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#register-name', { timeout: 10000 });
    await page.type('#register-name', accountB.name);
    await page.type('#register-practice-name', accountB.practiceName);
    await page.type('#register-email', accountB.email);
    await page.type('#register-password', accountB.password);
    await page.type('#register-confirm-password', accountB.password);

    await page.click('button[type="submit"]');

    try {
      await page.waitForSelector('.desktop-header, .sidebar', { timeout: 15000 });
    } catch (e) {
      const banner = await page.$('.auth-error-banner');
      if (banner) {
        const text = await page.evaluate(el => el.textContent, banner);
        throw new Error(`Registration B failed with banner: "${text}"`);
      }
      throw e;
    }

    // Verify /api/auth/me for Account B
    const authMeB = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return res.json();
    });

    recordCheck(
      'Auth B',
      'Account B Identity strictly isolated from Account A',
      authMeB.user?.name === accountB.name && authMeB.practice?.name === accountB.practiceName,
      `User: ${authMeB.user?.name}, Practice: ${authMeB.practice?.name}`
    );

    // CRITICAL CHECK: Account B must NOT see Account A's name anywhere in the header/dashboard
    const headerTextB = await page.evaluate(() => {
      const header = document.querySelector('.desktop-header')?.textContent || '';
      const sidebar = document.querySelector('.sidebar')?.textContent || '';
      return header + ' ' + sidebar;
    });
    const containsAlphaInB = headerTextB.includes(accountA.name) || headerTextB.includes(accountA.practiceName);
    recordCheck(
      'UI Isolation B',
      'Account B UI does NOT display Account A Profile or Practice',
      !containsAlphaInB,
      `Contains Doctor Alpha: ${containsAlphaInB}`
    );

    // CRITICAL CHECK: Navigate to /patients in Account B — Patient Alpha MUST NOT BE VISIBLE!
    await page.goto(`${TARGET_URL}/patients`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.patients-page', { timeout: 8000 });

    const contentB = await page.content();
    const hasPatientAlphaInB = contentB.includes(accountA.patientName);
    recordCheck(
      'Data Isolation B',
      'Account B cannot view Account A Patient Alpha (Zero Data Bleed)',
      !hasPatientAlphaInB,
      `Patient Alpha leaked into Account B: ${hasPatientAlphaInB}`
    );

    // Create Patient Beta under Account B
    console.log('Registering Patient Beta under Account B...');
    await page.goto(`${TARGET_URL}/patients/new`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.owner-select-tabs', { timeout: 8000 });

    const tabsB = await page.$$('.owner-select-tabs button');
    if (tabsB.length >= 2) {
      await tabsB[1].click();
    }
    await page.waitForSelector('#new-owner-name', { timeout: 5000 });

    await page.type('#new-owner-name', 'Beta Owner');
    await page.type('#new-owner-phone', '9847002222');
    await page.type('#patient-name', accountB.patientName);
    await page.select('#patient-species', 'Feline');

    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.startsWith('/patients/'), { timeout: 10000 });

    await page.goto(`${TARGET_URL}/patients`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.patients-page', { timeout: 8000 });
    const contentB_updated = await page.content();
    const hasPatientBetaInB = contentB_updated.includes(accountB.patientName);
    recordCheck('Patient B', 'Patient Beta Visible in Account B Directory', hasPatientBetaInB, `Found: ${hasPatientBetaInB}`);

    // --------------------------------------------------------------------------
    // Phase 4: Logout Account B and Re-login as Account A
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 4: Logout Account B & Re-login Account A ---');
    await page.evaluate(async () => {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    // Login as Account A
    await page.type('#login-email', accountA.email);
    await page.type('#login-password', accountA.password);
    await page.click('button[type="submit"]');
    await page.waitForSelector('.desktop-header, .sidebar', { timeout: 15000 });

    // Verify Account A sees Patient Alpha and DOES NOT see Patient Beta
    await page.goto(`${TARGET_URL}/patients`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.patients-page', { timeout: 8000 });

    const contentA_final = await page.content();
    const hasPatientAlphaFinal = contentA_final.includes(accountA.patientName);
    const hasPatientBetaFinal = contentA_final.includes(accountB.patientName);

    recordCheck('Data Isolation A', 'Account A sees Patient Alpha', hasPatientAlphaFinal, `Found Patient Alpha: ${hasPatientAlphaFinal}`);
    recordCheck('Data Isolation A', 'Account A cannot see Patient Beta', !hasPatientBetaFinal, `Patient Beta leaked into Account A: ${hasPatientBetaFinal}`);

    // --------------------------------------------------------------------------
    // Phase 5: Browser Storage & Error Audits
    // --------------------------------------------------------------------------
    console.log('\n--- Phase 5: Storage & Runtime Diagnostics ---');
    const totalErrors = consoleErrors.length + pageErrors.length;
    recordCheck(
      'Diagnostics',
      'Zero Unhandled Console & Page Runtime Exceptions',
      totalErrors === 0,
      `Console Errors: ${consoleErrors.length}, Page Errors: ${pageErrors.length}`
    );

  } catch (err) {
    console.error('Fatal error during test execution:', err);
    recordCheck('Test Execution', 'Script Execution Failure', false, String(err));
  } finally {
    await browser.close();
  }

  console.log(`\n===============================================================`);
  console.log(`TEST SUMMARY: ${results.filter((r) => r.passed).length}/${results.length} Checks Passed`);
  console.log(`===============================================================\n`);

  const anyFailed = results.some((r) => !r.passed);
  if (anyFailed) {
    process.exit(1);
  }
}

run();
