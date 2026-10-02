import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = path.resolve('artifacts/debug_badges');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1200 });

  const html2canvasJs = fs.readFileSync('web/node_modules/html2canvas/dist/html2canvas.js', 'utf8');

  // Let's create an HTML test page with various styling approaches for badges, ribbons, findings, sig box
  const testHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 40px;
        background: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
      }
      .card {
        background: #ffffff;
        padding: 24px;
        width: 794px;
        box-sizing: border-box;
        margin-bottom: 30px;
      }

      /* ================= CURRENT CSS ================= */
      .current .practitioner-header-reg-chip {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        background: #f1f5f9;
        color: #334155;
        padding: 2px 7px 3px 7px;
        border-radius: 4px;
        margin-top: 2px;
        width: fit-content;
        line-height: 1.15;
        vertical-align: middle;
        white-space: nowrap;
        box-sizing: border-box;
      }
      .current .prescription-ribbon {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 4px 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        margin-bottom: 6px;
      }
      .current .prescription-ribbon-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: 0.02em;
      }
      .current .prescription-ribbon-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 11.5px;
        color: #475569;
      }
      .current .stationery-findings-box {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 7px 10px 10px 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        margin-bottom: 6px;
        box-sizing: border-box;
      }
      .current .stationery-sig-box {
        background: #eff6ff;
        border: 1px solid #dbeafe;
        border-radius: 4px;
        padding: 4px 8px 5px 8px;
        font-size: 10px;
        line-height: 1.35;
        margin-top: 3px;
        display: block;
        color: #1e40af;
        box-sizing: border-box;
      }
      .current .dose-badge {
        background: #ecfdf5;
        color: #065f46;
        font-weight: 700;
        font-size: 10px;
        padding: 2px 7px 3px 7px;
        border-radius: 4px;
        display: inline-block;
        line-height: 1.15;
        vertical-align: middle;
        white-space: nowrap;
        box-sizing: border-box;
      }
      .current .route-badge {
        background: #f1f5f9;
        color: #334155;
        font-size: 10px;
        padding: 2px 7px 3px 7px;
        border-radius: 4px;
        display: inline-block;
        line-height: 1.15;
        vertical-align: middle;
        white-space: nowrap;
        box-sizing: border-box;
      }

      /* ================= TEST FIX A (Flex centering + balanced padding + explicit line-height) ================= */
      .fix-a .practitioner-header-reg-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        background: #f1f5f9;
        color: #334155;
        padding: 4px 8px;
        border-radius: 4px;
        margin-top: 2px;
        line-height: 1.2;
        box-sizing: border-box;
        vertical-align: middle;
      }
      .fix-a .prescription-ribbon {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        margin-bottom: 6px;
        min-height: 36px;
        box-sizing: border-box;
      }
      .fix-a .prescription-ribbon-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: 0.02em;
        line-height: 1.2;
      }
      .fix-a .prescription-ribbon-meta {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-size: 11.5px;
        color: #475569;
        line-height: 1.2;
      }
      .fix-a .stationery-findings-box {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 10px 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        margin-bottom: 6px;
        box-sizing: border-box;
      }
      .fix-a .stationery-findings-item {
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .fix-a .stationery-sig-box {
        background: #eff6ff;
        border: 1px solid #dbeafe;
        border-radius: 4px;
        padding: 6px 10px;
        font-size: 10.5px;
        line-height: 1.4;
        margin-top: 4px;
        display: block;
        color: #1e40af;
        box-sizing: border-box;
      }
      .fix-a .dose-badge {
        background: #ecfdf5;
        color: #065f46;
        font-weight: 700;
        font-size: 10px;
        padding: 4px 8px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1.2;
        box-sizing: border-box;
        text-align: center;
      }
      .fix-a .route-badge {
        background: #f1f5f9;
        color: #334155;
        font-size: 10px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 1.2;
        box-sizing: border-box;
        text-align: center;
      }

      /* Common styles */
      .box-label {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748b;
        letter-spacing: 0.04em;
        margin-bottom: 3px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
    </style>
  </head>
  <body>
    <!-- CURRENT -->
    <div class="card current" id="card-current">
      <h2>1. Current Implementation</h2>
      <div style="margin-bottom: 12px;">
        <div class="practitioner-header-reg-chip">Reg. No.: KSVC-2222</div>
      </div>
      <div class="prescription-ribbon">
        <div class="prescription-ribbon-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00685f" stroke-width="2"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
          <span>VETERINARY PRESCRIPTION</span>
        </div>
        <div class="prescription-ribbon-meta">
          <span>Date: <strong>19/09/2026</strong></span>
          <span>Rx No: <strong>RX-2026-0001</strong></span>
        </div>
      </div>
      <div class="stationery-findings-box">
        <div>
          <span class="box-label">Clinical Presentation</span>
          <p style="font-size: 11.5px; margin: 0;">Pyrexia / Fever</p>
        </div>
        <div>
          <span class="box-label">Confirmed Diagnosis</span>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 1px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
            <p style="font-size: 13px; font-weight: 700; margin: 0;">E fever</p>
          </div>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; width: 45%;">
            <strong>Meloxicam Bolus</strong>
            <div class="stationery-sig-box">
              <strong style="color: #1d4ed8;">Sig:</strong> Give after food
            </div>
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span class="dose-badge">1 bolus/boli</span>
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span class="route-badge">PO (Oral)</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- FIX A -->
    <div class="card fix-a" id="card-fix-a">
      <h2>2. Proposed Fix A (Flex centering + balanced padding + explicit line-height)</h2>
      <div style="margin-bottom: 12px;">
        <div class="practitioner-header-reg-chip">Reg. No.: KSVC-2222</div>
      </div>
      <div class="prescription-ribbon">
        <div class="prescription-ribbon-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00685f" stroke-width="2"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
          <span>VETERINARY PRESCRIPTION</span>
        </div>
        <div class="prescription-ribbon-meta">
          <span>Date: <strong>19/09/2026</strong></span>
          <span>Rx No: <strong>RX-2026-0001</strong></span>
        </div>
      </div>
      <div class="stationery-findings-box">
        <div class="stationery-findings-item">
          <span class="box-label">Clinical Presentation</span>
          <p style="font-size: 11.5px; margin: 0; line-height: 1.3;">Pyrexia / Fever</p>
        </div>
        <div class="stationery-findings-item">
          <span class="box-label">Confirmed Diagnosis</span>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
            <p style="font-size: 13px; font-weight: 700; margin: 0; line-height: 1.3;">E fever</p>
          </div>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; width: 45%;">
            <strong>Meloxicam Bolus</strong>
            <div class="stationery-sig-box">
              <strong style="color: #1d4ed8;">Sig:</strong> Give after food
            </div>
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span class="dose-badge">1 bolus/boli</span>
          </td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
            <span class="route-badge">PO (Oral)</span>
          </td>
        </tr>
      </table>
    </div>
  </body>
  </html>
  `;

  await page.setContent(testHtml, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(OUT_DIR, '01_dom_comparison.png'), fullPage: true });

  await page.addScriptTag({ content: html2canvasJs });

  const h2cCurrentData = await page.evaluate(async () => {
    const el = document.getElementById('card-current');
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    return canvas.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT_DIR, '02_h2c_current.png'), Buffer.from(h2cCurrentData.replace(/^data:image\/png;base64,/, ''), 'base64'));

  const h2cFixAData = await page.evaluate(async () => {
    const el = document.getElementById('card-fix-a');
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    return canvas.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT_DIR, '03_h2c_fix_a.png'), Buffer.from(h2cFixAData.replace(/^data:image\/png;base64,/, ''), 'base64'));

  console.log('Saved debug badge screenshots.');
  await browser.close();
}

main().catch(console.error);
