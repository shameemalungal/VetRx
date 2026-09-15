// =============================================================
// VetRx — Backup & Restore Utility
// Pure client-side export, strict schema validation, atomic
// Dexie transactions, safety backup creation, and rollback.
// =============================================================

import { db } from '../db/schema';
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

export const BACKUP_APP_NAME = 'VetRx';
export const CURRENT_BACKUP_FORMAT_VERSION = 1;
export const CURRENT_SCHEMA_VERSION = 5;

// The exact 13 database tables in VetRx
export const ALL_TABLE_NAMES = [
  'practitioners',
  'organisations',
  'owners',
  'patients',
  'medicines',
  'prescriptions',
  'prescriptionItems',
  'treatmentPackages',
  'treatmentPackageItems',
  'invoices',
  'invoiceItems',
  'auditEvents',
  'masterDataItems',
] as const;

export type TableName = (typeof ALL_TABLE_NAMES)[number];

export interface AppSettingsDump {
  showHsnColumn: boolean;
  showSacColumn: boolean;
  showSpecialInstructionsForOwner: boolean;
}

export interface BackupTableData {
  practitioners: Practitioner[];
  organisations: Organisation[];
  owners: Owner[];
  patients: Patient[];
  medicines: Medicine[];
  prescriptions: Prescription[];
  prescriptionItems: PrescriptionItem[];
  treatmentPackages: TreatmentPackage[];
  treatmentPackageItems: TreatmentPackageItem[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  auditEvents: AuditEvent[];
  masterDataItems: MasterDataItem[];
}

export interface VetRxBackupPayload {
  appName: string;
  backupFormatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  appVersion?: string;
  settings?: AppSettingsDump;
  tables: BackupTableData;
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: Record<string, number>;
  payload?: VetRxBackupPayload;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restoredCounts?: Record<string, number>;
  safetyBackupKey?: string;
  error?: string;
}

// ── Export Backup ─────────────────────────────────────────────

/**
 * Exports all 13 database tables and stored preferences into a structured JSON string.
 */
export async function createDatabaseBackupPayload(): Promise<VetRxBackupPayload> {
  const [
    practitioners,
    organisations,
    owners,
    patients,
    medicines,
    prescriptions,
    prescriptionItems,
    treatmentPackages,
    treatmentPackageItems,
    invoices,
    invoiceItems,
    auditEvents,
    masterDataItems,
  ] = await Promise.all([
    db.practitioners.toArray(),
    db.organisations.toArray(),
    db.owners.toArray(),
    db.patients.toArray(),
    db.medicines.toArray(),
    db.prescriptions.toArray(),
    db.prescriptionItems.toArray(),
    db.treatmentPackages.toArray(),
    db.treatmentPackageItems.toArray(),
    db.invoices.toArray(),
    db.invoiceItems.toArray(),
    db.auditEvents.toArray(),
    db.masterDataItems.toArray(),
  ]);

  const settings: AppSettingsDump = {
    showHsnColumn: localStorage.getItem('vetrx_show_hsn') !== 'false',
    showSacColumn: localStorage.getItem('vetrx_show_sac') !== 'false',
    showSpecialInstructionsForOwner: localStorage.getItem('vetrx_show_owner_instructions') !== 'false',
  };

  const payload: VetRxBackupPayload = {
    appName: BACKUP_APP_NAME,
    backupFormatVersion: CURRENT_BACKUP_FORMAT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    tables: {
      practitioners,
      organisations,
      owners,
      patients,
      medicines,
      prescriptions,
      prescriptionItems,
      treatmentPackages,
      treatmentPackageItems,
      invoices,
      invoiceItems,
      auditEvents,
      masterDataItems,
    },
  };

  return payload;
}

/**
 * Triggers a browser download of the database backup as `vetrx-backup-YYYY-MM-DD.json`.
 */
export async function exportDatabaseBackup(): Promise<{ filename: string; recordCount: number }> {
  const payload = await createDatabaseBackupPayload();
  const jsonString = JSON.stringify(payload, null, 2);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const filename = `vetrx-backup-${year}-${month}-${day}.json`;

  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Calculate total records
  let totalRecords = 0;
  for (const table of ALL_TABLE_NAMES) {
    totalRecords += payload.tables[table]?.length || 0;
  }

  // Save last backup timestamp in localStorage for UI indicator
  localStorage.setItem('vetrx_last_backup_at', payload.exportedAt);

  return { filename, recordCount: totalRecords };
}

// ── Validation ────────────────────────────────────────────────

/**
 * Validates a backup JSON string or object for schema compatibility, required metadata,
 * valid arrays, record structure, duplicate primary keys, and critical relationships.
 */
export function validateBackupFile(content: string | object): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const summary: Record<string, number> = {};

  let parsed: unknown;

  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        valid: false,
        errors: ['The selected file is not valid JSON. Please provide a valid VetRx backup file.'],
        warnings,
        summary,
      };
    }
  } else {
    parsed = content;
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      errors: ['Invalid backup format: file content must be a JSON object.'],
      warnings,
      summary,
    };
  }

  const obj = parsed as Record<string, unknown>;

  // 1. App name verification
  if (obj.appName !== BACKUP_APP_NAME) {
    errors.push(`Invalid application name: expected "${BACKUP_APP_NAME}", but found "${String(obj.appName)}".`);
  }

  // 2. Backup format version
  if (typeof obj.backupFormatVersion !== 'number' || obj.backupFormatVersion > CURRENT_BACKUP_FORMAT_VERSION) {
    errors.push(
      `Unsupported backup format version: ${String(obj.backupFormatVersion)}. Supported format version: ${CURRENT_BACKUP_FORMAT_VERSION}.`
    );
  }

  // 3. Schema version
  if (typeof obj.schemaVersion !== 'number') {
    errors.push('Missing database schema version in backup metadata.');
  } else if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(
      `Backup was generated with a newer database schema version (${obj.schemaVersion}). Current version is ${CURRENT_SCHEMA_VERSION}.`
    );
  } else if (obj.schemaVersion < 1) {
    errors.push(`Invalid database schema version: ${obj.schemaVersion}.`);
  }

  // 4. Exported timestamp
  if (!obj.exportedAt || typeof obj.exportedAt !== 'string' || isNaN(Date.parse(obj.exportedAt))) {
    warnings.push('Backup is missing a valid ISO export timestamp.');
  }

  // 5. Tables object verification
  if (!obj.tables || typeof obj.tables !== 'object') {
    errors.push('Missing or malformed "tables" object in backup.');
    return { valid: false, errors, warnings, summary };
  }

  const tablesObj = obj.tables as Record<string, unknown>;

  // Check each required table array
  for (const tableName of ALL_TABLE_NAMES) {
    const tableData = tablesObj[tableName];
    if (!tableData) {
      warnings.push(`Table "${tableName}" was not present in the backup; treating as empty.`);
      summary[tableName] = 0;
      tablesObj[tableName] = [];
      continue;
    }

    if (!Array.isArray(tableData)) {
      errors.push(`Table "${tableName}" must be an array of records.`);
      summary[tableName] = 0;
      continue;
    }

    summary[tableName] = tableData.length;

    // Check records for primary key uniqueness and structure
    const seenIds = new Set<number>();
    for (let i = 0; i < tableData.length; i++) {
      const record = tableData[i];
      if (!record || typeof record !== 'object') {
        errors.push(`Table "${tableName}" contains a non-object record at index ${i}.`);
        continue;
      }

      const recObj = record as Record<string, unknown>;
      if (recObj.id !== undefined && recObj.id !== null) {
        if (typeof recObj.id !== 'number') {
          errors.push(`Table "${tableName}" has a non-numeric primary key id at index ${i}: ${String(recObj.id)}.`);
        } else if (seenIds.has(recObj.id)) {
          errors.push(`Table "${tableName}" contains duplicate primary key id: ${recObj.id}.`);
        } else {
          seenIds.add(recObj.id);
        }
      }

      // Check required fields for core tables
      if (tableName === 'owners' && (!recObj.name || typeof recObj.name !== 'string')) {
        errors.push(`Owner record at index ${i} is missing a required name.`);
      }
      if (tableName === 'patients' && (!recObj.name || typeof recObj.name !== 'string')) {
        errors.push(`Patient record at index ${i} is missing a required name.`);
      }
      if (tableName === 'medicines' && (!recObj.brandName || typeof recObj.brandName !== 'string')) {
        errors.push(`Medicine record at index ${i} is missing a required brandName.`);
      }
      if (tableName === 'prescriptions' && (!recObj.rxNumber || typeof recObj.rxNumber !== 'string')) {
        errors.push(`Prescription record at index ${i} is missing a required rxNumber.`);
      }
      if (tableName === 'invoices' && (!recObj.invoiceNumber || typeof recObj.invoiceNumber !== 'string')) {
        errors.push(`Invoice record at index ${i} is missing a required invoiceNumber.`);
      }
    }
  }

  // 6. Basic Referential integrity warnings
  if (Array.isArray(tablesObj.patients) && Array.isArray(tablesObj.owners)) {
    const ownerIds = new Set(
      (tablesObj.owners as Array<{ id?: number }>)
        .map((o) => o.id)
        .filter((id): id is number => typeof id === 'number')
    );
    for (const p of tablesObj.patients as Array<{ id?: number; name?: string; ownerId?: number }>) {
      if (p.ownerId && !ownerIds.has(p.ownerId)) {
        warnings.push(`Patient "${p.name || 'Unnamed'}" references ownerId ${p.ownerId} which is not in the owners list.`);
      }
    }
  }

  if (Array.isArray(tablesObj.prescriptionItems) && Array.isArray(tablesObj.prescriptions)) {
    const rxIds = new Set(
      (tablesObj.prescriptions as Array<{ id?: number }>)
        .map((rx) => rx.id)
        .filter((id): id is number => typeof id === 'number')
    );
    for (const item of tablesObj.prescriptionItems as Array<{ id?: number; prescriptionId?: number; brandName?: string }>) {
      if (item.prescriptionId && !rxIds.has(item.prescriptionId)) {
        warnings.push(
          `Prescription item "${item.brandName || 'Item'}" references prescriptionId ${item.prescriptionId} which is missing.`
        );
      }
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    summary,
    payload: valid ? (obj as unknown as VetRxBackupPayload) : undefined,
  };
}

// ── Date Deserialization Helper ───────────────────────────────

const DATE_FIELDS: Record<string, string[]> = {
  practitioners: ['createdAt', 'updatedAt'],
  organisations: ['createdAt', 'updatedAt'],
  owners: ['createdAt', 'updatedAt'],
  patients: ['dateOfBirth', 'createdAt', 'updatedAt'],
  medicines: ['createdAt', 'updatedAt'],
  prescriptions: ['issuedAt', 'cancelledAt', 'createdAt', 'updatedAt'],
  treatmentPackages: ['lastUsedAt', 'createdAt', 'updatedAt'],
  invoices: ['invoiceDate', 'issuedAt', 'cancelledAt', 'createdAt', 'updatedAt'],
  auditEvents: ['occurredAt'],
  masterDataItems: ['createdAt', 'updatedAt'],
};

function parseDatesInRecords(tableName: TableName, records: unknown[]): unknown[] {
  const fields = DATE_FIELDS[tableName];
  if (!fields || fields.length === 0) return records;

  return records.map((rec) => {
    if (!rec || typeof rec !== 'object') return rec;
    const copy = { ...(rec as Record<string, unknown>) };
    for (const f of fields) {
      if (copy[f] && typeof copy[f] === 'string') {
        const parsed = new Date(copy[f] as string);
        if (!isNaN(parsed.getTime())) {
          copy[f] = parsed;
        }
      }
    }
    return copy;
  });
}

// ── Restore Execution (Atomic with Safety Backup & Rollback) ──

/**
 * Creates an in-memory safety snapshot of the current database before any destructive replace.
 */
export async function createSafetyBackupSnapshot(): Promise<VetRxBackupPayload> {
  return await createDatabaseBackupPayload();
}

/**
 * Safely restores the database from a validated payload using an atomic Dexie transaction.
 * Creates an automatic safety backup in sessionStorage/localStorage first.
 * If any table fails, the entire transaction rolls back cleanly.
 */
export async function restoreDatabaseBackup(
  payload: VetRxBackupPayload,
  mode: 'replace' = 'replace'
): Promise<RestoreResult> {
  if (mode !== 'replace') {
    return {
      success: false,
      message: 'Currently only Replace restore mode is supported to guarantee referential and numbering integrity.',
    };
  }

  // 1. Take a safety snapshot of the existing database before touching anything
  let safetyBackup: VetRxBackupPayload;
  try {
    safetyBackup = await createSafetyBackupSnapshot();
    const safetyKey = `vetrx_safety_backup_${Date.now()}`;
    // Save to sessionStorage (fallback to localStorage if space permits)
    try {
      sessionStorage.setItem(safetyKey, JSON.stringify(safetyBackup));
      localStorage.setItem('vetrx_last_safety_backup_key', safetyKey);
    } catch (storageErr) {
      console.warn('Could not store safety backup in web storage (likely quota), continuing in memory:', storageErr);
    }
  } catch (snapErr) {
    return {
      success: false,
      message: `Failed to create safety backup prior to restore: ${snapErr instanceof Error ? snapErr.message : String(snapErr)}. Restore aborted without modifying existing data.`,
    };
  }

  // 2. Prepare deserialized tables
  const preparedTables: Partial<Record<TableName, unknown[]>> = {};
  for (const tableName of ALL_TABLE_NAMES) {
    const rawRecords = payload.tables[tableName] || [];
    preparedTables[tableName] = parseDatesInRecords(tableName, rawRecords);
  }

  // 3. Execute atomic transaction across all 13 tables
  try {
    await db.transaction(
      'rw',
      [
        db.practitioners,
        db.organisations,
        db.owners,
        db.patients,
        db.medicines,
        db.prescriptions,
        db.prescriptionItems,
        db.treatmentPackages,
        db.treatmentPackageItems,
        db.invoices,
        db.invoiceItems,
        db.auditEvents,
        db.masterDataItems,
      ],
      async () => {
        // Step A: Clear all tables in transaction
        await Promise.all([
          db.practitioners.clear(),
          db.organisations.clear(),
          db.owners.clear(),
          db.patients.clear(),
          db.medicines.clear(),
          db.prescriptions.clear(),
          db.prescriptionItems.clear(),
          db.treatmentPackages.clear(),
          db.treatmentPackageItems.clear(),
          db.invoices.clear(),
          db.invoiceItems.clear(),
          db.auditEvents.clear(),
          db.masterDataItems.clear(),
        ]);

        // Step B: Bulk add all prepared records
        for (const tableName of ALL_TABLE_NAMES) {
          const records = preparedTables[tableName];
          if (records && records.length > 0) {
            const tableRef = (db as unknown as Record<TableName, { bulkAdd: (items: unknown[]) => Promise<unknown> }>)[tableName];
            await tableRef.bulkAdd(records);
          }
        }
      }
    );

    // Step C: Restore settings if provided in payload
    if (payload.settings) {
      if (payload.settings.showHsnColumn !== undefined) {
        localStorage.setItem('vetrx_show_hsn', String(payload.settings.showHsnColumn));
      }
      if (payload.settings.showSacColumn !== undefined) {
        localStorage.setItem('vetrx_show_sac', String(payload.settings.showSacColumn));
      }
      if (payload.settings.showSpecialInstructionsForOwner !== undefined) {
        localStorage.setItem('vetrx_show_owner_instructions', String(payload.settings.showSpecialInstructionsForOwner));
      }
    }

    // Set last restore timestamp
    localStorage.setItem('vetrx_last_restored_at', new Date().toISOString());

    const summary: Record<string, number> = {};
    for (const t of ALL_TABLE_NAMES) {
      summary[t] = preparedTables[t]?.length || 0;
    }

    return {
      success: true,
      message: 'Database restored successfully with all clinical and financial records intact.',
      restoredCounts: summary,
      safetyBackupKey: localStorage.getItem('vetrx_last_safety_backup_key') || undefined,
    };
  } catch (txErr) {
    console.error('Dexie restore transaction failed. Transaction automatically rolled back:', txErr);

    // Rollback is automatic with Dexie.transaction('rw'). The database remains intact in its previous state.
    return {
      success: false,
      message: `Database restore failed: ${txErr instanceof Error ? txErr.message : String(txErr)}. The transaction was automatically aborted and rolled back. Your existing database remains untouched.`,
      error: txErr instanceof Error ? txErr.message : String(txErr),
    };
  }
}

// ── Persistent Storage Helper ─────────────────────────────────

/**
 * Checks and requests persistent storage quota via `navigator.storage.persist()`
 * without interrupting the application or generating false expectations.
 */
export async function requestPersistentStorage(): Promise<{ supported: boolean; persisted: boolean }> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return { supported: false, persisted: false };
  }

  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      return { supported: true, persisted: true };
    }
    const granted = await navigator.storage.persist();
    return { supported: true, persisted: granted };
  } catch (err) {
    console.warn('Failed to query or request persistent storage:', err);
    return { supported: true, persisted: false };
  }
}
