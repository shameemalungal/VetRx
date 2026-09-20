// ==============================================================================
// VetRx — Payment Provider Boundary & Generic Payment Gateway Interface
// (Phase 10 Foundation: Contract for future PayU adapter in Phase 13)
// ==============================================================================

export interface PaymentOrderRequest {
  practiceId: string;
  subscriptionId?: string;
  amountPaisa: number;
  currency: string; // Standard "INR"
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  productInfo: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentOrderResponse {
  internalReference: string;
  gatewayTransactionId?: string;
  redirectUrl?: string;
  formParameters?: Record<string, string>;
}

export interface VerifiedPaymentResult {
  isVerified: boolean;
  gatewayTransactionId: string;
  internalReference: string;
  amountPaisa: number;
  currency: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  paymentMode?: string;
  rawPayload: Record<string, unknown>;
  errorMessage?: string;
}

export interface PaymentGateway {
  readonly providerName: string;

  /**
   * Initializes a payment order with the external provider.
   */
  createPaymentOrder(order: PaymentOrderRequest): Promise<PaymentOrderResponse>;

  /**
   * Cryptographically verifies an incoming browser redirect/callback payload.
   * Client-supplied status must never be trusted without backend verification.
   */
  verifyCallback(payload: Record<string, unknown>): Promise<VerifiedPaymentResult>;

  /**
   * Verifies an asynchronous server-to-server webhook notification.
   */
  verifyWebhook(payload: Record<string, unknown>, signature?: string): Promise<VerifiedPaymentResult>;

  /**
   * Directly queries the provider for authoritative payment status (reconciliation).
   */
  getPaymentStatus(gatewayTransactionId: string): Promise<VerifiedPaymentResult>;
}
