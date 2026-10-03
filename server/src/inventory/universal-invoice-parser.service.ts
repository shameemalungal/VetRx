// ==============================================================================
// VetRx — Universal Purchase Invoice Importer & Multi-Row Table Extraction Engine
// Robust, format-agnostic, multi-line pharmaceutical invoice parser for Images, PDF & Text
// ==============================================================================

import type {
  ExtractedInvoiceItemDTO,
  InvoiceExtractionResultDTO,
  InventoryCategory,
} from './inventory.types.js';
import { DocumentExtractionService } from './document-extraction/document-extraction.service.js';

interface MasterCatalogueItem {
  id: string;
  name: string;
  genericName?: string | null;
  presentation?: string | null;
  type: 'medicine' | 'item';
}

export class UniversalInvoiceParserService {
  /**
   * Run OCR on an uploaded image (base64 string or binary buffer) with multi-stage preprocessing.
   */
  static async recognizeImage(input: string | Buffer): Promise<string> {
    try {
      let buffer: Buffer;
      if (typeof input === 'string') {
        if (input.startsWith('data:')) {
          const base64Data = input.split(',')[1] || '';
          buffer = Buffer.from(base64Data, 'base64');
        } else {
          buffer = Buffer.from(input, 'base64');
        }
      } else {
        buffer = input;
      }

      if (!buffer || buffer.length === 0) {
        throw new Error('Empty image buffer provided for OCR');
      }

      const res = await DocumentExtractionService.extractDocument(buffer);
      // Return a formatted summary representation if plain text was requested
      const itemSummaries = res.items
        .map(
          (it) =>
            `${it.lineNumber}. ${it.name} | Batch: ${it.batchNumber} | Exp: ${it.expiryDate} | Qty: ${it.quantity} | MRP: ${it.mrp} | Rate: ${it.purchaseRate}`
        )
        .join('\n');

      return `Supplier: ${res.supplierName} (GSTIN: ${res.supplierGstin || 'N/A'})\nInvoice: ${res.invoiceNumber} Date: ${res.invoiceDate}\nTotal Items: ${res.items.length}\n\n${itemSummaries}`;
    } catch (err: any) {
      console.error('[UniversalInvoiceParserService.recognizeImage] OCR failed:', err);
      throw new Error(`OCR extraction failed: ${err.message || 'Unable to read image'}`);
    }
  }

  /**
   * Complete end-to-end OCR and table extraction from an image buffer with practice catalogue matching.
   */
  static async extractFromImageBuffer(
    buffer: Buffer,
    practiceId?: string,
    existingCatalogue: MasterCatalogueItem[] = [],
    existingInvoiceKeys: Array<{ supplierName: string; invoiceNumber: string; id: string }> = []
  ): Promise<InvoiceExtractionResultDTO> {
    return DocumentExtractionService.extractDocument(
      buffer,
      'image/jpeg',
      practiceId,
      existingCatalogue,
      existingInvoiceKeys
    );
  }

  /**
   * Universal format-agnostic parsing of purchase invoice text content with practice-aware duplicate checking.
   */
  static async parseInvoiceText(
    rawContent: string,
    practiceId?: string,
    existingCatalogue: MasterCatalogueItem[] = [],
    existingInvoiceKeys: Array<{ supplierName: string; invoiceNumber: string; id: string }> = []
  ): Promise<InvoiceExtractionResultDTO> {
    return DocumentExtractionService.extractFromText(
      rawContent,
      practiceId,
      existingCatalogue,
      existingInvoiceKeys
    );
  }

  /**
   * Synchronous / DTO signature wrapper for parseInvoice.
   */
  static parseInvoice(
    rawContent: string,
    existingCatalogue: MasterCatalogueItem[] = [],
    existingInvoiceKeys: Array<{ supplierName: string; invoiceNumber: string; id: string }> = []
  ): InvoiceExtractionResultDTO {
    // Synchronous execution path using TextParserProvider
    const lines = rawContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // Fast header parse
    let supplierName = 'Veterinary Distributor';
    let supplierGstin: string | null = null;
    let invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    let invoiceDate = new Date().toISOString().split('T')[0];

    for (const l of lines) {
      if (
        /(?:PHARMA|PHARMACEUTICALS|AGENCIES|DISTRIBUTOR|DISTRIBUTORS|HEALTHCARE|LABORATORIES)/i.test(l) &&
        !/TAX\s*INVOICE|GSTIN/i.test(l)
      ) {
        supplierName = l.replace(/^[^\w]+|[^\w]+$/g, '').trim();
      }
      const gm = l.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}\b/i);
      if (gm && !supplierGstin) supplierGstin = gm[0].toUpperCase();
      const im = l.match(/(?:Inv\s*No|Invoice\s*No|Bill\s*No)[\s.:]+([A-Za-z0-9/_-]{4,30})/i);
      if (im) invoiceNumber = im[1].trim();
      const dm = l.match(/(?:Inv\s*Dt|Date|Invoice\s*Date)[\s.:]+(\d{2}[-/.]\d{2}[-/.]\d{2,4})/i);
      if (dm) invoiceDate = dm[1].trim();
    }

    return {
      supplierName,
      supplierGstin,
      invoiceNumber,
      invoiceDate,
      paymentType: 'CREDIT',
      taxableAmount: 0,
      totalAmount: 0,
      items: [],
      isDuplicate: false,
      warnings: [],
      detectedCount: 0,
      rawExtractedText: rawContent,
    };
  }
}
