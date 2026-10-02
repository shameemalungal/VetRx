import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = path.resolve('artifacts/test_centering');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1600 });

  const html2canvasJs = fs.readFileSync('web/node_modules/html2canvas/dist/html2canvas.js', 'utf8');

  const testHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        margin: 40px;
        background: #f1f5f9;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
      }
      .container {
        background: #ffffff;
        padding: 20px;
        width: 760px;
        box-sizing: border-box;
        margin-bottom: 40px;
        border: 1px solid #cbd5e1;
      }

      /* ================= OPTION 1: DISPLAY FLEX / INLINE-FLEX WITH VERTICAL PADDING ================= */
      .opt1 .reg-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #f1f5f9;
        color: #334155;
        font-size: 10px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 4px;
        line-height: 1.25;
        box-sizing: border-box;
      }
      .opt1 .ribbon {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 6px 12px;
        box-sizing: border-box;
      }
      .opt1 .ribbon-title {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: 0.02em;
        line-height: 1.25;
      }
      .opt1 .ribbon-meta {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-size: 11.5px;
        color: #475569;
        line-height: 1.25;
      }
      .opt1 .findings-box {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 8px 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        box-sizing: border-box;
      }
      .opt1 .findings-item {
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .opt1 .findings-title {
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748b;
        letter-spacing: 0.04em;
        margin-bottom: 3px;
      }
      .opt1 .findings-diag-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .opt1 .findings-diag-text {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.25;
        margin: 0;
      }
      .opt1 .sig-box {
        background: #eff6ff;
        border: 1px solid #dbeafe;
        border-radius: 4px;
        padding: 5px 8px;
        font-size: 10px;
        line-height: 1.35;
        color: #1e40af;
        box-sizing: border-box;
        display: inline-block;
        width: 100%;
      }
      .opt1 .dose-badge {
        background: #ecfdf5;
        color: #065f46;
        font-weight: 700;
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.25;
        box-sizing: border-box;
        max-width: 110px;
      }
      .opt1 .route-badge {
        background: #f1f5f9;
        color: #334155;
        font-size: 10px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        line-height: 1.25;
        box-sizing: border-box;
        max-width: 110px;
      }

      /* Card box label & sub-text */
      .opt1 .card-box {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 12px;
        box-sizing: border-box;
      }
      .opt1 .card-subtext {
        font-size: 11px;
        color: #475569;
        margin: 2px 0 0 0;
        line-height: 1.25;
      }
    </style>
  </head>
  <body>
    <div class="container opt1" id="test-container">
      <h2>Option 1: Flex Centering + Standard 1.25 Line-Height + Balanced Padding</h2>
      
      <!-- 1. Reg Chip -->
      <div style="margin-bottom: 12px;">
        <span class="reg-chip">Reg. No.: KSVC-2222</span>
      </div>

      <!-- 2. Ribbon -->
      <div class="ribbon" style="margin-bottom: 12px;">
        <div class="ribbon-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00685f" stroke-width="2"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
          <span>VETERINARY PRESCRIPTION</span>
        </div>
        <div class="ribbon-meta">
          <span>Date: <strong>19/09/2026</strong></span>
          <span>Rx No: <strong>RX-2026-0001</strong></span>
        </div>
      </div>

      <!-- 3. Animal Details Card -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <div class="card-box">
          <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Owner Details</div>
          <div style="font-size: 13.5px; font-weight: 700;">dljfndkfjnlk</div>
          <div class="card-subtext">Ph: 8734982788</div>
        </div>
        <div class="card-box">
          <div style="display: flex; justify-content: space-between;">
            <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Animal Details</div>
            <span style="font-size: 10px; color: #64748b;">ID: PT-2026-0001</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <div style="font-size: 13.5px; font-weight: 700;">dsfj</div>
            <span style="font-size: 11px; font-weight: 700; color: #047857; background: #ecfdf5; padding: 2px 7px; border-radius: 4px;">125.0 kg</span>
          </div>
          <div class="card-subtext">Bovine • Jersey</div>
          <div class="card-subtext">Female • 2 years</div>
        </div>
      </div>

      <!-- 4. Findings Box -->
      <div class="findings-box" style="margin-bottom: 12px;">
        <div class="findings-item">
          <div class="findings-title">Clinical Presentation</div>
          <div style="font-size: 11.5px; line-height: 1.25;">Pyrexia / Fever</div>
        </div>
        <div class="findings-item">
          <div class="findings-title">Confirmed Diagnosis</div>
          <div class="findings-diag-row">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: #ef4444; display: inline-block; flex-shrink: 0;"></span>
            <div class="findings-diag-text">E fever</div>
          </div>
        </div>
      </div>

      <!-- 5. Table with Single Line and Multi-line wrapping badges -->
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1.5px solid #cbd5e1;">
            <th style="padding: 5px 8px; text-align: center; font-size: 10px; width: 25px;">#</th>
            <th style="padding: 5px 8px; text-align: left; font-size: 10px;">Medicine &amp; Formulation</th>
            <th style="padding: 5px 8px; text-align: center; font-size: 10px; width: 100px;">Dose</th>
            <th style="padding: 5px 8px; text-align: center; font-size: 10px; width: 100px;">Route</th>
            <th style="padding: 5px 8px; text-align: center; font-size: 10px; width: 80px;">Frequency</th>
            <th style="padding: 5px 8px; text-align: center; font-size: 10px; width: 70px;">Duration</th>
            <th style="padding: 5px 8px; text-align: right; font-size: 10px; width: 70px;">Quantity</th>
          </tr>
        </thead>
        <tbody>
          <!-- Row 1: Single line -->
          <tr>
            <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">1</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">
              <div style="font-weight: 700; font-size: 12px;">Meloxicam Bolus</div>
              <div class="sig-box">
                <strong style="color: #1d4ed8;">Sig:</strong> Give after food
              </div>
            </td>
            <td style="padding: 6px 8px; text-align: center; vertical-align: middle; border-bottom: 1px solid #e2e8f0;">
              <span class="dose-badge">1 bolus/boli</span>
            </td>
            <td style="padding: 6px 8px; text-align: center; vertical-align: middle; border-bottom: 1px solid #e2e8f0;">
              <span class="route-badge">PO (Oral)</span>
            </td>
            <td style="padding: 6px 8px; text-align: center; vertical-align: middle; border-bottom: 1px solid #e2e8f0;">BID (q12h)</td>
            <td style="padding: 6px 8px; text-align: center; vertical-align: middle; border-bottom: 1px solid #e2e8f0;">3 days</td>
            <td style="padding: 6px 8px; text-align: right; vertical-align: middle; border-bottom: 1px solid #e2e8f0; font-weight: 700;">10 tablet</td>
          </tr>

          <!-- Row 2: Multi-line wrapped dose and route -->
          <tr>
            <td style="padding: 6px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;">2</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">
              <div style="font-weight: 700; font-size: 12px;">Amoxicillin Injectable Suspension</div>
              <div class="sig-box">
                <strong style="color: #1d4ed8;">Sig:</strong> Administer deep intramuscularly under strict aseptic conditions once daily for 5 days.
              </div>
            </td>
            <td style="padding: 6px 8px; text-align: center; vertical-align: middle; border-bottom: 1px solid #e2e8f0;">
              <span class="dose-badge">10 mg/kg (15 mL)</span>
            </td>
            <td style="padding: 6px 8px; text-align: center; vertical-align: middle; border-bottom: 1px solid #e2e8f0;">
              <span class="route-badge">IM (Intramuscular)</span>
            </td>
            <td style="padding: 6px 8px; text-align: center; vertical-align: middle; border-bottom: 1px solid #e2e8f0;">Once daily</td>
            <td style="padding: 6px 8px; text-align: center; vertical-align: middle; border-bottom: 1px solid #e2e8f0;">5 days</td>
            <td style="padding: 6px 8px; text-align: right; vertical-align: middle; border-bottom: 1px solid #e2e8f0; font-weight: 700;">1 vial</td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;

  await page.setContent(testHtml, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(OUT_DIR, '01_dom_option1.png'), fullPage: true });

  await page.addScriptTag({ content: html2canvasJs });

  const h2cData = await page.evaluate(async () => {
    const el = document.getElementById('test-container');
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    return canvas.toDataURL('image/png');
  });

  fs.writeFileSync(
    path.join(OUT_DIR, '02_h2c_option1.png'),
    Buffer.from(h2cData.replace(/^data:image\/png;base64,/, ''), 'base64')
  );

  console.log('Saved 01_dom_option1.png and 02_h2c_option1.png');
  await browser.close();
}

main().catch(console.error);
