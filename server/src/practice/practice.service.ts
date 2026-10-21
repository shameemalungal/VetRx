import { prisma } from '../lib/prisma.js';
import { AuditService } from '../lib/audit.service.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { AppError } from '../middleware/errorHandler.js';
import type { SafePracticeDTO, SafePracticeSettingsDTO } from '../types/index.js';

export class PracticeService {
  private static mockPractices: Map<string, any> = new Map();
  private static mockSettings: Map<string, SafePracticeSettingsDTO> = new Map();

  static setMockPractice(practice: any): void {
    this.mockPractices.set(practice.id, practice);
  }

  static setMockSettings(settings: SafePracticeSettingsDTO): void {
    this.mockSettings.set(settings.practiceId, settings);
  }

  static clearMocks(): void {
    this.mockPractices.clear();
    this.mockSettings.clear();
  }

  /**
   * Retrieves practice details for the active practice.
   */
  static async getPractice(practiceId: string): Promise<SafePracticeDTO> {
    if (process.env.VETRX_FAST_TEST === '1') {
      const p = this.mockPractices.get(practiceId);
      if (p) return p;
    }

    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
    }

    return {
      id: practice.id,
      name: practice.name,
      slug: practice.slug,
      ownerUserId: practice.ownerUserId,
      isActive: practice.isActive,
      createdAt: practice.createdAt.toISOString(),
    };
  }

  /**
   * Updates practice details (requires PRACTICE_SETTINGS_MANAGE permission).
   */
  static async updatePractice(
    practiceId: string,
    userId: string,
    updates: { name?: string; slug?: string }
  ): Promise<SafePracticeDTO> {
    // 1. Authoritative permission check
    await AuthorizationService.requirePermission(userId, practiceId, PERMISSIONS.PRACTICE_SETTINGS_MANAGE);

    let updated: any;
    if (process.env.VETRX_FAST_TEST === '1') {
      const practice = this.mockPractices.get(practiceId) || {
        id: practiceId,
        name: 'Mock Practice',
        slug: 'mock-practice',
        ownerUserId: userId,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      if (updates.name) practice.name = updates.name.trim();
      if (updates.slug) practice.slug = updates.slug.trim().toLowerCase();
      this.mockPractices.set(practiceId, practice);
      updated = practice;
    } else {
      const practice = await prisma.practice.findUnique({
        where: { id: practiceId },
      });

      if (!practice) {
        throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
      }

      updated = await prisma.practice.update({
        where: { id: practiceId },
        data: {
          name: updates.name ? updates.name.trim() : undefined,
          slug: updates.slug ? updates.slug.trim().toLowerCase() : undefined,
        },
      });

      if (updates.name && updates.name.trim()) {
        await prisma.practiceSettings.upsert({
          where: { practiceId },
          create: { practiceId, clinicName: updates.name.trim() },
          update: { clinicName: updates.name.trim() },
        });
      }
    }

    // 2. Audit Trail
    void AuditService.record({
      practiceId,
      userId,
      action: 'PRACTICE_PROFILE_UPDATED',
      resource: 'Practice',
      resourceId: updated.id,
      details: { modifiedFields: Object.keys(updates) },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      ownerUserId: updated.ownerUserId,
      isActive: updated.isActive,
      createdAt: typeof updated.createdAt === 'string' ? updated.createdAt : updated.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves settings for the active practice.
   */
  static async getSettings(practiceId: string): Promise<SafePracticeSettingsDTO> {
    if (process.env.VETRX_FAST_TEST === '1') {
      let s = this.mockSettings.get(practiceId);
      if (!s) {
        s = {
          id: `settings-${practiceId}`,
          practiceId,
          clinicName: 'VetRx Practice',
          address: null,
          phone: null,
          email: null,
          registrationNumber: null,
          doctorName: null,
          doctorRegistrationNumber: null,
          doctorQualifications: null,
          doctorPhone: null,
          doctorEmail: null,
          doctorAddress: null,
          doctorPhotoUrl: null,
          doctorSignatureUrl: null,
          clinicLogoUrl: null,
          clinicLicenseNumber: null,
          ownerSpecialInstructionEnabled: false,
          mykgvoaMemberId: null,
        };
        this.mockSettings.set(practiceId, s);
      }
      return s;
    }

    let settings = await prisma.practiceSettings.findUnique({
      where: { practiceId },
    });

    if (!settings) {
      // Auto-initialize if missing
      settings = await prisma.practiceSettings.create({
        data: { practiceId },
      });
    }

    return {
      id: settings.id,
      practiceId: settings.practiceId,
      clinicName: settings.clinicName,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      registrationNumber: settings.registrationNumber,
      doctorName: settings.doctorName,
      doctorRegistrationNumber: settings.doctorRegistrationNumber,
      doctorQualifications: (settings as any).doctorQualifications || null,
      doctorPhone: (settings as any).doctorPhone || null,
      doctorEmail: (settings as any).doctorEmail || null,
      doctorAddress: (settings as any).doctorAddress || null,
      doctorPhotoUrl: settings.doctorPhotoUrl,
      doctorSignatureUrl: settings.doctorSignatureUrl,
      clinicLogoUrl: settings.clinicLogoUrl,
      clinicLicenseNumber: (settings as any).clinicLicenseNumber || null,
      ownerSpecialInstructionEnabled: settings.ownerSpecialInstructionEnabled,
      mykgvoaMemberId: settings.mykgvoaMemberId,
    };
  }

  /**
   * Updates practice settings (clinic name, doctor profile, address, etc.)
   * Requires PRACTICE_SETTINGS_MANAGE permission at the service boundary.
   */
  static async updateSettings(
    practiceId: string,
    actorUserId: string,
    updates: Partial<Omit<SafePracticeSettingsDTO, 'id' | 'practiceId'>>
  ): Promise<SafePracticeSettingsDTO> {
    // 1. Authoritative permission check
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.PRACTICE_SETTINGS_MANAGE);

    let result: SafePracticeSettingsDTO;

    if (process.env.VETRX_FAST_TEST === '1') {
      const existing = await this.getSettings(practiceId);
      const updated: SafePracticeSettingsDTO = {
        ...existing,
        ...updates,
      };
      this.mockSettings.set(practiceId, updated);
      if (updates.clinicName && updates.clinicName.trim()) {
        const p = this.mockPractices.get(practiceId);
        if (p) {
          p.name = updates.clinicName.trim();
          this.mockPractices.set(practiceId, p);
        }
      }
      result = updated;
    } else {
      const updated = await prisma.practiceSettings.upsert({
        where: { practiceId },
        create: {
          practiceId,
          ...updates,
        },
        update: {
          ...updates,
        },
      });

      // Synchronize authoritative practice name if clinicName was updated
      if (updates.clinicName && updates.clinicName.trim()) {
        await prisma.practice.update({
          where: { id: practiceId },
          data: { name: updates.clinicName.trim() },
        });
      }

      result = {
        id: updated.id,
        practiceId: updated.practiceId,
        clinicName: updated.clinicName,
        address: updated.address,
        phone: updated.phone,
        email: updated.email,
        registrationNumber: updated.registrationNumber,
        doctorName: updated.doctorName,
        doctorRegistrationNumber: updated.doctorRegistrationNumber,
        doctorQualifications: (updated as any).doctorQualifications || null,
        doctorPhone: (updated as any).doctorPhone || null,
        doctorEmail: (updated as any).doctorEmail || null,
        doctorAddress: (updated as any).doctorAddress || null,
        doctorPhotoUrl: updated.doctorPhotoUrl,
        doctorSignatureUrl: updated.doctorSignatureUrl,
        clinicLogoUrl: updated.clinicLogoUrl,
        clinicLicenseNumber: (updated as any).clinicLicenseNumber || null,
        ownerSpecialInstructionEnabled: updated.ownerSpecialInstructionEnabled,
        mykgvoaMemberId: updated.mykgvoaMemberId,
      };
    }

    // 2. Audit Trail recording actor, practice, and modified field names
    void AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'PRACTICE_SETTINGS_UPDATED',
      resource: 'PracticeSettings',
      resourceId: result.id,
      details: { modifiedFields: Object.keys(updates) },
    });

    return result;
  }
}
