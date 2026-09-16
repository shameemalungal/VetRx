// =============================================================
// VetRx — Dexie (IndexedDB) schema
// Multi-tenant isolated storage partitioned by practiceId.
// =============================================================

import Dexie, { type Table } from 'dexie';
import type {
  Practitioner,
  Organisation,
  Owner,
  Patient,
  Medicine,
  Prescription,
  PrescriptionItem,
  TreatmentPackage,
  TreatmentPackageItem,
  Invoice,
  InvoiceItem,
  AuditEvent,
  MasterDataItem,
} from '../types';
import { ensureMasterDataSeeded } from './masterData';

export class VetRxDatabase extends Dexie {
  practitioners!:         Table<Practitioner, number>;
  organisations!:         Table<Organisation, number>;
  owners!:                Table<Owner, number>;
  patients!:              Table<Patient, number>;
  medicines!:             Table<Medicine, number>;
  prescriptions!:         Table<Prescription, number>;
  prescriptionItems!:     Table<PrescriptionItem, number>;
  treatmentPackages!:     Table<TreatmentPackage, number>;
  treatmentPackageItems!: Table<TreatmentPackageItem, number>;
  invoices!:              Table<Invoice, number>;
  invoiceItems!:          Table<InvoiceItem, number>;
  auditEvents!:           Table<AuditEvent, number>;
  masterDataItems!:       Table<MasterDataItem, number>;

  constructor(dbName: string = 'VetRxDB_guest') {
    super(dbName);

    this.version(1).stores({
      practitioners:         '++id, name, registrationNumber',
      organisations:         '++id, name',
      owners:                '++id, name, phone',
      patients:              '++id, ownerId, name, species',
      medicines:             '++id, brandName, genericName, presentation',
      prescriptions:         '++id, rxNumber, patientId, ownerId, practitionerId, status, createdAt',
      prescriptionItems:     '++id, prescriptionId, medicineId, sortOrder',
      treatmentPackages:     '++id, name, category',
      treatmentPackageItems: '++id, packageId, sortOrder',
      invoices:              '++id, invoiceNumber, patientId, ownerId, practitionerId, prescriptionId, status, invoiceDate',
      invoiceItems:          '++id, invoiceId, category, sortOrder',
      auditEvents:           '++id, entityType, entityId, eventType, occurredAt',
    });

    this.version(2).stores({
      treatmentPackages:     '++id, name, category, lastUsedAt',
    });

    this.version(3).stores({
      masterDataItems:       '++id, category, code, name, isActive, sortOrder',
    });

    this.version(4).stores({
      medicines:             '++id, brandName, genericName, presentation, category, isActive',
    });

    this.version(5).stores({
      treatmentPackages:     '++id, name, category, lastUsedAt, *targetSpecies, sourcePrescriptionId',
    });

    this.version(6).stores({
      invoices:              '++id, invoiceNumber, patientId, ownerId, practitionerId, prescriptionId, *prescriptionIds, status, invoiceDate',
      invoiceItems:          '++id, invoiceId, category, sortOrder, prescriptionId, patientId',
    });
  }
}

// ── Multi-Tenant Partitioning ──────────────────────────────────
function getInitialDbName(): string {
  try {
    const savedPracticeId = localStorage.getItem('vetrx_active_practice_id');
    if (savedPracticeId && savedPracticeId.trim()) {
      return `VetRxDB_${savedPracticeId.trim()}`;
    }
  } catch {}
  return 'VetRxDB_guest';
}

let activeDbInstance: VetRxDatabase = new VetRxDatabase(getInitialDbName());

export function getActiveDb(): VetRxDatabase {
  return activeDbInstance;
}

export function switchTenantDb(practiceId?: string | null): VetRxDatabase {
  const targetName = practiceId && practiceId.trim() ? `VetRxDB_${practiceId.trim()}` : 'VetRxDB_guest';

  try {
    if (practiceId && practiceId.trim()) {
      localStorage.setItem('vetrx_active_practice_id', practiceId.trim());
    } else {
      localStorage.removeItem('vetrx_active_practice_id');
    }
  } catch {}

  if (activeDbInstance.name !== targetName) {
    try {
      activeDbInstance.close();
    } catch (e) {
      console.warn('Error closing previous database instance:', e);
    }
    activeDbInstance = new VetRxDatabase(targetName);
  }

  return activeDbInstance;
}

// Dynamic Proxy forwarding all database accesses to the active tenant database
export const db: VetRxDatabase = new Proxy({} as VetRxDatabase, {
  get(_target, prop, receiver) {
    const target = activeDbInstance as any;
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  },
  has(_target, prop) {
    return Reflect.has(activeDbInstance, prop);
  },
});

// ── Seed flag ─────────────────────────────────────────────────
const SEED_KEY = 'vetrx_seeded_v1';

export async function ensureSeeded(): Promise<void> {
  // Ensure Master Data is initialized for the active tenant database
  await ensureMasterDataSeeded();

  // Demo records are opt-in only via ?demo=1
  const demoMode = new URLSearchParams(window.location.search).get('demo') === '1'
    || localStorage.getItem('vetrx_demo_mode') === '1';
  const seedFlag = localStorage.getItem(SEED_KEY);
  if (demoMode && !seedFlag) {
    const { seed } = await import('./seed');
    await seed();
    localStorage.setItem(SEED_KEY, '1');
  }

  // Ensure deterministic formulary dosing rules exist on seeded medicines
  const { ensureMedicineDosingRulesSeeded } = await import('./seed');
  await ensureMedicineDosingRulesSeeded();
}
