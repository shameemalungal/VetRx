// ==============================================================================
// VetRx — Transactional Email Provider Interface
// Provider-neutral abstraction supporting Brevo, SMTP, or future cloud transports.
// ==============================================================================

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
  sender?: EmailRecipient;
  tags?: string[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<SendEmailResult>;
  getName?(): string;
}
