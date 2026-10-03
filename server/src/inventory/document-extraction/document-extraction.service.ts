// ==============================================================================
// VetRx Document Extraction — Orchestrator & Multi-Provider Service
// Vision AI + Spatial Table Layout OCR + Text Fallback Engine
// ==============================================================================

import type {
  ExtractedInvoiceItemDTO,
  InvoiceExtractionResultDTO,
  InventoryCategory,
} from '../inventory.types.js';
import type {
  StructuredInvoiceDocument,
  DocumentExtractionLineItem,
} from './document-extraction.types.js';
import { GeminiVisionProvider } from './providers/gemini-vision.provider.js';
import { SpatialLayoutProvider } from './providers/spatial-layout.provider.js';
import { TextParserProvider } from './providers/text-parser.provider.js';
import { PdfExtractorProvider } from './providers/pdf-extractor.provider.js';
import { InventoryService } from '../inventory.service.js';

interface MasterCatalogueItem {
  id: string;
  name: string;
  genericName?: string | null;
  presentation?: string | null;
  type: 'medicine' | 'item';
}

export class DocumentExtractionService {
  private static visionProvider = new GeminiVisionProvider();
  private static spatialProvider = new SpatialLayoutProvider();
  private static textProvider = new TextParserProvider();
  private static pdfProvider = new PdfExtractorProvider();

  /**
   * Main entry point for Document Understanding from an image or PDF buffer.
   */
  static async extractDocument(
    buffer: Buffer,
    mimeType = 'image/jpeg',
    practiceId?: string,
    existingCatalogue: MasterCatalogueItem[] = [],
    existingInvoiceKeys: Array<{ supplierName: string; invoiceNumber: string; id: string }> = []
  ): Promise<InvoiceExtractionResultDTO> {
    let structuredDoc: StructuredInvoiceDocument | null = null;
    const warnings: string[] = [];

    const isPdf =
      mimeType === 'application/pdf' ||
      (buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46);

    const actualMimeType = isPdf ? 'application/pdf' : mimeType;

    // Step 1: Attempt Gemini Vision AI if API key is configured
    if (this.visionProvider.isAvailable()) {
      try {
        console.log('[DocumentExtractionService] Attempting Gemini Vision AI extraction...');
        structuredDoc = await this.visionProvider.extractDocument({
          buffer,
          mimeType: actualMimeType,
        });
        console.log(
          `[DocumentExtractionService] Vision AI succeeded: ${structuredDoc.lineItems.length} line items detected.`
        );
      } catch (err: any) {
        console.warn(
          `[DocumentExtractionService] Vision AI failed (${err.message}). Gracefully falling back to Document Layout Extractor...`
        );
        warnings.push(`Vision AI unavailable (${err.message}); processed with Layout-Aware Extractor.`);
      }
    }

    // Step 2: Fall back to appropriate document extractor
    if (!structuredDoc) {
      if (isPdf) {
        console.log('[DocumentExtractionService] Running Multi-Page PDF Spatial Extractor...');
        structuredDoc = await this.pdfProvider.extractDocument({
          buffer,
          mimeType: 'application/pdf',
        });
        console.log(
          `[DocumentExtractionService] PDF Spatial Extractor succeeded: ${structuredDoc.lineItems.length} line items detected.`
        );
      } else {
        console.log('[DocumentExtractionService] Running Spatial Layout-Aware Table Extractor...');
        structuredDoc = await this.spatialProvider.extractDocument({
          buffer,
          mimeType: actualMimeType,
        });
        console.log(
          `[DocumentExtractionService] Spatial Layout OCR succeeded: ${structuredDoc.lineItems.length} line items detected.`
        );
      }
    }

    // Step 3: Process structured document into standardized InvoiceExtractionResultDTO
    return this.postProcessStructuredDocument(
      structuredDoc,
      practiceId,
      existingCatalogue,
      existingInvoiceKeys,
      warnings
    );
  }

  /**
   * Fallback for plain text input (e.g. pasted text).
   */
  static async extractFromText(
    rawContent: string,
    practiceId?: string,
    existingCatalogue: MasterCatalogueItem[] = [],
    existingInvoiceKeys: Array<{ supplierName: string; invoiceNumber: string; id: string }> = []
  ): Promise<InvoiceExtractionResultDTO> {
    const structuredDoc = await this.textProvider.extractDocument({
      buffer: Buffer.from(rawContent, 'utf-8'),
      rawText: rawContent,
    });

    return this.postProcessStructuredDocument(
      structuredDoc,
      practiceId,
      existingCatalogue,
      existingInvoiceKeys
    );
  }

  /**
   * Post-processes intermediate structured document with semantic validation,
   * catalogue matching, and discrepancy checks.
   */
  private static async postProcessStructuredDocument(
    doc: StructuredInvoiceDocument,
    practiceId?: string,
    existingCatalogue: MasterCatalogueItem[] = [],
    existingInvoiceKeys: Array<{ supplierName: string; invoiceNumber: string; id: string }> = [],
    extraWarnings: string[] = []
  ): Promise<InvoiceExtractionResultDTO> {
    let existingPurchases: any[] = [];
    if (practiceId && existingInvoiceKeys.length === 0) {
      try {
        existingPurchases = await InventoryService.listPurchases(practiceId);
      } catch {}
    }

    const warnings: string[] = [...(doc.warnings || []), ...extraWarnings];

    const supplierName = doc.supplier.name || 'Veterinary Distributor';
    const supplierGstin = doc.supplier.gstin || null;

    const invoiceNumber = doc.invoice.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
    const invoiceDate = doc.invoice.invoiceDate || new Date().toISOString().split('T')[0];
    const invoiceTime = doc.invoice.invoiceTime || null;
    const dueDate = doc.invoice.dueDate || null;
    const paymentType = doc.invoice.paymentType || 'CREDIT';
    const customer = doc.customer || {};

    // Duplicate Check
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

    // Filter out non-product noise rows
    const invalidNamePhrases = /^(?:BRANCH|BANK|A\/C\s*NO|ACCOUNT|IFSC|GSTIN|INVOICE\s*NO|CUSTOMER|TOTAL|TAX\s*SUMMARY|DECLARATION|TERMS|CONDITIONS|SIGNATURE|NOTE:)/i;
    const validLineItems = doc.lineItems.filter((it) => {
      const name = (it.itemName || '').trim();
      if (!name || name.length < 2) return false;
      if (invalidNamePhrases.test(name)) return false;
      return true;
    });

    // Line Items Normalization & Medicine Master Matching
    const items: ExtractedInvoiceItemDTO[] = validLineItems.map((raw, idx) => {
      const matched = this.matchWithCatalogue(raw.itemName, existingCatalogue);
      const calculatedLineTotal =
        typeof raw.taxableValue === 'number' && raw.taxableValue > 0
          ? raw.taxableValue
          : Math.round((raw.quantity || 1) * (raw.purchaseRate || 0) * 100) / 100;

      return {
        tempId: `item-${idx + 1}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        lineNumber: idx + 1,
        name: raw.itemName,
        category: matched.category,
        packing: raw.packing || matched.packSize || '',
        packSize: raw.packing || matched.packSize || '',
        stockUnit: 'UNIT',
        presentation: raw.packing || matched.packSize || '',
        hsnCode: raw.hsnCode || '',
        batchNumber: raw.batchNumber || 'BATCH-DETECT',
        expiryDate: raw.expiryDate || '',
        quantity: typeof raw.quantity === 'number' && raw.quantity > 0 ? raw.quantity : 1,
        schemeQuantity: typeof raw.schemeQuantity === 'number' ? raw.schemeQuantity : 0,
        freeQuantity: typeof raw.schemeQuantity === 'number' ? raw.schemeQuantity : 0,
        purchaseRate: typeof raw.purchaseRate === 'number' ? raw.purchaseRate : 0,
        mrp: typeof raw.mrp === 'number' ? raw.mrp : 0,
        schemeDiscountPercent: typeof raw.schemeDiscountPercent === 'number' ? raw.schemeDiscountPercent : 0,
        discountPercent: typeof raw.discountPercent === 'number' ? raw.discountPercent : 0,
        gstPercent: typeof raw.gstPercent === 'number' ? raw.gstPercent : 5,
        taxableValue: calculatedLineTotal,
        lineTotal: calculatedLineTotal,
        confidence: raw.confidence || 'HIGH',
        rawOcrText: raw.rawOcrText,
        matchedMedicineId: matched.medicineId || null,
        matchedItemId: matched.itemId || null,
        matchConfidence: matched.medicineId || matched.itemId ? 'HIGH' : 'NONE',
        flags: [],
      };
    });

    if (items.length === 0) {
      warnings.push(
        'No line items were automatically detected. Please check document quality or enter items manually.'
      );
    }

    // Totals & Cross-Checks
    const totalItems = doc.invoice.totalItems || items.length;
    const sumQty = items.reduce((sum, it) => sum + it.quantity, 0);
    const totalQuantity = doc.invoice.totalQuantity || sumQty;

    if (doc.invoice.totalItems && items.length !== doc.invoice.totalItems) {
      warnings.push(
        `Detected ${items.length} items; invoice header states Total Items: ${doc.invoice.totalItems}.`
      );
    }

    if (doc.invoice.totalQuantity && sumQty !== doc.invoice.totalQuantity) {
      warnings.push(
        `Sum of item quantities (${sumQty}) differs from invoice header Total Qty: ${doc.invoice.totalQuantity}.`
      );
    }

    const calculatedTaxable = items.reduce(
      (sum, it) => sum + (it.taxableValue || it.quantity * it.purchaseRate),
      0
    );
    const taxableAmount =
      doc.invoice.taxableAmount || Math.round(calculatedTaxable * 100) / 100;
    const finalTotal =
      typeof doc.invoice.totalAmount === 'number' && doc.invoice.totalAmount > 0
        ? doc.invoice.totalAmount
        : typeof taxableAmount === 'number' && taxableAmount > 0
        ? Math.round(taxableAmount * 1.05 * 100) / 100
        : Math.round(calculatedTaxable * 100) / 100;

    return {
      supplier: {
        name: supplierName,
        gstin: supplierGstin,
        pan: doc.supplier.pan,
        fssai: doc.supplier.fssai,
        phone: doc.supplier.phone,
        email: doc.supplier.email,
        dlNo: doc.supplier.dlNo,
        address: doc.supplier.address,
        state: doc.supplier.state,
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
      taxableAmount,
      totalTax:
        doc.invoice.totalTax ||
        (taxableAmount ? Math.round((finalTotal - taxableAmount) * 100) / 100 : undefined),
      totalDiscount: doc.invoice.totalDiscount,
      totalItems,
      totalQuantity,
      netPayable: finalTotal,
      totalAmount: finalTotal,
      items,
      isDuplicate: isDuplicateWarning,
      isDuplicateWarning,
      duplicateMessage,
      existingPurchaseId,
      warnings,
      detectedCount: items.length,
      confidence: items.length > 0 ? 'HIGH' : 'LOW',
    };
  }

  private static matchWithCatalogue(
    rawName: string,
    catalogue: MasterCatalogueItem[]
  ): {
    category: InventoryCategory;
    packSize?: string;
    medicineId?: string;
    itemId?: string;
  } {
    if (!rawName) return { category: 'MEDICINE' };

    const norm = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Determine category heuristically
    let category: InventoryCategory = 'MEDICINE';
    if (/(?:INJECTION|VIAL|AMP|SUSP|SYRUP|DROPS|TAB|TABLET|OINTMENT|BOLUS|POWDER|VACCINE|RABIES|DHPPIL)/i.test(rawName)) {
      category = 'MEDICINE';
    } else if (/(?:SURGICAL|SUTURE|BLADE|SCALPEL|DRAPE|FORCEPS)/i.test(rawName)) {
      category = 'SURGICAL_MATERIAL';
    } else if (/(?:LAB|REAGENT|STRIP|TUBE|STAIN|RAPID)/i.test(rawName)) {
      category = 'LAB_MATERIAL';
    } else if (/(?:SYRINGE|NEEDLE|GAUZE|BANDAGE|GLOVES|CATHETER|FOOD|CANIN|RC|PEDIGREE|NUTRITION|DIET|MEAT|SHAMPOO|SOAP|CLEANER|SANITIZER)/i.test(rawName)) {
      category = 'CONSUMABLE';
    }

    if (!catalogue || catalogue.length === 0) {
      return { category };
    }

    // Direct / Normalized substring match against practice catalogue
    for (const catItem of catalogue) {
      const catNorm = catItem.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm.includes(catNorm) || catNorm.includes(norm)) {
        return {
          category,
          packSize: catItem.presentation || undefined,
          medicineId: catItem.type === 'medicine' ? catItem.id : undefined,
          itemId: catItem.type === 'item' ? catItem.id : undefined,
        };
      }
    }

    return { category };
  }
}
