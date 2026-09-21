// ==============================================================================
// VetRx — PayU Webhook & Callback Controller (Phase 13)
// Unauthenticated, cryptographically secured endpoints for PayU S2S notifications
// and browser redirect callbacks.
// ==============================================================================

import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { PaymentService } from './payment.service.js';
import { logger } from '../lib/logger.js';

export const webhookRouter = Router();

/**
 * POST /api/commercial/webhooks/payu
 * Dedicated server-to-server webhook listener.
 * Validates reverse SHA-512 signatures and enforces strict idempotency.
 */
webhookRouter.post('/payu', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      res.status(400).json({ error: 'Invalid or empty webhook payload' });
      return;
    }

    const signature = (req.headers['x-payu-signature'] as string) || (payload.hash as string);

    const result = await PaymentService.processWebhook({
      payload,
      signature,
    });

    res.status(200).json(result);
  } catch (err: any) {
    logger.error('Error processing PayU webhook notification', { error: err.message });
    res.status(200).json({ status: 'ERROR_RECORDED', message: err.message });
  }
});

/**
 * Handles PayU browser return callback (surl / furl).
 * Processes verification and 303 redirects the browser back to Settings SPA.
 */
export async function handlePaymentReturn(req: Request, res: Response) {
  const payload = req.body || {};
  const txnid = (payload.txnid as string) || (req.query.txnid as string) || '';
  let paymentStatus = 'failed';

  try {
    if (txnid) {
      const payment = await prisma.payment.findUnique({
        where: { internalReference: txnid },
      });

      if (payment) {
        const result = await PaymentService.verifyPaymentReturn({
          practiceId: payment.practiceId,
          payload,
        });
        paymentStatus = result.status === 'SUCCESS' ? 'success' : 'failed';
      }
    }
  } catch (err: any) {
    logger.error('Error verifying payment return callback', { error: err.message });
    paymentStatus = 'failed';
  }

  res.redirect(
    303,
    `/settings?tab=subscription&payment_status=${paymentStatus}&txnid=${encodeURIComponent(txnid)}`
  );
}

export const publicPaymentsRouter = Router();
publicPaymentsRouter.post('/return', handlePaymentReturn);
publicPaymentsRouter.get('/return', handlePaymentReturn);
