// ==============================================================================
// VetRx — Payment Service (Phase 10 Foundation)
// Manages commercial payment records, integer paise validation, and idempotent event logging.
// ==============================================================================

import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { PaymentDTO, PaymentEventDTO, PaymentStatus } from './commercial.types.js';

export class PaymentService {
  /**
   * Validates that monetary amounts conform strictly to integer minor units (paise).
   * Floating-point values or non-integers are rejected immediately.
   */
  static validatePaise(amountPaisa: unknown): number {
    if (typeof amountPaisa !== 'number' || !Number.isInteger(amountPaisa) || amountPaisa < 0) {
      throw new AppError(
        400,
        'INVALID_MONETARY_UNIT',
        `Amount must be a non-negative integer representing minor units (paise). Received: ${amountPaisa}`
      );
    }
    return amountPaisa;
  }

  /**
   * Lists commercial payments for an authenticated practice.
   * Never leaks payments across tenants.
   */
  static async getPracticePayments(practiceId: string): Promise<PaymentDTO[]> {
    const payments = await prisma.payment.findMany({
      where: { practiceId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => ({
      id: p.id,
      practiceId: p.practiceId,
      subscriptionId: p.subscriptionId,
      amountPaisa: p.amountPaisa,
      currency: p.currency,
      status: p.status as PaymentStatus,
      paymentProvider: p.paymentProvider,
      internalReference: p.internalReference,
      gatewayTransactionId: p.gatewayTransactionId,
      paymentMethod: p.paymentMethod,
      gatewayResponseRaw: (p.gatewayResponseRaw as Record<string, unknown>) || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  /**
   * Fetches a single commercial payment by ID strictly within the authenticated practice context.
   */
  static async getPaymentById(paymentId: string, practiceId: string): Promise<PaymentDTO | null> {
    const p = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        practiceId,
      },
    });

    if (!p) return null;

    return {
      id: p.id,
      practiceId: p.practiceId,
      subscriptionId: p.subscriptionId,
      amountPaisa: p.amountPaisa,
      currency: p.currency,
      status: p.status as PaymentStatus,
      paymentProvider: p.paymentProvider,
      internalReference: p.internalReference,
      gatewayTransactionId: p.gatewayTransactionId,
      paymentMethod: p.paymentMethod,
      gatewayResponseRaw: (p.gatewayResponseRaw as Record<string, unknown>) || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  /**
   * Idempotently records an inbound payment event (gateway webhook or callback).
   * If the event was already received (matching provider + eventId), it is safely ignored.
   */
  static async recordPaymentEvent(params: {
    provider: string;
    eventId: string;
    eventType: string;
    rawPayload?: Record<string, unknown>;
    paymentId?: string;
  }): Promise<{ isDuplicate: boolean; event: PaymentEventDTO }> {
    const { provider, eventId, eventType, rawPayload, paymentId } = params;

    // 1. Check if event was already recorded (idempotency check)
    const existing = await prisma.paymentEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });

    if (existing) {
      return {
        isDuplicate: true,
        event: {
          id: existing.id,
          paymentId: existing.paymentId,
          provider: existing.provider,
          eventId: existing.eventId,
          eventType: existing.eventType,
          payloadHash: existing.payloadHash,
          rawPayload: (existing.rawPayload as Record<string, unknown>) || null,
          processingStatus: existing.processingStatus,
          errorMessage: existing.errorMessage,
          receivedAt: existing.receivedAt.toISOString(),
          processedAt: existing.processedAt?.toISOString() || null,
        },
      };
    }

    // 2. Compute SHA-256 payload hash for tamper resistance
    const payloadString = rawPayload ? JSON.stringify(rawPayload) : '';
    const payloadHash = payloadString
      ? crypto.createHash('sha256').update(payloadString).digest('hex')
      : null;

    try {
      const created = await prisma.paymentEvent.create({
        data: {
          provider,
          eventId,
          eventType,
          payloadHash,
          rawPayload: rawPayload ? (rawPayload as any) : undefined,
          paymentId: paymentId || null,
          processingStatus: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      return {
        isDuplicate: false,
        event: {
          id: created.id,
          paymentId: created.paymentId,
          provider: created.provider,
          eventId: created.eventId,
          eventType: created.eventType,
          payloadHash: created.payloadHash,
          rawPayload: (created.rawPayload as Record<string, unknown>) || null,
          processingStatus: created.processingStatus,
          errorMessage: created.errorMessage,
          receivedAt: created.receivedAt.toISOString(),
          processedAt: created.processedAt?.toISOString() || null,
        },
      };
    } catch (err: any) {
      // Catch concurrent unique constraint violation gracefully
      if (err.code === 'P2002') {
        const recheck = await prisma.paymentEvent.findUnique({
          where: {
            provider_eventId: {
              provider,
              eventId,
            },
          },
        });
        if (recheck) {
          return {
            isDuplicate: true,
            event: {
              id: recheck.id,
              paymentId: recheck.paymentId,
              provider: recheck.provider,
              eventId: recheck.eventId,
              eventType: recheck.eventType,
              payloadHash: recheck.payloadHash,
              rawPayload: (recheck.rawPayload as Record<string, unknown>) || null,
              processingStatus: recheck.processingStatus,
              errorMessage: recheck.errorMessage,
              receivedAt: recheck.receivedAt.toISOString(),
              processedAt: recheck.processedAt?.toISOString() || null,
            },
          };
        }
      }
      throw err;
    }
  }
}
