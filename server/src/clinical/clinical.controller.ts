import { Router } from 'express';
import { z } from 'zod';
import { ClinicalService } from './clinical.service.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePractice } from '../middleware/tenant.js';
import { AppError } from '../middleware/errorHandler.js';
import { EntitlementService } from '../commercial/entitlement.service.js';
import { requirePracticePermission } from '../middleware/authorization.js';
import { PERMISSIONS } from '../auth/permissions.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const clinicalRouter = Router();

// Enforce strict authentication and practice derivation for all clinical endpoints
clinicalRouter.use(requireAuth, requirePractice);

// Helper to assert tenant context
function getPracticeId(req: AuthenticatedRequest): string {
  if (!req.practice?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Tenant practice context required.');
  }
  return req.practice.id;
}

function getId(req: AuthenticatedRequest): string {
  const id = req.params.id;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing resource ID.');
  }
  return Array.isArray(id) ? id[0] : id;
}

// ------------------------------------------------------------------------------
// 0. Dashboard Performance & Aggregates Summary
// ------------------------------------------------------------------------------
const handleDashboardSummary = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const practiceId = getPracticeId(req);
    const clinicianUserId = req.query.clinicianUserId as string | undefined;
    const summary = await ClinicalService.getDashboardSummary(practiceId, clinicianUserId);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
};

clinicalRouter.get('/dashboard-summary', handleDashboardSummary);
clinicalRouter.get('/clinical/dashboard-summary', handleDashboardSummary);

// ------------------------------------------------------------------------------
// 1. Owners Router
// ------------------------------------------------------------------------------
const createOwnerSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(1).max(30),
  email: z.string().email().nullable().optional().or(z.literal('')),
  address: z.string().max(300).nullable().optional(),
});

clinicalRouter.get('/owners', requirePracticePermission(PERMISSIONS.OWNER_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const owners = await ClinicalService.listOwners(practiceId, search);
    res.status(200).json(owners);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/owners/:id', requirePracticePermission(PERMISSIONS.OWNER_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const owner = await ClinicalService.getOwnerById(getId(req), practiceId);
    res.status(200).json(owner);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/owners', requirePracticePermission(PERMISSIONS.OWNER_CREATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createOwnerSchema.parse(req.body);
    const owner = await ClinicalService.createOwner(practiceId, {
      ...data,
      email: data.email === '' ? null : data.email,
    }, req.user?.id);
    res.status(201).json(owner);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/owners/:id', requirePracticePermission(PERMISSIONS.OWNER_UPDATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createOwnerSchema.partial().parse(req.body);
    const updated = await ClinicalService.updateOwner(getId(req), practiceId, {
      ...data,
      email: data.email === '' ? null : data.email,
    }, req.user?.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/owners/:id/link-phone', requirePracticePermission(PERMISSIONS.OWNER_UPDATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const linkSchema = z.object({
      phone: z.string().min(1).max(30),
    });
    const { phone } = linkSchema.parse(req.body);
    const updated = await ClinicalService.linkAlternatePhone(getId(req), practiceId, phone, req.user?.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/owners/:id', requirePracticePermission(PERMISSIONS.OWNER_DELETE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deleteOwner(getId(req), practiceId, req.user?.id);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 2. Patients Router
// ------------------------------------------------------------------------------
const patientBaseSchema = z.object({
  ownerId: z.string().uuid(),
  name: z.string().min(1).max(120),
  species: z.string().min(1).max(60),
  breed: z.string().max(80).nullable().optional(),
  sex: z.string().max(20).nullable().optional(),
  ageYears: z.number().int().min(0).max(100).nullable().optional(),
  ageMonths: z.number().int().min(0).max(11).nullable().optional(),
  weightKg: z.union([z.number(), z.string()]).nullable().optional().transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const num = Number(v);
    return isNaN(num) ? null : num;
  }),
  identification: z.string().max(100).nullable().optional(),
  microchipNumber: z.string().max(100).nullable().optional(),
  identificationRef: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  ageNote: z.string().max(1000).nullable().optional(),
});

const createPatientSchema = patientBaseSchema.transform((d) => ({
  ownerId: d.ownerId,
  name: d.name.trim(),
  species: d.species.trim(),
  breed: d.breed?.trim() || null,
  sex: d.sex?.trim() || null,
  ageYears: d.ageYears ?? null,
  ageMonths: d.ageMonths ?? null,
  weightKg: d.weightKg ?? null,
  identification: (d.identification || d.microchipNumber || d.identificationRef)?.trim() || null,
  notes: [d.ageNote?.trim(), d.notes?.trim()].filter(Boolean).join(' | ') || null,
}));

const updatePatientSchema = patientBaseSchema.partial().transform((d) => ({
  ownerId: d.ownerId,
  name: d.name ? d.name.trim() : undefined,
  species: d.species ? d.species.trim() : undefined,
  breed: d.breed !== undefined ? (d.breed ? d.breed.trim() : null) : undefined,
  sex: d.sex !== undefined ? (d.sex ? d.sex.trim() : null) : undefined,
  ageYears: d.ageYears !== undefined ? d.ageYears : undefined,
  ageMonths: d.ageMonths !== undefined ? d.ageMonths : undefined,
  weightKg: d.weightKg !== undefined ? d.weightKg : undefined,
  identification: (d.identification || d.microchipNumber || d.identificationRef) !== undefined ? ((d.identification || d.microchipNumber || d.identificationRef)?.trim() || null) : undefined,
  notes: (d.ageNote !== undefined || d.notes !== undefined) ? ([d.ageNote?.trim(), d.notes?.trim()].filter(Boolean).join(' | ') || null) : undefined,
}));

clinicalRouter.get('/patients', requirePracticePermission(PERMISSIONS.PATIENT_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const patients = await ClinicalService.listPatients(practiceId, search);
    res.status(200).json(patients);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/patients/:id', requirePracticePermission(PERMISSIONS.PATIENT_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const patient = await ClinicalService.getPatientById(getId(req), practiceId);
    res.status(200).json(patient);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/patients', requirePracticePermission(PERMISSIONS.PATIENT_CREATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    await EntitlementService.assertCanCreatePatient(practiceId);
    const data = createPatientSchema.parse(req.body);
    const patient = await ClinicalService.createPatient(practiceId, data, req.user?.id);
    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/patients/:id', requirePracticePermission(PERMISSIONS.PATIENT_UPDATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = updatePatientSchema.parse(req.body);
    const updated = await ClinicalService.updatePatient(getId(req), practiceId, data, req.user?.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/patients/:id', requirePracticePermission(PERMISSIONS.PATIENT_DELETE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deletePatient(getId(req), practiceId, req.user?.id);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 3. Medicines Router
// ------------------------------------------------------------------------------
const medicineBaseSchema = z.object({
  name: z.string().max(150).optional(),
  brandName: z.string().max(150).optional(),
  genericName: z.string().max(150).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  form: z.string().max(50).nullable().optional(),
  presentation: z.string().max(50).nullable().optional(),
  strength: z.string().max(80).nullable().optional(),
  strengthVolume: z.string().max(80).nullable().optional(),
  unitPrice: z.number().min(0).optional(),
  defaultDosageInstructions: z.string().max(1000).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

const createMedicineSchema = medicineBaseSchema.transform((d) => ({
  name: (d.name || d.brandName || 'Medicine').trim(),
  genericName: d.genericName?.trim() || null,
  category: d.category?.trim() || null,
  form: (d.form || d.presentation || 'Tablet').trim(),
  strength: (d.strength || d.strengthVolume)?.trim() || null,
  unitPrice: d.unitPrice ?? 0,
  defaultDosageInstructions: (d.defaultDosageInstructions || d.notes)?.trim() || null,
  isActive: d.isActive ?? true,
}));

const updateMedicineSchema = medicineBaseSchema.partial().transform((d) => ({
  name: (d.name || d.brandName) ? (d.name || d.brandName)!.trim() : undefined,
  genericName: d.genericName !== undefined ? (d.genericName ? d.genericName.trim() : null) : undefined,
  category: d.category !== undefined ? (d.category ? d.category.trim() : null) : undefined,
  form: (d.form || d.presentation) ? (d.form || d.presentation)!.trim() : undefined,
  strength: (d.strength || d.strengthVolume) !== undefined ? ((d.strength || d.strengthVolume)?.trim() || null) : undefined,
  unitPrice: d.unitPrice !== undefined ? d.unitPrice : undefined,
  defaultDosageInstructions: (d.defaultDosageInstructions || d.notes) !== undefined ? ((d.defaultDosageInstructions || d.notes)?.trim() || null) : undefined,
  isActive: d.isActive !== undefined ? d.isActive : undefined,
}));

clinicalRouter.get('/medicines', requirePracticePermission(PERMISSIONS.MEDICINE_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const medicines = await ClinicalService.listMedicines(practiceId, search);
    res.status(200).json(medicines);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/medicines/:id', requirePracticePermission(PERMISSIONS.MEDICINE_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const medicine = await ClinicalService.getMedicineById(getId(req), practiceId);
    res.status(200).json(medicine);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/medicines', requirePracticePermission(PERMISSIONS.MEDICINE_CREATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    await EntitlementService.assertCanAddMedicine(practiceId);
    const data = createMedicineSchema.parse(req.body);
    const medicine = await ClinicalService.createMedicine(practiceId, data, req.user?.id);
    res.status(201).json(medicine);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/medicines/:id', requirePracticePermission(PERMISSIONS.MEDICINE_UPDATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = updateMedicineSchema.parse(req.body);
    const updated = await ClinicalService.updateMedicine(getId(req), practiceId, data, req.user?.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/medicines/:id', requirePracticePermission(PERMISSIONS.MEDICINE_DELETE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deleteMedicine(getId(req), practiceId, req.user?.id);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 4. Treatment Packages Router
// ------------------------------------------------------------------------------
const packageBaseSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(500).nullable().optional(),
  totalPrice: z.number().min(0).optional(),
  category: z.string().max(80).optional(),
  targetSpecies: z.array(z.string()).optional(),
  items: z.array(z.any()).optional(),
  itemsJson: z.any().optional(),
  isActive: z.boolean().optional(),
});

const createPackageSchema = packageBaseSchema.transform((d) => ({
  name: d.name.trim(),
  description: d.description?.trim() || null,
  totalPrice: d.totalPrice ?? 0,
  itemsJson: d.itemsJson ?? d.items ?? [],
}));

const updatePackageSchema = packageBaseSchema.partial().transform((d) => ({
  name: d.name ? d.name.trim() : undefined,
  description: d.description !== undefined ? (d.description ? d.description.trim() : null) : undefined,
  totalPrice: d.totalPrice !== undefined ? d.totalPrice : undefined,
  itemsJson: (d.itemsJson !== undefined || d.items !== undefined) ? (d.itemsJson ?? d.items ?? []) : undefined,
}));

clinicalRouter.get('/packages', requirePracticePermission(PERMISSIONS.PACKAGE_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const packages = await ClinicalService.listPackages(practiceId);
    res.status(200).json(packages);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/packages/:id', requirePracticePermission(PERMISSIONS.PACKAGE_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const pkg = await ClinicalService.getPackageById(getId(req), practiceId);
    res.status(200).json(pkg);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/packages', requirePracticePermission(PERMISSIONS.PACKAGE_CREATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    await EntitlementService.assertCanCreatePackage(practiceId);
    const data = createPackageSchema.parse(req.body);
    const pkg = await ClinicalService.createPackage(practiceId, data, req.user?.id);
    res.status(201).json(pkg);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/packages/:id', requirePracticePermission(PERMISSIONS.PACKAGE_UPDATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = updatePackageSchema.parse(req.body);
    const updated = await ClinicalService.updatePackage(getId(req), practiceId, data, req.user?.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/packages/:id', requirePracticePermission(PERMISSIONS.PACKAGE_DELETE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deletePackage(getId(req), practiceId, req.user?.id);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 5. Prescriptions Router
// ------------------------------------------------------------------------------
const createPrescriptionSchema = z.object({
  patientId: z.string().min(1),
  rxNumber: z.string().min(1).max(50).optional(),
  diagnosis: z.string().max(300).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.string().max(50).optional(),
  forwardedToUserId: z.string().min(1).nullable().optional(),
  targetUserId: z.string().min(1).nullable().optional(),
  targetMemberId: z.string().min(1).nullable().optional(),
  forwardingRemarks: z.string().max(1000).nullable().optional(),
  visitId: z.string().nullable().optional(),
  visitCaseId: z.string().nullable().optional(),
  items: z.array(
    z.object({
      medicineId: z.string().nullable().optional().transform((v) => (v && v.includes('-') && v.length >= 32 ? v : null)),
      medicineName: z.string().max(150).optional(),
      brandName: z.string().max(150).optional(),
      dosage: z.string().max(80).optional(),
      dose: z.union([z.string(), z.number()]).optional().transform((v) => (v !== undefined && v !== null ? String(v) : undefined)),
      doseUnit: z.string().max(30).optional(),
      frequency: z.string().max(80).optional(),
      durationDays: z.number().int().min(1).optional(),
      totalQuantity: z.number().min(0).optional(),
      quantity: z.number().min(0).optional(),
      quantityUnit: z.string().max(30).nullable().optional(),
      unit: z.string().max(30).nullable().optional(),
      instructions: z.string().max(500).nullable().optional(),
      directions: z.string().max(500).nullable().optional(),
    }).transform((itm) => ({
      medicineId: itm.medicineId || null,
      medicineName: (itm.medicineName || itm.brandName || 'Medicine').trim(),
      dosage: (itm.dosage || (itm.dose ? `${itm.dose} ${itm.doseUnit || ''}`.trim() : 'As directed')).trim(),
      frequency: (itm.frequency || 'OD').trim(),
      durationDays: itm.durationDays ?? 1,
      totalQuantity: itm.totalQuantity ?? itm.quantity ?? 1,
      quantityUnit: itm.quantityUnit || itm.unit || null,
      instructions: itm.instructions || itm.directions || null,
    }))
  ).min(1),
});

clinicalRouter.get(
  '/prescriptions/eligible-clinicians',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_VIEW),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const clinicians = await ClinicalService.getEligibleClinicians(practiceId);
      res.status(200).json(clinicians);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.get(
  '/prescriptions/pending-approvals-count',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_VIEW),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const clinicianUserId = req.query.clinicianUserId as string | undefined;
      const result = await ClinicalService.getPendingApprovalsCount(practiceId, clinicianUserId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.get(
  '/prescriptions',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_VIEW),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const forwardedToUserId = req.query.forwardedToUserId as string | undefined;
      const rxList = await ClinicalService.listPrescriptions(practiceId, { search, status, forwardedToUserId });
      res.status(200).json(rxList);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.get(
  '/prescriptions/:id',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_VIEW),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const rx = await ClinicalService.getPrescriptionById(getId(req), practiceId);
      res.status(200).json(rx);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.post(
  '/prescriptions',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_CREATE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const data = createPrescriptionSchema.parse(req.body);
      await EntitlementService.assertCanCreateRecord(practiceId, data.patientId);
      const rx = await ClinicalService.createPrescription(practiceId, data, req.user?.id);
      res.status(201).json(rx);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.patch(
  '/prescriptions/:id',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_UPDATE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const data = z.object({
        diagnosis: z.string().max(300).nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
        status: z.string().max(50).optional(),
        items: z.array(
          z.object({
            medicineId: z.string().uuid().nullable().optional(),
            medicineName: z.string().min(1).max(150),
            dosage: z.string().min(1).max(80),
            frequency: z.string().min(1).max(80),
            durationDays: z.number().int().min(1).optional(),
            totalQuantity: z.number().min(0).optional(),
            quantityUnit: z.string().max(30).nullable().optional(),
            instructions: z.string().max(500).nullable().optional(),
          })
        ).optional(),
      }).parse(req.body);
      const updated = await ClinicalService.updatePrescription(getId(req), practiceId, data, req.user?.id);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.post(
  '/prescriptions/:id/forward',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const body = z.object({
        forwardedToUserId: z.string().min(1).optional().nullable(),
        targetUserId: z.string().min(1).optional().nullable(),
        targetMemberId: z.string().min(1).optional().nullable(),
        forwardingRemarks: z.string().max(1000).nullable().optional(),
      }).parse(req.body);
      const updated = await ClinicalService.forwardPrescription(getId(req), practiceId, req.user!.id, body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.post(
  '/prescriptions/:id/approve',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_APPROVE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const body = z.object({
        approvalRemarks: z.string().max(1000).nullable().optional(),
      }).optional().parse(req.body);
      const updated = await ClinicalService.approvePrescription(getId(req), practiceId, req.user!.id, body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.post(
  '/prescriptions/:id/request-changes',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const body = z.object({
        changeRequestRemarks: z.string().min(1).max(1000),
      }).parse(req.body);
      const updated = await ClinicalService.requestChangesPrescription(getId(req), practiceId, req.user!.id, body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.post(
  '/prescriptions/:id/revise',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_CREATE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const revised = await ClinicalService.revisePrescription(getId(req), practiceId, req.user!.id);
      res.status(200).json(revised);
    } catch (err) {
      next(err);
    }
  }
);

clinicalRouter.delete(
  '/prescriptions/:id',
  requirePracticePermission(PERMISSIONS.PRESCRIPTION_DELETE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const deleted = await ClinicalService.deletePrescription(getId(req), practiceId);
      res.status(200).json(deleted);
    } catch (err) {
      next(err);
    }
  }
);

// ------------------------------------------------------------------------------
// 6. Invoices Router
// ------------------------------------------------------------------------------
const createInvoiceSchema = z.object({
  patientId: z.string().nullable().optional().transform((v) => (v && v.includes('-') && v.length >= 32 ? v : null)),
  invoiceNumber: z.string().min(1).max(50),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0),
  status: z.enum(['Draft', 'Issued', 'Cancelled']).optional(),
  items: z.array(
    z.object({
      prescriptionId: z.string().nullable().optional().transform((v) => (v && v.includes('-') && v.length >= 32 ? v : null)),
      description: z.string().min(1).max(200),
      category: z.string().max(50).optional(),
      unitPrice: z.number().min(0),
      quantity: z.number().min(0).optional(),
      totalPrice: z.number().min(0),
    })
  ).min(1),
});

clinicalRouter.get('/invoices', requirePracticePermission(PERMISSIONS.INVOICE_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const invoices = await ClinicalService.listInvoices(practiceId, search);
    res.status(200).json(invoices);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/invoices/:id', requirePracticePermission(PERMISSIONS.INVOICE_VIEW), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const invoice = await ClinicalService.getInvoiceById(getId(req), practiceId);
    res.status(200).json(invoice);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/invoices', requirePracticePermission(PERMISSIONS.INVOICE_CREATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createInvoiceSchema.parse(req.body);
    if (data.patientId) {
      await EntitlementService.assertCanCreateRecord(practiceId, data.patientId);
    }
    const invoice = await ClinicalService.createInvoice(practiceId, data, req.user?.id);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/invoices/:id', requirePracticePermission(PERMISSIONS.INVOICE_UPDATE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = z.object({
      status: z.enum(['Draft', 'Issued', 'Cancelled']).optional(),
      subtotal: z.number().min(0).optional(),
      taxAmount: z.number().min(0).optional(),
      discountAmount: z.number().min(0).optional(),
      totalAmount: z.number().min(0).optional(),
    }).parse(req.body);
    const updated = await ClinicalService.updateInvoice(getId(req), practiceId, data, req.user?.id);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/invoices/:id', requirePracticePermission(PERMISSIONS.INVOICE_DELETE), async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deleteInvoice(getId(req), practiceId, req.user?.id);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});
