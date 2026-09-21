// ==============================================================================
// VetRx — Practice Invitation Email Template
// Clean, responsive, accessible HTML and plain-text email templates.
// ==============================================================================

export interface InvitationEmailData {
  recipientEmail: string;
  practiceName: string;
  roleName: string;
  invitationUrl: string;
  expiresInDays?: number;
  inviterName?: string;
  supportEmail?: string;
}

export function generateInvitationEmail(data: InvitationEmailData): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const {
    practiceName,
    roleName,
    invitationUrl,
    expiresInDays = 7,
    supportEmail = 'supportvetrx@gmail.com',
  } = data;

  const subject = `You're invited to join a VetRx practice: ${practiceName}`;

  const textContent = `
VetRx — Veterinary Practice Management

You have been invited to join: ${practiceName}
Assigned Role: ${roleName}

To accept this invitation and access the practice, visit the link below:
${invitationUrl}

Note: This invitation is secure, single-use, and expires in ${expiresInDays} days.
If you did not expect this invitation, you can safely ignore this email.

Need help? Contact VetRx support at: ${supportEmail}
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Practice Invitation — VetRx</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f6f8;
      color: #1a202c;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 580px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #006684 0%, #004d65 100%);
      padding: 32px 36px;
      text-align: center;
    }
    .logo {
      color: #ffffff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .logo span {
      color: #48cae4;
    }
    .content {
      padding: 36px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
      margin: 0 0 16px 0;
    }
    .badge-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 24px 0;
    }
    .badge-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .badge-row:last-child {
      margin-bottom: 0;
    }
    .badge-label {
      color: #64748b;
      font-weight: 500;
    }
    .badge-value {
      color: #0f172a;
      font-weight: 600;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background-color: #006684;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 32px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 102, 132, 0.25);
    }
    .expiry-note {
      font-size: 13px;
      color: #64748b;
      text-align: center;
      margin-bottom: 24px;
    }
    .fallback-url {
      font-size: 12px;
      color: #94a3b8;
      word-break: break-all;
      background-color: #f1f5f9;
      padding: 12px;
      border-radius: 6px;
      margin-top: 20px;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding: 24px 36px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      background-color: #fafbfc;
    }
    .footer a {
      color: #006684;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Vet<span>Rx</span></div>
    </div>
    <div class="content">
      <h1>You've been invited to join a practice</h1>
      <p>Hello,</p>
      <p>You have been invited to join <strong>${practiceName}</strong> on VetRx — Veterinary Practice Management Platform.</p>
      
      <div class="badge-card">
        <div class="badge-row">
          <span class="badge-label">Practice:</span>
          <span class="badge-value">${practiceName}</span>
        </div>
        <div class="badge-row">
          <span class="badge-label">Assigned Role:</span>
          <span class="badge-value">${roleName}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${invitationUrl}" class="btn" target="_blank">Accept Invitation</a>
      </div>

      <p class="expiry-note">
        This invitation is single-use and will expire in <strong>${expiresInDays} days</strong>.
      </p>

      <p style="font-size: 13px; color: #64748b;">
        If you did not expect this invitation, you can safely disregard this email.
      </p>

      <div class="fallback-url">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="${invitationUrl}" style="color: #006684;">${invitationUrl}</a>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;">VetRx &copy; ${new Date().getFullYear()} &bull; Professional Veterinary Care</p>
      <p style="margin: 0;">Support: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    </div>
  </div>
</body>
</html>
`.trim();

  return { subject, htmlContent, textContent };
}
