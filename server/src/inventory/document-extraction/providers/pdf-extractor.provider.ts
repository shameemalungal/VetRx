// ==============================================================================
// VetRx Document Extraction — PDF Extractor Provider
// Multi-page spatial layout text extraction and structured parsing for PDF invoices
// ==============================================================================

import type {
  IDocumentExtractionProvider,
  StructuredInvoiceDocument,
} from '../document-extraction.types.js';
import { TextParserProvider } from './text-parser.provider.js';

// Ensure Promise.withResolvers polyfill for Node < 22
if (typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

export class PdfExtractorProvider implements IDocumentExtractionProvider {
  name = 'PDF Multi-Page Spatial Extractor';

  isAvailable(): boolean {
    return true;
  }

  async extractDocument(payload: {
    buffer: Buffer;
    mimeType?: string;
    rawText?: string;
    fileName?: string;
  }): Promise<StructuredInvoiceDocument> {
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(payload.buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      disableFontFace: true,
    });
    const pdfDoc = await loadingTask.promise;

    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();

      if (!content.items || content.items.length === 0) {
        continue;
      }

      // Filter and sort items descending by Y (PDF coordinate system Y=0 is bottom)
      const validItems = (content.items as any[]).filter((it) => it.str && it.str.trim());
      validItems.sort((a, b) => (b.transform?.[5] || 0) - (a.transform?.[5] || 0));

      // Adaptive vertical clustering: cluster text items belonging to the same text line (within 3.0pt)
      const lineClusters: Array<{ baseY: number; items: Array<{ x: number; text: string }> }> = [];
      for (const item of validItems) {
        const y = item.transform?.[5] || 0;
        let cluster = lineClusters.find((c) => Math.abs(c.baseY - y) <= 3.0);
        if (!cluster) {
          cluster = { baseY: y, items: [] };
          lineClusters.push(cluster);
        }
        cluster.items.push({ x: item.transform?.[4] || 0, text: item.str });
      }

      // Ensure lines are ordered from top to bottom
      lineClusters.sort((a, b) => b.baseY - a.baseY);

      const pageLines = lineClusters.map((cl) => {
        const rowItems = cl.items.sort((a, b) => a.x - b.x);
        return rowItems.map((it) => it.text).join('   ');
      });

      pageTexts.push(pageLines.join('\n'));
    }

    const aggregatedText = pageTexts.join('\n\n');

    if (!aggregatedText || aggregatedText.trim().length < 10) {
      throw new Error('PDF appears to be empty or contains scanned images without selectable text layer.');
    }

    const textParser = new TextParserProvider();
    const result = await textParser.extractDocument({
      buffer: payload.buffer,
      rawText: aggregatedText,
      fileName: payload.fileName,
    });

    return {
      ...result,
      provider: 'text-parser',
    };
  }
}
