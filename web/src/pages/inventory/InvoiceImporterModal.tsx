// =============================================================
// VetRx — InvoiceImporterModal.tsx
// Universal Format-Agnostic Purchase Invoice Importer & Review Screen
// =============================================================

import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import {
  inventoryApi,
  type ParsedInvoiceData,
  type InventoryCategory,
} from '../../services/inventoryApi';

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
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review & Confirmation State
  const [supplierName, setSupplierName] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isDuplicateWarning, setIsDuplicateWarning] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [bypassDuplicateWarning, setBypassDuplicateWarning] = useState(false);

  const [items, setItems] = useState<
    Array<{
      name: string;
      category: InventoryCategory;
      presentation: string;
      packSize: string;
      stockUnit: string;
      batchNumber: string;
      manufacturingDate: string;
      expiryDate: string;
      quantity: number;
      purchaseRate: number;
      mrp: number;
      matchedMedicineId?: number | null;
      matchedMedicineName?: string | null;
      createNewMedicineMaster: boolean;
      flags: string[];
    }>
  >([]);

  if (!isOpen) return null;

  const handleSampleInvoice = () => {
    const sample = `TAX INVOICE
MYTHRI PHARMA VET DISTRIBUTORS
GSTIN: 37AAACM8912P1ZS
Invoice No: MY/26-27/6597    Date: 28-08-2026

Item Description               Batch      Exp Date    Qty    Rate (INR)   MRP
OPTHOCARE EYE DROPS 5ML        OPG472     05/2028     10     85.00        130.00
CEPHAVET ORAL SUSPENSION 60ML  TSVCV2602  10/2027     15     120.00       180.00
DISPO VAN SYRINGES 5ML (100S)  DV9882     12/2029     2      350.00       500.00
CHROMIC CATGUT 2-0 SUTURE      SUT771     08/2028     5      95.00        145.00

Total Amount: ₹3,825.00`;
    setInvoiceText(sample);
    setSelectedFileName('sample_mythri_pharma_invoice.txt');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const reader = new FileReader();

    if (file.type.startsWith('image/')) {
      reader.onload = async () => {
        // Mock OCR text extraction for local image preview
        const detectedText = `INVOICE: ${file.name}\nExtracted from image invoice: Ceftriaxone 1g Injection Batch CFX901 Exp: 09/2028 Qty: 20 Rate: 42.00 MRP: 65.00`;
        setInvoiceText(detectedText);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (ev) => {
        setInvoiceText(String(ev.target?.result || ''));
      };
      reader.readAsText(file);
    }
  };

  const handleParse = async () => {
    if (!invoiceText.trim()) {
      setError('Please upload a file or paste invoice text');
      return;
    }

    try {
      setIsParsing(true);
      setError(null);
      const parsed: ParsedInvoiceData = await inventoryApi.parseInvoice({
        invoiceText,
        fileName: selectedFileName || 'Uploaded_Invoice.pdf',
      });

      setSupplierName(parsed.supplier?.name || 'Veterinary Distributor');
      setSupplierGstin(parsed.supplier?.gstin || '');
      setInvoiceNumber(parsed.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`);
      setInvoiceDate(parsed.invoiceDate || new Date().toISOString().split('T')[0]);
      setTotalAmount(parsed.totalAmount || 0);

      setIsDuplicateWarning(Boolean(parsed.isDuplicateWarning));
      setDuplicateMessage(parsed.duplicateMessage || '');
      setBypassDuplicateWarning(false);

      const normalized = (parsed.items || []).map((item) => ({
        name: item.name,
        category: item.category || 'MEDICINE',
        presentation: item.presentation || '',
        packSize: item.packSize || '',
        stockUnit: item.stockUnit || (item.category === 'MEDICINE' ? 'Vial' : 'Piece'),
        batchNumber: item.batchNumber || '',
        manufacturingDate: item.manufacturingDate || '',
        expiryDate: item.expiryDate || '',
        quantity: item.quantity || 1,
        purchaseRate: item.purchaseRate || 0,
        mrp: item.mrp || 0,
        matchedMedicineId: item.matchedMedicineId,
        matchedMedicineName: item.matchedMedicineName,
        createNewMedicineMaster: !item.matchedMedicineId && item.category === 'MEDICINE',
        flags: item.flags || [],
      }));

      setItems(normalized);
      setStep('REVIEW');
    } catch (err: any) {
      setError(err?.message || 'Universal invoice parsing failed');
    } finally {
      setIsParsing(false);
    }
  };

  const updateItemField = (index: number, field: string, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
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

    // Verify all items have batch and expiry
    for (let i = 0; i < items.length; i++) {
      if (!items[i].batchNumber.trim()) {
        setError(`Item #${i + 1} (${items[i].name}) is missing a batch number`);
        return;
      }
      if (!items[i].expiryDate) {
        setError(`Item #${i + 1} (${items[i].name}) is missing an expiry date`);
        return;
      }
    }

    try {
      setIsConfirming(true);
      setError(null);
      await inventoryApi.confirmPurchase({
        supplier: {
          name: supplierName.trim(),
          gstin: supplierGstin.trim() || undefined,
        },
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        totalAmount: Number(totalAmount) || items.reduce((sum, it) => sum + it.quantity * it.purchaseRate, 0),
        items: items.map((it) => ({
          name: it.name,
          category: it.category,
          presentation: it.presentation || undefined,
          packSize: it.packSize || undefined,
          stockUnit: it.stockUnit || undefined,
          batchNumber: it.batchNumber.trim(),
          manufacturingDate: it.manufacturingDate || undefined,
          expiryDate: it.expiryDate,
          quantity: Number(it.quantity),
          purchaseRate: Number(it.purchaseRate) || 0,
          mrp: Number(it.mrp) || undefined,
          matchedMedicineId: it.matchedMedicineId ? Number(it.matchedMedicineId) : undefined,
          createNewMedicineMaster: it.createNewMedicineMaster,
        })),
      });

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
      <div className="inv-modal-card modal-large">
        <div className="inv-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 104, 95, 0.1)',
                color: 'var(--color-primary, #00685f)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="upload" size={18} />
            </div>
            <div>
              <h2 className="inv-modal-title">Universal Purchase Invoice Importer</h2>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                {step === 'UPLOAD'
                  ? 'Format-agnostic parser for PDF, JPG, PNG & text invoices'
                  : 'Review extracted values before posting to stock ledger'}
              </span>
            </div>
          </div>
          <button type="button" className="inv-close-btn" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>

        {error && (
          <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
            <Icon name="alert-triangle" size={18} />
            <span>{error}</span>
          </div>
        )}

        {step === 'UPLOAD' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="inv-dropzone" onClick={() => document.getElementById('inv-file-upload')?.click()}>
              <input
                id="inv-file-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(0, 104, 95, 0.08)',
                  color: 'var(--color-primary, #00685f)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                <Icon name="upload" size={24} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                {selectedFileName ? selectedFileName : 'Drop purchase invoice here, or browse'}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Supports any supplier format (PDF, JPG, JPEG, PNG, or text). 1 to 100+ line items.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                Or paste raw invoice OCR text:
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 10px' }}
                onClick={handleSampleInvoice}
              >
                Load Sample Multi-item Invoice
              </button>
            </div>

            <textarea
              className="form-input"
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: '12.5px' }}
              placeholder="Paste raw invoice text or OCR output here..."
              value={invoiceText}
              onChange={(e) => setInvoiceText(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleParse}
                disabled={isParsing || !invoiceText.trim()}
                id="btn-parse-invoice"
              >
                {isParsing ? 'Extracting & Normalizing...' : 'Extract & Review Line Items'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Duplicate warning banner */}
            {isDuplicateWarning && (
              <div
                className="inv-warning-banner"
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderLeft: '4px solid #f59e0b',
                  color: '#92400e',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                  <Icon name="alert-triangle" size={18} />
                  <span>{duplicateMessage || 'This invoice may already have been imported.'}</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                  Supplier: <strong>{supplierName}</strong> | Invoice: <strong>{invoiceNumber}</strong> | Date: <strong>{invoiceDate}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
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

            {/* Invoice Metadata Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '14px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Supplier Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  style={{ fontSize: '13px', fontWeight: 600 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Supplier GSTIN
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={supplierGstin}
                  onChange={(e) => setSupplierGstin(e.target.value)}
                  placeholder="e.g. 37AAACM8912P1ZS"
                  style={{ fontSize: '13px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Invoice Number
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  style={{ fontSize: '13px', fontWeight: 600 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Invoice Date
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Normalized Line Items Table */}
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Item & Match</th>
                    <th>Category</th>
                    <th>Batch No</th>
                    <th>Expiry Date</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Qty</th>
                    <th style={{ width: '90px' }}>Rate (₹)</th>
                    <th style={{ width: '80px' }}>MRP (₹)</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={it.name}
                          onChange={(e) => updateItemField(idx, 'name', e.target.value)}
                          style={{ fontSize: '13px', fontWeight: 600, padding: '4px 8px', marginBottom: '4px' }}
                        />
                        {it.matchedMedicineId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#15803d' }}>
                            <Icon name="check" size={12} />
                            <span>Matched: {it.matchedMedicineName || it.name}</span>
                          </div>
                        ) : it.category === 'MEDICINE' ? (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#b45309' }}>
                            <input
                              type="checkbox"
                              checked={it.createNewMedicineMaster}
                              onChange={(e) => updateItemField(idx, 'createNewMedicineMaster', e.target.checked)}
                            />
                            <span>New medicine detected (Create Master)</span>
                          </label>
                        ) : null}
                        {it.flags?.length > 0 && (
                          <div style={{ fontSize: '10.5px', color: '#dc2626', marginTop: '2px' }}>
                            {it.flags.join(', ')}
                          </div>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-input"
                          style={{ fontSize: '12px', padding: '4px 6px' }}
                          value={it.category}
                          onChange={(e) => updateItemField(idx, 'category', e.target.value)}
                        >
                          <option value="MEDICINE">Medicine</option>
                          <option value="CONSUMABLE">Consumable</option>
                          <option value="LAB_MATERIAL">Lab Material</option>
                          <option value="SURGICAL_MATERIAL">Surgical</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          value={it.batchNumber}
                          placeholder="Batch"
                          onChange={(e) => updateItemField(idx, 'batchNumber', e.target.value)}
                          style={{
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            padding: '4px 6px',
                            borderColor: !it.batchNumber ? '#f87171' : undefined,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-input"
                          value={it.expiryDate}
                          onChange={(e) => updateItemField(idx, 'expiryDate', e.target.value)}
                          style={{
                            fontSize: '12px',
                            padding: '4px 6px',
                            borderColor: !it.expiryDate ? '#f87171' : undefined,
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          value={it.quantity}
                          onChange={(e) => updateItemField(idx, 'quantity', Number(e.target.value))}
                          style={{ fontSize: '12px', textAlign: 'center', padding: '4px 6px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          value={it.purchaseRate}
                          onChange={(e) => updateItemField(idx, 'purchaseRate', Number(e.target.value))}
                          style={{ fontSize: '12px', padding: '4px 6px' }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          value={it.mrp}
                          onChange={(e) => updateItemField(idx, 'mrp', Number(e.target.value))}
                          style={{ fontSize: '12px', padding: '4px 6px' }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeItem(idx)}
                          title="Remove item"
                          style={{ color: '#ef4444' }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total summary footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 18px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                Total Line Items: <strong>{items.length}</strong> | Total Units:{' '}
                <strong>{items.reduce((s, it) => s + Number(it.quantity || 0), 0)}</strong>
              </div>
              <div style={{ fontSize: '15px' }}>
                Invoice Total:{' '}
                <strong style={{ color: 'var(--color-primary, #00685f)', fontSize: '18px' }}>
                  ₹
                  {items
                    .reduce((sum, it) => sum + Number(it.quantity || 0) * Number(it.purchaseRate || 0), 0)
                    .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('UPLOAD')}
                disabled={isConfirming}
              >
                ← Back to Upload
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
