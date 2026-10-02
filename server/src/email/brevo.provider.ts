// ==============================================================================
// VetRx — Brevo Transactional Email Provider
// Uses official Brevo v3 Transactional REST API via native fetch.
// ==============================================================================

import type { EmailProvider, SendEmailOptions, SendEmailResult } from './email.interface.js';
import { logger } from '../lib/logger.js';

export interface BrevoProviderConfig {
  apiKey: string;
  defaultSender: {
    email: string;
    name: string;
  };
}

export class BrevoEmailProvider implements EmailProvider {
  private apiKey: string;
  private defaultSender: { email: string; name: string };
  private apiUrl: string;

  constructor(config: BrevoProviderConfig) {
    this.apiKey = config.apiKey;
    this.defaultSender = config.defaultSender;
    this.apiUrl = 'https://api.brevo.com/v3/smtp/email';
  }

  getName(): string {
    return 'Brevo';
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      logger.warn('BrevoEmailProvider: Attempted to send email but BREVO_API_KEY is not configured');
      return {
        success: false,
        error: 'BREVO_API_KEY_MISSING',
      };
    }

    const sender = options.sender || this.defaultSender;

    const payload = {
      sender: {
        name: sender.name,
        email: sender.email,
      },
      to: options.to.map((r) => ({
        email: r.email,
        name: r.name || r.email,
      })),
      subject: options.subject,
      htmlContent: options.htmlContent,
      textContent: options.textContent,
      tags: options.tags,
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as Record<string, any>;

      if (!response.ok) {
        const errorMessage = data.message || `HTTP ${response.status} ${response.statusText}`;
        logger.error('BrevoEmailProvider: API delivery error', {
          statusCode: response.status,
          message: errorMessage,
          recipientsCount: options.to.length,
        });
        return {
          success: false,
          error: errorMessage,
        };
      }

      const messageId = data.messageId as string | undefined;
      logger.info('BrevoEmailProvider: Transactional email sent successfully', {
        messageId,
        recipientsCount: options.to.length,
      });

      return {
        success: true,
        messageId,
      };
    } catch (err: any) {
      logger.error('BrevoEmailProvider: Network or transport failure', {
        message: err.message,
      });
      return {
        success: false,
        error: err.message || 'NETWORK_FAILURE',
      };
    }
  }
}
