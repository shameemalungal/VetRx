import { prisma } from '../lib/prisma.js';
import { AuditService } from '../lib/audit.service.js';
import { AppError } from '../middleware/errorHandler.js';
import type { SafePracticeDTO, SafePracticeSettingsDTO } from '../types/index.js';

export class PracticeService {
  /**
   * Retrieves practice details for the active practice.
   */
  static async getPractice(practiceId: string): Promise<SafePracticeDTO> {
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
   * Updates practice details (requires OWNER role).
   */
  static async updatePractice(
    practiceId: string,
    userId: string,
    updates: { name?: string; slug?: string }
  ): Promise<SafePracticeDTO> {
    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
    }

    if (practice.ownerUserId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the practice owner can update practice details.');
    }

    const updated = await prisma.practice.update({
      where: { id: practiceId },
      data: {
        name: updates.name ? updates.name.trim() : undefined,
        slug: updates.slug ? updates.slug.trim().toLowerCase() : undefined,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      ownerUserId: updated.ownerUserId,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves settings for the active practice.
   */
  static async getSettings(practiceId: string): Promise<SafePracticeSettingsDTO> {
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
      doctorPhotoUrl: settings.doctorPhotoUrl,
      doctorSignatureUrl: settings.doctorSignatureUrl,
      clinicLogoUrl: settings.clinicLogoUrl,
      ownerSpecialInstructionEnabled: settings.ownerSpecialInstructionEnabled,
      mykgvoaMemberId: settings.mykgvoaMemberId,
    };
  }

  /**
   * Updates practice settings (clinic name, doctor profile, address, etc.)
   */
  static async updateSettings(
    practiceId: string,
    updates: Partial<Omit<SafePracticeSettingsDTO, 'id' | 'practiceId'>>
  ): Promise<SafePracticeSettingsDTO> {
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

    void AuditService.record({
      practiceId,
      action: 'PRACTICE_SETTINGS_UPDATED',
      resource: 'PracticeSettings',
      resourceId: updated.id,
      details: updates,
    });

    return {
      id: updated.id,
      practiceId: updated.practiceId,
      clinicName: updated.clinicName,
      address: updated.address,
      phone: updated.phone,
      email: updated.email,
      registrationNumber: updated.registrationNumber,
      doctorName: updated.doctorName,
      doctorRegistrationNumber: updated.doctorRegistrationNumber,
      doctorPhotoUrl: updated.doctorPhotoUrl,
      doctorSignatureUrl: updated.doctorSignatureUrl,
      clinicLogoUrl: updated.clinicLogoUrl,
      ownerSpecialInstructionEnabled: updated.ownerSpecialInstructionEnabled,
      mykgvoaMemberId: updated.mykgvoaMemberId,
    };
  }
}
