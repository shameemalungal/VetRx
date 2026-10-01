// =============================================================
// VetRx — ExternalPrescriptionModal.tsx
// Prescription 2: External Purchase Prescription
// Only externally required medicines & quantities appear here.
// =============================================================

import React from 'react';
import { Icon } from '../../components/ui/Icon';
import type { PrescriptionStockResolution } from '../../services/inventoryApi';

interface ExternalPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName?: string;
  patientSubtitle?: string;
  ownerName?: string;
  rxNumber?: string;
  resolutions: PrescriptionStockResolution[];
}

export const ExternalPrescriptionModal: React.FC<ExternalPrescriptionModalProps> = ({
  isOpen,
  onClose,
  patientName,
  patientSubtitle,
  ownerName,
  rxNumber,
  resolutions,
}) => {
  if (!isOpen) return null;

  const externalItems = resolutions.filter((r) => r.externalQuantity > 0);

  return (
    <div className="inv-modal-overlay">
      <div className="inv-modal-card">
        <div className="inv-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(2, 132, 199, 0.1)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="prescription" size={18} />
            </div>
            <div>
              <h2 className="inv-modal-title">External Purchase Prescription (Prescription 2)</h2>
              <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                Only medications requiring external purchase/pharmacy sourcing
              </span>
            </div>
          </div>
          <button type="button" className="inv-close-btn" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Patient header */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{patientName || 'Patient'}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {patientSubtitle} {ownerName ? `• Owner: ${ownerName}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#e0f2fe',
                color: '#0369a1',
                fontFamily: 'monospace',
              }}
            >
              Rx Ref: {rxNumber || 'NEW-RX'}-EXT
            </span>
          </div>
        </div>

        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            fontSize: '12px',
            color: '#92400e',
            lineHeight: 1.5,
          }}
        >
          <strong>Notice:</strong> This external purchase order excludes internally available clinical stock and
          contains strictly the remaining quantities to be procured by the owner from an external pharmacy.
        </div>

        {/* Items Table */}
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Medicine / Formulation</th>
                <th style={{ textAlign: 'center' }}>Total Prescribed</th>
                <th style={{ textAlign: 'center' }}>Available In Clinic</th>
                <th style={{ textAlign: 'center' }}>External Purchase Qty</th>
              </tr>
            </thead>
            <tbody>
              {externalItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{item.medicineName}</td>
                  <td style={{ textAlign: 'center', color: '#64748b' }}>{item.requiredQuantity}</td>
                  <td style={{ textAlign: 'center', color: '#15803d', fontWeight: 600 }}>
                    {item.internalStockQuantity}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '14px',
                        color: '#dc2626',
                        background: '#fee2e2',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {item.externalQuantity} units
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              window.print();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="print" size={16} />
            <span>Print External Prescription</span>
          </button>
        </div>
      </div>
    </div>
  );
};
