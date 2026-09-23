import { prisma } from '../lib/prisma.js';
import { AuditService } from '../lib/audit.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import { PERMISSIONS } from '../auth/permissions.js';

// ==============================================================================
// VetRx Clinical Service
// Strictly enforces tenant isolation on all clinical models by practiceId.
// ==============================================================================

export class ClinicalService {
  // ----------------------------------------------------------------------------
  // 1. Owners
  // ----------------------------------------------------------------------------
  static async listOwners(practiceId: string, search?: string) {
    const where: any = { practiceId };
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim() } },
      ];
    }
    return prisma.owner.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { patients: true },
    });
  }

  static async getOwnerById(id: string, practiceId: string) {
    const owner = await prisma.owner.findFirst({
      where: { id, practiceId },
      include: { patients: true },
    });
    if (!owner) {
      throw new AppError(404, 'OWNER_NOT_FOUND', 'Owner not found.');
    }
    return owner;
  }

  static async createOwner(practiceId: string, data: { name: string; phone: string; email?: string | null; address?: string | null }) {
    const owner = await prisma.owner.create({
      data: {
        practiceId,
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'OWNER_CREATED',
      resource: 'Owner',
      resourceId: owner.id,
      details: { name: owner.name, phone: owner.phone },
    });

    return owner;
  }

  static async updateOwner(id: string, practiceId: string, data: Partial<{ name: string; phone: string; email: string | null; address: string | null }>) {
    await this.getOwnerById(id, practiceId);

    const updated = await prisma.owner.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        phone: data.phone !== undefined ? data.phone.trim() : undefined,
        email: data.email !== undefined ? (data.email?.trim() || null) : undefined,
        address: data.address !== undefined ? (data.address?.trim() || null) : undefined,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'OWNER_UPDATED',
      resource: 'Owner',
      resourceId: updated.id,
      details: data,
    });

    return updated;
  }

  static async deleteOwner(id: string, practiceId: string) {
    await this.getOwnerById(id, practiceId);

    const deleted = await prisma.owner.delete({
      where: { id },
    });

    void AuditService.record({
      practiceId,
      action: 'OWNER_DELETED',
      resource: 'Owner',
      resourceId: id,
    });

    return deleted;
  }

  // ----------------------------------------------------------------------------
  // 2. Patients
  // ----------------------------------------------------------------------------
  static async listPatients(practiceId: string, search?: string) {
    const where: any = { practiceId };
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { species: { contains: search.trim(), mode: 'insensitive' } },
        { breed: { contains: search.trim(), mode: 'insensitive' } },
        { identification: { contains: search.trim() } },
        { owner: { name: { contains: search.trim(), mode: 'insensitive' } } },
        { owner: { phone: { contains: search.trim() } } },
      ];
    }
    return prisma.patient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { owner: true },
    });
  }

  static async getPatientById(id: string, practiceId: string) {
    const patient = await prisma.patient.findFirst({
      where: { id, practiceId },
      include: { owner: true, prescriptions: true, invoices: true },
    });
    if (!patient) {
      throw new AppError(404, 'PATIENT_NOT_FOUND', 'Patient not found.');
    }
    return patient;
  }

  static async createPatient(practiceId: string, data: {
    ownerId: string;
    name: string;
    species: string;
    breed?: string | null;
    sex?: string | null;
    ageYears?: number | null;
    ageMonths?: number | null;
    weightKg?: number | null;
    identification?: string | null;
    notes?: string | null;
  }) {
    // Verify owner belongs to same practice
    await this.getOwnerById(data.ownerId, practiceId);

    const patient = await prisma.patient.create({
      data: {
        practiceId,
        ownerId: data.ownerId,
        name: data.name.trim(),
        species: data.species.trim(),
        breed: data.breed?.trim() || null,
        sex: data.sex?.trim() || null,
        ageYears: data.ageYears ?? null,
        ageMonths: data.ageMonths ?? null,
        weightKg: data.weightKg ?? null,
        identification: data.identification?.trim() || null,
        notes: data.notes?.trim() || null,
      },
      include: { owner: true },
    });

    void AuditService.record({
      practiceId,
      action: 'PATIENT_CREATED',
      resource: 'Patient',
      resourceId: patient.id,
      details: { name: patient.name, species: patient.species, ownerId: patient.ownerId },
    });

    return patient;
  }

  static async updatePatient(id: string, practiceId: string, data: Partial<{
    name: string;
    species: string;
    breed: string | null;
    sex: string | null;
    ageYears: number | null;
    ageMonths: number | null;
    weightKg: number | null;
    identification: string | null;
    notes: string | null;
  }>) {
    await this.getPatientById(id, practiceId);

    const updated = await prisma.patient.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        species: data.species !== undefined ? data.species.trim() : undefined,
        breed: data.breed !== undefined ? (data.breed?.trim() || null) : undefined,
        sex: data.sex !== undefined ? (data.sex?.trim() || null) : undefined,
        ageYears: data.ageYears !== undefined ? data.ageYears : undefined,
        ageMonths: data.ageMonths !== undefined ? data.ageMonths : undefined,
        weightKg: data.weightKg !== undefined ? data.weightKg : undefined,
        identification: data.identification !== undefined ? (data.identification?.trim() || null) : undefined,
        notes: data.notes !== undefined ? (data.notes?.trim() || null) : undefined,
      },
      include: { owner: true },
    });

    void AuditService.record({
      practiceId,
      action: 'PATIENT_UPDATED',
      resource: 'Patient',
      resourceId: updated.id,
      details: data,
    });

    return updated;
  }

  static async deletePatient(id: string, practiceId: string) {
    await this.getPatientById(id, practiceId);

    const deleted = await prisma.patient.delete({
      where: { id },
    });

    void AuditService.record({
      practiceId,
      action: 'PATIENT_DELETED',
      resource: 'Patient',
      resourceId: id,
    });

    return deleted;
  }

  // ----------------------------------------------------------------------------
  // 3. Medicines
  // ----------------------------------------------------------------------------
  static async listMedicines(practiceId: string, search?: string) {
    const where: any = { practiceId, isActive: true };
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { genericName: { contains: search.trim(), mode: 'insensitive' } },
        { category: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    return prisma.medicine.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  static async getMedicineById(id: string, practiceId: string) {
    const medicine = await prisma.medicine.findFirst({
      where: { id, practiceId },
    });
    if (!medicine) {
      throw new AppError(404, 'MEDICINE_NOT_FOUND', 'Medicine not found.');
    }
    return medicine;
  }

  static async createMedicine(practiceId: string, data: {
    name: string;
    genericName?: string | null;
    category?: string | null;
    form?: string | null;
    strength?: string | null;
    unitPrice?: number;
    defaultDosageInstructions?: string | null;
  }) {
    const medicine = await prisma.medicine.create({
      data: {
        practiceId,
        name: data.name.trim(),
        genericName: data.genericName?.trim() || null,
        category: data.category?.trim() || null,
        form: data.form?.trim() || null,
        strength: data.strength?.trim() || null,
        unitPrice: data.unitPrice ?? 0,
        defaultDosageInstructions: data.defaultDosageInstructions?.trim() || null,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'MEDICINE_CREATED',
      resource: 'Medicine',
      resourceId: medicine.id,
      details: { name: medicine.name },
    });

    return medicine;
  }

  static async updateMedicine(id: string, practiceId: string, data: Partial<{
    name: string;
    genericName: string | null;
    category: string | null;
    form: string | null;
    strength: string | null;
    unitPrice: number;
    defaultDosageInstructions: string | null;
    isActive: boolean;
  }>) {
    await this.getMedicineById(id, practiceId);

    const updated = await prisma.medicine.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        genericName: data.genericName !== undefined ? (data.genericName?.trim() || null) : undefined,
        category: data.category !== undefined ? (data.category?.trim() || null) : undefined,
        form: data.form !== undefined ? (data.form?.trim() || null) : undefined,
        strength: data.strength !== undefined ? (data.strength?.trim() || null) : undefined,
        unitPrice: data.unitPrice !== undefined ? data.unitPrice : undefined,
        defaultDosageInstructions: data.defaultDosageInstructions !== undefined ? (data.defaultDosageInstructions?.trim() || null) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'MEDICINE_UPDATED',
      resource: 'Medicine',
      resourceId: updated.id,
      details: data,
    });

    return updated;
  }

  static async deleteMedicine(id: string, practiceId: string) {
    await this.getMedicineById(id, practiceId);

    // Soft delete / deactivate to preserve historical prescription relations
    const deactivated = await prisma.medicine.update({
      where: { id },
      data: { isActive: false },
    });

    void AuditService.record({
      practiceId,
      action: 'MEDICINE_DEACTIVATED',
      resource: 'Medicine',
      resourceId: id,
    });

    return deactivated;
  }

  // ----------------------------------------------------------------------------
  // 4. Treatment Packages
  // ----------------------------------------------------------------------------
  static async listPackages(practiceId: string) {
    return prisma.treatmentPackage.findMany({
      where: { practiceId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async getPackageById(id: string, practiceId: string) {
    const pkg = await prisma.treatmentPackage.findFirst({
      where: { id, practiceId },
    });
    if (!pkg) {
      throw new AppError(404, 'PACKAGE_NOT_FOUND', 'Treatment package not found.');
    }
    return pkg;
  }

  static async createPackage(practiceId: string, data: {
    name: string;
    description?: string | null;
    totalPrice?: number;
    itemsJson?: any;
  }) {
    const pkg = await prisma.treatmentPackage.create({
      data: {
        practiceId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        totalPrice: data.totalPrice ?? 0,
        itemsJson: data.itemsJson ?? [],
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PACKAGE_CREATED',
      resource: 'TreatmentPackage',
      resourceId: pkg.id,
      details: { name: pkg.name },
    });

    return pkg;
  }

  static async updatePackage(id: string, practiceId: string, data: Partial<{
    name: string;
    description: string | null;
    totalPrice: number;
    itemsJson: any;
    isActive: boolean;
  }>) {
    await this.getPackageById(id, practiceId);

    const updated = await prisma.treatmentPackage.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
        totalPrice: data.totalPrice !== undefined ? data.totalPrice : undefined,
        itemsJson: data.itemsJson !== undefined ? data.itemsJson : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PACKAGE_UPDATED',
      resource: 'TreatmentPackage',
      resourceId: updated.id,
      details: data,
    });

    return updated;
  }

  static async deletePackage(id: string, practiceId: string) {
    await this.getPackageById(id, practiceId);

    const deleted = await prisma.treatmentPackage.delete({
      where: { id },
    });

    void AuditService.record({
      practiceId,
      action: 'PACKAGE_DELETED',
      resource: 'TreatmentPackage',
      resourceId: id,
    });

    return deleted;
  }

  // ----------------------------------------------------------------------------
  // 5. Prescriptions
  // ----------------------------------------------------------------------------
  // 5. Prescriptions
  // ----------------------------------------------------------------------------
  static async listPrescriptions(
    practiceId: string,
    options?: string | { search?: string; status?: string; forwardedToUserId?: string }
  ) {
    const search = typeof options === 'string' ? options : options?.search;
    const status = typeof options === 'object' ? options?.status : undefined;
    const forwardedToUserId = typeof options === 'object' ? options?.forwardedToUserId : undefined;

    const where: any = { practiceId };
    if (status && status.trim()) {
      where.status = status.trim();
    }
    if (forwardedToUserId && forwardedToUserId.trim()) {
      where.forwardedToUserId = forwardedToUserId.trim();
    }
    if (search && search.trim()) {
      where.OR = [
        { rxNumber: { contains: search.trim() } },
        { diagnosis: { contains: search.trim(), mode: 'insensitive' } },
        { patient: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }
    return prisma.prescription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { include: { owner: true } },
        items: true,
        forwardedByUser: { select: { id: true, name: true, email: true } },
        forwardedToUser: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true, email: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  static async getPrescriptionById(id: string, practiceId: string) {
    const rx = await prisma.prescription.findFirst({
      where: { id, practiceId },
      include: {
        patient: { include: { owner: true } },
        items: { include: { medicine: true } },
        forwardedByUser: { select: { id: true, name: true, email: true } },
        forwardedToUser: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true, email: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
        workflowHistory: {
          include: {
            actorUser: { select: { id: true, name: true, email: true } },
            targetUser: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!rx) {
      throw new AppError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription not found.');
    }
    return rx;
  }

  static isFinalOrApprovedStatus(status?: string | null): boolean {
    if (!status) return false;
    const s = status.trim().toLowerCase();
    return s === 'approved' || s === 'final' || s === 'issued' || s === 'signed';
  }

  static async createPrescription(practiceId: string, data: {
    patientId: string;
    rxNumber: string;
    diagnosis?: string | null;
    notes?: string | null;
    status?: string;
    forwardedToUserId?: string | null;
    forwardingRemarks?: string | null;
    items: Array<{
      medicineId?: string | null;
      medicineName: string;
      dosage: string;
      frequency: string;
      durationDays?: number;
      totalQuantity?: number;
      quantityUnit?: string | null;
      instructions?: string | null;
    }>;
  }, actorUserId?: string) {
    // Clinical Approval Authority Enforcement:
    // Staff/non-clinicians CANNOT create an already Approved/Final/Issued/Signed prescription directly.
    const requestedFinal = ClinicalService.isFinalOrApprovedStatus(data.status);
    const canApprove = actorUserId
      ? await AuthorizationService.hasPermission(actorUserId, practiceId, PERMISSIONS.PRESCRIPTION_APPROVE)
      : false;

    if (requestedFinal && !canApprove) {
      throw new AppError(
        403,
        'PRESCRIPTION_APPROVE_FORBIDDEN',
        'Staff members cannot directly create approved prescriptions. Prescriptions must start as Draft and be submitted for veterinarian approval.'
      );
    }

    // Ensure patient belongs to same practice
    await this.getPatientById(data.patientId, practiceId);

    // If forwarded directly upon creation
    let targetClinician = null;
    if (data.forwardedToUserId) {
      targetClinician = await prisma.practiceMember.findFirst({
        where: { practiceId, userId: data.forwardedToUserId, isActive: true },
      });
      if (!targetClinician) {
        throw new AppError(404, 'CLINICIAN_NOT_FOUND', 'Selected clinician is not an active member of this practice.');
      }
      const targetCanApprove = await AuthorizationService.hasPermission(
        data.forwardedToUserId,
        practiceId,
        PERMISSIONS.PRESCRIPTION_APPROVE
      );
      if (!targetCanApprove) {
        throw new AppError(400, 'INVALID_CLINICIAN', 'Selected user does not have clinical prescription approval authority.');
      }
    }

    let initialStatus = 'Draft';
    let isApprovedOnCreate = false;

    if (requestedFinal && canApprove) {
      initialStatus = 'Approved';
      isApprovedOnCreate = true;
    } else if (data.forwardedToUserId) {
      initialStatus = 'Pending Approval';
    } else {
      // Force Draft for staff and default creations
      initialStatus = 'Draft';
    }

    const rx = await prisma.prescription.create({
      data: {
        practiceId,
        patientId: data.patientId,
        rxNumber: data.rxNumber.trim(),
        diagnosis: data.diagnosis?.trim() || null,
        notes: data.notes?.trim() || null,
        status: initialStatus,
        version: 1,
        forwardedToUserId: data.forwardedToUserId || null,
        forwardedByUserId: data.forwardedToUserId && actorUserId ? actorUserId : null,
        forwardedAt: data.forwardedToUserId ? new Date() : null,
        forwardingRemarks: data.forwardingRemarks?.trim() || null,
        approvedByUserId: isApprovedOnCreate && actorUserId ? actorUserId : null,
        approvedAt: isApprovedOnCreate ? new Date() : null,
        approvedVersion: isApprovedOnCreate ? 1 : null,
        approvalRemarks: isApprovedOnCreate ? 'Clinician direct approval upon creation' : null,
        items: {
          create: data.items.map((item) => ({
            medicineId: item.medicineId || null,
            medicineName: item.medicineName.trim(),
            dosage: item.dosage.trim(),
            frequency: item.frequency.trim(),
            durationDays: item.durationDays ?? 1,
            totalQuantity: item.totalQuantity ?? 1,
            quantityUnit: item.quantityUnit || null,
            instructions: item.instructions || null,
          })),
        },
      },
      include: {
        patient: { include: { owner: true } },
        items: true,
        forwardedByUser: { select: { id: true, name: true, email: true } },
        forwardedToUser: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (actorUserId) {
      const actionName = isApprovedOnCreate
        ? 'APPROVED'
        : data.forwardedToUserId
        ? 'FORWARDED'
        : 'CREATED';
      const historyRemarks = isApprovedOnCreate
        ? 'Prescription created and directly approved by clinician'
        : data.forwardingRemarks?.trim() || (data.forwardedToUserId ? 'Forwarded for clinical approval on creation' : 'Prescription created as draft');

      await prisma.prescriptionWorkflowHistory.create({
        data: {
          prescriptionId: rx.id,
          version: 1,
          status: initialStatus,
          action: actionName,
          actorUserId,
          targetUserId: data.forwardedToUserId || null,
          remarks: historyRemarks,
        },
      }).catch(err => console.warn('Could not record initial prescription workflow history:', err));
    }

    void AuditService.record({
      practiceId,
      action: isApprovedOnCreate ? 'PRESCRIPTION_APPROVED' : 'PRESCRIPTION_CREATED',
      resource: 'Prescription',
      resourceId: rx.id,
      details: { rxNumber: rx.rxNumber, patientId: rx.patientId, itemCount: data.items.length, status: initialStatus },
    });

    return rx;
  }

  static async updatePrescription(id: string, practiceId: string, data: Partial<{
    diagnosis: string | null;
    notes: string | null;
    status: string;
    items?: Array<{
      medicineId?: string | null;
      medicineName: string;
      dosage: string;
      frequency: string;
      durationDays?: number;
      totalQuantity?: number;
      quantityUnit?: string | null;
      instructions?: string | null;
    }>;
  }>, actorUserId?: string) {
    // Direct status change to Approved/Final/Issued/Signed via generic update is strictly forbidden
    if (ClinicalService.isFinalOrApprovedStatus(data.status)) {
      throw new AppError(
        403,
        'PRESCRIPTION_APPROVE_FORBIDDEN',
        'Direct status change to Approved via generic update is forbidden. Prescriptions must be approved via the dedicated clinical approval workflow endpoint.'
      );
    }

    if (data.status === 'Pending Approval') {
      throw new AppError(
        400,
        'INVALID_STATE_TRANSITION',
        'Prescriptions must be submitted for approval via the dedicated forward endpoint.'
      );
    }

    const existing = await this.getPrescriptionById(id, practiceId);

    // Immutability Check: Approved/Final/Issued prescriptions CANNOT be directly edited
    if (ClinicalService.isFinalOrApprovedStatus(existing.status)) {
      throw new AppError(
        400,
        'PRESCRIPTION_IMMUTABLE',
        'Approved prescriptions are legally sealed clinical records and cannot be modified.'
      );
    }

    if (existing.status === 'Cancelled') {
      throw new AppError(
        400,
        'PRESCRIPTION_CANCELLED',
        'Cancelled prescriptions cannot be edited.'
      );
    }

    // State machine check on status changes
    if (data.status && data.status !== existing.status) {
      if (data.status === 'Cancelled') {
        // Any unapproved prescription (Draft, Pending Approval, Changes Requested) can be cancelled
      } else if (existing.status === 'Changes Requested' && data.status === 'Draft') {
        // Can remain or transition to Draft
      } else {
        throw new AppError(
          400,
          'INVALID_STATE_TRANSITION',
          `Invalid status transition from ${existing.status} to ${data.status}.`
        );
      }
    }

    // If prescription is currently Pending Approval, content edits are locked until reviewed or changes requested
    const hasContentChanges = Boolean(
      (data.diagnosis !== undefined && data.diagnosis !== existing.diagnosis) ||
      (data.notes !== undefined && data.notes !== existing.notes) ||
      (data.items && data.items.length > 0)
    );
    if (existing.status === 'Pending Approval' && hasContentChanges) {
      throw new AppError(
        400,
        'PRESCRIPTION_PENDING_APPROVAL',
        'Prescription is pending veterinarian review and cannot be edited. A veterinarian must review or request changes before edits can be made.'
      );
    }

    // If items are provided, replace existing items
    if (data.items && Array.isArray(data.items)) {
      await prisma.prescriptionItem.deleteMany({
        where: { prescriptionId: id },
      });
      await prisma.prescriptionItem.createMany({
        data: data.items.map((item) => ({
          prescriptionId: id,
          medicineId: item.medicineId || null,
          medicineName: item.medicineName.trim(),
          dosage: item.dosage.trim(),
          frequency: item.frequency.trim(),
          durationDays: item.durationDays ?? 1,
          totalQuantity: item.totalQuantity ?? 1,
          quantityUnit: item.quantityUnit || null,
          instructions: item.instructions || null,
        })),
      });
    }

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        diagnosis: data.diagnosis !== undefined ? (data.diagnosis?.trim() || null) : undefined,
        notes: data.notes !== undefined ? (data.notes?.trim() || null) : undefined,
        status: data.status !== undefined ? data.status : undefined,
      },
      include: {
        patient: { include: { owner: true } },
        items: true,
        forwardedByUser: { select: { id: true, name: true, email: true } },
        forwardedToUser: { select: { id: true, name: true, email: true } },
        approvedByUser: { select: { id: true, name: true, email: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PRESCRIPTION_UPDATED',
      resource: 'Prescription',
      resourceId: updated.id,
      details: { ...data, actorUserId },
    });

    return updated;
  }

  static async forwardPrescription(id: string, practiceId: string, actorUserId: string, data: {
    forwardedToUserId: string;
    forwardingRemarks?: string | null;
  }) {
    const existing = await this.getPrescriptionById(id, practiceId);

    if (existing.status === 'Approved') {
      throw new AppError(
        400,
        'PRESCRIPTION_IMMUTABLE',
        'Approved prescriptions cannot be forwarded for approval.'
      );
    }

    if (existing.status === 'Cancelled') {
      throw new AppError(
        400,
        'PRESCRIPTION_CANCELLED',
        'Cancelled prescriptions cannot be forwarded for approval.'
      );
    }

    if (existing.status !== 'Draft' && existing.status !== 'Changes Requested') {
      throw new AppError(
        400,
        'INVALID_PRESCRIPTION_STATUS',
        'Only Draft or Changes Requested prescriptions can be forwarded for clinical approval.'
      );
    }

    const targetMember = await prisma.practiceMember.findFirst({
      where: { practiceId, userId: data.forwardedToUserId, isActive: true },
      include: { user: true },
    });

    if (!targetMember) {
      throw new AppError(404, 'CLINICIAN_NOT_FOUND', 'Selected clinician is not an active member of this practice.');
    }

    const targetCanApprove = await AuthorizationService.hasPermission(
      data.forwardedToUserId,
      practiceId,
      PERMISSIONS.PRESCRIPTION_APPROVE
    );
    if (!targetCanApprove) {
      throw new AppError(400, 'INVALID_CLINICIAN', 'Selected user does not have clinical prescription approval authority.');
    }

    const isResubmission = existing.status === 'Changes Requested';
    const action = isResubmission ? 'RESUBMITTED' : 'FORWARDED';

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status: 'Pending Approval',
        forwardedToUserId: data.forwardedToUserId,
        forwardedByUserId: actorUserId,
        forwardedAt: new Date(),
        forwardingRemarks: data.forwardingRemarks?.trim() || null,
      },
      include: {
        patient: { include: { owner: true } },
        items: true,
        forwardedByUser: { select: { id: true, name: true, email: true } },
        forwardedToUser: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.prescriptionWorkflowHistory.create({
      data: {
        prescriptionId: id,
        version: existing.version,
        status: 'Pending Approval',
        action,
        actorUserId,
        targetUserId: data.forwardedToUserId,
        remarks: data.forwardingRemarks?.trim() || (isResubmission ? 'Resubmitted for clinical approval after addressing changes' : 'Forwarded for clinical approval'),
      },
    });

    void AuditService.record({
      practiceId,
      action: isResubmission ? 'PRESCRIPTION_RESUBMITTED' : 'PRESCRIPTION_FORWARDED',
      resource: 'Prescription',
      resourceId: id,
      details: { forwardedToUserId: data.forwardedToUserId, remarks: data.forwardingRemarks },
    });

    return updated;
  }

  static async approvePrescription(id: string, practiceId: string, actorUserId: string, data?: {
    approvalRemarks?: string | null;
  }) {
    const existing = await this.getPrescriptionById(id, practiceId);

    if (existing.status === 'Approved') {
      throw new AppError(
        400,
        'PRESCRIPTION_ALREADY_APPROVED',
        'This prescription has already been approved and sealed.'
      );
    }

    if (existing.status === 'Cancelled') {
      throw new AppError(
        400,
        'PRESCRIPTION_CANCELLED',
        'Cancelled prescriptions cannot be approved.'
      );
    }

    if (existing.status === 'Changes Requested') {
      throw new AppError(
        400,
        'INVALID_PRESCRIPTION_STATUS',
        'Prescription has outstanding requested changes and must be resubmitted for approval before it can be approved.'
      );
    }

    if (existing.status !== 'Pending Approval' && existing.status !== 'Draft') {
      throw new AppError(
        400,
        'INVALID_PRESCRIPTION_STATUS',
        'Only Draft or Pending Approval prescriptions can be approved.'
      );
    }

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status: 'Approved',
        approvedByUserId: actorUserId,
        approvedAt: new Date(),
        approvedVersion: existing.version,
        approvalRemarks: data?.approvalRemarks?.trim() || null,
      },
      include: {
        patient: { include: { owner: true } },
        items: true,
        approvedByUser: { select: { id: true, name: true, email: true } },
        forwardedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.prescriptionWorkflowHistory.create({
      data: {
        prescriptionId: id,
        version: existing.version,
        status: 'Approved',
        action: 'APPROVED',
        actorUserId,
        remarks: data?.approvalRemarks?.trim() || 'Clinically approved and digitally signed',
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PRESCRIPTION_APPROVED',
      resource: 'Prescription',
      resourceId: id,
      details: { version: existing.version, approvalRemarks: data?.approvalRemarks },
    });

    return updated;
  }

  static async requestChangesPrescription(id: string, practiceId: string, actorUserId: string, data: {
    changeRequestRemarks: string;
  }) {
    const existing = await this.getPrescriptionById(id, practiceId);

    if (existing.status === 'Approved') {
      throw new AppError(
        400,
        'PRESCRIPTION_IMMUTABLE',
        'Approved prescriptions cannot have changes requested.'
      );
    }

    if (existing.status !== 'Pending Approval') {
      throw new AppError(
        400,
        'INVALID_PRESCRIPTION_STATUS',
        'Only prescriptions with Pending Approval status can have changes requested.'
      );
    }

    if (!data.changeRequestRemarks || !data.changeRequestRemarks.trim()) {
      throw new AppError(400, 'REMARKS_REQUIRED', 'Mandatory change request remarks must be provided.');
    }

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status: 'Changes Requested',
        requestedByUserId: actorUserId,
        requestedAt: new Date(),
        changeRequestRemarks: data.changeRequestRemarks.trim(),
      },
      include: {
        patient: { include: { owner: true } },
        items: true,
        requestedByUser: { select: { id: true, name: true, email: true } },
        forwardedByUser: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.prescriptionWorkflowHistory.create({
      data: {
        prescriptionId: id,
        version: existing.version,
        status: 'Changes Requested',
        action: 'CHANGES_REQUESTED',
        actorUserId,
        remarks: data.changeRequestRemarks.trim(),
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PRESCRIPTION_CHANGES_REQUESTED',
      resource: 'Prescription',
      resourceId: id,
      details: { changeRequestRemarks: data.changeRequestRemarks },
    });

    return updated;
  }

  static async revisePrescription(id: string, practiceId: string, actorUserId: string) {
    const existing = await this.getPrescriptionById(id, practiceId);

    if (existing.status !== 'Approved') {
      throw new AppError(
        400,
        'REVISION_NOT_ALLOWED',
        'Only Approved prescriptions can have a new revision created.'
      );
    }

    const newVersion = (existing.version || 1) + 1;

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        version: newVersion,
        status: 'Draft',
        approvedByUserId: null,
        approvedAt: null,
        approvedVersion: null,
        approvalRemarks: null,
        forwardedToUserId: null,
        forwardedByUserId: null,
        forwardedAt: null,
        forwardingRemarks: null,
        requestedByUserId: null,
        requestedAt: null,
        changeRequestRemarks: null,
      },
      include: {
        patient: { include: { owner: true } },
        items: true,
      },
    });

    await prisma.prescriptionWorkflowHistory.create({
      data: {
        prescriptionId: id,
        version: newVersion,
        status: 'Draft',
        action: 'RESUBMITTED',
        actorUserId,
        remarks: `Created revision v${newVersion} from approved v${existing.version}`,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PRESCRIPTION_REVISION_CREATED',
      resource: 'Prescription',
      resourceId: id,
      details: { previousVersion: existing.version, newVersion },
    });

    return updated;
  }

  static async getEligibleClinicians(practiceId: string) {
    const members = await prisma.practiceMember.findMany({
      where: {
        practiceId,
        isActive: true,
        OR: [
          { role: 'VETERINARIAN' },
          { permissionOverrides: { some: { permission: 'PRESCRIPTION_APPROVE', effect: 'ALLOW' } } },
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    return members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
    }));
  }

  static async getPendingApprovalsCount(practiceId: string, clinicianUserId?: string) {
    const where: any = {
      practiceId,
      status: 'Pending Approval',
    };
    if (clinicianUserId) {
      where.forwardedToUserId = clinicianUserId;
    }
    const count = await prisma.prescription.count({ where });
    return { count };
  }

  static async deletePrescription(id: string, practiceId: string) {
    const existing = await this.getPrescriptionById(id, practiceId);

    if (ClinicalService.isFinalOrApprovedStatus(existing.status)) {
      throw new AppError(
        400,
        'PRESCRIPTION_IMMUTABLE',
        'Approved prescriptions are legally sealed clinical records and cannot be deleted.'
      );
    }

    const deleted = await prisma.prescription.delete({
      where: { id },
    });

    void AuditService.record({
      practiceId,
      action: 'PRESCRIPTION_DELETED',
      resource: 'Prescription',
      resourceId: id,
    });

    return deleted;
  }

  // ----------------------------------------------------------------------------
  // 6. Invoices (Statutory Invoices in INR - Document Only)
  // ----------------------------------------------------------------------------
  static async listInvoices(practiceId: string, search?: string) {
    const where: any = { practiceId };
    if (search && search.trim()) {
      where.OR = [
        { invoiceNumber: { contains: search.trim() } },
        { patient: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ];
    }
    return prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { include: { owner: true } },
        items: true,
      },
    });
  }

  static async getInvoiceById(id: string, practiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, practiceId },
      include: {
        patient: { include: { owner: true } },
        items: true,
      },
    });
    if (!invoice) {
      throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found.');
    }
    return invoice;
  }

  static async createInvoice(practiceId: string, data: {
    patientId?: string | null;
    invoiceNumber: string;
    subtotal: number;
    taxAmount?: number;
    discountAmount?: number;
    totalAmount: number;
    status?: string;
    items: Array<{
      prescriptionId?: string | null;
      description: string;
      category?: string;
      unitPrice: number;
      quantity?: number;
      totalPrice: number;
    }>;
  }) {
    if (data.patientId) {
      await this.getPatientById(data.patientId, practiceId);
    }

    const invoice = await prisma.invoice.create({
      data: {
        practiceId,
        patientId: data.patientId || null,
        invoiceNumber: data.invoiceNumber.trim(),
        subtotal: data.subtotal,
        taxAmount: data.taxAmount ?? 0,
        discountAmount: data.discountAmount ?? 0,
        totalAmount: data.totalAmount,
        status: data.status || 'Issued',
        items: {
          create: data.items.map((item) => ({
            prescriptionId: item.prescriptionId || null,
            description: item.description.trim(),
            category: item.category || 'Medicine',
            unitPrice: item.unitPrice,
            quantity: item.quantity ?? 1,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: {
        patient: { include: { owner: true } },
        items: true,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'INVOICE_CREATED',
      resource: 'Invoice',
      resourceId: invoice.id,
      details: { invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount },
    });

    return invoice;
  }

  static async updateInvoice(id: string, practiceId: string, data: Partial<{
    status: string;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    totalAmount: number;
  }>) {
    await this.getInvoiceById(id, practiceId);

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: data.status !== undefined ? data.status : undefined,
        subtotal: data.subtotal !== undefined ? data.subtotal : undefined,
        taxAmount: data.taxAmount !== undefined ? data.taxAmount : undefined,
        discountAmount: data.discountAmount !== undefined ? data.discountAmount : undefined,
        totalAmount: data.totalAmount !== undefined ? data.totalAmount : undefined,
      },
      include: {
        patient: { include: { owner: true } },
        items: true,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'INVOICE_UPDATED',
      resource: 'Invoice',
      resourceId: updated.id,
      details: data,
    });

    return updated;
  }

  static async deleteInvoice(id: string, practiceId: string) {
    await this.getInvoiceById(id, practiceId);

    const deleted = await prisma.invoice.delete({
      where: { id },
    });

    void AuditService.record({
      practiceId,
      action: 'INVOICE_DELETED',
      resource: 'Invoice',
      resourceId: id,
    });

    return deleted;
  }
}
