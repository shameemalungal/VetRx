// ==============================================================================
// VetRx — PayU Gateway Configuration (Phase 13)
// Server-side authoritative PayU endpoints, credentials, and safety gates.
// ==============================================================================

export interface PayUConfig {
  merchantKey: string;
  merchantSalt: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  enableLiveBilling: boolean;
  checkoutUrl: string;
  postServiceUrl: string;
  successUrl: string;
  failureUrl: string;
}

export function getPayUConfig(): PayUConfig {
  const environment = (process.env.PAYU_ENVIRONMENT?.toUpperCase() === 'PRODUCTION')
    ? 'PRODUCTION'
    : 'SANDBOX';

  const enableLiveBilling = process.env.PAYU_ENABLE_LIVE_BILLING === 'true';

  // In sandbox, fallback to mock sandbox credentials if none specified
  const merchantKey = process.env.PAYU_MERCHANT_KEY || 'VETRX_SANDBOX_KEY';
  const merchantSalt = process.env.PAYU_MERCHANT_SALT || 'VETRX_SANDBOX_SALT_SECRET_12345';

  const checkoutUrl = environment === 'PRODUCTION'
    ? 'https://secure.payu.in/_payment'
    : 'https://test.payu.in/_payment';

  const postServiceUrl = environment === 'PRODUCTION'
    ? 'https://info.payu.in/merchant/postservice?form=2'
    : 'https://test.payu.in/merchant/postservice?form=2';

  const baseUrl = process.env.VETRX_BASE_URL || 'https://vetrx.adcpmalappuram.in';
  const successUrl = `${baseUrl}/api/commercial/payments/return`;
  const failureUrl = `${baseUrl}/api/commercial/payments/return`;

  return {
    merchantKey,
    merchantSalt,
    environment,
    enableLiveBilling,
    checkoutUrl,
    postServiceUrl,
    successUrl,
    failureUrl,
  };
}
