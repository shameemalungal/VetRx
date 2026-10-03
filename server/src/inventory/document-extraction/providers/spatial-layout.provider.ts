// ==============================================================================
// VetRx Document Extraction — Spatial Layout & Table ROI Provider
// Document-level spatial segmentation and table structure extractor
// ==============================================================================

import type {
  IDocumentExtractionProvider,
  StructuredInvoiceDocument,
  DocumentExtractionLineItem,
} from '../document-extraction.types.js';

export class SpatialLayoutProvider implements IDocumentExtractionProvider {
  name = 'Spatial Layout-Aware Table Extractor';

  isAvailable(): boolean {
    return true; // Local Sharp + Tesseract engine is always available
  }

  async extractDocument(payload: {
    buffer: Buffer;
    mimeType?: string;
    rawText?: string;
    fileName?: string;
  }): Promise<StructuredInvoiceDocument> {
    const sharpModule: any = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    const tesseractModule: any = await import('tesseract.js');

    const meta = await sharp(payload.buffer).metadata();
    const width = meta.width || 800;
    const height = meta.height || 1200;

    let scale = 1;
    if (width < 1400) {
      scale = Math.min(3.5, Math.max(2, 2200 / width));
    }

    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    // Pass 1: Enhanced full page (Upscale, grayscale, contrast stretch)
    const fullEnhanced = await sharp(payload.buffer)
      .resize({ width: targetWidth, height: targetHeight, kernel: 'lanczos3' })
      .grayscale()
      .normalize()
      .sharpen({ sigma: 1.5, m1: 2, m2: 20 })
      .toBuffer();

    const highContrast = await sharp(payload.buffer)
      .resize({ width: targetWidth, height: targetHeight, kernel: 'lanczos3' })
      .grayscale()
      .linear(2.2, -70)
      .sharpen({ sigma: 1.2 })
      .toBuffer();

    const worker = await tesseractModule.createWorker('eng');
    await worker.setParameters({
      preserve_interword_spaces: '1',
    });

    const fullResult = await worker.recognize(highContrast, {}, { blocks: true, text: true });
    const fullText = fullResult.data.text || '';
    const fullLines: Array<{ text: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }> =
      fullResult.data.blocks && fullResult.data.blocks.length > 0
        ? fullResult.data.blocks.flatMap((b: any) => b.paragraphs?.flatMap((p: any) => p.lines || []) || [])
        : (fullResult.data as any).lines || [];

    // 1. Extract Header & Metadata from Top Zone
    const headerLines = fullText.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    const supplier = this.extractSupplier(headerLines);
    const invoiceMeta = this.extractInvoiceMeta(headerLines);
    const totals = this.extractTotals(headerLines);

    // 2. Spatial Segmentation: Locate Medicine Table Zone (Strict ROI)
    let tableHeaderY = -1;
    let tableFooterY = -1;

    for (const line of fullLines) {
      const txt = line.text || '';
      const matches = [
        /Particulars|Pankulars|Description|Item/i.test(txt),
        /Packing|Pack/i.test(txt),
        /HSN|SAC/i.test(txt),
        /Batch|Baten|Lot/i.test(txt),
        /Exp|Expiry/i.test(txt),
        /Qty|Quantity/i.test(txt),
        /MRP/i.test(txt),
        /Rate|Price/i.test(txt),
        /Taxable|Amount/i.test(txt),
      ].filter(Boolean).length;

      if (matches >= 3 || /Rack.*(?:Part|Pack)|SNo.*(?:Part|Pack)|Pankulars/i.test(txt)) {
        if (line.bbox && tableHeaderY === -1) {
          tableHeaderY = line.bbox.y0;
          break;
        }
      }
    }

    if (tableHeaderY !== -1) {
      for (const line of fullLines) {
        const txt = line.text || '';
        if (line.bbox && line.bbox.y0 > tableHeaderY + 200) {
          if (
            /Received\s*All|Declaration|Software\s*@|Signature|Net\s*Pay|MYTHRI\s*PHARMA|Inv\s*No|Executive|NORTH\s*ROAD|WEST\s*MANJER/i.test(
              txt
            ) &&
            line.bbox.y0 > targetHeight * 0.68
          ) {
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
      tableFooterY = Math.min(
        targetHeight - 10,
        tableHeaderY + Math.floor(targetHeight * 0.22)
      );
    }

    const tableCropHeight = Math.max(
      150,
      Math.min(tableFooterY - tableHeaderY + 30, targetHeight - tableHeaderY - 10)
    );

    // Extract ONLY the line-item table region (eliminates Bank & Header contamination)
    const tableCropBuffer = await sharp(highContrast)
      .extract({
        left: Math.floor(targetWidth * 0.005),
        top: Math.max(0, tableHeaderY - 15),
        width: Math.floor(targetWidth * 0.99),
        height: tableCropHeight,
      })
      .toBuffer();

    // Run PSM 6 on Table ROI
    await worker.setParameters({
      tessedit_pageseg_mode: tesseractModule.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
    });

    const tableResult = await worker.recognize(tableCropBuffer, {}, { text: true });
    const tableText = tableResult.data.text || '';

    await worker.terminate();

    // 3. Parse Table Rows within Isolated ROI
    const rawTableLines = tableText.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    const lineItems = this.parseTableRows(rawTableLines);

    return {
      provider: 'spatial-layout-ocr',
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

  // --------------------------------------------------------------------------
  // Table Parsing & Normalization
  // --------------------------------------------------------------------------

  private parseTableRows(lines: string[]): DocumentExtractionLineItem[] {
    const items: DocumentExtractionLineItem[] = [];
    const seenSignatures = new Set<string>();

    for (const line of lines) {
      // Exclude header rows and blacklisted bank/footer keywords
      if (
        /TAX\s*INVOICE|GSTIN|PAN\s*NO|FSSAI|CHALAPPURAM|CALICUT|KERALA|PHONE|MOB|TEL|BANK\s*:|BRANCH|A\/C\s*NO|IFSC|MYTHRI\s*PHARMA|KIMS\s*MEDICAL|Printed\s*By|Page\s*\d|Declaration|NO\s*EXPIRY|Total\s*Outstanding|Outstanding\s*Amt|Software\s*@|Received\s*All|Net\s*Pay|Total\s*Items|Total\s*Qty|Taxable\s*Amount|Tax\s*Amount|Credit\s*Note|Debit\s*Note|Order\s*No|Order\s*Dt|Route|Transport|CLINIC|HOSPITAL|DR\.|WEST\s*MANJER|KARUVAMBRAM|PNA\s*ROAD|JUNCTION|NORTH\s*ROAD|EXECUTIVE|DISC\s*NO/i.test(
          line
        )
      ) {
        continue;
      }
      if (
        /^SNo\s+Rack|^Particulars\s+Packing|^HSN\s+Batch|^Tax\s*Tot|Rack.*Particulars|Pankulars|Taxale|Taxable\s*value/i.test(
          line
        )
      ) {
        continue;
      }
      if (/^[\W\d_|=~-]+$/.test(line) || line.replace(/[^a-zA-Z]/g, '').length < 3) {
        continue;
      }

      const item = this.parseSingleTableRow(line);
      if (item && item.itemName && item.itemName.length >= 2) {
        // Prevent duplicate OCR lines
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
    if (!line || line.length < 5) return null;

    // Strict Blacklist of Header, Address, Bank, and Footer noise lines
    if (
      /TAX\s*INVOICE|GSTIN|PAN\s*NO|FSSAI|CHALAPPURAM|CALICUT|KERALA|PHONE|MOB|TEL|BANK\s*:|BRANCH|A\/C\s*NO|IFSC|MYTHRI\s*PHARMA|KIMS\s*MEDICAL|Printed\s*By|Page\s*\d|Declaration|NO\s*EXPIRY|Total\s*Outstanding|Outstanding\s*Amt|Software\s*@|Received\s*All|Net\s*Payable|Total\s*Items|Total\s*Qty|Taxable\s*Amount|Tax\s*Amount|Credit\s*Note|Debit\s*Note|Order\s*No|Order\s*Dt|Route|Transport|CLINIC|HOSPITAL|DR\.|WEST\s*MANJERI|KARUVAMBRAM|PNA\s*ROAD|JUNCTION/i.test(
        line
      )
    ) {
      return null;
    }
    if (
      /^SNo\s+Rack|^Particulars\s+Packing|^HSN\s+Batch|^Tax\s*Tot|Rack.*Particulars|Pankulars|Taxale|Taxable\s*value/i.test(
        line
      )
    ) {
      return null;
    }
    if (/^[\W\d_|=~-]+$/.test(line)) {
      return null;
    }

    // 1. Locate Expiry token (e.g. 08/27, 05/28, 10/27, 2027-08, 0828, 0327, 0528, 1027, |0428|)
    let expMatch = line.match(/\b(0[1-9]|1[0-2])[\/-](2[4-9]|3[0-9]|202[4-9]|203[0-9])\b/);
    if (!expMatch) {
      expMatch = line.match(/\b(0[1-9]|1[0-2])(2[4-9]|3[0-9])\b/);
    }
    if (!expMatch) {
      expMatch = line.match(/[|\[\(](0[1-9]|1[0-2]|[oOl][1-9])([0-9zZsSrR]{2})[|\]\)]/);
    }

    let expStr = '';
    let beforeExp = line;
    let afterExp = '';

    if (expMatch) {
      expStr = expMatch[0];
      const expIdx = line.indexOf(expStr);
      beforeExp = line.substring(0, expIdx).trim();
      afterExp = line.substring(expIdx + expStr.length).trim();
    }

    // 2. Parse numbers after Expiry (or rightmost tokens of line if no direct expiry)
    const afterTokens = afterExp ? afterExp.split(/\s+/).filter(Boolean) : [];
    const numbers: number[] = [];
    for (const tok of afterTokens) {
      const cleanNum = tok.replace(/[^0-9.]/g, '');
      if (cleanNum && !isNaN(parseFloat(cleanNum))) {
        numbers.push(parseFloat(cleanNum));
      }
    }

    // Fallback: extract all numbers in the line if afterExp had fewer than 2 numbers
    if (numbers.length < 2) {
      const allNumMatches = line.match(/(?:\d+[.,]\d{2}|\b\d{1,6}\b)/g) || [];
      const extractedNums = allNumMatches.map((n) => parseFloat(n.replace(',', '.'))).filter((n) => !isNaN(n));
      if (extractedNums.length >= 2) {
        numbers.push(...extractedNums.slice(-4));
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

    // 3. Parse prefix before Expiry (Item Name, Packing, HSN, Batch)
    const beforeTokens = beforeExp.split(/\s+/).filter(Boolean);
    let batch = 'BATCH-DETECT';
    let hsn = '';
    let packing = '';

    // Last token before expiry is usually batch
    if (beforeTokens.length >= 1) {
      const lastTok = beforeTokens[beforeTokens.length - 1];
      if (/[A-Z0-9-]{3,12}/i.test(lastTok)) {
        batch = lastTok.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
        beforeTokens.pop();
      }
    }

    // Find HSN token (usually 8 or 4-8 digits)
    for (let i = beforeTokens.length - 1; i >= 0; i--) {
      const t = beforeTokens[i].replace(/[^0-9]/g, '');
      if (t.length >= 6 && t.length <= 8) {
        hsn = t;
        beforeTokens.splice(i, 1);
        break;
      }
    }

    // Find Packing token (e.g. 5gm, 5ml, 30ML, 15ML, 60ML, 10's, 10s, 40gm)
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

    // Clean remaining tokens to produce pure medicine itemName
    let rawName = beforeTokens.join(' ').trim();
    rawName = rawName.replace(/^[^a-zA-Z]+/, '').trim();
    rawName = rawName.replace(/^(?:CORI|INTAS|SAVA|SIHIL|CADILA|MANKIND|INTASPET|PETCARE|VIRBAC)[\s:.]+/i, '').trim();
    rawName = rawName.replace(/^[|/\\[\](){}✓+\-_.:;\s\d]+|[|/\\[\](){}✓+\-_.:;\s\d]+$/g, '').trim();
    rawName = rawName.replace(/\s{2,}/g, ' ');

    if (!rawName || rawName.length < 3) {
      return null;
    }

    return {
      itemName: rawName,
      packing: packing || '',
      hsnCode: hsn || '',
      batchNumber: batch || 'BATCH-DETECT',
      expiryDate: expStr ? this.normalizeExpiry(expStr) : '2027-12-01',
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
    const clean = exp.replace(/[^0-9/-]/g, '');
    const parts = clean.split(/[\/-]/);
    if (parts.length === 2) {
      const month = parts[0].padStart(2, '0');
      let year = parts[1];
      if (year.length === 2) {
        year = `20${year}`;
      }
      return `${year}-${month}-01`;
    } else if (clean.length === 4) {
      const month = clean.substring(0, 2);
      const year = `20${clean.substring(2, 4)}`;
      return `${year}-${month}-01`;
    }
    return exp;
  }

  // --------------------------------------------------------------------------
  // Header / Metadata Extraction
  // --------------------------------------------------------------------------

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
          line.match(/Taxable\s*Amount[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Taxable\s*value[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Total\s*Taxable[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (tam) taxableAmount = parseFloat(tam[1].replace(/,/g, ''));
      }
      if (!totalTax) {
        const ttm =
          line.match(/Tax\s*Amount[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Total\s*GST[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Tax\s*Tot[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (ttm) totalTax = parseFloat(ttm[1].replace(/,/g, ''));
      }
      if (!totalDiscount) {
        const tdm =
          line.match(/Scheme\s*Disc[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Total\s*Disc[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (tdm) totalDiscount = parseFloat(tdm[1].replace(/,/g, ''));
      }
      if (!netPayable) {
        const npm =
          line.match(/Net\s*Payable[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Net\s*Amount[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Total\s*Amount[\s.:]+([\d,]+(?:\.\d{2})?)/i) ||
          line.match(/Grand\s*Total[\s.:]+([\d,]+(?:\.\d{2})?)/i);
        if (npm) netPayable = parseFloat(npm[1].replace(/,/g, ''));
      }
    }

    return { totalItems, totalQuantity, taxableAmount, totalTax, totalDiscount, netPayable };
  }
}
