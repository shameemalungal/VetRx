// ==============================================================================
// VetRx — PayU Cryptographic Engine (Phase 13)
// Server-side SHA-512 calculation and timing-safe signature verification.
// ==============================================================================

import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler.js';

export interface PayURequestHashParams {
  key: string;
  txnid: string;
  amount: string; // Formatted in Rupees with 2 decimal places e.g. "599.00"
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  salt: string;
}

export class PayUCrypto {
  /**
   * Generates the SHA-512 checksum required for outbound PayU hosted checkout requests.
   * Format:
   * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
   */
  static generateRequestHash(params: PayURequestHashParams): string {
    const {
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
      salt,
    } = params;

    if (!key || !txnid || !amount || !productinfo || !firstname || !email || !salt) {
      throw new AppError(400, 'PAYU_HASH_ERROR', 'Missing required parameters for PayU request hash.');
    }

    // 5 empty pipes after udf5 represent unused udf6-udf10
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;

    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * Generates the reverse SHA-512 checksum expected from PayU responses.
   * Useful for testing, canonical verification, and mock validation.
   * Standard format:
   * sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   * Format with additionalCharges:
   * sha512(additionalCharges|salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   */
  static generateReverseHash(params: Record<string, unknown>, salt: string): string {
    const key = (params.key as string) || '';
    const txnid = (params.txnid as string) || '';
    const amount = (params.amount as string) || '';
    const productinfo = (params.productinfo as string) || '';
    const firstname = (params.firstname as string) || '';
    const email = (params.email as string) || '';
    const status = (params.status as string) || '';
    const additionalCharges = (params.additionalCharges as string) || '';

    const udf1 = (params.udf1 as string) || '';
    const udf2 = (params.udf2 as string) || '';
    const udf3 = (params.udf3 as string) || '';
    const udf4 = (params.udf4 as string) || '';
    const udf5 = (params.udf5 as string) || '';

    let hashString: string;
    if (additionalCharges && additionalCharges.trim() !== '') {
      hashString = `${additionalCharges}|${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    } else {
      hashString = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    }

    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * Verifies the reverse SHA-512 checksum sent by PayU in callbacks and webhooks.
   * Handles both standard responses and responses with `additionalCharges`.
   */
  static verifyResponseHash(params: Record<string, unknown>, salt: string): boolean {
    const status = (params.status as string) || '';
    const receivedHash = (params.hash as string) || '';

    if (!receivedHash || !status || !salt) {
      return false;
    }

    const calculatedHash = this.generateReverseHash(params, salt);

    // Timing-safe comparison to prevent side-channel timing attacks
    return this.timingSafeStringEqual(receivedHash.toLowerCase(), calculatedHash);
  }

  /**
   * Generates the SHA-512 hash for PayU PostService S2S verification (`verify_payment`).
   * Format: sha512(key|verify_payment|txnid|salt)
   */
  static generateVerifyPaymentHash(key: string, txnid: string, salt: string): string {
    const hashString = `${key}|verify_payment|${txnid}|${salt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  }

  /**
   * Safe constant-time string comparison.
   */
  private static timingSafeStringEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
