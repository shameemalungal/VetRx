// ==============================================================================
// VetRx — Centralized Clinical Synchronization Service
// Hydrates and synchronizes Calls, Prescriptions, Invoices, Patients & Owners
// from the server backend into the active tenant's IndexedDB (Dexie).
// Provides reactive sync status (pending, syncing, synced, failed).
// ==============================================================================

import { useState, useEffect } from 'react';
import { db } from '../db/schema';
import { API_BASE } from '../config/api';

export type SyncState = 'synced' | 'syncing' | 'pending' | 'failed';

export interface SyncStatusInfo {
  state: SyncState;
  lastSyncedAt: Date | null;
  lastError: string | null;
  pendingCount: number;
  isOnline: boolean;
}

let isSyncing = false;
let lastSyncTime = 0;
const SYNC_DEBOUNCE_MS = 2000;

type SyncListener = (status: SyncStatusInfo) => void;
const listeners = new Set<SyncListener>();

let currentStatus: SyncStatusInfo = {
  state: typeof navigator !== 'undefined' && !navigator.onLine ? 'pending' : 'synced',
  lastSyncedAt: null,
  lastError: null,
  pendingCount: 0,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
};

function notifyListeners() {
  const snapshot = { ...currentStatus };
  listeners.forEach((fn) => fn(snapshot));
}

export function getSyncStatus(): SyncStatusInfo {
  return { ...currentStatus };
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncStatus(): SyncStatusInfo {
  const [status, setStatus] = useState<SyncStatusInfo>(() => getSyncStatus());

  useEffect(() => {
    return subscribeSyncStatus(setStatus);
  }, []);

  return status;
}

/**
 * Calculates actual un-synchronized records across Dexie tables.
 */
export async function countPendingRecords(): Promise<number> {
  try {
    let pending = 0;

    // 1. Calls pending sync
    if (db.calls) {
      const calls = await db.calls.toArray();
      pending += calls.filter((c: any) => c.syncStatus === 'LOCAL_PENDING' || !c.serverId).length;
    }

    // 2. Visits pending sync
    if (db.visits) {
      const visits = await db.visits.toArray();
      pending += visits.filter((v: any) => v.syncStatus === 'LOCAL_PENDING' || !v.serverId).length;
    }

    // 3. Prescriptions pending sync
    if (db.prescriptions) {
      const rxs = await db.prescriptions.toArray();
      pending += rxs.filter((r: any) => r.syncStatus === 'LOCAL_PENDING' || (!r.serverId && r.status !== 'Draft')).length;
    }

    // 4. Invoices pending sync
    if (db.invoices) {
      const invs = await db.invoices.toArray();
      pending += invs.filter((i: any) => i.syncStatus === 'LOCAL_PENDING' || (!i.serverId && i.status !== 'Draft')).length;
    }

    return pending;
  } catch (err) {
    console.warn('[VetRx Sync] Failed to count pending records:', err);
    return 0;
  }
}

// Global online/offline network listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    currentStatus.isOnline = true;
    notifyListeners();
    void syncAllClinicalData(null, true);
  });

  window.addEventListener('offline', () => {
    currentStatus.isOnline = false;
    if (currentStatus.state !== 'failed') {
      currentStatus.state = 'pending';
    }
    notifyListeners();
  });
}

/**
 * Main synchronization routine.
 */
export async function syncAllClinicalData(practiceId?: string | null, force: boolean = false): Promise<boolean> {
  if (typeof window === 'undefined') return true;

  const pending = await countPendingRecords();
  currentStatus.pendingCount = pending;

  if (!navigator.onLine) {
    currentStatus.isOnline = false;
    currentStatus.state = pending > 0 ? 'pending' : (currentStatus.lastError ? 'failed' : 'pending');
    currentStatus.lastError = 'Device is offline (network disconnected)';
    notifyListeners();
    return false;
  }

  currentStatus.isOnline = true;
  const now = Date.now();
  if (!force && (isSyncing || now - lastSyncTime < SYNC_DEBOUNCE_MS)) {
    return true;
  }

  isSyncing = true;
  lastSyncTime = now;
  currentStatus.state = 'syncing';
  currentStatus.lastError = null;
  notifyListeners();

  try {
    console.log('[VetRx Sync] Starting clinical hydration from backend for practice:', practiceId || 'active');

    // Sync all clinical tables sequentially/concurrently with error catching
    await syncOwnersAndPatients();
    await syncCalls();
    await syncPrescriptions();
    await syncInvoices();

    const postPending = await countPendingRecords();
    currentStatus.pendingCount = postPending;
    currentStatus.lastSyncedAt = new Date();
    currentStatus.lastError = null;
    currentStatus.state = postPending > 0 ? 'pending' : 'synced';
    console.log('[VetRx Sync] Clinical hydration completed successfully.');
    notifyListeners();
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || 'Sync failed: network or backend error';
    console.warn('[VetRx Sync] Clinical hydration failure:', errorMsg);
    currentStatus.lastError = errorMsg;
    currentStatus.state = 'failed';
    notifyListeners();
    return false;
  } finally {
    isSyncing = false;
  }
}

/**
 * 1. Synchronize Owners and Patients
 */
export async function syncOwnersAndPatients(): Promise<void> {
  const [ownersRes, patientsRes] = await Promise.all([
    fetch(`${API_BASE}/api/owners`, { credentials: 'include' }),
    fetch(`${API_BASE}/api/patients`, { credentials: 'include' }),
  ]);

  if (!ownersRes.ok) {
    throw new Error(`Failed to sync owners (HTTP ${ownersRes.status})`);
  }
  if (!patientsRes.ok) {
    throw new Error(`Failed to sync patients (HTTP ${patientsRes.status})`);
  }

  const serverOwners: any[] = await ownersRes.json();
  if (Array.isArray(serverOwners)) {
    for (const so of serverOwners) {
      const existing = await db.owners
        .filter((o) => (o.serverId === so.id) || (!!so.phone && o.phone === so.phone))
        .first();

      if (existing && existing.id) {
        await db.owners.update(existing.id, {
          serverId: so.id,
          name: so.name || existing.name,
          phone: so.phone || existing.phone,
          email: so.email ?? existing.email,
          address: so.address ?? existing.address,
          updatedAt: new Date(so.updatedAt || Date.now()),
        });
      } else {
        await db.owners.add({
          serverId: so.id,
          name: so.name || 'Client',
          phone: so.phone || '',
          email: so.email || undefined,
          address: so.address || undefined,
          createdAt: new Date(so.createdAt || Date.now()),
          updatedAt: new Date(so.updatedAt || Date.now()),
        });
      }
    }
  }

  const serverPatients: any[] = await patientsRes.json();
  if (Array.isArray(serverPatients)) {
    for (const sp of serverPatients) {
      let localOwnerId: number | string | undefined;
      if (sp.ownerId) {
        const matchedOwner = await db.owners.filter((o) => o.serverId === sp.ownerId).first();
        if (matchedOwner?.id) {
          localOwnerId = matchedOwner.id;
        }
      }

      const existing = await db.patients
        .filter((p) => (p.serverId === sp.id) || (!!localOwnerId && p.ownerId === localOwnerId && p.name === sp.name))
        .first();

      if (existing && existing.id) {
        await db.patients.update(existing.id, {
          serverId: sp.id,
          ownerId: localOwnerId || existing.ownerId,
          name: sp.name || existing.name,
          species: (sp.species || existing.species || 'Cattle') as any,
          breed: sp.breed ?? existing.breed,
          sex: (sp.sex || existing.sex || 'Unknown') as any,
          weightKg: sp.weightKg ?? existing.weightKg,
          updatedAt: new Date(sp.updatedAt || Date.now()),
        });
      } else if (localOwnerId) {
        await db.patients.add({
          serverId: sp.id,
          ownerId: localOwnerId,
          name: sp.name || 'Patient',
          species: (sp.species || 'Cattle') as any,
          breed: sp.breed || undefined,
          sex: (sp.sex || 'Unknown') as any,
          weightKg: sp.weightKg ?? undefined,
          createdAt: new Date(sp.createdAt || Date.now()),
          updatedAt: new Date(sp.updatedAt || Date.now()),
        });
      }
    }
  }
}

/**
 * 2. Synchronize Calls
 */
export async function syncCalls(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/calls`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to sync calls (HTTP ${res.status})`);
  }
  const serverCalls: any[] = await res.json();
  if (!Array.isArray(serverCalls)) return;

  for (const sc of serverCalls) {
    const existing = await db.calls
      .filter((c: any) => c.serverId === sc.id || (c.callerPhone === sc.callerPhone && c.symptoms === sc.symptoms))
      .first();

    const callData: any = {
      serverId: sc.id,
      callerPhone: sc.callerPhone || '',
      tempOwnerName: sc.tempOwnerName || sc.owner?.name || undefined,
      tempPatientName: sc.tempPatientName || undefined,
      species: sc.species || 'Cattle',
      animalCount: sc.animalCount || 1,
      symptoms: sc.symptoms || '',
      tentativeAssessment: sc.tentativeAssessment || undefined,
      priority: sc.priority || 'URGENT',
      flexibility: sc.flexibility || 'MUST_ATTEND_TODAY',
      preferredDate: sc.preferredDate ? new Date(sc.preferredDate) : undefined,
      locationAddress: sc.locationAddress || undefined,
      status: sc.status || 'LOGGED',
      notes: sc.notes || undefined,
      syncStatus: 'SYNCED',
      createdAt: new Date(sc.createdAt || Date.now()),
      updatedAt: new Date(sc.updatedAt || Date.now()),
    };

    if (sc.ownerId) {
      const localOwner = await db.owners.filter((o) => o.serverId === sc.ownerId).first();
      if (localOwner?.id) callData.ownerId = localOwner.id;
    }

    if (existing && existing.id) {
      await db.calls.update(existing.id as any, callData);
    } else {
      await db.calls.add(callData);
    }
  }
}

/**
 * 3. Synchronize Prescriptions
 */
export async function syncPrescriptions(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/prescriptions`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to sync prescriptions (HTTP ${res.status})`);
  }
  const serverRxList: any[] = await res.json();
  if (!Array.isArray(serverRxList)) return;

  for (const srx of serverRxList) {
    let localPatient = srx.patientId
      ? await db.patients.filter((p) => p.serverId === srx.patientId).first()
      : null;

    let localOwner = srx.patient?.ownerId
      ? await db.owners.filter((o) => o.serverId === srx.patient.ownerId).first()
      : null;

    if (!localPatient && srx.patient) {
      if (!localOwner && srx.patient.owner) {
        const newOwnerId = (await db.owners.add({
          serverId: srx.patient.owner.id,
          name: srx.patient.owner.name || 'Client',
          phone: srx.patient.owner.phone || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        })) as number;
        localOwner = await db.owners.get(newOwnerId) || null;
      }

      if (localOwner?.id) {
        const newPatId = (await db.patients.add({
          serverId: srx.patient.id,
          ownerId: localOwner.id,
          name: srx.patient.name || 'Patient',
          species: (srx.patient.species || 'Cattle') as any,
          sex: (srx.patient.sex || 'Unknown') as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        })) as number;
        localPatient = await db.patients.get(newPatId) || null;
      }
    }

    const existing = await db.prescriptions
      .filter((p: any) => p.serverId === srx.id || (!!srx.prescriptionNumber && p.rxNumber === srx.prescriptionNumber))
      .first();

    const rxData: any = {
      serverId: srx.id,
      rxNumber: srx.prescriptionNumber || `RX-${srx.id.substring(0, 8)}`,
      patientId: localPatient?.id,
      ownerId: localOwner?.id,
      clinicalFindings: srx.clinicalFindings || undefined,
      diagnosis: srx.diagnosis || undefined,
      notes: srx.instructions || undefined,
      status: srx.approvalStatus === 'APPROVED' ? 'Approved' : srx.status || 'Draft',
      dispenseStatus: srx.dispenseStatus || 'UNDISPENSED',
      syncStatus: 'SYNCED',
      createdAt: new Date(srx.createdAt || Date.now()),
      updatedAt: new Date(srx.updatedAt || Date.now()),
    };

    let localRxId: number | string;
    if (existing && existing.id) {
      await db.prescriptions.update(existing.id, rxData);
      localRxId = existing.id;
    } else {
      localRxId = (await db.prescriptions.add(rxData)) as number | string;
    }

    if (Array.isArray(srx.items) && srx.items.length > 0) {
      const existingItems = await db.prescriptionItems.where('prescriptionId').equals(localRxId).toArray();
      if (existingItems.length === 0) {
        const itemsToInsert = srx.items.map((it: any, idx: number) => ({
          prescriptionId: localRxId,
          serverId: it.id,
          brandName: it.medicineName || 'Medicine',
          dose: it.dosage || undefined,
          dosage: it.dosage || undefined,
          frequency: it.frequency || 'OD',
          durationDays: it.durationDays || 5,
          quantity: it.totalQuantity || 1,
          unit: it.quantityUnit || 'tablet',
          directions: it.instructions || undefined,
          isExternal: Boolean(it.isExternal),
          inventoryItemId: it.inventoryItemId || null,
          dispensedQuantity: it.dispensedQuantity || 0,
          dispenseStatus: it.dispenseStatus || 'PENDING',
          sortOrder: idx,
        }));
        await db.prescriptionItems.bulkAdd(itemsToInsert as any);
      } else {
        // Update existing items with latest dispense status
        for (const it of srx.items) {
          const matched = existingItems.find(
            (ei: any) => ei.serverId === it.id || ei.brandName === it.medicineName
          );
          if (matched && matched.id) {
            await db.prescriptionItems.update(matched.id, {
              serverId: it.id,
              isExternal: Boolean(it.isExternal),
              inventoryItemId: it.inventoryItemId || null,
              dispensedQuantity: it.dispensedQuantity || 0,
              dispenseStatus: it.dispenseStatus || 'PENDING',
            } as any);
          }
        }
      }
    }
  }
}

/**
 * 4. Synchronize Invoices
 */
export async function syncInvoices(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/invoices`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Failed to sync invoices (HTTP ${res.status})`);
  }
  const serverInvoices: any[] = await res.json();
  if (!Array.isArray(serverInvoices)) return;

  for (const sinv of serverInvoices) {
    let localPatient = sinv.patientId
      ? await db.patients.filter((p) => p.serverId === sinv.patientId).first()
      : null;

    let localOwner = sinv.patient?.ownerId
      ? await db.owners.filter((o) => o.serverId === sinv.patient.ownerId).first()
      : null;

    if (!localPatient && sinv.patient) {
      if (!localOwner && sinv.patient.owner) {
        const newOwnerId = (await db.owners.add({
          serverId: sinv.patient.owner.id,
          name: sinv.patient.owner.name || 'Client',
          phone: sinv.patient.owner.phone || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        })) as number;
        localOwner = await db.owners.get(newOwnerId) || null;
      }

      if (localOwner?.id) {
        const newPatId = (await db.patients.add({
          serverId: sinv.patient.id,
          ownerId: localOwner.id,
          name: sinv.patient.name || 'Patient',
          species: (sinv.patient.species || 'Cattle') as any,
          sex: (sinv.patient.sex || 'Unknown') as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        })) as number;
        localPatient = await db.patients.get(newPatId) || null;
      }
    }

    const existing = await db.invoices
      .filter((i: any) => i.serverId === sinv.id || (!!sinv.invoiceNumber && i.invoiceNumber === sinv.invoiceNumber))
      .first();

    const invData: any = {
      serverId: sinv.id,
      invoiceNumber: sinv.invoiceNumber || `INV-${sinv.id.substring(0, 8)}`,
      patientId: localPatient?.id,
      ownerId: localOwner?.id,
      invoiceDate: new Date(sinv.createdAt || Date.now()),
      subtotal: Math.round((sinv.subtotal || 0) * 100),
      discountTotal: Math.round((sinv.discountAmount || 0) * 100),
      taxTotal: Math.round((sinv.taxAmount || 0) * 100),
      grandTotal: Math.round((sinv.totalAmount || 0) * 100),
      status: sinv.status || 'Issued',
      syncStatus: 'SYNCED',
      createdAt: new Date(sinv.createdAt || Date.now()),
      updatedAt: new Date(sinv.updatedAt || Date.now()),
    };

    let localInvId: number | string;
    if (existing && existing.id) {
      await db.invoices.update(existing.id, invData);
      localInvId = existing.id;
    } else {
      localInvId = (await db.invoices.add(invData)) as number | string;
    }

    if (Array.isArray(sinv.items) && sinv.items.length > 0) {
      const existingItems = await db.invoiceItems.where('invoiceId').equals(localInvId).toArray();
      if (existingItems.length === 0) {
        const itemsToInsert = sinv.items.map((it: any, idx: number) => ({
          invoiceId: localInvId,
          description: it.description || 'Item',
          category: it.category || 'Medicine',
          unitPricePaisa: Math.round((it.unitPrice || 0) * 100),
          quantity: it.quantity || 1,
          lineTotalPaisa: Math.round((it.totalPrice || 0) * 100),
          sortOrder: idx + 1,
        }));
        await db.invoiceItems.bulkAdd(itemsToInsert as any);
      }
    }
  }
}
