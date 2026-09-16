// =============================================================
// VetRx — ImportPrescriptionsModal.tsx
// Multi-Prescription / Multi-Patient Medicine Importer
// =============================================================

import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { PrescriptionItem, Patient, Owner } from '../../types';
import { Icon } from '../../components/ui/Icon';
import { formatAnimalSubtitle, formatOwnerPrimary, isArtificialOrBlankName } from '../../utils/patientFormat';
import './Invoices.css';

export interface SelectedMedicineImport {
  prescriptionId: number;
  prescriptionNumber: string;
  prescriptionDate: Date | string;
  prescriptionItemId?: number;
  patientId: number;
  patientName: string;
  patientSubtitle?: string;
  ownerId: number;
  ownerName: string;
  medicineId?: number;
  brandName: string;
  strengthVolume?: string;
  description: string;
  quantity: number;
  unit: string;
  directions?: string;
}

export interface ImportPrescriptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPatientId?: number | string;
  selectedOwnerId?: number | string;
  existingItemsSummary?: Array<{ prescriptionId?: number; description: string }>;
  onImportMedicines: (items: SelectedMedicineImport[]) => void;
}

export const ImportPrescriptionsModal: React.FC<ImportPrescriptionsModalProps> = ({
  isOpen,
  onClose,
  selectedPatientId,
  selectedOwnerId,
  existingItemsSummary = [],
  onImportMedicines,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'current' | 'all'>(
    selectedPatientId || selectedOwnerId ? 'current' : 'all'
  );
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Safe Database Queries with try/catch and fallback
  const allPrescriptions = useLiveQuery(
    async () => {
      try {
        setQueryError(null);
        const list = await db.prescriptions.toArray();
        return list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
      } catch (err: any) {
        console.error('Failed to fetch prescriptions:', err);
        setQueryError(err?.message || 'Unable to load prescriptions. Please try again.');
        return [];
      }
    },
    [reloadTrigger]
  );

  const allItems = useLiveQuery(
    async () => {
      try {
        return await db.prescriptionItems.toArray();
      } catch (err) {
        console.error('Failed to fetch prescription items:', err);
        return [];
      }
    },
    [reloadTrigger]
  );

  const allPatients = useLiveQuery(
    async () => {
      try {
        return await db.patients.toArray();
      } catch (err) {
        console.error('Failed to fetch patients:', err);
        return [];
      }
    },
    [reloadTrigger]
  );

  const allOwners = useLiveQuery(
    async () => {
      try {
        return await db.owners.toArray();
      } catch (err) {
        console.error('Failed to fetch owners:', err);
        return [];
      }
    },
    [reloadTrigger]
  );

  const isLoading =
    allPrescriptions === undefined ||
    allItems === undefined ||
    allPatients === undefined ||
    allOwners === undefined;

  // Lookup Mappings
  const patientsMap = useMemo(() => {
    return new Map<number, Patient>((allPatients || []).map((p) => [p.id!, p]));
  }, [allPatients]);

  const ownersMap = useMemo(() => {
    return new Map<number, Owner>((allOwners || []).map((o) => [o.id!, o]));
  }, [allOwners]);

  const itemsByRxId = useMemo(() => {
    const map = new Map<number, PrescriptionItem[]>();
    for (const it of allItems || []) {
      const list = map.get(it.prescriptionId) || [];
      list.push(it);
      map.set(it.prescriptionId, list);
    }
    return map;
  }, [allItems]);

  // Filtered Prescriptions based on scope and search
  const filteredPrescriptions = useMemo(() => {
    if (!allPrescriptions) return [];

    const q = searchQuery.trim().toLowerCase();
    const currPatientNum = selectedPatientId ? Number(selectedPatientId) : undefined;
    const currOwnerNum = selectedOwnerId ? Number(selectedOwnerId) : undefined;

    return allPrescriptions.filter((rx) => {
      // 1. Scope filter
      if (scope === 'current') {
        const matchesPatient = currPatientNum ? rx.patientId === currPatientNum : false;
        const matchesOwner = currOwnerNum ? rx.ownerId === currOwnerNum : false;
        if (!matchesPatient && !matchesOwner) {
          return false;
        }
      }

      // 2. Search query filter
      if (!q) return true;

      const patient = patientsMap.get(rx.patientId);
      const owner = ownersMap.get(rx.ownerId);
      const rxItems = itemsByRxId.get(rx.id!) || [];

      const matchRxNum = rx.rxNumber?.toLowerCase().includes(q);
      const matchOwnerName = owner?.name?.toLowerCase().includes(q);
      const matchOwnerPhone = owner?.phone?.toLowerCase().includes(q);
      const matchPatientName = patient?.name?.toLowerCase().includes(q);
      const matchPatientBreed = patient?.breed?.toLowerCase().includes(q);
      const matchPatientSpecies = patient?.species?.toLowerCase().includes(q);
      const matchPatientTag =
        patient?.identificationRef?.toLowerCase().includes(q) ||
        patient?.microchipNumber?.toLowerCase().includes(q);
      const matchMedicine = rxItems.some(
        (it) =>
          it.brandName?.toLowerCase().includes(q) ||
          it.genericName?.toLowerCase().includes(q)
      );

      return (
        matchRxNum ||
        matchOwnerName ||
        matchOwnerPhone ||
        matchPatientName ||
        matchPatientBreed ||
        matchPatientSpecies ||
        matchPatientTag ||
        matchMedicine
      );
    });
  }, [allPrescriptions, scope, searchQuery, selectedPatientId, selectedOwnerId, patientsMap, ownersMap, itemsByRxId]);

  if (!isOpen) return null;

  const toggleItemSelection = (key: string) => {
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isAlreadyInInvoice = (rxId: number, brandName: string) => {
    const bNorm = brandName.trim().toLowerCase();
    return existingItemsSummary.some(
      (it) => it.prescriptionId === rxId && it.description.toLowerCase().includes(bNorm)
    );
  };

  const handleApplySelection = () => {
    if (!allPrescriptions) return;

    const selectedImports: SelectedMedicineImport[] = [];

    for (const key of selectedItemKeys) {
      const [rxIdStr, itemIdStr] = key.split('_');
      const rxId = Number(rxIdStr);
      const itemId = Number(itemIdStr);

      const rx = allPrescriptions.find((r) => r.id === rxId);
      const itm = (itemsByRxId.get(rxId) || []).find((i) => i.id === itemId);

      if (rx && itm) {
        const patient = patientsMap.get(rx.patientId);
        const owner = ownersMap.get(rx.ownerId);

        const patName =
          patient?.name && !isArtificialOrBlankName(patient.name)
            ? patient.name
            : patient
            ? formatAnimalSubtitle(patient)
            : 'Patient';
        const patSub = patient ? formatAnimalSubtitle(patient) : undefined;
        const ownName = formatOwnerPrimary(owner, 'Client');

        const desc = `${itm.brandName}${itm.strengthVolume ? ' ' + itm.strengthVolume : ''}${
          itm.directions ? ' (' + itm.directions + ')' : ''
        }`;

        selectedImports.push({
          prescriptionId: rx.id!,
          prescriptionNumber: rx.rxNumber,
          prescriptionDate: rx.createdAt,
          prescriptionItemId: itm.id,
          patientId: rx.patientId,
          patientName: patName,
          patientSubtitle: patSub,
          ownerId: rx.ownerId,
          ownerName: ownName,
          medicineId: itm.medicineId,
          brandName: itm.brandName,
          strengthVolume: itm.strengthVolume,
          description: desc,
          quantity: itm.quantity || 1,
          unit: itm.dispenseUnit || itm.unit || 'tablets',
          directions: itm.directions,
        });
      }
    }

    if (selectedImports.length > 0) {
      onImportMedicines(selectedImports);
    }
    onClose();
  };

  return (
    <div className="import-rx-backdrop" onClick={onClose}>
      <div
        className="import-rx-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-rx-modal-title"
      >
        {/* Modal Header */}
        <div className="import-rx-header">
          <div>
            <h3 id="import-rx-modal-title" className="import-rx-title">
              <Icon name="pill" size={20} />
              <span>Add Prescription Medicines</span>
            </h3>
            <p className="import-rx-subtitle">
              Select medicines from any prescription across clients and patients to bill in this invoice.
            </p>
          </div>
          <button
            type="button"
            className="import-rx-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="import-rx-filter-bar">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="import-rx-tab-group">
              {(selectedPatientId || selectedOwnerId) && (
                <button
                  type="button"
                  className={`import-rx-tab-btn ${scope === 'current' ? 'active' : ''}`}
                  onClick={() => setScope('current')}
                >
                  <Icon name="user" size={13} />
                  <span>Current Client&apos;s Prescriptions</span>
                </button>
              )}
              <button
                type="button"
                className={`import-rx-tab-btn ${scope === 'all' ? 'active' : ''}`}
                onClick={() => setScope('all')}
              >
                <Icon name="folder" size={13} />
                <span>All Prescriptions</span>
              </button>
            </div>

            {!isLoading && !queryError && (
              <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                {filteredPrescriptions.length} prescription{filteredPrescriptions.length === 1 ? '' : 's'} found
              </span>
            )}
          </div>

          <div className="import-rx-search-wrapper">
            <input
              type="search"
              className="import-rx-search-input"
              placeholder="Search by owner name, phone, patient name, tag, prescription number, or medicine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <span className="import-rx-search-icon">
              <Icon name="search" size={16} />
            </span>
          </div>
        </div>

        {/* Prescription List Body */}
        <div className="import-rx-body">
          {isLoading ? (
            // Bounded Skeleton Loading Cards
            <>
              {[1, 2, 3].map((n) => (
                <div key={`skeleton-${n}`} className="import-rx-skeleton-card">
                  <div className="import-rx-skeleton-line" style={{ width: '45%' }} />
                  <div className="import-rx-skeleton-line" style={{ width: '85%' }} />
                  <div className="import-rx-skeleton-line" style={{ width: '65%' }} />
                </div>
              ))}
            </>
          ) : queryError ? (
            // Error State with Retry
            <div className="import-rx-error-state">
              <Icon name="alert-circle" size={36} color="var(--color-error)" />
              <h4 className="import-rx-error-title">Unable to load prescriptions. Please try again.</h4>
              <p className="import-rx-error-desc">{queryError}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setReloadTrigger((t) => t + 1)}
                style={{ marginTop: '8px' }}
              >
                <Icon name="refresh" size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : filteredPrescriptions.length === 0 ? (
            // Empty State
            <div className="import-rx-empty-state">
              <Icon name="search" size={32} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--color-on-surface)' }}>
                No prescriptions found matching your search.
              </p>
              {scope === 'current' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '6px' }}
                  onClick={() => setScope('all')}
                >
                  <Icon name="folder" size={14} />
                  <span>Search Across All Prescriptions</span>
                </button>
              )}
            </div>
          ) : (
            // Render Prescriptions with Natural Card Expansion
            filteredPrescriptions.map((rx) => {
              const patient = patientsMap.get(rx.patientId);
              const owner = ownersMap.get(rx.ownerId);
              const rxItems = itemsByRxId.get(rx.id!) || [];

              const patientTitle =
                patient?.name && !isArtificialOrBlankName(patient.name)
                  ? patient.name
                  : patient
                  ? formatAnimalSubtitle(patient)
                  : 'Unnamed Patient';
              const patientSub = patient ? formatAnimalSubtitle(patient) : '';
              const ownerTitle = formatOwnerPrimary(owner, 'Walk-in Client');
              const statusLower = (rx.status || 'draft').toLowerCase();

              return (
                <div key={rx.id} className="import-rx-card">
                  {/* Card Header */}
                  <div className="import-rx-card-header">
                    <div className="import-rx-card-meta-left">
                      <span className="import-rx-number-badge">#{rx.rxNumber}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>•</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                        {new Date(rx.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className={`invoices-status-pill ${statusLower}`}>
                        {rx.status || 'Draft'}
                      </span>
                    </div>

                    <div className="import-rx-card-meta-right">
                      <span>
                        Client: <strong>{ownerTitle}</strong>
                        {owner?.phone ? ` (${owner.phone})` : ''}
                      </span>
                      <span style={{ color: 'var(--color-outline)' }}>|</span>
                      <span>
                        Patient: <strong>{patientTitle}</strong>
                        {patientSub && patientSub !== patientTitle ? ` · ${patientSub}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Prescribed Medicines Checklist */}
                  <div className="import-rx-med-list">
                    {rxItems.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontStyle: 'italic', padding: '6px 0' }}>
                        No medicines recorded in this prescription.
                      </span>
                    ) : (
                      rxItems.map((itm) => {
                        const itemKey = `${rx.id}_${itm.id}`;
                        const isChecked = selectedItemKeys.has(itemKey);
                        const alreadyAdded = isAlreadyInInvoice(rx.id!, itm.brandName);

                        return (
                          <label
                            key={itm.id}
                            className={`import-rx-med-row ${isChecked ? 'selected' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="import-rx-checkbox"
                              checked={isChecked}
                              onChange={() => toggleItemSelection(itemKey)}
                            />

                            <div className="import-rx-med-content">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '13px', color: 'var(--color-on-surface)' }}>
                                  {itm.brandName}
                                </strong>
                                {itm.strengthVolume && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-high)', padding: '1px 6px', borderRadius: '4px' }}>
                                    {itm.strengthVolume}
                                  </span>
                                )}
                                {itm.presentation && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                                    ({itm.presentation})
                                  </span>
                                )}
                                {alreadyAdded && (
                                  <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(234, 179, 8, 0.18)', color: '#854d0e', padding: '1px 6px', borderRadius: '4px' }}>
                                    Already in Invoice
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px', color: 'var(--color-on-surface-variant)', marginTop: '3px', flexWrap: 'wrap' }}>
                                {itm.dose && <span>Dose: <strong>{itm.dose}</strong></span>}
                                {itm.frequency && <span>Freq: {itm.frequency}</span>}
                                {itm.durationDays && <span>Duration: {itm.durationDays} days</span>}
                                <span>
                                  Dispense: <strong>{itm.quantity} {itm.unit || 'units'}</strong>
                                </span>
                              </div>

                              {itm.directions && (
                                <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: 'var(--color-outline)' }}>
                                  Instructions: {itm.directions}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="import-rx-footer">
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>
            {selectedItemKeys.size} medicine{selectedItemKeys.size === 1 ? '' : 's'} selected
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={selectedItemKeys.size === 0}
              onClick={handleApplySelection}
            >
              <Icon name="check" size={16} />
              <span>Add Selected to Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
