import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:4173';
const OUT_DIR = path.resolve('artifacts/save_pdf_correction_test');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  await page.goto(`${URL}/prescriptions`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(OUT_DIR, '00_prescriptions_page.png') });
  console.log('Saved 00_prescriptions_page.png');

  await browser.close();
}

main().catch(console.error);
