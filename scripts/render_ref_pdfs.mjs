import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PDFJS_BUILD_DIR = path.resolve('node_modules/pdfjs-dist/build');
const PORT = 3899;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      const filePath = path.join(PDFJS_BUILD_DIR, urlPath.replace('/pdfjs/', ''));
      if (fs.existsSync(filePath)) {
        res.writeHead(200, {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(fs.readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/pdfjs/pdf.mjs`);

  const files = [
    { in: 'reference-pdfs/345.pdf', out: 'artifacts/pdf_previews/345_p' },
    { in: 'reference-pdfs/Rx_Patient_2026-09-19-1.pdf', out: 'artifacts/pdf_previews/Rx_Patient_defective_p' },
    { in: 'reference-pdfs/234.pdf', out: 'artifacts/pdf_previews/234_p' },
    { in: 'reference-pdfs/2341.pdf', out: 'artifacts/pdf_previews/2341_p' },
    { in: 'artifacts/live_production_final_verification/01_live_prescription_save.pdf', out: 'artifacts/pdf_previews/01_live_rx_save_p' },
    { in: 'artifacts/live_production_final_verification/02_live_tax_invoice_save.pdf', out: 'artifacts/pdf_previews/02_live_invoice_save_p' },
    { in: 'artifacts/live_production_final_verification/03_live_payment_receipt_save.pdf', out: 'artifacts/pdf_previews/03_live_receipt_save_p' }
  ];

  fs.mkdirSync('artifacts/pdf_previews', { recursive: true });

  for (const f of files) {
    if (!fs.existsSync(f.in)) {
      console.log('File not found:', f.in);
      continue;
    }
    const pdfBuf = fs.readFileSync(f.in);
    const b64 = pdfBuf.toString('base64');
    const pageDataList = await page.evaluate(async (base64, port) => {
      const pdfjsLib = await import(`http://localhost:${port}/pdfjs/pdf.mjs`);
      pdfjsLib.GlobalWorkerOptions.workerSrc = `http://localhost:${port}/pdfjs/pdf.worker.mjs`;

      const binStr = atob(base64);
      const len = binStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const results = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        results.push({ pageNum: p, dataUrl: canvas.toDataURL('image/png'), totalPages: pdf.numPages });
      }
      return results;
    }, b64, PORT);

    for (const p of pageDataList) {
      const outPath = `${f.out}${p.pageNum}.png`;
      const base64Data = p.dataUrl.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
      console.log(`Saved ${outPath} (Page ${p.pageNum} of ${p.totalPages})`);
    }
  }

  await browser.close();
  server.close();
}
main().catch(console.error);
