import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 800 });

  const html2canvasJs = fs.readFileSync('web/node_modules/html2canvas/dist/html2canvas.js', 'utf8');

  const testHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body {
        margin: 40px;
        background: #f1f5f9;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        line-height: 20px;
      }
      .test-container {
        background: white;
        padding: 30px;
        width: 600px;
      }
      
      /* CURRENT STYLES */
      .current .document-badge-prescription {
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 10.5px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        display: inline-block;
      }
      .current .practitioner-header-reg-chip {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        background: #f1f5f9;
        color: #334155;
        padding: 1px 6px;
        border-radius: 4px;
        margin-top: 2px;
        width: fit-content;
      }
      .current .stationery-weight-badge {
        font-size: 11px;
        font-weight: 700;
        color: #047857;
        background: #ecfdf5;
        padding: 1px 6px;
        border-radius: 4px;
        display: inline-block;
      }
      .current .stationery-sig-box {
        background: #eff6ff;
        border: 1px solid #dbeafe;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 10px;
        margin-top: 3px;
        display: inline-block;
        color: #1e40af;
      }
      .current .dose-badge {
        background: #ecfdf5;
        color: #065f46;
        font-weight: 700;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
      }
      .current .route-badge {
        background: #f1f5f9;
        color: #334155;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        display: inline-block;
      }
      .current .stationery-findings-box {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 6px 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        box-sizing: border-box;
      }
      .current .stationery-signalment-box {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 6px 10px;
        box-sizing: border-box;
      }

      /* FIXED STYLES */
      .fixed .document-badge-prescription {
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 10.5px;
        font-weight: 700;
        padding: 3px 8px 3px 8px;
        border-radius: 4px;
        display: inline-block;
        line-height: 1.15;
        vertical-align: middle;
        box-sizing: border-box;
      }
      .fixed .practitioner-header-reg-chip,
      .fixed .registration-pill {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        background: #f1f5f9;
        color: #334155;
        padding: 2px 6px 3px 6px;
        border-radius: 4px;
        margin-top: 2px;
        width: fit-content;
        line-height: 1.15;
        vertical-align: middle;
        box-sizing: border-box;
      }
      .fixed .stationery-weight-badge {
        font-size: 11px;
        font-weight: 700;
        color: #047857;
        background: #ecfdf5;
        padding: 2px 7px 3px 7px;
        border-radius: 4px;
        display: inline-block;
        line-height: 1.15;
        vertical-align: middle;
        box-sizing: border-box;
      }
      .fixed .stationery-sig-box {
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
      .fixed .dose-badge {
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
      .fixed .route-badge {
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
      .fixed .stationery-findings-box {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 7px 10px 10px 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        box-sizing: border-box;
      }
      .fixed .stationery-signalment-box {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 7px 10px 10px 10px;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div style="display: flex; gap: 30px;">
      <!-- CURRENT -->
      <div class="test-container current" id="target-current">
        <h3 style="margin-top:0;">Current (Defective)</h3>
        <div style="margin-bottom: 12px;">
          <span class="document-badge-prescription">Original Prescription</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span class="practitioner-header-reg-chip">Reg. No.: KSVC-2222</span>
        </div>
        <div class="stationery-signalment-box" style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong>sdfs</strong>
            <span class="stationery-weight-badge">Weight N/A</span>
          </div>
          <p style="font-size: 11px; margin: 2px 0 0 0;">Canine • sdfd</p>
          <p style="font-size: 11px; margin: 2px 0 0 0;">Male</p>
        </div>
        <div class="stationery-findings-box" style="margin-bottom: 12px;">
          <div>
            <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #64748b;">Clinical Presentation</span>
            <p style="font-size: 11.5px; margin: 0;">dfgd</p>
          </div>
          <div>
            <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #64748b;">Confirmed Diagnosis</span>
            <p style="font-size: 13px; font-weight: 700; margin: 0;">dsgadg</p>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
          <tr>
            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0;">
              <div><strong>qdfqd</strong></div>
              <div class="stationery-sig-box">
                <strong>Sig:</strong> Give after food with drinking water. Complete full course.
              </div>
            </td>
            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <span class="dose-badge">1 mg</span>
            </td>
            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <span class="route-badge">PO (Oral)</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- FIXED -->
      <div class="test-container fixed" id="target-fixed">
        <h3 style="margin-top:0;">Proposed Fix</h3>
        <div style="margin-bottom: 12px;">
          <span class="document-badge-prescription">Original Prescription</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span class="practitioner-header-reg-chip">Reg. No.: KSVC-2222</span>
        </div>
        <div class="stationery-signalment-box" style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong>sdfs</strong>
            <span class="stationery-weight-badge">Weight N/A</span>
          </div>
          <p style="font-size: 11px; margin: 2px 0 0 0;">Canine • sdfd</p>
          <p style="font-size: 11px; margin: 2px 0 0 0;">Male</p>
        </div>
        <div class="stationery-findings-box" style="margin-bottom: 12px;">
          <div>
            <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #64748b;">Clinical Presentation</span>
            <p style="font-size: 11.5px; margin: 0;">dfgd</p>
          </div>
          <div>
            <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: #64748b;">Confirmed Diagnosis</span>
            <p style="font-size: 13px; font-weight: 700; margin: 0;">dsgadg</p>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
          <tr>
            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0;">
              <div><strong>qdfqd</strong></div>
              <div class="stationery-sig-box">
                <strong>Sig:</strong> Give after food with drinking water. Complete full course.
              </div>
            </td>
            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <span class="dose-badge">1 mg</span>
            </td>
            <td style="padding: 5px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
              <span class="route-badge">PO (Oral)</span>
            </td>
          </tr>
        </table>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(testHtml, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: html2canvasJs });

  // Direct page screenshot (Browser DOM view)
  await page.screenshot({ path: 'artifacts/save_pdf_correction_test/dom_preview.png', fullPage: true });
  console.log('Saved dom_preview.png');

  // Now run html2canvas on body
  const canvasDataUrl = await page.evaluate(async () => {
    const canvas = await window.html2canvas(document.body, { scale: 2, backgroundColor: '#f1f5f9' });
    return canvas.toDataURL('image/png');
  });

  const base64Data = canvasDataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync('artifacts/save_pdf_correction_test/html2canvas_preview.png', Buffer.from(base64Data, 'base64'));
  console.log('Saved html2canvas_preview.png');

  await browser.close();
}
main().catch(console.error);
