// =============================================================
// VetRx — Dexie (IndexedDB) schema
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

  constructor() {
    super('VetRxDB');

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

export const db = new VetRxDatabase();

// ── Seed flag ─────────────────────────────────────────────────
const SEED_KEY = 'vetrx_seeded_v1';

export async function ensureSeeded(): Promise<void> {
  // The localStorage flag is only an optimization. IndexedDB is the source of truth.
  // If site storage was partially cleared and the flag remains, reseed the missing base data.
  // Demo records are opt-in only. Production/local clinical data must never be
  // populated with fictional practitioners, owners, patients, or medicines.
  const demoMode = new URLSearchParams(window.location.search).get('demo') === '1'
    || localStorage.getItem('vetrx_demo_mode') === '1';
  const seedFlag = localStorage.getItem(SEED_KEY);
  if (demoMode && !seedFlag) {
    const { seed } = await import('./seed');
    await seed();
    localStorage.setItem(SEED_KEY, '1');
  }

  // Ensure Master Data is initialized even for pre-existing databases
  await ensureMasterDataSeeded();

  // Ensure deterministic formulary dosing rules exist on seeded medicines
  const { ensureMedicineDosingRulesSeeded } = await import('./seed');
  await ensureMedicineDosingRulesSeeded();
}
