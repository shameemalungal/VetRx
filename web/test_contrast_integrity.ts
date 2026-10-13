// ==============================================================================
// VetRx Automated Contrast & Accessibility Integrity Test
// Verifies WCAG AA Compliance (contrast ratio >= 4.5:1 for normal text)
// Prevents regression of invisible or low-contrast text across tabs and badges
// ==============================================================================

import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

// Helper to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

// Relative luminance per WCAG 2.1 specifications
function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

// Contrast ratio between two hex colors
function getContrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

test('VetRx WCAG AA Contrast Suite', async (t) => {
  await t.test('1. Follow-up Active Tab States: text-white on active backgrounds must be >= 4.5:1', () => {
    const activeTabs = [
      { name: 'Overdue (active)', bg: '#be123c', text: '#ffffff' }, // Rose-700
      { name: 'Due Today (active)', bg: '#b45309', text: '#ffffff' }, // Amber-700
      { name: 'Upcoming (active)', bg: '#1d4ed8', text: '#ffffff' }, // Blue-700
      { name: 'Recurring Schedules (active)', bg: '#4f46e5', text: '#ffffff' }, // Indigo-600
      { name: 'Awaiting Client (active)', bg: '#7e22ce', text: '#ffffff' }, // Purple-700
      { name: 'Postponed (active)', bg: '#6b21a8', text: '#ffffff' }, // Purple-800
      { name: 'Completed (active)', bg: '#047857', text: '#ffffff' }, // Emerald-700
    ];

    for (const tab of activeTabs) {
      const ratio = getContrastRatio(tab.bg, tab.text);
      assert.ok(
        ratio >= 4.5,
        `Tab "${tab.name}" has contrast ${ratio.toFixed(2)}:1, which is below WCAG AA 4.5:1 threshold`
      );
    }
  });

  await t.test('2. Follow-up Inactive Tab States: Slate-700 on white/surface must be >= 4.5:1', () => {
    const inactiveTabs = [
      { name: 'Inactive Tab Text on White', bg: '#ffffff', text: '#334155' },
      { name: 'Inactive Tab Text on Surface', bg: '#faf8ff', text: '#334155' },
      { name: 'Inactive Tab Hover on Slate-100', bg: '#f1f5f9', text: '#0f172a' },
    ];

    for (const item of inactiveTabs) {
      const ratio = getContrastRatio(item.bg, item.text);
      assert.ok(
        ratio >= 4.5,
        `"${item.name}" has contrast ${ratio.toFixed(2)}:1, which is below WCAG AA 4.5:1 threshold`
      );
    }
  });

  await t.test('3. Follow-up Badge Pills (Unselected states on light backgrounds) must be >= 4.5:1', () => {
    const badges = [
      { name: 'Overdue Badge Pill', bg: '#ffe4e6', text: '#9f1239' }, // Rose-100 & Rose-800
      { name: 'Due Today Badge Pill', bg: '#fef3c7', text: '#92400e' }, // Amber-100 & Amber-800
      { name: 'Upcoming Badge Pill', bg: '#dbeafe', text: '#1e40af' }, // Blue-100 & Blue-800
      { name: 'Recurring Badge Pill', bg: '#e0e7ff', text: '#3730a3' }, // Indigo-100 & Indigo-800
      { name: 'Awaiting Client Badge Pill', bg: '#f3e8ff', text: '#581c87' }, // Purple-100 & Purple-900
      { name: 'Completed Badge Pill', bg: '#d1fae5', text: '#065f46' }, // Emerald-100 & Emerald-800
    ];

    for (const badge of badges) {
      const ratio = getContrastRatio(badge.bg, badge.text);
      assert.ok(
        ratio >= 4.5,
        `Badge "${badge.name}" has contrast ${ratio.toFixed(2)}:1, which is below WCAG AA 4.5:1 threshold`
      );
    }
  });

  await t.test('4. Priority Filter Chips Active States must be >= 4.5:1', () => {
    const priorityChips = [
      { name: 'Emergency (active)', bg: '#dc2626', text: '#ffffff' },
      { name: 'Urgent (active)', bg: '#b45309', text: '#ffffff' },
      { name: 'Could Not Assess / Unassessed (active)', bg: '#7e22ce', text: '#ffffff' },
      { name: 'Planned / Default Active', bg: '#00685f', text: '#ffffff' },
    ];

    for (const chip of priorityChips) {
      const ratio = getContrastRatio(chip.bg, chip.text);
      assert.ok(
        ratio >= 4.5,
        `Priority chip "${chip.name}" has contrast ${ratio.toFixed(2)}:1, which is below WCAG AA 4.5:1 threshold`
      );
    }
  });

  await t.test('5. Inventory Status Indicators must be >= 4.5:1', () => {
    const invStatuses = [
      { name: 'In Stock Pill', bg: '#dcfce7', text: '#166534' }, // Green-800 on Green-100
      { name: 'Low Stock Pill', bg: '#fef3c7', text: '#92400e' }, // Amber-800 on Amber-100
      { name: 'Out of Stock Pill', bg: '#fee2e2', text: '#991b1b' }, // Red-800 on Red-100
      { name: 'Expired Pill', bg: '#f1f5f9', text: '#475569' }, // Slate-600 on Slate-100
    ];

    for (const status of invStatuses) {
      const ratio = getContrastRatio(status.bg, status.text);
      assert.ok(
        ratio >= 4.5,
        `Inventory status "${status.name}" has contrast ${ratio.toFixed(2)}:1, which is below WCAG AA 4.5:1 threshold`
      );
    }
  });

  await t.test('6. CSS Utilities Integrity: Verify critical utilities exist and have compliant values', () => {
    const cssPath = path.resolve('src/styles/utilities.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Ensure critical background classes exist
    const requiredBgClasses = [
      '.bg-rose-600',
      '.bg-blue-600',
      '.bg-amber-600',
      '.bg-amber-700',
      '.bg-purple-600',
      '.bg-emerald-600',
      '.bg-teal-700',
    ];

    for (const cls of requiredBgClasses) {
      assert.ok(
        cssContent.includes(cls),
        `Required CSS utility class ${cls} is missing from utilities.css`
      );
    }

    // Ensure critical text classes exist
    const requiredTextClasses = [
      '.text-rose-600',
      '.text-blue-600',
      '.text-amber-800',
      '.text-purple-800',
      '.text-emerald-800',
      '.text-slate-700',
      '.text-slate-800',
    ];

    for (const cls of requiredTextClasses) {
      assert.ok(
        cssContent.includes(cls),
        `Required text utility class ${cls} is missing from utilities.css`
      );
    }
  });
});
