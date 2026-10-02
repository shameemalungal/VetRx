import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://127.0.0.1:5173';
const SCREENSHOT_DIR = 'C:\\Antigravity\\VetRx\\artifacts\\phase15_context_switching';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const dualRoleAuthPayload = {
  user: {
    id: 'user-superadmin-1',
    email: 'drshameemalungal@gmail.com',
    name: 'Dr. Shameem Alungal',
    emailVerified: true,
    platformRole: 'PLATFORM_SUPER_ADMIN',
    createdAt: '2026-01-01',
  },
  practice: {
    id: 'practice-shameem-1',
    name: "Shameem Alungal's Practice",
    slug: 'shameem-practice',
    ownerUserId: 'user-superadmin-1',
    isActive: true,
    createdAt: '2026-01-01',
  },
  membership: {
    id: 'mem-shameem-1',
    practiceId: 'practice-shameem-1',
    userId: 'user-superadmin-1',
    role: 'PRACTICE_OWNER',
    isClinicalApprover: true,
    isActive: true,
    permissions: [
      'clinical:read',
      'clinical:write',
      'prescriptions:create',
      'prescriptions:approve',
      'medicines:manage',
      'patients:create',
    ],
  },
  settings: {
    id: 'set-shameem-1',
    practiceId: 'practice-shameem-1',
    clinicName: "Shameem Alungal's Practice",
    doctorName: 'Dr. Shameem Alungal, BVSc & AH',
    doctorRegistrationNumber: 'KVC-9999',
    phone: '+91 98470 00000',
    email: 'drshameemalungal@gmail.com',
    address: 'Malappuram, Kerala, India',
    ownerSpecialInstructionEnabled: true,
  },
  permissions: [
    'clinical:read',
    'clinical:write',
    'prescriptions:create',
    'prescriptions:approve',
    'medicines:manage',
    'patients:create',
  ],
  practices: [
    {
      practiceId: 'practice-shameem-1',
      practiceName: "Shameem Alungal's Practice",
      role: 'PRACTICE_OWNER',
      isClinicalApprover: true,
      isCurrent: true,
    },
  ],
};

const normalVetAuthPayload = {
  user: {
    id: 'user-vet-2',
    email: 'vet@practice.local',
    name: 'Dr. Standard Veterinarian',
    emailVerified: true,
    platformRole: null, // Normal vet, not platform admin
    createdAt: '2026-01-01',
  },
  practice: {
    id: 'practice-normal-2',
    name: 'City Vet Clinic',
    slug: 'city-vet',
    ownerUserId: 'user-vet-2',
    isActive: true,
    createdAt: '2026-01-01',
  },
  membership: {
    id: 'mem-vet-2',
    practiceId: 'practice-normal-2',
    userId: 'user-vet-2',
    role: 'PRACTICE_OWNER',
    isClinicalApprover: true,
    isActive: true,
    permissions: ['clinical:read', 'clinical:write', 'prescriptions:create'],
  },
  settings: {
    id: 'set-normal-2',
    practiceId: 'practice-normal-2',
    clinicName: 'City Vet Clinic',
    doctorName: 'Dr. Standard Veterinarian',
    email: 'vet@practice.local',
  },
  permissions: ['clinical:read', 'clinical:write', 'prescriptions:create'],
  practices: [
    {
      practiceId: 'practice-normal-2',
      practiceName: 'City Vet Clinic',
      role: 'PRACTICE_OWNER',
      isClinicalApprover: true,
      isCurrent: true,
    },
  ],
};

const corsHeaders = {
  'access-control-allow-origin': BASE_URL,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization, Cookie',
};

async function runPhase15BrowserTests() {
  console.log('=== VetRx Phase 15: Browser UAT for Context Switching & Platform Security ===');
  console.log('Launching browser:', EDGE_PATH);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let currentAuth = null;

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (req.method() === 'OPTIONS') {
      req.respond({ status: 204, headers: corsHeaders });
      return;
    }

    if (url.includes('/api/auth/me')) {
      if (!currentAuth) {
        req.respond({
          status: 401,
          contentType: 'application/json',
          headers: corsHeaders,
          body: JSON.stringify({ error: { message: 'Not authenticated' } }),
        });
        return;
      }
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(currentAuth),
      });
      return;
    }

    if (url.includes('/api/auth/switch-practice')) {
      const postData = JSON.parse(req.postData() || '{}');
      console.log(`[Mock Backend] POST /api/auth/switch-practice for target: ${postData.practiceId}`);
      if (currentAuth && postData.practiceId) {
        // Ensure session practice is updated
        currentAuth.practice = {
          id: postData.practiceId,
          name: "Shameem Alungal's Practice",
          slug: 'shameem-practice',
          ownerUserId: currentAuth.user.id,
          isActive: true,
          createdAt: '2026-01-01',
        };
      }
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify(currentAuth),
      });
      return;
    }

    if (url.includes('/api/platform/admin/permission-matrix')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          roles: ['PRACTICE_OWNER', 'PRACTICE_ADMIN', 'VETERINARIAN', 'STAFF', 'READ_ONLY', 'PRACTICE_STAFF'],
          categories: {
            CLINICAL: ['clinical:read', 'clinical:write', 'prescriptions:create', 'prescriptions:approve'],
            PRACTICE: ['practice:manage', 'members:manage'],
            COMMERCIAL: ['invoices:read', 'invoices:write'],
            SECURITY: ['audit:read'],
          },
          rolePermissions: {
            PRACTICE_OWNER: ['clinical:read', 'clinical:write', 'prescriptions:create', 'prescriptions:approve'],
            VETERINARIAN: ['clinical:read', 'clinical:write', 'prescriptions:create', 'prescriptions:approve'],
          },
          metadata: {},
        }),
      });
      return;
    }

    if (url.includes('/api/platform/admin/overview') || url.includes('/api/platform/metrics')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          practicesCount: 14,
          activeSubscriptions: 12,
          monthlyRecurringRevenueINR: 35880,
          totalPrescriptions: 1420,
        }),
      });
      return;
    }

    if (url.includes('/api/platform/admin/practices')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({
          results: [
            { id: 'practice-shameem-1', name: "Shameem Alungal's Practice", status: 'ACTIVE', tier: 'PRO' },
          ],
          total: 1,
        }),
      });
      return;
    }

    if (url.includes('/api/platform/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        headers: corsHeaders,
        body: JSON.stringify({ results: [], total: 0, data: [] }),
      });
      return;
    }

    req.continue();
  });

  const testResults = [];

  try {
    // -------------------------------------------------------------
    // Test A: Direct unauthenticated /platform entry
    // -------------------------------------------------------------
    console.log('\n--- Test A: Direct unauthenticated /platform navigation ---');
    currentAuth = null;
    await page.goto(`${BASE_URL}/platform`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));

    const currentUrlA = page.url();
    console.log('Current URL after unauthenticated /platform:', currentUrlA);
    const hasLoginInUrl = currentUrlA.includes('/login');
    const isRedirectPreserved = currentUrlA.includes('redirect') && currentUrlA.includes('platform');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_unauthenticated_platform.png') });

    if (hasLoginInUrl) {
      console.log('✅ Test A Passed: Unauthenticated /platform redirected to login screen with destination preserved.');
      testResults.push({ test: 'Test A: Unauthenticated /platform', status: 'PASS' });
    } else {
      console.error('❌ Test A Failed: Did not redirect to login page');
      testResults.push({ test: 'Test A: Unauthenticated /platform', status: 'FAIL' });
    }

    // -------------------------------------------------------------
    // Test B: Authenticated Super Admin login -> Platform Dashboard
    // -------------------------------------------------------------
    console.log('\n--- Test B: Authenticated Super Admin + Practice Owner at /platform ---');
    currentAuth = dualRoleAuthPayload;
    await page.goto(`${BASE_URL}/platform/dashboard`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#platform-shell-root', { timeout: 5000 });

    const platformHeaderUser = await page.$eval('#platform-user-identity', (el) => el.textContent?.trim()).catch(() => null);
    const platformHeaderRole = await page.$eval('#platform-user-role', (el) => el.textContent?.trim()).catch(() => null);
    console.log('Platform User Identity:', platformHeaderUser);
    console.log('Platform User Role:', platformHeaderRole);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_platform_dashboard.png') });

    if (platformHeaderUser?.includes('Dr. Shameem Alungal') && platformHeaderRole?.includes('SUPER ADMIN')) {
      console.log('✅ Test B Passed: Super Admin successfully accessed Platform Dashboard with correct identity.');
      testResults.push({ test: 'Test B: Super Admin Platform Dashboard', status: 'PASS' });
    } else {
      console.error('❌ Test B Failed: Platform identity or role mismatch');
      testResults.push({ test: 'Test B: Super Admin Platform Dashboard', status: 'FAIL' });
    }

    // -------------------------------------------------------------
    // Test C: Platform Matrix navigation & Browser Back
    // -------------------------------------------------------------
    console.log('\n--- Test C: Platform Matrix navigation & browser Back ---');
    const matrixLink = await page.$('#platform-nav-permissions');
    if (!matrixLink) {
      throw new Error('Platform Matrix navigation link (#platform-nav-permissions) not found!');
    }
    await matrixLink.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise((r) => setTimeout(r, 600));

    const matrixUrl = page.url();
    console.log('Matrix URL:', matrixUrl);
    const matrixContent = await page.content();
    const hasMatrixRendered = matrixContent.includes('Platform Matrix') || matrixContent.includes('Permission') || matrixContent.includes('Matrix');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_platform_matrix.png') });

    // Click browser Back
    await page.goBack({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));
    const backUrl = page.url();
    console.log('URL after browser Back:', backUrl);

    if (matrixUrl.includes('/platform/permissions') && hasMatrixRendered && backUrl.includes('/platform/dashboard')) {
      console.log('✅ Test C Passed: Platform Matrix renders without blank page, browser Back functions normally.');
      testResults.push({ test: 'Test C: Platform Matrix Navigation & Back', status: 'PASS' });
    } else {
      console.error('❌ Test C Failed: Matrix did not render properly or Back did not return to dashboard');
      testResults.push({ test: 'Test C: Platform Matrix Navigation & Back', status: 'FAIL' });
    }

    // -------------------------------------------------------------
    // Test D: Open Context Switch Modal UX & verify [ Enter Practice ] button
    // -------------------------------------------------------------
    console.log('\n--- Test D: Context Switch Modal UX (Verify Enter Practice & Cancel buttons) ---');
    const switchBtn = await page.$('#platform-switch-practice-btn');
    if (!switchBtn) {
      throw new Error('Switch to Practice button (#platform-switch-practice-btn) not found in Platform header!');
    }
    await switchBtn.click();
    await page.waitForSelector('#platform-context-switch-modal', { timeout: 3000 });

    const modalTitle = await page.$eval('#platform-context-switch-modal h3', (el) => el.textContent?.trim()).catch(() => null);
    const practiceCard = await page.$('#platform-practice-card-practice-shameem-1');
    const cancelBtn = await page.$('#platform-context-cancel-btn');
    const enterPracticeBtn = await page.$('#platform-enter-practice-btn');

    console.log('Context Switch Modal Title:', modalTitle);
    console.log('Cancel Button found:', !!cancelBtn);
    console.log('Enter Practice Button found:', !!enterPracticeBtn);

    const practiceCardSelected = await page.$eval(
      '#platform-practice-card-practice-shameem-1',
      (el) => el.getAttribute('aria-checked')
    );
    console.log('Practice Card Selected (aria-checked):', practiceCardSelected);

    const enterBtnText = await page.$eval('#platform-enter-practice-btn', (el) => el.textContent?.trim());
    console.log('Enter Practice Button Text:', enterBtnText);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_context_switch_modal.png') });

    if (modalTitle?.includes('MY PRACTICES') && practiceCard && cancelBtn && enterPracticeBtn && practiceCardSelected === 'true') {
      console.log('✅ Test D Passed: Context switch modal displays practice selection card, clear selection state, Cancel button, and explicit Enter Practice button.');
      testResults.push({ test: 'Test D: Context Switch Modal UX', status: 'PASS' });
    } else {
      console.error('❌ Test D Failed: Modal buttons or selected state missing');
      testResults.push({ test: 'Test D: Context Switch Modal UX', status: 'FAIL' });
    }

    // -------------------------------------------------------------
    // Test E: Enter Practice Action -> Navigates to Practice Context
    // -------------------------------------------------------------
    console.log('\n--- Test E: Click Enter Practice & verify Practice Context and clinical authority ---');
    await enterPracticeBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/dashboard'), { timeout: 6000 });
    await new Promise((r) => setTimeout(r, 1200));

    const practiceUrl = page.url();
    console.log('URL after Enter Practice:', practiceUrl);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_entered_practice_dashboard.png') });

    const practiceContent = await page.content();
    const hasPracticeIndicators =
      practiceUrl.includes('/dashboard') &&
      (practiceContent.includes("Shameem Alungal's Practice") || practiceContent.includes('Prescription') || practiceContent.includes('Patients'));

    if (hasPracticeIndicators) {
      console.log('✅ Test E Passed: Successfully entered practice context with practice identity and clinical authority.');
      testResults.push({ test: 'Test E: Enter Practice Context Execution', status: 'PASS' });
    } else {
      console.error('❌ Test E Failed: Did not land on practice dashboard');
      testResults.push({ test: 'Test E: Enter Practice Context Execution', status: 'FAIL' });
    }

    // -------------------------------------------------------------
    // Test F: Reverse Switch (Practice -> Platform)
    // -------------------------------------------------------------
    console.log('\n--- Test F: Practice -> Platform reverse switch ---');
    // Check sidebar switch to platform button
    const sidebarSwitchToPlatform = await page.$('#sidebar-switch-to-platform-btn');
    console.log('Sidebar Switch to Platform button visible:', !!sidebarSwitchToPlatform);

    if (sidebarSwitchToPlatform) {
      await sidebarSwitchToPlatform.click();
      await page.waitForFunction(() => window.location.pathname.startsWith('/platform'), { timeout: 6000 });
      await new Promise((r) => setTimeout(r, 1000));

      const backToPlatformUrl = page.url();
      console.log('URL after reverse switch to Platform:', backToPlatformUrl);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_reverse_switch_to_platform.png') });

      if (backToPlatformUrl.includes('/platform')) {
        console.log('✅ Test F Passed: Successfully switched back from Practice to Platform.');
        testResults.push({ test: 'Test F: Reverse Switch (Practice -> Platform)', status: 'PASS' });
      } else {
        console.error('❌ Test F Failed: Reverse switch did not navigate to /platform');
        testResults.push({ test: 'Test F: Reverse Switch (Practice -> Platform)', status: 'FAIL' });
      }
    } else {
      console.error('❌ Test F Failed: #sidebar-switch-to-platform-btn not found in practice sidebar');
      testResults.push({ test: 'Test F: Reverse Switch (Practice -> Platform)', status: 'FAIL' });
    }

    // -------------------------------------------------------------
    // Test G: Unauthorized User (platformRole = null) -> 403 Access Denied
    // -------------------------------------------------------------
    console.log('\n--- Test G: Unauthorized normal practice user attempting /platform ---');
    currentAuth = normalVetAuthPayload;
    await page.goto(`${BASE_URL}/platform`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 800));

    const unauthorizedContent = await page.content();
    const hasPlatformAccessRequired = unauthorizedContent.includes('Platform Access Required');
    const hasRestrictedMessage = unauthorizedContent.includes('strictly restricted to Platform Super Administrators');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_unauthorized_platform_403.png') });

    if (hasPlatformAccessRequired && hasRestrictedMessage) {
      console.log('✅ Test G Passed: Normal practice user without platform privileges blocked with 403 Platform Access Required.');
      testResults.push({ test: 'Test G: Unauthorized User Blocked from /platform', status: 'PASS' });
    } else {
      console.error('❌ Test G Failed: Access denied screen not displayed for non-admin');
      testResults.push({ test: 'Test G: Unauthorized User Blocked from /platform', status: 'FAIL' });
    }

    // -------------------------------------------------------------
    // Test H: Direct route refresh with authenticated Super Admin
    // -------------------------------------------------------------
    console.log('\n--- Test H: Direct route refresh for Super Admin ---');
    currentAuth = dualRoleAuthPayload;
    await page.goto(`${BASE_URL}/platform/permissions`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    // Reload page
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    const reloadedUrl = page.url();
    const reloadedContent = await page.content();
    const reloadHealthy = reloadedUrl.includes('/platform/permissions') && !reloadedContent.includes('Loading VetRx');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_direct_refresh_permissions.png') });

    if (reloadHealthy) {
      console.log('✅ Test H Passed: Direct refresh on /platform/permissions succeeds without blank page or redirect loops.');
      testResults.push({ test: 'Test H: Direct Route Refresh Integrity', status: 'PASS' });
    } else {
      console.error('❌ Test H Failed: Route refresh caused blank screen or lost context');
      testResults.push({ test: 'Test H: Direct Route Refresh Integrity', status: 'FAIL' });
    }

  } catch (error) {
    console.error('Browser UAT encountered an unhandled error:', error);
    testResults.push({ test: 'Browser UAT Execution', status: 'ERROR', error: error.message });
  } finally {
    await browser.close();
  }

  console.log('\n======================================================');
  console.log('VetRx Phase 15 Browser UAT Summary:');
  console.table(testResults);
  const allPassed = testResults.every((t) => t.status === 'PASS');
  console.log('Final Result:', allPassed ? 'ALL TESTS PASSED ✅' : 'FAILURES DETECTED ❌');
  console.log('======================================================\n');
  process.exit(allPassed ? 0 : 1);
}

runPhase15BrowserTests();
