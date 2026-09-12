// =============================================================
// VetRx — shared TypeScript types
// =============================================================

// ── Practitioner & Organisation ──────────────────────────────

export interface Practitioner {
  id?: number;
  name: string;
  registrationNumber: string;
  qualifications: string;
  phone: string;
  email: string;
  address: string;
  photoDataUrl?: string; // base64 image, optional
  signatureDataUrl?: string; // base64 image, optional
  createdAt: Date;
  updatedAt: Date;
}

export interface Organisation {
  id?: number;
  name: string;
  address: string;
  state?: string;
  city?: string;
  pincode?: string;
  phone: string;
  email: string;
  registrationNumber: string; // GST / business reg
  licenseNumber?: string; // Clinic Registration / Licence Number
  logoDataUrl?: string;
  isActive?: boolean; // When false, operates as independent practitioner; data remains fully preserved
  createdAt: Date;
  updatedAt: Date;
}

// ── Owner & Patient ───────────────────────────────────────────

export interface Owner {
  id?: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Species = 'Canine' | 'Feline' | 'Avian' | 'Bovine' | 'Equine' | 'Other';
export type Sex = 'Male' | 'Female' | 'Male (Intact)' | 'Female (Intact)' | 'Unknown';

export interface Patient {
  id?: number;
  ownerId: number;
  name: string;
  species: Species;
  breed?: string;
  sex: Sex;
  dateOfBirth?: Date;
  ageNote?: string;        // free text e.g. "~3 years" when DOB unknown
  weightKg?: number;
  microchipNumber?: string;
  identificationRef?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Dosing Rules ──────────────────────────────────────────────

export type DosingMethod = 'weight_based' | 'weight_range' | 'weight_band' | 'fixed' | 'none';

export interface WeightBandRule {
  id?: string;
  minWeightKg?: number;
  maxWeightKg?: number;
  doseValue: number;
  doseUnit: string;
  label?: string; // e.g. "≤10 kg", "10–20 kg"
}

// ── Medicine ──────────────────────────────────────────────────

export interface Medicine {
  id?: number;
  brandName: string;
  genericName?: string;
  presentation: string;    // e.g. Tablet, Syrup, Injection, Drops
  strengthVolume?: string; // e.g. 500mg, 15ml
  defaultUnit?: string;    // e.g. tablets, ml, vial
  category?: string;       // e.g. Antibiotic, NSAID, Otic / Topical
  isActive?: boolean;      // defaults to true (undefined treated as active)
  notes?: string;

  // Dosing rules (deterministic, veterinarian-configured)
  dosingMethod?: DosingMethod;
  targetSpecies?: Species[];
  dosePerKg?: number;         // For 'weight_based' (e.g. 10 mg/kg)
  minDosePerKg?: number;      // For 'weight_range' (e.g. 10 mg/kg)
  maxDosePerKg?: number;      // For 'weight_range' (e.g. 20 mg/kg)
  fixedDose?: number;         // For 'fixed' (e.g. 1 tablet)
  doseUnit?: string;          // e.g. 'mg', 'ml', 'tablet', 'sachet', 'vial'
  weightBands?: WeightBandRule[]; // For 'weight_band'

  // Explicit formulation/concentration conversion
  concentrationStrength?: number; // e.g. 500 (mg)
  concentrationVolume?: number;   // e.g. 1 (tablet or ml)
  concentrationStrengthUnit?: string; // e.g. 'mg'
  concentrationVolumeUnit?: string;   // e.g. 'tablet', 'ml'

  // Default prescribing values
  defaultRoute?: string;
  defaultFrequency?: string;
  defaultDurationDays?: number;
  defaultDirections?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ── Prescription ──────────────────────────────────────────────

export type PrescriptionStatus = 'Draft' | 'Issued' | 'Cancelled';

export interface Prescription {
  id?: number;
  rxNumber: string;        // e.g. RX-2026-0892
  patientId: number;
  ownerId: number;
  practitionerId: number;
  packageId?: number;      // if created from a package
  symptoms?: string;
  diagnosis?: string;
  instructions?: string;   // owner advice / follow-up
  followUpDays?: number;
  status: PrescriptionStatus;
  issuedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrescriptionItem {
  id?: number;
  prescriptionId: number;
  medicineId?: number;
  brandName: string;       // snapshot at time of Rx
  genericName?: string;
  presentation: string;
  strengthVolume?: string;
  dose?: string;           // Final approved dose e.g. "240 mg", "1 tablet"
  quantity: number;
  unit: string;            // tablets, ml, vials …
  frequency: string;       // SID, BID, TID, q12h …
  durationDays?: number;
  route?: string;          // PO, SC, IV, Topical …
  directions?: string;
  sortOrder: number;
}

// ── Treatment Package ─────────────────────────────────────────

export interface TreatmentPackage {
  id?: number;
  name: string;
  description?: string;
  category?: string;
  species?: string;
  defaultInstructions?: string;
  protocolCode?: string;
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TreatmentPackageItem {
  id?: number;
  packageId: number;
  medicineId?: number;
  brandName: string;
  genericName?: string;
  presentation: string;
  strengthVolume?: string;
  quantity: number;
  unit: string;
  frequency: string;
  durationDays?: number;
  route?: string;
  directions?: string;
  sortOrder: number;
}

// ── Invoice ───────────────────────────────────────────────────

export type InvoiceStatus = 'Draft' | 'Issued' | 'Cancelled';

export type InvoiceItemCategory =
  | 'Medicine'
  | 'Consultation Fee'
  | 'Procedure Fee'
  | 'Lab Fee'
  | 'Travel Fee'
  | 'Other';

export interface Invoice {
  id?: number;
  invoiceNumber: string;   // e.g. INV-2026-00125
  patientId: number;
  ownerId: number;
  practitionerId: number;
  prescriptionId?: number;
  invoiceDate: Date;
  notes?: string;
  discountTotal: number;   // integer paisa
  taxTotal: number;        // integer paisa
  grandTotal: number;      // integer paisa — always backend-calculated
  status: InvoiceStatus;
  issuedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id?: number;
  invoiceId: number;
  category: InvoiceItemCategory;
  description: string;
  quantity: number;
  unitPricePaisa: number;   // integer paisa (₹1 = 100 paisa)
  discountPct: number;      // 0-100
  taxPct: number;           // 0-100 (e.g. 18 for 18% GST)
  subtotalPaisa: number;    // qty * unitPrice (before discount/tax)
  discountAmtPaisa: number;
  taxAmtPaisa: number;
  lineTotalPaisa: number;   // final line total
  sortOrder: number;
  unit?: string;            // e.g. "Per certificate", "Per report", "tablets", "btl", "visit"
  isGovPrescribed?: boolean;
  govOrderNote?: string;    // e.g. "As per the rate fixed by G.O.(Rt) No.589/2023/AHD dated 13-12-2023."
  govOrderNumber?: string;  // e.g. "G.O.(Rt) No.589/2023/AHD"
  govOrderDate?: string;    // e.g. "13-12-2023"
  rateControlled?: boolean; // locks rate from alteration during invoice creation
}

// ── Audit ─────────────────────────────────────────────────────

export type AuditEventType =
  | 'invoice_created'
  | 'invoice_item_added'
  | 'invoice_item_edited'
  | 'invoice_item_removed'
  | 'invoice_discount_changed'
  | 'invoice_tax_changed'
  | 'invoice_issued'
  | 'invoice_cancelled'
  | 'invoice_revision_created'
  | 'invoice_pdf_generated'
  | 'invoice_shared';

export interface AuditEvent {
  id?: number;
  entityType: 'Invoice' | 'Prescription';
  entityId: number;
  eventType: AuditEventType;
  detail?: string;
  practitionerId?: number;
  occurredAt: Date;
}

// ── Master Data ───────────────────────────────────────────────

export type MasterDataCategory =
  | 'species'
  | 'medicine_unit'
  | 'route'
  | 'frequency'
  | 'duration_unit'
  | 'sex'
  | 'invoice_item';

export interface MasterDataItem {
  id?: number;
  category: MasterDataCategory;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  defaultPricePaisa?: number; // integer paisa (₹1 = 100 paisa), for invoice_item
  description?: string;
  unit?: string;              // e.g. "Per certificate", "Per report", "visit", "proc"
  isGovPrescribed?: boolean;  // government fixed rate item
  govOrderNumber?: string;    // e.g. "G.O.(Rt) No.589/2023/AHD"
  govOrderDate?: string;      // e.g. "13-12-2023"
  govOrderNote?: string;      // statutory note
  rateControlled?: boolean;   // true if rate cannot be manually altered in invoice builder
  createdAt: Date;
  updatedAt: Date;
}

// ── UI helpers ────────────────────────────────────────────────

export interface NavItem {
  label: string;
  path: string;
  icon: string; // SVG path or icon name
}
