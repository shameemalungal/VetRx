import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\drsha\\.gemini\\antigravity-ide\\brain\\7396848c-811b-4e32-9317-59ea9aae2290';
const DIST_DIR = path.resolve('web/dist');
const PORT = 3456;
const TARGET_URL = `http://localhost:${PORT}`;
const timestamp = Date.now();

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
    doctorName: 'Dr. Shameem Alungal',
    doctorRegistrationNumber: 'KVC-8942',
    registrationNumber: 'KVC-8942',
    address: 'Civil Station Road, Malappuram, Kerala - 676505',
    phone: '9847123456',
    email: 'dr.shameem@vetrx.test',
    ownerSpecialInstructionEnabled: true,
  },
};

const checks = [];
function record(testName, passed, details) {
  checks.push({ testName, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${testName}: ${details}`);
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      // API mock endpoints
      if (req.url.includes('/api/auth/me')) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(mockAuthPayload));
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
      console.log(`Embedded static test server running on ${TARGET_URL}`);
      resolve(server);
    });
  });
}

async function run() {
  console.log('===============================================================');
  console.log(`Testing Clinical UI Refinement on: ${TARGET_URL}`);
  console.log('===============================================================\n');

  const server = await startStaticServer();
  const userDataDir = path.join(os.tmpdir(), `edge-test-profile-${timestamp}`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    userDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,960'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 960 });
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(30000);

  try {
    // 1. Load app root with ?demo=1 to bootstrap session and seed demo patients & medicines
    console.log('--- Bootstrapping authenticated session with demo data ---');
    await page.goto(`${TARGET_URL}/?demo=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.app-shell, .topbar, .dashboard-greeting', { timeout: 15000 });
    record('Session Bootstrap', true, `Authenticated as ${mockAuthPayload.user.name}`);

    // 2. Navigate directly to Prescription Builder with seeded patient (id=1)
    console.log('--- Navigating to Prescription Builder with patientId=1 ---');
    await page.goto(`${TARGET_URL}/prescriptions/new?patientId=1`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.rx-clinical-card', { timeout: 15000 });
    await page.waitForSelector('.clinical-combobox-textarea', { timeout: 10000 });
    record('Prescription Workspace', true, 'Entered Clinical Details workspace for patient');

    // 4. Measure Desktop Dimensions & Aesthetics
    console.log('--- Desktop Viewport (1280px) Measurements ---');
    await page.setViewport({ width: 1280, height: 960 });
    await new Promise((r) => setTimeout(r, 600));

    const desktopMetrics = await page.evaluate(() => {
      const textarea = document.querySelector('.clinical-combobox-textarea');
      const input = document.querySelector('.clinical-combobox-input');
      const quickPills = document.querySelectorAll('.clinical-combobox-quick-pills, .clinical-combobox-pill');
      const card = document.querySelector('.rx-clinical-card');

      const taRect = textarea ? textarea.getBoundingClientRect() : null;
      const inRect = input ? input.getBoundingClientRect() : null;
      const cardComputed = card ? window.getComputedStyle(card) : null;
      const taComputed = textarea ? window.getComputedStyle(textarea) : null;

      return {
        textareaHeight: taRect ? Math.round(taRect.height) : 0,
        inputHeight: inRect ? Math.round(inRect.height) : 0,
        quickPillsCount: quickPills.length,
        placeholder: textarea ? textarea.getAttribute('placeholder') : '',
        textareaBg: taComputed ? taComputed.backgroundColor : '',
        cardBg: cardComputed ? cardComputed.backgroundColor : '',
        cardBorderRadius: cardComputed ? cardComputed.borderRadius : '',
      };
    });

    record(
      'Symptoms Textarea Compact Height',
      desktopMetrics.textareaHeight >= 64 && desktopMetrics.textareaHeight <= 76,
      `Height: ${desktopMetrics.textareaHeight}px (Requirement: 64–76px, standard ~72px)`
    );

    record(
      'Diagnosis Input Height',
      desktopMetrics.inputHeight >= 40 && desktopMetrics.inputHeight <= 44,
      `Height: ${desktopMetrics.inputHeight}px (Standard form-input: 42px)`
    );

    record(
      'Quick-Add Chips Removal',
      desktopMetrics.quickPillsCount === 0,
      `Quick chips rendered: ${desktopMetrics.quickPillsCount} (Must be 0)`
    );

    record(
      'Symptoms Placeholder',
      desktopMetrics.placeholder.includes('Describe presenting symptoms, physical findings, and relevant clinical observations'),
      `Placeholder: "${desktopMetrics.placeholder}"`
    );

    // Save desktop screenshot
    const desktopScreenshotPath = path.join(ARTIFACT_DIR, 'clinical_details_desktop.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${desktopScreenshotPath}`);

    // 5. Test Symptoms Autocomplete Dropdown
    console.log('--- Testing Symptoms Autocomplete ---');
    const textareaHandle = await page.$('.clinical-combobox-textarea');
    await textareaHandle.focus();
    await page.type('.clinical-combobox-textarea', 'vom');
    await new Promise((r) => setTimeout(r, 400));

    const dropdownMetrics = await page.evaluate(() => {
      const listbox = document.querySelector('.clinical-combobox-listbox');
      const options = listbox
        ? Array.from(listbox.querySelectorAll('[role="option"]')).map((o) => o.textContent.trim())
        : [];
      return {
        isOpen: !!listbox,
        optionCount: options.length,
        options,
      };
    });

    record(
      'Symptoms Dropdown Appearance',
      dropdownMetrics.isOpen && dropdownMetrics.options.some((o) => o.includes('Vomiting')),
      `Dropdown visible: ${dropdownMetrics.isOpen}, Options: ${JSON.stringify(dropdownMetrics.options)}`
    );

    // Save dropdown open screenshot
    const dropdownScreenshotPath = path.join(ARTIFACT_DIR, 'clinical_details_dropdown_open.png');
    await page.screenshot({ path: dropdownScreenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${dropdownScreenshotPath}`);

    // Select suggestion
    const firstOption = await page.$('.clinical-combobox-option');
    if (firstOption) {
      await firstOption.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    const valueAfterSelect = await page.$eval('.clinical-combobox-textarea', (el) => el.value);
    record(
      'Symptoms Suggestion Selection',
      valueAfterSelect.includes('Vomiting'),
      `Value after selecting: "${valueAfterSelect}"`
    );

    // 6. Test Diagnosis Autocomplete Dropdown
    console.log('--- Testing Diagnosis Autocomplete ---');
    const diagnosisHandle = await page.$('.clinical-combobox-input');
    await diagnosisHandle.focus();
    await page.type('.clinical-combobox-input', 'otitis');
    await new Promise((r) => setTimeout(r, 400));

    const diagDropdownMetrics = await page.evaluate(() => {
      const listbox = document.querySelector('.clinical-combobox-listbox');
      const options = listbox
        ? Array.from(listbox.querySelectorAll('[role="option"]')).map((o) => o.textContent.trim())
        : [];
      return {
        isOpen: !!listbox,
        optionCount: options.length,
        options,
      };
    });

    record(
      'Diagnosis Dropdown Appearance',
      diagDropdownMetrics.isOpen && diagDropdownMetrics.options.some((o) => o.toLowerCase().includes('otitis')),
      `Dropdown visible: ${diagDropdownMetrics.isOpen}, Options: ${JSON.stringify(diagDropdownMetrics.options)}`
    );

    // Test Escape key closes dropdown
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));
    const isClosedAfterEsc = await page.evaluate(() => !document.querySelector('.clinical-combobox-listbox'));
    record('Escape Closes Dropdown', isClosedAfterEsc, `Listbox closed on Escape: ${isClosedAfterEsc}`);

    // 7. Tablet Viewport (768px)
    console.log('--- Testing Tablet Viewport (768px) ---');
    await page.setViewport({ width: 768, height: 1024 });
    await new Promise((r) => setTimeout(r, 500));

    const tabletMetrics = await page.evaluate(() => {
      const textarea = document.querySelector('.clinical-combobox-textarea');
      const input = document.querySelector('.clinical-combobox-input');
      const taRect = textarea ? textarea.getBoundingClientRect() : null;
      const inRect = input ? input.getBoundingClientRect() : null;
      return {
        textareaHeight: taRect ? Math.round(taRect.height) : 0,
        inputHeight: inRect ? Math.round(inRect.height) : 0,
      };
    });

    record(
      'Tablet Responsive Height',
      tabletMetrics.textareaHeight >= 64 && tabletMetrics.textareaHeight <= 76,
      `Symptoms Height: ${tabletMetrics.textareaHeight}px, Diagnosis Height: ${tabletMetrics.inputHeight}px`
    );

    const tabletScreenshotPath = path.join(ARTIFACT_DIR, 'clinical_details_tablet.png');
    await page.screenshot({ path: tabletScreenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${tabletScreenshotPath}`);

    // 8. Mobile Viewport (375px)
    console.log('--- Testing Mobile Viewport (375px) ---');
    await page.setViewport({ width: 375, height: 812 });
    await new Promise((r) => setTimeout(r, 500));

    const mobileMetrics = await page.evaluate(() => {
      const textarea = document.querySelector('.clinical-combobox-textarea');
      const input = document.querySelector('.clinical-combobox-input');
      const taRect = textarea ? textarea.getBoundingClientRect() : null;
      const inRect = input ? input.getBoundingClientRect() : null;
      return {
        textareaHeight: taRect ? Math.round(taRect.height) : 0,
        inputHeight: inRect ? Math.round(inRect.height) : 0,
      };
    });

    record(
      'Mobile Responsive Height',
      mobileMetrics.textareaHeight >= 64 && mobileMetrics.textareaHeight <= 76,
      `Symptoms Height: ${mobileMetrics.textareaHeight}px, Diagnosis Height: ${mobileMetrics.inputHeight}px`
    );

    const mobileScreenshotPath = path.join(ARTIFACT_DIR, 'clinical_details_mobile.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${mobileScreenshotPath}`);

  } catch (err) {
    console.error('Error during test execution:', err);
    record('Execution Error', false, err.message);
  } finally {
    await browser.close();
    server.close();
  }

  const passedCount = checks.filter((c) => c.passed).length;
  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passedCount}/${checks.length} Checks Passed`);
  console.log('===============================================================');
}

run();
