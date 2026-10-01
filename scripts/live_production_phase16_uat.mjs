import { launchReliableBrowser } from './browser_env.mjs';
import { getProductionSessionToken } from './get_session.mjs';
import { runRemote } from './vps_exec.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const IP = '109.122.56.148';

async function main() {
  console.log('=== VetRx Phase 16 Live Production UAT ===\n');

  const artifactsDir = path.resolve('artifacts/phase16_live_production_uat');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const { browser, config } = await launchReliableBrowser({
    headless: true,
    args: [
      `--host-resolver-rules=MAP app.vetrx.brightbase.in ${IP}, MAP vetrx.brightbase.in ${IP}`,
      '--ignore-certificate-errors',
    ],
  });
  console.log(`[OK] Launched browser: ${config.name} (${config.version})`);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // 1. Marketing Website Pricing & CTA Buttons (A1)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing Marketing Website Pricing Section ---');
    await page.goto('https://vetrx.brightbase.in/#pricing', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Locate pricing cards
    const indCta = page.locator('a[href*="plan=INDIVIDUAL"]');
    const clinicCta = page.locator('a[href*="plan=CLINIC"]');

    assert.ok(await indCta.isVisible(), 'Individual plan CTA button must be visible');
    assert.ok(await clinicCta.isVisible(), 'Clinic plan CTA button must be visible');

    const indText = (await indCta.innerText()).trim();
    const clinicText = (await clinicCta.innerText()).trim();
    console.log(`  Individual CTA text: "${indText}"`);
    console.log(`  Clinic CTA text:     "${clinicText}"`);
    assert.ok(indText.includes('Start 14-Day Free Trial'), 'Individual CTA must say Start 14-Day Free Trial');
    assert.ok(clinicText.includes('Start 14-Day Free Trial'), 'Clinic CTA must say Start 14-Day Free Trial');

    // Verify both have green primary gradient class
    const indClass = await indCta.getAttribute('class');
    const clinicClass = await clinicCta.getAttribute('class');
    assert.ok(indClass.includes('gradient-teal-aqua'), 'Individual CTA must have gradient-teal-aqua styling');
    assert.ok(clinicClass.includes('gradient-teal-aqua'), 'Clinic CTA must have gradient-teal-aqua styling');

    await page.screenshot({ path: path.join(artifactsDir, '01_live_pricing_section.png') });
    console.log('  [PASS] Both Individual and Clinic CTAs are primary green buttons with correct copy.');

    // -------------------------------------------------------------------------
    // 2. Registration Page: Back Navigation & Dynamic Plan Selection (A2)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing Registration Page: Back Button & Dynamic Banner ---');
    await page.goto('https://app.vetrx.brightbase.in/register?plan=INDIVIDUAL&interval=monthly', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Check Back to Pricing button
    const backBtn = page.locator('#register-back-to-pricing');
    assert.ok(await backBtn.isVisible(), 'Back to Pricing button must be visible on Step 1');
    const backHref = await backBtn.getAttribute('href');
    assert.strictEqual(backHref, 'https://vetrx.brightbase.in/#pricing', 'Back button must link to marketing pricing section');
    console.log(`  Back button href verified: ${backHref}`);

    // Check Trial Banner for INDIVIDUAL
    const trialBanner = page.locator('#auth-trial-banner');
    assert.ok(await trialBanner.isVisible(), 'Trial banner must be visible');
    let bannerText = await trialBanner.innerText();
    console.log(`  Initial banner text: "${bannerText.replace(/\\s+/g, ' ')}"`);
    assert.ok(bannerText.includes('Individual Practitioner Plan'), 'Initial banner must state Individual Practitioner Plan');

    // Switch to Clinic
    console.log('  Clicking Clinic plan card...');
    const clinicCard = page.locator('#plan-card-clinic');
    await clinicCard.click();
    await page.waitForTimeout(500);

    bannerText = await trialBanner.innerText();
    console.log(`  Updated banner text: "${bannerText.replace(/\\s+/g, ' ')}"`);
    assert.ok(bannerText.includes('Clinic Plan'), 'Banner must dynamically switch to Clinic Plan');

    // Switch back to Individual
    console.log('  Clicking Individual plan card...');
    const indCard = page.locator('#plan-card-individual');
    await indCard.click();
    await page.waitForTimeout(500);

    bannerText = await trialBanner.innerText();
    console.log(`  Switched-back banner text: "${bannerText.replace(/\\s+/g, ' ')}"`);
    assert.ok(bannerText.includes('Individual Practitioner Plan'), 'Banner must dynamically switch back to Individual Practitioner Plan');

    await page.screenshot({ path: path.join(artifactsDir, '02_live_register_dynamic_plan.png') });
    console.log('  [PASS] Registration Back button and dynamic plan switching verified.');

    // -------------------------------------------------------------------------
    // 3. Platform Super Admin Complimentary Access UI (G16)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing Platform Super Admin Subscriptions Page ---');
    const saToken = getProductionSessionToken('drshameemalungal@gmail.com');
    console.log('  Obtained Super Admin production session token.');

    await context.addCookies([
      {
        name: 'vetrx_session',
        value: saToken,
        domain: 'app.vetrx.brightbase.in',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('https://app.vetrx.brightbase.in/platform/subscriptions', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const pageTitle = await page.innerText('h1');
    console.log(`  Platform page heading: "${pageTitle}"`);
    assert.ok(pageTitle.includes('Subscriptions Management'), 'Must load Subscriptions Management page');

    // Open Grant Complimentary Access Modal
    const grantBtn = page.locator('button:has-text("Grant Complimentary Access")');
    assert.ok(await grantBtn.isVisible(), 'Grant Complimentary Access button must be visible');
    await grantBtn.click();
    await page.waitForTimeout(500);

    // Verify Plan Dropdown Options
    const tierSelect = page.locator('select').nth(0);
    const tierOptions = await tierSelect.locator('option').allInnerTexts();
    console.log('  Access tier options:', tierOptions);
    assert.ok(
      tierOptions.some((opt) => opt.includes('Clinic (1 Veterinarian + 5 Staff)')),
      'Must contain option "Clinic (1 Veterinarian + 5 Staff)"'
    );
    assert.ok(
      tierOptions.some((opt) => opt.includes('Individual (1 Vet)')),
      'Must contain option "Individual (1 Vet)"'
    );

    // Verify Duration Dropdown Options
    const durationSelect = page.locator('select').nth(1);
    const durationOptions = await durationSelect.locator('option').allInnerTexts();
    console.log('  Duration options:', durationOptions);
    assert.ok(
      durationOptions.some((opt) => opt.includes('Unlimited Access')),
      'Must contain option "Unlimited Access"'
    );

    await page.screenshot({ path: path.join(artifactsDir, '03_live_complimentary_modal.png') });
    console.log('  [PASS] Super Admin Complimentary Access modal has correct tiers and Unlimited Access option.');

    // Close modal
    const cancelBtn = page.locator('button:has-text("Cancel")');
    await cancelBtn.click();
    await page.waitForTimeout(300);

    // Clean up temporary session
    try {
      const cleanScript = `
        const { SessionService } = require('/app/dist/auth/session.service.js');
        SessionService.revokeSession('${saToken}').catch(() => {});
      `;
      const cleanB64 = Buffer.from(cleanScript).toString('base64');
      runRemote(`docker exec -i vetrx-backend-prod node -e "eval(Buffer.from('${cleanB64}', 'base64').toString('utf8'))"`);
      console.log('  Cleaned up temporary SA session token.');
    } catch {
      // Non-critical session cleanup
    }

    console.log('\n=== ALL LIVE PRODUCTION UAT STEPS PASSED SUCCESSFULLY ===');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\n[FAIL] Live production UAT failed:', err);
  process.exit(1);
});
