// ==============================================================================
// VetRx — Payment Service (Phase 13 Production Engine)
// Manages commercial payment records, integer paise validation, PayU order
// generation, cryptographically verified returns, idempotent webhook handling,
// and background reconciliation.
// ==============================================================================

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from '../lib/audit.service.js';
import { AUTHORITATIVE_PLANS } from './plan.config.js';
import { PayUAdapter } from './payu.adapter.js';
import { SubscriptionService } from './subscription.service.js';
import { EntitlementService } from './entitlement.service.js';
import type { PaymentGateway } from './payment.provider.interface.js';
import type {
  PaymentDTO,
  PaymentEventDTO,
  PaymentStatus,
  BillingInterval,
  InitiatePaymentResponseDTO,
  PaymentVerificationResponseDTO,
} from './commercial.types.js';

let defaultGatewayInstance: PaymentGateway | null = null;

export class PaymentService {
  private static mockPayments: Map<string, any> = new Map();
  private static mockEvents: Map<string, any> = new Map();

  static setMockPayment(payment: any): void {
    const full = {
      id: payment.id || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId: payment.practiceId,
      subscriptionId: payment.subscriptionId || null,
      amountPaisa: payment.amountPaisa,
      currency: payment.currency || 'INR',
      status: payment.status || 'PENDING',
      paymentProvider: payment.paymentProvider || 'PAYU',
      gatewayTransactionId: payment.gatewayTransactionId || null,
      paymentMethod: payment.paymentMethod || null,
      internalReference: payment.internalReference,
      gatewayResponseRaw: payment.gatewayResponseRaw || {},
      createdAt: payment.createdAt || new Date(),
      updatedAt: payment.updatedAt || new Date(),
    };
    this.mockPayments.set(full.id, full);
    if (full.internalReference) {
      this.mockPayments.set(full.internalReference, full);
    }
  }

  static clearMocks(): void {
    this.mockPayments.clear();
    this.mockEvents.clear();
  }

  /**
   * Resolves the active payment gateway instance (defaults to PayUAdapter).
   */
  static getDefaultGateway(): PaymentGateway {
    if (!defaultGatewayInstance) {
      defaultGatewayInstance = new PayUAdapter();
    }
    return defaultGatewayInstance;
  }

  /**
   * Allows test suites to inject mock payment gateways.
   */
  static setGateway(gateway: PaymentGateway | null): void {
    defaultGatewayInstance = gateway;
  }

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
    if (process.env.VETRX_FAST_TEST === '1') {
      const seen = new Set<string>();
      const list: any[] = [];
      for (const p of this.mockPayments.values()) {
        if (p.practiceId === practiceId && !seen.has(p.id)) {
          seen.add(p.id);
          list.push(p);
        }
      }
      return list
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((p) => this.mapToDTO(p));
    }

    const payments = await prisma.payment.findMany({
      where: { practiceId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => this.mapToDTO(p));
  }

  /**
   * Fetches a single commercial payment by ID strictly within the authenticated practice context.
   */
  static async getPaymentById(paymentId: string, practiceId: string): Promise<PaymentDTO | null> {
    if (process.env.VETRX_FAST_TEST === '1') {
      const p = this.mockPayments.get(paymentId);
      if (!p || p.practiceId !== practiceId) return null;
      return this.mapToDTO(p);
    }

    const p = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        practiceId,
      },
    });

    if (!p) return null;
    return this.mapToDTO(p);
  }

  /**
   * Initiates a payment checkout order (Phase 13).
   * Generates authoritative pricing from plan configuration, snapshotting the price
   * into a PENDING Payment record and returning signed PayU form parameters.
   */
  static async initiatePaymentOrder(params: {
    practiceId: string;
    userId: string;
    planCode: string;
    billingInterval?: BillingInterval;
    gateway?: PaymentGateway;
  }): Promise<InitiatePaymentResponseDTO> {
    const { practiceId, userId, planCode } = params;
    const gateway = params.gateway || this.getDefaultGateway();

    // 1. Validate plan code and reject Enterprise self-checkout (custom agreement required)
    if (planCode === 'ENTERPRISE') {
      throw new AppError(
        400,
        'CUSTOM_PRICING_REQUIRED',
        'Enterprise plans require a custom commercial agreement. Please contact VetRx support.'
      );
    }

    const planConfig = AUTHORITATIVE_PLANS[planCode];
    if (!planConfig) {
      throw new AppError(400, 'INVALID_PLAN', `Plan code ${planCode} is not recognized.`);
    }

    // Enforce integer paise validation on the authoritative price
    this.validatePaise(planConfig.pricePaisa);

    // 3. Generate unique internal transaction reference
    const internalReference = `TXN-VRX-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    if (process.env.VETRX_FAST_TEST === '1') {
      const activeSub = EntitlementService.getMockSubscription(practiceId);
      const payment = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        practiceId,
        subscriptionId: activeSub?.id || null,
        amountPaisa: planConfig.pricePaisa,
        currency: planConfig.currency,
        status: 'PENDING',
        paymentProvider: gateway.providerName,
        internalReference,
        gatewayResponseRaw: {
          planCode: planConfig.code,
          planName: planConfig.name,
          billingInterval: planConfig.interval,
          pricePaisa: planConfig.pricePaisa,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.setMockPayment(payment);

      const orderResponse = await gateway.createPaymentOrder({
        practiceId,
        subscriptionId: activeSub?.id,
        amountPaisa: planConfig.pricePaisa,
        currency: planConfig.currency,
        customerName: 'Practitioner',
        customerEmail: 'doctor@vetrx.in',
        productInfo: `VetRx ${planConfig.name} (${planConfig.interval})`,
        returnUrl: '',
        cancelUrl: '',
        internalReference,
        planCode: planConfig.code,
        billingInterval: planConfig.interval,
      });

      return {
        payment: this.mapToDTO(payment),
        checkoutUrl: orderResponse.redirectUrl || '',
        formParameters: orderResponse.formParameters || {},
      };
    }

    // 4. Create internal Payment record in PENDING state
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const settings = await prisma.practiceSettings.findUnique({
      where: { practiceId },
    });

    const activeSub = await prisma.subscription.findFirst({
      where: { practiceId },
      orderBy: { createdAt: 'desc' },
    });

    const payment = await prisma.payment.create({
      data: {
        practiceId,
        subscriptionId: activeSub?.id || null,
        amountPaisa: planConfig.pricePaisa,
        currency: planConfig.currency,
        status: 'PENDING',
        paymentProvider: gateway.providerName,
        internalReference,
        gatewayResponseRaw: {
          planCode: planConfig.code,
          planName: planConfig.name,
          billingInterval: planConfig.interval,
          pricePaisa: planConfig.pricePaisa,
        },
      },
    });

    void AuditService.record({
      practiceId,
      action: 'PAYMENT_INITIATED',
      resource: 'Payment',
      resourceId: payment.id,
      details: {
        planCode: planConfig.code,
        amountPaisa: planConfig.pricePaisa,
        internalReference,
      },
    });

    // 5. Delegate to gateway adapter for signed checkout parameters
    const orderResponse = await gateway.createPaymentOrder({
      practiceId,
      subscriptionId: activeSub?.id,
      amountPaisa: planConfig.pricePaisa,
      currency: planConfig.currency,
      customerName: user?.name || 'Practitioner',
      customerEmail: user?.email || 'doctor@vetrx.in',
      customerPhone: settings?.phone || undefined,
      productInfo: `VetRx ${planConfig.name} (${planConfig.interval})`,
      returnUrl: '',
      cancelUrl: '',
      internalReference,
      planCode: planConfig.code,
      billingInterval: planConfig.interval,
    });

    return {
      payment: this.mapToDTO(payment),
      checkoutUrl: orderResponse.redirectUrl || '',
      formParameters: orderResponse.formParameters || {},
    };
  }

  /**
   * Initiates a PayU free-trial recurring mandate authorization order.
   * PayU Hosted Checkout recurring registration documentation specifies:
   * Cards: ₹2.00 (200 paise) authorization
   * UPI: ₹2.00 (200 paise) authorization
   * Net Banking: ₹0.00 (0 paise) authorization
   * This is an authorization verification transaction and is NOT subscription revenue.
   * Subscription fee during trial remains ₹0.
   */
  static async initiateTrialAuthorization(params: {
    practiceId: string;
    userId: string;
    planCode: string;
    billingInterval?: BillingInterval;
    instrumentType?: 'CARD' | 'UPI' | 'NETBANKING';
    gateway?: PaymentGateway;
  }): Promise<InitiatePaymentResponseDTO> {
    const { practiceId, userId, planCode, instrumentType } = params;
    const gateway = params.gateway || this.getDefaultGateway();

    const planConfig = AUTHORITATIVE_PLANS[planCode];
    if (!planConfig) {
      throw new AppError(400, 'INVALID_PLAN', `Plan code ${planCode} is not recognized.`);
    }

    // PayU recurring registration amount rules: NetBanking = 0, Cards/UPI = ₹2.00 (200 paise)
    const authAmountPaisa = instrumentType === 'NETBANKING' ? 0 : 200;
    const internalReference = `AUTH-VRX-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    if (process.env.VETRX_FAST_TEST === '1') {
      const activeSub = EntitlementService.getMockSubscription(practiceId);
      const payment = {
        id: `pay_auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        practiceId,
        subscriptionId: activeSub?.id || null,
        amountPaisa: authAmountPaisa,
        currency: 'INR',
        status: 'PENDING',
        paymentProvider: gateway.providerName,
        internalReference,
        gatewayResponseRaw: {
          isTrialMandateAuth: true,
          planCode: planConfig.code,
          planName: planConfig.name,
          billingInterval: planConfig.interval,
          targetPlanPricePaisa: planConfig.pricePaisa,
          authAmountPaisa,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.setMockPayment(payment);

      const orderResponse = await gateway.createPaymentOrder({
        practiceId,
        subscriptionId: activeSub?.id,
        amountPaisa: authAmountPaisa,
        currency: 'INR',
        customerName: 'Practitioner',
        customerEmail: 'doctor@vetrx.in',
        productInfo: `VetRx 14-Day Trial Recurring Authorization - ${planConfig.name}`,
        returnUrl: '',
        cancelUrl: '',
        internalReference,
        planCode: planConfig.code,
        billingInterval: planConfig.interval,
      });

      return {
        payment: this.mapToDTO(payment),
        checkoutUrl: orderResponse.redirectUrl || '',
        formParameters: orderResponse.formParameters || {},
      };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const settings = await prisma.practiceSettings.findUnique({ where: { practiceId } });
    const activeSub = await prisma.subscription.findFirst({
      where: { practiceId },
      orderBy: { createdAt: 'desc' },
    });

    const payment = await prisma.payment.create({
      data: {
        practiceId,
        subscriptionId: activeSub?.id || null,
        amountPaisa: authAmountPaisa,
        currency: 'INR',
        status: 'PENDING',
        paymentProvider: gateway.providerName,
        internalReference,
        gatewayResponseRaw: {
          isTrialMandateAuth: true,
          planCode: planConfig.code,
          planName: planConfig.name,
          billingInterval: planConfig.interval,
          targetPlanPricePaisa: planConfig.pricePaisa,
          authAmountPaisa,
        },
      },
    });

    void AuditService.record({
      practiceId,
      action: 'TRIAL_MANDATE_AUTH_INITIATED',
      resource: 'Payment',
      resourceId: payment.id,
      details: {
        targetPlanCode: planConfig.code,
        authAmountPaisa,
        internalReference,
      },
    });

    const orderResponse = await gateway.createPaymentOrder({
      practiceId,
      subscriptionId: activeSub?.id,
      amountPaisa: authAmountPaisa,
      currency: 'INR',
      customerName: user?.name || 'Practitioner',
      customerEmail: user?.email || 'doctor@vetrx.in',
      customerPhone: settings?.phone || undefined,
      productInfo: `VetRx 14-Day Trial Recurring Authorization - ${planConfig.name}`,
      returnUrl: '',
      cancelUrl: '',
      internalReference,
      planCode: planConfig.code,
      billingInterval: planConfig.interval,
    });

    return {
      payment: this.mapToDTO(payment),
      checkoutUrl: orderResponse.redirectUrl || '',
      formParameters: orderResponse.formParameters || {},
    };
  }

  /**
   * Verifies an inbound browser return/callback from PayU and applies subscription effects.
   */
  static async verifyPaymentReturn(params: {
    practiceId: string;
    payload: Record<string, unknown>;
    gateway?: PaymentGateway;
  }): Promise<PaymentVerificationResponseDTO> {
    const { practiceId, payload } = params;
    const gateway = params.gateway || this.getDefaultGateway();

    const txnid = (payload.txnid as string) || '';
    if (!txnid) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing transaction reference (txnid) in return payload.');
    }

    // 1. Locate internal payment record
    let payment: any;
    if (process.env.VETRX_FAST_TEST === '1') {
      payment = this.mockPayments.get(txnid);
    } else {
      payment = await prisma.payment.findUnique({
        where: { internalReference: txnid },
        include: { subscription: true },
      });
    }

    if (!payment) {
      throw new AppError(404, 'NOT_FOUND', `Payment record for reference ${txnid} not found.`);
    }

    // 2. Strict Tenant Isolation Invariant: Reject cross-tenant payment verification
    if (payment.practiceId !== practiceId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied: Payment record belongs to a different tenant.');
    }

    // If already marked SUCCESS, return idempotent confirmation without duplicate transitions
    if (payment.status === 'SUCCESS') {
      const sub = await SubscriptionService.getPracticeSubscription(practiceId);
      return {
        isVerified: true,
        status: 'SUCCESS',
        payment: this.mapToDTO(payment),
        subscription: sub,
        message: 'Payment has already been verified and processed.',
      };
    }

    // 3. Cryptographically verify callback payload (reverse SHA-512)
    const verification = await gateway.verifyCallback(payload);

    // 4. Amount tampering protection: verify returned amount matches expected price
    if (
      verification.isVerified &&
      verification.amountPaisa > 0 &&
      verification.amountPaisa !== payment.amountPaisa
    ) {
      await this.recordPaymentEvent({
        provider: gateway.providerName,
        eventId: `${txnid}-tampered-amount`,
        eventType: 'PAYMENT_AMOUNT_MISMATCH',
        rawPayload: payload,
        paymentId: payment.id,
      });

      if (process.env.VETRX_FAST_TEST === '1') {
        payment.status = 'FAILED';
        payment.gatewayResponseRaw = {
          ...((payment.gatewayResponseRaw as any) || {}),
          tamperingError: `Amount mismatch: expected ${payment.amountPaisa} paise, received ${verification.amountPaisa} paise.`,
        };
        this.setMockPayment(payment);
      } else {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            gatewayResponseRaw: {
              ...((payment.gatewayResponseRaw as any) || {}),
              tamperingError: `Amount mismatch: expected ${payment.amountPaisa} paise, received ${verification.amountPaisa} paise.`,
            },
          },
        });
      }

      throw new AppError(
        400,
        'PAYMENT_AMOUNT_MISMATCH',
        'Paid amount does not match authoritative plan price.'
      );
    }

    // 5. Idempotently log the event in PaymentEvent
    const eventId = verification.gatewayTransactionId || txnid;
    await this.recordPaymentEvent({
      provider: gateway.providerName,
      eventId,
      eventType: verification.isVerified && verification.status === 'SUCCESS' ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
      rawPayload: payload,
      paymentId: payment.id,
    });

    if (verification.isVerified && verification.status === 'SUCCESS') {
      const isTrialAuth = (payment.gatewayResponseRaw as any)?.isTrialMandateAuth === true;
      const receiptNumber = !isTrialAuth
        ? `REC-VRX-${new Date().getFullYear()}-${payment.id.slice(-6).toUpperCase()}`
        : null;

      let updatedPayment = payment;
      if (process.env.VETRX_FAST_TEST === '1') {
        payment.status = isTrialAuth ? 'AUTHORIZED' : 'SUCCESS';
        payment.gatewayTransactionId = verification.gatewayTransactionId;
        payment.paymentMethod = verification.paymentMode || 'ONLINE';
        payment.gatewayResponseRaw = {
          ...((payment.gatewayResponseRaw as any) || {}),
          returnPayload: payload,
          verifiedAt: new Date().toISOString(),
          receiptNumber,
        };
        this.setMockPayment(payment);
        updatedPayment = payment;
      } else {
        updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: isTrialAuth ? 'AUTHORIZED' : 'SUCCESS',
            gatewayTransactionId: verification.gatewayTransactionId,
            paymentMethod: verification.paymentMode || 'ONLINE',
            gatewayResponseRaw: {
              ...((payment.gatewayResponseRaw as any) || {}),
              returnPayload: payload,
              verifiedAt: new Date().toISOString(),
              receiptNumber,
            },
          },
        });
      }

      if (isTrialAuth) {
        // Activate 14-day trial with PayU recurring mandate
        const raw = (payment.gatewayResponseRaw as any) || {};
        const updatedSub = await SubscriptionService.activateTrialWithMandate({
          practiceId,
          mandateRef: verification.gatewayTransactionId,
          targetPlanCode: raw.planCode,
          targetBillingInterval: raw.billingInterval,
          paymentMode: verification.paymentMode,
        });

        void AuditService.record({
          practiceId,
          action: 'TRIAL_MANDATE_AUTH_SUCCESS',
          resource: 'Payment',
          resourceId: payment.id,
          details: { txnid, mandateRef: verification.gatewayTransactionId },
        });

        return {
          isVerified: true,
          status: 'AUTHORIZED',
          payment: this.mapToDTO(updatedPayment),
          subscription: updatedSub,
          message: 'PayU recurring mandate successfully authorized. 14-day free trial activated.',
        };
      } else {
        // Activate or upgrade subscription
        const planCode = (payment.gatewayResponseRaw as any)?.planCode;
        const updatedSub = await SubscriptionService.activateFromPayment({
          practiceId,
          paymentId: payment.id,
          gatewayTransactionId: verification.gatewayTransactionId,
          planCode,
        });

        void AuditService.record({
          practiceId,
          action: 'PAYMENT_SUCCESS',
          resource: 'Payment',
          resourceId: payment.id,
          details: { txnid, receiptNumber, amountPaisa: payment.amountPaisa, gatewayTxnId: verification.gatewayTransactionId },
        });

        return {
          isVerified: true,
          status: 'SUCCESS',
          payment: this.mapToDTO(updatedPayment),
          subscription: updatedSub,
          message: 'Payment verified and subscription successfully activated.',
        };
      }
    } else {
      let updatedPayment = payment;
      if (process.env.VETRX_FAST_TEST === '1') {
        payment.status = 'FAILED';
        payment.gatewayTransactionId = verification.gatewayTransactionId || null;
        payment.gatewayResponseRaw = {
          ...((payment.gatewayResponseRaw as any) || {}),
          returnPayload: payload,
          failedAt: new Date().toISOString(),
          error: verification.errorMessage,
        };
        this.setMockPayment(payment);
        updatedPayment = payment;
      } else {
        updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            gatewayTransactionId: verification.gatewayTransactionId || null,
            gatewayResponseRaw: {
              ...((payment.gatewayResponseRaw as any) || {}),
              returnPayload: payload,
              failedAt: new Date().toISOString(),
              error: verification.errorMessage,
            },
          },
        });
      }

      await SubscriptionService.recordPaymentFailure(practiceId, payment.id, verification.errorMessage);

      void AuditService.record({
        practiceId,
        action: 'PAYMENT_FAILED',
        resource: 'Payment',
        resourceId: payment.id,
        details: { txnid, error: verification.errorMessage },
      });

      return {
        isVerified: false,
        status: 'FAILED',
        payment: this.mapToDTO(updatedPayment),
        subscription: null,
        message: verification.errorMessage || 'Payment verification failed.',
      };
    }
  }

  /**
   * Processes an asynchronous server-to-server webhook from PayU.
   */
  static async processWebhook(params: {
    payload: Record<string, unknown>;
    signature?: string;
    gateway?: PaymentGateway;
  }): Promise<{ status: string; eventId: string }> {
    const { payload, signature } = params;
    const gateway = params.gateway || this.getDefaultGateway();

    const txnid = (payload.txnid as string) || '';
    const eventId = (payload.mihpayid as string) || txnid || `evt-${Date.now()}`;

    // 1. Idempotency check: if event already recorded, ignore safely
    if (process.env.VETRX_FAST_TEST === '1') {
      const key = `${gateway.providerName}:${eventId}`;
      if (this.mockEvents.has(key)) {
        return { status: 'DUPLICATE_IGNORED', eventId };
      }

      const verification = await gateway.verifyWebhook(payload, signature);

      await this.recordPaymentEvent({
        provider: gateway.providerName,
        eventId,
        eventType: verification.isVerified && verification.status === 'SUCCESS' ? 'WEBHOOK_PAYMENT_SUCCESS' : 'WEBHOOK_PAYMENT_FAILED',
        rawPayload: payload,
      });

      if (!verification.isVerified || verification.status !== 'SUCCESS') {
        return { status: 'FAILED_HASH_OR_STATUS', eventId };
      }

      if (txnid) {
        const payment = this.mockPayments.get(txnid);
        if (payment && payment.status !== 'SUCCESS') {
          payment.status = 'SUCCESS';
          payment.gatewayTransactionId = verification.gatewayTransactionId;
          payment.gatewayResponseRaw = { ...((payment.gatewayResponseRaw as any) || {}), webhookPayload: payload };
          this.setMockPayment(payment);

          const planCode = (payment.gatewayResponseRaw as any)?.planCode;
          await SubscriptionService.activateFromPayment({
            practiceId: payment.practiceId,
            paymentId: payment.id,
            gatewayTransactionId: verification.gatewayTransactionId,
            planCode,
          });
        }
      }

      return { status: 'PROCESSED', eventId };
    }

    const existing = await prisma.paymentEvent.findUnique({
      where: {
        provider_eventId: {
          provider: gateway.providerName,
          eventId,
        },
      },
    });

    if (existing) {
      return { status: 'DUPLICATE_IGNORED', eventId };
    }

    // 2. Validate webhook cryptographic signature
    const verification = await gateway.verifyWebhook(payload, signature);

    // 3. Record event
    await this.recordPaymentEvent({
      provider: gateway.providerName,
      eventId,
      eventType: verification.isVerified && verification.status === 'SUCCESS' ? 'WEBHOOK_PAYMENT_SUCCESS' : 'WEBHOOK_PAYMENT_FAILED',
      rawPayload: payload,
    });

    if (!verification.isVerified || verification.status !== 'SUCCESS') {
      return { status: 'FAILED_HASH_OR_STATUS', eventId };
    }

    // 4. If transaction matches internal payment, update it and activate subscription
    if (txnid) {
      const payment = await prisma.payment.findUnique({
        where: { internalReference: txnid },
      });

      if (payment && payment.status !== 'SUCCESS') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCESS',
            gatewayTransactionId: verification.gatewayTransactionId,
            gatewayResponseRaw: { ...((payment.gatewayResponseRaw as any) || {}), webhookPayload: payload },
          },
        });

        const planCode = (payment.gatewayResponseRaw as any)?.planCode;
        await SubscriptionService.activateFromPayment({
          practiceId: payment.practiceId,
          paymentId: payment.id,
          gatewayTransactionId: verification.gatewayTransactionId,
          planCode,
        });
      }
    }

    return { status: 'PROCESSED', eventId };
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
    const payloadString = rawPayload ? JSON.stringify(rawPayload) : '';
    const payloadHash = payloadString
      ? crypto.createHash('sha256').update(payloadString).digest('hex')
      : null;

    if (process.env.VETRX_FAST_TEST === '1') {
      const key = `${provider}:${eventId}`;
      if (this.mockEvents.has(key)) {
        return {
          isDuplicate: true,
          event: this.mockEvents.get(key),
        };
      }
      const newEvt: PaymentEventDTO = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        paymentId: paymentId || null,
        provider,
        eventId,
        eventType,
        payloadHash,
        rawPayload: rawPayload || null,
        processingStatus: 'PROCESSED',
        errorMessage: null,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      };
      this.mockEvents.set(key, newEvt);
      return {
        isDuplicate: false,
        event: newEvt,
      };
    }

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

  /**
   * Background reconciliation for stale pending payments.
   */
  static async reconcilePendingPayments(gateway?: PaymentGateway): Promise<number> {
    const gw = gateway || this.getDefaultGateway();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pending = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          lte: fifteenMinutesAgo,
          gte: twentyFourHoursAgo,
        },
      },
    });

    let count = 0;
    for (const p of pending) {
      try {
        const res = await gw.getPaymentStatus(p.internalReference);
        if (res.isVerified && res.status === 'SUCCESS') {
          await prisma.payment.update({
            where: { id: p.id },
            data: {
              status: 'SUCCESS',
              gatewayTransactionId: res.gatewayTransactionId,
            },
          });

          const planCode = (p.gatewayResponseRaw as any)?.planCode;
          await SubscriptionService.activateFromPayment({
            practiceId: p.practiceId,
            paymentId: p.id,
            gatewayTransactionId: res.gatewayTransactionId,
            planCode,
          });

          count++;
        } else if (res.status === 'FAILED') {
          await prisma.payment.update({
            where: { id: p.id },
            data: { status: 'FAILED' },
          });
          count++;
        }
      } catch {
        // Continue processing remaining records
      }
    }
    return count;
  }

  /**
   * Generates or fetches authoritative payment receipt details for a confirmed payment.
   * Strictly enforces tenant isolation: cross-tenant receipt access is rejected.
   */
  static async getPaymentReceipt(paymentId: string, practiceId: string): Promise<any> {
    const payment = await this.getPaymentById(paymentId, practiceId);
    if (!payment) {
      throw new AppError(404, 'NOT_FOUND', 'Payment record not found.');
    }
    if (payment.status !== 'SUCCESS') {
      throw new AppError(400, 'RECEIPT_NOT_AVAILABLE', 'Receipt is only available for confirmed successful payments.');
    }

    let practiceName = 'Veterinary Practice';
    let customerName = 'Practice Owner';
    let billingEmail = 'doctor@vetrx.in';
    let billingPhone = '';
    let subscriptionPeriod = '';

    if (process.env.VETRX_FAST_TEST !== '1') {
      const practice = await prisma.practice.findUnique({
        where: { id: practiceId },
        include: {
          settings: true,
          owner: true,
        },
      });
      if (practice) {
        practiceName = practice.name;
        customerName = practice.owner?.name || customerName;
        billingEmail = practice.settings?.email || practice.owner?.email || billingEmail;
        billingPhone = practice.settings?.phone || '';
      }
    }

    if (payment.subscriptionId && process.env.VETRX_FAST_TEST !== '1') {
      try {
        const sub = await prisma.subscription.findUnique({
          where: { id: payment.subscriptionId },
        });
        if (sub) {
          subscriptionPeriod = `${new Date(sub.currentPeriodStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
      } catch (e) {
        // Safe fallback
      }
    }

    const raw = (payment.gatewayResponseRaw as any) || {};
    const planName = raw.planName || 'VetRx Subscription';
    const billingInterval = raw.billingInterval || 'Standard';
    const receiptNumber = payment.receiptNumber || `REC-VRX-${new Date(payment.createdAt).getFullYear()}-${payment.id.slice(-6).toUpperCase()}`;

    const receipt = {
      receiptNumber,
      paidAt: payment.createdAt,
      paymentId: payment.id,
      internalReference: payment.internalReference,
      gatewayTransactionId: payment.gatewayTransactionId || payment.internalReference,
      practiceName,
      customerName,
      billingEmail,
      billingPhone: billingPhone || undefined,
      planName,
      billingInterval,
      subscriptionPeriod: subscriptionPeriod || raw.subscriptionPeriod || undefined,
      amountPaisa: payment.amountPaisa,
      amountRupees: (payment.amountPaisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      currency: 'INR',
      paymentMethod: payment.paymentMethod || 'Online Payment',
      status: 'PAID' as const,
      entityName: 'Alungal Shameem, operator of VetRx',
      entityAddress: 'Nasheman, Chemmaniyode PO, Malappuram DT, Kerala - 679325, India',
      taxNotice: 'Applicable taxes, if any, will be reflected in the applicable invoice.',
    };

    return receipt;
  }

  /**
   * Generates a clean, professional, print/PDF-ready HTML layout for the payment receipt.
   */
  static generateReceiptHtml(receipt: any): string {
    let logoSrc = receipt.logoBase64 || '';
    if (!logoSrc) {
      try {
        const logoPath = path.resolve('web/public/vetrx_logo_horizontal.png');
        if (fs.existsSync(logoPath)) {
          const b64 = fs.readFileSync(logoPath).toString('base64');
          logoSrc = `data:image/png;base64,${b64}`;
        }
      } catch (e) {
        // Fallback to URL
        logoSrc = 'https://app.vetrx.brightbase.in/vetrx_logo_horizontal.png';
      }
    }
    if (!logoSrc) {
      logoSrc = 'https://app.vetrx.brightbase.in/vetrx_logo_horizontal.png';
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Receipt - ${receipt.receiptNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; color: #0f172a; margin: 0; padding: 40px; background: #f8fafc; }
    .receipt-container { max-width: 720px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #00685f; padding-bottom: 24px; margin-bottom: 24px; }
    .brand-title { font-size: 26px; font-weight: 800; color: #00685f; margin: 0; }
    .brand-sub { font-size: 13px; color: #475569; margin-top: 4px; }
    .receipt-badge { background: #ccfbf1; color: #0f766e; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px; }
    .value { font-size: 15px; font-weight: 700; color: #0f172a; }
    .table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .table th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
    .table td { padding: 14px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b; }
    .total-row { font-size: 17px; font-weight: 800; color: #00685f; }
    .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.6; }
    .print-btn { display: block; margin: 24px auto 0; padding: 10px 24px; background: #00685f; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; }
    @media print { .print-btn { display: none; } body { background: #fff; padding: 0; } .receipt-container { border: none; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div style="display: flex; align-items: center; gap: 16px;">
        <img src="${logoSrc}" alt="VetRx Stitch Logo" style="height: 48px; width: auto; max-width: 190px; object-fit: contain;" />
        <div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px;">${receipt.entityName}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${receipt.entityAddress}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span class="receipt-badge">${receipt.status || 'PAID'}</span>
        <div style="font-size: 13px; font-weight: 700; margin-top: 8px;">Receipt #${receipt.receiptNumber}</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Payment Date: ${new Date(receipt.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div class="label">Billed To Practice</div>
        <div class="value">${receipt.practiceName}</div>
        ${receipt.customerName ? `<div style="font-size: 13px; font-weight: 600; color: #334155; margin-top: 2px;">Customer: ${receipt.customerName}</div>` : ''}
        <div style="font-size: 13px; color: #64748b;">${receipt.billingEmail}</div>
        ${receipt.billingPhone ? `<div style="font-size: 12px; color: #64748b;">Phone: ${receipt.billingPhone}</div>` : ''}
      </div>
      <div>
        <div class="label">Payment Details</div>
        <div class="value">Payment Status: <span style="color: #00685f; font-weight: 700;">${receipt.status || 'PAID'}</span></div>
        <div style="font-size: 13px; color: #334155; margin-top: 2px;">Method: ${receipt.paymentMethod}</div>
        <div style="font-size: 12px; color: #64748b; font-family: monospace;">Ref: ${receipt.gatewayTransactionId}</div>
        ${receipt.subscriptionPeriod ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Coverage: ${receipt.subscriptionPeriod}</div>` : ''}
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Billing Cycle</th>
          <th style="text-align: right;">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${receipt.planName}</strong>
            ${receipt.subscriptionPeriod ? `<div style="font-size: 12px; color: #64748b; margin-top: 3px;">Coverage Period: ${receipt.subscriptionPeriod}</div>` : ''}
          </td>
          <td>${receipt.billingInterval}</td>
          <td style="text-align: right; font-weight: 600;">₹${receipt.amountRupees}</td>
        </tr>
        <tr>
          <td colspan="2" style="text-align: right; font-weight: 700;">Total Paid:</td>
          <td style="text-align: right;" class="total-row">₹${receipt.amountRupees}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <p><strong>${receipt.taxNotice}</strong></p>
      <p>Thank you for choosing VetRx operated by Alungal Shameem.</p>
      <p>Questions? Contact support: <a href="mailto:supportvetrx@gmail.com" style="color: #00685f;">supportvetrx@gmail.com</a></p>
    </div>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;
  }

  private static mapToDTO(p: any): PaymentDTO {
    const raw = (p.gatewayResponseRaw as Record<string, unknown>) || null;
    const isSuccess = p.status === 'SUCCESS';
    const receiptNumber = isSuccess
      ? ((raw as any)?.receiptNumber || `REC-VRX-${new Date(p.createdAt).getFullYear()}-${p.id.slice(-6).toUpperCase()}`)
      : null;

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
      receiptNumber,
      isReceiptAvailable: isSuccess,
      gatewayResponseRaw: raw,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : new Date(p.createdAt).toISOString(),
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : new Date(p.updatedAt).toISOString(),
    };
  }
}
