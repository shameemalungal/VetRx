import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = path.resolve('artifacts/test_centering');

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1600 });

  const html2canvasJs = fs.readFileSync('web/node_modules/html2canvas/dist/html2canvas.js', 'utf8');

  // Let's test 5 different padding & line-height configurations on the exact elements:
  // 1. Current: padding 2px 7px 3px 7px, line-height 1.15
  // 2. Config B: padding 1px 8px 4px 8px, line-height 1.2
  // 3. Config C: padding 0px 8px 5px 8px, line-height 1.25
  // 4. Config D: padding 1px 8px 5px 8px, line-height 1.25
  // 5. Config E: padding 2px 8px 6px 8px, line-height 1.3
  const testHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        margin: 20px;
        background: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      .test-row {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 25px;
        background: white;
        padding: 15px;
        border: 1px solid #e2e8f0;
      }
      .label {
        width: 140px;
        font-size: 12px;
        font-weight: bold;
      }

      /* Base styles */
      .chip, .dose, .route, .ribbon-text, .sig {
        box-sizing: border-box;
      }

      /* CONFIG 1: Current (2px top, 3px bottom, lh 1.15) */
      .c1 .chip { font-size: 10px; font-weight: 700; background: #f1f5f9; color: #334155; border-radius: 4px; padding: 2px 7px 3px 7px; line-height: 1.15; display: inline-block; }
      .c1 .dose { font-size: 10px; font-weight: 700; background: #ecfdf5; color: #065f46; border-radius: 4px; padding: 2px 7px 3px 7px; line-height: 1.15; display: inline-block; }
      .c1 .route { font-size: 10px; font-weight: 600; background: #f1f5f9; color: #334155; border-radius: 4px; padding: 2px 7px 3px 7px; line-height: 1.15; display: inline-block; }
      .c1 .ribbon { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; }
      .c1 .ribbon-title { font-size: 13px; font-weight: 800; color: #0f172a; }
      .c1 .ribbon-meta { font-size: 11.5px; color: #475569; }
      .c1 .sig { background: #eff6ff; border: 1px solid #dbeafe; border-radius: 4px; padding: 4px 8px 5px 8px; font-size: 10px; line-height: 1.35; display: block; color: #1e40af; }

      /* CONFIG 2: (1px top, 5px bottom, lh 1.2) */
      .c2 .chip { font-size: 10px; font-weight: 700; background: #f1f5f9; color: #334155; border-radius: 4px; padding: 1px 8px 5px 8px; line-height: 1.2; display: inline-block; }
      .c2 .dose { font-size: 10px; font-weight: 700; background: #ecfdf5; color: #065f46; border-radius: 4px; padding: 1px 8px 5px 8px; line-height: 1.2; display: inline-block; }
      .c2 .route { font-size: 10px; font-weight: 600; background: #f1f5f9; color: #334155; border-radius: 4px; padding: 1px 8px 5px 8px; line-height: 1.2; display: inline-block; }
      .c2 .ribbon { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 10px 8px 10px; display: flex; justify-content: space-between; align-items: center; }
      .c2 .ribbon-title { font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1.2; }
      .c2 .ribbon-meta { font-size: 11.5px; color: #475569; line-height: 1.2; }
      .c2 .sig { background: #eff6ff; border: 1px solid #dbeafe; border-radius: 4px; padding: 3px 8px 6px 8px; font-size: 10px; line-height: 1.35; display: block; color: #1e40af; }

      /* CONFIG 3: (1px top, 6px bottom, lh 1.25) */
      .c3 .chip { font-size: 10px; font-weight: 700; background: #f1f5f9; color: #334155; border-radius: 4px; padding: 1px 8px 6px 8px; line-height: 1.25; display: inline-block; }
      .c3 .dose { font-size: 10px; font-weight: 700; background: #ecfdf5; color: #065f46; border-radius: 4px; padding: 1px 8px 6px 8px; line-height: 1.25; display: inline-block; }
      .c3 .route { font-size: 10px; font-weight: 600; background: #f1f5f9; color: #334155; border-radius: 4px; padding: 1px 8px 6px 8px; line-height: 1.25; display: inline-block; }
      .c3 .ribbon { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px 9px 12px; display: flex; justify-content: space-between; align-items: center; }
      .c3 .ribbon-title { font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1.2; }
      .c3 .ribbon-meta { font-size: 11.5px; color: #475569; line-height: 1.2; }
      .c3 .sig { background: #eff6ff; border: 1px solid #dbeafe; border-radius: 4px; padding: 3px 8px 7px 8px; font-size: 10px; line-height: 1.35; display: block; color: #1e40af; }

      /* Multi-line wrapping badges container */
      .wrap-box {
        width: 80px;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <div id="capture-root">
      <!-- Row 1: Config 1 (Current) -->
      <div class="test-row c1" id="row-c1">
        <div class="label">Config 1 (Current)</div>
        <span class="chip">Reg. No.: KSVC-2222</span>
        <span class="dose">1 bolus/boli</span>
        <span class="route">PO (Oral)</span>
        <div style="flex: 1;">
          <div class="ribbon">
            <span class="ribbon-title">VETERINARY PRESCRIPTION</span>
            <span class="ribbon-meta">Date: 19/09/2026 Rx No: RX-2026-0001</span>
          </div>
          <div class="sig" style="margin-top: 4px;"><strong>Sig:</strong> Give after food</div>
        </div>
        <div class="wrap-box">
          <span class="dose">10 mg/kg (15 mL)</span>
        </div>
      </div>

      <!-- Row 2: Config 2 -->
      <div class="test-row c2" id="row-c2">
        <div class="label">Config 2 (+4px bot)</div>
        <span class="chip">Reg. No.: KSVC-2222</span>
        <span class="dose">1 bolus/boli</span>
        <span class="route">PO (Oral)</span>
        <div style="flex: 1;">
          <div class="ribbon">
            <span class="ribbon-title">VETERINARY PRESCRIPTION</span>
            <span class="ribbon-meta">Date: 19/09/2026 Rx No: RX-2026-0001</span>
          </div>
          <div class="sig" style="margin-top: 4px;"><strong>Sig:</strong> Give after food</div>
        </div>
        <div class="wrap-box">
          <span class="dose">10 mg/kg (15 mL)</span>
        </div>
      </div>

      <!-- Row 3: Config 3 -->
      <div class="test-row c3" id="row-c3">
        <div class="label">Config 3 (+5px bot)</div>
        <span class="chip">Reg. No.: KSVC-2222</span>
        <span class="dose">1 bolus/boli</span>
        <span class="route">PO (Oral)</span>
        <div style="flex: 1;">
          <div class="ribbon">
            <span class="ribbon-title">VETERINARY PRESCRIPTION</span>
            <span class="ribbon-meta">Date: 19/09/2026 Rx No: RX-2026-0001</span>
          </div>
          <div class="sig" style="margin-top: 4px;"><strong>Sig:</strong> Give after food</div>
        </div>
        <div class="wrap-box">
          <span class="dose">10 mg/kg (15 mL)</span>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  await page.setContent(testHtml, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(OUT_DIR, 'compare_configs_dom.png'), fullPage: true });

  await page.addScriptTag({ content: html2canvasJs });

  const h2cData = await page.evaluate(async () => {
    const el = document.getElementById('capture-root');
    const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
    return canvas.toDataURL('image/png');
  });

  fs.writeFileSync(
    path.join(OUT_DIR, 'compare_configs_h2c.png'),
    Buffer.from(h2cData.replace(/^data:image\/png;base64,/, ''), 'base64')
  );

  console.log('Saved compare_configs_dom.png and compare_configs_h2c.png');

  // Now measure the exact vertical centering for c1, c2, c3
  const measurements = await page.evaluate(async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await new Promise(r => img.onload = r);

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Let's measure for each row the dose badge #ecfdf5
    function measureDose(minY, maxY) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let bMinY = Infinity, bMaxY = -1;
      let tMinY = Infinity, tMaxY = -1;

      for (let y = minY; y <= maxY; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2];
          // Dose badge green background
          if (r >= 230 && r <= 245 && g >= 248 && g <= 255 && b >= 240 && b <= 250) {
            if (y < bMinY) bMinY = y;
            if (y > bMaxY) bMaxY = y;
          }
          // Dose badge text dark green
          if (r <= 35 && g >= 70 && g <= 120 && b <= 95) {
            if (y < tMinY) tMinY = y;
            if (y > tMaxY) tMaxY = y;
          }
        }
      }
      return {
        boxHeight: bMaxY - bMinY,
        textHeight: tMaxY - tMinY,
        topGap: tMinY - bMinY,
        botGap: bMaxY - tMaxY,
        difference: (tMinY - bMinY) - (bMaxY - tMaxY) // 0 means perfectly centered!
      };
    }

    return {
      c1: measureDose(0, 300),
      c2: measureDose(300, 600),
      c3: measureDose(600, 900),
    };
  }, h2cData);

  console.log('Measurements (difference = topGap - botGap, closer to 0 is perfectly centered):');
  console.log(JSON.stringify(measurements, null, 2));

  await browser.close();
}

main().catch(console.error);
