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

  static async sendPasswordResetOtpEmail(data: {
    recipientEmail: string;
    recipientName: string;
    otpCode: string;
    expiresInMinutes: number;
  }): Promise<SendEmailResult> {
    const subject = `${data.otpCode} is your VetRx verification code`;
    const textContent = `Hello ${data.recipientName},\n\nYour one-time verification code for password reset is: ${data.otpCode}\n\nThis code will expire in ${data.expiresInMinutes} minutes and can only be used once.\n\nIf you did not request a password reset, please ignore this email or contact support immediately.`;
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #00685f; margin: 0; font-size: 24px; font-weight: 800;">VetRx</h2>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Veterinary Practice Management</p>
        </div>
        <h3 style="font-size: 18px; color: #0f172a; margin: 0 0 12px;">Password Reset Verification</h3>
        <p style="color: #334155; font-size: 14px; line-height: 1.5; margin: 0 0 20px;">
          Hello ${data.recipientName},<br />
          We received a request to reset your password. Use the single-use verification code below:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; padding: 14px 28px; background: #f0fdfa; border: 2px dashed #00685f; border-radius: 10px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #00685f; font-family: monospace;">
            ${data.otpCode}
          </div>
        </div>
        <p style="color: #64748b; font-size: 12.5px; line-height: 1.5; margin: 0 0 16px;">
          ⏱ This code will expire in <strong>${data.expiresInMinutes} minutes</strong> and is strictly single-use.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11.5px; margin: 0;">
          If you did not initiate this request, your account remains secure and you can safely disregard this email.
        </p>
      </div>
    `;

    const isEnabled = this.config?.enabled ?? false;
    if (!isEnabled || process.env.VETRX_FAST_TEST === '1') {
      this.mockSentEmails.push({
        to: data.recipientEmail,
        subject,
        htmlContent,
        textContent,
        timestamp: new Date(),
      });
      return { success: true, messageId: `mock-otp-${Date.now()}` };
    }

    if (!this.provider) {
      return { success: false, error: 'NO_EMAIL_PROVIDER_CONFIGURED' };
    }

    return this.provider.send({
      to: [{ email: data.recipientEmail }],
      subject,
      htmlContent,
      textContent,
      tags: ['password-reset-otp'],
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
