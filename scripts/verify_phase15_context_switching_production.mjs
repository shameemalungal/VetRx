import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getProductionSessionToken } from './get_session.mjs';

const IP = '109.122.56.148';
const PROD_BASE_URL = 'https://app.vetrx.brightbase.in';
const SCREENSHOT_DIR = path.resolve('artifacts/phase15_production_uat');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const testResults = [];
function record(test, status, details = '') {
  testResults.push({ test, status, details });
  console.log(`[${status}] ${test}${details ? ' - ' + details : ''}`);
}

async function runProductionContextSwitchingUAT() {
  console.log('===============================================================');
  console.log('VETRX PHASE 15 — PRODUCTION BROWSER UAT: CONTEXT SWITCHING & SECURITY');
  console.log('Target: ' + PROD_BASE_URL);
  console.log('===============================================================\n');

  console.log('--- Step 0: Generate Live Production Session Tokens ---');
  const superAdminEmail = 'drshameemalungal@gmail.com';
  const superAdminToken = getProductionSessionToken(superAdminEmail);
  console.log('Super Admin Session Token created for:', superAdminEmail);

  const normalVetEmail = 'uat.vet@vetrx.test';
  const normalVetToken = getProductionSessionToken(normalVetEmail);
  console.log('Normal Vet Session Token created for:', normalVetEmail);

  const browser = await chromium.launch({
    headless: true,
    args: [
      `--host-resolver-rules=MAP app.vetrx.brightbase.in ${IP}, MAP vetrx.brightbase.in ${IP}`,
      '--ignore-certificate-errors',
    ],
  });

  try {
    // -------------------------------------------------------------
    // Test A: Direct unauthenticated /platform entry
    // -------------------------------------------------------------
    console.log('\n--- Test A: Direct unauthenticated /platform navigation ---');
    const unauthContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const unauthPage = await unauthContext.newPage();

    await unauthPage.goto(`${PROD_BASE_URL}/platform`, { waitUntil: 'domcontentloaded' });
    await unauthPage.waitForTimeout(2000);

    const unauthUrl = unauthPage.url();
    console.log('URL after unauthenticated /platform:', unauthUrl);
    const hasLogin = unauthUrl.includes('/login');
    const preservesRedirect = unauthUrl.includes('redirect') && unauthUrl.includes('platform');

    await unauthPage.screenshot({ path: path.join(SCREENSHOT_DIR, '01_unauthenticated_platform_prod.png') });
    record('Test A: Unauthenticated /platform', hasLogin ? 'PASS' : 'FAIL', `Redirected to: ${unauthUrl}`);
    await unauthContext.close();

    // -------------------------------------------------------------
    // Setup Super Admin Context
    // -------------------------------------------------------------
    const saContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });

    // Set production session cookie
    await saContext.addCookies([
      {
        name: 'vetrx_session',
        value: superAdminToken,
        domain: 'app.vetrx.brightbase.in',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    const saPage = await saContext.newPage();

    // -------------------------------------------------------------
    // Test B: Authenticated Super Admin login -> Platform Dashboard
    // -------------------------------------------------------------
    console.log('\n--- Test B: Authenticated Super Admin at /platform/dashboard ---');
    await saPage.goto(`${PROD_BASE_URL}/platform/dashboard`, { waitUntil: 'domcontentloaded' });
    await saPage.waitForSelector('#platform-shell-root', { timeout: 15000 });
    await saPage.waitForTimeout(2000);

    const userName = await saPage.$eval('#platform-user-name', (el) => el.textContent?.trim()).catch(() => null);
    const userRole = await saPage.$eval('#platform-user-role', (el) => el.textContent?.trim()).catch(() => null);
    console.log('Platform User Name:', userName);
    console.log('Platform User Role:', userRole);

    await saPage.screenshot({ path: path.join(SCREENSHOT_DIR, '02_superadmin_platform_dashboard_prod.png') });
    const isSaDashboardValid = userName?.includes('Shameem Alungal') && userRole?.includes('SUPER ADMIN');
    record('Test B: Super Admin Platform Dashboard', isSaDashboardValid ? 'PASS' : 'FAIL', `User: ${userName}, Role: ${userRole}`);

    // -------------------------------------------------------------
    // Test C: Platform Matrix Navigation & Browser Back
    // -------------------------------------------------------------
    console.log('\n--- Test C: Platform Matrix navigation & browser Back ---');
    const matrixNav = await saPage.waitForSelector('#platform-nav-permissions', { timeout: 8000 });
    await matrixNav.click();
    await saPage.waitForURL('**/platform/permissions', { timeout: 10000 });
    await saPage.waitForTimeout(2000);

    const matrixUrl = saPage.url();
    const matrixContent = await saPage.content();
    const hasMatrixRendered =
      matrixContent.includes('Platform Matrix') ||
      matrixContent.includes('Permission') ||
      matrixContent.includes('Role & Action Matrix');

    await saPage.screenshot({ path: path.join(SCREENSHOT_DIR, '03_platform_matrix_prod.png') });

    // Browser Back
    await saPage.goBack();
    await saPage.waitForURL('**/platform/dashboard', { timeout: 10000 });
    await saPage.waitForTimeout(1000);
    const backUrl = saPage.url();

    const isMatrixPass = matrixUrl.includes('/platform/permissions') && hasMatrixRendered && backUrl.includes('/platform/dashboard');
    record('Test C: Platform Matrix Navigation & Back', isMatrixPass ? 'PASS' : 'FAIL', `Matrix URL: ${matrixUrl}, Back URL: ${backUrl}`);

    // -------------------------------------------------------------
    // Test D: Context Switch Modal UX & Buttons
    // -------------------------------------------------------------
    console.log('\n--- Test D: Context Switch Modal UX (Verify Enter Practice & Cancel buttons) ---');
    const switchBtn = await saPage.waitForSelector('#platform-switch-practice-btn', { timeout: 8000 });
    await switchBtn.click();
    await saPage.waitForSelector('#platform-context-switch-modal', { timeout: 8000 });
    await saPage.waitForTimeout(1000);

    const modalTitle = await saPage.$eval('#platform-context-switch-title', (el) => el.textContent?.trim()).catch(() => null);
    const cancelBtn = await saPage.$('#platform-context-cancel-btn');
    const enterPracticeBtn = await saPage.$('#platform-enter-practice-btn');
    const enterBtnText = await saPage.$eval('#platform-enter-practice-btn', (el) => el.textContent?.trim());

    // Check practice card
    const practiceCards = await saPage.$$('.platform-practice-card');
    console.log('Modal Title:', modalTitle);
    console.log('Practice Cards count:', practiceCards.length);
    console.log('Cancel Button found:', !!cancelBtn);
    console.log('Enter Practice Button found:', !!enterPracticeBtn);
    console.log('Enter Practice Button text:', enterBtnText);

    // Verify first card selected state
    const firstCardChecked = await practiceCards[0]?.getAttribute('aria-checked');
    console.log('First Practice Card aria-checked:', firstCardChecked);

    await saPage.screenshot({ path: path.join(SCREENSHOT_DIR, '04_context_switch_modal_prod.png') });

    const isModalPass =
      modalTitle?.includes('MY PRACTICES') &&
      cancelBtn !== null &&
      enterPracticeBtn !== null &&
      enterBtnText?.includes('Enter Practice') &&
      firstCardChecked === 'true';
    record('Test D: Context Switch Modal UX', isModalPass ? 'PASS' : 'FAIL', `Title: ${modalTitle}, Buttons: Cancel + Enter Practice`);

    // -------------------------------------------------------------
    // Test E: Enter Practice Action -> Normal Practice Interface
    // -------------------------------------------------------------
    console.log('\n--- Test E: Click Enter Practice & verify Practice Context and clinical authority ---');
    await enterPracticeBtn.click();
    await saPage.waitForURL('**/dashboard', { timeout: 15000 });
    await saPage.waitForTimeout(2000);

    const practiceUrl = saPage.url();
    const practiceContent = await saPage.content();
    console.log('URL after Enter Practice:', practiceUrl);

    await saPage.screenshot({ path: path.join(SCREENSHOT_DIR, '05_entered_practice_dashboard_prod.png') });

    const isPracticeEntered =
      practiceUrl.includes('/dashboard') &&
      (practiceContent.includes("Shameem Alungal's Practice") || practiceContent.includes('Prescriptions') || practiceContent.includes('Patients'));
    record('Test E: Enter Practice Context Execution', isPracticeEntered ? 'PASS' : 'FAIL', `Landed at: ${practiceUrl}`);

    // -------------------------------------------------------------
    // Test F: Reverse Switch (Practice -> Platform)
    // -------------------------------------------------------------
    console.log('\n--- Test F: Practice -> Platform reverse switch ---');
    const sidebarSwitchToPlatform = await saPage.waitForSelector('#sidebar-switch-to-platform-btn', { timeout: 10000 });
    await sidebarSwitchToPlatform.click();
    await saPage.waitForSelector('#platform-shell-root', { timeout: 10000 });
    await saPage.waitForTimeout(1000);

    const backToPlatformUrl = saPage.url();
    console.log('URL after reverse switch to Platform:', backToPlatformUrl);

    await saPage.screenshot({ path: path.join(SCREENSHOT_DIR, '06_reverse_switch_to_platform_prod.png') });

    const isReversePass = backToPlatformUrl.includes('/platform');
    record('Test F: Reverse Switch (Practice -> Platform)', isReversePass ? 'PASS' : 'FAIL', `Back at: ${backToPlatformUrl}`);
    await saContext.close();

    // -------------------------------------------------------------
    // Test G: Unauthorized User (platformRole = null) -> 403 Access Denied
    // -------------------------------------------------------------
    console.log('\n--- Test G: Unauthorized normal practice user attempting /platform ---');
    const normalContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });

    await normalContext.addCookies([
      {
        name: 'vetrx_session',
        value: normalVetToken,
        domain: 'app.vetrx.brightbase.in',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    const normalPage = await normalContext.newPage();
    await normalPage.goto(`${PROD_BASE_URL}/platform`, { waitUntil: 'domcontentloaded' });
    await normalPage.waitForTimeout(2000);

    const normalContent = await normalPage.content();
    const hasPlatformAccessRequired = normalContent.includes('Platform Access Required');
    const hasRestrictedMsg = normalContent.includes('strictly restricted to Platform Super Administrators');

    await normalPage.screenshot({ path: path.join(SCREENSHOT_DIR, '07_unauthorized_platform_403_prod.png') });

    const isBlockPass = hasPlatformAccessRequired && hasRestrictedMsg;
    record('Test G: Unauthorized User Blocked from /platform', isBlockPass ? 'PASS' : 'FAIL', 'Blocked with 403 Platform Access Required');
    await normalContext.close();

    // -------------------------------------------------------------
    // Test H: Direct Route Refresh with Super Admin
    // -------------------------------------------------------------
    console.log('\n--- Test H: Direct route refresh on /platform/permissions ---');
    const refreshContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ignoreHTTPSErrors: true,
    });

    await refreshContext.addCookies([
      {
        name: 'vetrx_session',
        value: superAdminToken,
        domain: 'app.vetrx.brightbase.in',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    const refreshPage = await refreshContext.newPage();
    await refreshPage.goto(`${PROD_BASE_URL}/platform/permissions`, { waitUntil: 'domcontentloaded' });
    await refreshPage.waitForSelector('#platform-shell-root', { timeout: 15000 });
    await refreshPage.waitForTimeout(1000);

    // Refresh
    await refreshPage.reload({ waitUntil: 'domcontentloaded' });
    await refreshPage.waitForSelector('#platform-shell-root', { timeout: 15000 });
    await refreshPage.waitForTimeout(1500);

    const refreshedUrl = refreshPage.url();
    const refreshedContent = await refreshPage.content();
    const hasReloadedMatrix =
      refreshedUrl.includes('/platform/permissions') &&
      (refreshedContent.includes('Platform Matrix') || refreshedContent.includes('Permission'));

    await refreshPage.screenshot({ path: path.join(SCREENSHOT_DIR, '08_direct_refresh_permissions_prod.png') });

    record('Test H: Direct Route Refresh Integrity', hasReloadedMatrix ? 'PASS' : 'FAIL', `Refreshed URL: ${refreshedUrl}`);
    await refreshContext.close();

  } catch (error) {
    console.error('Production UAT Error:', error);
    record('Production UAT Execution', 'ERROR', error.message);
  } finally {
    await browser.close();
  }

  console.log('\n===============================================================');
  console.log('PRODUCTION CONTEXT SWITCHING UAT SUMMARY');
  console.log('===============================================================');
  console.table(testResults);
  const allPassed = testResults.every((t) => t.status === 'PASS');
  console.log('\nFINAL PRODUCTION RESULT:', allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌');
  console.log('===============================================================\n');
  process.exit(allPassed ? 0 : 1);
}

runProductionContextSwitchingUAT();
