// =============================================================
// VetRx — Master Data Service & Default Seed
// =============================================================

import { db } from './schema';
import type { MasterDataCategory, MasterDataItem } from '../types';

export interface DefaultMasterItemDef {
  category: MasterDataCategory;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  defaultPricePaisa?: number;
  description?: string;
  unit?: string;
  isGovPrescribed?: boolean;
  govOrderNumber?: string;
  govOrderDate?: string;
  govOrderNote?: string;
  rateControlled?: boolean;
}

export const DEFAULT_MASTER_DATA: DefaultMasterItemDef[] = [
  // 1. Species
  { category: 'species', code: 'canine', name: 'Canine', sortOrder: 1, isActive: true },
  { category: 'species', code: 'feline', name: 'Feline', sortOrder: 2, isActive: true },
  { category: 'species', code: 'avian', name: 'Avian', sortOrder: 3, isActive: true },
  { category: 'species', code: 'bovine', name: 'Bovine', sortOrder: 4, isActive: true },
  { category: 'species', code: 'equine', name: 'Equine', sortOrder: 5, isActive: true },
  { category: 'species', code: 'other', name: 'Other', sortOrder: 6, isActive: true },

  // 2. Medicine Units
  { category: 'medicine_unit', code: 'tablet', name: 'tablet', sortOrder: 1, isActive: true },
  { category: 'medicine_unit', code: 'capsule', name: 'capsule', sortOrder: 2, isActive: true },
  { category: 'medicine_unit', code: 'ml', name: 'mL', sortOrder: 3, isActive: true },
  { category: 'medicine_unit', code: 'l', name: 'L', sortOrder: 4, isActive: true },
  { category: 'medicine_unit', code: 'mg', name: 'mg', sortOrder: 5, isActive: true },
  { category: 'medicine_unit', code: 'g', name: 'g', sortOrder: 6, isActive: true },
  { category: 'medicine_unit', code: 'mcg', name: 'mcg', sortOrder: 7, isActive: true },
  { category: 'medicine_unit', code: 'iu', name: 'IU', sortOrder: 8, isActive: true },
  { category: 'medicine_unit', code: 'vial', name: 'vial', sortOrder: 9, isActive: true },
  { category: 'medicine_unit', code: 'ampoule', name: 'ampoule', sortOrder: 10, isActive: true },
  { category: 'medicine_unit', code: 'bottle', name: 'bottle', sortOrder: 11, isActive: true },
  { category: 'medicine_unit', code: 'sachet', name: 'sachet', sortOrder: 12, isActive: true },
  { category: 'medicine_unit', code: 'drop', name: 'drop', sortOrder: 13, isActive: true },
  { category: 'medicine_unit', code: 'tube', name: 'tube', sortOrder: 14, isActive: true },
  { category: 'medicine_unit', code: 'bolus_boli', name: 'bolus/boli', sortOrder: 15, isActive: true },
  { category: 'medicine_unit', code: 'pipette', name: 'pipette', sortOrder: 16, isActive: true },
  { category: 'medicine_unit', code: 'pack', name: 'pack', sortOrder: 17, isActive: true },
  { category: 'medicine_unit', code: 'tablets', name: 'tablets', sortOrder: 18, isActive: true },
  { category: 'medicine_unit', code: 'capsules', name: 'capsules', sortOrder: 19, isActive: true },
  { category: 'medicine_unit', code: 'drops', name: 'drops', sortOrder: 20, isActive: true },
  { category: 'medicine_unit', code: 'vials', name: 'vials', sortOrder: 21, isActive: true },
  { category: 'medicine_unit', code: 'sachets', name: 'sachets', sortOrder: 22, isActive: true },

  // 3. Routes
  { category: 'route', code: 'po_oral', name: 'PO (Oral)', sortOrder: 1, isActive: true },
  { category: 'route', code: 'topical', name: 'Topical', sortOrder: 2, isActive: true },
  { category: 'route', code: 'otic', name: 'Otic', sortOrder: 3, isActive: true },
  { category: 'route', code: 'ophthalmic', name: 'Ophthalmic', sortOrder: 4, isActive: true },
  { category: 'route', code: 'sc_subcut', name: 'SC (Subcutaneous)', sortOrder: 5, isActive: true },
  { category: 'route', code: 'im_intramusc', name: 'IM (Intramuscular)', sortOrder: 6, isActive: true },
  { category: 'route', code: 'iv_intrav', name: 'IV (Intravenous)', sortOrder: 7, isActive: true },

  // 4. Frequencies
  { category: 'frequency', code: 'sid', name: 'SID (q24h / Once daily)', sortOrder: 1, isActive: true },
  { category: 'frequency', code: 'bid', name: 'BID (q12h / Twice daily)', sortOrder: 2, isActive: true },
  { category: 'frequency', code: 'tid', name: 'TID (q8h / 3x daily)', sortOrder: 3, isActive: true },
  { category: 'frequency', code: 'qid', name: 'QID (q6h / 4x daily)', sortOrder: 4, isActive: true },
  { category: 'frequency', code: 'prn', name: 'PRN (As needed)', sortOrder: 5, isActive: true },
  { category: 'frequency', code: 'once', name: 'Once', sortOrder: 6, isActive: true },

  // 5. Duration Units
  { category: 'duration_unit', code: 'days', name: 'Days', sortOrder: 1, isActive: true },
  { category: 'duration_unit', code: 'weeks', name: 'Weeks', sortOrder: 2, isActive: true },
  { category: 'duration_unit', code: 'months', name: 'Months', sortOrder: 3, isActive: true },
  { category: 'duration_unit', code: 'doses', name: 'Doses', sortOrder: 4, isActive: true },

  // 6. Sex
  { category: 'sex', code: 'male', name: 'Male', sortOrder: 1, isActive: true },
  { category: 'sex', code: 'female', name: 'Female', sortOrder: 2, isActive: true },
  { category: 'sex', code: 'male_intact', name: 'Male (Intact)', sortOrder: 3, isActive: true },
  { category: 'sex', code: 'female_intact', name: 'Female (Intact)', sortOrder: 4, isActive: true },
  { category: 'sex', code: 'neutered_male', name: 'Neutered Male', sortOrder: 5, isActive: true },
  { category: 'sex', code: 'spayed_female', name: 'Spayed Female', sortOrder: 6, isActive: true },
  { category: 'sex', code: 'unknown', name: 'Unknown', sortOrder: 7, isActive: true },

  // 7. Invoice Items & Government-Prescribed Rates
  {
    category: 'invoice_item',
    code: 'cert_issuance',
    name: 'Certificate Issuance',
    defaultPricePaisa: 25000, // ₹250.00
    sortOrder: 1,
    isActive: true,
    description: 'Covers: Insurance Certificate / Valuation Certificate / Health Certificate / etc.',
    unit: 'Per certificate',
    isGovPrescribed: true,
    govOrderNumber: 'G.O.(Rt) No.589/2023/AHD',
    govOrderDate: '13-12-2023',
    govOrderNote: 'As per the rate fixed by G.O.(Rt) No.589/2023/AHD dated 13-12-2023',
    rateControlled: true,
  },
  {
    category: 'invoice_item',
    code: 'necropsy_report',
    name: 'Necropsy Report',
    defaultPricePaisa: 100000, // ₹1,000.00
    sortOrder: 2,
    isActive: true,
    description: 'Post-mortem examination & official necropsy report',
    unit: 'Per report',
    isGovPrescribed: true,
    govOrderNumber: 'G.O.(Rt) No.589/2023/AHD',
    govOrderDate: '13-12-2023',
    govOrderNote: 'As per the rate fixed by G.O.(Rt) No.589/2023/AHD dated 13-12-2023',
    rateControlled: true,
  },
  {
    category: 'invoice_item',
    code: 'consult_fee',
    name: 'General Consultation Fee',
    defaultPricePaisa: 50000, // ₹500.00
    sortOrder: 3,
    isActive: true,
    description: 'Standard outpatient examination & triage',
    unit: 'visit',
  },
  {
    category: 'invoice_item',
    code: 'followup_consult',
    name: 'Follow-up Consultation',
    defaultPricePaisa: 30000, // ₹300.00
    sortOrder: 4,
    isActive: true,
    description: 'Re-evaluation within 14 days',
    unit: 'visit',
  },
  {
    category: 'invoice_item',
    code: 'wound_dressing',
    name: 'Wound Dressing & Bandaging',
    defaultPricePaisa: 45000, // ₹450.00
    sortOrder: 5,
    isActive: true,
    description: 'Debridement, topical antiseptic, protective bandage',
    unit: 'proc',
  },
  {
    category: 'invoice_item',
    code: 'ear_flushing',
    name: 'Ear Cleaning & Flushing',
    defaultPricePaisa: 60000, // ₹600.00
    sortOrder: 6,
    isActive: true,
    description: 'Cerumen removal & antimicrobial flush',
    unit: 'proc',
  },
  {
    category: 'invoice_item',
    code: 'minor_procedure',
    name: 'Minor Surgical Procedure',
    defaultPricePaisa: 150000, // ₹1,500.00
    sortOrder: 7,
    isActive: true,
    description: 'Abscess drainage, suture removal, laceration closure',
    unit: 'proc',
  },
  {
    category: 'invoice_item',
    code: 'vaccine_admin',
    name: 'Vaccination Administration',
    defaultPricePaisa: 25000, // ₹250.00
    sortOrder: 8,
    isActive: true,
    description: 'Standard injection fee (excluding vaccine vial)',
    unit: 'dose',
  },
  {
    category: 'invoice_item',
    code: 'blood_panel',
    name: 'Laboratory Blood Panel',
    defaultPricePaisa: 120000, // ₹1,200.00
    sortOrder: 9,
    isActive: true,
    description: 'Complete blood count & basic biochemistry',
    unit: 'test',
  },

  // 8. Invoice Units
  { category: 'invoice_unit', code: 'per_unit', name: 'Per unit', sortOrder: 1, isActive: true },
  { category: 'invoice_unit', code: 'per_consultation', name: 'Per consultation', sortOrder: 2, isActive: true },
  { category: 'invoice_unit', code: 'per_certificate', name: 'Per certificate', sortOrder: 3, isActive: true },
  { category: 'invoice_unit', code: 'per_report', name: 'Per report', sortOrder: 4, isActive: true },
  { category: 'invoice_unit', code: 'per_procedure', name: 'Per procedure', sortOrder: 5, isActive: true },
  { category: 'invoice_unit', code: 'per_visit', name: 'Per visit', sortOrder: 6, isActive: true },
  { category: 'invoice_unit', code: 'per_dose', name: 'Per dose', sortOrder: 7, isActive: true },
  { category: 'invoice_unit', code: 'per_vial', name: 'Per vial', sortOrder: 8, isActive: true },
  { category: 'invoice_unit', code: 'per_tablet', name: 'Per tablet', sortOrder: 9, isActive: true },
  { category: 'invoice_unit', code: 'per_strip', name: 'Per strip', sortOrder: 10, isActive: true },
  { category: 'invoice_unit', code: 'per_bottle', name: 'Per bottle', sortOrder: 11, isActive: true },
  { category: 'invoice_unit', code: 'per_test', name: 'Per test', sortOrder: 12, isActive: true },
  { category: 'invoice_unit', code: 'per_session', name: 'Per session', sortOrder: 13, isActive: true },
  { category: 'invoice_unit', code: 'other', name: 'Other', sortOrder: 14, isActive: true },
];

export const MASTER_DATA_CATEGORIES: { id: MasterDataCategory; label: string; description: string; icon: string }[] = [
  { id: 'species', label: 'Species', description: 'Animal species options for patient registration & protocols', icon: 'pets' },
  { id: 'medicine_unit', label: 'Medicine Units', description: 'Formulary dispense & dosage units (tablets, ml, vials)', icon: 'pill' },
  { id: 'route', label: 'Routes', description: 'Administration methods for prescriptions & protocols', icon: 'syringe' },
  { id: 'frequency', label: 'Frequencies', description: 'Posology dosing intervals (SID, BID, TID, Once)', icon: 'clock' },
  { id: 'duration_unit', label: 'Duration Units', description: 'Treatment duration unit options (Days, Weeks, Months)', icon: 'calendar' },
  { id: 'sex', label: 'Sex', description: 'Biological sex and reproductive status options for patients', icon: 'dna' },
  { id: 'invoice_item', label: 'Invoice Items / Government Rates', description: 'Catalog items, services & government-prescribed rates (G.O.)', icon: 'receipt_long' },
  { id: 'invoice_unit', label: 'Invoice Item Units', description: 'Configurable billing units for invoice line items', icon: 'tag' },
];

/**
 * Initializes default master data in Dexie if table is empty,
 * and ensures government-prescribed items exist for existing databases.
 */
export async function ensureMasterDataSeeded(): Promise<void> {
  try {
    const count = await db.masterDataItems.count();
    const now = new Date();

    if (count === 0) {
      const itemsToInsert: Omit<MasterDataItem, 'id'>[] = DEFAULT_MASTER_DATA.map((item) => ({
        ...item,
        createdAt: now,
        updatedAt: now,
      }));

      await db.masterDataItems.bulkAdd(itemsToInsert as MasterDataItem[]);
      return;
    }

    // Migrate legacy 'Others' to 'Other' if present in Dexie
    const existingOthers = await db.masterDataItems
      .where('category')
      .equals('species')
      .and((i) => i.name === 'Others')
      .first();
    if (existingOthers) {
      await db.masterDataItems.update(existingOthers.id!, {
        name: 'Other',
        code: 'other',
        updatedAt: now,
      });
    }

    // Ensure Government Prescribed items exist even in pre-existing databases
    for (const govItem of DEFAULT_MASTER_DATA.filter((i) => i.isGovPrescribed)) {
      const existing = await db.masterDataItems
        .where('category')
        .equals('invoice_item')
        .and((i) => i.code === govItem.code)
        .first();

      if (!existing) {
        await db.masterDataItems.add({
          ...govItem,
          createdAt: now,
          updatedAt: now,
        } as MasterDataItem);
      } else {
        await db.masterDataItems.update(existing.id!, {
          isGovPrescribed: true,
          rateControlled: true,
          govOrderNumber: govItem.govOrderNumber,
          govOrderDate: govItem.govOrderDate,
          govOrderNote: govItem.govOrderNote,
          unit: existing.unit || govItem.unit,
          defaultPricePaisa: existing.defaultPricePaisa || govItem.defaultPricePaisa,
          updatedAt: now,
        });
      }
    }

    // Ensure standard medicine units (including bolus/boli, tablet, etc.) exist in pre-existing databases
    for (const unitItem of DEFAULT_MASTER_DATA.filter((i) => i.category === 'medicine_unit')) {
      const existing = await db.masterDataItems
        .where('category')
        .equals('medicine_unit')
        .and((i) => i.name.toLowerCase() === unitItem.name.toLowerCase())
        .first();

      if (!existing) {
        await db.masterDataItems.add({
          ...unitItem,
          createdAt: now,
          updatedAt: now,
        } as MasterDataItem);
      }
    }

    // Ensure invoice units exist in pre-existing databases
    for (const unitItem of DEFAULT_MASTER_DATA.filter((i) => i.category === 'invoice_unit')) {
      const existing = await db.masterDataItems
        .where('category')
        .equals('invoice_unit')
        .and((i) => i.name.toLowerCase() === unitItem.name.toLowerCase())
        .first();

      if (!existing) {
        await db.masterDataItems.add({
          ...unitItem,
          createdAt: now,
          updatedAt: now,
        } as MasterDataItem);
      }
    }

    // Ensure sex category items are deduplicated on code/name in Dexie
    const sexItems = await db.masterDataItems.where('category').equals('sex').toArray();
    const seenSex = new Set<string>();
    for (const item of sexItems) {
      const key = item.name.toLowerCase().trim();
      if (seenSex.has(key)) {
        await db.masterDataItems.delete(item.id!);
      } else {
        seenSex.add(key);
      }
    }
  } catch (err) {
    console.error('Failed to ensure master data seeded:', err);
  }
}

/**
 * Fetch items for a category ordered by sortOrder.
 */
export async function getMasterData(category: MasterDataCategory, activeOnly = false): Promise<MasterDataItem[]> {
  try {
    let query = db.masterDataItems.where('category').equals(category);
    if (activeOnly) {
      const items = await query.and((item) => item.isActive).sortBy('sortOrder');
      return items;
    }
    return await query.sortBy('sortOrder');
  } catch (err) {
    console.error(`Failed to fetch master data for ${category}:`, err);
    return [];
  }
}

/**
 * Add a new master data item.
 */
export async function addMasterDataItem(
  item: Omit<MasterDataItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const now = new Date();
  const id = await db.masterDataItems.add({
    ...item,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

/**
 * Update an existing master data item.
 */
export async function updateMasterDataItem(
  id: number,
  updates: Partial<Omit<MasterDataItem, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await db.masterDataItems.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

/**
 * Toggle active state.
 */
export async function toggleMasterDataItemActive(id: number, isActive: boolean): Promise<void> {
  await db.masterDataItems.update(id, {
    isActive,
    updatedAt: new Date(),
  });
}

/**
 * Reorder items in a category.
 */
export async function reorderMasterDataItems(orderedIds: number[]): Promise<void> {
  const now = new Date();
  await db.transaction('rw', db.masterDataItems, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.masterDataItems.update(orderedIds[i], {
        sortOrder: i + 1,
        updatedAt: now,
      });
    }
  });
}

/**
 * Check if a master data item is currently referenced in existing data.
 */
export async function isMasterDataInUse(item: MasterDataItem): Promise<{ inUse: boolean; reason?: string }> {
  if (item.category === 'species') {
    const count = await db.patients.where('species').equals(item.name as any).count();
    if (count > 0) {
      return { inUse: true, reason: `Referenced by ${count} patient record(s).` };
    }
  }

  if (item.category === 'sex') {
    const count = await db.patients.where('sex').equals(item.name as any).count();
    if (count > 0) {
      return { inUse: true, reason: `Referenced by ${count} patient record(s).` };
    }
  }

  if (item.category === 'route') {
    const rxCount = await db.prescriptionItems.filter((p) => p.route === item.name).count();
    const pkgCount = await db.treatmentPackageItems.filter((p) => p.route === item.name).count();
    if (rxCount + pkgCount > 0) {
      return { inUse: true, reason: `Referenced by ${rxCount} prescription items and ${pkgCount} treatment package items.` };
    }
  }

  if (item.category === 'frequency') {
    const rxCount = await db.prescriptionItems.filter((p) => p.frequency === item.name || (item.name.includes(p.frequency))).count();
    const pkgCount = await db.treatmentPackageItems.filter((p) => p.frequency === item.name || (item.name.includes(p.frequency))).count();
    if (rxCount + pkgCount > 0) {
      return { inUse: true, reason: `Referenced by ${rxCount} prescription items and ${pkgCount} treatment package items.` };
    }
  }

  if (item.category === 'medicine_unit') {
    const rxCount = await db.prescriptionItems.filter((p) => p.unit === item.name).count();
    const pkgCount = await db.treatmentPackageItems.filter((p) => p.unit === item.name).count();
    if (rxCount + pkgCount > 0) {
      return { inUse: true, reason: `Referenced by ${rxCount} prescription items and ${pkgCount} treatment package items.` };
    }
  }

  if (item.category === 'invoice_item') {
    const count = await db.invoiceItems.filter((i) => i.description.toLowerCase().includes(item.name.toLowerCase())).count();
    if (count > 0) {
      return { inUse: true, reason: `Referenced by ${count} invoice item(s).` };
    }
  }

  return { inUse: false };
}

/**
 * Delete an item only if not in use. Otherwise throws error.
 */
export async function deleteMasterDataItem(id: number): Promise<void> {
  const item = await db.masterDataItems.get(id);
  if (!item) return;

  const usage = await isMasterDataInUse(item);
  if (usage.inUse) {
    throw new Error(`Cannot delete: ${usage.reason} Please deactivate this option instead.`);
  }

  await db.masterDataItems.delete(id);
}
