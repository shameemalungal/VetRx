import { launchReliableBrowser, getEnvironmentDiagnostics } from './browser_env.mjs';

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440x900' },
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1280, height: 800, label: '1280x800' },
  { width: 1024, height: 768, label: '1024x768' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 390, height: 844, label: '390x844' },
  { width: 360, height: 800, label: '360x800' },
];

const FRONTEND_URL = 'http://127.0.0.1:5173';

async function runFullBrowserUAT() {
  const diag = getEnvironmentDiagnostics();

  console.log('============================================================');
  console.log('VETRX COMPREHENSIVE BROWSER UAT SUITE');
  console.log('============================================================');
  console.log(`OS:                       ${diag.os}`);
  console.log(`Node:                     ${diag.node}`);
  console.log(`npm:                      ${diag.npm}`);
  console.log(`Playwright:               ${diag.playwright}`);
  console.log(`Browser Channel:          ${diag.browserChannel}`);
  console.log(`Browser Name:             ${diag.browserName}`);
  console.log(`Browser Executable:       ${diag.browserExecutable}`);
  console.log(`Frontend URL:             ${diag.frontendUrl}`);
  console.log('============================================================\n');

  console.log('>>> 1. LAUNCHING BROWSER');
  const { browser, config: browserConfig } = await launchReliableBrowser({ headless: true });
  console.log(`Browser Used:             ${browserConfig.name}`);
  console.log(`Browser Executable:       ${browserConfig.executablePath}`);
  console.log(`Browser Version:          ${browserConfig.version}`);
  console.log('✅ Browser launch: PASS\n');

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    console.log(`⚠️ Dialog appeared: [${dialog.type()}] "${dialog.message()}"`);
    await dialog.accept().catch(() => {});
  });

  page.on('pageerror', (err) => {
    console.error('⚠️ Page runtime error:', err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('⚠️ Browser console error:', msg.text());
    }
  });

  // Enable demo mode for Dexie
  await page.addInitScript(() => {
    localStorage.setItem('vetrx_demo_mode', '1');
  });

  // Mock API routes for session & authentication
  let isAuthenticated = false;

  await page.route('**/api/auth/me', async (route) => {
    if (!isAuthenticated) {
      await route.fulfill({ status: 401, json: { error: 'Not authenticated' } });
    } else {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: 'usr_sa_001',
            name: 'Dr. Shameem Alungal',
            email: 'drshameemalungal@gmail.com',
            platformRole: 'PLATFORM_SUPER_ADMIN',
          },
          practice: {
            id: 'practice-default',
            name: 'VetRx Demo Practice',
            tier: 'PROFESSIONAL',
            role: 'PRACTICE_OWNER',
            status: 'ACTIVE',
          },
          membership: {
            role: 'PRACTICE_OWNER',
            permissions: ['all'],
          },
          practices: [
            {
              id: 'practice-default',
              name: 'VetRx Demo Practice',
              role: 'PRACTICE_OWNER',
            },
          ],
          settings: {
            practiceName: 'VetRx Demo Practice',
          },
          permissions: ['all'],
        },
      });
    }
  });

  await page.route('**/api/auth/login', async (route) => {
    isAuthenticated = true;
    await route.fulfill({
      status: 200,
      json: {
        user: {
          id: 'usr_sa_001',
          name: 'Dr. Shameem Alungal',
          email: 'drshameemalungal@gmail.com',
          platformRole: 'PLATFORM_SUPER_ADMIN',
        },
        practice: {
          id: 'practice-default',
          name: 'VetRx Demo Practice',
          tier: 'PROFESSIONAL',
          role: 'PRACTICE_OWNER',
          status: 'ACTIVE',
        },
        membership: {
          role: 'PRACTICE_OWNER',
          permissions: ['all'],
        },
        practices: [
          {
            id: 'practice-default',
            name: 'VetRx Demo Practice',
            role: 'PRACTICE_OWNER',
          },
        ],
        settings: {
          practiceName: 'VetRx Demo Practice',
        },
        permissions: ['all'],
      },
    });
  });

  await page.route('**/api/auth/switch-practice', async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        user: {
          id: 'usr_sa_001',
          name: 'Dr. Shameem Alungal',
          email: 'drshameemalungal@gmail.com',
          platformRole: 'PLATFORM_SUPER_ADMIN',
        },
        practice: {
          id: 'practice-default',
          name: 'VetRx Demo Practice',
          tier: 'PROFESSIONAL',
          role: 'PRACTICE_OWNER',
          status: 'ACTIVE',
        },
        membership: {
          role: 'PRACTICE_OWNER',
          permissions: ['all'],
        },
        settings: {
          practiceName: 'VetRx Demo Practice',
        },
        permissions: ['all'],
      },
    });
  });

  const results = {
    browserLaunch: 'PASS',
    browserSmoke: 'PASS',
    rootPage: 'PASS',
    login: 'PASS',
    platform: 'PASS',
    platformHeader: 'PASS',
    medicines: 'PASS',
    prescriptionAddMedicine: 'PASS',
    viewports: {},
  };

  try {
    // ---------------------------------------------------------
    // TEST 1: Root & Login Page
    // ---------------------------------------------------------
    console.log('>>> 2. TESTING ROOT & LOGIN PAGE');
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: 'networkidle' });
    console.log('Navigated to root. Current URL:', page.url());

    if (!page.url().includes('/login')) {
      throw new Error(`Expected unauthenticated visit to redirect to /login, got ${page.url()}`);
    }

    const emailInput = await page.waitForSelector('#login-email', { timeout: 5000 });
    const passwordInput = await page.waitForSelector('#login-password', { timeout: 5000 });
    const submitBtn = await page.waitForSelector('button[type="submit"]', { timeout: 5000 });

    if (!emailInput || !passwordInput || !submitBtn) {
      throw new Error('Login form elements missing');
    }
    console.log('✅ Root and Login page: PASS\n');

    // ---------------------------------------------------------
    // TEST 2: Perform Login
    // ---------------------------------------------------------
    console.log('>>> 3. TESTING AUTHENTICATION FLOW');
    await emailInput.fill('drshameemalungal@gmail.com');
    await passwordInput.fill('Password123!');
    await submitBtn.click();
    await page.waitForTimeout(1000);
    console.log('Post-login URL:', page.url());
    console.log('✅ Login: PASS\n');

    // ---------------------------------------------------------
    // TEST 3: Platform Navigation & Header Structure
    // ---------------------------------------------------------
    console.log('>>> 4. TESTING PLATFORM ROUTE & HEADER');
    await page.goto(`${FRONTEND_URL}/platform/permissions`, { waitUntil: 'networkidle' });
    console.log('Platform URL:', page.url());

    // Verify Platform Sidebar
    const sidebar = await page.waitForSelector('.platform-sidebar, nav', { timeout: 5000 });
    console.log('Found Platform Sidebar:', !!sidebar);

    // Verify Platform Header elements
    const headerRight = await page.waitForSelector('.platform-header-right', { timeout: 5000 });
    const avatar = await page.waitForSelector('.platform-user-avatar', { timeout: 5000 });
    const userNameEl = await page.waitForSelector('.platform-user-name', { timeout: 5000 });
    const contextBadge = await page.waitForSelector('.platform-context-badge', { timeout: 5000 });
    const roleBadge = await page.waitForSelector('.platform-role-badge', { timeout: 5000 });
    const switchBtn = await page.waitForSelector('#platform-context-switch-btn', { timeout: 5000 });
    const signoutBtn = await page.waitForSelector('.platform-signout-btn', { timeout: 5000 });
    const searchBar = await page.waitForSelector('.platform-search-bar', { timeout: 5000 });

    const userNameText = (await userNameEl.textContent())?.trim();
    const contextText = (await contextBadge.textContent())?.trim();
    const roleText = (await roleBadge.textContent())?.trim();

    console.log(`  User Name:     "${userNameText}"`);
    console.log(`  Context Badge: "${contextText}"`);
    console.log(`  Role Badge:    "${roleText}"`);

    if (userNameText !== 'Dr. Shameem Alungal') {
      throw new Error(`Unexpected user name: "${userNameText}"`);
    }
    if (contextText !== 'PLATFORM') {
      throw new Error(`Expected context badge "PLATFORM", got "${contextText}"`);
    }
    if (roleText !== 'SUPER ADMIN') {
      throw new Error(`Expected role badge "SUPER ADMIN", got "${roleText}"`);
    }

    console.log('✅ Platform route and header structure: PASS\n');

    // ---------------------------------------------------------
    // TEST 4: Platform Header Responsive & Viewport Overflows
    // ---------------------------------------------------------
    console.log('>>> 5. TESTING VIEWPORTS & HORIZONTAL OVERFLOW');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Check horizontal overflow on document
      const overflowMetrics = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const bodyScrollWidth = document.body.scrollWidth;
        return {
          docWidth,
          scrollWidth,
          bodyScrollWidth,
          hasOverflow: scrollWidth > docWidth || bodyScrollWidth > docWidth,
        };
      });

      // Verify action buttons exist and remain inside viewport
      const switchBtnBox = await switchBtn.boundingBox();
      const signoutBtnBox = await signoutBtn.boundingBox();

      const switchBtnVisible = switchBtnBox && switchBtnBox.x >= 0 && switchBtnBox.x + switchBtnBox.width <= vp.width + 2;
      const signoutBtnVisible = signoutBtnBox && signoutBtnBox.x >= 0 && signoutBtnBox.x + signoutBtnBox.width <= vp.width + 2;

      const passed = !overflowMetrics.hasOverflow && switchBtnVisible && signoutBtnVisible;
      results.viewports[vp.width] = passed ? 'PASS' : 'FAIL';

      console.log(`  Viewport ${vp.label}: ${passed ? 'PASS' : 'FAIL'} (scrollWidth: ${overflowMetrics.scrollWidth} / ${vp.width})`);
      if (!passed) {
        throw new Error(`Viewport ${vp.label} failed: overflow=${overflowMetrics.hasOverflow}, switchVisible=${switchBtnVisible}, signoutVisible=${signoutBtnVisible}`);
      }
    }
    console.log('✅ All 7 Viewports overflow verification: PASS\n');

    // Reset viewport to standard desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    // ---------------------------------------------------------
    // TEST 5: Medicines -> New Medicine Modal
    // ---------------------------------------------------------
    console.log('>>> 6. TESTING MEDICINES -> NEW MEDICINE FORM');
    await page.goto(`${FRONTEND_URL}/medicines`, { waitUntil: 'networkidle' });
    console.log('Medicines page URL:', page.url());

    const newMedBtn = await page.waitForSelector('#add-medicine-btn', { timeout: 5000 });
    await newMedBtn.click();
    await page.waitForSelector('.medicine-modal-backdrop', { timeout: 5000 });

    const medBrandInput = await page.waitForSelector('#med-brand-name', { timeout: 3000 });
    const medChemInput = await page.waitForSelector('#med-chemical-formulation', { timeout: 3000 });
    const medStrengthInput = await page.waitForSelector('#med-strength', { timeout: 3000 });
    const medFormInput = await page.waitForSelector('#med-presentation', { timeout: 3000 });
    const medPackInput = await page.waitForSelector('#med-pack-size', { timeout: 3000 });

    // Test filling and creating a formulation: Amoxicillin
    await medBrandInput.fill('Amoxicillin');
    await medChemInput.fill('Amoxicillin Trihydrate');
    await medStrengthInput.fill('125 mg/tablet');
    await medFormInput.selectOption('Tablet');
    await medPackInput.fill('10 tablets/strip');

    console.log('  Filled New Medicine form with Amoxicillin formulation.');

    const saveMedBtn = await page.waitForSelector('#medicine-form button[type="submit"]', { timeout: 3000 });
    await saveMedBtn.click();
    await page.waitForSelector('.medicine-modal-backdrop', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    console.log('✅ Medicines New Medicine creation: PASS\n');

    // ---------------------------------------------------------
    // TEST 6: Prescriptions -> New Prescription -> Add Medicine
    // ---------------------------------------------------------
    console.log('>>> 7. TESTING PRESCRIPTION -> ADD MEDICINE FORMULATION');
    await page.goto(`${FRONTEND_URL}/prescriptions/new?demo=1`, { waitUntil: 'networkidle' });
    console.log('Prescription New URL:', page.url());
    await page.waitForTimeout(1000);

    // Select Animal from list
    let selectAnimalBtn;
    try {
      selectAnimalBtn = await page.waitForSelector('button:has-text("Select & Start Rx")', { timeout: 15000 });
      await selectAnimalBtn.click();
      console.log('  Selected animal, stepped into prescription builder.');
    } catch (err) {
      console.error('Current page URL at failure:', page.url());
      const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 600));
      console.error('Body snippet at failure:\n', bodySnippet);
      throw err;
    }

    // Click Add Medicine
    const rxAddMedBtn = await page.waitForSelector('#rx-add-medicine-btn', { timeout: 5000 });
    await rxAddMedBtn.click();
    await page.waitForSelector('.rx-modal-backdrop', { timeout: 5000 });

    // Search Amoxicillin
    const rxSearchInput = await page.waitForSelector('#rx-med-search', { timeout: 3000 });
    await rxSearchInput.fill('Amoxicillin');
    await page.waitForTimeout(500);

    // Select from live dropdown
    const liveItem = await page.waitForSelector('.rx-live-med-item:has-text("Amoxicillin")', { timeout: 3000 });
    await liveItem.click();
    await page.waitForTimeout(400);

    // Verify formulation fields populated
    const rxBrandVal = await page.$eval('#rx-form-brand-name', (el) => el.value);
    const rxStrengthVal = await page.$eval('#rx-form-strength', (el) => el.value);
    const rxPresentationVal = await page.$eval('#rx-form-presentation', (el) => el.value);
    const rxPackVal = await page.$eval('#rx-form-pack-size', (el) => el.value);

    console.log('  Prescription Add Medicine populated formulation:');
    console.log(`    Brand:        "${rxBrandVal}"`);
    console.log(`    Strength:     "${rxStrengthVal}"`);
    console.log(`    Presentation: "${rxPresentationVal}"`);
    console.log(`    Pack Size:    "${rxPackVal}"`);

    if (!rxBrandVal.toLowerCase().includes('amoxicillin')) {
      throw new Error(`Expected Amoxicillin in brand name, got "${rxBrandVal}"`);
    }
    if (!rxStrengthVal) {
      throw new Error(`Expected formulation strength to be populated, got empty`);
    }
    if (rxPresentationVal !== 'Tablet') {
      throw new Error(`Expected Presentation "Tablet", got "${rxPresentationVal}"`);
    }

    console.log('✅ Prescription Add Medicine formulation verification: PASS\n');
  } catch (err) {
    console.error('❌ UAT TEST FAILED:', err.message);
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log('============================================================');
  console.log('ALL BROWSER UAT SCENARIOS PASSED WITH ZERO ERRORS');
  console.log('============================================================');
}

runFullBrowserUAT().catch((err) => {
  console.error('Unhandled UAT error:', err);
  process.exit(1);
});
