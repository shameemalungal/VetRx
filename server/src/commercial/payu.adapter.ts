// ==============================================================================
// VetRx — PayU Gateway Adapter (Phase 13)
// Provider-specific implementation of the PaymentGateway boundary interface.
// ==============================================================================

import crypto from 'crypto';
import { getPayUConfig, type PayUConfig } from './payu.config.js';
import { PayUCrypto } from './payu.crypto.js';
import type {
  PaymentGateway,
  PaymentOrderRequest,
  PaymentOrderResponse,
  VerifiedPaymentResult,
} from './payment.provider.interface.js';
import { AppError } from '../middleware/errorHandler.js';

export class PayUAdapter implements PaymentGateway {
  readonly providerName = 'PAYU';
  private config: PayUConfig;

  constructor(customConfig?: Partial<PayUConfig>) {
    this.config = {
      ...getPayUConfig(),
      ...(customConfig || {}),
    };
  }

  /**
   * Initializes a payment order and generates signed parameters for PayU Hosted Checkout.
   */
  async createPaymentOrder(order: PaymentOrderRequest): Promise<PaymentOrderResponse> {
    const txnid =
      order.internalReference ||
      `TXN-VRX-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // Format amount into exact Rupees string with 2 decimals
    const amountRupees = (order.amountPaisa / 100).toFixed(2);

    const hash = PayUCrypto.generateRequestHash({
      key: this.config.merchantKey,
      txnid,
      amount: amountRupees,
      productinfo: order.productInfo,
      firstname: order.customerName,
      email: order.customerEmail,
      udf1: order.practiceId,
      udf2: order.planCode || '',
      udf3: order.billingInterval || '',
      udf4: order.subscriptionId || '',
      udf5: '',
      salt: this.config.merchantSalt,
    });

    const formParameters: Record<string, string> = {
      key: this.config.merchantKey,
      txnid,
      amount: amountRupees,
      productinfo: order.productInfo,
      firstname: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone || '9876543210',
      surl: order.returnUrl || this.config.successUrl,
      furl: order.cancelUrl || this.config.failureUrl,
      hash,
      udf1: order.practiceId,
      udf2: order.planCode || '',
      udf3: order.billingInterval || '',
      udf4: order.subscriptionId || '',
      udf5: '',
    };

    return {
      internalReference: txnid,
      redirectUrl: this.config.checkoutUrl,
      formParameters,
    };
  }

  /**
   * Cryptographically verifies an inbound browser return/callback from PayU.
   */
  async verifyCallback(payload: Record<string, unknown>): Promise<VerifiedPaymentResult> {
    const txnid = (payload.txnid as string) || '';
    const statusStr = (payload.status as string)?.toLowerCase() || '';
    const mihpayid = (payload.mihpayid as string) || (payload.payuMoneyId as string) || txnid;
    const rawAmount = (payload.amount as string) || (payload.net_amount_debit as string) || '0';
    const amountPaisa = Math.round(parseFloat(rawAmount) * 100);

    // 1. Validate reverse SHA-512 checksum
    const isHashValid = PayUCrypto.verifyResponseHash(payload, this.config.merchantSalt);

    if (!isHashValid) {
      return {
        isVerified: false,
        gatewayTransactionId: mihpayid,
        internalReference: txnid,
        amountPaisa,
        currency: 'INR',
        status: 'FAILED',
        rawPayload: payload,
        errorMessage: 'TAMPERED_OR_INVALID_HASH: Cryptographic reverse hash check failed.',
      };
    }

    // 2. Validate gateway status
    const isSuccess = statusStr === 'success';

    return {
      isVerified: isHashValid && isSuccess,
      gatewayTransactionId: mihpayid,
      internalReference: txnid,
      amountPaisa,
      currency: 'INR',
      status: isSuccess ? 'SUCCESS' : 'FAILED',
      paymentMode: (payload.mode as string) || 'UNKNOWN',
      rawPayload: payload,
      errorMessage: isSuccess ? undefined : ((payload.error_Message as string) || 'Payment failed at gateway.'),
    };
  }

  /**
   * Verifies an asynchronous server-to-server webhook notification from PayU.
   */
  async verifyWebhook(payload: Record<string, unknown>): Promise<VerifiedPaymentResult> {
    // PayU webhooks use the exact same reverse hash structure
    return this.verifyCallback(payload);
  }

  /**
   * Server-to-server authoritative payment status lookup using PayU's verify_payment command.
   */
  async getPaymentStatus(txnid: string): Promise<VerifiedPaymentResult> {
    const hash = PayUCrypto.generateVerifyPaymentHash(
      this.config.merchantKey,
      txnid,
      this.config.merchantSalt
    );

    // If using mock credentials in test environment without live network
    if (this.config.merchantKey === 'VETRX_SANDBOX_KEY') {
      return {
        isVerified: true,
        gatewayTransactionId: `MOCK-${txnid}`,
        internalReference: txnid,
        amountPaisa: 0,
        currency: 'INR',
        status: 'SUCCESS',
        rawPayload: { mock: true, txnid },
      };
    }

    try {
      const body = new URLSearchParams({
        key: this.config.merchantKey,
        command: 'verify_payment',
        var1: txnid,
        hash,
      });

      const response = await fetch(this.config.postServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        throw new AppError(502, 'GATEWAY_ERROR', `PayU S2S API returned HTTP ${response.status}`);
      }

      const json = await response.json() as any;
      const details = json?.transaction_details?.[txnid];

      if (!details) {
        return {
          isVerified: false,
          gatewayTransactionId: '',
          internalReference: txnid,
          amountPaisa: 0,
          currency: 'INR',
          status: 'FAILED',
          rawPayload: json,
          errorMessage: 'Transaction not found in PayU verification response.',
        };
      }

      const isSuccess = details.status?.toLowerCase() === 'success';
      const amountPaisa = Math.round(parseFloat(details.amt || details.transaction_amount || '0') * 100);

      return {
        isVerified: isSuccess,
        gatewayTransactionId: details.mihpayid || txnid,
        internalReference: txnid,
        amountPaisa,
        currency: 'INR',
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        paymentMode: details.mode || 'UNKNOWN',
        rawPayload: details,
        errorMessage: isSuccess ? undefined : details.error_Message,
      };
    } catch (err: any) {
      return {
        isVerified: false,
        gatewayTransactionId: '',
        internalReference: txnid,
        amountPaisa: 0,
        currency: 'INR',
        status: 'PENDING',
        rawPayload: { error: err.message },
        errorMessage: `Failed to connect to PayU S2S verification service: ${err.message}`,
      };
    }
  }
}
