// =============================================================
// VetRx — ShareModal.tsx
// Desktop and browser-fallback document sharing dialog.
// =============================================================

import React, { useState } from 'react';
import { Icon } from './Icon';
import { savePdfWithFilePicker } from '../../utils/pdfGenerator';

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentNumber: string;
  recipientName?: string;
  patientName?: string;
  ownerName?: string;
  totalDisplay?: string;
  grandTotalPaisa?: number;
  pdfBlob?: Blob | null;
  suggestedFilename?: string;
  filename?: string;
  documentUrl: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  documentNumber,
  recipientName,
  patientName,
  ownerName,
  totalDisplay,
  grandTotalPaisa,
  pdfBlob,
  suggestedFilename,
  filename,
  documentUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const actualRecipient = recipientName || (patientName ? `${patientName}${ownerName ? ` (${ownerName})` : ''}` : ownerName);
  const actualFilename = suggestedFilename || filename || `${documentTitle}_${documentNumber}.pdf`;
  const actualTotal = totalDisplay || (grandTotalPaisa !== undefined ? `₹${(grandTotalPaisa / 100).toFixed(2)}` : undefined);

  const shareText = `VetRx ${documentTitle} ${documentNumber}${
    actualRecipient ? ` for ${actualRecipient}` : ''
  }${actualTotal ? ` • Amount: ${actualTotal}` : ''}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(documentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback prompt if clipboard fails
      prompt('Copy link to document:', documentUrl);
    }
  };

  const handleDownloadPdf = async () => {
    if (!pdfBlob) return;
    setIsDownloading(true);
    try {
      await savePdfWithFilePicker(pdfBlob, actualFilename);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`${shareText}\n${documentUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`VetRx Document: ${documentNumber}`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease find your ${documentTitle.toLowerCase()} details below:\n\nDocument: ${documentNumber}\nRecipient: ${
        recipientName || 'Client'
      }\n${totalDisplay ? `Total: ${totalDisplay}\n` : ''}\nDocument Link: ${documentUrl}\n\nThank you,\nVetRx Veterinary Practice`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div
      className="rx-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="rx-modal-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-xl, 16px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--color-border, #e2e8f0)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-container-low, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--color-primary-container, #d1fae5)',
                color: 'var(--color-primary, #00685f)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="share" size={16} />
            </div>
            <div>
              <h3
                id="share-modal-title"
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontFamily: 'var(--font-heading, sans-serif)',
                  fontWeight: 700,
                  color: 'var(--color-on-surface, #1e293b)',
                }}
              >
                Share Document
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--color-outline, #64748b)' }}>
                {documentNumber} {recipientName ? `• ${recipientName}` : ''}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close share dialog"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-outline, #64748b)',
              padding: '6px',
            }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Document Summary Pill */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'var(--color-surface-container, #f1f5f9)',
              border: '1px solid var(--color-border, #e2e8f0)',
              fontSize: '12px',
              lineHeight: 1.5,
              color: 'var(--color-on-surface-variant, #334155)',
            }}
          >
            <strong>{documentTitle}:</strong> {documentNumber}
            {recipientName && (
              <div>
                <strong>Recipient:</strong> {recipientName}
              </div>
            )}
            {totalDisplay && (
              <div>
                <strong>Total:</strong> {totalDisplay}
              </div>
            )}
          </div>

          {/* Action List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Direct PDF Download */}
            {pdfBlob && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  width: '100%',
                  height: 'auto',
                  minHeight: '52px',
                  whiteSpace: 'normal',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <Icon name="download" size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3, color: 'var(--color-on-surface, #1e293b)' }}>
                    {isDownloading ? 'Saving PDF...' : 'Download PDF File'}
                  </span>
                  <span style={{ fontSize: '11px', lineHeight: 1.35, color: 'var(--color-outline, #64748b)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    Save directly to your device with Save As prompt
                  </span>
                </div>
              </button>
            )}

            {/* WhatsApp */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleWhatsApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                textAlign: 'left',
                width: '100%',
                height: 'auto',
                minHeight: '52px',
                whiteSpace: 'normal',
                boxSizing: 'border-box',
                borderColor: '#25D366',
                color: '#128C7E',
              }}
            >
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <Icon name="message-square" size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3 }}>Share via WhatsApp</span>
                <span style={{ fontSize: '11px', lineHeight: 1.35, color: 'var(--color-outline, #64748b)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  Send document message to client's WhatsApp
                </span>
              </div>
            </button>

            {/* Email */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEmail}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                textAlign: 'left',
                width: '100%',
                height: 'auto',
                minHeight: '52px',
                whiteSpace: 'normal',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <Icon name="mail" size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3, color: 'var(--color-on-surface, #1e293b)' }}>Share via Email</span>
                <span style={{ fontSize: '11px', lineHeight: 1.35, color: 'var(--color-outline, #64748b)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  Compose email with formatted document reference
                </span>
              </div>
            </button>

            {/* Copy Link */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyLink}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                textAlign: 'left',
                width: '100%',
                height: 'auto',
                minHeight: '52px',
                whiteSpace: 'normal',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <Icon name={copied ? 'check' : 'copy'} size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3, color: 'var(--color-on-surface, #1e293b)' }}>
                  {copied ? 'Link Copied to Clipboard!' : 'Copy Document Link'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    lineHeight: 1.35,
                    color: 'var(--color-outline, #64748b)',
                    wordBreak: 'break-all',
                    whiteSpace: 'normal',
                  }}
                >
                  {documentUrl}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--color-surface-container-lowest, #ffffff)',
          }}
        >
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
