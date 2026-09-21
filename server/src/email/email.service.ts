// ==============================================================================
// VetRx — Transactional Email Service
// Central email dispatch orchestrator with provider isolation, safe logging,
// and mock testing capability.
// ==============================================================================

import type { EmailProvider, SendEmailOptions, SendEmailResult } from './email.interface.js';
import { BrevoEmailProvider } from './brevo.provider.js';
import { generateInvitationEmail, type InvitationEmailData } from './templates/invitation.js';
import { logger } from '../lib/logger.js';

export interface EmailServiceConfig {
  enabled: boolean;
  fromEmail: string;
  fromName: string;
  brevoApiKey?: string;
}

export class EmailService {
  private static provider: EmailProvider | null = null;
  private static config: EmailServiceConfig | null = null;

  // In-memory record of sent emails for automated testing
  public static mockSentEmails: Array<{
    to: string;
    subject: string;
    htmlContent: string;
    textContent: string;
    timestamp: Date;
  }> = [];

  static configure(config: EmailServiceConfig): void {
    this.config = config;

    if (config.brevoApiKey) {
      this.provider = new BrevoEmailProvider({
        apiKey: config.brevoApiKey,
        defaultSender: {
          email: config.fromEmail,
          name: config.fromName,
        },
      });
    } else {
      this.provider = null;
    }
  }

  static setMockProvider(mockProvider: EmailProvider): void {
    this.provider = mockProvider;
  }

  static clearMockSentEmails(): void {
    this.mockSentEmails = [];
  }

  /**
   * Dispatches a practice invitation email.
   * Safe: Does NOT log the raw token or complete secret URL.
   */
  static async sendInvitationEmail(
    data: InvitationEmailData,
    invitationId: string,
    practiceId: string
  ): Promise<SendEmailResult> {
    const { subject, htmlContent, textContent } = generateInvitationEmail(data);

    // If emails are disabled (development / local test), record in mock store and log safely
    const isEnabled = this.config?.enabled ?? false;

    if (!isEnabled || process.env.VETRX_FAST_TEST === '1') {
      this.mockSentEmails.push({
        to: data.recipientEmail,
        subject,
        htmlContent,
        textContent,
        timestamp: new Date(),
      });

      logger.info('EmailService: (MOCK/DISABLED) Invitation email prepared', {
        invitationId,
        practiceId,
        recipientDomain: data.recipientEmail.split('@')[1] || 'unknown',
        enabled: isEnabled,
      });

      return {
        success: true,
        messageId: `mock-${Date.now()}`,
      };
    }

    if (!this.provider) {
      logger.warn('EmailService: Email delivery enabled but no provider configured', {
        invitationId,
        practiceId,
      });
      return {
        success: false,
        error: 'NO_EMAIL_PROVIDER_CONFIGURED',
      };
    }

    const result = await this.provider.send({
      to: [{ email: data.recipientEmail }],
      subject,
      htmlContent,
      textContent,
      tags: ['practice-invitation'],
    });

    if (result.success) {
      logger.info('EmailService: Invitation email sent successfully', {
        invitationId,
        practiceId,
        messageId: result.messageId,
        recipientDomain: data.recipientEmail.split('@')[1] || 'unknown',
      });
    } else {
      logger.error('EmailService: Invitation email delivery failed', {
        invitationId,
        practiceId,
        error: result.error,
        recipientDomain: data.recipientEmail.split('@')[1] || 'unknown',
      });
    }

    return result;
  }
}
