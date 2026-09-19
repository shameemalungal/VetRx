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
import { generatePdfBlob, savePdfWithFilePicker, savePdfNative, buildInvoiceFilename, buildReceiptFilename } from '../../utils/pdfGenerator';
import { isMobileDevice } from '../../utils/platformDetect';
import { ShareModal } from '../../components/ui/ShareModal';
import { InvoiceDocument } from '../../components/documents/InvoiceDocument';
import { ReceiptDocument } from '../../components/documents/ReceiptDocument';
import './Invoices.css';

export const InvoiceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldAutoPrint = searchParams.get('print') === 'true';

  const typeParam = searchParams.get('type')?.toLowerCase();
  const initialType = (typeParam === 'receipt' || typeParam === 'payment receipt' || searchParams.get('documentType')?.toLowerCase() === 'receipt')
    ? 'Payment Receipt'
    : 'Tax Invoice';
  const [documentType, setDocumentType] = useState<'Tax Invoice' | 'Payment Receipt'>(initialType);

  useEffect(() => {
    const tp = searchParams.get('type')?.toLowerCase();
    if (tp === 'receipt' || tp === 'payment receipt') {
      setDocumentType('Payment Receipt');
    } else if (tp === 'invoice' || tp === 'tax invoice') {
      setDocumentType('Tax Invoice');
    }
  }, [searchParams]);

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

  const handleCancelInvoice = async () => {
    if (!invoice?.id || invoice.status === 'Cancelled') return;
    const reason = window.prompt('Enter cancellation reason:');
    if (reason === null) return;
    await db.invoices.update(invoice.id, { status: 'Cancelled', notes: `${invoice.notes || ''}${invoice.notes ? '\n' : ''}Cancelled: ${reason.trim() || 'No reason recorded'}`, updatedAt: new Date() });
    navigate(`/invoices/${invoice.id}`);
  };

  const handleSavePdf = async () => {
    if (!invoice) return;

    // Desktop: use browser's native print engine for pixel-perfect PDF output
    // (identical to "Microsoft Print to PDF" / Ctrl+P)
    if (!isMobileDevice()) {
      savePdfNative();
      return;
    }

    // Mobile: fallback to html2canvas + jsPDF for direct download/share
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


  return (
    <div className="invoice-print-container">
      {/* Interactive Top Action Toolbar (Hidden in print) */}
      <div className="invoice-print-toolbar no-print">
        {/* Row 1 / Left: Navigation & Document Identification */}
        <div className="invoice-toolbar-nav">
          <button
            type="button"
            className="btn-back"
            onClick={() => navigate('/invoices')}
            title="Back to Invoices"
          >
            <Icon name="arrow-left" size={14} />
            <span>Back</span>
          </button>
          <span className="invoice-toolbar-slash">/</span>
          <span className="invoice-toolbar-doc-num">
            {invoice.invoiceNumber}
          </span>
          <span className={`invoices-status-pill ${invoice.status.toLowerCase()}`}>
            {invoice.status}
          </span>
        </div>

        {/* Row 2 / Center: Document Type Switcher Tabs */}
        <div className="invoice-toolbar-tabs-wrap">
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
        </div>

        {/* Row 3 / Right: Action Buttons Group */}
        <div className="invoice-toolbar-actions">
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

          {/* Save PDF (Primary direct action) */}
          <button
            type="button"
            className="btn btn-primary btn-sm invoice-btn-save"
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
            <span>Print</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/invoices')}
            title="View all invoices and receipts"
          >
            <Icon name="clock" size={14} />
            <span>History</span>
          </button>

          {invoice.status !== 'Cancelled' && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleCancelInvoice}
              title="Cancel this invoice"
            >
              <Icon name="trash" size={14} />
              <span>Cancel</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile swipe hint banner (visible only on small screens) */}
      <div className="invoice-mobile-hint no-print">
        <Icon name="info" size={14} />
        <span>A4 Print Preview • Swipe horizontally to inspect full document</span>
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
      <div className="invoice-sheet-container" id="invoice-sheet-container">
        {documentType === 'Payment Receipt' ? (
          <ReceiptDocument
            invoice={invoice}
            items={items}
            patient={patient}
            owner={owner}
            activePractitioner={activePractitioner}
            activeOrganisation={activeOrganisation}
            linkedRxNumbers={linkedRxNumbers}
            showSpecialInstructionsForOwner={showSpecialInstructionsForOwner}
            id="invoice-sheet"
          />
        ) : (
          <InvoiceDocument
            invoice={invoice}
            items={items}
            patient={patient}
            owner={owner}
            activePractitioner={activePractitioner}
            activeOrganisation={activeOrganisation}
            linkedRxNumbers={linkedRxNumbers}
            showHsnColumn={showHsnColumn}
            showSacColumn={showSacColumn}
            showSpecialInstructionsForOwner={showSpecialInstructionsForOwner}
            id="invoice-sheet"
          />
        )}
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
