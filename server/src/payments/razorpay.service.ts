// ==============================================================================
// VetRx — Razorpay Payment Gateway Service
// Official Razorpay SDK Integration for Order Creation and Signature Verification
// ==============================================================================

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export interface CreateOrderParams {
  amount: number; // in paise
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  order_id: string;
  amount: number;
  currency: string;
}

export interface VerifySignatureParams {
  order_id: string;
  payment_id: string;
  signature: string;
}

export class RazorpayService {
  private static instance: Razorpay | null = null;

  /**
   * Returns or initializes the Razorpay SDK instance.
   */
  public static getClient(): Razorpay {
    const keyId = (env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '').replace(/^["']|["']$/g, '').trim();
    const keySecret = (env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '').replace(/^["']|["']$/g, '').trim();

    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_CREDENTIALS_MISSING');
    }

    if (!this.instance) {
      this.instance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }

    return this.instance;
  }

  /**
   * Creates a new Razorpay order.
   * Minimum order amount: 100 paise (₹1.00).
   */
  public static async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const { amount, currency = 'INR', receipt, notes } = params;

    // Validate amount >= 100 paise
    if (typeof amount !== 'number' || isNaN(amount) || amount < 100) {
      const err = new Error('Amount must be at least 100 paise');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_AMOUNT';
      throw err;
    }

    let client: Razorpay;
    try {
      client = this.getClient();
    } catch (authErr) {
      const err = new Error('Razorpay credentials not configured or invalid');
      (err as any).statusCode = 401;
      (err as any).code = 'AUTH_FAILED';
      throw err;
    }

    try {
      const options = {
        amount: Math.round(amount),
        currency: currency.toUpperCase(),
        receipt: receipt || `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        notes: notes || {},
      };

      const order = await client.orders.create(options);

      logger.info('Razorpay order created successfully', {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      });

      return {
        order_id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
      };
    } catch (apiError: any) {
      logger.error('Razorpay order creation failed', {
        error: apiError.message || apiError,
        statusCode: apiError.statusCode,
      });

      const err = new Error(apiError.error?.description || apiError.message || 'Failed to create Razorpay order');
      (err as any).statusCode = apiError.statusCode || 500;
      (err as any).code = 'RAZORPAY_API_ERROR';
      throw err;
    }
  }

  /**
   * Cryptographically verifies the Razorpay payment signature using HMAC-SHA256.
   * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
   */
  public static verifyPaymentSignature(params: VerifySignatureParams): { isVerified: boolean; error?: string } {
    const { order_id, payment_id, signature } = params;

    if (!order_id || !payment_id || !signature) {
      return {
        isVerified: false,
        error: 'Missing required signature verification parameters',
      };
    }

    const keySecret = (env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '').replace(/^["']|["']$/g, '').trim();
    if (!keySecret) {
      logger.error('Cannot verify payment signature: RAZORPAY_KEY_SECRET is not configured');
      return {
        isVerified: false,
        error: 'Payment gateway configuration error',
      };
    }

    try {
      const body = `${order_id}|${payment_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

      // Timing safe comparison to prevent timing attack side-channels
      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const signatureBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== signatureBuffer.length) {
        return { isVerified: false, error: 'Signature length mismatch' };
      }

      const isMatch = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

      if (isMatch) {
        logger.info('Razorpay payment signature verified successfully', {
          order_id,
          payment_id,
        });
        return { isVerified: true };
      } else {
        logger.warn('Razorpay payment signature mismatch detected', {
          order_id,
          payment_id,
        });
        return { isVerified: false, error: 'Signature mismatch' };
      }
    } catch (err: any) {
      logger.error('Error during signature verification', { error: err.message });
      return { isVerified: false, error: err.message };
    }
  }
}
