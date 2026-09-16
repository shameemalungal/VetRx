import { prisma } from '../lib/prisma.js';
import { AuditService } from '../lib/audit.service.js';
import { AppError } from '../middleware/errorHandler.js';

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
  static async listPrescriptions(practiceId: string, search?: string) {
    const where: any = { practiceId };
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
      },
    });
  }

  static async getPrescriptionById(id: string, practiceId: string) {
    const rx = await prisma.prescription.findFirst({
      where: { id, practiceId },
      include: {
        patient: { include: { owner: true } },
        items: { include: { medicine: true } },
      },
    });
    if (!rx) {
      throw new AppError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription not found.');
    }
    return rx;
  }

  static async createPrescription(practiceId: string, data: {
    patientId: string;
    rxNumber: string;
    diagnosis?: string | null;
    notes?: string | null;
    status?: string;
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
  }) {
    // Ensure patient belongs to same practice
    await this.getPatientById(data.patientId, practiceId);

    const rx = await prisma.prescription.create({
      data: {
        practiceId,
        patientId: data.patientId,
        rxNumber: data.rxNumber.trim(),
        diagnosis: data.diagnosis?.trim() || null,
        notes: data.notes?.trim() || null,
        status: data.status || 'Final',
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
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PRESCRIPTION_CREATED',
      resource: 'Prescription',
      resourceId: rx.id,
      details: { rxNumber: rx.rxNumber, patientId: rx.patientId, itemCount: rx.items.length },
    });

    return rx;
  }

  static async updatePrescription(id: string, practiceId: string, data: Partial<{
    diagnosis: string | null;
    notes: string | null;
    status: string;
  }>) {
    await this.getPrescriptionById(id, practiceId);

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
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PRESCRIPTION_UPDATED',
      resource: 'Prescription',
      resourceId: updated.id,
      details: data,
    });

    return updated;
  }

  static async deletePrescription(id: string, practiceId: string) {
    await this.getPrescriptionById(id, practiceId);

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
