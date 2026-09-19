// =============================================================
// VetRx — InvoiceDocument.tsx
// Authoritative, Single-Source-of-Truth Tax Invoice Document Component
// Shared identically by:
//   1. Screen Preview
//   2. Browser Print (window.print() -> Microsoft Print to PDF)
//   3. Direct Client-Side PDF Generation (Save PDF)
// Matches Golden Reference: 234.pdf
// =============================================================

import React from 'react';
import { PractitionerHeader } from '../common/PractitionerHeader';
import { formatAnimalSubtitle, formatOwnerPrimary, isArtificialOrBlankName } from '../../utils/patientFormat';
import { formatInvoiceItemDescription } from '../../utils/documentFormat';
import { formatINR, numberToWordsINR } from '../../pages/invoices/invoiceUtils';
import type { Invoice, InvoiceItem, Patient, Owner, Practitioner, Organisation } from '../../types';
import './DocumentStyles.css';

export interface InvoiceDocumentProps {
  invoice: Invoice;
  items: InvoiceItem[];
  patient?: Patient | null;
  owner?: Owner | null;
  activePractitioner?: Practitioner | null;
  activeOrganisation?: Organisation | null;
  linkedRxNumbers?: string[];
  showHsnColumn?: boolean;
  showSacColumn?: boolean;
  showSpecialInstructionsForOwner?: boolean;
  id?: string;
}

export const InvoiceDocument: React.FC<InvoiceDocumentProps> = ({
  invoice,
  items,
  patient,
  owner,
  activePractitioner,
  activeOrganisation,
  linkedRxNumbers = [],
  showHsnColumn = false,
  showSacColumn = false,
  showSpecialInstructionsForOwner = true,
  id = 'invoice-sheet',
}) => {
  const grossSubtotalPaisa = items.reduce(
    (acc, it) => acc + (it.subtotalPaisa || it.quantity * it.unitPricePaisa),
    0
  );
  const itemDiscountsPaisa = items.reduce((acc, it) => acc + (it.discountAmtPaisa || 0), 0);
  const doctorDiscountPaisa = invoice.discountTotal || 0;
  const grandTotalPaisa = invoice.grandTotal || 0;

  const doctorName = activePractitioner?.name?.trim() || '';
  const doctorQual = activePractitioner?.qualifications?.trim() || '';
  const rawReg = activePractitioner?.registrationNumber?.trim() || '';
  const cleanReg = rawReg ? rawReg.replace(/^KSVC[- ]?/i, 'KSVC-') : '';

  const rawOrgName = activeOrganisation?.name?.trim();
  const hasClinic = Boolean(
    activeOrganisation &&
    activeOrganisation.isActive !== false &&
    rawOrgName &&
    rawOrgName.length > 0 &&
    rawOrgName.toLowerCase() !== 'independent practitioner'
  );

  const effectiveDesignation = hasClinic
    ? (activePractitioner?.designation?.trim() || (activeOrganisation as any)?.designation?.trim() || 'Veterinarian in Charge')
    : (activePractitioner?.designation?.trim() || 'Independent Veterinary Practitioner');

  return (
    <div className="vetrx-document invoice-sheet-canvas" id={id}>
      {/* Top Bar Ribbon */}
      <div className="invoice-official-ribbon avoid-break">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0 }}>
          <span className="invoice-official-badge-text">
            OFFICIAL REGISTERED CLINICAL VETERINARY DOCUMENT
          </span>
        </div>
        <div className="invoice-official-ref-box">
          <span style={{ color: 'var(--color-outline)', whiteSpace: 'nowrap' }}>
            Doc Ref: <strong>{invoice.invoiceNumber}</strong>
          </span>
          <span className="document-status-label">
            ORIGINAL FOR RECIPIENT
          </span>
        </div>
      </div>

      {/* Practitioner / Clinic Header & Document Meta */}
      <div className="invoice-print-header avoid-break">
        <div className="invoice-print-logo-col" style={{ flex: 1, minWidth: 0 }}>
          <PractitionerHeader
            practitioner={activePractitioner}
            organisation={activeOrganisation}
            showLogo={true}
          />
        </div>

        <div className="invoice-print-meta-col">
          <div className="invoice-print-badge">
            TAX INVOICE
          </div>
          <div style={{ fontSize: '13px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <span style={{ color: 'var(--color-outline)' }}>Invoice No:</span>
            <strong style={{ fontFamily: 'var(--font-data)' }}>{invoice.invoiceNumber}</strong>
          </div>
          <div style={{ fontSize: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <span style={{ color: 'var(--color-outline)' }}>Date of Issue:</span>
            <span style={{ fontFamily: 'var(--font-data)' }}>
              {new Date(invoice.invoiceDate).toLocaleDateString('en-GB', {
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
            STATUS: {(invoice.status || 'ISSUED').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Dossier Panel: Billed Client & Animal Signalment Profile Side-by-Side */}
      <div className="invoice-print-grid-dossier avoid-break">
        {/* Client Dossier */}
        <div className="invoice-print-dossier-box">
          <span className="invoice-dossier-label">
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

        {/* Animal Dossier: Weight displayed only once in Weight line */}
        <div className="invoice-print-dossier-box">
          <span className="invoice-dossier-label">
            Animal Signalment Profile
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
              {!isArtificialOrBlankName(patient?.name)
                ? patient?.name
                : (patient ? formatAnimalSubtitle(patient, { includeWeight: false }) : '')}
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

      {/* Itemized Charges Table (Dedicated Tax Invoice Table) */}
      <table className="invoice-print-table">
        <thead>
          <tr>
            <th className="col-sl">SL</th>
            <th className="col-desc">Item / Clinical Description</th>
            {(showHsnColumn || showSacColumn) && (
              <th className="col-hsn">
                {showHsnColumn && showSacColumn ? 'HSN / SAC' : showHsnColumn ? 'HSN Code' : 'SAC Code'}
              </th>
            )}
            <th className="col-qty">Qty &amp; Unit</th>
            <th className="col-rate">Rate (₹)</th>
            <th className="col-amount">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const lineSubtotal = Math.round(it.quantity * it.unitPricePaisa);
            const lineAmount = Math.max(0, lineSubtotal - (it.discountAmtPaisa || 0));
            const sl = String(idx + 1).padStart(2, '0');

            let code = 'SAC 9983';
            if (it.category === 'Medicine' || it.category === 'Prescription Medicine') code = 'HSN 3004';
            else if (it.category === 'Procedure Fee') code = 'SAC 9993';
            else if (it.category === 'Certificate' || it.category === 'Necropsy Report' || it.isGovPrescribed) code = 'SAC 9997';

            // Clean administration instructions from commercial invoice item description
            const cleanDescription = formatInvoiceItemDescription(it.description);

            return (
              <tr key={it.id || idx} className={`${it.isGovPrescribed ? 'gov-row' : ''} avoid-break`}>
                <td className="col-sl">{sl}</td>
                <td className="col-desc">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ color: 'var(--color-on-surface)' }}>{cleanDescription}</strong>
                    <span className="invoice-category-chip">
                      ({it.category})
                    </span>
                  </div>
                  {it.isGovPrescribed && (
                    <span className="invoice-print-go-subnote">
                      {it.govOrderNote ||
                        `As per the rate fixed by ${it.govOrderNumber || 'G.O.(Rt) No.589/2023/AHD'} dated ${it.govOrderDate || '13-12-2023'}`}
                    </span>
                  )}
                </td>
                {(showHsnColumn || showSacColumn) && (
                  <td className="col-hsn">{code}</td>
                )}
                <td className="col-qty">
                  {it.quantity} {it.unit || 'units'}
                </td>
                <td className="col-rate">
                  {((it.unitPricePaisa || 0) / 100).toFixed(2)}
                </td>
                <td className="col-amount">
                  {((lineAmount || 0) / 100).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Unified Ledger & Signatory Block */}
      <div className="invoice-print-ledger-and-signoff avoid-break signature-block">
        <div className="invoice-print-ledger-grid avoid-break">
          {/* Left Side: Amount in Words & Notes */}
          <div className="invoice-print-words-box">
            <div>
              <span className="invoice-words-label">
                Invoice Total in Words
              </span>
              <div className="invoice-words-value">
                {numberToWordsINR(grandTotalPaisa)}
              </div>
            </div>

            {/* Statutory Exemption Box */}
            <div className="invoice-print-statutory-gst">
              <strong>Statutory Exemption Notice:</strong> Healthcare services and diagnostic examinations provided by registered clinical veterinary professionals are fully exempt from Goods and Services Tax (GST) as per{' '}
              <strong>Notification No. 12/2017-Central Tax (Rate)</strong>.
            </div>

            {showSpecialInstructionsForOwner && invoice.notes && (
              <div style={{ fontSize: '10.5px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                <strong>Special Instructions / Remarks:</strong> {invoice.notes}
              </div>
            )}
          </div>

          {/* Right Side: Ledger Totals */}
          <div className="invoice-print-totals-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>Gross Subtotal:</span>
              <span style={{ fontFamily: 'var(--font-data)', fontWeight: 600 }}>
                {formatINR(grossSubtotalPaisa)}
              </span>
            </div>

            {itemDiscountsPaisa > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Item Discounts:</span>
                <span style={{ fontFamily: 'var(--font-data)', color: 'var(--color-tertiary)' }}>
                  -{formatINR(itemDiscountsPaisa)}
                </span>
              </div>
            )}

            {doctorDiscountPaisa > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Doctor / Courtesy Discount:</span>
                <span style={{ fontFamily: 'var(--font-data)', color: 'var(--color-tertiary)' }}>
                  -{formatINR(doctorDiscountPaisa)}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-on-surface-variant)' }}>GST (0.0% Exempt):</span>
              <span style={{ fontFamily: 'var(--font-data)' }}>₹0.00</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                borderTop: '1.5px solid var(--color-border)',
                paddingTop: '6px',
                marginTop: '4px',
              }}
            >
              <strong style={{ fontSize: '14px', color: 'var(--color-on-surface)' }}>Grand Total:</strong>
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--color-primary)' }}>
                {formatINR(grandTotalPaisa)}
              </strong>
            </div>
          </div>
        </div>

        {/* Indivisible Signature Block */}
        <div className="invoice-print-signature-section avoid-break">
          <div style={{ minWidth: '220px', display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
            {activePractitioner?.signatureDataUrl ? (
              <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'flex-end' }}>
                <img
                  src={activePractitioner.signatureDataUrl}
                  alt="Doctor Signature"
                  style={{ maxHeight: '38px', maxWidth: '140px', objectFit: 'contain' }}
                />
              </div>
            ) : (
              <div style={{ width: '150px', borderBottom: '1px solid #94a3b8', marginBottom: '8px', marginLeft: 'auto' }} />
            )}
            <strong style={{ fontSize: '13px', color: 'var(--color-on-surface)', display: 'block' }}>
              {doctorName}{doctorQual ? `, ${doctorQual}` : ''}
            </strong>
            {cleanReg && (
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: 'var(--color-primary)', display: 'block' }}>
                Reg. No.: {cleanReg}
              </span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', display: 'block' }}>
              {effectiveDesignation}
            </span>
          </div>
        </div>
      </div>

      {/* Official Footnote */}
      <div className="invoice-print-footer-wrap avoid-break">
        <span>Computer-generated official tax invoice • Valid without physical seal.</span>
        <span>Generated: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST</span>
      </div>
    </div>
  );
};
