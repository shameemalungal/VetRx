// =============================================================
// VetRx — InvoiceImporterModal.tsx
// Universal Format-Agnostic Purchase Invoice Importer & Review Screen
// =============================================================

import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import {
  inventoryApi,
  type ParsedInvoiceData,
  type ParsedInvoiceItemData,
} from '../../services/inventoryApi';
import { syncInventoryMedicinesToFormulary } from '../../services/inventorySync';

interface InvoiceImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InvoiceImporterModal: React.FC<InvoiceImporterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>('UPLOAD');
  const [invoiceText, setInvoiceText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review & Confirmation State
  const [supplierName, setSupplierName] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierState, setSupplierState] = useState('');
  const [supplierDlNo, setSupplierDlNo] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceTime, setInvoiceTime] = useState('');
  const [paymentType, setPaymentType] = useState('CREDIT');

  const [isDuplicateWarning, setIsDuplicateWarning] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [bypassDuplicateWarning, setBypassDuplicateWarning] = useState(false);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [parsedTotals, setParsedTotals] = useState<{
    taxableAmount?: number | null;
    totalTax?: number | null;
    netPayable?: number | null;
    totalDiscount?: number | null;
    roundOff?: number | null;
    isInclusive?: boolean | null;
  } | null>(null);

  const [items, setItems] = useState<ParsedInvoiceItemData[]>([]);

  // Bulk Apply Toolbar State
  const defaultFutureExp = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return d.toISOString().split('T')[0];
  };

  const [bulkExpiryDate, setBulkExpiryDate] = useState<string>(defaultFutureExp());
  const [bulkBatchNumber, setBulkBatchNumber] = useState<string>('SO-BATCH');
  const [bulkGstPercent, setBulkGstPercent] = useState<number>(5);

  const missingExpiryCount = items.filter((it) => !it.expiryDate || it.expiryDate.trim() === '').length;

  const handleApplyExpiry = (onlyEmpty: boolean) => {
    if (!bulkExpiryDate) return;
    setItems((prev) =>
      prev.map((it) => {
        if (!onlyEmpty || !it.expiryDate || it.expiryDate.trim() === '') {
          return { ...it, expiryDate: bulkExpiryDate };
        }
        return it;
      })
    );
  };

  const handleQuickAddYears = (years: number) => {
    const baseDate = invoiceDate ? new Date(invoiceDate) : new Date();
    baseDate.setFullYear(baseDate.getFullYear() + years);
    const newExp = baseDate.toISOString().split('T')[0];
    setBulkExpiryDate(newExp);
    setItems((prev) =>
      prev.map((it) => {
        if (!it.expiryDate || it.expiryDate.trim() === '') {
          return { ...it, expiryDate: newExp };
        }
        return it;
      })
    );
  };

  const handleApplyBatch = (onlyEmpty: boolean) => {
    if (!bulkBatchNumber) return;
    setItems((prev) =>
      prev.map((it) => {
        if (!onlyEmpty || !it.batchNumber || it.batchNumber.trim() === '') {
          return { ...it, batchNumber: bulkBatchNumber };
        }
        return it;
      })
    );
  };

  const handleApplyGst = () => {
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        gstPercent: bulkGstPercent,
      }))
    );
  };

  if (!isOpen) return null;

  const handleSampleInvoice = () => {
    const sample = `TAX INVOICE
MYTHRI PHARMA
60/4446, G,F,E Z.C NORTH ROAD CHALAPURAM P.O, CALICUT
GSTIN : 32ABAFM5483C1ZM  State : Kerala-32
PH : 04952307001, 9447404060

20073 - DR.MAJID ARABI
HAPPY PET CLINIC, 7/868D, PNA ROAD JUNCTION, WEST MANJERI
Inv No : MY/26-27/6597    Inv Dt : 28-08-2026 04:52 PM
Pay Type : CREDIT         Total Items : 9   Total Qty : 137
Taxable Amount : 17554.58  Tax Tot : 877.73  Net Payable : 18432.00

SNo Rack Mfac Particulars          Packing HSN      Batch     Exp   Qty SchQty MRP    Rate   SchDisc% GST% Taxable
1   ✓    CORI EYEGEL               5gm     30049099 F-034     08/27 10         165.00 119.43 10.00    5    1074.87
2   ✓    CORI OPTHOCARE EYE DROPS  5ml     30049099 OPG472    05/28 10         360.00 260.57 10.00    5    2345.13
3   ✓    CORI OPTHOCARE PD DROPS   5ml     30049099 OPG415    04/28 10         150.00 107.14 20.00    5    857.12
4        INTA CEFTRIAS PET 3D 30ML 30ML    30049085 IN2609    05/28 30         160.00 121.90 12.50    5    3199.88
5        INTA POMISOL EAR DROPS    15ML    30049085 ILP26010  03/28 20         75.00  57.14  12.50    5    999.95
6        SAVA CEPHAVET SUSP 60ML   60ML    30049085 TSVCV2602 10/27 15         150.00 114.29 16.60    5    1429.77
7        SIHI CARPIL-100 TAB       10's    30049099 PPFT85    07/27 12         394.00 300.19 16.60    5    3004.30
8        SIHI CARPIL-50 TAB        10's    30049099 PPFT86    07/27 12         234.00 178.28 16.60    5    1784.23
9        SIHI GRANEX PR OINTMENT   40gm    30042012 PPFE107   05/28 18         250.00 190.47 16.60    5    2859.34`;

    setInvoiceText(sample);
    setSelectedFileName('sample_mythri_pharma_invoice.txt');
    setFileBase64(null);
    setImagePreviewUrl(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setError(null);

    const reader = new FileReader();
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isImage || isPdf) {
      reader.onload = (ev) => {
        const resultStr = String(ev.target?.result || '');
        setFileBase64(resultStr);
        setImagePreviewUrl(isImage ? resultStr : null);
        setInvoiceText(''); // Direct multimodal document understanding pipeline
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (ev) => {
        const text = String(ev.target?.result || '');
        setInvoiceText(text);
        setFileBase64(null);
        setImagePreviewUrl(null);
      };
      reader.readAsText(file);
    }
  };

  const handleParse = async () => {
    if (!invoiceText.trim() && !fileBase64) {
      setError('Please upload an invoice image or paste invoice text');
      return;
    }

    try {
      setIsParsing(true);
      setError(null);
      const parsed: ParsedInvoiceData = await inventoryApi.parseInvoice({
        invoiceText: invoiceText.trim() || undefined,
        fileBase64: fileBase64 || undefined,
        fileName: selectedFileName || 'Uploaded_Invoice.jpg',
      });

      setSupplierName(parsed.supplier?.name || parsed.supplierName || 'Veterinary Distributor');
      setSupplierGstin(parsed.supplier?.gstin || parsed.supplierGstin || '');
      setSupplierPhone(parsed.supplier?.phone || '');
      setSupplierEmail(parsed.supplier?.email || '');
      setSupplierState(parsed.supplier?.state || '');
      setSupplierDlNo(parsed.supplier?.dlNo || '');

      setInvoiceNumber(parsed.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`);
      setInvoiceDate(parsed.invoiceDate || new Date().toISOString().split('T')[0]);
      setInvoiceTime(parsed.invoiceTime || '');
      setPaymentType(parsed.paymentType || 'CREDIT');

      setIsDuplicateWarning(Boolean(parsed.isDuplicateWarning));
      setDuplicateMessage(parsed.duplicateMessage || '');
      setBypassDuplicateWarning(false);
      setExtractionWarnings(parsed.warnings || []);
      setParsedTotals({
        taxableAmount: parsed.taxableAmount,
        totalTax: parsed.totalTax,
        netPayable: parsed.netPayable ?? parsed.totalAmount,
        totalDiscount: parsed.totalDiscount,
        roundOff: parsed.roundOff,
        isInclusive: parsed.isInclusive,
      });

      const isInvoiceInclusive = Boolean(parsed.isInclusive);
      const normalized: ParsedInvoiceItemData[] = (parsed.items || []).map((item, idx) => {
        const qty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
        let rate = Number(item.purchaseRate) || 0;
        let mrp = Number(item.mrp) || 0;
        const disc = Number(item.discountPercent) || Number(item.schemeDiscountPercent) || 0;

        // Preserve extracted GST percentage! If explicitly 0, it must remain 0!
        const gstPercent = item.gstPercent !== undefined && item.gstPercent !== null
          ? Number(item.gstPercent)
          : undefined;

        let taxable = Number(item.taxableValue) || 0;
        let lineTotal = Number(item.lineTotal) || 0;
        let gstAmount = Number(item.gstAmount) || 0;

        if (isInvoiceInclusive) {
          if (lineTotal <= 0 && taxable > 0) {
            lineTotal = taxable;
          } else if (lineTotal <= 0) {
            lineTotal = Math.round(qty * rate * (1 - disc / 100) * 100) / 100;
          }
          const gPct = gstPercent !== undefined ? gstPercent : 0;
          if (taxable <= 0 || taxable === lineTotal) {
            taxable = gPct > 0 ? Math.round((lineTotal / (1 + gPct / 100)) * 100) / 100 : lineTotal;
          }
          gstAmount = Math.round((lineTotal - taxable) * 100) / 100;
        } else {
          if (taxable <= 0) {
            taxable = Math.round(qty * rate * (1 - disc / 100) * 100) / 100;
          }
          const gPct = gstPercent !== undefined ? gstPercent : 0;
          gstAmount = Math.round(((taxable * gPct) / 100) * 100) / 100;
          if (lineTotal <= 0) {
            lineTotal = Math.round((taxable + gstAmount) * 100) / 100;
          }
        }

        const flags = [...(item.flags || [])];
        if (gstPercent === undefined && !flags.includes('AMBIGUOUS_GST_RATE')) {
          flags.push('AMBIGUOUS_GST_RATE');
        }

        return {
          lineNumber: item.lineNumber || idx + 1,
          name: item.name,
          manufacturer: item.manufacturer || '',
          category: item.category || 'MEDICINE',
          presentation: item.presentation || '',
          packing: item.packing || item.packSize || '',
          packSize: item.packSize || item.packing || '',
          hsnCode: item.hsnCode || '',
          stockUnit: item.stockUnit || (item.category === 'MEDICINE' ? 'Strip' : 'Piece'),
          batchNumber: item.batchNumber || '',
          manufacturingDate: item.manufacturingDate || '',
          expiryDate: item.expiryDate || '',
          quantity: qty,
          schemeQuantity: item.schemeQuantity || 0,
          purchaseRate: rate,
          mrp: mrp > 0 ? mrp : Math.round(rate * 1.35 * 100) / 100,
          schemeDiscountPercent: item.schemeDiscountPercent || 0,
          discountPercent: disc,
          gstPercent: gstPercent !== undefined ? gstPercent : 0,
          taxableValue: taxable,
          lineTotal,
          gstAmount,
          matchedMedicineId: item.matchedMedicineId,
          matchedMedicineName: item.matchedMedicineName,
          createNewMedicineMaster: !item.matchedMedicineId && item.category === 'MEDICINE',
          confidence: item.confidence || 'HIGH',
          rawOcrText: item.rawOcrText,
          flags,
        };
      });

      setItems(normalized);
      setStep('REVIEW');
    } catch (err: any) {
      setError(err?.message || 'Invoice extraction failed. Please ensure file quality or paste text.');
    } finally {
      setIsParsing(false);
    }
  };

  const updateItemField = (index: number, field: keyof ParsedInvoiceItemData, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      const updated = { ...current, [field]: val };

      // Ensure discountPercent and schemeDiscountPercent remain strictly synchronized
      if (field === 'discountPercent' || field === 'schemeDiscountPercent') {
        const numDisc = Number(val) || 0;
        updated.discountPercent = numDisc;
        updated.schemeDiscountPercent = numDisc;
      }

      // If user edits GST:
      if (field === 'gstPercent') {
        const newGst = val !== '' && val !== null && val !== undefined ? Number(val) : 0;
        updated.gstPercent = newGst;
        const isInclusive = parsedTotals?.isInclusive;
        if (isInclusive && updated.lineTotal && updated.lineTotal > 0) {
          // Do not silently change line total on inclusive invoices; recalculate taxable base and GST
          if (newGst > 0) {
            updated.taxableValue = Math.round((updated.lineTotal / (1 + newGst / 100)) * 100) / 100;
          } else {
            updated.taxableValue = updated.lineTotal;
          }
          updated.gstAmount = Math.round((updated.lineTotal - updated.taxableValue) * 100) / 100;
        } else {
          // GST-exclusive: line taxable value stays constant; update gstAmount and lineTotal
          const tax = Number(updated.taxableValue) || 0;
          updated.gstAmount = Math.round(((tax * newGst) / 100) * 100) / 100;
          updated.lineTotal = Math.round((tax + updated.gstAmount) * 100) / 100;
        }
      }

      // If user edits quantity, purchaseRate, or discount:
      if (field === 'quantity' || field === 'purchaseRate' || field === 'discountPercent' || field === 'schemeDiscountPercent') {
        const q = Number(field === 'quantity' ? val : updated.quantity) || 0;
        const r = Number(field === 'purchaseRate' ? val : updated.purchaseRate) || 0;
        const d = Number(field === 'discountPercent' || field === 'schemeDiscountPercent' ? val : (updated.discountPercent ?? updated.schemeDiscountPercent ?? 0)) || 0;
        const isInclusive = parsedTotals?.isInclusive;
        const g = Number(updated.gstPercent) || 0;
        const rawTotal = Math.round(q * r * (1 - d / 100) * 100) / 100;

        if (isInclusive) {
          updated.lineTotal = rawTotal;
          updated.taxableValue = g > 0 ? Math.round((rawTotal / (1 + g / 100)) * 100) / 100 : rawTotal;
          updated.gstAmount = Math.round((rawTotal - updated.taxableValue) * 100) / 100;
        } else {
          updated.taxableValue = rawTotal;
          updated.gstAmount = Math.round(((rawTotal * g) / 100) * 100) / 100;
          updated.lineTotal = Math.round((rawTotal + updated.gstAmount) * 100) / 100;
        }
      }

      // If user manually edits taxableValue:
      if (field === 'taxableValue') {
        const newTaxable = Number(val) || 0;
        const g = Number(updated.gstPercent) || 0;
        updated.taxableValue = newTaxable;
        updated.gstAmount = Math.round(((newTaxable * g) / 100) * 100) / 100;
        updated.lineTotal = Math.round((newTaxable + updated.gstAmount) * 100) / 100;
      }

      next[index] = updated;
      return next;
    });
  };

  const addItemRow = () => {
    const isInclusive = parsedTotals?.isInclusive;
    const newItem: ParsedInvoiceItemData = {
      lineNumber: items.length + 1,
      name: 'New Medicine / Product',
      manufacturer: '',
      category: 'MEDICINE',
      packing: '10s',
      hsnCode: '30049099',
      stockUnit: 'Strip',
      batchNumber: `BT-${Date.now().toString().slice(-4)}`,
      expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000 * 2).toISOString().slice(0, 7),
      quantity: 1,
      schemeQuantity: 0,
      purchaseRate: 100,
      mrp: 140,
      schemeDiscountPercent: 0,
      discountPercent: 0,
      gstPercent: 5,
      taxableValue: isInclusive ? 95.24 : 100,
      lineTotal: isInclusive ? 100 : 105,
      gstAmount: isInclusive ? 4.76 : 5,
      createNewMedicineMaster: true,
      confidence: 'HIGH',
      flags: ['MANUALLY_ADDED'],
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateSumQty = () => items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

  // Total medicine cost excluding GST: sum of taxable values
  const calculateSumTaxable = () =>
    Math.round(items.reduce((sum, it) => {
      return sum + Number(it.taxableValue || 0);
    }, 0) * 100) / 100;

  // Total GST: sum of applicable GST amounts
  const calculateSumGst = () =>
    Math.round(items.reduce((sum, it) => {
      if (typeof it.gstAmount === 'number') {
        return sum + it.gstAmount;
      }
      const tax = Number(it.taxableValue || 0);
      const g = Number(it.gstPercent || 0);
      return sum + Math.round(((tax * g) / 100) * 100) / 100;
    }, 0) * 100) / 100;

  // Total medicine cost including GST: sum of medicine line totals including GST before round-off
  const calculateSumInclusive = () =>
    Math.round(items.reduce((sum, it) => {
      if (typeof it.lineTotal === 'number' && it.lineTotal > 0) {
        return sum + it.lineTotal;
      }
      const tax = Number(it.taxableValue || 0);
      const gst = typeof it.gstAmount === 'number' ? it.gstAmount : Math.round(((tax * Number(it.gstPercent || 0)) / 100) * 100) / 100;
      return sum + Math.round((tax + gst) * 100) / 100;
    }, 0) * 100) / 100;

  // Invoice round-off from parser or difference
  const getInvoiceRoundOff = () => {
    if (parsedTotals?.roundOff !== undefined && parsedTotals.roundOff !== null) {
      return parsedTotals.roundOff;
    }
    if (parsedTotals?.netPayable !== undefined && parsedTotals.netPayable !== null) {
      const gross = calculateSumInclusive();
      return Math.round((parsedTotals.netPayable - gross) * 100) / 100;
    }
    return 0;
  };

  // Final invoice grand total
  const calculateSumNet = () => {
    const gross = calculateSumInclusive();
    const ro = getInvoiceRoundOff();
    return Math.round((gross + ro) * 100) / 100;
  };

  const handleConfirm = async () => {
    if (isDuplicateWarning && !bypassDuplicateWarning) {
      setError('Duplicate invoice warning: please confirm by checking "Import Anyway"');
      return;
    }
    if (items.length === 0) {
      setError('Invoice must contain at least 1 item');
      return;
    }

    // Verify product names and sanitize
    const invalidPhrases = /^(?:BRANCH|BANK|A\/C\s*NO|ACCOUNT|IFSC|GSTIN|INVOICE\s*NO|CUSTOMER|TOTAL|TAX\s*SUMMARY|DECLARATION)/i;
    for (let i = 0; i < items.length; i++) {
      if (!items[i].name.trim()) {
        setError(`Item #${i + 1} is missing a product name`);
        return;
      }
      if (invalidPhrases.test(items[i].name.trim())) {
        setError(`Item #${i + 1} ("${items[i].name}") appears to be invoice header/bank information. Please remove or correct this row.`);
        return;
      }
    }

    const defaultExp = bulkExpiryDate || defaultFutureExp();
    const defaultBatch = bulkBatchNumber || 'SO-BATCH';

    try {
      setIsConfirming(true);
      setError(null);
      await inventoryApi.confirmPurchase({
        supplier: {
          name: supplierName.trim(),
          gstin: supplierGstin.trim() || undefined,
          phone: supplierPhone.trim() || undefined,
          email: supplierEmail.trim() || undefined,
        },
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        totalAmount: calculateSumNet(),
        items: items.map((it) => ({
          name: it.name.trim(),
          category: it.category,
          presentation: it.presentation || `${it.packing || 'Standard'} ${it.stockUnit || 'Unit'}`,
          packSize: it.packing || it.packSize || undefined,
          stockUnit: it.stockUnit || undefined,
          genericName: it.genericName?.trim() || undefined,
          strength: (it as any).strength?.trim() || undefined,
          manufacturer: (it as any).manufacturer?.trim() || undefined,
          batchNumber: it.batchNumber?.trim() || defaultBatch,
          manufacturingDate: it.manufacturingDate || undefined,
          expiryDate: it.expiryDate?.trim() || defaultExp,
          quantity: Number(it.quantity),
          purchaseRate: Number(it.purchaseRate) || 0,
          mrp: Number(it.mrp) || Math.round((Number(it.purchaseRate) || 0) * 1.35),
          discountPercent: Number(it.discountPercent ?? it.schemeDiscountPercent ?? 0),
          gstPercent: it.gstPercent !== undefined && it.gstPercent !== null ? Number(it.gstPercent) : 0,
          taxableValue: Number(it.taxableValue || 0),
          lineTotal: Number(it.lineTotal || (Number(it.taxableValue || 0) + (typeof it.gstAmount === 'number' ? it.gstAmount : Math.round((Number(it.taxableValue || 0) * Number(it.gstPercent || 0)) / 100)))),
          gstAmount: typeof it.gstAmount === 'number' ? it.gstAmount : Math.round((Number(it.taxableValue || 0) * Number(it.gstPercent || 0)) / 100),
          matchedMedicineId: it.matchedMedicineId ? Number(it.matchedMedicineId) : undefined,
          createNewMedicineMaster: it.createNewMedicineMaster,
        })),
      });

      // Synchronize confirmed MEDICINE InventoryItems to the local formulary (Dexie db.medicines)
      // immediately, using the persisted server records as the single source of truth.
      // Consumables are intentionally excluded (billing-only).
      try {
        await syncInventoryMedicinesToFormulary();
      } catch (syncErr) {
        console.warn('[InvoiceImporterModal] Formulary sync warning:', syncErr);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm purchase invoice');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="inv-modal-overlay">
      <div
        className="inv-modal-card modal-large"
        style={{
          maxWidth: '1360px',
          width: '98vw',
          height: step === 'REVIEW' ? '95vh' : 'auto',
          maxHeight: '95vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: step === 'REVIEW' ? 'hidden' : 'auto',
          padding: '16px 20px',
          gap: '10px',
        }}
      >
        <div className="inv-modal-header" style={{ flexShrink: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(0, 104, 95, 0.1)',
                color: 'var(--color-primary, #00685f)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="upload" size={20} />
            </div>
            <div>
              <h2 className="inv-modal-title" style={{ fontSize: '18px', fontWeight: 700 }}>
                Universal Purchase Invoice Importer & Multi-Row Extractor
              </h2>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                {step === 'UPLOAD'
                  ? 'Advanced multi-pass OCR & table segmentation for Indian pharmaceutical distributor invoices'
                  : 'Review & adjust extracted supplier metadata and line items before posting to inventory ledger'}
              </span>
            </div>
          </div>
          <button type="button" className="inv-close-btn" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>

        {error && (
          <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b', marginTop: '12px' }}>
            <Icon name="alert-triangle" size={18} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {step === 'UPLOAD' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '14px' }}>
            <div
              className="inv-dropzone"
              onClick={() => document.getElementById('inv-file-upload')?.click()}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '14px',
                padding: '28px 20px',
                textAlign: 'center',
                background: '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                id="inv-file-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '14px',
                  background: 'rgba(0, 104, 95, 0.08)',
                  color: 'var(--color-primary, #00685f)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px',
                }}
              >
                <Icon name="upload" size={26} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>
                {selectedFileName ? selectedFileName : 'Drop purchase invoice photo or PDF here, or click to browse'}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Compatible with all Indian distributor tax invoices (MYTHRI PHARMA, KIMS, Intas, Cipla, etc.). 1 to 100+ line items.
              </div>
              {imagePreviewUrl && (
                <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center' }}>
                  <img
                    src={imagePreviewUrl}
                    alt="Invoice Preview"
                    style={{ maxHeight: '180px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Or paste raw invoice OCR text:
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '6px' }}
                onClick={handleSampleInvoice}
              >
                Load Sample 9-Item Invoice
              </button>
            </div>

            <textarea
              className="form-input"
              rows={6}
              style={{ fontFamily: 'monospace', fontSize: '12px', borderRadius: '8px' }}
              placeholder="Paste raw invoice text or OCR output here if not uploading an image..."
              value={invoiceText}
              onChange={(e) => setInvoiceText(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleParse}
                disabled={isParsing || (!invoiceText.trim() && !fileBase64)}
                id="btn-parse-invoice"
                style={{ minWidth: '190px' }}
              >
                {isParsing ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="refresh-cw" size={14} className="spin" /> Processing Multi-Pass OCR...
                  </span>
                ) : (
                  'Extract & Review Line Items'
                )}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '10px', overflow: 'hidden' }}>
            {/* Top Collapsible / Fixed Bar: Warnings, Supplier details, Bulk Fill tools */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Duplicate warning banner */}
              {isDuplicateWarning && (
                <div
                  className="inv-warning-banner"
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderLeft: '4px solid #f59e0b',
                    color: '#92400e',
                    padding: '8px 12px',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}>
                    <Icon name="alert-triangle" size={16} />
                    <span>{duplicateMessage || 'Duplicate invoice warning: This invoice already exists.'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={bypassDuplicateWarning}
                        onChange={(e) => setBypassDuplicateWarning(e.target.checked)}
                      />
                      <span>Import Anyway (Confirm duplicate stock creation)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Extraction consistency alerts */}
              {extractionWarnings.length > 0 && !isDuplicateWarning && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderLeft: '4px solid #16a34a',
                    color: '#166534',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Icon name="check-circle" size={15} />
                  <span>{extractionWarnings.join(' | ')}</span>
                </div>
              )}

              {/* Supplier & Invoice Header Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '8px',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <label className="form-label" style={{ fontSize: '11px', color: '#475569', fontWeight: 600, margin: 0 }}>
                    Supplier Name
                  </label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  style={{ fontSize: '12.5px', fontWeight: 600, padding: '4px 8px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                  Supplier GSTIN
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierGstin}
                  onChange={(e) => setSupplierGstin(e.target.value)}
                  placeholder="e.g. 32ABAFM5483C1ZM"
                  style={{ fontSize: '12.5px', padding: '4px 8px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                  Supplier Phone / Email
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierPhone || supplierEmail}
                  onChange={(e) => {
                    setSupplierPhone(e.target.value);
                    setSupplierEmail(e.target.value);
                  }}
                  placeholder="Phone or Email"
                  style={{ fontSize: '12.5px', padding: '4px 8px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                  Supplier State / DL No
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierState || supplierDlNo}
                  onChange={(e) => {
                    setSupplierState(e.target.value);
                    setSupplierDlNo(e.target.value);
                  }}
                  placeholder="State / DL No"
                  style={{ fontSize: '12.5px', padding: '4px 8px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                  Invoice Number
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  style={{ fontSize: '12.5px', fontWeight: 600, padding: '4px 8px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                  Invoice Date & Time
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="date"
                    className="form-input"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    style={{ fontSize: '12.5px', padding: '4px 6px', flex: 1 }}
                  />
                  {invoiceTime && (
                    <input
                      type="text"
                      className="form-input"
                      value={invoiceTime}
                      onChange={(e) => setInvoiceTime(e.target.value)}
                      placeholder="Time"
                      style={{ fontSize: '11px', width: '75px', padding: '4px 4px' }}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                  Payment Type
                </label>
                <select
                  className="form-input"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  style={{ fontSize: '12.5px', padding: '4px 8px' }}
                >
                  <option value="CREDIT">CREDIT</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>

            {/* Missing Expiry Date Quick-Action Banner */}
            {missingExpiryCount > 0 && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontSize: '12.5px', fontWeight: 600 }}>
                  <Icon name="alert-triangle" size={16} />
                  <span>{missingExpiryCount} items do not have an expiry date (standard in Sales Orders & Challans).</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleQuickAddYears(2)}
                    style={{ fontSize: '11.5px', padding: '4px 12px', background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e', fontWeight: 700 }}
                  >
                    ⚡ Auto-Fill +2 Years ({bulkExpiryDate}) to All {missingExpiryCount} Items
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleQuickAddYears(3)}
                    style={{ fontSize: '11.5px', padding: '4px 10px', background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e', fontWeight: 700 }}
                  >
                    +3 Years
                  </button>
                </div>
              </div>
            )}

            {/* Bulk Quick-Fill Toolbar */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="edit-3" size={14} /> Bulk Fill Tools:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#64748b' }}>Expiry:</span>
                  <input
                    type="date"
                    value={bulkExpiryDate}
                    onChange={(e) => setBulkExpiryDate(e.target.value)}
                    style={{ padding: '2px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleApplyExpiry(true)}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    title="Fill expiry date for all rows that are currently empty"
                  >
                    Apply to Empty
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleApplyExpiry(false)}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                    title="Overwrite expiry date for all rows"
                  >
                    Apply to All
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                  <span style={{ color: '#64748b' }}>Batch:</span>
                  <input
                    type="text"
                    value={bulkBatchNumber}
                    onChange={(e) => setBulkBatchNumber(e.target.value)}
                    placeholder="Batch"
                    style={{ width: '90px', padding: '2px 6px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleApplyBatch(true)}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    Apply to Empty
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                  <span style={{ color: '#64748b' }}>GST:</span>
                  <select
                    value={bulkGstPercent}
                    onChange={(e) => setBulkGstPercent(Number(e.target.value))}
                    style={{ padding: '2px 4px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleApplyGst}
                    style={{ fontSize: '11px', padding: '2px 8px' }}
                  >
                    Apply GST
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={addItemRow}
                style={{ fontSize: '11.5px', padding: '3px 10px', borderRadius: '6px', fontWeight: 600 }}
              >
                + Add Line Item
              </button>
            </div>
          </div>

          <style>{`
            .inv-clean-input::-webkit-outer-spin-button,
            .inv-clean-input::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            .inv-clean-input[type=number] {
              -moz-appearance: textfield;
            }
            .inv-clean-input {
              width: 100%;
              box-sizing: border-box;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 4px 6px;
              font-size: 12px;
              background: #ffffff;
              transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }
            .inv-clean-input:focus {
              border-color: var(--color-primary, #00685f);
              outline: none;
              box-shadow: 0 0 0 2px rgba(0, 104, 95, 0.15);
            }
            .inv-sticky-table th {
              position: sticky;
              top: 0;
              background: #f1f5f9;
              z-index: 10;
              box-shadow: inset 0 -1px 0 #cbd5e1;
              font-weight: 700;
              color: #334155;
              padding: 8px 6px;
              font-size: 11.5px;
            }
          `}</style>

          {/* Scrollable Table Area with Permanently Sticky Header */}
          <div style={{ flex: 1, minHeight: '220px', overflowX: 'auto', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', position: 'relative' }}>
            <table className="inventory-table inv-sticky-table" style={{ fontSize: '12px', minWidth: '1360px', margin: 0, width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '36px', minWidth: '36px', textAlign: 'center' }}>#</th>
                  <th style={{ minWidth: '220px', textAlign: 'left' }}>Product / Medicine Name</th>
                  <th style={{ width: '160px', minWidth: '160px', textAlign: 'left' }}>Manufacturer</th>
                  <th style={{ width: '85px', minWidth: '85px', textAlign: 'left' }}>Packing</th>
                  <th style={{ width: '95px', minWidth: '95px', textAlign: 'left' }}>HSN</th>
                  <th style={{ width: '105px', minWidth: '105px', textAlign: 'left' }}>Batch No</th>
                  <th style={{ width: '110px', minWidth: '110px', textAlign: 'left' }}>Exp Date</th>
                  <th style={{ width: '70px', minWidth: '70px', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '70px', minWidth: '70px', textAlign: 'center' }}>Sch Qty</th>
                  <th style={{ width: '85px', minWidth: '85px', textAlign: 'right' }}>MRP (₹)</th>
                  <th style={{ width: '90px', minWidth: '90px', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ width: '75px', minWidth: '75px', textAlign: 'right' }}>Disc %</th>
                  <th style={{ width: '70px', minWidth: '70px', textAlign: 'center' }}>GST %</th>
                  <th style={{ width: '105px', minWidth: '105px', textAlign: 'right' }}>Taxable (₹)</th>
                  <th style={{ width: '105px', minWidth: '105px', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ width: '38px', minWidth: '38px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="inv-clean-input"
                          value={it.name}
                          onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                          style={{ fontWeight: 600 }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                          {it.matchedMedicineId ? (
                            <span style={{ fontSize: '10.5px', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Icon name="check" size={11} /> Matched
                            </span>
                          ) : (
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', color: '#b45309', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={it.createNewMedicineMaster ?? true}
                                onChange={(e) => updateItemField(idx, 'createNewMedicineMaster', e.target.checked)}
                              />
                              <span>New Master Item</span>
                            </label>
                          )}
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: it.confidence === 'HIGH' ? '#dcfce7' : it.confidence === 'MEDIUM' ? '#fef9c3' : '#fee2e2',
                              color: it.confidence === 'HIGH' ? '#166534' : it.confidence === 'MEDIUM' ? '#854d0e' : '#991b1b',
                              fontWeight: 600,
                            }}
                          >
                            {it.confidence || 'HIGH'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="inv-clean-input"
                          value={it.manufacturer || ''}
                          onChange={(e) => updateItemField(idx, 'manufacturer', e.target.value)}
                          placeholder="Manufacturer"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="inv-clean-input"
                          value={it.packing || ''}
                          onChange={(e) => updateItemField(idx, 'packing', e.target.value)}
                          placeholder="e.g. 5ml"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="inv-clean-input"
                          value={it.hsnCode || ''}
                          onChange={(e) => updateItemField(idx, 'hsnCode', e.target.value)}
                          placeholder="HSN"
                          style={{ fontFamily: 'monospace' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="inv-clean-input"
                          value={it.batchNumber}
                          placeholder="Batch"
                          onChange={(e) => updateItemField(idx, 'batchNumber', e.target.value)}
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            borderColor: !it.batchNumber ? '#f87171' : undefined,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="inv-clean-input"
                          value={it.expiryDate}
                          placeholder="YYYY-MM"
                          onChange={(e) => updateItemField(idx, 'expiryDate', e.target.value)}
                          style={{
                            borderColor: !it.expiryDate ? '#f87171' : undefined,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="inv-clean-input"
                          value={it.quantity}
                          onChange={(e) => updateItemField(idx, 'quantity', Number(e.target.value))}
                          style={{ textAlign: 'center', fontWeight: 600 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="inv-clean-input"
                          value={it.schemeQuantity || 0}
                          onChange={(e) => updateItemField(idx, 'schemeQuantity', Number(e.target.value))}
                          style={{ textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="inv-clean-input"
                          value={it.mrp || 0}
                          onChange={(e) => updateItemField(idx, 'mrp', Number(e.target.value))}
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="inv-clean-input"
                          value={it.purchaseRate}
                          onChange={(e) => updateItemField(idx, 'purchaseRate', Number(e.target.value))}
                          style={{ textAlign: 'right', fontWeight: 600 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className="inv-clean-input"
                          value={it.discountPercent ?? it.schemeDiscountPercent ?? 0}
                          onChange={(e) => updateItemField(idx, 'discountPercent', Number(e.target.value))}
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className="inv-clean-input"
                          value={it.gstPercent !== undefined && it.gstPercent !== null ? it.gstPercent : ''}
                          onChange={(e) => updateItemField(idx, 'gstPercent', e.target.value === '' ? '' : Number(e.target.value))}
                          style={{ textAlign: 'center' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="inv-clean-input"
                          value={it.taxableValue !== undefined && it.taxableValue !== null ? it.taxableValue : ''}
                          onChange={(e) => updateItemField(idx, 'taxableValue', e.target.value === '' ? '' : Number(e.target.value))}
                          style={{ textAlign: 'right', fontWeight: 600 }}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                        ₹{(it.lineTotal || (Number(it.taxableValue || 0) + (typeof it.gstAmount === 'number' ? it.gstAmount : Math.round((Number(it.taxableValue || 0) * Number(it.gstPercent || 0)) / 100)))).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeItem(idx)}
                          title="Remove item"
                          style={{ color: '#ef4444', padding: '2px' }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Cross-Check Footer */}
            {/* Phase 3: Invoice Summary Cards & Reconciliation */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '10px',
                }}
              >
                {/* 1. Total medicine cost excluding GST */}
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total Cost (Excl. GST)
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    ₹{calculateSumTaxable().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {parsedTotals?.taxableAmount != null && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      Invoice: ₹{Number(parsedTotals.taxableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {/* 2. Total GST */}
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total GST
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    ₹{calculateSumGst().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {parsedTotals?.totalTax != null && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                      Invoice: ₹{Number(parsedTotals.totalTax).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {/* 3. Total medicine cost including GST */}
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Total Cost (Incl. GST)
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                    ₹{calculateSumInclusive().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Before round-off
                  </div>
                </div>

                {/* 4. Invoice round-off */}
                <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Invoice Round-Off
                  </div>
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: getInvoiceRoundOff() < 0 ? '#b91c1c' : '#0f172a', marginTop: '2px' }}>
                    {getInvoiceRoundOff() < 0 ? '−' : ''}₹{Math.abs(getInvoiceRoundOff()).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Source adjustment
                  </div>
                </div>

                {/* 5. Final invoice grand total */}
                <div style={{ background: '#f0fdf4', padding: '8px 12px', borderRadius: '6px', border: '1px solid #86efac' }}>
                  <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
                    Final Grand Total
                  </div>
                  <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                    ₹{calculateSumNet().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {parsedTotals?.netPayable != null && (
                    <div style={{ fontSize: '10px', color: '#166534', marginTop: '2px' }}>
                      Invoice: ₹{Number(parsedTotals.netPayable).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>

              {/* Invoice Totals Reconciliation Display */}
              {parsedTotals && (parsedTotals.taxableAmount != null || parsedTotals.netPayable != null) && (() => {
                const invoiceNet = Number(parsedTotals.netPayable ?? 0);
                const itemsNet = calculateSumNet();
                const totalDiff = Math.abs(itemsNet - invoiceNet);
                const isReconciled = totalDiff <= 0.5;

                return (
                  <div
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      background: isReconciled ? '#f0fdf4' : '#fffbeb',
                      border: `1px solid ${isReconciled ? '#bbf7d0' : '#fde68a'}`,
                      color: isReconciled ? '#166534' : '#92400e',
                      marginTop: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>
                        <strong>Reconciliation Status:</strong> {items.length} items | {calculateSumQty()} units |
                        Taxable Base: ₹{calculateSumTaxable().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} |
                        GST Total: ₹{calculateSumGst().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      {isReconciled ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 700 }}>
                          <Icon name="check" size={13} /> Fully Reconciled (Diff: ₹{totalDiff.toFixed(2)})
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#b45309', fontWeight: 700 }}>
                          <Icon name="alert-triangle" size={13} /> Discrepancy: ₹{totalDiff.toFixed(2)} (Review line item rates or GST)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('UPLOAD')}
                disabled={isConfirming}
              >
                Back to Upload
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isConfirming}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={isConfirming || (isDuplicateWarning && !bypassDuplicateWarning)}
                  id="btn-confirm-purchase-invoice"
                  style={{ minWidth: '180px' }}
                >
                  {isConfirming ? 'Posting to Stock Ledger...' : 'Confirm & Post to Stock'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
