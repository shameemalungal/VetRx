// ==============================================================================
// VetRx Document Extraction — Plain Text Parser Provider
// Fallback provider for pasted and machine-generated invoice text
// ==============================================================================

import type {
  IDocumentExtractionProvider,
  StructuredInvoiceDocument,
  DocumentExtractionLineItem,
} from '../document-extraction.types.js';

export class TextParserProvider implements IDocumentExtractionProvider {
  name = 'Text Parser Provider';

  isAvailable(): boolean {
    return true;
  }

  async extractDocument(payload: {
    buffer: Buffer;
    mimeType?: string;
    rawText?: string;
    fileName?: string;
  }): Promise<StructuredInvoiceDocument> {
    const text = payload.rawText || payload.buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const supplier = this.extractSupplier(lines);
    const invoiceMeta = this.extractInvoiceMeta(lines);
    const totals = this.extractTotals(lines);
    const lineItems = this.extractTableRows(lines);

    return {
      provider: 'text-parser',
      supplier: {
        name: supplier.name || 'Veterinary Distributor',
        gstin: supplier.gstin,
        pan: supplier.pan,
        fssai: supplier.fssai,
        phone: supplier.phone,
        email: supplier.email,
        dlNo: supplier.dlNo,
        address: supplier.address,
        state: supplier.state,
      },
      customer: invoiceMeta.customer,
      invoice: {
        invoiceNumber: invoiceMeta.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
        invoiceDate: invoiceMeta.invoiceDate || new Date().toISOString().split('T')[0],
        invoiceTime: invoiceMeta.invoiceTime,
        dueDate: invoiceMeta.dueDate,
        paymentType: invoiceMeta.paymentType || 'CREDIT',
        totalAmount: totals.netPayable || totals.taxableAmount,
        taxableAmount: totals.taxableAmount,
        totalTax: totals.totalTax,
        totalDiscount: totals.totalDiscount,
        totalItems: totals.totalItems || lineItems.length,
        totalQuantity: totals.totalQuantity,
      },
      lineItems,
      warnings: [],
    };
  }

  private extractTableRows(lines: string[]): DocumentExtractionLineItem[] {
    const items: DocumentExtractionLineItem[] = [];
    const seenSignatures = new Set<string>();

    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Table boundary detection
      if (/Particulars|Description|Item\s*Name|Product/i.test(line) && /Batch|Exp|Qty|Rate|MRP/i.test(line)) {
        inTable = true;
        continue;
      }
      if (/Remarks\s*:.*NO\s*EXPIRY\s*RETURNS/i.test(line)) {
        inTable = true;
        continue;
      }
      if (/Total\s*Items|Total\s*Qty|Taxable\s*Amount|Net\s*Payable|Declaration|Received\s*All\s*Items|BANK\s*:/i.test(line)) {
        inTable = false;
      }

      // Skip lines outside table if table markers were found, or skip known noise
      if (
        /^TAX\s*INVOICE|GSTIN:|CHALAPPURAM|BANK\s*:|BRANCH\s*:|A\/C\s*NO|Printed\s*By|Page\s*\d|Declaration|NO\s*EXPIRY\s*RETURNS|Total\s*Outstanding|Outstanding\s*Amt|Software\s*@|Received\s*All\s*Items|Net\s*Payable/i.test(
          line
        )
      ) {
        continue;
      }
      if (/^SNo\s+Rack|^Particulars\s+Packing|^HSN\s+Batch|^Tax\s*Tot/i.test(line)) {
        continue;
      }

      const item = this.parseSingleTableRow(line);
      if (item && item.itemName && item.itemName.length >= 2) {
        const sig = `${item.batchNumber}_${item.itemName.substring(0, 5).toLowerCase()}`;
        if (!seenSignatures.has(sig)) {
          seenSignatures.add(sig);
          items.push({
            ...item,
            lineNumber: items.length + 1,
          });
        }
      }
    }

    return items;
  }

  private parseSingleTableRow(line: string): Omit<DocumentExtractionLineItem, 'lineNumber'> | null {
    const expMatch = line.match(/\b(0[1-9]|1[0-2])[\/-](2[4-9]|3[0-9]|202[4-9]|203[0-9])\b/);
    if (!expMatch) {
      return null;
    }

    const expStr = expMatch[0];
    const expIdx = line.indexOf(expStr);
    const beforeExp = line.substring(0, expIdx).trim();
    const afterExp = line.substring(expIdx + expStr.length).trim();

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

    const beforeTokens = beforeExp.split(/\s+/).filter(Boolean);
    let batch = 'BATCH-DETECT';
    let hsn = '';
    let packing = '';

    if (beforeTokens.length >= 1) {
      const lastTok = beforeTokens[beforeTokens.length - 1];
      if (/[A-Z0-9-]{3,12}/i.test(lastTok)) {
        batch = lastTok.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
        beforeTokens.pop();
      }
    }

    for (let i = beforeTokens.length - 1; i >= 0; i--) {
      const t = beforeTokens[i].replace(/[^0-9]/g, '');
      if (t.length >= 6 && t.length <= 8) {
        hsn = t;
        beforeTokens.splice(i, 1);
        break;
      }
    }

    for (let i = beforeTokens.length - 1; i >= 0; i--) {
      const tok = beforeTokens[i];
      if (/^\d{1,4}(?:gm|ml|mg|kg|ltr|s|'s|tab|caps|vial|amp)$/i.test(tok) || /^\d{1,4}'[sS]$/.test(tok)) {
        packing = tok;
        beforeTokens.splice(i, 1);
        break;
      }
      if (i > 0 && /^\d{1,4}$/.test(beforeTokens[i - 1]) && /^(?:ML|GM|MG|PCS|VIAL|TAB|AMP)$/i.test(tok)) {
        packing = `${beforeTokens[i - 1]} ${tok}`;
        beforeTokens.splice(i - 1, 2);
        break;
      }
    }

    let rawName = beforeTokens.join(' ').trim();
    rawName = rawName.replace(/^[\d\s\W|✓+vV]+/, '').trim();
    rawName = rawName.replace(/^(?:CORI|INTAS|SAVA|SIHIL|CADILA|MANKIND|INTASPET|PETCARE|VIRBAC)[\s:.]+/i, '').trim();
    rawName = rawName.replace(/^[|/\\[\](){}✓+\-_.:;\s]+/, '').trim();

    if (!rawName || rawName.length < 2) {
      return null;
    }

    return {
      itemName: rawName,
      packing: packing || '',
      hsnCode: hsn || '',
      batchNumber: batch || 'BATCH-DETECT',
      expiryDate: this.normalizeExpiry(expStr),
      quantity: qty || 1,
      schemeQuantity: 0,
      mrp: mrp || 0,
      purchaseRate: rate || 0,
      schemeDiscountPercent: schDisc || 0,
      discountPercent: disc || 0,
      gstPercent: gst || 5,
      taxableValue: taxable || Math.round(qty * rate * 100) / 100,
      confidence: 'HIGH',
      rawOcrText: line,
    };
  }

  private normalizeExpiry(exp: string): string {
    const parts = exp.split(/[\/-]/);
    if (parts.length === 2) {
      const month = parts[0].padStart(2, '0');
      let year = parts[1];
      if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-01`;
    }
    return exp;
  }

  private extractSupplier(lines: string[]) {
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
        const gm =
          line.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}\b/i) ||
          line.match(/GSTIN[\s.:]+([A-Z0-9]{15})/i);
        if (gm) gstin = (gm[1] || gm[0]).toUpperCase();
      }
      if (!pan) {
        const panM =
          line.match(/PAN[\s.:]+([A-Z]{5}\d{4}[A-Z])/i) ||
          line.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
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
          /(?:PHARMA|PHARMACEUTICALS|AGENCIES|DISTRIBUTOR|DISTRIBUTORS|HEALTHCARE|LABORATORIES|VET\s*CARE|SURGICALS|MEDICOS|ENTERPRISES|TRADERS|MEDICAL)/i.test(
            line
          ) &&
          !/TAX\s*INVOICE|GSTIN|PH:|E-Mail|Kerala|DL\s*No|Page\s*\d|Bill\s*To|Ship\s*To/i.test(line) &&
          line.length > 3 &&
          line.length < 60
        ) {
          name = line
            .replace(/^[)\]\}/\\|+vV✓Jj$;:_.\s-]+|[)\]\}/\\|+vV✓Jj$;:_.\s-]+$/g, '')
            .trim();
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

  private extractInvoiceMeta(lines: string[]) {
    let invoiceNumber: string | null = null;
    let invoiceDate: string | null = null;
    let invoiceTime: string | null = null;
    let dueDate: string | null = null;
    let paymentType = 'CREDIT';
    const customer: { name?: string; address?: string; phone?: string; gstin?: string } = {};

    for (const line of lines) {
      if (!invoiceNumber) {
        const im =
          line.match(/(?:Inv\s*No|Invoice\s*No|Bill\s*No|Invoice\s*#)[\s.:]+([A-Za-z0-9/_-]{4,30})/i) ||
          line.match(/\*([A-Za-z0-9/_-]{4,30})\*/);
        if (im && !im[1].includes('TAX')) {
          invoiceNumber = im[1].trim();
        }
      }
      if (!invoiceDate) {
        const dm =
          line.match(/(?:Inv\s*Dt|Date|Invoice\s*Date|Dated)[\s.:]+(\d{2}[-/.]\d{2}[-/.]\d{2,4})/i) ||
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

    return { invoiceNumber, invoiceDate, invoiceTime, dueDate, paymentType, customer };
  }

  private normalizeDateFormat(raw: string): string {
    const parts = raw.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[2].length === 2) {
        return `20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return raw;
  }

  private extractTotals(lines: string[]) {
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
        const tam =
          line.match(/Taxable\s*Amount[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Taxable\s*value[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Total\s*Taxable[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
        if (tam) taxableAmount = parseFloat(tam[1].replace(/,/g, ''));
      }
      if (!totalTax) {
        const ttm =
          line.match(/Tax\s*Amount[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Total\s*GST[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Tax\s*Tot[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
        if (ttm) totalTax = parseFloat(ttm[1].replace(/,/g, ''));
      }
      if (!totalDiscount) {
        const tdm =
          line.match(/Scheme\s*Disc[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Total\s*Disc[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
        if (tdm) totalDiscount = parseFloat(tdm[1].replace(/,/g, ''));
      }
      if (!netPayable) {
        const npm =
          line.match(/Net\s*Payable[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Net\s*Amount[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Total\s*Amount[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Grand\s*Total[\s.:]+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
        if (npm) netPayable = parseFloat(npm[1].replace(/,/g, ''));
      }
    }

    return { totalItems, totalQuantity, taxableAmount, totalTax, totalDiscount, netPayable };
  }
}
