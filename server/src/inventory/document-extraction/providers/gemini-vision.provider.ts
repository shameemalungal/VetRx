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

    const prompt = `You are an expert document understanding system specialized in Indian pharmaceutical and veterinary medicine purchase invoices.

Analyze the uploaded invoice visually.
Understand the physical structure and spatial layout of the document.
1. First locate the actual line-item table.
2. Identify its column headers (e.g. Particulars/Description/Product, Packing, HSN, Batch, Exp, Qty, Sch Qty, MRP, Rate, Disc%, GST%, Taxable).
3. Then identify every physical product row in the table.
4. For every physical row, map each cell to the correct semantic column based on its visual position.
5. Do NOT move values between adjacent columns.
6. Do NOT interpret bank details (A/C No, IFSC, Branch), addresses, invoice metadata, tax summaries, declarations, customer info, or footer info as products.
7. Return one structured line-item object for every physical product row.
8. If a value is genuinely unreadable, return null rather than guessing.
9. Do not invent product names, batch numbers, quantities, prices, dates, HSN codes, GST rates, or other values.
10. Preserve the original product description as accurately as possible.
11. Normalize expiry dates to YYYY-MM-01 (e.g. 08/27 -> 2027-08-01, 05/28 -> 2028-05-01). If expiry date or batch is omitted or blank (such as in Sales Orders / Delivery Challans), return null for expiryDate and 'SO-BATCH' for batchNumber.
12. Ensure 'purchaseRate' is strictly the UNIT purchase rate (e.g. 43.00, 30.00, 100.00), NOT the line total amount (e.g. 8600.00), and 'taxableValue' is quantity * unit rate (e.g. 200 * 43.00 = 8600.00).
13. If this document has multiple pages, extract all product rows across ALL pages without stopping early. Verify against total item count on the summary page.

Return strict JSON matching this exact structure:
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
    "totalAmount": 0.00,
    "taxableAmount": 0.00,
    "totalTax": 0.00,
    "totalDiscount": 0.00,
    "totalItems": 0,
    "totalQuantity": 0
  },
  "lineItems": [
    {
      "lineNumber": 1,
      "itemName": "PRODUCT NAME",
      "packing": "5gm",
      "hsnCode": "30049099",
      "batchNumber": "BATCH123",
      "expiryDate": "YYYY-MM-01",
      "quantity": 10,
      "schemeQuantity": 0,
      "mrp": 165.00,
      "purchaseRate": 119.43,
      "schemeDiscountPercent": 0,
      "discountPercent": 0,
      "gstPercent": 5,
      "taxableValue": 1074.87,
      "confidence": "HIGH"
    }
  ]
}`;

    const configuredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const modelsToTry = [configuredModel, 'gemini-1.5-flash', 'gemini-2.0-flash'];
    const uniqueModels = [...new Set(modelsToTry)];

    let lastError: Error | null = null;

    for (const model of uniqueModels) {
      try {
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
          throw new Error(`Gemini Vision API (${model}) error ${response.status}: ${errText}`);
        }

        const data: any = await response.json();
        const candidateText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!candidateText) {
          throw new Error(`Empty response from Gemini Vision AI (${model})`);
        }

        let parsed: any;
        try {
          parsed = JSON.parse(candidateText);
        } catch {
          const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error(`Failed to parse JSON response from Gemini Vision AI (${model})`);
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
            confidence: item.confidence === 'LOW' ? 'LOW' : item.confidence === 'MEDIUM' ? 'MEDIUM' : 'HIGH',
          })),
          warnings: [],
        };
      } catch (err: any) {
        console.warn(`[GeminiVisionProvider] Attempt with model ${model} failed: ${err.message}`);
        lastError = err;
      }
    }

    throw lastError || new Error('Gemini Vision AI extraction failed across all candidate models');
  }
}
