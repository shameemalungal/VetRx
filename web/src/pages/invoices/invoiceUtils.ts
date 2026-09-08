// =============================================================
// VetRx — Invoice Utilities & Helpers
// =============================================================

import { db } from '../../db/schema';

/**
 * Format integer paisa to INR formatted string, e.g. 25000 -> "₹250.00"
 */
export function formatINR(paisa: number): string {
  const rupees = (paisa || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Convert integer paisa to Indian Rupee Words
 * e.g. 155000 -> "Indian Rupees One Thousand Five Hundred and Fifty Only"
 */
export function numberToWordsINR(paisa: number): string {
  const totalRupees = Math.floor((paisa || 0) / 100);
  if (totalRupees === 0) return 'Indian Rupees Zero Only';

  const singleDigits = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  ];
  const twoDigits = [
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tensMultiple = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
  ];

  function convertTwoDigits(n: number): string {
    if (n < 10) return singleDigits[n];
    if (n >= 10 && n < 20) return twoDigits[n - 10];
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return `${tensMultiple[tens]}${ones > 0 ? ' ' + singleDigits[ones] : ''}`.trim();
  }

  function convertThreeDigits(n: number): string {
    const hundreds = Math.floor(n / 100);
    const rem = n % 100;
    let res = '';
    if (hundreds > 0) {
      res += `${singleDigits[hundreds]} Hundred`;
    }
    if (rem > 0) {
      res += `${res ? ' and ' : ''}${convertTwoDigits(rem)}`;
    }
    return res.trim();
  }

  // Indian Numbering System: Crores, Lakhs, Thousands, Hundreds
  let rem = totalRupees;
  const crore = Math.floor(rem / 10000000);
  rem %= 10000000;
  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  const thousand = Math.floor(rem / 1000);
  rem %= 1000;
  const hundreds = rem;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${convertTwoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${convertTwoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${convertTwoDigits(thousand)} Thousand`);
  if (hundreds > 0) parts.push(convertThreeDigits(hundreds));

  return `Indian Rupees ${parts.join(' ')} Only`.replace(/\s+/g, ' ');
}

/**
 * Generate next invoice number, e.g. INV-2026-00001
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await db.invoices.count();
  const nextSeq = count + 1;
  const padded = String(nextSeq).padStart(5, '0');
  return `INV-${currentYear}-${padded}`;
}

/**
 * Ensure sample invoices exist if store is empty so the screen matches Stitch mockup
 */
export async function ensureSampleInvoicesSeeded(): Promise<void> {
  const count = await db.invoices.count();
  if (count > 0) return;

  const patients = await db.patients.toArray();
  const patient = patients[0];
  const patientId = patient?.id || 1;
  const ownerId = patient?.ownerId || 1;
  const prac = await db.practitioners.toCollection().first();
  const practitionerId = prac?.id || 1;

  const now = new Date();

  // Invoice 1: Issued with Certificate Issuance & Consultation
  const inv1Id = (await db.invoices.add({
    invoiceNumber: 'INV-2026-00124',
    patientId,
    ownerId,
    practitionerId,
    invoiceDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 155000, // ₹1,550
    status: 'Issued',
    issuedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
  })) as number;

  await db.invoiceItems.bulkAdd([
    {
      invoiceId: inv1Id,
      category: 'Other',
      description: 'Certificate Issuance (Health Certificate)',
      quantity: 1,
      unitPricePaisa: 25000,
      discountPct: 0,
      taxPct: 0,
      subtotalPaisa: 25000,
      discountAmtPaisa: 0,
      taxAmtPaisa: 0,
      lineTotalPaisa: 25000,
      sortOrder: 1,
      unit: 'Per certificate',
      isGovPrescribed: true,
      govOrderNumber: 'G.O.(Rt) No.589/2023/AHD',
      govOrderDate: '13-12-2023',
      govOrderNote: 'As per the rate fixed by G.O.(Rt) No.589/2023/AHD dated 13-12-2023.',
      rateControlled: true,
    },
    {
      invoiceId: inv1Id,
      category: 'Consultation Fee',
      description: 'Clinical Consultation & Otoscopic Exam',
      quantity: 1,
      unitPricePaisa: 50000,
      discountPct: 0,
      taxPct: 0,
      subtotalPaisa: 50000,
      discountAmtPaisa: 0,
      taxAmtPaisa: 0,
      lineTotalPaisa: 50000,
      sortOrder: 2,
      unit: 'Per visit',
    },
    {
      invoiceId: inv1Id,
      category: 'Medicine',
      description: 'Posatex Otic Drops 15 ml',
      quantity: 1,
      unitPricePaisa: 80000,
      discountPct: 0,
      taxPct: 0,
      subtotalPaisa: 80000,
      discountAmtPaisa: 0,
      taxAmtPaisa: 0,
      lineTotalPaisa: 80000,
      sortOrder: 3,
      unit: '1 btl',
    },
  ]);

  // Invoice 2: Draft with Necropsy Report
  const inv2Id = (await db.invoices.add({
    invoiceNumber: 'INV-2026-00125',
    patientId,
    ownerId,
    practitionerId,
    invoiceDate: now,
    discountTotal: 10000, // ₹100 discount
    taxTotal: 0,
    grandTotal: 140000, // ₹1,400 (₹1,000 necropsy + ₹500 consult - ₹100 discount)
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
  })) as number;

  await db.invoiceItems.bulkAdd([
    {
      invoiceId: inv2Id,
      category: 'Other',
      description: 'Necropsy Report (Post-Mortem Examination)',
      quantity: 1,
      unitPricePaisa: 100000,
      discountPct: 0,
      taxPct: 0,
      subtotalPaisa: 100000,
      discountAmtPaisa: 0,
      taxAmtPaisa: 0,
      lineTotalPaisa: 100000,
      sortOrder: 1,
      unit: 'Per report',
      isGovPrescribed: true,
      govOrderNumber: 'G.O.(Rt) No.589/2023/AHD',
      govOrderDate: '13-12-2023',
      govOrderNote: 'As per the rate fixed by G.O.(Rt) No.589/2023/AHD dated 13-12-2023.',
      rateControlled: true,
    },
    {
      invoiceId: inv2Id,
      category: 'Consultation Fee',
      description: 'Comprehensive Clinical Consultation',
      quantity: 1,
      unitPricePaisa: 50000,
      discountPct: 0,
      taxPct: 0,
      subtotalPaisa: 50000,
      discountAmtPaisa: 0,
      taxAmtPaisa: 0,
      lineTotalPaisa: 50000,
      sortOrder: 2,
      unit: 'Per visit',
    },
  ]);
}
