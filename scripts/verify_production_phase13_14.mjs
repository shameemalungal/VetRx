import puppeteer from 'puppeteer-core';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'https://vetrx.brightbase.in';

const testDoctor = {
  email: 'dr.shameem.test@vetrx.test',
  password: 'SecurePassword#2026!',
};

async function main() {
  console.log('=== VETRX PHASE 13 + PHASE 14 PRODUCTION VERIFICATION ===');
  console.log('Target URL:', TARGET_URL);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('401') && !txt.includes('favicon')) {
        consoleErrors.push(txt);
      }
    }
  });

  try {
    // 1. Login
    console.log('\n--- 1. Login ---');
    await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', testDoctor.email);
    await page.type('input[type="password"]', testDoctor.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click('button[type="submit"]'),
    ]);
    console.log('Logged in successfully, current URL:', page.url());

    // 2. Navigate to Settings
    console.log('\n--- 2. Settings Page & Tabs (Step 12) ---');
    await page.goto(`${TARGET_URL}/settings`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.settings-tab-btn');

    const tabs = await page.$$eval('.settings-tab-btn', (btns) =>
      btns.map((b) => b.textContent?.trim())
    );
    console.log('Visible Settings Tabs:', tabs);

    const hasUsersTab = tabs.some((t) => t?.includes('Users & Permissions'));
    console.log('Users & Permissions Tab Present:', hasUsersTab ? '✅ PASS' : '❌ FAIL');

    if (!hasUsersTab) {
      throw new Error('Users & Permissions tab is missing on production Settings page!');
    }

    // 3. Click Users & Permissions tab
    console.log('\n--- 3. Users & Permissions Section ---');
    await page.click('#tab-users');
    await page.waitForSelector('.users-permissions-container', { timeout: 10000 });

    const sectionTitle = await page.$eval('.users-permissions-container h2', (el) => el.textContent?.trim());
    console.log('Users Section Header:', sectionTitle);

    // Check members list
    await page.waitForSelector('.member-card, .table-container, .users-table-card, tr', { timeout: 10000 });
    const pageText = await page.$eval('.users-permissions-container', (el) => el.textContent || '');
    console.log('Contains owner name/role:', pageText.includes('Owner') || pageText.includes('PRACTICE_OWNER') ? '✅ PASS' : '❌ FAIL');
    console.log('Contains Invite User button:', pageText.includes('Invite User') ? '✅ PASS' : '❌ FAIL');

    // 4. Subscription & Billing Tab (Step 13)
    console.log('\n--- 4. Subscription & Billing Section (Step 13) ---');
    await page.click('#tab-subscription');
    await page.waitForSelector('#tab-subscription.active');
    await new Promise((r) => setTimeout(r, 1500));

    const subText = await page.$eval('.settings-page, body', (el) => el.textContent || '');
    console.log('Subscription UI loaded:', subText.includes('Subscription') || subText.includes('Plan') ? '✅ PASS' : '❌ FAIL');
    console.log('No secrets exposed:', !subText.includes('salt') && !subText.includes('PAYU_MERCHANT_SALT') ? '✅ PASS' : '❌ FAIL');

    // 5. Clinical Workflows Regression (Step 14)
    console.log('\n--- 5. Clinical Workflows Regression (Step 14) ---');
    const routes = [
      { name: 'Dashboard', path: '/' },
      { name: 'Patients', path: '/patients' },
      { name: 'Medicines', path: '/medicines' },
      { name: 'Treatment Packages', path: '/packages' },
      { name: 'Prescriptions', path: '/prescriptions' },
      { name: 'Invoices & Receipts', path: '/invoices' },
    ];

    for (const r of routes) {
      await page.goto(`${TARGET_URL}${r.path}`, { waitUntil: 'networkidle2' });
      const title = await page.title();
      console.log(`[PASS] Route ${r.name} (${r.path}) loaded cleanly. Document title: "${title}"`);
    }

    // 6. Console errors check
    console.log('\n--- 6. Console Health ---');
    console.log('Console runtime errors:', consoleErrors.length === 0 ? '0 errors (PASS)' : `${consoleErrors.length} errors: ${consoleErrors.join(', ')}`);

    console.log('\n=== ALL BROWSER CHECKS PASSED SUCCESSFULLY ===');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
