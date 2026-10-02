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
  const imgBuf = fs.readFileSync('artifacts/test_centering/02_h2c_option1.png');
  const b64 = imgBuf.toString('base64');

  await page.setContent(`
    <img id="img" src="data:image/png;base64,${b64}">
    <canvas id="canvas"></canvas>
  `);

  const metrics = await page.evaluate(() => {
    const img = document.getElementById('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    function getBounds(isBg, isText, searchArea) {
      let boxMinY = Infinity, boxMaxY = -1;
      let textMinY = Infinity, textMaxY = -1;

      for (let y = searchArea.y1; y <= searchArea.y2; y++) {
        for (let x = searchArea.x1; x <= searchArea.x2; x++) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
          if (isBg(r, g, b, a)) {
            if (y < boxMinY) boxMinY = y;
            if (y > boxMaxY) boxMaxY = y;
          }
          if (isText(r, g, b, a)) {
            if (y < textMinY) textMinY = y;
            if (y > textMaxY) textMaxY = y;
          }
        }
      }
      return {
        boxMinY, boxMaxY, height: boxMaxY - boxMinY,
        textMinY, textMaxY, textHeight: textMaxY - textMinY,
        padTop: textMinY - boxMinY,
        padBottom: boxMaxY - textMaxY
      };
    }

    // Reg chip: background #f1f5f9 (r:240-245, g:244-248, b:248-252)
    // text: #334155 (r:40-65, g:55-80, b:75-95)
    const regChip = getBounds(
      (r,g,b) => r >= 238 && r <= 248 && g >= 242 && g <= 250 && b >= 246 && b <= 253,
      (r,g,b) => r <= 65 && g <= 80 && b <= 95 && (r+g+b > 100),
      { x1: 50, x2: 400, y1: 150, y2: 300 }
    );

    // Dose badge Row 1: green #ecfdf5 (r:230-245, g:248-255, b:240-250)
    // text: dark green #065f46 (r:0-30, g:70-120, b:50-90)
    const doseBadge1 = getBounds(
      (r,g,b) => r >= 230 && r <= 245 && g >= 248 && g <= 255 && b >= 240 && b <= 250,
      (r,g,b) => r <= 35 && g >= 70 && g <= 120 && b <= 95,
      { x1: 500, x2: 950, y1: 800, y2: 1050 }
    );

    // Dose badge Row 2 (multiline)
    const doseBadge2 = getBounds(
      (r,g,b) => r >= 230 && r <= 245 && g >= 248 && g <= 255 && b >= 240 && b <= 250,
      (r,g,b) => r <= 35 && g >= 70 && g <= 120 && b <= 95,
      { x1: 500, x2: 950, y1: 1080, y2: 1350 }
    );

    return { regChip, doseBadge1, doseBadge2 };
  });

  console.log('Centering Metrics:');
  console.log('Reg Chip:', metrics.regChip);
  console.log('Dose Badge 1 (Single):', metrics.doseBadge1);
  console.log('Dose Badge 2 (Multi):', metrics.doseBadge2);

  await browser.close();
}

main().catch(console.error);
