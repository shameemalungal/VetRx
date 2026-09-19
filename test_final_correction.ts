import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatAnimalSubtitle } from './web/src/utils/patientFormat.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('VetRx Final Controlled Correction Verification Suite', () => {
  it('Animal weight appears only once in animal subtitle when includeWeight is false', () => {
    const patientWithoutName = {
      name: '',
      species: 'Bovine',
      breed: 'HF',
      sex: 'Female',
      weightKg: 250,
      ageNote: '6yrs 5 months'
    };

    const subtitleWithoutWeight = formatAnimalSubtitle(patientWithoutName, { includeWeight: false });
    assert.strictEqual(subtitleWithoutWeight.includes('250 kg'), false, 'Subtitle should NOT include weight when includeWeight: false');
    assert.ok(subtitleWithoutWeight.includes('Bovine'), 'Subtitle should include species');
    assert.ok(subtitleWithoutWeight.includes('HF'), 'Subtitle should include breed');
    assert.ok(subtitleWithoutWeight.includes('Female'), 'Subtitle should include sex');

    const subtitleWithWeight = formatAnimalSubtitle(patientWithoutName, { includeWeight: true });
    assert.strictEqual(subtitleWithWeight.includes('250 kg'), true, 'Default subtitle still includes weight when requested');
  });

  it('AppShell.css pins sidebar on desktop and separates scroll to main', () => {
    const cssPath = path.resolve('web/src/components/Layout/AppShell.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    assert.ok(css.includes('height: 100dvh;'), 'Should set 100dvh on desktop container');
    assert.ok(css.includes('overflow-y: auto;'), 'Should set overflow-y: auto on .app-main');
    assert.ok(css.includes('overflow: hidden;'), 'Should lock .app-shell and .sidebar against window scroll');
    assert.ok(css.includes('@media print'), 'Should include print resets for app-shell');
  });

  it('Prescriptions.css preserves 2-column layouts and avoids media query collapse', () => {
    const cssPath = path.resolve('web/src/pages/prescriptions/Prescriptions.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Check media query scoping
    assert.ok(css.includes('@media screen and (max-width: 768px)'), 'Mobile rules must be scoped to screen to prevent print collapse');
    
    // Check authoritative @media print section
    assert.ok(css.includes('.stationery-signalment-grid'), 'Must define stationery-signalment-grid in print');
    assert.ok(css.includes('grid-template-columns: 1fr 1fr !important'), 'Signalment grid must be 2 columns');
    assert.ok(css.includes('.stationery-findings-box'), 'Must define stationery-findings-box in print');
    assert.ok(css.includes('.stationery-advice-grid'), 'Must define stationery-advice-grid in print');
    assert.ok(css.includes('grid-template-columns: 1.2fr 1fr !important'), 'Advice grid must be 2 columns');

    // Indivisible signature block
    assert.ok(css.includes('.stationery-signoff-row'), 'Must style signature row in print');
    assert.ok(css.includes('justify-content: flex-end !important'), 'Signature block must be right aligned');
    assert.ok(css.includes('page-break-inside: avoid !important'), 'Signature block must avoid page break');
    assert.ok(css.includes('break-inside: avoid !important'), 'Signature block must have break-inside avoid');
  });

  it('pdfGenerator.ts contains expanded single page tolerance and avoid-boxes', () => {
    const tsPath = path.resolve('web/src/utils/pdfGenerator.ts');
    const code = fs.readFileSync(tsPath, 'utf8');

    assert.ok(code.includes('totalHeightMm <= contentHeightMm + 8'), 'pdfGenerator has 8mm tolerance to ensure 1-to-6 medicines fit 1 page');
    assert.ok(code.includes('.signature-block'), 'pdfGenerator includes .signature-block in atomicSelectors');
    assert.ok(code.includes('.stationery-advice-grid'), 'pdfGenerator includes .stationery-advice-grid in atomicSelectors');
  });
});
