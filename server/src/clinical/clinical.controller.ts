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
// 1. Owners Router
// ------------------------------------------------------------------------------
const createOwnerSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(1).max(30),
  email: z.string().email().nullable().optional().or(z.literal('')),
  address: z.string().max(300).nullable().optional(),
});

clinicalRouter.get('/owners', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const owners = await ClinicalService.listOwners(practiceId, search);
    res.status(200).json(owners);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/owners/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const owner = await ClinicalService.getOwnerById(getId(req), practiceId);
    res.status(200).json(owner);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/owners', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createOwnerSchema.parse(req.body);
    const owner = await ClinicalService.createOwner(practiceId, {
      ...data,
      email: data.email === '' ? null : data.email,
    });
    res.status(201).json(owner);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/owners/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createOwnerSchema.partial().parse(req.body);
    const updated = await ClinicalService.updateOwner(getId(req), practiceId, {
      ...data,
      email: data.email === '' ? null : data.email,
    });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/owners/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deleteOwner(getId(req), practiceId);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 2. Patients Router
// ------------------------------------------------------------------------------
const createPatientSchema = z.object({
  ownerId: z.string().uuid(),
  name: z.string().min(1).max(120),
  species: z.string().min(1).max(60),
  breed: z.string().max(80).nullable().optional(),
  sex: z.string().max(20).nullable().optional(),
  ageYears: z.number().int().min(0).max(100).nullable().optional(),
  ageMonths: z.number().int().min(0).max(11).nullable().optional(),
  weightKg: z.number().min(0).max(5000).nullable().optional(),
  identification: z.string().max(100).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

clinicalRouter.get('/patients', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const patients = await ClinicalService.listPatients(practiceId, search);
    res.status(200).json(patients);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/patients/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const patient = await ClinicalService.getPatientById(getId(req), practiceId);
    res.status(200).json(patient);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/patients', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    await EntitlementService.assertCanCreatePatient(practiceId);
    const data = createPatientSchema.parse(req.body);
    const patient = await ClinicalService.createPatient(practiceId, data);
    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/patients/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createPatientSchema.partial().parse(req.body);
    const updated = await ClinicalService.updatePatient(getId(req), practiceId, data);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/patients/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deletePatient(getId(req), practiceId);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 3. Medicines Router
// ------------------------------------------------------------------------------
const createMedicineSchema = z.object({
  name: z.string().min(1).max(150),
  genericName: z.string().max(150).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  form: z.string().max(50).nullable().optional(),
  strength: z.string().max(50).nullable().optional(),
  unitPrice: z.number().min(0).optional(),
  defaultDosageInstructions: z.string().max(500).nullable().optional(),
});

clinicalRouter.get('/medicines', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const medicines = await ClinicalService.listMedicines(practiceId, search);
    res.status(200).json(medicines);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/medicines/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const medicine = await ClinicalService.getMedicineById(getId(req), practiceId);
    res.status(200).json(medicine);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/medicines', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    await EntitlementService.assertCanAddMedicine(practiceId);
    const data = createMedicineSchema.parse(req.body);
    const medicine = await ClinicalService.createMedicine(practiceId, data);
    res.status(201).json(medicine);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/medicines/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createMedicineSchema.partial().parse(req.body);
    const updated = await ClinicalService.updateMedicine(getId(req), practiceId, data);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/medicines/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deleteMedicine(getId(req), practiceId);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 4. Treatment Packages Router
// ------------------------------------------------------------------------------
const createPackageSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(500).nullable().optional(),
  totalPrice: z.number().min(0).optional(),
  itemsJson: z.any().optional(),
});

clinicalRouter.get('/packages', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const packages = await ClinicalService.listPackages(practiceId);
    res.status(200).json(packages);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/packages/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const pkg = await ClinicalService.getPackageById(getId(req), practiceId);
    res.status(200).json(pkg);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/packages', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    await EntitlementService.assertCanCreatePackage(practiceId);
    const data = createPackageSchema.parse(req.body);
    const pkg = await ClinicalService.createPackage(practiceId, data);
    res.status(201).json(pkg);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/packages/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createPackageSchema.partial().parse(req.body);
    const updated = await ClinicalService.updatePackage(getId(req), practiceId, data);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/packages/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deletePackage(getId(req), practiceId);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// 5. Prescriptions Router
// ------------------------------------------------------------------------------
const createPrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  rxNumber: z.string().min(1).max(50),
  diagnosis: z.string().max(300).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.enum(['Draft', 'Pending Approval', 'Changes Requested', 'Approved', 'Cancelled', 'Final']).optional(),
  forwardedToUserId: z.string().uuid().nullable().optional(),
  forwardingRemarks: z.string().max(1000).nullable().optional(),
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
        status: z.enum(['Draft', 'Pending Approval', 'Changes Requested', 'Approved', 'Cancelled', 'Final']).optional(),
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
        forwardedToUserId: z.string().uuid(),
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
  patientId: z.string().uuid().nullable().optional(),
  invoiceNumber: z.string().min(1).max(50),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0),
  status: z.enum(['Draft', 'Issued', 'Cancelled']).optional(),
  items: z.array(
    z.object({
      prescriptionId: z.string().uuid().nullable().optional(),
      description: z.string().min(1).max(200),
      category: z.string().max(50).optional(),
      unitPrice: z.number().min(0),
      quantity: z.number().min(0).optional(),
      totalPrice: z.number().min(0),
    })
  ).min(1),
});

clinicalRouter.get('/invoices', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const search = req.query.search as string | undefined;
    const invoices = await ClinicalService.listInvoices(practiceId, search);
    res.status(200).json(invoices);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.get('/invoices/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const invoice = await ClinicalService.getInvoiceById(getId(req), practiceId);
    res.status(200).json(invoice);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.post('/invoices', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = createInvoiceSchema.parse(req.body);
    if (data.patientId) {
      await EntitlementService.assertCanCreateRecord(practiceId, data.patientId);
    }
    const invoice = await ClinicalService.createInvoice(practiceId, data);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.patch('/invoices/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const data = z.object({
      status: z.enum(['Draft', 'Issued', 'Cancelled']).optional(),
      subtotal: z.number().min(0).optional(),
      taxAmount: z.number().min(0).optional(),
      discountAmount: z.number().min(0).optional(),
      totalAmount: z.number().min(0).optional(),
    }).parse(req.body);
    const updated = await ClinicalService.updateInvoice(getId(req), practiceId, data);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

clinicalRouter.delete('/invoices/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const deleted = await ClinicalService.deleteInvoice(getId(req), practiceId);
    res.status(200).json(deleted);
  } catch (err) {
    next(err);
  }
});
