import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SRC_DIR = path.resolve(__dirname, 'src');

test('VetRx UI Corrections: Arrow removal & icon/text spacing regression suite', async (t) => {
  await t.test('1. Registration screen Step 1 removes the back arrow button', () => {
    const regContent = fs.readFileSync(path.join(SRC_DIR, 'pages/auth/RegisterPage.tsx'), 'utf-8');
    
    // Must NOT contain register-back-to-pricing or Back to Pricing link
    assert.ok(!regContent.includes('id="register-back-to-pricing"'), 'Step 1 should not have register-back-to-pricing');
    assert.ok(!regContent.includes('Back to Pricing'), 'Step 1 should not contain Back to Pricing');
    
    // Step navigation should only render when step > 1
    assert.ok(regContent.includes('{step > 1 && ('), 'Step navigation must be conditioned on step > 1');
  });

  await t.test('2. Action buttons across VetRx do not have decorative arrows', () => {
    const rxBuilderContent = fs.readFileSync(path.join(SRC_DIR, 'pages/prescriptions/PrescriptionBuilderPage.tsx'), 'utf-8');
    const patientsListContent = fs.readFileSync(path.join(SRC_DIR, 'pages/patients/PatientsListPage.tsx'), 'utf-8');
    const dashboardContent = fs.readFileSync(path.join(SRC_DIR, 'pages/DashboardPage.tsx'), 'utf-8');
    const inventoryDashContent = fs.readFileSync(path.join(SRC_DIR, 'pages/inventory/InventoryDashboardPage.tsx'), 'utf-8');
    const invoiceBuilderContent = fs.readFileSync(path.join(SRC_DIR, 'pages/invoices/InvoiceBuilderPage.tsx'), 'utf-8');
    const cvpRegContent = fs.readFileSync(path.join(SRC_DIR, 'pages/cvp/CallRegistrationPage.tsx'), 'utf-8');

    // PrescriptionBuilderPage action buttons
    assert.ok(!rxBuilderContent.includes('<span>Select &amp; Start Rx</span>\n                        <Icon name="arrow-forward"'), 'Select & Start Rx must not have arrow-forward');
    assert.ok(!rxBuilderContent.includes('<span>Continue Registration</span>\n                  <Icon name="arrow-forward"'), 'Continue Registration must not have arrow-forward');
    assert.ok(!rxBuilderContent.includes('<Icon name="arrow-forward" size={18} />\n                      <span>{existingRx?.status === \'Changes Requested\' ? \'Resubmit for Veterinarian Approval\''), 'Send for Veterinarian Approval must not have arrow-forward');
    assert.ok(!rxBuilderContent.includes('<Icon name="arrow-forward" size={16} />\n                <span>{existingRx?.status === \'Changes Requested\' ? \'Resubmit\' : \'Send for Approval\'}'), 'Send for Approval must not have arrow-forward');

    // PatientsListPage View Details
    assert.ok(!patientsListContent.includes('<span>View Details</span>\n                        <Icon name="arrow-right"'), 'View Details must not have arrow-right');

    // DashboardPage View All links
    assert.ok(!dashboardContent.includes('View All Records →'), 'View All Records should not have trailing arrow');
    assert.ok(!dashboardContent.includes('View All Documents →'), 'View All Documents should not have trailing arrow');

    // InventoryDashboardPage links & buttons
    assert.ok(!inventoryDashContent.includes('Manage →'), 'Manage should not have trailing arrow');
    assert.ok(!inventoryDashContent.includes('Transfer to Bag →'), 'Transfer to Bag should not have trailing arrow');
    assert.ok(!inventoryDashContent.includes('Inspect Bag →'), 'Inspect Bag should not have trailing arrow');
    assert.ok(!inventoryDashContent.includes('View All ({alertCount}) →'), 'View All Alerts should not have trailing arrow');
    assert.ok(!inventoryDashContent.includes('Purchase History →'), 'Purchase History should not have trailing arrow');

    // InvoiceBuilderPage Select
    assert.ok(!invoiceBuilderContent.includes('Select →'), 'Select should not have trailing arrow');

    // CallRegistrationPage action buttons
    assert.ok(!cvpRegContent.includes('<span>Next: Animals</span>\n                  <ChevronRight'), 'Next: Animals should not have ChevronRight');
    assert.ok(!cvpRegContent.includes('<span>Next: Clinical Triage</span>\n                  <ChevronRight'), 'Next: Clinical Triage should not have ChevronRight');
    assert.ok(!cvpRegContent.includes('<span>Next: Farm Location</span>\n                  <ChevronRight'), 'Next: Farm Location should not have ChevronRight');
    assert.ok(!cvpRegContent.includes('<span>Review Call Summary</span>\n                  <ChevronRight'), 'Review Call Summary should not have ChevronRight');
  });

  await t.test('3. Root cause of text/icon overlap is resolved in utilities.css', () => {
    const utilContent = fs.readFileSync(path.join(SRC_DIR, 'styles/utilities.css'), 'utf-8');

    // utilities.css base reset must use :where so it does not override classes
    assert.ok(utilContent.includes(':where(input[type="text"]'), 'Base input reset must use :where to avoid specificity collisions');
    
    // Must contain protected leading icon padding rules
    assert.ok(utilContent.includes('.desktop-search-input'), 'utilities.css must protect .desktop-search-input padding');
    assert.ok(utilContent.includes('.patients-search-input'), 'utilities.css must protect .patients-search-input padding');
    assert.ok(utilContent.includes('.medicines-search-input'), 'utilities.css must protect .medicines-search-input padding');
    assert.ok(utilContent.includes('.packages-search-input'), 'utilities.css must protect .packages-search-input padding');
    assert.ok(utilContent.includes('.invoices-search-input'), 'utilities.css must protect .invoices-search-input padding');
    assert.ok(utilContent.includes('.rx-search-input'), 'utilities.css must protect .rx-search-input padding');
  });

  await t.test('4. Global search input in AppShell.css has adequate clearance', () => {
    const appShellCss = fs.readFileSync(path.join(SRC_DIR, 'components/Layout/AppShell.css'), 'utf-8');

    // desktop-search-input must have padding-left >= 36px with !important
    assert.ok(appShellCss.includes('padding-left: 38px !important;'), 'desktop-search-input must have padding-left: 38px !important');
    assert.ok(appShellCss.includes('padding-right: 48px !important;'), 'desktop-search-input must have padding-right: 48px !important');
    assert.ok(appShellCss.includes('.desktop-search-icon'), 'desktop-search-icon must be positioned');
  });

  await t.test('5. Sidebar navigation items in AppShell.css have proper spacing and no overlap', () => {
    const appShellCss = fs.readFileSync(path.join(SRC_DIR, 'components/Layout/AppShell.css'), 'utf-8');

    // sidebar-nav-item gap should be 12px and svg flex-shrink: 0
    assert.ok(appShellCss.includes('gap: 12px;'), 'sidebar-nav-item must have 12px gap');
    assert.ok(appShellCss.includes('flex-shrink: 0;'), 'sidebar-nav-item svg must have flex-shrink: 0');
  });

  await t.test('6. Phase 1: Inventory purchase invoice discount persistence & calculation lifecycle', () => {
    const modalContent = fs.readFileSync(path.join(SRC_DIR, 'pages/inventory/InvoiceImporterModal.tsx'), 'utf-8');
    const apiContent = fs.readFileSync(path.join(SRC_DIR, 'services/inventoryApi.ts'), 'utf-8');

    // In InvoiceImporterModal, discountPercent and schemeDiscountPercent must be synchronized
    assert.ok(modalContent.includes('updated.discountPercent = numDisc;'), 'updateItemField must sync discountPercent');
    assert.ok(modalContent.includes('updated.schemeDiscountPercent = numDisc;'), 'updateItemField must sync schemeDiscountPercent');
    
    // Fallback in calculateSumTaxable and calculateSumGst must use ?? not ||
    assert.ok(modalContent.includes('it.discountPercent ?? it.schemeDiscountPercent ?? 0'), 'calculateSumTaxable must use ?? to support 0% discount');
    
    // Table row input must use ?? so 0 discount does not revert
    assert.ok(modalContent.includes('value={it.discountPercent ?? it.schemeDiscountPercent ?? 0}'), 'Row input must use ?? for value');
    assert.ok(modalContent.includes("updateItemField(idx, 'discountPercent', Number(e.target.value))"), 'Row input onChange must update discountPercent');

    // Confirm purchase payload must pass discounts
    assert.ok(modalContent.includes('discountPercent: Number(it.discountPercent ?? it.schemeDiscountPercent ?? 0)'), 'confirmPurchase must include discountPercent');

    // inventoryApi confirmPurchase item types must accept discountPercent
    assert.ok(apiContent.includes('discountPercent?: number;'), 'confirmPurchase item types must include discountPercent');
  });

  await t.test('7. Phase 1: Clinical invoice discount persistence & calculation lifecycle', () => {
    const builderContent = fs.readFileSync(path.join(SRC_DIR, 'pages/invoices/InvoiceBuilderPage.tsx'), 'utf-8');

    // Must have doctorDiscountMode and doctorDiscountInput state
    assert.ok(builderContent.includes('doctorDiscountMode, setDoctorDiscountMode'), 'Must declare doctorDiscountMode');
    assert.ok(builderContent.includes('doctorDiscountInput, setDoctorDiscountInput'), 'Must declare doctorDiscountInput');

    // Load data must populate doctorDiscountInput from existing discountTotal
    assert.ok(builderContent.includes('setDoctorDiscountInput((docDisc / 100).toString())'), 'loadData must populate doctorDiscountInput');

    // Calculations must compute effective doctor discount for both FIXED and PERCENT
    assert.ok(builderContent.includes("doctorDiscountMode === 'PERCENT'"), 'Calculations must support PERCENT discount mode');
    assert.ok(builderContent.includes('effectiveDoctorDiscountPaisa'), 'Calculations must derive effectiveDoctorDiscountPaisa');

    // Save must persist calculations.doctorDiscountPaisa and item.discountPct
    assert.ok(builderContent.includes('discountTotal: calculations.doctorDiscountPaisa'), 'Save must persist calculations.doctorDiscountPaisa');
    assert.ok(builderContent.includes('discountPct: item.discountPct || 0'), 'Save must persist item discountPct');

    // Modal item must support both FIXED and PERCENT discounts
    assert.ok(builderContent.includes('modalDiscountType, setModalDiscountType'), 'Modal must declare modalDiscountType');
  });

  await t.test('8. Phase 3: Dashboard Instant Formulary & MRN Search icon clearance', () => {
    const dashPageContent = fs.readFileSync(path.join(SRC_DIR, 'pages/DashboardPage.tsx'), 'utf-8');
    const dashCssContent = fs.readFileSync(path.join(SRC_DIR, 'pages/DashboardPage.css'), 'utf-8');
    const utilContent = fs.readFileSync(path.join(SRC_DIR, 'styles/utilities.css'), 'utf-8');

    // Formulary search icon must be search (magnifying glass)
    assert.ok(dashPageContent.includes('<Icon name="search" size={16} className="formulary-icon-inside" />'), 'Formulary input must use search icon');

    // DashboardPage.css must enforce padding-left >= 38px
    assert.ok(dashCssContent.includes('padding-left: 38px !important;'), 'DashboardPage.css must enforce padding-left: 38px !important');

    // utilities.css must exclude .formulary-search-field from the default padding overwrite and specify 38px
    assert.ok(utilContent.includes(':not(.formulary-search-field)'), 'utilities.css must exclude .formulary-search-field from reset');
    assert.ok(utilContent.includes('.formulary-search-field {\n  padding-left: 38px !important;'), 'utilities.css must set 38px padding on formulary search');
  });

  await t.test('9. Phase 4: Header practice name overflow containment and truncation', () => {
    const switcherContent = fs.readFileSync(path.join(SRC_DIR, 'components/PracticeSwitcher/PracticeSwitcher.tsx'), 'utf-8');
    const switcherCss = fs.readFileSync(path.join(SRC_DIR, 'components/PracticeSwitcher/PracticeSwitcher.css'), 'utf-8');
    const appShellCss = fs.readFileSync(path.join(SRC_DIR, 'components/Layout/AppShell.css'), 'utf-8');

    // Button and name span must have accessible title
    assert.ok(switcherContent.includes('title={displayName}'), 'PracticeSwitcher button and label must have title={displayName}');

    // PracticeSwitcher.css must enforce ellipsis truncation and flex containment
    assert.ok(switcherCss.includes('text-overflow: ellipsis;'), 'practice-switcher-name must use text-overflow: ellipsis');
    assert.ok(switcherCss.includes('white-space: nowrap;'), 'practice-switcher-name must use white-space: nowrap');
    assert.ok(switcherCss.includes('flex: 1;'), 'practice-switcher-label must have flex: 1');
    assert.ok(switcherCss.includes('overflow: hidden;'), 'practice-switcher-label must have overflow: hidden');

    // AppShell.css must constrain desktop-header-left
    assert.ok(appShellCss.includes('max-width: calc(100% - 400px);'), 'desktop-header-left must have max-width constraint');
    assert.ok(appShellCss.includes('flex-shrink: 0;'), 'desktop-header-right must have flex-shrink: 0');
  });
});
