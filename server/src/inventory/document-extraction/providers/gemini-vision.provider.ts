// ==============================================================================
// VetRx Document Extraction — Gemini Vision AI Provider
// Multimodal document understanding for pharmaceutical purchase invoices
// ==============================================================================

import type {
  IDocumentExtractionProvider,
  StructuredInvoiceDocument,
} from '../document-extraction.types.js';

export class GeminiVisionProvider implements IDocumentExtractionProvider {
  name = 'Gemini Vision AI';

  isAvailable(): boolean {
    const key =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;
    return !!key && key.trim().length > 0;
  }

  private getApiKey(): string | null {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY ||
      null
    );
  }

  async extractDocument(payload: {
    buffer: Buffer;
    mimeType?: string;
    rawText?: string;
    fileName?: string;
  }): Promise<StructuredInvoiceDocument> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const mimeType = payload.mimeType || 'image/jpeg';
    const base64Data = payload.buffer.toString('base64');

    const prompt = `You are an expert veterinary pharmaceutical invoice parser. Analyze this invoice document and extract all data into structured JSON with 100% precision.

CRITICAL RULES:
1. Extract ALL medicine rows from the actual line-item table. Do NOT skip any row.
2. Do NOT mistake bank details (e.g. Bank name, account number, branch, IFSC), tax breakdown summaries (SGST/CGST), or footer declarations as medicine line items.
3. For every medicine line item, extract:
   - lineNumber (1-indexed)
   - itemName (full proprietary or generic product name, clean without noise/manufacturer prefixes)
   - packing (e.g., 5gm, 5ml, 30ML, 10's, 100s)
   - hsnCode (numeric, usually 8 digits like 30049099)
   - batchNumber (alphanumeric, like F-034, OPG472, IN2609)
   - expiryDate (format as YYYY-MM-01 or YYYY-MM-DD; if 08/27, output 2027-08-01)
   - quantity (numeric)
   - schemeQuantity (numeric, 0 if none)
   - mrp (numeric, Maximum Retail Price per unit)
   - purchaseRate (numeric, unit rate before tax)
   - schemeDiscountPercent (numeric)
   - discountPercent (numeric)
   - gstPercent (numeric, typically 5, 12, 18)
   - taxableValue (numeric)

4. Return ONLY valid JSON matching this exact structure:
{
  "supplier": {
    "name": "Supplier or Distributor Company Name",
    "gstin": "15-character GSTIN or null",
    "pan": "PAN or null",
    "fssai": "FSSAI or null",
    "phone": "Phone number or null",
    "email": "Email address or null",
    "dlNo": "Drug License number or null",
    "address": "Full address or null",
    "state": "State name or null"
  },
  "customer": {
    "name": "Customer / Clinic Name or null",
    "address": "Address or null",
    "phone": "Phone or null",
    "gstin": "GSTIN or null"
  },
  "invoice": {
    "invoiceNumber": "Invoice / Bill number",
    "invoiceDate": "YYYY-MM-DD",
    "invoiceTime": "HH:MM AM/PM or null",
    "dueDate": "YYYY-MM-DD or null",
    "paymentType": "CREDIT or CASH",
    "totalAmount": 18432.00,
    "taxableAmount": 17554.58,
    "totalTax": 877.73,
    "totalDiscount": 3001.07,
    "totalItems": 9,
    "totalQuantity": 137
  },
  "lineItems": [
    {
      "lineNumber": 1,
      "itemName": "EYEGEL",
      "packing": "5gm",
      "hsnCode": "30049099",
      "batchNumber": "F-034",
      "expiryDate": "2027-08-01",
      "quantity": 10,
      "schemeQuantity": 0,
      "mrp": 165.00,
      "purchaseRate": 119.43,
      "schemeDiscountPercent": 10.0,
      "discountPercent": 0,
      "gstPercent": 5,
      "taxableValue": 1074.87,
      "confidence": "HIGH"
    }
  ]
}`;

    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini Vision API error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!candidateText) {
      throw new Error('Empty response received from Gemini Vision AI');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      // Clean possible markdown code fences
      const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON response from Gemini Vision AI');
      }
    }

    return {
      provider: 'vision-ai',
      supplier: {
        name: parsed.supplier?.name || 'Veterinary Distributor',
        gstin: parsed.supplier?.gstin || null,
        pan: parsed.supplier?.pan || null,
        fssai: parsed.supplier?.fssai || null,
        phone: parsed.supplier?.phone || null,
        email: parsed.supplier?.email || null,
        dlNo: parsed.supplier?.dlNo || null,
        address: parsed.supplier?.address || null,
        state: parsed.supplier?.state || null,
      },
      customer: {
        name: parsed.customer?.name || null,
        address: parsed.customer?.address || null,
        phone: parsed.customer?.phone || null,
        gstin: parsed.customer?.gstin || null,
      },
      invoice: {
        invoiceNumber: parsed.invoice?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        invoiceDate: parsed.invoice?.invoiceDate || new Date().toISOString().split('T')[0],
        invoiceTime: parsed.invoice?.invoiceTime || null,
        dueDate: parsed.invoice?.dueDate || null,
        paymentType: parsed.invoice?.paymentType || 'CREDIT',
        totalAmount: typeof parsed.invoice?.totalAmount === 'number' ? parsed.invoice.totalAmount : undefined,
        taxableAmount: typeof parsed.invoice?.taxableAmount === 'number' ? parsed.invoice.taxableAmount : undefined,
        totalTax: typeof parsed.invoice?.totalTax === 'number' ? parsed.invoice.totalTax : undefined,
        totalDiscount: typeof parsed.invoice?.totalDiscount === 'number' ? parsed.invoice.totalDiscount : undefined,
        totalItems: typeof parsed.invoice?.totalItems === 'number' ? parsed.invoice.totalItems : parsed.lineItems?.length,
        totalQuantity: typeof parsed.invoice?.totalQuantity === 'number' ? parsed.invoice.totalQuantity : undefined,
      },
      lineItems: (parsed.lineItems || []).map((item: any, idx: number) => ({
        lineNumber: item.lineNumber || idx + 1,
        itemName: (item.itemName || '').trim(),
        packing: item.packing || '',
        hsnCode: item.hsnCode || '',
        batchNumber: item.batchNumber || 'BATCH-DETECT',
        expiryDate: item.expiryDate || '',
        quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
        schemeQuantity: typeof item.schemeQuantity === 'number' ? item.schemeQuantity : 0,
        mrp: typeof item.mrp === 'number' ? item.mrp : 0,
        purchaseRate: typeof item.purchaseRate === 'number' ? item.purchaseRate : 0,
        schemeDiscountPercent: typeof item.schemeDiscountPercent === 'number' ? item.schemeDiscountPercent : 0,
        discountPercent: typeof item.discountPercent === 'number' ? item.discountPercent : 0,
        gstPercent: typeof item.gstPercent === 'number' ? item.gstPercent : 5,
        taxableValue: typeof item.taxableValue === 'number' ? item.taxableValue : 0,
        confidence: 'HIGH',
      })),
      warnings: [],
    };
  }
}
