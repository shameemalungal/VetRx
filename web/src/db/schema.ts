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
  Call,
  Visit,
  VisitCase,
  VisitProcedure,
  VisitMedicineUsage,
  VisitTimelineEvent,
  OwnerLocation,
  DailyPlan,
  FollowUp,
  RecurringSchedule,
  ProcedureDurationEstimate,
} from '../types';
import { ensureMasterDataSeeded } from './masterData';

export class VetRxDatabase extends Dexie {
  practitioners!:              Table<Practitioner, number | string>;
  organisations!:              Table<Organisation, number | string>;
  owners!:                     Table<Owner, number | string>;
  patients!:                   Table<Patient, number | string>;
  medicines!:                  Table<Medicine, number | string>;
  prescriptions!:              Table<Prescription, number | string>;
  prescriptionItems!:          Table<PrescriptionItem, number | string>;
  treatmentPackages!:          Table<TreatmentPackage, number | string>;
  treatmentPackageItems!:      Table<TreatmentPackageItem, number | string>;
  invoices!:                   Table<Invoice, number | string>;
  invoiceItems!:               Table<InvoiceItem, number | string>;
  auditEvents!:                Table<AuditEvent, number | string>;
  masterDataItems!:            Table<MasterDataItem, number | string>;
  calls!:                      Table<Call, number | string>;
  visits!:                     Table<Visit, number | string>;
  visitCases!:                 Table<VisitCase, number | string>;
  visitProcedures!:            Table<VisitProcedure, number | string>;
  visitMedicineUsages!:        Table<VisitMedicineUsage, number | string>;
  visitTimelineEvents!:        Table<VisitTimelineEvent, number | string>;
  ownerLocations!:             Table<OwnerLocation, number | string>;
  dailyPlans!:                 Table<DailyPlan, number | string>;
  followUps!:                  Table<FollowUp, number | string>;
  recurringSchedules!:         Table<RecurringSchedule, number | string>;
  procedureDurationEstimates!: Table<ProcedureDurationEstimate, number | string>;

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

    this.version(7).stores({
      calls:                 '++id, callerPhone, ownerId, priority, flexibility, status, preferredDate, createdAt',
      visits:                '++id, callId, ownerId, locationId, status, priority, scheduledDate, sequenceOrder, createdAt',
      ownerLocations:        '++id, ownerId, label, isDefault, createdAt',
      dailyPlans:            '++id, planDate, doctorUserId, status, createdAt',
    });

    this.version(8).stores({
      visits:                '++id, callId, ownerId, locationId, status, priority, scheduledDate, sequenceOrder, arrivedAt, visitStartedAt, visitCompletedAt, createdAt',
      visitCases:            '++id, visitId, patientId, practiceId, createdAt',
      visitProcedures:       '++id, visitId, patientId, procedureCategory, performedAt',
      visitMedicineUsages:   '++id, visitId, patientId, medicineId, administeredAt, idempotencyKey',
      visitTimelineEvents:   '++id, visitId, eventType, occurredAt',
    });

    this.version(9).stores({
      visitMedicineUsages:   '++id, visitId, patientId, medicineId, administeredAt, idempotencyKey',
    });

    this.version(10).stores({
      followUps:                  '++id, practiceId, ownerId, patientId, originVisitId, recurrenceRuleId, status, priority, recommendedDate, createdAt',
      recurringSchedules:         '++id, practiceId, ownerId, patientId, status, frequency, startDate, createdAt',
      procedureDurationEstimates: '++id, practiceId, procedureCategory, source, updatedAt',
    });

    this.version(11).stores({
      prescriptions:              '++id, rxNumber, patientId, ownerId, practitionerId, status, visitId, createdAt',
      visitCases:                 '++id, visitId, patientId, prescriptionId, practiceId, createdAt',
    });

    this.version(12).stores({
      owners:                     '++id, name, phone, *alternatePhones, serverId',
      patients:                   '++id, ownerId, serverId, name, species',
      invoices:                   '++id, invoiceNumber, patientId, ownerId, practitionerId, prescriptionId, *prescriptionIds, visitId, status, invoiceDate',
      invoiceItems:               '++id, invoiceId, category, sortOrder, prescriptionId, patientId, visitId',
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

if (typeof window !== 'undefined') {
  (window as any).db = db;
  (window as any).switchTenantDb = switchTenantDb;
  (window as any).getActiveDb = getActiveDb;
}

// ── Seed flag ─────────────────────────────────────────────────
const SEED_KEY = 'vetrx_seeded_v1';

export async function ensureSeeded(): Promise<void> {
  // Ensure Master Data is initialized for the active tenant database
  await ensureMasterDataSeeded();

  // Demo records are opt-in only via ?demo=1
  const demoMode = new URLSearchParams(window.location.search).get('demo') === '1'
    || localStorage.getItem('vetrx_demo_mode') === '1';
  const tenantSeedKey = `${SEED_KEY}_${activeDbInstance.name}`;
  const seedFlag = localStorage.getItem(tenantSeedKey);
  if (demoMode && !seedFlag) {
    const { seed } = await import('./seed');
    await seed();
    localStorage.setItem(tenantSeedKey, '1');
    localStorage.setItem(SEED_KEY, '1');
  }

  // Ensure deterministic formulary dosing rules exist on seeded medicines
  const { ensureMedicineDosingRulesSeeded } = await import('./seed');
  await ensureMedicineDosingRulesSeeded();
}
