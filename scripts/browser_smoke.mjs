import { launchReliableBrowser, getEnvironmentDiagnostics } from './browser_env.mjs';

async function runBrowserSmoke() {
  const diag = getEnvironmentDiagnostics();

  console.log('============================================================');
  console.log('BROWSER UAT ENVIRONMENT DIAGNOSTICS');
  console.log('============================================================');
  console.log(`OS:                       ${diag.os}`);
  console.log(`Node:                     ${diag.node}`);
  console.log(`npm:                      ${diag.npm}`);
  console.log(`Playwright:               ${diag.playwright}`);
  console.log(`Browser Channel:          ${diag.browserChannel}`);
  console.log(`Browser Name:             ${diag.browserName}`);
  console.log(`Browser Executable:       ${diag.browserExecutable}`);
  console.log(`PLAYWRIGHT_BROWSERS_PATH: ${diag.playwrightBrowsersPath}`);
  console.log(`Frontend URL:             ${diag.frontendUrl}`);
  console.log('============================================================\n');

  console.log('--- STEP 1: Launching Browser ---');
  let browserInstance;
  let browserConfig;

  try {
    const res = await launchReliableBrowser({ headless: true });
    browserInstance = res.browser;
    browserConfig = res.config;
    console.log(`Browser:                  ${browserConfig.name}`);
    console.log(`Browser executable:       ${browserConfig.executablePath}`);
    console.log(`Browser version:          ${browserConfig.version}`);
    console.log(`Playwright version:       ${diag.playwright}`);
    console.log(`Application URL:          ${diag.frontendUrl}`);
    console.log(`Launch Strategy Used:     ${browserConfig.usedAttempt}`);
    console.log('✅ Browser launch: PASS\n');
  } catch (err) {
    console.error('❌ Browser launch: FAIL');
    console.error('Exact error details:');
    console.error(err);
    process.exit(1);
  }

  console.log('--- STEP 2: Creating Browser Page Context ---');
  let page;
  try {
    const context = await browserInstance.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
    page = await context.newPage();
    console.log('✅ Browser context and page created successfully.\n');
  } catch (err) {
    console.error('❌ Failed to create browser context/page:', err.message);
    await browserInstance.close();
    process.exit(1);
  }

  console.log('--- STEP 3: Navigating to Local VetRx Application ---');
  try {
    const response = await page.goto(diag.frontendUrl, { waitUntil: 'networkidle', timeout: 15000 });
    console.log(`Navigation status: ${response?.status() || 'loaded'}`);
    console.log(`Current URL:       ${page.url()}`);
    console.log(`Document title:    ${await page.title()}`);

    const hasBody = await page.$('body');
    if (!hasBody) {
      throw new Error('document.body is missing from rendered page.');
    }

    // Verify known VetRx element on landing/login page
    const loginEmailInput = await page.$('#login-email');
    const authCard = await page.$('.auth-card, .login-container, .auth-page, form');
    const logoOrBrand = await page.$('text=VetRx');

    console.log(`Found #login-email input:   ${!!loginEmailInput}`);
    console.log(`Found auth container:       ${!!authCard}`);
    console.log(`Found VetRx branding text:  ${!!logoOrBrand}`);

    if (!loginEmailInput && !logoOrBrand) {
      throw new Error('Neither #login-email nor VetRx branding found on page.');
    }

    console.log('✅ VetRx element verification: PASS\n');
  } catch (err) {
    console.error('❌ VetRx application navigation/verification failed:', err.message);
    await browserInstance.close();
    process.exit(1);
  }

  console.log('--- STEP 4: Closing Browser ---');
  await browserInstance.close();
  console.log('✅ Browser closed gracefully.');
  console.log('\n============================================================');
  console.log('BROWSER SMOKE TEST RESULT: PASS');
  console.log('============================================================');
}

runBrowserSmoke().catch((err) => {
  console.error('Unhandled smoke test error:', err);
  process.exit(1);
});
