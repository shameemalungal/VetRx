// ==============================================================================
// VetRx — Universal Purchase Invoice Importer & Semantic Parser
// Format-agnostic, multi-line semantic invoice extraction for Images, PDF & Text
// ==============================================================================

import type {
  ExtractedInvoiceItemDTO,
  InvoiceExtractionResultDTO,
  InventoryCategory,
} from './inventory.types.js';
import { InventoryService } from './inventory.service.js';

interface MasterCatalogueItem {
  id: string;
  name: string;
  genericName?: string | null;
  presentation?: string | null;
  type: 'medicine' | 'item';
}

export class UniversalInvoiceParserService {
  /**
   * Run OCR on an uploaded image (base64 string or binary buffer).
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

      // Dynamic import to avoid heavy TypeScript AST heap exhaustion on Windows
      const tesseractModule: any = await import('tesseract.js');
      const recognizeFn = tesseractModule.default?.recognize || tesseractModule.recognize;
      const { data } = await recognizeFn(buffer, 'eng');
      return data?.text || '';
    } catch (err: any) {
      console.error('[UniversalInvoiceParserService.recognizeImage] OCR failed:', err);
      throw new Error(`OCR extraction failed: ${err.message || 'Unable to read image'}`);
    }
  }

  /**
   * Universal format-agnostic parsing of purchase invoice text content with practice-aware duplicate checking.
   */
  static async parseInvoiceText(
    rawContent: string,
    practiceId?: string,
    existingCatalogue: MasterCatalogueItem[] = [],
    existingInvoiceKeys: Array<{ supplierName: string; invoiceNumber: string; id: string }> = []
  ): Promise<any> {
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

    const supplierName = this.extractSupplier(lines);
    const invoiceNumber = this.extractInvoiceNumber(lines) || `INV-${Date.now().toString().slice(-6)}`;
    const invoiceDate = this.extractInvoiceDate(lines) || new Date().toISOString().split('T')[0];
    const supplierGstin = this.extractGSTIN(lines);
    const totalAmount = this.extractTotalAmount(lines);

    let isDuplicateWarning = false;
    let duplicateMessage: string | null = null;

    const allExisting = existingInvoiceKeys.length > 0 ? existingInvoiceKeys : existingPurchases;
    if (invoiceNumber && allExisting.length > 0) {
      const normInv = invoiceNumber.trim().toLowerCase();
      const match = allExisting.find(
        (p) => p.invoiceNumber && p.invoiceNumber.trim().toLowerCase() === normInv
      );
      if (match) {
        isDuplicateWarning = true;
        duplicateMessage = `Duplicate invoice warning: Invoice ${invoiceNumber} already exists for this practice.`;
        warnings.push(duplicateMessage);
      }
    }

    const rawItems = this.extractLineItems(lines);
    const items = rawItems.map((raw, idx) => {
      const item = this.normalizeAndMatchItem(raw, idx, existingCatalogue);
      return {
        ...item,
        name: raw.name,
        batchNumber: raw.batch,
        expiryDate: raw.expiry,
        quantity: raw.quantity,
        freeQuantity: raw.free || 0,
        purchaseRate: raw.purchaseRate,
        mrp: raw.mrp,
        packSize: raw.packSize || item.packSize,
      };
    });

    if (items.length === 0) {
      warnings.push('No line items were automatically detected. Please check document quality or enter items manually.');
    }

    const calculatedTotal = items.reduce((sum, it) => sum + (it.quantity * it.purchaseRate), 0);
    const finalTotal = typeof totalAmount === 'number' && totalAmount > 0 ? totalAmount : Math.round(calculatedTotal * 100) / 100;

    return {
      supplier: {
        name: supplierName,
        gstin: supplierGstin,
      },
      supplierName,
      supplierGstin,
      invoiceNumber,
      invoiceDate,
      totalAmount: finalTotal,
      isDuplicateWarning,
      isDuplicate: isDuplicateWarning,
      duplicateMessage,
      items,
      warnings,
      detectedCount: items.length,
      rawExtractedText: rawContent,
    };
  }

  /**
   * Universal format-agnostic parsing of purchase invoice text content (DTO returning signature).
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

    const warnings: string[] = [];

    // 1. Extract Invoice Metadata
    const supplierInfo = this.extractSupplier(lines);
    const invoiceNumber = this.extractInvoiceNumber(lines);
    const invoiceDate = this.extractInvoiceDate(lines);
    const supplierGstin = this.extractGSTIN(lines);
    const totalAmount = this.extractTotalAmount(lines);

    // 2. Check for duplicate invoice
    let isDuplicate = false;
    let existingPurchaseId: string | null = null;

    if (supplierInfo && invoiceNumber) {
      const normSup = supplierInfo.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normInv = invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '');

      const match = existingInvoiceKeys.find((ex) => {
        const exSup = ex.supplierName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const exInv = ex.invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        return exSup === normSup && exInv === normInv;
      });

      if (match) {
        isDuplicate = true;
        existingPurchaseId = match.id;
        warnings.push(`This invoice may already have been imported (Supplier: ${match.supplierName}, Invoice: ${match.invoiceNumber}).`);
      }
    }

    // 3. Extract Line Items
    const rawItems = this.extractLineItems(lines);

    // 4. Normalize & Match with existing medicines / inventory catalogue
    const items: ExtractedInvoiceItemDTO[] = rawItems.map((raw, idx) => {
      const item = this.normalizeAndMatchItem(raw, idx, existingCatalogue);
      return {
        ...item,
        name: raw.name,
        batchNumber: raw.batch,
        expiryDate: raw.expiry,
        quantity: raw.quantity,
        purchaseRate: raw.purchaseRate,
        mrp: raw.mrp,
        packSize: raw.packSize || item.packSize,
      };
    });

    if (items.length === 0) {
      warnings.push('No line items were automatically detected. Please check document quality or enter items manually.');
    }

    const calculatedTotal = items.reduce((sum, it) => sum + (it.quantity * it.purchaseRate), 0);
    const finalTotal = typeof totalAmount === 'number' && totalAmount > 0 ? totalAmount : Math.round(calculatedTotal * 100) / 100;

    return {
      supplierName: supplierInfo || 'Unknown Supplier',
      supplierGstin,
      invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
      totalAmount: finalTotal,
      items,
      isDuplicate,
      existingPurchaseId,
      warnings,
    };
  }

  // --------------------------------------------------------------------------
  // Header / Metadata Extraction
  // --------------------------------------------------------------------------

  private static extractSupplier(lines: string[]): string {
    const topLines = lines.slice(0, 15);

    // Look for lines after "M/s", "Sold by", "Supplier:", or all-caps company headers
    for (const line of topLines) {
      const m = line.match(/(?:sold\s*by|supplier|from|seller|m\/s\.?|vendor)[\s:]+([A-Za-z0-9\s&.,'-]{3,60})/i);
      if (m && m[1].trim().length > 3) {
        return m[1].trim();
      }
    }

    // Common Indian Pharma / Vet Distributors keywords
    for (const line of topLines) {
      if (
        /(?:pharma|pharmaceuticals|enterprises|agencies|distributors|laboratories|biotech|vet|surgicals|medicos|healthcare)/i.test(line) &&
        !/(?:invoice|bill\s*to|ship\s*to|customer|gstin|pan|date|dl\s*no)/i.test(line) &&
        line.length >= 4 && line.length <= 60
      ) {
        return line.trim();
      }
    }

    // First capitalized line that is not "TAX INVOICE"
    for (const line of topLines) {
      if (
        line.length >= 4 &&
        line.length <= 50 &&
        !/tax\s*invoice|bill\s*of\s*supply|cash\s*memo|delivery\s*challan/i.test(line) &&
        !/page\s*\d/i.test(line)
      ) {
        return line.trim();
      }
    }

    return 'Pharma Supplier';
  }

  private static extractInvoiceNumber(lines: string[]): string | null {
    for (const line of lines.slice(0, 25)) {
      const match = line.match(/(?:inv(?:oice)?(?:\s*no\.?|\s*number|#)?|bill\s*no\.?)[\s:]+([A-Za-z0-9\/-]{2,30})/i);
      if (match && match[1]) {
        const val = match[1].trim();
        if (!/date|gstin|terms|customer/i.test(val)) {
          return val;
        }
      }
    }
    return null;
  }

  private static extractInvoiceDate(lines: string[]): string | null {
    for (const line of lines.slice(0, 25)) {
      // Look for Date label
      const match = line.match(/(?:date|dt\.?|dated)[\s:]+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
      if (match && match[1]) {
        return this.normalizeDateString(match[1]);
      }
    }

    // Look for any date in top lines
    for (const line of lines.slice(0, 20)) {
      const dateMatch = line.match(/(\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b)/);
      if (dateMatch && dateMatch[1]) {
        return this.normalizeDateString(dateMatch[1]);
      }
    }

    return null;
  }

  private static extractGSTIN(lines: string[]): string | null {
    const gstinRegex = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/;
    for (const line of lines.slice(0, 25)) {
      const m = line.match(gstinRegex);
      if (m) return m[0];
    }
    return null;
  }

  private static extractTotalAmount(lines: string[]): number | undefined {
    for (const line of lines.slice(-25).reverse()) {
      const m = line.match(/(?:total(?:\s*amount)?|grand\s*total|net\s*amount|inv(?:oice)?\s*val(?:ue)?|total\s*payable)[\s:₹Rs.]*([\d,]+\.?\d*)/i);
      if (m && m[1]) {
        const clean = m[1].replace(/,/g, '');
        const val = parseFloat(clean);
        if (!isNaN(val) && val > 0) return val;
      }
    }
    return undefined;
  }

  // --------------------------------------------------------------------------
  // Multi-Line Items Extraction
  // --------------------------------------------------------------------------

  private static extractLineItems(lines: string[]): any[] {
    const items: any[] = [];

    // Find table start header line
    let startIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].toLowerCase();
      if (
        (/item|description|particulars|product|medicine|drug/i.test(l) && /qty|quantity|batch|mrp|rate/i.test(l)) ||
        /sl\.\s*mkt|mkt\s*rack/i.test(l)
      ) {
        startIdx = i + 1;
        break;
      }
    }

    const candidateLines = lines.slice(startIdx);

    for (let i = 0; i < candidateLines.length; i++) {
      const line = candidateLines[i].trim();
      if (!line || line.length < 5) continue;

      // Stop scanning when reaching totals or footer sections
      if (/^(?:total\s*qty|total\s*amount|grand\s*total|sub\s*total|net\s*amount|taxable\s*amount|cgst|sgst|igst|bank\s*details|declaration|rupees\s*in\s*words|amount\s*in\s*words|terms\s*&|for\s+[a-z]+)/i.test(line)) {
        break;
      }

      // Ignore noise lines (page numbers, dashes, stars)
      if (/^page\s*\d|^-{4,}|^={4,}|^\*{4,}/i.test(line)) {
        continue;
      }

      // Skip lines that are purely header/metadata labels
      if (/^(?:sl\.|mkt|rack|hsn|pack|batch|exp|mrp|rate|amount|customer|dl\s*no|gstin|pan|invoice\s*no|date:)/i.test(line)) {
        continue;
      }

      const parsed = this.parseSingleItemLine(line);
      if (parsed) {
        items.push(parsed);
      }
    }

    return items;
  }

  private static parseSingleItemLine(line: string): any | null {
    // 0. Key-Value format: "Item: Ceftriaxone ... Qty: 20 Batch: CFX901 Exp: 09/2028 Rate: 42 MRP: 65"
    const kvMatch = line.match(/(?:Item|Particulars)[\s:]+(.*?)(?=\s*Qty:|\s*Batch:|$)(?:\s*Qty[\s:]+(\d+))?(?:\s*Batch[\s:]+([^\s]+))?(?:\s*Exp(?:iry)?[\s:]+([^\s]+))?(?:\s*Rate[\s:]+([\d.]+))?(?:\s*MRP[\s:]+([\d.]+))?/i);
    if (kvMatch && kvMatch[1] && (kvMatch[2] || kvMatch[3] || kvMatch[4])) {
      const kvName = kvMatch[1].trim();
      const kvQty = kvMatch[2] ? parseInt(kvMatch[2], 10) : 1;
      const kvBatch = kvMatch[3] ? kvMatch[3].trim() : 'BATCH-DETECT';
      const kvExp = kvMatch[4] ? this.normalizeExpiryDate(kvMatch[4]) : '';
      const kvRate = kvMatch[5] ? parseFloat(kvMatch[5]) : 0;
      const kvMrp = kvMatch[6] ? parseFloat(kvMatch[6]) : Math.round(kvRate * 1.3);

      return {
        name: kvName,
        batch: kvBatch,
        expiry: kvExp,
        quantity: kvQty,
        free: 0,
        purchaseRate: kvRate,
        mrp: kvMrp,
        packSize: '',
      };
    }

    // 1. Standard Indian Pharma Table Line:
    // [Sl] [Mkt] [Rack] [Item Description] [Pack] [HSN] [Qty] [Free] [Batch] [Exp Date] [MRP] [Rate] [Amount]
    // Example: "1 ALKM A1 CEFTRIAXONE 1G INJECTION 1 VIAL 30042099 20 0 CFX901 09/2028 65.00 42.00 840.00"
    const patA = /(.*?)(?:\s+(?:300\d{1,5}|\d{4,8}))?\s+(\d+)\s+(\d+)\s+([A-Za-z0-9-]{3,15})\s+((?:0[1-9]|1[0-2])[\/.-](?:\d{2}|\d{4}))\s+([\d.,]+)\s+([\d.,]+)(?:\s+[\d.,]+)?$/;
    let match = line.match(patA);
    if (match) {
      const rawLeft = match[1].trim();
      const qty = parseInt(match[2], 10);
      const free = parseInt(match[3], 10);
      const batch = match[4];
      const expiry = this.normalizeExpiryDate(match[5]);
      const num1 = parseFloat(match[6].replace(/,/g, ''));
      const num2 = parseFloat(match[7].replace(/,/g, ''));

      const mrp = Math.max(num1, num2);
      const rate = Math.min(num1, num2);

      return this.cleanLineItem(rawLeft, qty, free, batch, expiry, mrp, rate);
    }

    // 2. Pattern B: [Item Description...] [HSN] [Qty] [Batch] [Exp Date] [MRP] [Rate] [Amount] (no Free column)
    const patB = /(.*?)(?:\s+(?:300\d{1,5}|\d{4,8}))?\s+(\d+)\s+([A-Za-z0-9-]{3,15})\s+((?:0[1-9]|1[0-2])[\/.-](?:\d{2}|\d{4}))\s+([\d.,]+)\s+([\d.,]+)(?:\s+[\d.,]+)?$/;
    match = line.match(patB);
    if (match) {
      const rawLeft = match[1].trim();
      const qty = parseInt(match[2], 10);
      const free = 0;
      const batch = match[3];
      const expiry = this.normalizeExpiryDate(match[4]);
      const num1 = parseFloat(match[5].replace(/,/g, ''));
      const num2 = parseFloat(match[6].replace(/,/g, ''));

      const mrp = Math.max(num1, num2);
      const rate = Math.min(num1, num2);

      return this.cleanLineItem(rawLeft, qty, free, batch, expiry, mrp, rate);
    }


    // 3. Tab / Pipe / Multi-space column separated table line
    const cols = line.split(/\s{2,}|\t|\|/).map((c) => c.trim()).filter(Boolean);
    if (cols.length >= 4) {
      let rawName = cols[0];
      let batch = '';
      let expiry = '';
      let packSize = '';
      let qty = 1;
      let rate = 0;
      let mrp = 0;

      for (let c = 1; c < cols.length; c++) {
        const col = cols[c];
        if (!packSize && /^\d+(?:\.\d+)?\s*(?:ml|l|mg|g|gm|kg|pcs|piece|tabs?|caps?|vials?|amps?|foils?|box|strip)$/i.test(col)) {
          packSize = col;
          continue;
        }
        if (!expiry && /\b(0[1-9]|1[0-2])[\/.-](\d{2}|\d{4})\b/.test(col)) {
          expiry = this.normalizeExpiryDate(col);
          continue;
        }
        if (!batch && /^[A-Za-z0-9-]{3,15}$/i.test(col) && !/^\d+(?:\.\d+)?$/.test(col) && !/^(?:tab|tabs|inj|syr|syrup|strip|bottle|mg|ml|gm)$/i.test(col)) {
          batch = col;
          continue;
        }
        const subTokens = col.split(/\s+/).filter(Boolean);
        for (const st of subTokens) {
          const num = parseFloat(st.replace(/,/g, ''));
          if (!isNaN(num)) {
            if (qty === 1 && Number.isInteger(num) && num > 0 && num < 10000 && !/^300\d+$/.test(st)) {
              qty = num;
            } else if (rate === 0 && num > 0) {
              rate = num;
            } else if (mrp === 0 && num >= rate) {
              mrp = num;
            }
          }
        }
      }

      if (rawName && rawName.length > 2) {
        return this.cleanLineItem(rawName, qty, 0, batch || 'BATCH-DETECT', expiry, mrp, rate, packSize);
      }
    }

    // 4. Pattern C: Expiry date token anchor
    // Highly resilient against varied spacing or missing non-critical columns
    const expMatch = line.match(/\b(0[1-9]|1[0-2])[\/.-](\d{2}|\d{4})\b/);
    if (expMatch) {
      const expStr = expMatch[0];
      const expIdx = line.indexOf(expStr);
      const beforeExp = line.substring(0, expIdx).trim();
      const afterExp = line.substring(expIdx + expStr.length).trim();

      const beforeTokens = beforeExp.split(/\s+/).filter(Boolean);
      const afterTokens = afterExp.split(/\s+/).filter(Boolean);

      let batch = 'BATCH-DETECT';
      if (beforeTokens.length > 0) {
        const last = beforeTokens[beforeTokens.length - 1];
        if (/^[A-Za-z0-9-]{3,15}$/.test(last) && !/^(?:ml|l|mg|g|gm|tab|tabs|inj|vial|box|strip)$/i.test(last)) {
          batch = last;
          beforeTokens.pop();
        }
      }

      const numbersAfter = afterTokens
        .map((t) => parseFloat(t.replace(/,/g, '')))
        .filter((n) => !isNaN(n) && n > 0);

      let mrp = 0;
      let rate = 0;
      if (numbersAfter.length >= 2) {
        mrp = Math.max(numbersAfter[0], numbersAfter[1]);
        rate = Math.min(numbersAfter[0], numbersAfter[1]);
      } else if (numbersAfter.length === 1) {
        rate = numbersAfter[0];
        mrp = Math.round(rate * 1.35);
      }

      let qty = 1;
      let free = 0;
      const remainingBefore: string[] = [];

      for (let i = beforeTokens.length - 1; i >= 0; i--) {
        const t = beforeTokens[i];
        const n = parseFloat(t.replace(/,/g, ''));
        if (!isNaN(n) && !t.includes('.') && n <= 5000) {
          if (/^300\d+$/.test(t)) {
            // HSN code, ignore
          } else if (qty === 1) {
            qty = n;
          } else if (free === 0) {
            free = n;
          }
        } else {
          remainingBefore.unshift(t);
        }
      }

      const rawLeft = remainingBefore.join(' ');
      const expiry = this.normalizeExpiryDate(expStr);
      return this.cleanLineItem(rawLeft, qty, free, batch, expiry, mrp, rate);
    }

    return null;
  }

  private static cleanLineItem(
    rawLeft: string,
    qty: number,
    free: number,
    batch: string,
    expiry: string,
    mrp: number,
    rate: number,
    explicitPackSize?: string
  ): any | null {
    let tokens = rawLeft.split(/\s+/).filter(Boolean);

    // Remove leading serial number (e.g. "1", "2.")
    if (tokens.length > 0 && /^\d+[\s.-]*$/.test(tokens[0])) {
      tokens.shift();
    }

    // Remove known Mkt code (e.g. "ALKM", "CIPLA", "INTAS", "CADIL", "ZYDUS", "MANK", "MSD", "ZOETI", "VIRBA", "SUTUR")
    if (tokens.length > 2 && /^[A-Z]{3,6}$/.test(tokens[0])) {
      tokens.shift();
    }

    // Remove Rack code (e.g. "A1", "R4", "B2", "C1", "D2", "E1", "F3", "G2", "B3", "R5", "A4", "C2", "S1")
    if (tokens.length > 1 && /^[A-Z]\d{1,2}$|^R\d{1,2}$/i.test(tokens[0])) {
      tokens.shift();
    }

    // Extract pack size from the end of tokens if not explicitly provided from column
    let packSize = explicitPackSize || '';
    if (!explicitPackSize && tokens.length > 1) {
      const lastToken = tokens[tokens.length - 1];
      const secondLastToken = tokens[tokens.length - 2];
      const twoTokens = `${secondLastToken} ${lastToken}`;

      const packTwoRegex = /^(?:\d+(?:\.\d+)?)\s*(?:vial|vials|tab|tabs|strip|strips|bottle|bottles|foil|foils|tube|tubes|amp|amps|box|boxes|ampoule|ampoules|ml|l|mg|g|gm|kg|pcs|piece|pieces)$/i;
      const packOneRegex = /^(?:\d+(?:\.\d+)?\s*(?:ml|l|mg|g|gm|kg)|10's|1's|10x10|1x10|1x1|1x5|vial|strip|foil|tube|bottle)$/i;

      if (packTwoRegex.test(twoTokens)) {
        if (!packSize) packSize = twoTokens.toUpperCase();
        tokens.splice(tokens.length - 2, 2);
      } else if (packOneRegex.test(lastToken)) {
        if (!packSize) packSize = lastToken.toUpperCase();
        tokens.pop();
      }

      // Remove trailing unit if trailing unit artifact
      if (tokens.length > 1 && /^(?:ml|l|mg|g|gm|kg|pcs|piece|pieces|vials?|tabs?)$/i.test(tokens[tokens.length - 1])) {
        tokens.pop();
      }
    }

    // Remove trailing HSN if any leaked into name
    if (tokens.length > 1 && /^300\d{3,6}$/.test(tokens[tokens.length - 1])) {
      tokens.pop();
    }

    const name = tokens.join(' ').trim();
    if (!name || name.length < 2) return null;

    return {
      name,
      packSize,
      quantity: qty || 1,
      free: free || 0,
      batch: batch || 'BATCH-DETECT',
      expiry: expiry || '',
      mrp: mrp > 0 ? mrp : Math.round(rate * 1.35),
      purchaseRate: rate > 0 ? rate : 100,
    };
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
    const category = this.detectCategory(rawName);

    // Presentation extraction
    const { dosageForm, packSize, stockUnit, presentation } = this.extractPresentation(rawName, category);

    // Cleaned search name (without strength or pack numbers)
    const cleanedName = this.cleanItemName(rawName);

    // Batch validation
    let batchNumber = raw.batch || '';
    if (!batchNumber || batchNumber === 'BATCH-DETECT') {
      batchNumber = `B-${Math.floor(1000 + Math.random() * 9000)}`;
      flags.push('Batch not detected');
    }

    // Expiry validation
    let expiryDate = raw.expiry;
    if (!expiryDate) {
      const d = new Date();
      d.setMonth(d.getMonth() + 18);
      expiryDate = d.toISOString().split('T')[0];
      flags.push('Expiry not detected');
    }

    // Quantity check
    const quantity = Math.max(1, raw.quantity || 1);
    if (!raw.quantity || raw.quantity <= 0) {
      flags.push('Quantity needs verification');
    }

    // Matching against existing catalogue
    const { matchedId, matchedType, confidence, candidates } = this.matchCatalogue(
      cleanedName,
      rawName,
      catalogue
    );

    if (confidence === 'MEDIUM' || (candidates.length > 1 && confidence !== 'HIGH')) {
      flags.push('Possible medicine match');
    }

    const purchaseRate = raw.purchaseRate > 0 ? raw.purchaseRate : 100;
    const mrp = raw.mrp > 0 ? raw.mrp : Math.round(purchaseRate * 1.35);

    return {
      tempId: `inv_item_${idx}_${Date.now()}`,
      name: rawName,
      category,
      dosageForm,
      packSize: raw.packSize || packSize,
      stockUnit,
      presentation,
      batchNumber,
      manufacturingDate: null,
      expiryDate,
      quantity,
      purchaseRate,
      mrp,
      lineTotal: Math.round(quantity * purchaseRate * 100) / 100,
      matchedMedicineId: matchedType === 'medicine' ? matchedId : null,
      matchedItemId: matchedType === 'item' ? matchedId : null,
      matchConfidence: confidence,
      suggestedMatches: candidates,
      flags,
    };
  }

  private static detectCategory(name: string): InventoryCategory {
    const l = name.toLowerCase();

    if (/syringe|needle|catheter|glove|iv\s*set|infusion\s*set|cannula|cotton|gauze\s*swab/i.test(l)) {
      return 'CONSUMABLE';
    }
    if (/test\s*strip|reagent|edta|slide|microscope|vacutainer|centrifuge|stain|kit/i.test(l)) {
      return 'LAB_MATERIAL';
    }
    if (/suture|catgut|vicryl|silk|scalpel|blade|surgical|dressing|gauze\s*roll|bandage/i.test(l)) {
      return 'SURGICAL_MATERIAL';
    }
    if (/cleaning|bleach|disinfectant|record|stationery|soap|mop/i.test(l)) {
      return 'OTHER';
    }

    return 'MEDICINE';
  }

  private static extractPresentation(
    name: string,
    category: InventoryCategory
  ): { dosageForm: string; packSize: string; stockUnit: string; presentation: string } {
    const l = name.toLowerCase();

    if (category !== 'MEDICINE') {
      let stockUnit = 'Piece';
      if (/box|pack/i.test(l)) stockUnit = 'Box';
      if (/roll/i.test(l)) stockUnit = 'Roll';
      if (/pair/i.test(l)) stockUnit = 'Pair';

      return {
        dosageForm: 'General Material',
        packSize: '1 unit',
        stockUnit,
        presentation: `${stockUnit}`,
      };
    }

    // Medicine Presentation Extraction
    let dosageForm = 'Tablet';
    let packSize = '10 tablets';
    let stockUnit = 'Strip';

    if (/inj(?:ection)?|vial/i.test(l)) {
      dosageForm = 'Injection';
      stockUnit = 'Vial';
      const volMatch = name.match(/(\d+(?:\.\d+)?\s*(?:ml|l))/i);
      packSize = volMatch ? volMatch[1] : '10 ml';
    } else if (/syr(?:up)?|susp(?:ension)?|oral\s*liquid|liquid/i.test(l)) {
      dosageForm = /susp/i.test(l) ? 'Suspension' : 'Syrup';
      stockUnit = 'Bottle';
      const volMatch = name.match(/(\d+(?:\.\d+)?\s*(?:ml|l))/i);
      packSize = volMatch ? volMatch[1] : '60 ml';
    } else if (/drop(?:s)?|eye\s*drops|ear\s*drops/i.test(l)) {
      dosageForm = 'Eye/Ear Drops';
      stockUnit = 'Bottle';
      const volMatch = name.match(/(\d+(?:\.\d+)?\s*(?:ml))/i);
      packSize = volMatch ? volMatch[1] : '5 ml';
    } else if (/oint(?:ment)?|gel|cream/i.test(l)) {
      dosageForm = 'Ointment';
      stockUnit = 'Tube';
      const wtMatch = name.match(/(\d+(?:\.\d+)?\s*(?:gm|g))/i);
      packSize = wtMatch ? wtMatch[1] : '20 gm';
    } else if (/bolus/i.test(l)) {
      dosageForm = 'Bolus';
      stockUnit = 'Strip';
      packSize = '4 bolus';
    } else if (/powder|sachet/i.test(l)) {
      dosageForm = 'Powder';
      stockUnit = 'Sachet';
      const wtMatch = name.match(/(\d+(?:\.\d+)?\s*(?:gm|g|kg))/i);
      packSize = wtMatch ? wtMatch[1] : '100 gm';
    } else {
      dosageForm = /cap(?:sule)?/i.test(l) ? 'Capsule' : 'Tablet';
      stockUnit = 'Strip';
      const countMatch = name.match(/(\d+)\s*(?:tabs?|caps?|tablets?)/i);
      packSize = countMatch ? `${countMatch[1]} ${dosageForm.toLowerCase()}s` : `10 ${dosageForm.toLowerCase()}s`;
    }

    const presentation = `${dosageForm}, ${packSize} ${stockUnit.toLowerCase()}`;

    return { dosageForm, packSize, stockUnit, presentation };
  }

  private static cleanItemName(rawName: string): string {
    return rawName
      .replace(/\b(?:inj|injection|vial|syr|syrup|susp|suspension|drops?|oint|ointment|tab|tabs|tablet|tablets|bolus|cap|capsules?)\b/gi, '')
      .replace(/\b\d+(?:\.\d+)?\s*(?:mg|g|gm|ml|l|iu|mcg|%|w\/v|w\/w)\b/gi, '')
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static matchCatalogue(
    cleanedName: string,
    rawName: string,
    catalogue: MasterCatalogueItem[]
  ): {
    matchedId: string | null;
    matchedType: 'medicine' | 'item' | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    candidates: Array<{ id: string; name: string; type: 'medicine' | 'item' }>;
  } {
    if (!cleanedName || catalogue.length === 0) {
      return { matchedId: null, matchedType: null, confidence: 'NONE', candidates: [] };
    }

    const normTarget = cleanedName.toLowerCase();
    const targetWords = normTarget.split(' ').filter((w) => w.length > 2);

    const scored = catalogue.map((cat) => {
      const catNorm = cat.name.toLowerCase();
      const catClean = this.cleanItemName(cat.name).toLowerCase();

      // Exact clean match
      if (catClean === normTarget || catNorm === rawName.toLowerCase()) {
        return { item: cat, score: 1.0 };
      }

      // Starts with or contains
      if (catClean.startsWith(normTarget) || normTarget.startsWith(catClean)) {
        return { item: cat, score: 0.85 };
      }

      // Token overlap
      let matches = 0;
      for (const w of targetWords) {
        if (catClean.includes(w)) matches++;
      }
      const score = targetWords.length > 0 ? matches / targetWords.length : 0;
      return { item: cat, score };
    });

    const matches = scored.filter((s) => s.score >= 0.5).sort((a, b) => b.score - a.score);

    if (matches.length === 0) {
      return { matchedId: null, matchedType: null, confidence: 'NONE', candidates: [] };
    }

    const best = matches[0];
    const candidates = matches.slice(0, 4).map((m) => ({
      id: m.item.id,
      name: m.item.name,
      type: m.item.type,
    }));

    if (best.score >= 0.85) {
      return {
        matchedId: best.item.id,
        matchedType: best.item.type,
        confidence: 'HIGH',
        candidates,
      };
    }

    return {
      matchedId: best.item.id,
      matchedType: best.item.type,
      confidence: 'MEDIUM',
      candidates,
    };
  }

  private static normalizeExpiryDate(str: string): string {
    const clean = str.trim().replace(/[-.]/g, '/');
    const parts = clean.split('/');

    let month = 1;
    let year = 2026;

    if (parts.length >= 2) {
      month = parseInt(parts[0], 10);
      year = parseInt(parts[1], 10);

      // Handle 2-digit year (e.g. 28 -> 2028)
      if (year < 100) {
        year = 2000 + year;
      }
    }

    if (isNaN(month) || month < 1 || month > 12) month = 12;
    if (isNaN(year) || year < 2020) year = 2028;

    return `${year}-${String(month).padStart(2, '0')}-01`;
  }

  private static normalizeDateString(str: string): string {
    const clean = str.trim().replace(/[-.]/g, '/');
    const parts = clean.split('/');

    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      // DD/MM/YYYY
      let y = parseInt(parts[2], 10);
      if (y < 100) y = 2000 + y;
      return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    return new Date().toISOString().split('T')[0];
  }
}
