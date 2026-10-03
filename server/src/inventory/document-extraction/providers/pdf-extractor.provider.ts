// ==============================================================================
// VetRx Document Extraction — PDF Extractor Provider
// Multi-page spatial layout text extraction and structured parsing for PDF invoices
// ==============================================================================

import type {
  IDocumentExtractionProvider,
  StructuredInvoiceDocument,
} from '../document-extraction.types.js';
import { TextParserProvider } from './text-parser.provider.js';

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
    const loadingTask = pdfjs.getDocument({ data });
    const pdfDoc = await loadingTask.promise;

    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();

      if (!content.items || content.items.length === 0) {
        continue;
      }

      // Group text items by vertical position (Y)
      const lineMap = new Map<number, Array<{ x: number; text: string }>>();
      for (const item of content.items as any[]) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round((item.transform?.[5] || 0) / 4) * 4;
        const x = item.transform?.[4] || 0;
        if (!lineMap.has(y)) {
          lineMap.set(y, []);
        }
        lineMap.get(y)!.push({ x, text: item.str });
      }

      // Sort descending by Y (PDF coordinate system Y=0 is bottom)
      const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
      const pageLines = sortedY.map((y) => {
        const rowItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
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
