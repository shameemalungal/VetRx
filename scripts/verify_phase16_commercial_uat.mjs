import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const IP = '109.122.56.148';
const credentials = {
  email: 'uat.vet@vetrx.test',
  password: 'VetRxTest@2026!',
};

const results = [];
function record(testName, passed, details) {
  results.push({ testName, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName}: ${details}`);
}

async function runCommercialUAT() {
  const artifactsDir = path.resolve('artifacts/phase16_commercial_uat');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log('===============================================================');
  console.log('VETRX PHASE 16 COMMERCIAL & PAYU READINESS: BROWSER UAT');
  console.log('===============================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      `--host-resolver-rules=MAP app.vetrx.brightbase.in ${IP}, MAP vetrx.brightbase.in ${IP}`,
      '--ignore-certificate-errors',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // 1. Marketing Website Pricing & Disclosures
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Marketing Website Pricing Section ---');
    await page.goto('https://vetrx.brightbase.in/#pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const content = await page.content();
    const hasMisleadingBadge = content.includes('Most popular for the clinics');
    record('Step 1.1: Misleading Badge Removed', !hasMisleadingBadge, hasMisleadingBadge ? 'Misleading badge still present' : 'Static badge removed');

    const pricingCards = await page.$$('.pricing-card');
    record('Step 1.2: Pricing Cards Rendered', pricingCards.length === 3, `Found ${pricingCards.length} pricing cards`);

    await page.screenshot({ path: `${artifactsDir}/01_website_pricing.png` });

    // -------------------------------------------------------------------------
    // 2. Registration Flow with Plan Query Parameters
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Registration Flow with Plan Query Parameters ---');
    await page.goto('https://app.vetrx.brightbase.in/register?plan=CLINIC&interval=annual', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const regContent = await page.content();
    const hasTrialBanner = regContent.includes('14-Day Free Trial:');
    record('Step 2.1: 14-Day Trial Banner Present', hasTrialBanner, hasTrialBanner ? '14-Day Free Trial banner displayed' : 'Trial banner missing');

    const isClinicSelected = regContent.includes('Veterinary Clinic') && regContent.includes('Owner, Clinic Admin');
    record('Step 2.2: Clinic Setup Pre-Selected', isClinicSelected, 'Clinic setup preselected from query param');

    await page.screenshot({ path: `${artifactsDir}/02_register_with_plan.png` });

    // -------------------------------------------------------------------------
    // 3. Login to App & Navigate to Subscription & Billing
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Subscription & Billing in App ---');
    await page.goto('https://app.vetrx.brightbase.in/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.fill('#login-email', credentials.email);
    await page.fill('#login-password', credentials.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.evaluate(() => localStorage.setItem('vetrx_demo_mode', '1'));

    // Go to Settings -> Subscription & Billing
    await page.goto('https://app.vetrx.brightbase.in/settings/billing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const billingContent = await page.content();
    const hasTransparentNotice = billingContent.includes('Simple, transparent pricing. No per-patient or per-prescription charges.');
    record('Step 3.1: Approved Statutory Pricing Disclaimer', hasTransparentNotice, hasTransparentNotice ? 'Approved disclaimer displayed' : 'Disclaimer missing');

    const hasPayUNotice = billingContent.includes('Subscriptions are processed securely in INR through PayU');
    record('Step 3.2: PayU Security & Verification Notice', hasPayUNotice, hasPayUNotice ? 'PayU processing notice present' : 'Notice missing');

    const hasPaymentHistory = billingContent.includes('Payment & Billing History');
    record('Step 3.3: Payment & Billing History Section', hasPaymentHistory, 'Payment History section rendered');

    await page.screenshot({ path: `${artifactsDir}/03_app_billing_section.png` });

    // -------------------------------------------------------------------------
    // 4. Platform Subscriptions Oversight
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Super Admin Platform Subscriptions Oversight ---');
    await page.goto('https://app.vetrx.brightbase.in/platform/subscriptions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const platformContent = await page.content();
    const hasPlatformHeader = platformContent.includes('Subscriptions Management');
    record('Step 4.1: Platform Subscriptions Header', hasPlatformHeader, hasPlatformHeader ? 'Platform subscriptions loaded' : 'Access denied or missing header');

    await page.screenshot({ path: `${artifactsDir}/04_platform_subscriptions.png` });

  } catch (err) {
    console.error('Browser UAT encountered error:', err);
    record('Execution Health', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n===============================================================');
  console.log('COMMERCIAL UAT EXECUTION COMPLETED');
  console.log('===============================================================');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Summary: ${passedCount}/${results.length} PASSED.`);
}

runCommercialUAT().catch(console.error);
