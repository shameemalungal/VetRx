import puppeteer from 'puppeteer-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = 'https://vetrx.brightbase.in';

async function test() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  page.on('console', (msg) => console.log('PAGE CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message, err.stack));

  // Login
  await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'dr.shameem.test@vetrx.test');
  await page.type('input[type="password"]', 'SecurePassword#2026!');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  console.log('Current URL after login:', page.url());

  const html = await page.evaluate(() => document.body.innerHTML);
  console.log('Body HTML length:', html.length);
  console.log('Body HTML snippet:', html.substring(0, 300));

  await browser.close();
}

test().catch(console.error);
