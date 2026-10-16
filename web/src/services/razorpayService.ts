// ==============================================================================
// VetRx — Razorpay Web Client Service (web/src/services/razorpayService.ts)
// Frontend SDK Loader, Order Creation, and Signature Verification Client
// ==============================================================================

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export interface CreateOrderRequest {
  amount: number; // in paise (e.g. 10000 = ₹100.00)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  order_id: string;
  payment_id: string;
}

export interface RazorpayPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

export interface RazorpayCheckoutOptions {
  amount: number; // in paise
  currency?: string;
  name?: string;
  description?: string;
  image?: string;
  order_id?: string;
  key_id?: string;
  prefill?: RazorpayPrefill;
  notes?: Record<string, string>;
  onSuccess?: (response: { payment_id: string; order_id: string; signature: string }) => void;
  onError?: (error: { code?: string; description?: string }) => void;
  onDismiss?: () => void;
}

/**
 * Dynamically loads the official Razorpay checkout script if not already present.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay Checkout script');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Calls backend to create a new Razorpay order.
 * STEP 1: POST /api/create-order
 */
export async function createRazorpayOrder(params: CreateOrderRequest): Promise<CreateOrderResponse> {
  const res = await fetch(`${API_BASE}/api/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || data.error || `Failed to create order (${res.status})`);
  }

  return data;
}

/**
 * Calls backend to verify cryptographic payment signature.
 * STEP 3: POST /api/commercial/payments/verify or fallback to /api/verify-payment
 */
export async function verifyRazorpayPayment(params: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/commercial/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      credentials: 'include',
    });

    if (res.status === 404) {
      // Fallback to /api/verify-payment if commercial endpoint is not mounted
      const fallbackRes = await fetch(`${API_BASE}/api/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        credentials: 'include',
      });
      const fallbackData = await fallbackRes.json();
      if (!fallbackRes.ok || !fallbackData.success) {
        throw new Error(fallbackData.message || fallbackData.error || `Payment verification failed (${fallbackRes.status})`);
      }
      return fallbackData;
    }

    const data = await res.json();
    if (!res.ok || data.isVerified === false) {
      throw new Error(data.message || data.error || `Payment verification failed (${res.status})`);
    }

    return {
      success: true,
      message: data.message || 'Payment verified successfully.',
      order_id: params.razorpay_order_id,
      payment_id: params.razorpay_payment_id,
    };
  } catch (err: any) {
    throw new Error(err.message || 'Payment verification failed.');
  }
}

/**
 * Orchestrates full Razorpay Standard Checkout flow:
 * 1. Ensures script is loaded
 * 2. Creates order on backend (if not pre-created)
 * 3. Launches Razorpay modal with order_id
 * 4. Verifies signature on success
 */
export async function launchRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !(window as any).Razorpay) {
    const errorMsg = 'Razorpay SDK could not be loaded. Please check your internet connection.';
    options.onError?.({ description: errorMsg });
    throw new Error(errorMsg);
  }

  let orderId = options.order_id;
  let orderAmount = options.amount;
  let orderCurrency = options.currency || 'INR';
  let keyId = options.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;

  // 1. If order_id not passed, create order on backend
  if (!orderId) {
    const orderData = await createRazorpayOrder({
      amount: options.amount,
      currency: options.currency || 'INR',
      notes: options.notes,
    });
    orderId = orderData.order_id;
    orderAmount = orderData.amount;
    orderCurrency = orderData.currency || 'INR';
    if (!keyId && orderData.key_id) {
      keyId = orderData.key_id;
    }
  }

  if (!keyId) {
    const errorMsg = 'Razorpay Key ID is not configured.';
    options.onError?.({ description: errorMsg });
    throw new Error(errorMsg);
  }

  // 2. Configure Razorpay modal options
  const razorpayOptions = {
    key: keyId,
    amount: orderAmount,
    currency: orderCurrency,
    name: options.name || 'VetRx Practitioner Platform',
    description: options.description || 'Veterinary Medical Care & Services',
    image: options.image || '/vetrx_logo_mark.png',
    order_id: orderId,
    prefill: options.prefill || {},
    theme: {
      color: '#00685f', // VetRx primary brand teal
    },
    notes: options.notes || {},
    modal: {
      ondismiss: () => {
        options.onDismiss?.();
      },
    },
    handler: async (response: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    }) => {
      try {
        // 3. Verify payment signature on backend
        await verifyRazorpayPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });

        options.onSuccess?.({
          payment_id: response.razorpay_payment_id,
          order_id: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      } catch (err: any) {
        options.onError?.({
          description: err.message || 'Payment signature verification failed.',
        });
      }
    },
  };

  const rzp = new (window as any).Razorpay(razorpayOptions);

  // Handle payment failure event
  rzp.on('payment.failed', (response: any) => {
    options.onError?.({
      code: response.error?.code,
      description: response.error?.description || 'Payment processing failed.',
    });
  });

  rzp.open();
}
