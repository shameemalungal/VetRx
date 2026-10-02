// ==============================================================================
// VetRx — Universal Purchase Invoice Importer & Semantic Parser
// Format-agnostic, semantic invoice extraction for PDF, Images & Text
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
   * Universal format-agnostic parsing of purchase invoice text content with practice-aware duplicate checking.
   */
  static async parseInvoiceText(
    rawContent: string,
    practiceId?: string
  ): Promise<any> {
    let existingPurchases: any[] = [];
    if (practiceId) {
      existingPurchases = await InventoryService.listPurchases(practiceId);
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

    if (invoiceNumber && existingPurchases.length > 0) {
      const normInv = invoiceNumber.trim().toLowerCase();
      const match = existingPurchases.find(
        (p) => p.invoiceNumber && p.invoiceNumber.trim().toLowerCase() === normInv
      );
      if (match) {
        isDuplicateWarning = true;
        duplicateMessage = `Duplicate invoice warning: Invoice ${invoiceNumber} already exists for this practice.`;
      }
    }

    const rawItems = this.extractLineItems(lines);
    const items = rawItems.map((raw, idx) => {
      const item = this.normalizeAndMatchItem(raw, idx, []);
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

    return {
      supplier: {
        name: supplierName,
        gstin: supplierGstin,
      },
      supplierName,
      supplierGstin,
      invoiceNumber,
      invoiceDate,
      totalAmount,
      isDuplicateWarning,
      duplicateMessage,
      items,
      warnings,
    };
  }

  /**
   * Universal format-agnostic parsing of purchase invoice text content.
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

    // 1. Extract Invoice Metadata (Supplier, Invoice Number, Date, GSTIN)
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
      return this.normalizeAndMatchItem(raw, idx, existingCatalogue);
    });

    if (items.length === 0) {
      warnings.push('No line items were automatically detected. Please check document quality or enter items manually.');
    }

    return {
      supplierName: supplierInfo || 'Unknown Supplier',
      supplierGstin,
      invoiceNumber: invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
      totalAmount,
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
        !/(?:invoice|bill\s*to|ship\s*to|gstin|pan|date|dl\s*no)/i.test(line) &&
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
        if (!/date|gstin|terms/i.test(val)) {
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
  // Line Items Parsing
  // --------------------------------------------------------------------------

  private static extractLineItems(lines: string[]): any[] {
    const items: any[] = [];

    // Detect header row index
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].toLowerCase();
      const hasProduct = /item|product|description|particulars|medicine|drug/i.test(l);
      const hasBatchOrQty = /batch|b\.no|qty|quantity|pack/i.test(l);
      if (hasProduct && hasBatchOrQty) {
        headerIdx = i;
        break;
      }
    }

    const contentLines = headerIdx !== -1 ? lines.slice(headerIdx + 1) : lines.slice(8);

    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];

      // Stop condition: summary totals reached
      if (/^(?:total|grand\s*total|subtotal|terms|bank\s*details|declaration|rupees\s*in\s*words|amount\s*in\s*words)/i.test(line)) {
        break;
      }

      // Ignore noise lines
      if (line.length < 5 || /page\s*\d|\*{4,}|={4,}|-{4,}/i.test(line)) {
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
    // 1. Check for key-value formatted line (e.g. Item: Sample Medicine Qty: 5 Batch: B1 Exp: 01/2028 Rate: 100)
    const kvMatch = line.match(/(?:Item|Particulars)[\s:]+(.*?)(?=\s*Qty:|\s*Batch:|$)(?:\s*Qty[\s:]+(\d+))?(?:\s*Batch[\s:]+([^\s]+))?(?:\s*Exp(?:iry)?[\s:]+([^\s]+))?(?:\s*Rate[\s:]+([\d.]+))?(?:\s*MRP[\s:]+([\d.]+))?/i);
    if (kvMatch && kvMatch[1]) {
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
        purchaseRate: kvRate,
        mrp: kvMrp,
        packSize: '',
      };
    }

    // Look for quantity
    const numbers = line.match(/\b\d+(?:\.\d+)?\b/g);
    if (!numbers || numbers.length === 0) return null;

    let batch = '';
    let expiry = '';
    let packSize = '';
    let qty = 1;
    let rate = 0;
    let mrp = 0;

    // Pattern matching standard invoice column flow
    const cols = line.split(/\s{2,}|\t|\|/).map((c) => c.trim()).filter(Boolean);

    let name = '';

    if (cols.length >= 3) {
      name = cols[0].replace(/^\d+[\s.-]+/, ''); // remove leading serial number
      const remainingCols = cols.slice(1);
      const remainingNumbers: number[] = [];

      for (const col of remainingCols) {
        if (!packSize && /^\d+(?:\.\d+)?\s*(?:ml|l|mg|g|gm|kg|pcs|piece|pieces|tabs?|caps?|vials?|amps?|foils?|box|strip)$/i.test(col)) {
          packSize = col;
          continue;
        }
        if (!expiry && /\b(0[1-9]|1[0-2])[\/.-](\d{2}|\d{4})\b/.test(col)) {
          expiry = this.normalizeExpiryDate(col);
          continue;
        }
        if (!expiry && /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/.test(col)) {
          expiry = this.normalizeDateString(col);
          continue;
        }
        if (!batch && /^[A-Z0-9-]{3,15}$/i.test(col) && !/^\d+(?:\.\d+)?$/.test(col)) {
          batch = col;
          continue;
        }
        const num = parseFloat(col.replace(/,/g, ''));
        if (!isNaN(num)) {
          remainingNumbers.push(num);
        }
      }

      if (remainingNumbers.length >= 1) {
        qty = remainingNumbers[0];
      }
      if (remainingNumbers.length >= 2) {
        rate = remainingNumbers[1];
      }
      if (remainingNumbers.length >= 3) {
        mrp = remainingNumbers[2];
      }
    } else {
      // Single continuous string line: parse using regex boundaries
      const cleaned = line.replace(/^\d+[\s.-]+/, '');
      const tokens = cleaned.split(/\s+/);
      const nameTokens: string[] = [];

      for (const t of tokens) {
        const num = parseFloat(t.replace(/,/g, ''));
        if (!isNaN(num) && (t.includes('.') || nameTokens.length >= 2)) {
          if (qty === 1 && Number.isInteger(num) && num > 0 && num <= 10000) {
            qty = num;
          } else if (rate === 0 && num > 0) {
            rate = num;
          } else if (mrp === 0 && num >= rate) {
            mrp = num;
          }
        } else if (!batch && /^[A-Z0-9]{3,12}$/i.test(t) && !/tab|inj|syr|strip|bottle|mg|ml|gm/i.test(t) && /\d/.test(t)) {
          batch = t;
        } else if (!expiry && /\d{1,2}[\/.-]\d{2,4}/.test(t)) {
          expiry = this.normalizeExpiryDate(t);
        } else if (rate === 0) {
          nameTokens.push(t);
        }
      }
      name = nameTokens.join(' ');
    }

    if (!name || name.length < 2) return null;

    return {
      name: name.trim(),
      batch: batch || 'BATCH-DETECT',
      expiry: expiry || '',
      quantity: qty,
      purchaseRate: rate,
      mrp: mrp > 0 ? mrp : Math.round(rate * 1.3),
      packSize: packSize || '',
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
      // Default to 18 months from now for safety review
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
      packSize,
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
      // Generic non-medicine packaging
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
      // Tablets / Capsules
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

    // Standard normalized monthly expiry format: YYYY-MM-01
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
