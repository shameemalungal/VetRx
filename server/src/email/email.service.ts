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

  static async sendPasswordResetEmail(data: {
    recipientEmail: string;
    recipientName: string;
    resetUrl: string;
    expiresInMinutes: number;
  }): Promise<SendEmailResult> {
    const subject = 'Reset your VetRx password';
    const textContent = `Hello ${data.recipientName},\n\nA password reset was requested for your VetRx account. Use the following link within ${data.expiresInMinutes} minutes to reset your password:\n\n${data.resetUrl}\n\nIf you did not request this, please disregard this email.`;
    const htmlContent = `<p>Hello ${data.recipientName},</p><p>A password reset was requested for your VetRx account. Click the link below within ${data.expiresInMinutes} minutes to set a new password:</p><p><a href="${data.resetUrl}">Reset Password</a></p><p>If you did not request this, please disregard this email.</p>`;

    const isEnabled = this.config?.enabled ?? false;
    if (!isEnabled || process.env.VETRX_FAST_TEST === '1') {
      this.mockSentEmails.push({
        to: data.recipientEmail,
        subject,
        htmlContent,
        textContent,
        timestamp: new Date(),
      });
      return { success: true, messageId: `mock-reset-${Date.now()}` };
    }

    if (!this.provider) {
      return { success: false, error: 'NO_EMAIL_PROVIDER_CONFIGURED' };
    }

    return this.provider.send({
      to: [{ email: data.recipientEmail }],
      subject,
      htmlContent,
      textContent,
      tags: ['password-reset'],
    });
  }

  static async sendWelcomeEmail(data: {
    recipientEmail: string;
    recipientName: string;
    practiceName?: string;
    setupUrl?: string;
  }): Promise<SendEmailResult> {
    const subject = 'Welcome to VetRx';
    const textContent = `Hello ${data.recipientName},\n\nWelcome to VetRx! Your account has been created.${data.practiceName ? ` You have been assigned to ${data.practiceName}.` : ''}\n\n${data.setupUrl ? `Set up your password here: ${data.setupUrl}` : ''}`;
    const htmlContent = `<p>Hello ${data.recipientName},</p><p>Welcome to VetRx! Your account has been created.${data.practiceName ? ` You have been assigned to <strong>${data.practiceName}</strong>.` : ''}</p>${data.setupUrl ? `<p><a href="${data.setupUrl}">Set up your password</a></p>` : ''}`;

    const isEnabled = this.config?.enabled ?? false;
    if (!isEnabled || process.env.VETRX_FAST_TEST === '1') {
      this.mockSentEmails.push({
        to: data.recipientEmail,
        subject,
        htmlContent,
        textContent,
        timestamp: new Date(),
      });
      return { success: true, messageId: `mock-welcome-${Date.now()}` };
    }

    if (!this.provider) {
      return { success: false, error: 'NO_EMAIL_PROVIDER_CONFIGURED' };
    }

    return this.provider.send({
      to: [{ email: data.recipientEmail }],
      subject,
      htmlContent,
      textContent,
      tags: ['account-welcome'],
    });
  }
}
