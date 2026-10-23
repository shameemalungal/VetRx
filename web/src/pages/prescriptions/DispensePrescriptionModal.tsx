// =============================================================
// VetRx — DispensePrescriptionModal.tsx
// Phase 2, 4, 5, 6: Prescription Dispensing & Clinic Administration Modal
// Supports batch-level FEFO tracking, fractional stock deduction,
// partial & full dispensing, and strict external medicine isolation.
// =============================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { inventoryApi, type InventoryItem, type InventoryBatch } from '../../services/inventoryApi';
import type { Prescription, PrescriptionItem, DispensePrescriptionResponse } from '../../types';
import { db } from '../../db/schema';

export interface DispensePrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (res: DispensePrescriptionResponse) => void;
  prescription: Prescription;
  items: PrescriptionItem[];
  dispenseType: 'DISPENSE' | 'ADMINISTRATION';
}

interface ItemDispenseState {
  prescriptionItemId: string;
  brandName: string;
  isExternal: boolean;
  prescribedQuantity: number;
  previouslyDispensed: number;
  remainingQuantity: number;
  dispenseQuantity: number;
  dispenseUnit: string;
  inventoryItemId: string | null;
  selectedBatchId: string | null;
  availableBatches: InventoryBatch[];
  isWastage: boolean;
  notes: string;
}

export const DispensePrescriptionModal: React.FC<DispensePrescriptionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  prescription,
  items,
  dispenseType,
}) => {
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [itemStates, setItemStates] = useState<ItemDispenseState[]>([]);
  const [idempotencyKey] = useState<string>(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())));
  const [generalNotes, setGeneralNotes] = useState('');

  // Fetch inventory items & batches
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadInventoryData() {
      setLoadingInventory(true);
      setErrorMsg(null);
      try {
        const { items: allInventoryItems } = await inventoryApi.getItems();
        const { batches: allBatches } = await inventoryApi.getBatches();

        if (!mounted) return;

        const initialStates: ItemDispenseState[] = items.map((pi) => {
          const isExt = Boolean(pi.isExternal);
          const prescribed = Number(pi.quantity) || 1;
          const previouslyDisp = Number(pi.dispensedQuantity) || 0;
          const remaining = Math.max(0, prescribed - previouslyDisp);

          // Find inventory item if not external
          let matchedItem: InventoryItem | undefined;
          if (!isExt) {
            matchedItem = allInventoryItems.find((inv) =>
              (pi.inventoryItemId && inv.id === pi.inventoryItemId) ||
              (pi.medicineId && String(inv.medicineId) === String(pi.medicineId)) ||
              inv.name.toLowerCase().trim() === pi.brandName.toLowerCase().trim()
            );
          }

          // Find available non-expired batches sorted by FEFO
          const todayStr = new Date().toISOString().split('T')[0];
          const itemBatches = matchedItem
            ? allBatches
                .filter((b) => b.itemId === matchedItem!.id && (b.currentQuantity ?? b.quantity) > 0 && b.expiryDate >= todayStr)
                .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
            : [];

          const defaultBatchId = itemBatches.length > 0 ? itemBatches[0].id : null;

          return {
            prescriptionItemId: String((pi as any).serverId || pi.id),
            brandName: pi.brandName,
            isExternal: isExt,
            prescribedQuantity: prescribed,
            previouslyDispensed: previouslyDisp,
            remainingQuantity: remaining,
            dispenseQuantity: remaining,
            dispenseUnit: pi.dispenseUnit || pi.unit || 'unit',
            inventoryItemId: matchedItem?.id || null,
            selectedBatchId: defaultBatchId,
            availableBatches: itemBatches,
            isWastage: false,
            notes: '',
          };
        });

        setItemStates(initialStates);
      } catch (err: any) {
        console.error('Failed to load inventory for dispensing:', err);
        setErrorMsg(err.message || 'Failed to load inventory stock.');
      } finally {
        if (mounted) setLoadingInventory(false);
      }
    }

    loadInventoryData();

    return () => {
      mounted = false;
    };
  }, [isOpen, items]);

  if (!isOpen) return null;

  const handleQuantityChange = (index: number, val: string) => {
    const num = parseFloat(val);
    setItemStates((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        dispenseQuantity: isNaN(num) ? 0 : num,
      };
      return updated;
    });
  };

  const handleBatchChange = (index: number, batchId: string) => {
    setItemStates((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        selectedBatchId: batchId,
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    const activeDispenseItems = itemStates.filter((s) => !s.isExternal && s.dispenseQuantity > 0);
    if (activeDispenseItems.length === 0 && itemStates.some((s) => !s.isExternal)) {
      setErrorMsg('Please specify a valid quantity greater than 0 to dispense for at least one inventory item.');
      return;
    }

    // Verify batch selection
    for (const item of activeDispenseItems) {
      if (!item.selectedBatchId && item.availableBatches.length > 0) {
        setErrorMsg(`Please select a batch for ${item.brandName}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        prescriptionId: String((prescription as any).serverId || prescription.id),
        dispenseType,
        idempotencyKey,
        notes: generalNotes.trim() || undefined,
        items: itemStates.map((s) => ({
          prescriptionItemId: s.prescriptionItemId,
          inventoryItemId: s.inventoryItemId,
          inventoryBatchId: s.selectedBatchId,
          dispenseQuantity: s.dispenseQuantity,
          dispenseUnit: s.dispenseUnit,
          isExternal: s.isExternal,
          notes: s.notes.trim() || undefined,
          isWastage: s.isWastage,
        })),
      };

      const res = await inventoryApi.dispensePrescription(payload);

      // Update local Dexie db
      if (prescription.id) {
        await db.prescriptions.update(prescription.id, {
          dispenseStatus: res.dispenseStatus,
          updatedAt: new Date(),
        });

        // Update items in Dexie
        const localItems = await db.prescriptionItems.where('prescriptionId').equals(prescription.id).toArray();
        for (const itm of localItems) {
          const rec = res.dispensedRecords.filter((d) => String(d.prescriptionItemId) === String((itm as any).serverId || itm.id));
          if (rec.length > 0) {
            const addedQty = rec.reduce((acc, r) => acc + (r.quantity || 0), 0);
            const newTotal = (itm.dispensedQuantity || 0) + addedQty;
            const itemDispStatus = newTotal >= itm.quantity ? 'FULLY_DISPENSED' : newTotal > 0 ? 'PARTIALLY_DISPENSED' : 'PENDING';
            await db.prescriptionItems.update(itm.id!, {
              dispensedQuantity: newTotal,
              dispenseStatus: itemDispStatus,
            });
          }
        }
      }

      onSuccess(res);
      onClose();
    } catch (err: any) {
      console.error('Dispensing transaction error:', err);
      setErrorMsg(err.message || 'Dispensing failed. Please verify stock availability and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdministration = dispenseType === 'ADMINISTRATION';
  const title = isAdministration ? 'Administered in Clinic' : 'Dispense Medicines';
  const subtitle = isAdministration
    ? 'Record medications administered directly to the animal in the clinic. Deducts stock only for actual administered quantities.'
    : 'Supply prescribed take-home medicines to the owner. Supports full and partial dispensing with batch-level tracking.';

  return (
    <div className="inv-modal-overlay">
      <div className="inv-modal-card" style={{ maxWidth: '850px', width: '95%' }}>
        <div className="inv-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: isAdministration ? '#e0e7ff' : '#dcfce7',
                color: isAdministration ? '#4338ca' : '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={isAdministration ? 'activity' : 'pill'} size={20} />
            </div>
            <div>
              <h2 className="inv-modal-title" style={{ fontSize: '17px', fontWeight: 700 }}>
                {title}
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{subtitle}</span>
            </div>
          </div>
          <button type="button" className="inv-close-btn" onClick={onClose} disabled={isSubmitting}>
            <Icon name="close" size={20} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icon name="warning" size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loadingInventory ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Verifying inventory balances and batches…</span>
            </div>
          ) : (
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              <table className="inventory-table" style={{ width: '100%', fontSize: '12.5px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', width: '28%' }}>Prescribed Medicine</th>
                    <th style={{ textAlign: 'center', width: '12%' }}>Prescribed</th>
                    <th style={{ textAlign: 'center', width: '12%' }}>Dispensed</th>
                    <th style={{ textAlign: 'left', width: '28%' }}>Batch (FEFO)</th>
                    <th style={{ textAlign: 'right', width: '20%' }}>Quantity to {isAdministration ? 'Administer' : 'Dispense'}</th>
                  </tr>
                </thead>
                <tbody>
                  {itemStates.map((state, idx) => {
                    const isFullyDispensed = state.remainingQuantity <= 0;

                    return (
                      <tr key={state.prescriptionItemId || idx} style={{ background: state.isExternal ? '#f8fafc' : undefined }}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{state.brandName}</div>
                          {state.isExternal ? (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: '#f1f5f9',
                                color: '#475569',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                marginTop: '2px',
                                border: '1px solid #cbd5e1',
                              }}
                            >
                              External / Not in Stock
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '10px',
                                fontWeight: 600,
                                color: state.availableBatches.length > 0 ? '#15803d' : '#b91c1c',
                                marginTop: '2px',
                              }}
                            >
                              {state.availableBatches.length > 0
                                ? `${state.availableBatches.length} batch(es) available`
                                : 'No stock in inventory'}
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: 'center', color: '#475569' }}>
                          {state.prescribedQuantity} {state.dispenseUnit}
                        </td>

                        <td style={{ textAlign: 'center', color: '#0284c7', fontWeight: 600 }}>
                          {state.previouslyDispensed} {state.dispenseUnit}
                        </td>

                        <td>
                          {state.isExternal ? (
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                              Excluded from inventory
                            </span>
                          ) : state.availableBatches.length === 0 ? (
                            <span style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 600 }}>
                              Out of stock
                            </span>
                          ) : (
                            <select
                              className="form-input"
                              style={{ height: '32px', fontSize: '11.5px', padding: '2px 6px' }}
                              value={state.selectedBatchId || ''}
                              onChange={(e) => handleBatchChange(idx, e.target.value)}
                              disabled={isSubmitting || isFullyDispensed}
                            >
                              {state.availableBatches.map((b, bIdx) => (
                                <option key={b.id} value={b.id}>
                                  {b.batchNumber} (Avail: {b.currentQuantity ?? b.quantity}) — Exp: {new Date(b.expiryDate).toLocaleDateString('en-GB')}{bIdx === 0 ? ' [FEFO]' : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          {state.isExternal ? (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>N/A (External)</span>
                          ) : isFullyDispensed ? (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                              ✓ Fully Supplied
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={state.remainingQuantity * 2}
                                className="form-input"
                                style={{ width: '80px', height: '32px', textAlign: 'right', fontWeight: 700 }}
                                value={state.dispenseQuantity}
                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                disabled={isSubmitting}
                              />
                              <span style={{ fontSize: '11px', color: '#64748b' }}>{state.dispenseUnit}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* General Notes */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>
              {isAdministration ? 'Administration Notes / Clinical Response' : 'Dispensing Notes / Special Instructions'}
            </label>
            <input
              type="text"
              className="form-input"
              style={{ height: '34px', fontSize: '12.5px' }}
              placeholder={isAdministration ? 'e.g. Administered IV slowly over 10 minutes. Animal tolerated well.' : 'e.g. Dispensed bottle with calibrated dosing syringe.'}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Idempotency: <code style={{ fontSize: '10px' }}>{idempotencyKey.slice(0, 12)}…</code>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  background: isAdministration ? '#4338ca' : '#15803d',
                  borderColor: isAdministration ? '#3730a3' : '#166534',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                disabled={isSubmitting || loadingInventory}
              >
                <Icon name={isAdministration ? 'activity' : 'check-circle'} size={16} />
                <span>{isSubmitting ? 'Recording…' : isAdministration ? 'Confirm Administration' : 'Confirm & Dispense Stock'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
