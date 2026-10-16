import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { RazorpayService } from '../src/payments/razorpay.service.js';
import { createApp } from '../src/app.js';

describe('Razorpay Standard Web Checkout Suite', () => {
  const testKeySecret = 'OTyb6jMlt49TMkiBDyAbPUBl';

  describe('Signature Verification Algorithm (STEP 3)', () => {
    it('cryptographically verifies authentic signature generated with HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)', () => {
      const order_id = 'order_DAv534892348';
      const payment_id = 'pay_98234823948';
      
      const payload = `${order_id}|${payment_id}`;
      const validSignature = crypto
        .createHmac('sha256', testKeySecret)
        .update(payload)
        .digest('hex');

      const result = RazorpayService.verifyPaymentSignature({
        order_id,
        payment_id,
        signature: validSignature,
      });

      assert.strictEqual(result.isVerified, true);
    });

    it('rejects tampered or mismatched signature', () => {
      const order_id = 'order_DAv534892348';
      const payment_id = 'pay_98234823948';
      const invalidSignature = 'bad_tampered_signature_1234567890abcdef1234567890abcdef1234567890abcdef';

      const result = RazorpayService.verifyPaymentSignature({
        order_id,
        payment_id,
        signature: invalidSignature,
      });

      assert.strictEqual(result.isVerified, false);
      assert.ok(result.error);
    });

    it('rejects verification if order_id, payment_id, or signature is missing', () => {
      const result1 = RazorpayService.verifyPaymentSignature({
        order_id: '',
        payment_id: 'pay_123',
        signature: 'sig_123',
      });
      assert.strictEqual(result1.isVerified, false);

      const result2 = RazorpayService.verifyPaymentSignature({
        order_id: 'order_123',
        payment_id: '',
        signature: 'sig_123',
      });
      assert.strictEqual(result2.isVerified, false);

      const result3 = RazorpayService.verifyPaymentSignature({
        order_id: 'order_123',
        payment_id: 'pay_123',
        signature: '',
      });
      assert.strictEqual(result3.isVerified, false);
    });
  });

  describe('Create Order Validation & Error Handling (STEP 1)', () => {
    it('validates amount must be at least 100 paise (rejects < 100 paise)', async () => {
      await assert.rejects(
        async () => {
          await RazorpayService.createOrder({ amount: 99 });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'INVALID_AMOUNT');
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await RazorpayService.createOrder({ amount: 0 });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'INVALID_AMOUNT');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await RazorpayService.createOrder({ amount: -500 });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'INVALID_AMOUNT');
          return true;
        }
      );
    });
  });

  describe('Express HTTP Endpoints Verification (/api/create-order & /api/verify-payment)', () => {
    const app = createApp();

    it('POST /api/create-order returns 400 when amount is less than 100 paise', async () => {
      const server = app.listen(0);
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 50, currency: 'INR' }),
        });

        assert.strictEqual(response.status, 400);
        const json = await response.json();
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.error, 'INVALID_AMOUNT');
      } finally {
        server.close();
      }
    });

    it('POST /api/verify-payment returns 400 when required fields are missing', async () => {
      const server = app.listen(0);
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ razorpay_order_id: 'order_123' }), // missing payment_id and signature
        });

        assert.strictEqual(response.status, 400);
        const json = await response.json();
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.error, 'MISSING_FIELDS');
      } finally {
        server.close();
      }
    });

    it('POST /api/verify-payment returns 400 when signature does not match', async () => {
      const server = app.listen(0);
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: 'order_123',
            razorpay_payment_id: 'pay_123',
            razorpay_signature: 'invalid_forged_signature_00000000000000000000000000000000000000000000',
          }),
        });

        assert.strictEqual(response.status, 400);
        const json = await response.json();
        assert.strictEqual(json.success, false);
        assert.strictEqual(json.error, 'SIGNATURE_MISMATCH');
      } finally {
        server.close();
      }
    });

    it('POST /api/verify-payment returns 200 when signature is authentic', async () => {
      const order_id = 'order_test_12345';
      const payment_id = 'pay_test_67890';
      const validSignature = crypto
        .createHmac('sha256', testKeySecret)
        .update(`${order_id}|${payment_id}`)
        .digest('hex');

      const server = app.listen(0);
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: order_id,
            razorpay_payment_id: payment_id,
            razorpay_signature: validSignature,
          }),
        });

        assert.strictEqual(response.status, 200);
        const json = await response.json();
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.order_id, order_id);
        assert.strictEqual(json.payment_id, payment_id);
      } finally {
        server.close();
      }
    });
  });
});
