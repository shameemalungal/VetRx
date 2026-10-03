// ==============================================================================
// VetRx Document Extraction — Strongly Typed Intermediate Representation
// ==============================================================================

export interface DocumentExtractionSupplier {
  name: string;
  gstin?: string | null;
  pan?: string | null;
  fssai?: string | null;
  phone?: string | null;
  email?: string | null;
  dlNo?: string | null;
  address?: string | null;
  state?: string | null;
}

export interface DocumentExtractionCustomer {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  gstin?: string | null;
}

export interface DocumentExtractionInvoiceMeta {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTime?: string | null;
  dueDate?: string | null;
  paymentType: string;
  totalAmount?: number;
  taxableAmount?: number;
  totalTax?: number;
  totalDiscount?: number;
  totalItems?: number;
  totalQuantity?: number;
}

export interface DocumentExtractionLineItem {
  lineNumber: number;
  itemName: string;
  packing?: string;
  hsnCode?: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  schemeQuantity?: number;
  mrp?: number;
  purchaseRate: number;
  schemeDiscountPercent?: number;
  discountPercent?: number;
  gstPercent?: number;
  taxableValue?: number;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  rawOcrText?: string;
}

export interface StructuredInvoiceDocument {
  provider: 'vision-ai' | 'spatial-layout-ocr' | 'text-parser';
  supplier: DocumentExtractionSupplier;
  customer: DocumentExtractionCustomer;
  invoice: DocumentExtractionInvoiceMeta;
  lineItems: DocumentExtractionLineItem[];
  warnings: string[];
}

export interface IDocumentExtractionProvider {
  name: string;
  isAvailable(): boolean;
  extractDocument(payload: {
    buffer: Buffer;
    mimeType?: string;
    rawText?: string;
    fileName?: string;
  }): Promise<StructuredInvoiceDocument>;
}
