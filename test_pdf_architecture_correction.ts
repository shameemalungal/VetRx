import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { formatInvoiceItemDescription } from './web/src/utils/documentFormat.ts';
import { formatAnimalSubtitle } from './web/src/utils/patientFormat.ts';

describe('VetRx PDF Architecture Final Verification', () => {
  it('strips directions cleanly from invoice item descriptions', () => {
    const raw1 = 'Cephalexin 500mg Tablet (Give after food with drinking water. Complete full course.)';
    const clean1 = formatInvoiceItemDescription(raw1);
    assert.strictEqual(clean1, 'Cephalexin 500mg Tablet');
    assert.ok(!clean1.includes('Give after food'));

    const raw2 = 'Meloxicam 5mg/mL Injection — Sig: 2 mL SC once daily for 3 days';
    const clean2 = formatInvoiceItemDescription(raw2);
    assert.strictEqual(clean2, 'Meloxicam 5mg/mL Injection');
    assert.ok(!clean2.includes('Sig:'));

    const raw3 = 'Atropine Sulphate 0.6mg/mL (Directions: Administer IV slowly)';
    const clean3 = formatInvoiceItemDescription(raw3);
    assert.strictEqual(clean3, 'Atropine Sulphate 0.6mg/mL');
  });

  it('preserves clean commercial item descriptions that do not contain directions', () => {
    const raw = 'General Consultation & Health Check';
    assert.strictEqual(formatInvoiceItemDescription(raw), 'General Consultation & Health Check');

    const rawProc = 'Wound Debridement & Dressing';
    assert.strictEqual(formatInvoiceItemDescription(rawProc), 'Wound Debridement & Dressing');
  });

  it('prevents duplicate weight display when dedicated weight field is rendered', () => {
    const patient = {
      species: 'Bovine',
      breed: 'HF Cross',
      sex: 'Female',
      weightKg: 250,
    };

    const subtitleWithoutWeight = formatAnimalSubtitle(patient as any, { includeWeight: false });
    assert.strictEqual(subtitleWithoutWeight, 'Bovine • HF Cross • Female');
    assert.ok(!subtitleWithoutWeight.includes('250'));
    assert.ok(!subtitleWithoutWeight.includes('kg'));

    const subtitleWithWeight = formatAnimalSubtitle(patient as any, { includeWeight: true });
    assert.strictEqual(subtitleWithWeight, 'Bovine • HF Cross • Female • 250 kg');
  });

  it('verifies PrescriptionDocument retains Sig directions', () => {
    const docPath = path.resolve('web/src/components/documents/PrescriptionDocument.tsx');
    const code = fs.readFileSync(docPath, 'utf8');
    assert.ok(code.includes('Sig:'), 'PrescriptionDocument must render Sig: for medicines');
    assert.ok(code.includes('formatAnimalSubtitle(patient, { includeWeight: false })'), 'PrescriptionDocument must not duplicate weight in subtitle');
  });

  it('verifies InvoiceDocument and ReceiptDocument use formatInvoiceItemDescription', () => {
    const invPath = path.resolve('web/src/components/documents/InvoiceDocument.tsx');
    const invCode = fs.readFileSync(invPath, 'utf8');
    assert.ok(invCode.includes('formatInvoiceItemDescription(it.description)'), 'InvoiceDocument must format item description without directions');
    assert.ok(!invCode.includes('Sig:'), 'InvoiceDocument must NOT render Sig: directions');
    assert.ok(invCode.includes('formatAnimalSubtitle(patient, { includeWeight: false })'), 'InvoiceDocument must not duplicate weight in subtitle');

    const recPath = path.resolve('web/src/components/documents/ReceiptDocument.tsx');
    const recCode = fs.readFileSync(recPath, 'utf8');
    assert.ok(recCode.includes('formatInvoiceItemDescription(it.description)'), 'ReceiptDocument must format item description without directions');
    assert.ok(!recCode.includes('Sig:'), 'ReceiptDocument must NOT render Sig: directions');
    assert.ok(recCode.includes('formatAnimalSubtitle(patient, { includeWeight: false })'), 'ReceiptDocument must not duplicate weight in subtitle');
  });

  it('verifies DocumentStyles.css eliminates outer card border and enforces compact print layout', () => {
    const cssPath = path.resolve('web/src/components/documents/DocumentStyles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.ok(css.includes('.vetrx-document'), 'DocumentStyles.css contains .vetrx-document root class');
    assert.ok(css.includes('border: none !important'), 'Print rules remove borders');
    assert.ok(css.includes('break-inside: avoid'), 'Tables and signatures avoid page breaks');
  });

  it('verifies Desktop sidebar scroll isolation in base.css and AppShell.css', () => {
    const baseCss = fs.readFileSync(path.resolve('web/src/styles/base.css'), 'utf8');
    assert.ok(baseCss.includes('overflow: hidden;'), 'Desktop base.css locks html, body, #root overflow');
    assert.ok(baseCss.includes('height: 100dvh;'), 'Desktop base.css locks 100dvh');

    const appShellCss = fs.readFileSync(path.resolve('web/src/components/layout/AppShell.css'), 'utf8');
    assert.ok(appShellCss.includes('position: sticky'), 'Sidebar is sticky or fixed');
    assert.ok(appShellCss.includes('overflow-y: auto'), 'Main workspace handles vertical scroll independently');
  });
});
