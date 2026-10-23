// =============================================================
// VetRx — ExternalPrescriptionModal.tsx
// Authoritative External Medicine Prescription Viewer & Generator
// Renders the authentic full veterinary prescription format with
// the exact mandatory heading:
// "Prescription for medicines that are not available in hospital stock"
// =============================================================

import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { PrescriptionDocument } from '../../components/documents/PrescriptionDocument';
import { generatePdfBlob, savePdfWithFilePicker, savePdfNative, buildPrescriptionFilename } from '../../utils/pdfGenerator';
import { isMobileDevice } from '../../utils/platformDetect';
import type { Prescription, PrescriptionItem, Patient, Owner, Practitioner, Organisation } from '../../types';

export interface ExternalPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: Prescription;
  items: PrescriptionItem[];
  patient?: Patient | null;
  owner?: Owner | null;
  activePractitioner?: Practitioner | null;
  activeOrganisation?: Organisation | null;
}

export const ExternalPrescriptionModal: React.FC<ExternalPrescriptionModalProps> = ({
  isOpen,
  onClose,
  prescription,
  items,
  patient,
  owner,
  activePractitioner,
  activeOrganisation,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  // Filter to strictly external medicines
  const externalItems = items.filter((i) => i.isExternal);

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = async () => {
    if (!isMobileDevice()) {
      savePdfNative();
      return;
    }

    try {
      setIsGeneratingPdf(true);
      const sheet = document.getElementById('external-prescription-sheet');
      if (!sheet) return;
      const blob = await generatePdfBlob(sheet);
      const filename = buildPrescriptionFilename(`${prescription.rxNumber}-EXT`, patient?.name);
      await savePdfWithFilePicker(blob, filename);
    } catch (err) {
      console.error('Failed to export external prescription PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="inv-modal-overlay" style={{ zIndex: 10000, overflowY: 'auto', padding: '20px' }}>
      <div
        className="inv-modal-card"
        style={{
          maxWidth: '920px',
          width: '100%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 22px',
        }}
      >
        {/* Header Bar */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="prescription" size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                External Purchase Prescription
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Prescription for medicines that are not available in hospital stock
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: '36px', fontSize: '12.5px' }}
              onClick={handlePrint}
            >
              <Icon name="printer" size={16} />
              <span>Print</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: '36px', fontSize: '12.5px' }}
              onClick={handleSavePdf}
              disabled={isGeneratingPdf}
            >
              <Icon name="download" size={16} />
              <span>{isGeneratingPdf ? 'Saving…' : 'Save PDF'}</span>
            </button>
            <button
              type="button"
              className="inv-close-btn"
              onClick={onClose}
              style={{ marginLeft: '6px' }}
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* Informational Banner */}
        <div
          className="no-print"
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '12px',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Icon name="check-circle" size={16} color="#16a34a" />
          <span>
            This document contains strictly external medicines to be procured from an outside pharmacy. No hospital inventory stock has been or will be deducted.
          </span>
        </div>

        {/* Scrollable Stationery Preview */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <PrescriptionDocument
            id="external-prescription-sheet"
            prescription={prescription}
            items={externalItems}
            patient={patient}
            owner={owner}
            activePractitioner={activePractitioner}
            activeOrganisation={activeOrganisation}
            isExternalPrescription={true}
          />
        </div>
      </div>
    </div>
  );
};
