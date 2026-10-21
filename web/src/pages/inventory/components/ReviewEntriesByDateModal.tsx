// =============================================================
// VetRx — ReviewEntriesByDateModal.tsx
// Review and safely correct inventory entries for a chosen date.
// =============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../../../components/ui/Icon';
import {
  inventoryApi,
  type InventoryTransactionEntry,
  type DateCorrectionResult,
} from '../../../services/inventoryApi';

interface ReviewEntriesByDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewEntriesByDateModal: React.FC<ReviewEntriesByDateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [entries, setEntries] = useState<InventoryTransactionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DateCorrectionResult | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTxIds(new Set());
      setReason('');
      setError(null);
      setResult(null);
      return;
    }

    const loadEntries = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setSelectedTxIds(new Set());
        setResult(null);
        const res = await inventoryApi.getEntriesByDate(selectedDate);
        setEntries(res.entries || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve entries for selected date');
      } finally {
        setIsLoading(false);
      }
    };

    void loadEntries();
  }, [isOpen, selectedDate]);

  const eligibleEntries = useMemo(
    () => entries.filter((e) => e.canCompensate !== false),
    [entries]
  );

  const allEligibleSelected =
    eligibleEntries.length > 0 &&
    eligibleEntries.every((e) => selectedTxIds.has(e.id));

  const toggleSelectAll = () => {
    if (allEligibleSelected) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(eligibleEntries.map((e) => e.id)));
    }
  };

  const toggleSelectEntry = (id: string) => {
    const next = new Set(selectedTxIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedTxIds(next);
  };

  // Preview stock impact
  const selectedEntries = useMemo(
    () => entries.filter((e) => selectedTxIds.has(e.id)),
    [entries, selectedTxIds]
  );

  const previewNetImpact = useMemo(() => {
    // Reversal of an inflow (+Q) produces a negative adjustment (-Q)
    // Reversal of an outflow (-Q) produces a positive adjustment (+Q)
    return selectedEntries.reduce((sum, e) => sum - e.quantityChange, 0);
  }, [selectedEntries]);

  const handleApplyCorrections = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTxIds.size === 0) {
      setError('Please select at least one entry to correct');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for the ledger correction');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await inventoryApi.correctEntriesByDate({
        transactionIds: Array.from(selectedTxIds),
        reason: reason.trim(),
      });
      setResult(res);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to apply corrections');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{ maxWidth: '800px', width: '100%', borderRadius: '16px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="calendar" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Review &amp; Correct Entries by Date
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Safe compensating ledger adjustments with full audit history
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-icon" disabled={isSubmitting}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Icon name="alert-circle" size={16} />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Icon name="check" size={24} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', margin: '0 0 8px' }}>
                Ledger Corrections Applied Successfully
              </h3>
              <p style={{ color: '#475569', fontSize: '14px', maxWidth: '480px', margin: '0 auto 20px' }}>
                {result.message ||
                  `Compensated ${result.correctedCount} transaction(s) with net stock impact of ${result.totalUnitsAdjusted} units.`}
              </p>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Done &amp; Refresh Stock
              </button>
            </div>
          ) : (
            <>
              {/* Date Selector Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  marginBottom: '16px',
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label htmlFor="review-entry-date" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                    Select Date:
                  </label>
                  <input
                    id="review-entry-date"
                    type="date"
                    className="form-input"
                    style={{ width: '160px', padding: '6px 10px' }}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Found <strong>{entries.length}</strong> entry(ies) on {selectedDate}
                </div>
              </div>

              {/* Entries Table */}
              {isLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
                  <span>Loading ledger entries for {selectedDate}...</span>
                </div>
              ) : entries.length === 0 ? (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                  }}
                >
                  <Icon name="info" size={24} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    No inventory ledger entries recorded on <strong>{selectedDate}</strong>.
                  </p>
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', width: '36px' }}>
                          <input
                            type="checkbox"
                            checked={allEligibleSelected}
                            onChange={toggleSelectAll}
                            disabled={eligibleEntries.length === 0}
                            title="Select all eligible entries"
                          />
                        </th>
                        <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>TIME</th>
                        <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>ITEM / BATCH</th>
                        <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>TYPE</th>
                        <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>CHANGE</th>
                        <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>CURRENT BATCH</th>
                        <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const isEligible = entry.canCompensate !== false;
                        const isSelected = selectedTxIds.has(entry.id);
                        const timeStr = new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr
                            key={entry.id}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isSelected ? '#f0fdfa' : '#ffffff',
                              opacity: isEligible ? 1 : 0.6,
                            }}
                          >
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectEntry(entry.id)}
                                disabled={!isEligible}
                              />
                            </td>
                            <td style={{ padding: '8px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {timeStr}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{entry.itemName}</div>
                              <div style={{ color: '#64748b', fontSize: '11px' }}>
                                Batch: {entry.batchNumber || 'N/A'}
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  fontWeight: 600,
                                }}
                              >
                                {entry.transactionType}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: '8px 12px',
                                fontWeight: 700,
                                color: entry.quantityChange > 0 ? '#15803d' : '#b91c1c',
                              }}
                            >
                              {entry.quantityChange > 0 ? `+${entry.quantityChange}` : entry.quantityChange}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {entry.currentBatchStock ?? 'N/A'}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {isEligible ? (
                                <span style={{ color: '#15803d', fontSize: '11px', fontWeight: 600 }}>
                                  Eligible
                                </span>
                              ) : (
                                <span
                                  style={{ color: '#dc2626', fontSize: '11px' }}
                                  title={entry.blockReason || 'Stock already consumed'}
                                >
                                  {entry.blockReason || 'Blocked'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Stock Impact Preview & Reason Input */}
              {selectedTxIds.size > 0 && (
                <div
                  style={{
                    background: '#f0fdfa',
                    border: '1px solid #ccfbf1',
                    borderRadius: '8px',
                    padding: '14px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e' }}>
                      Stock Impact Preview:
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f766e' }}>
                      {selectedTxIds.size} entry(ies) selected • Net Adjustment:{' '}
                      <strong style={{ color: previewNetImpact >= 0 ? '#15803d' : '#b91c1c' }}>
                        {previewNetImpact > 0 ? `+${previewNetImpact}` : previewNetImpact} units
                      </strong>
                    </span>
                  </div>

                  <form onSubmit={handleApplyCorrections}>
                    <div style={{ marginBottom: '12px' }}>
                      <label
                        htmlFor="correct-entries-reason"
                        style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#134e4a', marginBottom: '4px' }}
                      >
                        Correction Reason (Audit Log) *
                      </label>
                      <input
                        id="correct-entries-reason"
                        type="text"
                        className="form-input"
                        placeholder="e.g., Reversing duplicated morning entries from paper manifest..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setSelectedTxIds(new Set())}
                      >
                        Clear Selection
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Applying Corrections...' : 'Confirm & Apply Corrections'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
