// =============================================================
// VetRx — ReceiptDocument.tsx
// Authoritative, Single-Source-of-Truth Payment Receipt Document Component
// Shared identically by:
//   1. Screen Preview
//   2. Browser Print (window.print() -> Microsoft Print to PDF)
//   3. Direct Client-Side PDF Generation (Save PDF)
// Matches Golden Reference: 2341.pdf
// =============================================================

import React from 'react';
import { PractitionerHeader } from '../common/PractitionerHeader';
import { formatAnimalSubtitle, formatOwnerPrimary, isArtificialOrBlankName } from '../../utils/patientFormat';
import { formatInvoiceItemDescription } from '../../utils/documentFormat';
import { formatINR, numberToWordsINR } from '../../pages/invoices/invoiceUtils';
import type { Invoice, InvoiceItem, Patient, Owner, Practitioner, Organisation } from '../../types';
import './DocumentStyles.css';

export interface ReceiptDocumentProps {
  invoice: Invoice;
  items: InvoiceItem[];
  patient?: Patient | null;
  owner?: Owner | null;
  activePractitioner?: Practitioner | null;
  activeOrganisation?: Organisation | null;
  linkedRxNumbers?: string[];
  showSpecialInstructionsForOwner?: boolean;
  id?: string;
}

export const ReceiptDocument: React.FC<ReceiptDocumentProps> = ({
  invoice,
  items,
  patient,
  owner,
  activePractitioner,
  activeOrganisation,
  linkedRxNumbers = [],
  showSpecialInstructionsForOwner = true,
  id = 'invoice-sheet',
}) => {
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
            OFFICIAL RECEIPT
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
            PAYMENT RECEIPT
          </div>
          <div style={{ fontSize: '13px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <span style={{ color: 'var(--color-outline)' }}>Receipt No:</span>
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
            STATUS: {((invoice as any).paymentStatus || invoice.status || 'ISSUED').toUpperCase()}
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

        {/* Animal Dossier: Weight displayed only once in dedicated Weight line */}
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

      {/* Dedicated Payment Receipt Table (No HSN/SAC or Rate noise) */}
      <table className="receipt-print-table">
        <thead>
          <tr>
            <th className="col-sl">SL</th>
            <th className="col-desc">Item / Clinical Description</th>
            <th className="col-amount">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const lineSubtotal = Math.round(it.quantity * it.unitPricePaisa);
            const lineAmount = Math.max(0, lineSubtotal - (it.discountAmtPaisa || 0));
            const sl = String(idx + 1).padStart(2, '0');

            // Clean administration instructions from commercial receipt item description
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
        <div className="receipt-print-summary-grid avoid-break">
          {/* Left Side: Payment Info & Notes */}
          <div className="receipt-payment-info-box">
            <span className="receipt-payment-label">
              Payment Information
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Payment Mode:</span>
                <strong style={{ color: 'var(--color-on-surface)' }}>{(invoice as any).paymentMethod || 'Not recorded'}</strong>
              </div>
              {(invoice as any).paymentReference && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>Reference No:</span>
                  <span style={{ fontFamily: 'var(--font-data)' }}>{(invoice as any).paymentReference}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Payment Status:</span>
                <strong style={{ color: '#0f766e' }}>
                  {((invoice as any).paymentStatus || invoice.status || 'ISSUED').toUpperCase()}
                </strong>
              </div>
            </div>

            {/* Amount in words */}
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)' }}>
                Amount in Words:
              </span>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-primary)', marginTop: '1px' }}>
                {numberToWordsINR(grandTotalPaisa)}
              </div>
            </div>

            {showSpecialInstructionsForOwner && invoice.notes && (
              <div style={{ fontSize: '10.5px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                <strong>Remarks:</strong> {invoice.notes}
              </div>
            )}
          </div>

          {/* Right Side: Prominent Amount Received Card */}
          <div className="receipt-amount-card">
            <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)', letterSpacing: '0.04em', marginBottom: '2px' }}>
              Total Amount Received
            </span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 800, color: 'var(--color-primary)' }}>
              {formatINR(grandTotalPaisa)}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--color-outline)', marginTop: '2px' }}>
              Official acknowledgement of payment
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
        <span>Computer-generated official payment receipt • Valid without physical seal.</span>
        <span>Generated: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST</span>
      </div>
    </div>
  );
};
