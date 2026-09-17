// =============================================================
// VetRx — InvoiceDetailsPage (Print-Ready Tax Invoice & Receipt)
// Phase 6: Full Statutory G.O. Line Notes & Printable Canvas
// =============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Icon } from '../../components/ui/Icon';
import { useSettingsStore } from '../../store/settingsStore';
import { formatINR, numberToWordsINR } from './invoiceUtils';
import { formatAnimalSubtitle, formatOwnerPrimary, isArtificialOrBlankName } from '../../utils/patientFormat';
import { generatePdfBlob, savePdfWithFilePicker, buildInvoiceFilename, buildReceiptFilename } from '../../utils/pdfGenerator';
import { ShareModal } from '../../components/ui/ShareModal';
import { PractitionerHeader } from '../../components/common/PractitionerHeader';
import './Invoices.css';

export const InvoiceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldAutoPrint = searchParams.get('print') === 'true';

  const [documentType, setDocumentType] = useState<'Tax Invoice' | 'Payment Receipt'>('Tax Invoice');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareBlob, setShareBlob] = useState<Blob | undefined>();
  const [shareFilename, setShareFilename] = useState<string | undefined>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load identity from Settings (Single source of truth)
  const {
    practitioner: storePractitioner,
    organisation: storeOrganisation,
    showHsnColumn,
    showSacColumn,
    showSpecialInstructionsForOwner,
  } = useSettingsStore();

  // Load invoice & items
  const invoiceId = parseInt(id || '0', 10);
  const invoice = useLiveQuery(() => db.invoices.get(invoiceId), [invoiceId]);
  const items = useLiveQuery(
    () => db.invoiceItems.where('invoiceId').equals(invoiceId).sortBy('sortOrder'),
    [invoiceId]
  ) || [];

  const patient = useLiveQuery(
    () => (invoice ? db.patients.get(invoice.patientId) : undefined),
    [invoice]
  );
  const owner = useLiveQuery(
    () => (invoice ? db.owners.get(invoice.ownerId) : undefined),
    [invoice]
  );
  const prescription = useLiveQuery(
    () => (invoice?.prescriptionId ? db.prescriptions.get(invoice.prescriptionId) : undefined),
    [invoice]
  );

  const allLinkedPrescriptions = useLiveQuery(async () => {
    if (!invoice) return [];
    const ids: number[] = [];
    if (invoice.prescriptionId) ids.push(invoice.prescriptionId);
    if (invoice.prescriptionIds && Array.isArray(invoice.prescriptionIds)) {
      ids.push(...invoice.prescriptionIds);
    }
    items.forEach((it) => {
      if (it.prescriptionId) ids.push(it.prescriptionId);
    });
    const uniqueIds = Array.from(new Set(ids)).filter((pid): pid is number => typeof pid === 'number' && pid > 0);
    if (uniqueIds.length === 0) return [];
    return db.prescriptions.where('id').anyOf(uniqueIds).toArray();
  }, [invoice, items]) || [];

  const linkedRxNumbers = useMemo(() => {
    const set = new Set<string>();
    if (prescription?.rxNumber) set.add(prescription.rxNumber);
    allLinkedPrescriptions.forEach((p) => {
      if (p.rxNumber) set.add(p.rxNumber);
    });
    items.forEach((it) => {
      if (it.prescriptionNumber) set.add(it.prescriptionNumber);
    });
    return Array.from(set);
  }, [prescription, allLinkedPrescriptions, items]);

  const invoicePractitioner = useLiveQuery(
    () => (invoice?.practitionerId ? db.practitioners.get(invoice.practitionerId) : undefined),
    [invoice?.practitionerId]
  );
  const allPractitioners = useLiveQuery(() => db.practitioners.toArray(), []);

  // ── Resolve Active Identity ─────────────────────────────────────
  // Preference order:
  // 1. Current active practitioner from Settings store
  // 2. Linked practitioner on invoice or first practitioner in DB
  const activePractitioner =
    storePractitioner ||
    invoicePractitioner ||
    (allPractitioners && allPractitioners.length > 0 ? allPractitioners[0] : null);

  // Active Organisation / Clinic Identity:
  // Strictly driven by storeOrganisation. If clinic is OFF / Independent Practitioner,
  // storeOrganisation.isActive === false, so activeOrganisation is null and no clinic branding is displayed.
  const activeOrganisation =
    storeOrganisation && storeOrganisation.isActive !== false ? storeOrganisation : null;

  const doctorName = activePractitioner?.name?.trim() || '';
  const doctorQual = activePractitioner?.qualifications?.trim() || '';
  const rawReg = activePractitioner?.registrationNumber?.trim() || '';

  const handleCancelInvoice = async () => {
    if (!invoice?.id || invoice.status === 'Cancelled') return;
    const reason = window.prompt('Enter cancellation reason:');
    if (reason === null) return;
    await db.invoices.update(invoice.id, { status: 'Cancelled', notes: `${invoice.notes || ''}${invoice.notes ? '\n' : ''}Cancelled: ${reason.trim() || 'No reason recorded'}`, updatedAt: new Date() });
    navigate(`/invoices/${invoice.id}`);
  };

  const handleSavePdf = async () => {
    if (!invoice) return;
    try {
      setIsGeneratingPdf(true);
      const sheet = document.getElementById('invoice-sheet');
      if (!sheet) {
        showToast('Document sheet element not found in DOM.');
        return;
      }
      const filename = documentType === 'Payment Receipt'
        ? buildReceiptFilename(invoice.invoiceNumber, patient?.name, invoice.invoiceDate)
        : buildInvoiceFilename(invoice.invoiceNumber, patient?.name, invoice.invoiceDate);
      const blob = await generatePdfBlob(sheet);
      setShareBlob(blob);
      setShareFilename(filename);
      const result = await savePdfWithFilePicker(blob, filename);
      if (result.success) {
        showToast(`${documentType} PDF saved: ${filename}`);
      } else if (result.error) {
        showToast(`Failed to save PDF: ${result.error}`);
      }
    } catch (err: unknown) {
      console.error('Save PDF failed:', err);
      showToast('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    if (!invoice) return;
    try {
      setIsGeneratingPdf(true);
      const sheet = document.getElementById('invoice-sheet');
      if (!sheet) return;
      const filename = documentType === 'Payment Receipt'
        ? buildReceiptFilename(invoice.invoiceNumber, patient?.name, invoice.invoiceDate)
        : buildInvoiceFilename(invoice.invoiceNumber, patient?.name, invoice.invoiceDate);
      const blob = shareBlob || (await generatePdfBlob(sheet));
      setShareBlob(blob);
      setShareFilename(filename);
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `${documentType} ${invoice.invoiceNumber}`,
            text: `VetRx ${documentType} ${invoice.invoiceNumber} for ${patient?.name || 'Patient'}`,
            files: [file],
          });
          return;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
        }
      }
      setShareModalOpen(true);
    } catch (err: unknown) {
      console.error('Share failed:', err);
      setShareModalOpen(true);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Auto-print support if navigated with ?print=true
  useEffect(() => {
    if (shouldAutoPrint && invoice && items.length > 0) {
      const timer = setTimeout(() => {
        window.print();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoPrint, invoice, items.length]);

  if (!invoice) {
    return (
      <div className="invoices-page-container">
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <p>Loading invoice details…</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/invoices')}>
            Back to Invoices &amp; Receipts
          </button>
        </div>
      </div>
    );
  }

  const grossSubtotalPaisa = items.reduce((acc, it) => acc + (it.subtotalPaisa || it.quantity * it.unitPricePaisa), 0);
  const itemDiscountsPaisa = items.reduce((acc, it) => acc + (it.discountAmtPaisa || 0), 0);
  const doctorDiscountPaisa = invoice.discountTotal || 0;
  const grandTotalPaisa = invoice.grandTotal || 0;

  return (
    <div className="invoice-print-container">
      {/* Interactive Top Action Toolbar (Hidden in print) */}
      <div className="invoice-print-toolbar no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="btn-back"
            onClick={() => navigate('/invoices')}
            title="Back to Invoices"
          >
            <Icon name="arrow-left" size={14} />
            <span>Back</span>
          </button>
          <span style={{ fontSize: '13px', color: 'var(--color-outline)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700 }}>
            {invoice.invoiceNumber}
          </span>
          <span className={`invoices-status-pill ${invoice.status.toLowerCase()}`}>
            {invoice.status}
          </span>
        </div>

        {/* Document Type Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="no-print" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/invoices')}>View Invoice History</button>
            {invoice.status !== 'Cancelled' && (
              <button type="button" className="btn btn-danger btn-sm" onClick={handleCancelInvoice}>Cancel Invoice</button>
            )}
          </div>

          <div className="invoices-status-tabs">
            <button
              type="button"
              className={`invoices-status-tab ${documentType === 'Tax Invoice' ? 'active' : ''}`}
              onClick={() => setDocumentType('Tax Invoice')}
            >
              Tax Invoice
            </button>
            <button
              type="button"
              className={`invoices-status-tab ${documentType === 'Payment Receipt' ? 'active' : ''}`}
              onClick={() => setDocumentType('Payment Receipt')}
            >
              Payment Receipt
            </button>
          </div>

          {invoice.status === 'Draft' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
            >
              <Icon name="edit" size={15} />
              <span>Edit</span>
            </button>
          )}

          {/* Save PDF (Primary direct download action) */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSavePdf}
            disabled={isGeneratingPdf}
            id="btn-save-pdf"
            title="Download PDF directly with editable filename"
          >
            <Icon name="download" size={16} />
            <span>{isGeneratingPdf ? 'Generating PDF…' : 'Save PDF'}</span>
          </button>

          {/* Share Document */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleShare}
            disabled={isGeneratingPdf}
            id="btn-share-document"
            title="Share document via WhatsApp, Email, or Web Share"
          >
            <Icon name="share" size={16} />
            <span>Share</span>
          </button>

          {/* Secondary Browser Print */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => window.print()}
            id="btn-print-document"
            title="Open browser print dialog"
          >
            <Icon name="print" size={16} />
            <span>Print {documentType}</span>
          </button>
        </div>
      </div>

      {/* Floating toast notification */}
      {toastMessage && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--color-surface-container-highest, #334155)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <Icon name="check" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* A4 Printed Sheet Canvas (794px Standard Ratio) */}
      <div className="invoice-a4-sheet" id="invoice-sheet">
        <div>
          {/* Top Decorative Clinic Ribbon & Micro Watermark Bar */}
          <div
            className="invoice-official-ribbon"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '5px',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '6px',
              gap: '12px',
              flexWrap: 'nowrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-outline)',
                  whiteSpace: 'nowrap',
                }}
              >
                OFFICIAL REGISTERED CLINICAL VETERINARY DOCUMENT
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                fontFamily: 'var(--font-data)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span style={{ color: 'var(--color-outline)', whiteSpace: 'nowrap' }}>
                Doc Ref: <strong>{invoice.invoiceNumber}</strong>
              </span>
              <span className="document-badge">
                Original for Recipient
              </span>
            </div>
          </div>

          {/* Section 1: Clinic Header & Tax Invoice Block */}
          <div className="invoice-print-header avoid-break">
            {/* Clinic / Practice Credentials (Left) */}
            <div className="invoice-print-logo-col" style={{ flex: 1, minWidth: 0 }}>
              <PractitionerHeader
                practitioner={activePractitioner}
                organisation={activeOrganisation}
                showLogo={true}
              />
            </div>

            {/* Document Meta Card (Right) */}
            <div className="invoice-print-meta-col">
              <div className="invoice-print-badge">
                {documentType.toUpperCase()}
              </div>
              <div style={{ fontSize: '13px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <span style={{ color: 'var(--color-outline)' }}>Invoice No:</span>
                <strong style={{ fontFamily: 'var(--font-data)' }}>{invoice.invoiceNumber}</strong>
              </div>
              <div style={{ fontSize: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <span style={{ color: 'var(--color-outline)' }}>Date of Issue:</span>
                <span style={{ fontFamily: 'var(--font-data)' }}>
                  {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {linkedRxNumbers.length > 0 && (
                <div style={{ fontSize: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--color-outline)' }}>
                    {linkedRxNumbers.length > 1 ? 'Prescription Refs:' : 'Prescription Ref:'}
                  </span>
                  <strong style={{ fontFamily: 'var(--font-data)', color: 'var(--color-primary)' }}>
                    {linkedRxNumbers.map((r: string) => `#${r}`).join(', ')}
                  </strong>
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-tertiary)', fontWeight: 700, marginTop: '2px' }}>
                STATUS: {invoice.status.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Section 2: Patient & Client Signalment Panel */}
          <div className="invoice-print-grid-dossier avoid-break">
            {/* Client Dossier */}
            <div className="invoice-print-dossier-box">
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)', letterSpacing: '0.04em' }}>
                Billed Client (Owner / Farmer)
              </span>
              <strong style={{ fontSize: '15px', color: 'var(--color-on-surface)' }}>
                {formatOwnerPrimary(owner, 'Walk-in Client')}
              </strong>
              {owner?.phone && (
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-data)', color: 'var(--color-on-surface-variant)' }}>
                  Phone: {owner.phone}
                </span>
              )}
              {owner?.address && (
                <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                  {owner.address}
                </span>
              )}
            </div>

            {/* Patient Dossier */}
            <div className="invoice-print-dossier-box">
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)', letterSpacing: '0.04em' }}>
                Animal Signalment Profile
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                  {!isArtificialOrBlankName(patient?.name) ? patient?.name : formatAnimalSubtitle(patient)}
                </strong>
                {patient?.species && (
                  <span style={{ fontSize: '11px', fontWeight: 600, background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                    {patient.species} {patient.breed ? `· ${patient.breed}` : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                {patient?.sex && patient.sex !== 'Unknown' && <span>Sex: <strong>{patient.sex}</strong></span>}
                {patient?.sex && patient.sex !== 'Unknown' && <span>•</span>}
                <span>
                  Weight: <strong>{patient?.weightKg ? `${patient.weightKg.toFixed(1)} kg` : 'Weight N/A'}</strong>
                </span>
                {patient?.identificationRef && (
                  <>
                    <span>•</span>
                    <span>Ear Tag / Ref: <strong>{patient.identificationRef}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Itemized Charges Clinical Table */}
          <table className="invoice-print-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>SL</th>
                <th>Item / Clinical Description</th>
                {(showHsnColumn || showSacColumn) && (
                  <th style={{ width: '100px', textAlign: 'center' }}>
                    {showHsnColumn && showSacColumn ? 'HSN / SAC' : showHsnColumn ? 'HSN Code' : 'SAC Code'}
                  </th>
                )}
                <th style={{ width: '100px', textAlign: 'center' }}>Qty &amp; Unit</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Rate (₹)</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const lineSubtotal = Math.round(it.quantity * it.unitPricePaisa);
                const lineAmount = Math.max(0, lineSubtotal - (it.discountAmtPaisa || 0));
                const sl = String(idx + 1).padStart(2, '0');

                // Determine appropriate HSN/SAC code
                let code = 'SAC 9983';
                if (it.category === 'Medicine' || it.category === 'Prescription Medicine') code = 'HSN 3004';
                else if (it.category === 'Procedure Fee') code = 'SAC 9993';
                else if (it.category === 'Certificate' || it.category === 'Necropsy Report' || it.isGovPrescribed) code = 'SAC 9997';

                return (
                  <tr key={it.id || idx} className={`${it.isGovPrescribed ? 'gov-row' : ''} avoid-break`}>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-data)', color: 'var(--color-outline)' }}>
                      {sl}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: 'var(--color-on-surface)' }}>{it.description}</strong>
                        <span className="invoice-category-chip">
                          {it.category}
                        </span>
                      </div>

                      {/* Multi-Prescription / Cross-Patient Snapshot Sub-line */}
                      {((it.patientName && it.patientName !== patient?.name) || (it.prescriptionNumber && linkedRxNumbers.length > 1)) && (
                        <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant, #64748b)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {it.patientName && it.patientName !== patient?.name && (
                            <span>
                              Patient: <strong>{it.patientName}</strong>
                              {it.ownerName ? ` (${it.ownerName})` : ''}
                            </span>
                          )}
                          {it.prescriptionNumber && linkedRxNumbers.length > 1 && (
                            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                              Rx #{it.prescriptionNumber}
                            </span>
                          )}
                        </div>
                      )}

                      {/* STATUTORY GOVERNMENT ORDER NOTE DIRECTLY BELOW THIS SPECIFIC ITEM */}
                      {it.isGovPrescribed && (
                        <span className="invoice-print-go-subnote">
                          {it.govOrderNote ||
                            `As per the rate fixed by ${it.govOrderNumber || 'G.O.(Rt) No.589/2023/AHD'} dated ${it.govOrderDate || '13-12-2023'}`}
                        </span>
                      )}
                    </td>
                    {(showHsnColumn || showSacColumn) && (
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-data)', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                        {code}
                      </td>
                    )}
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-data)', fontSize: '12px' }}>
                      {it.quantity} {it.unit || 'units'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '12px' }}>
                      {((it.unitPricePaisa || 0) / 100).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                      {((lineAmount || 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Section 4 & 5: Unified Ledger & Signatory Block */}
          <div className="invoice-print-ledger-and-signoff avoid-break signature-block">
            {/* Section 4: Dual Ledger Partition */}
            <div className="invoice-print-ledger-grid avoid-break">
              {/* Left Side: Amount in Words & Notes */}
              <div className="invoice-print-words-box">
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)', letterSpacing: '0.04em' }}>
                    Invoice Total in Words
                  </span>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                    {numberToWordsINR(grandTotalPaisa)}
                  </div>
                </div>

                {/* Statutory Exemption Box */}
                <div className="invoice-print-statutory-gst">
                  <strong>Statutory Exemption Notice:</strong> Healthcare services and diagnostic examinations provided by registered clinical veterinary professionals are fully exempt from Goods and Services Tax (GST) as per{' '}
                  <strong>Notification No. 12/2017-Central Tax (Rate)</strong>.
                </div>

                {showSpecialInstructionsForOwner && invoice.notes && (
                  <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                    <strong>Special Instructions / Remarks:</strong> {invoice.notes}
                  </div>
                )}
              </div>

              {/* Right Side: Ledger Totals */}
              <div className="invoice-print-totals-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Gross Subtotal:</span>
                  <span style={{ fontFamily: 'var(--font-data)', fontWeight: 600 }}>
                    {formatINR(grossSubtotalPaisa)}
                  </span>
                </div>

                {itemDiscountsPaisa > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-on-surface-variant)' }}>Item Discounts:</span>
                    <span style={{ fontFamily: 'var(--font-data)', color: 'var(--color-tertiary)' }}>
                      -{formatINR(itemDiscountsPaisa)}
                    </span>
                  </div>
                )}

                {doctorDiscountPaisa > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-on-surface-variant)' }}>Doctor / Courtesy Discount:</span>
                    <span style={{ fontFamily: 'var(--font-data)', color: 'var(--color-tertiary)' }}>
                      -{formatINR(doctorDiscountPaisa)}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>GST (0.0% Exempt):</span>
                  <span style={{ fontFamily: 'var(--font-data)' }}>₹0.00</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '8px',
                    borderTop: '2px solid #cbd5e1',
                    marginTop: '4px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 800 }}>
                    Grand Total:
                  </span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)' }}>
                    {formatINR(grandTotalPaisa)}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 5: Legal Footer & Veterinarian Digital Signatory Stamp */}
            <div className="invoice-print-footer-wrap signature-block avoid-break">
              <div className="invoice-print-signature-section">
                {/* Signature Block aligned bottom-right with exact labels */}
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', marginLeft: 'auto' }}>
                  <div style={{ height: '36px', display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                    {activePractitioner?.signatureDataUrl && (
                      <img
                        src={activePractitioner.signatureDataUrl}
                        alt="Veterinarian Signature"
                        style={{ maxHeight: '36px', maxWidth: '140px', objectFit: 'contain' }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-on-surface)' }}>
                    <strong>Name:</strong> {doctorName}{doctorQual ? ` (${doctorQual})` : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                    <strong>Registration Number:</strong> {rawReg || 'N/A'}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                    Authorized Signatory
                  </div>
                </div>
              </div>

              {/* Micro Audit Note */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-data)', color: 'var(--color-outline)', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                <span>Computer-generated official {documentType.toLowerCase()} • Valid without physical seal.</span>
                <span>
                  Generated: {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Document Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        documentTitle={documentType}
        documentNumber={invoice.invoiceNumber}
        documentUrl={window.location.href}
        patientName={patient?.name}
        ownerName={owner?.name}
        grandTotalPaisa={invoice.grandTotal}
        pdfBlob={shareBlob}
        filename={shareFilename}
      />
    </div>
  );
};
