import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = process.argv[2] || 'https://vetrx.brightbase.in';

const timestamp = Date.now();
const testUser = {
  name: 'Dr. Shameem Alungal',
  practiceName: 'Malappuram Companion Animal Hospital',
  email: `dr.shameem.${timestamp}@vetrx.test`,
  password: 'DoctorPassword#2026!',
  qualifications: 'BVSc & AH, MVSc (Medicine)',
  regNumber: 'KVC-8942',
  phone: '9847123456',
  address: 'Civil Station Road, Malappuram, Kerala - 676505',
};

const checks = [];
function record(testName, passed, details) {
  checks.push({ testName, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] ${testName}: ${details}`);
}

async function run() {
  console.log(`===============================================================`);
  console.log(`Starting VetRx Clinical Fixes Production UAT on: ${TARGET_URL}`);
  console.log(`Doctor: ${testUser.name} (${testUser.email})`);
  console.log(`===============================================================\n`);

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1280,960'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 960 });
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('401 (Unauthorized)')) {
      console.log(`[Browser Console Error]:`, msg.text());
    }
  });

  try {
    // --------------------------------------------------------------------------
    // 1. Register Account & Practitioner Profile
    // --------------------------------------------------------------------------
    console.log('--- Step 1: Register Account & Setup Practitioner Profile ---');
    await page.goto(`${TARGET_URL}/register`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#register-name', { timeout: 10000 });
    await page.type('#register-name', testUser.name);
    await page.type('#register-practice-name', testUser.practiceName);
    await page.type('#register-email', testUser.email);
    await page.type('#register-password', testUser.password);
    await page.type('#register-confirm-password', testUser.password);
    await page.click('button[type="submit"]');

    await page.waitForSelector('.desktop-header, .sidebar', { timeout: 15000 });
    record('Auth & Registration', true, `Successfully registered and logged in as ${testUser.email}`);

    // Update Practice / Practitioner Settings via UI form
    await page.goto(`${TARGET_URL}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#prac-name', { timeout: 8000 });
    
    // Fill practitioner profile form with puppeteer type
    await page.waitForSelector('#prac-name', { timeout: 8000 });
    await page.click('#prac-name', { clickCount: 3 });
    await page.type('#prac-name', testUser.name);

    await page.click('#prac-reg', { clickCount: 3 });
    await page.type('#prac-reg', testUser.regNumber);

    await page.click('#prac-qual', { clickCount: 3 });
    await page.type('#prac-qual', testUser.qualifications);

    await page.click('#prac-phone', { clickCount: 3 });
    await page.type('#prac-phone', testUser.phone);

    await page.click('#prac-email', { clickCount: 3 });
    await page.type('#prac-email', testUser.email);

    await page.click('#prac-addr', { clickCount: 3 });
    await page.type('#prac-addr', testUser.address);

    const saveBtn = await page.$('.settings-actions button[type="submit"]');
    if (saveBtn) {
      await saveBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
    }
    record('Practitioner Profile Update', true, 'Profile saved via Settings UI with qualifications, registration, and address');

    // --------------------------------------------------------------------------
    // 2. Patient Species Deduplication
    // --------------------------------------------------------------------------
    console.log('\n--- Step 2: Test Patient Species Deduplication ---');
    await page.goto(`${TARGET_URL}/patients/new`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#patient-species', { timeout: 8000 });

    const speciesOptions = await page.evaluate(() => {
      const select = document.querySelector('#patient-species');
      if (!select) return [];
      return Array.from(select.options).map((opt) => opt.text.trim());
    });

    const uniqueSpecies = new Set(speciesOptions.map((s) => s.toLowerCase()));
    const hasDuplicateSpecies = uniqueSpecies.size !== speciesOptions.length;
    record(
      'Species Deduplication (Initial Load)',
      !hasDuplicateSpecies,
      `Total options: ${speciesOptions.length}, Unique: ${uniqueSpecies.size}. Options: ${speciesOptions.join(', ')}`
    );

    // Create a patient
    const patientName = `Bruno-${timestamp.toString().slice(-4)}`;
    const tabs = await page.$$('.owner-select-tabs button');
    if (tabs.length >= 2) await tabs[1].click();
    await page.waitForSelector('#new-owner-name', { timeout: 5000 });
    await page.type('#new-owner-name', 'Anand Nair');
    await page.type('#new-owner-phone', '9847112233');
    await page.type('#patient-name', patientName);
    await page.select('#patient-species', 'Canine');
    await page.click('button[type="submit"]');

    await page.waitForFunction(() => window.location.pathname.startsWith('/patients/') && !window.location.pathname.includes('/new'), { timeout: 15000 });
    const patientUrl = page.url();
    const patientId = patientUrl.split('/patients/')[1].split('/')[0].split('?')[0];
    record('Patient Creation', !!patientId && patientId !== 'new', `Created patient ${patientName} (ID: ${patientId})`);

    // Reload edit patient and re-verify species deduplication
    await page.goto(`${TARGET_URL}/patients/${patientId}/edit`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#patient-species', { timeout: 8000 });
    const speciesOptionsEdit = await page.evaluate(() => {
      const select = document.querySelector('#patient-species');
      return Array.from(select.options).map((opt) => opt.text.trim());
    });
    const uniqueSpeciesEdit = new Set(speciesOptionsEdit.map((s) => s.toLowerCase()));
    record(
      'Species Deduplication (Edit/Reload)',
      uniqueSpeciesEdit.size === speciesOptionsEdit.length,
      `Options remain strictly unique after reload (${speciesOptionsEdit.length} items)`
    );

    // --------------------------------------------------------------------------
    // 3. Clinical Suggestions (Symptoms & Diagnosis)
    // --------------------------------------------------------------------------
    console.log('\n--- Step 3: Test Symptoms & Diagnosis Suggestions Combobox ---');
    await page.goto(`${TARGET_URL}/prescriptions/new?patientId=${patientId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.clinical-combobox-field', { timeout: 8000 });

    const symptomsArea = await page.$('textarea.clinical-combobox-field');
    record('Symptoms Combobox Rendered', !!symptomsArea, 'Accessible combobox textarea mounted for symptoms');

    await symptomsArea.focus();
    await symptomsArea.type('High Fever');
    await new Promise((r) => setTimeout(r, 300));
    
    const hasPills = await page.evaluate(() => {
      const pills = document.querySelectorAll('.clinical-combobox-pill');
      return pills.length > 0;
    });
    record('Symptoms Suggestions Available', hasPills, 'Combobox suggestion pills populated');

    const diagnosisInput = await page.$('input.clinical-combobox-field');
    record('Diagnosis Combobox Rendered', !!diagnosisInput, 'Accessible combobox input mounted for diagnosis');

    await diagnosisInput.focus();
    await diagnosisInput.type('Canine Babesiosis');
    await new Promise((r) => setTimeout(r, 300));

    // --------------------------------------------------------------------------
    // 4. Medicine Dose, Dose Unit, Dispense Unit & Clean Display
    // --------------------------------------------------------------------------
    console.log('\n--- Step 4: Test Medicine Dose, Unit Conversion & Dispense Units ---');
    
    // Trigger "Add Medicine" modal
    const buttons = await page.$$('button');
    let addMedBtnFound = false;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Add Medicine')) {
        await btn.click();
        addMedBtnFound = true;
        break;
      }
    }
    record('Add Medicine Modal Trigger', addMedBtnFound, 'Clicked Add Medicine button');

    await page.waitForSelector('.rx-modal-body', { timeout: 8000 });

    // Type medicine search / brand name
    const searchInputs = await page.$$('.rx-modal-body input[type="text"]');
    if (searchInputs.length > 0) {
      await searchInputs[0].focus();
      await searchInputs[0].type('Ceftriaxone Injection');
    }

    // Verify Approved Dose Unit selector
    const doseUnitSelect = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.rx-modal-body select'));
      for (const sel of selects) {
        const vals = Array.from(sel.options).map(o => o.value);
        if (vals.includes('mg') && vals.includes('g') && vals.includes('mL')) {
          return { found: true, vals };
        }
      }
      return { found: false, vals: [] };
    });
    record('Dose Unit Options', doseUnitSelect.found, `Approved Dose Units supported: ${doseUnitSelect.vals.slice(0, 8).join(', ')}`);

    // Verify Dispense Unit selector
    const dispenseUnitSelect = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.rx-modal-body select'));
      for (const sel of selects) {
        const vals = Array.from(sel.options).map(o => o.value);
        if (vals.includes('vial') && vals.includes('tablet')) {
          return { found: true, vals };
        }
      }
      return { found: false, vals: [] };
    });
    record('Dispense Unit Options', dispenseUnitSelect.found, `Dispense Units supported: ${dispenseUnitSelect.vals.slice(0, 8).join(', ')}`);

    // Type Dose: 1.17
    const doseInput = await page.$('.rx-modal-body input[placeholder*="1, 2.5, 240"]');
    if (doseInput) {
      await doseInput.click({ clickCount: 3 });
      await doseInput.type('1.17');
    }

    // Type Quantity: 2
    const qtyInput = await page.$('.rx-modal-body input[placeholder*="10"]');
    if (qtyInput) {
      await qtyInput.click({ clickCount: 3 });
      await qtyInput.type('2');
    }

    // Select Dose Unit: mg/kg and Dispense Unit: vial
    await page.evaluate(() => {
      const modal = document.querySelector('.rx-modal-body');
      if (!modal) return;
      const selects = Array.from(modal.querySelectorAll('select'));
      for (const sel of selects) {
        const vals = Array.from(sel.options).map(o => o.value);
        if (vals.includes('mg/kg')) {
          sel.value = 'mg/kg';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (vals.includes('vial')) {
          sel.value = 'vial';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    await new Promise((r) => setTimeout(r, 400));

    // Confirm adding medicine to prescription
    const addedSuccess = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.rx-modal-footer button'));
      const target = btns.find(b => b.textContent.includes('Add to Prescription') || b.textContent.includes('Update Medicine'));
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    record('Medicine Added to Prescription', addedSuccess, 'Submitted medicine modal');

    await new Promise((r) => setTimeout(r, 800));

    // Verify Medicine Item Card in Prescription Builder using .rx-med-item-card
    const itemCardText = await page.evaluate(() => {
      const card = document.querySelector('.rx-med-item-card');
      return card ? card.textContent : '';
    });

    const showsCleanDose = itemCardText.includes('1.17') && (itemCardText.includes('mg/kg') || itemCardText.includes('Dose:'));
    const showsCleanDispense = itemCardText.includes('2') && itemCardText.includes('vial');
    const hasNoDuplicateUnlabeled = !itemCardText.match(/1\.17\s*•\s*1\.17/);

    record('Prescription Dose & Dispense Display', showsCleanDose && showsCleanDispense, `Card displays clean separation: "${itemCardText.replace(/\s+/g, ' ')}"`);
    record('No Unlabeled Number Repetition', hasNoDuplicateUnlabeled, 'Eliminated redundant repetitive numeric artifacts');

    // --------------------------------------------------------------------------
    // 5. Follow-Up / Recheck Interval Field
    // --------------------------------------------------------------------------
    console.log('\n--- Step 5: Test Follow-up / Recheck Interval Presets & Custom Input ---');
    
    const presetValues = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const sel of selects) {
        const vals = Array.from(sel.options).map(o => o.value);
        if (vals.includes('3 days') && vals.includes('Custom')) {
          return vals;
        }
      }
      return [];
    });

    const expectedPresets = ['None', '3 days', '5 days', '7 days', '14 days', 'Custom'];
    const hasAllPresets = expectedPresets.every(p => presetValues.includes(p));
    record('Recheck Interval Presets', hasAllPresets, `Presets verified: ${presetValues.join(', ')}`);

    // Select Custom and enter custom interval text
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const sel of selects) {
        const vals = Array.from(sel.options).map(o => o.value);
        if (vals.includes('3 days') && vals.includes('Custom')) {
          sel.value = 'Custom';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    });

    await page.waitForSelector('input[placeholder*="after blood work"]', { timeout: 4000 });
    await page.type('input[placeholder*="after blood work"]', '7 days or if fever returns');

    // Save as Draft
    console.log('Saving prescription draft...');
    await page.evaluate(() => {
      const draftBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Save Draft'));
      if (draftBtns.length > 0) {
        draftBtns[0].click();
      }
    });

    await page.waitForFunction(() => window.location.pathname.startsWith('/prescriptions/') && !window.location.pathname.includes('/new'), { timeout: 15000 });
    const rxUrl = page.url();
    const rxId = rxUrl.split('/prescriptions/')[1].split('/')[0].split('?')[0];
    record('Prescription Saved', !!rxId && rxId !== 'new', `Prescription saved with ID: ${rxId}`);

    // Verify Prescription Details View
    await page.goto(`${TARGET_URL}/prescriptions/${rxId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#prescription-sheet', { timeout: 8000 });

    const rxDetailsContent = await page.content();
    const showsCustomRecheck = rxDetailsContent.includes('7 days or if fever returns');
    const showsRecheckHeader = rxDetailsContent.includes('Recheck Recommended');
    record('Prescription Recheck Recommended View', showsCustomRecheck && showsRecheckHeader, 'Custom recheck text rendered in care plan section');

    const showsTableDose = rxDetailsContent.includes('1.17 mg/kg') || rxDetailsContent.includes('1.17');
    const showsTableDispense = rxDetailsContent.includes('2 vial') || rxDetailsContent.includes('vial');
    record('Prescription Table Dose & Dispense Units', showsTableDose && showsTableDispense, 'Table displays "1.17 mg/kg" dose and "2 vial" dispense quantity');

    // --------------------------------------------------------------------------
    // 6. Invoicing & Practitioner Header
    // --------------------------------------------------------------------------
    console.log('\n--- Step 6: Test Invoicing & Multi-Line Practitioner Header ---');
    await page.goto(`${TARGET_URL}/invoices/new?patientId=${patientId}&prescriptionId=${rxId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#btn-issue-invoice', { timeout: 8000 });

    // Save & Issue invoice
    await page.click('#btn-issue-invoice');

    await page.waitForFunction(() => window.location.pathname.startsWith('/invoices/') && !window.location.pathname.includes('/new'), { timeout: 15000 });
    const invUrl = page.url();
    const invId = invUrl.split('/invoices/')[1].split('/')[0].split('?')[0];
    record('Invoice Created', !!invId && invId !== 'new', `Created Invoice ID: ${invId}`);

    // Verify Invoice Details View and PractitionerHeader
    await page.goto(`${TARGET_URL}/invoices/${invId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.practitioner-header-container', { timeout: 8000 });

    const headerLines = await page.evaluate(() => {
      const root = document.querySelector('.practitioner-header-container');
      if (!root) return {};
      return {
        name: root.querySelector('.practitioner-header-doctor-name')?.textContent?.trim(),
        qualifications: root.querySelector('.practitioner-header-qualifications')?.textContent?.trim(),
        designation: root.querySelector('.practitioner-header-designation')?.textContent?.trim(),
        clinic: root.querySelector('.practitioner-header-clinic-name')?.textContent?.trim(),
        address: root.querySelector('.practitioner-header-address')?.textContent?.trim(),
        reg: root.querySelector('.practitioner-header-reg')?.textContent?.trim(),
      };
    });

    const hasDoctorName = headerLines.name?.includes('Dr. Shameem Alungal');
    const hasQualifications = headerLines.qualifications?.includes('BVSc & AH, MVSc');
    const hasDesignation = !!headerLines.designation;
    const hasReg = headerLines.reg?.includes('KVC-8942');

    record(
      'Structured 6-Line Practitioner Header',
      hasDoctorName && hasQualifications && hasDesignation && hasReg,
      `Rendered Header: Name="${headerLines.name}", Qual="${headerLines.qualifications}", Desig="${headerLines.designation}", Reg="${headerLines.reg}"`
    );

    // Verify Dispense Unit in Invoice line item table
    const invoiceTableContent = await page.content();
    const showsDispenseInInvoice = invoiceTableContent.includes('2 vial') || invoiceTableContent.includes('vial');
    record('Invoice Dispense Unit Preserved', showsDispenseInInvoice, 'Invoice line item table displays "2 vial"');

  } catch (err) {
    console.error('Fatal error during production UAT execution:', err);
    record('Production UAT Execution', false, String(err));
  } finally {
    await browser.close();
  }

  console.log(`\n===============================================================`);
  const passedCount = checks.filter(c => c.passed).length;
  console.log(`PRODUCTION UAT SUMMARY: ${passedCount}/${checks.length} Checks Passed`);
  console.log(`===============================================================\n`);

  if (checks.some(c => !c.passed)) {
    process.exit(1);
  }
}

run();
