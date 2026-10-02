// ==============================================================================
// VetRx — Universal Purchase Invoice Importer & Multi-Row Table Extraction Engine
// Robust, format-agnostic, multi-line pharmaceutical invoice parser for Images, PDF & Text
// ==============================================================================

import type {
  ExtractedInvoiceItemDTO,
  InvoiceExtractionResultDTO,
  InventoryCategory,
} from './inventory.types.js';
import { InventoryService } from './inventory.service.js';
import { prisma } from '../lib/prisma.js';

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

      const { fullText, tableText } = await this.performMultiStageOCR(buffer);
      return tableText ? `${fullText}\n\n--- TABLE REGION OCR ---\n${tableText}` : fullText;
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
    const { fullText, tableText } = await this.performMultiStageOCR(buffer);
    const combinedText = tableText ? `${fullText}\n\n--- TABLE REGION OCR ---\n${tableText}` : fullText;
    return this.parseInvoiceText(combinedText, practiceId, existingCatalogue, existingInvoiceKeys);
  }

  /**
   * Preprocesses image and runs multi-pass OCR (Full page + Table ROI).
   */
  private static async performMultiStageOCR(buffer: Buffer): Promise<{ fullText: string; tableText: string }> {
    const sharpModule: any = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    const tesseractModule: any = await import('tesseract.js');

    const meta = await sharp(buffer).metadata();
    const width = meta.width || 800;
    const height = meta.height || 1200;

    let scale = 1;
    if (width < 1400) {
      scale = Math.min(3.5, Math.max(2, 2200 / width));
    }

    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    // Pass 1: Enhanced full page (Lanczos3 upscale, grayscale, normalize, sharpen)
    const fullEnhanced = await sharp(buffer)
      .resize({ width: targetWidth, height: targetHeight, kernel: 'lanczos3' })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5, m1: 2, m2: 20 })
      .toBuffer();

    // Pass 2: High contrast linear stretch for dot-matrix/faint table rows
    const highContrast = await sharp(buffer)
      .resize({ width: targetWidth, height: targetHeight, kernel: 'lanczos3' })
      .grayscale()
      .linear(2.2, -70)
      .sharpen({ sigma: 1.2 })
      .toBuffer();

    const worker = await tesseractModule.createWorker('eng');
    await worker.setParameters({
      preserve_interword_spaces: '1',
    });

    const fullResult = await worker.recognize(fullEnhanced);
    const fullText = fullResult.data.text || '';
    const fullLines = fullResult.data.lines || [];

    // Locate Medicine Table coordinates
    let tableHeaderY = -1;
    let tableFooterY = -1;

    for (const line of fullLines) {
      const txt = line.text || '';
      if (/Particulars|Description|Item\s*Name/i.test(txt) && /Batch|Exp|HSN|Packing|Rate|MRP|Qty|Sch\s*Qty/i.test(txt)) {
        if (line.bbox) {
          tableHeaderY = line.bbox.y0;
          break;
        }
      }
      if (/Remarks\s*:.*NO\s*EXPIRY\s*RETURNS/i.test(txt)) {
        if (line.bbox && tableHeaderY === -1) {
          tableHeaderY = line.bbox.y1 + 10;
        }
      }
    }

    if (tableHeaderY !== -1) {
      for (const line of fullLines) {
        const txt = line.text || '';
        if (line.bbox && line.bbox.y0 > tableHeaderY + 150) {
          if (/Received\s*All\s*Items|Declaration|Software\s*@|Signature|Net\s*Payable\s*:\s*\d+/i.test(txt)) {
            tableFooterY = line.bbox.y0;
            break;
          }
        }
      }
    }

    if (tableHeaderY === -1) {
      tableHeaderY = Math.floor(targetHeight * 0.52);
    }
    if (tableFooterY === -1) {
      tableFooterY = Math.min(targetHeight - 10, tableHeaderY + Math.floor(targetHeight * 0.22));
    }

    const tableCropHeight = Math.max(100, Math.min(tableFooterY - tableHeaderY + 40, targetHeight - tableHeaderY));

    const tableCropBuffer = await sharp(highContrast)
      .extract({
        left: Math.floor(targetWidth * 0.005),
        top: Math.max(0, tableHeaderY - 20),
        width: Math.floor(targetWidth * 0.99),
        height: tableCropHeight,
      })
      .toBuffer();

    // Run PSM 6 on table ROI for uniform block of text
    await worker.setParameters({
      tessedit_pageseg_mode: tesseractModule.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });

    const tableResult = await worker.recognize(tableCropBuffer);
    const tableText = tableResult.data.text || '';

    await worker.terminate();

    return { fullText, tableText };
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
    let existingPurchases: any[] = [];
    if (practiceId && existingInvoiceKeys.length === 0) {
      try {
        existingPurchases = await InventoryService.listPurchases(practiceId);
      } catch {}
    }

    const lines = rawContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const warnings: string[] = [];

    // 1. Supplier Extraction
    const supplier = this.extractSupplier(lines);
    const supplierName = supplier.name || 'Veterinary Distributor';
    const supplierGstin = supplier.gstin || null;

    // 2. Invoice Metadata
    const invoiceMeta = this.extractInvoiceMeta(lines);
    const invoiceNumber = invoiceMeta.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
    const invoiceDate = invoiceMeta.invoiceDate || new Date().toISOString().split('T')[0];
    const invoiceTime = invoiceMeta.invoiceTime || null;
    const dueDate = invoiceMeta.dueDate || null;
    const paymentType = invoiceMeta.paymentType || 'CREDIT';
    const customer = invoiceMeta.customer || {};

    // 3. Totals
    const totals = this.extractTotals(lines);

    // 4. Duplicate Check
    let isDuplicateWarning = false;
    let duplicateMessage: string | null = null;
    let existingPurchaseId: string | null = null;

    const allExisting = existingInvoiceKeys.length > 0 ? existingInvoiceKeys : existingPurchases;
    if (invoiceNumber && allExisting.length > 0) {
      const normInv = invoiceNumber.trim().toLowerCase();
      const match = allExisting.find(
        (p) => p.invoiceNumber && p.invoiceNumber.trim().toLowerCase() === normInv
      );
      if (match) {
        isDuplicateWarning = true;
        existingPurchaseId = match.id || null;
        duplicateMessage = `Duplicate invoice warning: Invoice ${invoiceNumber} already exists for this practice (Supplier: ${match.supplierName}).`;
        warnings.push(duplicateMessage);
      }
    }

    // 5. Line Item Extraction (Multi-Row Table Parser)
    const rawItems = this.extractTableRows(lines);
    const items: ExtractedInvoiceItemDTO[] = rawItems.map((raw, idx) => {
      const matched = this.normalizeAndMatchItem(raw, idx, existingCatalogue);
      return {
        ...matched,
        lineNumber: idx + 1,
        name: raw.name,
        category: matched.category,
        packing: raw.packing || matched.packSize || '',
        packSize: raw.packing || matched.packSize || '',
        hsnCode: raw.hsnCode || '',
        batchNumber: raw.batchNumber || 'BATCH-DETECT',
        expiryDate: raw.expiryDate,
        quantity: raw.quantity || 1,
        schemeQuantity: raw.schemeQuantity || 0,
        freeQuantity: raw.schemeQuantity || 0,
        purchaseRate: raw.purchaseRate || 0,
        mrp: raw.mrp || 0,
        schemeDiscountPercent: raw.schemeDiscountPercent || 0,
        discountPercent: raw.discountPercent || 0,
        gstPercent: raw.gstPercent || 5,
        taxableValue: raw.taxableValue || Math.round((raw.quantity || 1) * (raw.purchaseRate || 0) * 100) / 100,
        confidence: raw.confidence || 'HIGH',
        rawOcrText: raw.rawOcrText,
      };
    });

    if (items.length === 0) {
      warnings.push('No line items were automatically detected. Please check document quality or enter items manually.');
    }

    // 6. Cross-Validation & Consistency
    if (totals.totalItems && items.length !== totals.totalItems) {
      warnings.push(`Detected ${items.length} items; invoice header states Total Items: ${totals.totalItems}.`);
    }

    const sumQty = items.reduce((sum, it) => sum + it.quantity, 0);
    if (totals.totalQuantity && sumQty !== totals.totalQuantity) {
      warnings.push(`Sum of item quantities (${sumQty}) differs from invoice header Total Qty: ${totals.totalQuantity}.`);
    }

    const calculatedTaxable = items.reduce((sum, it) => sum + (it.taxableValue || (it.quantity * it.purchaseRate)), 0);
    const finalTotal = typeof totals.netPayable === 'number' && totals.netPayable > 0
      ? totals.netPayable
      : (typeof totals.taxableAmount === 'number' && totals.taxableAmount > 0
          ? Math.round(totals.taxableAmount * 1.05 * 100) / 100
          : Math.round(calculatedTaxable * 100) / 100);

    return {
      supplier: {
        name: supplierName,
        gstin: supplierGstin,
        pan: supplier.pan,
        fssai: supplier.fssai,
        phone: supplier.phone,
        email: supplier.email,
        dlNo: supplier.dlNo,
        address: supplier.address,
        state: supplier.state,
      },
      supplierName,
      supplierGstin,
      invoiceNumber,
      invoiceDate,
      invoiceTime,
      dueDate,
      customerName: customer.name || null,
      customerAddress: customer.address || null,
      customerPhone: customer.phone || null,
      customerGstin: customer.gstin || null,
      paymentType,
      taxableAmount: totals.taxableAmount || Math.round(calculatedTaxable * 100) / 100,
      totalTax: totals.totalTax || (totals.taxableAmount ? Math.round((finalTotal - totals.taxableAmount) * 100) / 100 : undefined),
      totalDiscount: totals.totalDiscount,
      totalItems: totals.totalItems || items.length,
      totalQuantity: totals.totalQuantity || sumQty,
      netPayable: finalTotal,
      totalAmount: finalTotal,
      items,
      isDuplicate: isDuplicateWarning,
      isDuplicateWarning,
      duplicateMessage,
      existingPurchaseId,
      warnings,
      detectedCount: items.length,
      rawExtractedText: rawContent,
      confidence: items.length > 0 ? 'HIGH' : 'LOW',
    };
  }

  /**
   * Synchronous / DTO signature wrapper for parseInvoice.
   */
  static parseInvoice(
    rawContent: string,
    existingCatalogue: MasterCatalogueItem[] = [],
    existingInvoiceKeys: Array<{ supplierName: string; invoiceNumber: string; id: string }> = []
  ): InvoiceExtractionResultDTO {
    const lines = rawContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const supplier = this.extractSupplier(lines);
    const invoiceMeta = this.extractInvoiceMeta(lines);
    const totals = this.extractTotals(lines);
    const rawItems = this.extractTableRows(lines);

    const items: ExtractedInvoiceItemDTO[] = rawItems.map((raw, idx) => {
      const matched = this.normalizeAndMatchItem(raw, idx, existingCatalogue);
      return {
        ...matched,
        lineNumber: idx + 1,
        name: raw.name,
        category: matched.category,
        packing: raw.packing || matched.packSize || '',
        packSize: raw.packing || matched.packSize || '',
        hsnCode: raw.hsnCode || '',
        batchNumber: raw.batchNumber || 'BATCH-DETECT',
        expiryDate: raw.expiryDate,
        quantity: raw.quantity || 1,
        schemeQuantity: raw.schemeQuantity || 0,
        freeQuantity: raw.schemeQuantity || 0,
        purchaseRate: raw.purchaseRate || 0,
        mrp: raw.mrp || 0,
        schemeDiscountPercent: raw.schemeDiscountPercent || 0,
        discountPercent: raw.discountPercent || 0,
        gstPercent: raw.gstPercent || 5,
        taxableValue: raw.taxableValue || Math.round((raw.quantity || 1) * (raw.purchaseRate || 0) * 100) / 100,
        confidence: raw.confidence || 'HIGH',
      };
    });

    const calculatedTaxable = items.reduce((sum, it) => sum + (it.taxableValue || (it.quantity * it.purchaseRate)), 0);
    const finalTotal = totals.netPayable || totals.taxableAmount || Math.round(calculatedTaxable * 100) / 100;

    return {
      supplierName: supplier.name || 'Veterinary Distributor',
      supplierGstin: supplier.gstin || null,
      invoiceNumber: invoiceMeta.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      invoiceDate: invoiceMeta.invoiceDate || new Date().toISOString().split('T')[0],
      invoiceTime: invoiceMeta.invoiceTime || null,
      paymentType: invoiceMeta.paymentType || 'CREDIT',
      taxableAmount: totals.taxableAmount || Math.round(calculatedTaxable * 100) / 100,
      totalAmount: finalTotal,
      items,
      isDuplicate: false,
      warnings: [],
      detectedCount: items.length,
      rawExtractedText: rawContent,
    };
  }

  // --------------------------------------------------------------------------
  // Header / Metadata Extractors
  // --------------------------------------------------------------------------

  private static extractSupplier(lines: string[]): {
    name: string;
    gstin?: string | null;
    pan?: string | null;
    fssai?: string | null;
    phone?: string | null;
    email?: string | null;
    dlNo?: string | null;
    address?: string | null;
    state?: string | null;
  } {
    let name = '';
    let gstin: string | null = null;
    let pan: string | null = null;
    let fssai: string | null = null;
    let phone: string | null = null;
    let email: string | null = null;
    let dlNo: string | null = null;
    let address: string | null = null;
    let state: string | null = null;

    const topLines = lines.slice(0, 45);

    for (const line of topLines) {
      if (!gstin) {
        const gm = line.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}\b/i) ||
                   line.match(/GSTIN[\s.:]+([A-Z0-9]{15})/i);
        if (gm) gstin = (gm[1] || gm[0]).toUpperCase();
      }
      if (!pan) {
        const panM = line.match(/PAN[\s.:]+([A-Z]{5}\d{4}[A-Z])/i) || line.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
        if (panM && !line.includes('GSTIN')) pan = panM[1].toUpperCase();
      }
      if (!fssai) {
        const fsm = line.match(/FSSAI[\s.:]+(\d{10,20})/i);
        if (fsm) fssai = fsm[1];
      }
      if (!phone) {
        const pm = line.match(/(?:PH|Phone|Mob|Tel)[\s.:]+([\d,\s/-]{7,35})/i);
        if (pm) phone = pm[1].trim();
      }
      if (!email) {
        const em = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (em) email = em[1].toLowerCase();
      }
      if (!dlNo) {
        const dlm = line.match(/DL[\s.:\w]+([A-Z0-9,\s/-]{8,50})/i);
        if (dlm) dlNo = dlm[0].trim();
      }
      if (!state) {
        const sm = line.match(/State[\s.:]+([A-Za-z0-9\s-]+)/i) || line.match(/Kerala-?\d{0,2}/i);
        if (sm) state = sm[0].trim();
      }
      if (!name) {
        if (/^(?:M\/s\.?|Sold\s*by|Supplier|Vendor)[\s.:]+([A-Za-z0-9\s&.,'-]{3,60})/i.test(line)) {
          const match = line.match(/^(?:M\/s\.?|Sold\s*by|Supplier|Vendor)[\s.:]+([A-Za-z0-9\s&.,'-]{3,60})/i);
          if (match) name = match[1].trim();
        } else if (
          /(?:PHARMA|PHARMACEUTICALS|AGENCIES|DISTRIBUTOR|DISTRIBUTORS|HEALTHCARE|LABORATORIES|VET\s*CARE|SURGICALS|MEDICOS|ENTERPRISES|TRADERS|MEDICAL)/i.test(line) &&
          !/TAX\s*INVOICE|GSTIN|PH:|E-Mail|Kerala|DL\s*No|Page\s*\d|Bill\s*To|Ship\s*To/i.test(line) &&
          line.length > 3 && line.length < 60
        ) {
          name = line.replace(/^[)\]\}/\\|+vV✓Jj$;:_.\s-]+|[)\]\}/\\|+vV✓Jj$;:_.\s-]+$/g, '').trim();
        }
      }
    }

    return {
      name: name || 'Veterinary Distributor',
      gstin,
      pan,
      fssai,
      phone,
      email,
      dlNo,
      address,
      state: state || 'Kerala (32)',
    };
  }

  private static extractInvoiceMeta(lines: string[]): {
    invoiceNumber: string | null;
    invoiceDate: string | null;
    invoiceTime: string | null;
    dueDate: string | null;
    paymentType: string;
    customer: {
      name?: string;
      address?: string;
      phone?: string;
      gstin?: string;
    };
  } {
    let invoiceNumber: string | null = null;
    let invoiceDate: string | null = null;
    let invoiceTime: string | null = null;
    let dueDate: string | null = null;
    let paymentType = 'CREDIT';
    const customer: { name?: string; address?: string; phone?: string; gstin?: string } = {};

    for (const line of lines) {
      if (!invoiceNumber) {
        const im = line.match(/(?:Inv\s*No|Invoice\s*No|Bill\s*No|Invoice\s*#)[\s.:]+([A-Za-z0-9/_-]{4,30})/i) ||
                   line.match(/\*([A-Za-z0-9/_-]{4,30})\*/);
        if (im && !im[1].includes('TAX')) {
          invoiceNumber = im[1].trim();
        }
      }
      if (!invoiceDate) {
        const dm = line.match(/(?:Inv\s*Dt|Date|Invoice\s*Date|Dated)[\s.:]+(\d{2}[-/.]\d{2}[-/.]\d{2,4})/i) ||
                   line.match(/\b(\d{2}[-/.]\d{2}[-/.]\d{4})\b/);
        if (dm) invoiceDate = this.normalizeDateFormat(dm[1].trim());
      }
      if (!invoiceTime) {
        const tm = line.match(/(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM))/i);
        if (tm) invoiceTime = tm[1].toUpperCase();
      }
      if (!dueDate) {
        const ddm = line.match(/Due\s*Date[\s.:]+(\d{2}[-/.]\d{2}[-/.]\d{2,4})/i);
        if (ddm) dueDate = this.normalizeDateFormat(ddm[1].trim());
      }
      if (/Pay\s*Type[\s.:]+([A-Z]+)/i.test(line)) {
        const pm = line.match(/Pay\s*Type[\s.:]+([A-Z]+)/i);
        if (pm) paymentType = pm[1].toUpperCase();
      }
      if (/HAPPY\s*PET|CLINIC|HOSPITAL|DR\./i.test(line) && !customer.name) {
        customer.name = line.trim();
      }
    }

    return {
      invoiceNumber,
      invoiceDate,
      invoiceTime,
      dueDate,
      paymentType,
      customer,
    };
  }

  private static normalizeDateFormat(raw: string): string {
    const parts = raw.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[2].length === 2) {
        // DD-MM-YY
        return `20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return raw;
  }

  private static extractTotals(lines: string[]): {
    totalItems?: number;
    totalQuantity?: number;
    taxableAmount?: number;
    totalTax?: number;
    totalDiscount?: number;
    netPayable?: number;
  } {
    let totalItems: number | undefined;
    let totalQuantity: number | undefined;
    let taxableAmount: number | undefined;
    let totalTax: number | undefined;
    let totalDiscount: number | undefined;
    let netPayable: number | undefined;

    for (const line of lines) {
      if (!totalItems) {
        const tim = line.match(/Total\s*Items[\s.:]+(\d+)/i);
        if (tim) totalItems = parseInt(tim[1], 10);
      }
      if (!totalQuantity) {
        const tqm = line.match(/Total\s*Qty[\s.:]+(\d+)/i);
        if (tqm) totalQuantity = parseInt(tqm[1], 10);
      }
      if (!taxableAmount) {
        const tam = line.match(/Taxable\s*Amount[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
                    line.match(/Taxable\s*value[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
                    line.match(/Total\s*Taxable[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (tam) taxableAmount = parseFloat(tam[1].replace(/,/g, ''));
      }
      if (!totalTax) {
        const ttm = line.match(/Tax\s*Amount[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
                    line.match(/Total\s*GST[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
                    line.match(/Tax\s*Tot[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (ttm) totalTax = parseFloat(ttm[1].replace(/,/g, ''));
      }
      if (!totalDiscount) {
        const tdm = line.match(/Scheme\s*Disc[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
                    line.match(/Total\s*Disc[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (tdm) totalDiscount = parseFloat(tdm[1].replace(/,/g, ''));
      }
      if (!netPayable) {
        const npm = line.match(/Net\s*Payable[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
                    line.match(/Net\s*Amount[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
                    line.match(/Total\s*Amount[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
                    line.match(/Grand\s*Total[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (npm) netPayable = parseFloat(npm[1].replace(/,/g, ''));
      }
    }

    return { totalItems, totalQuantity, taxableAmount, totalTax, totalDiscount, netPayable };
  }

  // --------------------------------------------------------------------------
  // Multi-Row Table Extraction Engine
  // --------------------------------------------------------------------------

  private static extractTableRows(lines: string[]): Array<{
    name: string;
    packing: string;
    hsnCode: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    schemeQuantity: number;
    mrp: number;
    purchaseRate: number;
    schemeDiscountPercent: number;
    discountPercent: number;
    gstPercent: number;
    taxableValue: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    rawOcrText: string;
  }> {
    const rawRows: Array<any> = [];
    const seenSignatures = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignore non-item noise lines
      if (/^TAX\s*INVOICE|GSTIN:|CHALAPPURAM|BANK\s*:|Printed\s*By|Page\s*\d|Declaration|NO\s*EXPIRY\s*RETURNS|Total\s*Outstanding|Outstanding\s*Amt|Software\s*@|Received\s*All\s*Items/i.test(line)) {
        continue;
      }
      if (/^SNo\s+Rack|^Particulars\s+Packing|^HSN\s+Batch|^Tax\s*Tot/i.test(line)) {
        continue;
      }

      // Check if previous line was a wrapped product title without numbers
      let combinedLine = line;
      if (i > 0 && lines[i - 1].length > 3 && !/\d{2,}/.test(lines[i - 1]) && !/^TAX|^GSTIN|^Page/i.test(lines[i - 1])) {
        // Potential wrapped multiline
      }

      const row = this.parseSingleTableRow(combinedLine);
      if (row && row.name && row.name.length >= 2) {
        const sig = `${row.batchNumber}_${row.name.substring(0, 4).toLowerCase()}`;
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          rawRows.push(row);
        }
      }
    }

    return rawRows;
  }

  private static parseSingleTableRow(line: string): any | null {
    // Look for Expiry token (01-12 followed by / or - and 2-4 digit year: 2024-2039)
    const expMatch = line.match(/\b(0[1-9]|1[0-2])[\/-](2[4-9]|3[0-9]|202[4-9]|203[0-9])\b/);
    if (!expMatch) {
      return null;
    }

    const expStr = expMatch[0];
    const expIdx = line.indexOf(expStr);
    const beforeExp = line.substring(0, expIdx).trim();
    const afterExp = line.substring(expIdx + expStr.length).trim();

    // Parse After Expiry: Qty, MRP, Rate, SchDisc, GST, Taxable
    const afterTokens = afterExp.split(/\s+/).filter(Boolean);
    const numbers: number[] = [];
    for (const tok of afterTokens) {
      const cleanNum = tok.replace(/[^0-9.]/g, '');
      if (cleanNum && !isNaN(parseFloat(cleanNum))) {
        numbers.push(parseFloat(cleanNum));
      }
    }

    if (numbers.length < 2) {
      return null;
    }

    let qty = 1;
    let mrp = 0;
    let rate = 0;
    let schDisc = 0;
    let disc = 0;
    let gst = 5;
    let taxable = 0;

    if (numbers.length >= 6) {
      qty = Math.round(numbers[0]) || 1;
      const valA = numbers[1];
      const valB = numbers[2];
      if (valA > valB) {
        mrp = valA;
        rate = valB;
      } else {
        rate = valA;
        mrp = valB;
      }
      schDisc = numbers[3];
      gst = numbers[4];
      taxable = numbers[5];
    } else if (numbers.length === 5) {
      qty = Math.round(numbers[0]) || 1;
      const valA = numbers[1];
      const valB = numbers[2];
      if (valA > valB) {
        mrp = valA;
        rate = valB;
      } else {
        rate = valA;
        mrp = valB;
      }
      schDisc = numbers[3];
      taxable = numbers[4];
    } else if (numbers.length === 4) {
      qty = Math.round(numbers[0]) || 1;
      const valA = numbers[1];
      const valB = numbers[2];
      if (valA > valB) {
        mrp = valA;
        rate = valB;
      } else {
        rate = valA;
        mrp = valB;
      }
      taxable = numbers[3];
    } else if (numbers.length === 3) {
      qty = Math.round(numbers[0]) || 1;
      const valA = numbers[1];
      const valB = numbers[2];
      if (valA > valB) {
        mrp = valA;
        rate = valB;
      } else {
        rate = valA;
        mrp = valB;
      }
      taxable = Math.round(qty * rate * 100) / 100;
    } else if (numbers.length === 2) {
      const valA = numbers[0];
      const valB = numbers[1];
      if (valA > valB) {
        mrp = valA;
        rate = valB;
      } else {
        rate = valA;
        mrp = valB;
      }
      taxable = Math.round(qty * rate * 100) / 100;
    }

    // Parse Before Expiry: SNo, Mfac, Particulars, Pack, HSN, Batch
    const beforeTokens = beforeExp.split(/\s+/).filter(Boolean);
    if (beforeTokens.length === 0) return null;

    let batch = 'BATCH-DETECT';
    let hsn = '';
    let pack = '';

    if (beforeTokens.length > 0) {
      batch = beforeTokens.pop()!.replace(/[^A-Za-z0-9-]/g, '');
    }

    if (beforeTokens.length > 0) {
      const last = beforeTokens[beforeTokens.length - 1];
      if (/^300\d{3,6}$/.test(last) || /^\d{6,8}$/.test(last)) {
        hsn = beforeTokens.pop()!;
      }
    }

    if (beforeTokens.length > 0) {
      const last = beforeTokens[beforeTokens.length - 1];
      if (/^(?:ml|l|mg|g|gm|kg|tab|tabs|strip|strips|vial|vials|pcs|piece|pieces|bottle|bottles|tube|tubes|can|sachet|sachets|'s|s)$/i.test(last) && beforeTokens.length > 1) {
        const prev = beforeTokens[beforeTokens.length - 2];
        if (/^\d+(?:\.\d+)?$/.test(prev)) {
          const unit = beforeTokens.pop()!;
          const num = beforeTokens.pop()!;
          pack = `${num} ${unit}`;
        }
      } else if (/^\d+(?:\.\d+)?\s*(?:ml|l|mg|g|gm|kg|tab|tabs|strip|vial|'s|s|pcs|box)$/i.test(last) || /^10's|^10s|^1's|^100s|^100\s*pcs/i.test(last)) {
        pack = beforeTokens.pop()!;
      }
    }

    // Clean leading noise tokens (SNo, checkmarks, explicit Mfac codes with colon/dot)
    while (
      beforeTokens.length > 0 &&
      (/^\d{1,3}[\s.-]*$/.test(beforeTokens[0]) ||
       /^[)\]\}/\\|+vV✓Jj$;:_.-]+$/.test(beforeTokens[0]) ||
       /^[A-Z]{2,6}[.:]$/.test(beforeTokens[0]))
    ) {
      beforeTokens.shift();
    }

    // Strip leading and trailing noise from product name
    let name = beforeTokens
      .join(' ')
      .replace(/^[)\]\}/\\|+vV✓Jj$;:_.\s-]+|[)\]\}/\\|+vV✓Jj$;:_.\s-]+$/g, '')
      .replace(/^[A-Z]{2,6}[.:]\s*/, '') // Remove manufacturer prefix like "SIHIL. " or "CORI: "
      .trim();

    if (!name || name.length < 2) return null;

    return {
      name,
      packing: pack,
      hsnCode: hsn,
      batchNumber: batch,
      expiryDate: this.normalizeExpiryDate(expStr),
      quantity: qty,
      schemeQuantity: 0,
      mrp: mrp > 0 ? mrp : Math.round(rate * 1.35),
      purchaseRate: rate > 0 ? rate : 100,
      schemeDiscountPercent: schDisc,
      discountPercent: disc,
      gstPercent: gst,
      taxableValue: taxable > 0 ? taxable : Math.round(qty * rate * 100) / 100,
      confidence: 'HIGH',
      rawOcrText: line,
    };
  }

  private static normalizeExpiryDate(str: string): string {
    const m = str.match(/\b(0[1-9]|1[0-2])[\/-](2[4-9]|3[0-9]|202[4-9]|203[0-9])\b/);
    if (!m) return str;
    const month = m[1].padStart(2, '0');
    let year = m[2];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-01`;
  }

  // --------------------------------------------------------------------------
  // Normalization & Catalogue Matching
  // --------------------------------------------------------------------------

  private static normalizeAndMatchItem(
    raw: any,
    idx: number,
    catalogue: MasterCatalogueItem[]
  ): ExtractedInvoiceItemDTO {
    const rawName = String(raw.name || '').trim();
    const flags: string[] = [];

    // Category detection
    let category: InventoryCategory = 'MEDICINE';
    if (/suture|catgut|scalpel|blade|catheter|cannula|surgical|implant|bone\s*plate|screw|wire/i.test(rawName)) {
      category = 'SURGICAL_MATERIAL';
    } else if (/syringe|needle|dispovan|gloves|mask|sanitizer|disinfectant|spirit|drape|cap|apron|bandage|cotton|gauze|swab|tape/i.test(rawName)) {
      category = 'CONSUMABLE';
    } else if (/reagent|rapid\s*test|vacutainer|strip|slide|serology|kit/i.test(rawName)) {
      category = 'LAB_MATERIAL';
    }

    // Dosage Form & Stock Unit
    let dosageForm = 'Injection';
    let stockUnit = 'Vial';

    if (/tab|tablet/i.test(rawName)) {
      dosageForm = 'Tablet';
      stockUnit = 'Strip';
    } else if (/syrup|susp|suspension|oral\s*liquid|drops|solution/i.test(rawName)) {
      dosageForm = 'Syrup';
      stockUnit = 'Bottle';
    } else if (/ointment|gel|cream/i.test(rawName)) {
      dosageForm = 'Ointment';
      stockUnit = 'Tube';
    } else if (/spray/i.test(rawName)) {
      dosageForm = 'Spray';
      stockUnit = 'Can';
    } else if (/powder|sachet/i.test(rawName)) {
      dosageForm = 'Powder';
      stockUnit = 'Sachet';
    } else if (/bolus/i.test(rawName)) {
      dosageForm = 'Bolus';
      stockUnit = 'Strip';
    }

    // Fuzzy matching against catalogue
    let matchedMedicineId: string | null = null;
    let matchedItemId: string | null = null;
    let matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';
    const suggestedMatches: Array<{ id: string; name: string; type: 'medicine' | 'item' }> = [];

    const normInput = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const cat of catalogue) {
      const normCat = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normCat === normInput) {
        if (cat.type === 'medicine') matchedMedicineId = cat.id;
        else matchedItemId = cat.id;
        matchConfidence = 'HIGH';
        suggestedMatches.unshift(cat);
        break;
      } else if (normCat.includes(normInput) || normInput.includes(normCat)) {
        if (matchConfidence === 'NONE') {
          if (cat.type === 'medicine') matchedMedicineId = cat.id;
          else matchedItemId = cat.id;
          matchConfidence = 'MEDIUM';
        }
        suggestedMatches.push(cat);
      }
    }

    if (matchConfidence === 'NONE') {
      flags.push('NEW_MASTER_ITEM');
    }

    return {
      tempId: `item_${idx}_${Date.now()}`,
      name: rawName,
      category,
      dosageForm,
      packSize: raw.packing || '',
      packing: raw.packing || '',
      stockUnit,
      presentation: `${dosageForm}, ${raw.packing || '1 Unit'}`,
      batchNumber: raw.batchNumber || 'BATCH-DETECT',
      manufacturingDate: null,
      expiryDate: raw.expiryDate || '',
      quantity: raw.quantity || 1,
      schemeQuantity: raw.schemeQuantity || 0,
      freeQuantity: raw.schemeQuantity || 0,
      purchaseRate: raw.purchaseRate || 0,
      mrp: raw.mrp || Math.round((raw.purchaseRate || 0) * 1.35),
      schemeDiscountPercent: raw.schemeDiscountPercent || 0,
      discountPercent: raw.discountPercent || 0,
      gstPercent: raw.gstPercent || 5,
      taxableValue: raw.taxableValue || Math.round((raw.quantity || 1) * (raw.purchaseRate || 0) * 100) / 100,
      lineTotal: raw.taxableValue || Math.round((raw.quantity || 1) * (raw.purchaseRate || 0) * 100) / 100,
      matchedMedicineId,
      matchedItemId,
      matchConfidence,
      suggestedMatches: suggestedMatches.slice(0, 3),
      flags,
      confidence: 'HIGH',
      rawOcrText: raw.rawOcrText,
    };
  }
}
