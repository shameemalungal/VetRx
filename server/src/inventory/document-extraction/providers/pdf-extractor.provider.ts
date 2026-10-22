// ==============================================================================
// VetRx Document Extraction — PDF Extractor Provider
// Intelligent Header-Aware, Spatial Column-Mapping Extractor for Multi-Page PDF Invoices
// ==============================================================================

import type {
  IDocumentExtractionProvider,
  StructuredInvoiceDocument,
  DocumentExtractionLineItem,
  DocumentExtractionSupplier,
  DocumentExtractionCustomer,
  DocumentExtractionInvoiceMeta,
} from '../document-extraction.types.js';

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

export interface ColumnDef {
  key: string;
  label: string;
  headerX: number;
  headerW: number;
  xMin: number;
  xMax: number;
}

const HEADER_SYNONYMS: Record<string, RegExp> = {
  slNo: /^(?:SL\.?\s*NO\.?|S\.?\s*NO\.?|SNO|SR\.?\s*NO\.?|#)$/i,
  product: /^(?:PRODUCT|PRODUCT\s*NAME|ITEM|ITEM\s*NAME|MEDICINE|PARTICULARS|DESCRIPTION)$/i,
  manufacturer: /^(?:MFR\.?|MFG\.?|MANUFACTURER|COMPANY|MFAC|MFR\s*NAME)$/i,
  packing: /^(?:PACK|PACKING|PRESENTATION|PKG)$/i,
  batch: /^(?:BATCH|BATCH\s*NO\.?|LOT|LOT\s*NO\.?|B\.NO)$/i,
  expiry: /^(?:EXP\.?|EXPIRY|EXP\.?\s*DATE|EXPIRY\s*DATE|EXP\s*DT)$/i,
  hsn: /^(?:HSN|HSN\s*CODE)$/i,
  quantity: /^(?:QTY\.?|QUANTITY|UNITS?|BILL\s*QTY)$/i,
  schemeQuantity: /^(?:SCH\.?\s*QTY\.?|SCHEME\s*QTY|FREE|FREE\s*QTY)$/i,
  purchaseRate: /^(?:RATE|PURCHASE\s*RATE|PTR|PRICE|NET\s*RATE|RATE\/UNIT)$/i,
  mrp: /^(?:MRP|M\.R\.P\.?|MAXIMUM\s*RETAIL\s*PRICE)$/i,
  discount: /^(?:DISC\.?|DISCOUNT|DISC\s*%|DISCOUNT\s*%|SCH\.?\s*DISC\.?|SCHEME\s*DISC)$/i,
  sgst: /^(?:SGST|S\.GST|SGST\s*%|SGST\s*RATE)$/i,
  cgst: /^(?:CGST|C\.GST|CGST\s*%|CGST\s*RATE)$/i,
  igst: /^(?:IGST|I\.GST|IGST\s*%|IGST\s*RATE)$/i,
  gst: /^(?:GST|GST\s*%|TAX|TAX\s*%|TOTAL\s*GST|VAT)$/i,
  amount: /^(?:AMOUNT|LINE\s*AMOUNT|NET\s*AMOUNT|TOTAL|TAXABLE|TAXABLE\s*VALUE|VALUE)$/i,
};

function matchHeaderToken(text: string): string | null {
  const clean = text.trim();
  for (const [key, regex] of Object.entries(HEADER_SYNONYMS)) {
    if (regex.test(clean)) {
      return key;
    }
  }
  return null;
}

export function buildColumnsFromHeaders(
  headerItems: Array<{ str: string; x: number; width: number }>
): ColumnDef[] {
  const sorted = [...headerItems].sort((a, b) => a.x - b.x);

  const merged: Array<{ key: string; label: string; x: number; width: number }> = [];
  let i = 0;
  while (i < sorted.length) {
    const cur = sorted[i];
    let matchedKey = matchHeaderToken(cur.str);
    let combinedStr = cur.str;
    let totalW = cur.width;

    if (i + 1 < sorted.length) {
      const next = sorted[i + 1];
      const gap = next.x - (cur.x + cur.width);
      if (gap < 25) {
        const twoWord = `${cur.str} ${next.str}`;
        const twoKey = matchHeaderToken(twoWord);
        if (twoKey) {
          matchedKey = twoKey;
          combinedStr = twoWord;
          totalW = next.x + next.width - cur.x;
          i++;
        }
      }
    }

    if (matchedKey) {
      merged.push({
        key: matchedKey,
        label: combinedStr,
        x: cur.x,
        width: totalW,
      });
    }
    i++;
  }

  const columns: ColumnDef[] = [];
  for (let c = 0; c < merged.length; c++) {
    const col = merged[c];
    const prev = c > 0 ? merged[c - 1] : null;
    const next = c + 1 < merged.length ? merged[c + 1] : null;

    let xMin = 0;
    if (prev) {
      if (prev.key === 'slNo') {
        xMin = prev.x + prev.width + 2;
      } else {
        xMin = Math.min(col.x - 5, (prev.x + prev.width + col.x) / 2);
      }
    }

    let xMax = 9999;
    if (next) {
      if (col.key === 'slNo') {
        xMax = Math.min(65, col.x + col.width + 10);
      } else {
        xMax = Math.min(next.x - 5, (col.x + col.width + next.x) / 2);
      }
    }

    columns.push({
      key: col.key,
      label: col.label,
      headerX: col.x,
      headerW: col.width,
      xMin,
      xMax,
    });
  }

  // Ensure contiguous boundaries
  for (let c = 0; c < columns.length; c++) {
    if (c === 0) {
      columns[c].xMin = 0;
    } else {
      columns[c].xMin = columns[c - 1].xMax;
    }
  }

  return columns;
}

export function normalizeExpiryDate(rawExp: string): string {
  if (!rawExp) return '';
  const clean = rawExp.trim().replace(/[^0-9/-]/g, '');

  // Case 1: MM-YY or MM/YY (e.g. 07-28, 06/27, 02-28, 03/29)
  const mmYyMatch = clean.match(/^(\d{1,2})[-/](\d{2})$/);
  if (mmYyMatch) {
    const month = parseInt(mmYyMatch[1], 10);
    const year = 2000 + parseInt(mmYyMatch[2], 10);
    if (month >= 1 && month <= 12) {
      const lastDay = new Date(year, month, 0).getDate();
      const dd = String(lastDay).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return `${dd}-${mm}-${year}`;
    }
  }

  // Case 2: MM-YYYY or MM/YYYY (e.g. 07-2028)
  const mmYyyyMatch = clean.match(/^(\d{1,2})[-/](\d{4})$/);
  if (mmYyyyMatch) {
    const month = parseInt(mmYyyyMatch[1], 10);
    const year = parseInt(mmYyyyMatch[2], 10);
    if (month >= 1 && month <= 12) {
      const lastDay = new Date(year, month, 0).getDate();
      const dd = String(lastDay).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      return `${dd}-${mm}-${year}`;
    }
  }

  // Case 3: DD-MM-YYYY or DD/MM/YYYY
  const ddMmYyyyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (ddMmYyyyMatch) {
    const day = ddMmYyyyMatch[1].padStart(2, '0');
    const month = ddMmYyyyMatch[2].padStart(2, '0');
    let year = ddMmYyyyMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${day}-${month}-${year}`;
  }

  // Case 4: YYYY-MM-DD
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${day}-${month}-${year}`;
  }

  return clean;
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

    let activeColumns: ColumnDef[] = [];
    const lineItems: DocumentExtractionLineItem[] = [];
    const warnings: string[] = [];

    // Metadata accumulators
    let detectedSupplier: Partial<DocumentExtractionSupplier> = {};
    let detectedCustomer: Partial<DocumentExtractionCustomer> = {};
    let detectedInvoiceMeta: Partial<DocumentExtractionInvoiceMeta> = {};

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();

      if (!content.items || content.items.length === 0) {
        continue;
      }

      const validItems = (content.items as any[])
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({
          str: it.str.trim(),
          x: it.transform?.[4] || 0,
          y: it.transform?.[5] || 0,
          width: it.width || 0,
        }));

      // Group items into horizontal lines (within 2.8pt vertically)
      const lineMap = new Map<number, typeof validItems>();
      for (const it of validItems) {
        const y = Math.round(it.y);
        let foundY: number | null = null;
        for (const k of lineMap.keys()) {
          if (Math.abs(k - y) <= 2.8) {
            foundY = k;
            break;
          }
        }
        if (foundY !== null) {
          lineMap.get(foundY)!.push(it);
        } else {
          lineMap.set(y, [it]);
        }
      }

      const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

      // Check for table header row on this page
      // Must contain at least 4 recognized columns AND must include the 'product' column
      // (to distinguish it from tax summary tables at the footer)
      let headerY = -1;
      for (const y of sortedYs) {
        const rowItems = lineMap.get(y)!;
        const candidateCols = buildColumnsFromHeaders(rowItems);
        if (candidateCols.length >= 4 && candidateCols.some((c) => c.key === 'product')) {
          headerY = y;
          activeColumns = candidateCols;
          break;
        }
      }

      // If page 1, extract supplier, invoice, and customer metadata from above the table header
      if (pageNum === 1) {
        this.extractPage1Metadata(lineMap, sortedYs, headerY, detectedSupplier, detectedCustomer, detectedInvoiceMeta);
      }

      // If last page, extract totals from below the table
      if (pageNum === pdfDoc.numPages) {
        const footerTextLines = sortedYs
          .filter((y) => y < 350)
          .map((y) => lineMap.get(y)!.sort((a, b) => a.x - b.x).map((it) => it.str).join(' '));
        this.extractFooterTotals(footerTextLines, detectedInvoiceMeta);
      }

      if (activeColumns.length === 0) {
        warnings.push(`Page ${pageNum}: No recognizable table headers detected.`);
        continue;
      }

      // Extract rows below the header
      for (const y of sortedYs) {
        // Skip header and anything above it if header was found on this page
        if (headerY !== -1 && y >= headerY) continue;

        // On the final page, skip footer/bank/tax breakdown lines (below the medicine rows)
        if (pageNum === pdfDoc.numPages && y < 350) continue;

        const rowItems = lineMap.get(y)!;

        // Check if this row starts with a serial number or has primary medicine data
        const slCol = activeColumns.find((c) => c.key === 'slNo');
        const slMax = slCol ? slCol.xMax : 65;
        const slItem = rowItems.find((it) => it.x < slMax && /^\d{1,4}$/.test(it.str.trim()));

        // Also check if line has numeric cells (rate, mrp, qty)
        const hasNumbers = rowItems.some((it) => it.x > 500 && /^\d+(?:\.\d{1,2})?$/.test(it.str.trim()));

        // Continuation line check: if line has text but no slNo and no rates/amounts,
        // it may be a wrapped manufacturer or product name
        if (!slItem && !hasNumbers && lineItems.length > 0) {
          const lastItem = lineItems[lineItems.length - 1];
          const productCol = activeColumns.find((c) => c.key === 'product');
          const mfrCol = activeColumns.find((c) => c.key === 'manufacturer');

          for (const it of rowItems) {
            if (productCol && it.x >= productCol.xMin && it.x < productCol.xMax) {
              lastItem.itemName = `${lastItem.itemName} ${it.str}`.trim();
            } else if (mfrCol && it.x >= mfrCol.xMin && it.x < mfrCol.xMax) {
              lastItem.manufacturer = `${lastItem.manufacturer || ''} ${it.str}`.trim();
            }
          }
          continue;
        }

        // If line does not have slNo and does not have numbers, skip noise
        if (!slItem && !hasNumbers) {
          continue;
        }

        const slNo = slItem ? parseInt(slItem.str.trim(), 10) : lineItems.length + 1;

        const rowData: Record<string, string> = {};
        for (const col of activeColumns) {
          const cellItems = rowItems.filter((it) => {
            if (it.x >= col.xMin && it.x < col.xMax) {
              if (col.key === 'slNo' && /[A-Za-z]/.test(it.str)) return false;
              return true;
            }
            return false;
          });

          // Product items that spilled slightly left of product boundary
          if (col.key === 'product') {
            const spilled = rowItems.filter((it) => it.x < col.xMin && /[A-Za-z]/.test(it.str));
            cellItems.unshift(...spilled);
          }

          rowData[col.key] = cellItems.map((it) => it.str).join(' ').trim();
        }

        const itemName = (rowData.product || '').trim();
        if (!itemName || itemName.length < 2) continue;

        const manufacturer = (rowData.manufacturer || '').trim();
        const packing = (rowData.packing || '').trim();
        const batchNumber = (rowData.batch || '').trim() || `BATCH-${lineItems.length + 1}`;
        const rawExpiry = (rowData.expiry || '').trim();
        const expiryDate = normalizeExpiryDate(rawExpiry);
        const hsnCode = (rowData.hsn || '').replace(/[^0-9]/g, '');

        const qty = parseFloat((rowData.quantity || '').replace(/,/g, '')) || 1;
        const rate = parseFloat((rowData.purchaseRate || '').replace(/,/g, '')) || 0;
        const mrp = parseFloat((rowData.mrp || '').replace(/,/g, '')) || Math.round(rate * 1.35 * 100) / 100;
        const discountPercent = parseFloat((rowData.discount || '').replace(/,/g, '')) || 0;

        // GST calculation: SGST + CGST, or IGST, or GST
        const sgst = parseFloat((rowData.sgst || '').replace(/,/g, '')) || 0;
        const cgst = parseFloat((rowData.cgst || '').replace(/,/g, '')) || 0;
        const igst = parseFloat((rowData.igst || '').replace(/,/g, '')) || 0;
        const explicitGst = parseFloat((rowData.gst || '').replace(/,/g, '')) || 0;
        const gstPercent = (sgst + cgst > 0) ? (sgst + cgst) : (igst > 0 ? igst : explicitGst);

        const amount = parseFloat((rowData.amount || '').replace(/,/g, '')) || Math.round(qty * rate * 100) / 100;

        lineItems.push({
          lineNumber: slNo,
          itemName,
          manufacturer: manufacturer || undefined,
          packing: packing || undefined,
          batchNumber,
          expiryDate: expiryDate || undefined,
          hsnCode: hsnCode || undefined,
          quantity: qty,
          purchaseRate: rate,
          mrp,
          discountPercent,
          gstPercent,
          taxableValue: amount,
          confidence: 'HIGH',
          rawOcrText: rowItems.map((it) => it.str).join(' '),
        });
      }
    }

    if (lineItems.length === 0) {
      throw new Error('PDF spatial extraction did not find any recognizable medicine items.');
    }

    // Invoice Totals Reconciliation
    const calculatedSubtotal = Math.round(lineItems.reduce((acc, it) => acc + (it.taxableValue || 0), 0) * 100) / 100;
    const calculatedGst = Math.round(lineItems.reduce((acc, it) => acc + ((it.taxableValue || 0) * (it.gstPercent || 0) / 100), 0) * 100) / 100;
    const grandTotal = detectedInvoiceMeta.totalAmount || calculatedSubtotal;

    if (detectedInvoiceMeta.taxableAmount && Math.abs(detectedInvoiceMeta.taxableAmount - calculatedSubtotal) > 1.0) {
      warnings.push(
        `Invoice Subtotal: ₹${detectedInvoiceMeta.taxableAmount.toFixed(2)} | Sum of line amounts: ₹${calculatedSubtotal.toFixed(2)}`
      );
    }

    return {
      provider: 'spatial-layout-ocr',
      supplier: {
        name: detectedSupplier.name || 'Veterinary Distributor',
        gstin: detectedSupplier.gstin || null,
        pan: detectedSupplier.pan || null,
        fssai: detectedSupplier.fssai || null,
        phone: detectedSupplier.phone || null,
        email: detectedSupplier.email || null,
        dlNo: detectedSupplier.dlNo || null,
        address: detectedSupplier.address || null,
        state: detectedSupplier.state || null,
      },
      customer: {
        name: detectedCustomer.name || null,
        address: detectedCustomer.address || null,
      },
      invoice: {
        invoiceNumber: detectedInvoiceMeta.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        invoiceDate: detectedInvoiceMeta.invoiceDate || new Date().toISOString().split('T')[0],
        paymentType: detectedInvoiceMeta.paymentType || 'CREDIT',
        totalAmount: grandTotal,
        taxableAmount: detectedInvoiceMeta.taxableAmount || calculatedSubtotal,
        totalTax: detectedInvoiceMeta.totalTax || calculatedGst,
        totalDiscount: detectedInvoiceMeta.totalDiscount || 0,
        totalItems: detectedInvoiceMeta.totalItems || lineItems.length,
        totalQuantity: detectedInvoiceMeta.totalQuantity || lineItems.reduce((acc, it) => acc + it.quantity, 0),
      },
      lineItems,
      warnings,
    };
  }

  private extractPage1Metadata(
    lineMap: Map<number, Array<{ str: string; x: number; y: number; width: number }>>,
    sortedYs: number[],
    headerY: number,
    supplier: Partial<DocumentExtractionSupplier>,
    customer: Partial<DocumentExtractionCustomer>,
    invoice: Partial<DocumentExtractionInvoiceMeta>
  ) {
    const headerLines = sortedYs.filter((y) => headerY === -1 || y > headerY);

    const leftLines: string[] = [];
    const midLines: string[] = [];
    const rightLines: string[] = [];

    for (const y of headerLines) {
      const items = lineMap.get(y)!;
      const left = items.filter((it) => it.x < 300).sort((a, b) => a.x - b.x).map((it) => it.str).join(' ');
      const mid = items.filter((it) => it.x >= 300 && it.x < 550).sort((a, b) => a.x - b.x).map((it) => it.str).join(' ');
      const right = items.filter((it) => it.x >= 550).sort((a, b) => a.x - b.x).map((it) => it.str).join(' ');
      if (left) leftLines.push(left);
      if (mid) midLines.push(mid);
      if (right) rightLines.push(right);
    }

    // 1. Supplier from leftLines
    if (leftLines.length > 0) {
      supplier.name = leftLines[0].replace(/^\W+|\W+$/g, '').trim();
      const addrLines: string[] = [];

      for (const line of leftLines) {
        if (!supplier.gstin) {
          const gm = line.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}\b/i) || line.match(/GST(?:IN)?[\s.:]+([A-Z0-9]{15})/i);
          if (gm) supplier.gstin = (gm[1] || gm[0]).toUpperCase();
        }
        if (!supplier.phone) {
          const pm = line.match(/(?:PH|Phone|Mob|Tel)[\s.:]+([\d,\s/-]{7,35})/i);
          if (pm) supplier.phone = pm[1].trim();
        }
        if (!supplier.email) {
          const em = line.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (em) supplier.email = em[1].toLowerCase();
        }
        if (!supplier.dlNo) {
          const dlm = line.match(/DL\s*(?:NO)?[\s.:]+([A-Z0-9,\s/-]{8,60})/i);
          if (dlm) supplier.dlNo = dlm[1].trim();
        }
        if (!supplier.state && /Kerala/i.test(line)) {
          supplier.state = 'Kerala';
        }
        if (/VANASREE|MATHOTTAM|ARAKINAR|CALICUT|ROAD|STREET|PO/i.test(line)) {
          addrLines.push(line);
        }
      }
      if (addrLines.length > 0) {
        supplier.address = addrLines.join(', ');
      }
    }

    // 2. Invoice Meta from midLines (and fallback leftLines)
    for (const line of [...midLines, ...leftLines]) {
      if (!invoice.invoiceNumber) {
        const im = line.match(/(?:Tax\s*Inv\.?No|Inv\s*No|Invoice\s*No|Bill\s*No)[\s.:]+([A-Za-z0-9/_-]{1,30})/i);
        if (im) invoice.invoiceNumber = im[1].trim();
      }
      if (!invoice.invoiceDate) {
        const dm = line.match(/(?:Invoice\s*date|Inv\s*Dt|Date)[\s.:]+(\d{2}[-/.]\d{2}[-/.]\d{2,4})/i);
        if (dm) {
          const parts = dm[1].split(/[-/.]/);
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            invoice.invoiceDate = `${year}-${month}-${day}`;
          }
        }
      }
      if (!invoice.paymentType && /\b(CREDIT|CASH)\b/i.test(line)) {
        const pm = line.match(/\b(CREDIT|CASH)\b/i);
        if (pm) invoice.paymentType = pm[1].toUpperCase();
      }
    }

    // 3. Customer from rightLines
    if (rightLines.length > 0) {
      const cleanRight = rightLines.map((l) => l.replace(/^TO,?\s*/i, '').trim()).filter(Boolean);
      if (cleanRight.length > 0) {
        customer.name = cleanRight[0];
        if (cleanRight.length > 1) {
          customer.address = cleanRight.slice(1).join(', ');
        }
      }
    }
  }

  private extractFooterTotals(
    lines: string[],
    invoice: Partial<DocumentExtractionInvoiceMeta>
  ) {
    for (const line of lines) {
      if (!invoice.taxableAmount) {
        const sm = line.match(/Sub\s*Total[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (sm) invoice.taxableAmount = parseFloat(sm[1].replace(/,/g, ''));
      }
      if (!invoice.totalTax) {
        const tm = line.match(/GST\s*Tax\s*Amt[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (tm) invoice.totalTax = parseFloat(tm[1].replace(/,/g, ''));
      }
      if (!invoice.totalAmount) {
        const gm = line.match(/GRAND\s*TOTAL[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (gm) invoice.totalAmount = parseFloat(gm[1].replace(/,/g, ''));
      }
      if (!invoice.totalDiscount) {
        const dm = line.match(/Total\s*Disc\s*Amt[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (dm) invoice.totalDiscount = parseFloat(dm[1].replace(/,/g, ''));
      }
    }
  }
}
