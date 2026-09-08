// =============================================================
// VetRx — InvoiceDetailsPage (Print-Ready Tax Invoice & Receipt)
// Phase 6: Full Statutory G.O. Line Notes & Printable Canvas
// =============================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Icon } from '../../components/ui/Icon';
import { useSettingsStore } from '../../store/settingsStore';
import { formatINR, numberToWordsINR } from './invoiceUtils';
import './Invoices.css';

export const InvoiceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldAutoPrint = searchParams.get('print') === 'true';

  const [documentType, setDocumentType] = useState<'Tax Invoice' | 'Payment Receipt'>('Tax Invoice');

  // Load identity from Settings (Single source of truth)
  const { practitioner: storePractitioner, organisation: storeOrganisation } = useSettingsStore();

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
  const doctorReg = rawReg
    ? (rawReg.startsWith('Reg') ? rawReg : `Reg: ${rawReg}`)
    : '';
  const doctorAddress = activePractitioner?.address?.trim() || '';
  const doctorPhone = activePractitioner?.phone?.trim() || '';
  const doctorEmail = activePractitioner?.email?.trim() || '';

  const rawOrgName = activeOrganisation?.name?.trim();
  const hasClinic = Boolean(
    activeOrganisation &&
    activeOrganisation.isActive !== false &&
    rawOrgName &&
    rawOrgName.length > 0 &&
    rawOrgName.toLowerCase() !== 'independent practitioner'
  );

  const clinicName = hasClinic ? rawOrgName! : '';
  const formattedClinicAddress = hasClinic
    ? [
        activeOrganisation?.address?.trim(),
        activeOrganisation?.city?.trim(),
        activeOrganisation?.state?.trim() && activeOrganisation?.pincode?.trim()
          ? `${activeOrganisation.state.trim()} - ${activeOrganisation.pincode.trim()}`
          : (activeOrganisation?.state?.trim() || activeOrganisation?.pincode?.trim()),
      ].filter(Boolean).join(', ')
    : '';
  const clinicAddress = formattedClinicAddress || doctorAddress;
  const clinicPhone = (hasClinic && activeOrganisation?.phone?.trim())
    ? activeOrganisation.phone.trim()
    : doctorPhone;
  const clinicEmail = (hasClinic && activeOrganisation?.email?.trim())
    ? activeOrganisation.email.trim()
    : doctorEmail;
  const clinicGstin = (hasClinic && activeOrganisation?.registrationNumber?.trim())
    ? activeOrganisation.registrationNumber.trim()
    : '';

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
            Back to Invoices
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
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/invoices')}
          >
            <Icon name="chevron-left" size={16} />
            <span>Invoices</span>
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

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
          >
            <Icon name="edit" size={15} />
            <span>Edit</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => window.print()}
            id="btn-print-document"
          >
            <Icon name="print" size={16} />
            <span>Print {documentType}</span>
          </button>
        </div>
      </div>

      {/* A4 Printed Sheet Canvas (794px Standard Ratio) */}
      <div className="invoice-a4-sheet" id="invoice-sheet">
        <div>
          {/* Top Decorative Clinic Ribbon & Micro Watermark Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '10px',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '14px',
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
              <span
                style={{
                  background: 'var(--color-surface-container-high)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  whiteSpace: 'nowrap',
                }}
              >
                Original for Recipient
              </span>
            </div>
          </div>

          {/* Section 1: Clinic Header & Tax Invoice Block */}
          <div className="invoice-print-header">
            {/* Clinic / Practice Credentials (Left) */}
            <div className="invoice-print-logo-col">
              <div className="invoice-print-logo-box" style={{ overflow: 'hidden' }}>
                {hasClinic && activeOrganisation?.logoDataUrl ? (
                  <img
                    src={activeOrganisation.logoDataUrl}
                    alt="Clinic Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : activePractitioner?.photoDataUrl ? (
                  <img
                    src={activePractitioner.photoDataUrl}
                    alt={doctorName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Icon name="pets" size={26} />
                )}
              </div>
              <div>
                {hasClinic ? (
                  <>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, margin: '0 0 2px 0', letterSpacing: '-0.02em', color: 'var(--color-on-surface)' }}>
                      {clinicName}
                    </h1>
                    {doctorName && (
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block' }}>
                        {doctorName}{doctorQual ? ` · ${doctorQual}` : ''}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 800, margin: '0 0 2px 0', letterSpacing: '-0.02em', color: 'var(--color-on-surface)' }}>
                      {doctorName || 'Veterinary Clinical Practice'}
                    </h1>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block' }}>
                      {doctorQual ? doctorQual : 'Veterinary Medical Practice'}
                    </span>
                  </>
                )}

                {/* Address */}
                {(clinicAddress || doctorAddress) && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                    {clinicAddress || doctorAddress}
                  </p>
                )}

                {/* Phone & Email */}
                {(clinicPhone || clinicEmail) && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                    {clinicPhone && (
                      <>
                        Phone: <strong>{clinicPhone}</strong>
                      </>
                    )}
                    {clinicPhone && clinicEmail && ' • '}
                    {clinicEmail && (
                      <>
                        Email: <strong>{clinicEmail}</strong>
                      </>
                    )}
                  </p>
                )}

                {/* Professional Reg & GSTIN */}
                <div style={{ marginTop: '6px', fontSize: '11px', fontFamily: 'var(--font-data)', color: 'var(--color-outline)' }}>
                  {hasClinic && doctorName && (
                    <span>Veterinarian: <strong>{doctorName}{doctorQual ? `, ${doctorQual}` : ''}</strong></span>
                  )}
                  {hasClinic && doctorName && doctorReg && (
                    <span style={{ margin: '0 6px' }}>•</span>
                  )}
                  {doctorReg && (
                    <span><strong>{doctorReg}</strong></span>
                  )}
                  {clinicGstin && (
                    <>
                      <span style={{ margin: '0 6px' }}>•</span>
                      <span>GSTIN: <strong>{clinicGstin}</strong></span>
                    </>
                  )}
                </div>
              </div>
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
              {prescription && (
                <div style={{ fontSize: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <span style={{ color: 'var(--color-outline)' }}>Prescription Ref:</span>
                  <strong style={{ fontFamily: 'var(--font-data)', color: 'var(--color-primary)' }}>
                    {prescription.rxNumber}
                  </strong>
                </div>
              )}
              <div style={{ fontSize: '11px', color: 'var(--color-tertiary)', fontWeight: 700, marginTop: '2px' }}>
                STATUS: {invoice.status.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Section 2: Patient & Client Signalment Panel */}
          <div className="invoice-print-grid-dossier">
            {/* Client Dossier */}
            <div className="invoice-print-dossier-box">
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)', letterSpacing: '0.04em' }}>
                Billed Client (Pet Guardian)
              </span>
              <strong style={{ fontSize: '15px', color: 'var(--color-on-surface)' }}>
                {owner?.name || 'Walk-in Client'}
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
                Patient (Signalment Profile)
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '15px', color: 'var(--color-on-surface)' }}>
                  {patient?.name || 'Registered Animal'}
                </strong>
                <span style={{ fontSize: '11px', fontWeight: 600, background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                  {patient?.species || 'Species'} · {patient?.breed || 'Breed'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
                {patient?.sex && <span>Sex: <strong>{patient.sex}</strong></span>}
                {patient?.sex && <span>•</span>}
                <span>
                  Weight: <strong>{patient?.weightKg ? `${patient.weightKg.toFixed(1)} kg` : 'Weight N/A'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Itemized Charges Clinical Table */}
          <table className="invoice-print-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>SL</th>
                <th>Item / Clinical Description</th>
                <th style={{ width: '100px', textAlign: 'center' }}>HSN / SAC</th>
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
                if (it.category === 'Medicine') code = 'HSN 3004';
                else if (it.category === 'Procedure Fee') code = 'SAC 9993';
                else if (it.isGovPrescribed) code = 'SAC 9997';

                return (
                  <tr key={it.id || idx} className={it.isGovPrescribed ? 'gov-row' : ''}>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-data)', color: 'var(--color-outline)' }}>
                      {sl}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ color: 'var(--color-on-surface)' }}>{it.description}</strong>
                        <span style={{ fontSize: '10px', fontWeight: 600, background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#475569' }}>
                          {it.category}
                        </span>
                      </div>

                      {/* STATUTORY GOVERNMENT ORDER NOTE DIRECTLY BELOW THIS SPECIFIC ITEM */}
                      {it.isGovPrescribed && (
                        <span className="invoice-print-go-subnote">
                          {it.govOrderNote ||
                            `As per the rate fixed by ${it.govOrderNumber || 'G.O.(Rt) No.589/2023/AHD'} dated ${it.govOrderDate || '13-12-2023'}.`}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-data)', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                      {code}
                    </td>
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

          {/* Section 4: Dual Ledger Partition */}
          <div className="invoice-print-ledger-grid">
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

              {invoice.notes && (
                <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                  <strong>Client Remarks:</strong> {invoice.notes}
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
        </div>

        {/* Section 5: Legal Footer & Veterinarian Digital Signatory Stamp */}
        <div>
          <div className="invoice-print-signature-section">
            {/* Concentric Veterinary Clinic Stamp */}
            <div className="invoice-print-stamp-box">
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  border: '2px dashed var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                  fontSize: '8px',
                  fontWeight: 800,
                  textAlign: 'center',
                  lineHeight: '1.2',
                  letterSpacing: '0.04em',
                  flexShrink: 0,
                }}
              >
                {hasClinic && clinicName ? clinicName.slice(0, 8).toUpperCase() : 'PRACTICE'}
                <br />
                AUTHENTIC
                <br />
                VETRX
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)', display: 'block' }}>
                  Clinically Authenticated
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                  VetRx Clinical Cryptographic Hash
                </span>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: 'var(--color-outline)', display: 'block' }}>
                  SHA256: 8f49a022b...e9401b2a9
                </span>
              </div>
            </div>

            {/* Signature Block */}
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                {activePractitioner?.signatureDataUrl ? (
                  <img
                    src={activePractitioner.signatureDataUrl}
                    alt="Veterinarian Signature"
                    style={{ maxHeight: '32px', maxWidth: '140px', objectFit: 'contain' }}
                  />
                ) : (
                  <svg width="140" height="30" viewBox="0 0 160 40" fill="none">
                    <path
                      d="M10 28C24 10 38 8 46 22C54 36 62 14 74 18C86 22 94 34 108 26C122 18 134 16 150 20"
                      stroke="#131b2e"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M42 34C60 30 110 32 135 28" stroke="#131b2e" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <strong style={{ fontSize: '13px', color: 'var(--color-on-surface)', display: 'block' }}>
                {doctorName}{doctorQual ? `, ${doctorQual}` : ''}
              </strong>
              <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                Authorized Clinical Signatory{doctorReg ? ` • ${doctorReg}` : ''}
              </span>
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
  );
};
