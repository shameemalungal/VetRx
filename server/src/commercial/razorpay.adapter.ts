// ==============================================================================
// VetRx — Razorpay Gateway Adapter
// Provider-specific implementation of the PaymentGateway boundary interface
// for Razorpay Standard Web Checkout.
// ==============================================================================

import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  PaymentGateway,
  PaymentOrderRequest,
  PaymentOrderResponse,
  VerifiedPaymentResult,
} from './payment.provider.interface.js';

export interface RazorpayAdapterConfig {
  keyId?: string;
  keySecret?: string;
}

export class RazorpayAdapter implements PaymentGateway {
  readonly providerName = 'RAZORPAY';
  private keyId: string;
  private keySecret: string;
  private client: Razorpay | null = null;

  constructor(customConfig?: RazorpayAdapterConfig) {
    this.keyId = (customConfig?.keyId || env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '').replace(/^["']|["']$/g, '').trim();
    this.keySecret = (customConfig?.keySecret || env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '').replace(/^["']|["']$/g, '').trim();

    if (this.keyId && this.keySecret && this.keyId !== 'MOCK_KEY') {
      try {
        this.client = new Razorpay({
          key_id: this.keyId,
          key_secret: this.keySecret,
        });
      } catch (err: any) {
        logger.warn('Failed to initialize Razorpay SDK instance in adapter', { error: err.message });
      }
    }
  }

  /**
   * Initializes a payment order through the Razorpay API.
   * Generates order_id and returns parameters required for Razorpay Standard Checkout.
   */
  async createPaymentOrder(order: PaymentOrderRequest): Promise<PaymentOrderResponse> {
    const txnid =
      order.internalReference ||
      `TXN-VRX-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const amountPaisa = Math.round(order.amountPaisa);

    // Mock orders are permitted only in explicit test mode.
    if (process.env.VETRX_FAST_TEST === '1') {
      const mockOrderId = `order_mock_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      return {
        internalReference: txnid,
        gatewayTransactionId: mockOrderId,
        redirectUrl: '',
        formParameters: {
          key_id: this.keyId || 'rzp_test_mock',
          order_id: mockOrderId,
          amount: String(amountPaisa),
          currency: order.currency || 'INR',
          name: 'VetRx Practice Subscription',
          description: order.productInfo || `VetRx ${order.planCode || 'Subscription'}`,
        },
      };
    }

    if (
      !this.client ||
      !this.keyId ||
      !this.keySecret ||
      this.keyId === 'MOCK_KEY'
    ) {
      logger.error('Razorpay production configuration is incomplete', {
        clientInitialized: Boolean(this.client),
        keyIdPresent: Boolean(this.keyId),
        keySecretPresent: Boolean(this.keySecret),
      });

      throw new AppError(
        503,
        'RAZORPAY_NOT_CONFIGURED',
        'Online payments are temporarily unavailable. Please contact support.'
      );
    }

    try {
      const razorpayOrder = await this.client.orders.create({
        amount: amountPaisa,
        currency: order.currency || 'INR',
        receipt: txnid,
        notes: {
          practiceId: order.practiceId,
          planCode: order.planCode || '',
          billingInterval: order.billingInterval || '',
          subscriptionId: order.subscriptionId || '',
          internalReference: txnid,
        },
      });

      logger.info('Razorpay order created via adapter', {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: txnid,
      });

      return {
        internalReference: txnid,
        gatewayTransactionId: razorpayOrder.id,
        redirectUrl: '',
        formParameters: {
          key_id: this.keyId,
          order_id: razorpayOrder.id,
          amount: String(razorpayOrder.amount),
          currency: razorpayOrder.currency,
          name: 'VetRx Practice Subscription',
          description: order.productInfo || `VetRx ${order.planCode || 'Subscription'}`,
        },
      };
    } catch (err: any) {
      logger.error('Razorpay order creation failed in adapter', {
        error: err.message || err,
        statusCode: err.statusCode,
      });
      throw new AppError(
        err.statusCode || 500,
        'RAZORPAY_ORDER_FAILED',
        err.error?.description || err.message || 'Failed to create Razorpay checkout order.'
      );
    }
  }

  /**
   * Cryptographically verifies an inbound Razorpay payment signature.
   * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, keySecret)
   */
  async verifyCallback(payload: Record<string, unknown>): Promise<VerifiedPaymentResult> {
    const order_id = (payload.razorpay_order_id as string) || (payload.order_id as string) || '';
    const payment_id = (payload.razorpay_payment_id as string) || (payload.payment_id as string) || '';
    const signature = (payload.razorpay_signature as string) || (payload.signature as string) || '';
    const internalReference = (payload.internalReference as string) || (payload.receipt as string) || '';

    if (!order_id || !payment_id || !signature) {
      return {
        isVerified: false,
        gatewayTransactionId: payment_id,
        internalReference,
        amountPaisa: 0,
        currency: 'INR',
        status: 'FAILED',
        rawPayload: payload,
        errorMessage: 'MISSING_FIELDS: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
      };
    }

    if (!this.keySecret) {
      logger.error('Cannot verify Razorpay signature: RAZORPAY_KEY_SECRET is not configured');
      return {
        isVerified: false,
        gatewayTransactionId: payment_id,
        internalReference,
        amountPaisa: 0,
        currency: 'INR',
        status: 'FAILED',
        rawPayload: payload,
        errorMessage: 'CONFIGURATION_ERROR: RAZORPAY_KEY_SECRET is missing on the server.',
      };
    }

    // 1. Verify HMAC-SHA256 signature
    const body = `${order_id}|${payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    let isSignatureValid = false;
    if (expectedBuffer.length === signatureBuffer.length) {
      isSignatureValid = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    }

    if (!isSignatureValid) {
      logger.warn('Razorpay signature mismatch in adapter', { order_id, payment_id });
      return {
        isVerified: false,
        gatewayTransactionId: payment_id,
        internalReference,
        amountPaisa: 0,
        currency: 'INR',
        status: 'FAILED',
        rawPayload: payload,
        errorMessage: 'SIGNATURE_MISMATCH: Cryptographic HMAC-SHA256 signature verification failed.',
      };
    }

    // 2. Fetch authoritative payment details from Razorpay if client is available
    let verifiedAmountPaisa = 0;
    let paymentMode = 'ONLINE';
    let isStatusSuccess = true;

    if (this.client && process.env.VETRX_FAST_TEST !== '1') {
      try {
        const paymentDetails = await this.client.payments.fetch(payment_id);
        verifiedAmountPaisa = Number(paymentDetails.amount);
        paymentMode = (paymentDetails.method as string) || 'ONLINE';
        const rawStatus = (paymentDetails.status as string)?.toLowerCase();
        isStatusSuccess = rawStatus === 'captured' || rawStatus === 'authorized';

        if (!isStatusSuccess) {
          return {
            isVerified: false,
            gatewayTransactionId: payment_id,
            internalReference,
            amountPaisa: verifiedAmountPaisa,
            currency: paymentDetails.currency || 'INR',
            status: 'FAILED',
            paymentMode,
            rawPayload: paymentDetails as any,
            errorMessage: `Payment status is '${paymentDetails.status}', expected captured/authorized.`,
          };
        }
      } catch (fetchErr: any) {
        logger.error('Error fetching payment details from Razorpay API', {
          payment_id,
          error: fetchErr.message,
        });
        // If unable to query network (e.g. rate limit or sandbox), signature is still valid
      }
    }

    return {
      isVerified: true,
      gatewayTransactionId: payment_id,
      internalReference,
      amountPaisa: verifiedAmountPaisa,
      currency: 'INR',
      status: 'SUCCESS',
      paymentMode,
      rawPayload: payload,
    };
  }

  /**
   * Verifies an asynchronous server-to-server webhook notification from Razorpay.
   */
  async verifyWebhook(payload: Record<string, unknown>, signature?: string): Promise<VerifiedPaymentResult> {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || this.keySecret;
    const paymentEntity = (payload.payload as any)?.payment?.entity || (payload as any).entity || payload;
    const payment_id = paymentEntity.id || '';
    const order_id = paymentEntity.order_id || '';
    const amountPaisa = Number(paymentEntity.amount || 0);

    if (signature && webhookSecret) {
      const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', webhookSecret).update(rawString).digest('hex');
      if (expected !== signature) {
        return {
          isVerified: false,
          gatewayTransactionId: payment_id,
          internalReference: order_id,
          amountPaisa,
          currency: 'INR',
          status: 'FAILED',
          rawPayload: payload,
          errorMessage: 'WEBHOOK_SIGNATURE_INVALID',
        };
      }
    }

    const event = (payload.event as string) || '';
    const isSuccess = event === 'payment.captured' || event === 'order.paid' || paymentEntity.status === 'captured';

    return {
      isVerified: true,
      gatewayTransactionId: payment_id,
      internalReference: order_id,
      amountPaisa,
      currency: 'INR',
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      paymentMode: paymentEntity.method || 'ONLINE',
      rawPayload: payload,
    };
  }

  /**
   * Queries Razorpay for payment status directly.
   */
  async getPaymentStatus(paymentId: string): Promise<VerifiedPaymentResult> {
    if (!this.client || process.env.VETRX_FAST_TEST === '1') {
      return {
        isVerified: true,
        gatewayTransactionId: paymentId,
        internalReference: '',
        amountPaisa: 0,
        currency: 'INR',
        status: 'SUCCESS',
        rawPayload: { mock: true, paymentId },
      };
    }

    try {
      const payment = await this.client.payments.fetch(paymentId);
      const isSuccess = payment.status === 'captured' || payment.status === 'authorized';
      return {
        isVerified: isSuccess,
        gatewayTransactionId: payment.id,
        internalReference: payment.order_id || '',
        amountPaisa: Number(payment.amount),
        currency: payment.currency,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        paymentMode: (payment.method as string) || 'ONLINE',
        rawPayload: payment as any,
        errorMessage: isSuccess ? undefined : `Payment status is ${payment.status}`,
      };
    } catch (err: any) {
      return {
        isVerified: false,
        gatewayTransactionId: paymentId,
        internalReference: '',
        amountPaisa: 0,
        currency: 'INR',
        status: 'FAILED',
        rawPayload: { error: err.message },
        errorMessage: err.message,
      };
    }
  }
}
