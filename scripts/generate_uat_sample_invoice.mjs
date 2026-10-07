import fs from 'node:fs';
import path from 'node:path';
import { launchReliableBrowser } from './browser_env.mjs';
import { PaymentService } from '../server/dist/commercial/payment.service.js';

async function main() {
  console.log('Generating safe UAT sample invoice / payment receipt...');

  const uatDir = path.resolve('uat');
  if (!fs.existsSync(uatDir)) {
    fs.mkdirSync(uatDir, { recursive: true });
  }

  // Load VetRx Stitch Logo as Base64 for guaranteed self-contained offline rendering
  const logoPath = path.resolve('web/public/vetrx_logo_horizontal.png');
  let logoBase64 = '';
  if (fs.existsSync(logoPath)) {
    logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    console.log(`[OK] Embedded VetRx Stitch logo from ${logoPath} (${fs.statSync(logoPath).size} bytes)`);
  } else {
    console.warn(`[WARN] Logo not found at ${logoPath}`);
  }

  // Authoritative Realistic UAT Sample Data for Clinic Tier
  const sampleReceiptData = {
    receiptNumber: 'REC-VRX-2026-UAT001',
    paidAt: '2026-10-01T10:30:00.000Z',
    paymentId: 'pay_uat_clinic_20261001',
    internalReference: 'TXN-SAMPLE-UAT-CLINIC-2026-001',
    gatewayTransactionId: 'PAYU-SAMPLE-987654321',
    practiceName: 'VetRx UAT Clinic',
    customerName: 'Dr. UAT Test Owner',
    billingEmail: 'uat.doctor@vetrx.in',
    billingPhone: '+91 98765 43210',
    planName: 'Clinic (Monthly)',
    billingInterval: 'Monthly',
    subscriptionPeriod: '01 Oct 2026 – 01 Nov 2026',
    amountPaisa: 149900,
    amountRupees: '1,499.00',
    currency: 'INR',
    paymentMethod: 'UPI / Net Banking (PayU)',
    status: 'PAID',
    entityName: 'Alungal Shameem, operator of VetRx',
    entityAddress: 'Nasheman, Chemmaniyode PO, Malappuram DT, Kerala - 679325, India',
    taxNotice: 'Applicable taxes, if any, will be reflected in the applicable invoice.',
    logoBase64,
  };

  // Generate HTML using the actual production PaymentService receipt renderer
  const htmlContent = PaymentService.generateReceiptHtml(sampleReceiptData);

  const htmlPath = path.join(uatDir, 'sample-successful-payment-receipt.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  const htmlSize = fs.statSync(htmlPath).size;
  console.log(`[OK] Generated HTML receipt: ${htmlPath} (${htmlSize} bytes)`);

  // Render to PDF using Playwright with local system Chromium/Edge
  const pdfPath = path.join(uatDir, 'sample-successful-payment-receipt.pdf');
  const { browser, config } = await launchReliableBrowser({ headless: true });
  console.log(`[OK] Launched browser for PDF rendering: ${config.name} (${config.version})`);

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm',
      },
    });
  } finally {
    await browser.close();
  }

  const pdfSize = fs.statSync(pdfPath).size;
  console.log(`[OK] Generated PDF receipt: ${pdfPath} (${pdfSize} bytes)`);

  console.log('\n--- UAT RECEIPT SUMMARY ---');
  console.log(`HTML Path:    ${htmlPath}`);
  console.log(`HTML Size:    ${htmlSize} bytes`);
  console.log(`PDF Path:     ${pdfPath}`);
  console.log(`PDF Size:     ${pdfSize} bytes`);
  console.log(`Receipt Ref:  ${sampleReceiptData.receiptNumber}`);
  console.log(`Practice:     ${sampleReceiptData.practiceName}`);
  console.log(`Entity:       ${sampleReceiptData.entityName}`);
  console.log(`Amount:       ₹${sampleReceiptData.amountRupees} (149,900 paise)`);
  console.log(`DB Pollution: None (Safe isolated rendering without database write)`);
}

main().catch((err) => {
  console.error('Fatal error generating sample receipt:', err);
  process.exit(1);
});
