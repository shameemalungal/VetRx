import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

export interface RecordAuditParams {
  practiceId?: string | null;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  public static mockLogs: RecordAuditParams[] = [];

  static clearMockLogs(): void {
    this.mockLogs = [];
  }

  /**
   * Records a security or domain audit log entry asynchronously without blocking caller.
   */
  static async record(params: RecordAuditParams): Promise<void> {
    this.mockLogs.push({ ...params });

    if (process.env.VETRX_FAST_TEST === '1') {
      return;
    }

    try {
      await prisma.auditLog.create({
        data: {
          practiceId: params.practiceId ?? null,
          userId: params.userId ?? null,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId ?? null,
          details: params.details
            ? (JSON.parse(JSON.stringify(params.details)) as Prisma.InputJsonValue)
            : Prisma.DbNull,
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (error) {
      logger.error('Failed to write audit log entry', { error: String(error), action: params.action });
    }
  }
}
