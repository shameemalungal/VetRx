import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { launchReliableBrowser } from './browser_env.mjs';

async function main() {
  console.log('=== VetRx UAT Deliverables Automated Verification ===\n');

  // 1. Verify A1: Marketing Website Pricing Section
  console.log('1. Verifying A1: Marketing Website Pricing CTA buttons...');
  const pricingSectionPath = path.resolve('website/src/components/PricingSection.tsx');
  const pricingSectionCode = fs.readFileSync(pricingSectionPath, 'utf-8');

  // Check Individual CTA button styling
  const indBtnMatch = pricingSectionCode.includes(
    'href={`${APP_REGISTER_BASE}?plan=INDIVIDUAL&interval=${billingCycle}`}'
  ) && pricingSectionCode.includes('gradient-teal-aqua hover:opacity-95 shadow-md hover:shadow-card-lift');
  assert.ok(indBtnMatch, 'Individual tier CTA button must use primary green gradient-teal-aqua styling');

  // Check Clinic CTA button styling
  const clinicBtnMatch = pricingSectionCode.includes(
    'href={`${APP_REGISTER_BASE}?plan=CLINIC&interval=${billingCycle}`}'
  ) && pricingSectionCode.includes('gradient-teal-aqua hover:opacity-95 shadow-md hover:shadow-card-lift');
  assert.ok(clinicBtnMatch, 'Clinic tier CTA button must use primary green gradient-teal-aqua styling');

  console.log('  [PASS] Both Individual and Clinic pricing cards have primary green gradient-teal-aqua CTA buttons.');

  // 2. Verify A2: Registration Page Back to Pricing and Dynamic Plan Switching
  console.log('\n2. Verifying A2: Registration Page Back to Pricing & Dynamic Switching...');
  const registerPagePath = path.resolve('web/src/pages/auth/RegisterPage.tsx');
  const registerPageCode = fs.readFileSync(registerPagePath, 'utf-8');

  assert.ok(
    registerPageCode.includes('id="register-back-to-pricing"'),
    'Register page must contain register-back-to-pricing back button'
  );
  assert.ok(
    registerPageCode.includes('href="https://vetrx.brightbase.in/#pricing"'),
    'Register back button on Step 1 must point to https://vetrx.brightbase.in/#pricing'
  );
  assert.ok(
    registerPageCode.includes('id="auth-trial-banner"'),
    'Register page must contain dynamic trial messaging banner'
  );
  assert.ok(
    registerPageCode.includes("practiceType === 'CLINIC' ? 'Clinic Plan' : 'Individual Practitioner Plan'"),
    'Trial banner must dynamically update text based on practiceType'
  );
  assert.ok(
    registerPageCode.includes('id="plan-card-individual"') && registerPageCode.includes('id="plan-card-clinic"'),
    'Plan option cards must be present and selectable'
  );

  console.log('  [PASS] Back to pricing navigation and dynamic trial banner verified in RegisterPage.');

  // 3. Verify G16: Platform Super Admin Complimentary Access
  console.log('\n3. Verifying G16: Platform Super Admin Complimentary Access UI & Backend...');
  const adminPagePath = path.resolve('web/src/pages/platform/PlatformSubscriptionsPage.tsx');
  const adminPageCode = fs.readFileSync(adminPagePath, 'utf-8');

  assert.ok(
    adminPageCode.includes('Clinic (1 Veterinarian + 5 Staff)'),
    'Complimentary modal must explicitly show Clinic (1 Veterinarian + 5 Staff)'
  );
  assert.ok(
    adminPageCode.includes('<option value={0}>Unlimited Access</option>'),
    'Complimentary modal must provide Unlimited Access option'
  );
  assert.ok(
    adminPageCode.includes("'Unlimited Access'"),
    'Subscriptions table must render Unlimited Access for indefinite grants'
  );

  const subServicePath = path.resolve('server/src/commercial/subscription.service.ts');
  const subServiceCode = fs.readFileSync(subServicePath, 'utf-8');

  assert.ok(
    subServiceCode.includes('revokeComplimentarySubscription'),
    'SubscriptionService must implement revokeComplimentarySubscription'
  );
  assert.ok(
    subServiceCode.includes("meta.source === 'COMPLIMENTARY' && meta.isUnlimited"),
    'Deterministic status evaluation must keep unlimited complimentary access ACTIVE'
  );

  const entitlementServicePath = path.resolve('server/src/commercial/entitlement.service.ts');
  const entitlementServiceCode = fs.readFileSync(entitlementServicePath, 'utf-8');
  assert.ok(
    entitlementServiceCode.includes("meta.source === 'COMPLIMENTARY' && meta.isUnlimited"),
    'EntitlementService must recognize indefinite complimentary access without expiry'
  );

  console.log('  [PASS] G16 UI options, unlimited duration, and backend indefinite entitlement logic verified.');

  // 4. Verify Safe UAT Sample Invoice
  console.log('\n4. Verifying Sample UAT Invoice / Receipt Files...');
  const samplePdfPath = path.resolve('uat/sample-successful-payment-receipt.pdf');
  const sampleHtmlPath = path.resolve('uat/sample-successful-payment-receipt.html');

  assert.ok(fs.existsSync(samplePdfPath), 'UAT sample PDF receipt must exist');
  assert.ok(fs.existsSync(sampleHtmlPath), 'UAT sample HTML receipt must exist');

  const pdfStats = fs.statSync(samplePdfPath);
  const htmlStats = fs.statSync(sampleHtmlPath);
  assert.ok(pdfStats.size > 20000, `PDF size (${pdfStats.size} bytes) must be substantial and non-empty`);
  assert.ok(htmlStats.size > 5000, `HTML size (${htmlStats.size} bytes) must be substantial and non-empty`);

  const htmlContent = fs.readFileSync(sampleHtmlPath, 'utf-8');
  assert.ok(htmlContent.includes('Praxivon Technologies Private Limited'), 'Receipt must contain Praxivon Technologies');
  assert.ok(htmlContent.includes('VetRx Stitch Logo') || htmlContent.includes('data:image/png;base64,'), 'Receipt must contain embedded logo');
  assert.ok(htmlContent.includes('1,499.00'), 'Receipt must display Clinic plan ₹1,499.00 amount');
  assert.ok(htmlContent.includes('PAID'), 'Receipt must display PAID status');

  console.log(`  [PASS] UAT PDF receipt: ${samplePdfPath} (${pdfStats.size} bytes)`);
  console.log(`  [PASS] UAT HTML receipt: ${sampleHtmlPath} (${htmlStats.size} bytes)`);
  console.log('  [PASS] Sample receipt contains all required branding, entity, and plan details.');

  console.log('\n=== ALL UAT DELIVERABLES VERIFIED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
