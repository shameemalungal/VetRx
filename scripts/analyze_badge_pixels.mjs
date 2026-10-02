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
  
  const img1Buf = fs.readFileSync('artifacts/debug_badges/02_h2c_current.png');
  const img2Buf = fs.readFileSync('artifacts/debug_badges/03_h2c_fix_a.png');

  const b64_1 = img1Buf.toString('base64');
  const b64_2 = img2Buf.toString('base64');

  await page.setContent(`
    <img id="img1" src="data:image/png;base64,${b64_1}">
    <img id="img2" src="data:image/png;base64,${b64_2}">
    <canvas id="canvas"></canvas>
  `);

  const report = await page.evaluate(async () => {
    function analyzeBadge(imgId, targetColorHex, textDarkColor) {
      const img = document.getElementById(imgId);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Let's find green dose badge: background is light green #ecfdf5 (rgb: 236, 253, 245)
      // and dark green text #065f46 (rgb: 6, 95, 70)
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
      let textMinY = Infinity, textMaxY = -1;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx+1];
          const b = data[idx+2];
          const a = data[idx+3];

          // Check if green badge background (r: 220-245, g: 245-255, b: 235-250)
          if (r >= 220 && r <= 245 && g >= 245 && b >= 235 && b <= 252 && a > 200) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }

          // Check if dark green text inside badge (r < 50, g >= 60 && g <= 130, b < 90)
          if (r < 50 && g >= 60 && g <= 130 && b < 90 && a > 200) {
            if (y < textMinY) textMinY = y;
            if (y > textMaxY) textMaxY = y;
          }
        }
      }

      return {
        badgeBox: { minY, maxY, height: maxY - minY },
        textBox: { textMinY, textMaxY, height: textMaxY - textMinY },
        paddingTop: textMinY - minY,
        paddingBottom: maxY - textMaxY
      };
    }

    return {
      current: analyzeBadge('img1'),
      fixA: analyzeBadge('img2')
    };
  });

  console.log('Analysis Report:');
  console.log('Current:', report.current);
  console.log('Fix A:', report.fixA);

  await browser.close();
}

main().catch(console.error);
