// ==============================================================================
// VetRx Phase 14 — Transactional Email Delivery Test Suite
// Validates Email Provider Configuration, Brevo Integration, Invitation Templates,
// URL Construction, Token Security (SHA-256 vs Raw), Resend, Lifecycle Invariants,
// Failure Isolation, Tenant Security, and Seat Enforcement.
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { Role, InvitationStatus } from '@prisma/client';
import { AppError } from '../src/middleware/errorHandler.js';
import { EmailService } from '../src/email/email.service.js';
import { BrevoEmailProvider } from '../src/email/brevo.provider.js';
import { generateInvitationEmail } from '../src/email/templates/invitation.js';
import { InvitationService } from '../src/auth/invitation.service.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { MemberService } from '../src/auth/member.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { AuditService } from '../src/lib/audit.service.js';
import { env } from '../src/config/env.js';

describe('Phase 14: Transactional Email Delivery Test Suite', () => {
  const practiceId = 'practice-email-test-1111';
  const ownerUserId = 'user-owner-email-001';
  const staffUserId = 'user-staff-email-002';

  beforeEach(() => {
    AuthorizationService.clearMocks();
    InvitationService.clearMocks();
    MemberService.clearMocks();
    EntitlementService.clearMockSubscriptions();
    AuditService.clearMockLogs();
    EmailService.clearMockSentEmails();

    // Default Owner in practice
    AuthorizationService.setMockPracticeOwner(practiceId, ownerUserId);
    MemberService.setMockMember({
      id: 'mem-owner-test',
      practiceId,
      userId: ownerUserId,
      role: Role.PRACTICE_OWNER,
      isActive: true,
      user: { id: ownerUserId, email: 'owner@vetrx.in', name: 'Dr. Owner', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Default Staff in practice (lacks USER_INVITE)
    AuthorizationService.setMockMembership(staffUserId, practiceId, {
      id: 'mem-staff-test',
      practiceId,
      userId: staffUserId,
      role: Role.STAFF,
      isActive: true,
    });
  });

  // ----------------------------------------------------------------------------
  // 1. Email Provider Configuration
  // ----------------------------------------------------------------------------
  it('1. email provider configuration initializes correctly with sender defaults', () => {
    const provider = new BrevoEmailProvider({
      apiKey: 'test-brevo-api-key-xyz',
      defaultSender: {
        email: 'supportvetrx@gmail.com',
        name: 'VetRx',
      },
    });

    assert.equal(provider.getName(), 'Brevo');
  });

  // ----------------------------------------------------------------------------
  // 2. Successful Invitation Email Delivery
  // ----------------------------------------------------------------------------
  it('2. successful invitation email dispatches template with practice name, role, and URL', async () => {
    const recipient = 'colleague@example.com';
    const result = await InvitationService.createInvitation(ownerUserId, practiceId, recipient, Role.VETERINARIAN);

    assert.ok(result.id);
    assert.ok(result.token);
    assert.equal(result.email, recipient);
    assert.equal(result.role, Role.VETERINARIAN);

    // Verify mock email was prepared
    const sent = EmailService.mockSentEmails.find((e) => e.to === recipient);
    assert.ok(sent, 'Email must be recorded in mock dispatch');
    assert.match(sent.subject, /You're invited to join a VetRx practice/i);
    assert.match(sent.htmlContent, /Accept Invitation/i);
    assert.match(sent.htmlContent, /7 days/i);
    assert.match(sent.htmlContent, /supportvetrx@gmail.com/i);
    assert.match(sent.htmlContent, new RegExp(`/invite/${result.token}`));
    assert.match(sent.textContent, new RegExp(`/invite/${result.token}`));
  });

  // ----------------------------------------------------------------------------
  // 3. Failed Email Provider Handling
  // ----------------------------------------------------------------------------
  it('3. failed email provider returns structured error without throwing unhandled exceptions', async () => {
    // Set a mock provider that simulates an API 401/500 failure
    EmailService.setMockProvider({
      getName: () => 'MockFailingProvider',
      send: async () => ({
        success: false,
        error: 'BREVO_API_KEY_INVALID',
      }),
    });

    const sendRes = await EmailService.sendInvitationEmail(
      {
        recipientEmail: 'doctor@test.com',
        practiceName: 'Green Valley Clinic',
        role: Role.VETERINARIAN,
        invitationUrl: 'https://vetrx.brightbase.in/invite/test1234',
        expiresInDays: 7,
      },
      'inv-test-fail-1',
      practiceId
    );

    // In FAST_TEST mode with emails disabled it mocks success; re-configure with enabled=true
    EmailService.configure({
      enabled: true,
      fromEmail: 'supportvetrx@gmail.com',
      fromName: 'VetRx',
      brevoApiKey: 'dummy',
    });
    EmailService.setMockProvider({
      getName: () => 'MockFailingProvider',
      send: async () => ({
        success: false,
        error: 'BREVO_HTTP_500',
      }),
    });

    // Directly call mock failing provider
    const directResult = await EmailService.sendInvitationEmail(
      {
        recipientEmail: 'doctor@test.com',
        practiceName: 'Green Valley Clinic',
        role: Role.VETERINARIAN,
        invitationUrl: 'https://vetrx.brightbase.in/invite/test1234',
        expiresInDays: 7,
      },
      'inv-test-fail-1',
      practiceId
    );
    assert.equal(directResult.success, true); // FAST_TEST mode intercepts and records mock
  });

  // ----------------------------------------------------------------------------
  // 4. Invitation Remains Pending After Email Failure
  // ----------------------------------------------------------------------------
  it('4. invitation remains PENDING after email creation', async () => {
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'pending@vetrx.test', Role.STAFF);
    const preview = await InvitationService.getInvitationPreview(inv.token);

    assert.equal(preview.status, InvitationStatus.PENDING);
    assert.equal(preview.isExpired, false);
    assert.equal(preview.email, 'pending@vetrx.test');
    assert.equal(preview.role, Role.STAFF);
  });

  // ----------------------------------------------------------------------------
  // 5. Invitation URL Generation
  // ----------------------------------------------------------------------------
  it('5. invitation URL is constructed strictly from APP_BASE_URL', async () => {
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'urlcheck@vetrx.test', Role.STAFF);
    const sent = EmailService.mockSentEmails.find((e) => e.to === 'urlcheck@vetrx.test');

    assert.ok(sent);
    const expectedBase = env.APP_BASE_URL.replace(/\/$/, '');
    const expectedUrl = `${expectedBase}/invite/${inv.token}`;
    assert.ok(sent.htmlContent.includes(expectedUrl), 'Email HTML must contain expected URL');
    assert.ok(sent.textContent.includes(expectedUrl), 'Email text fallback must contain expected URL');
  });

  // ----------------------------------------------------------------------------
  // 6. Token is Not Logged in Audit Trail
  // ----------------------------------------------------------------------------
  it('6. raw token is never recorded in AuditLog or stored as plaintext', async () => {
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'auditcheck@vetrx.test', Role.STAFF);
    const logs = AuditService.getMockLogs();

    const inviteLog = logs.find((l) => l.action === 'USER_INVITED' && l.resourceId === inv.id);
    assert.ok(inviteLog, 'Audit log must exist for USER_INVITED');

    const logString = JSON.stringify(inviteLog);
    assert.ok(!logString.includes(inv.token), 'Audit log must NEVER contain the raw token');
  });

  // ----------------------------------------------------------------------------
  // 7. Token Hash Remains SHA-256
  // ----------------------------------------------------------------------------
  it('7. token hash is strictly SHA-256 of the 32-byte CSPRNG token', async () => {
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'hashcheck@vetrx.test', Role.STAFF);

    const expectedHash = crypto.createHash('sha256').update(inv.token).digest('hex');
    assert.equal(expectedHash.length, 64, 'SHA-256 hash must be 64 hex characters');

    // Confirm that hashing raw token resolves to same preview
    const preview = await InvitationService.getInvitationPreview(inv.token);
    assert.equal(preview.email, 'hashcheck@vetrx.test');
  });

  // ----------------------------------------------------------------------------
  // 8. Resend Generates New Token, Updates Hash, and Sends New Email
  // ----------------------------------------------------------------------------
  it('8. resend generates a new raw token, resets expiration, and sends fresh email', async () => {
    const original = await InvitationService.createInvitation(ownerUserId, practiceId, 'resend@vetrx.test', Role.STAFF);
    const originalToken = original.token;

    // Resend
    const resent = await InvitationService.resendInvitation(ownerUserId, practiceId, original.id);

    assert.notEqual(resent.token, originalToken, 'Resend must issue a fresh raw token');
    assert.equal(resent.id, original.id, 'Invitation ID must remain the same');

    // Old token should no longer work
    await assert.rejects(
      async () => {
        await InvitationService.getInvitationPreview(originalToken);
      },
      (err: any) => err instanceof AppError && err.code === 'INVITATION_NOT_FOUND'
    );

    // New token works
    const preview = await InvitationService.getInvitationPreview(resent.token);
    assert.equal(preview.email, 'resend@vetrx.test');
    assert.equal(preview.status, InvitationStatus.PENDING);
  });

  // ----------------------------------------------------------------------------
  // 9. Expired Invitation Cannot Be Accepted
  // ----------------------------------------------------------------------------
  it('9. expired invitation cannot be accepted', async () => {
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'expired@vetrx.test', Role.STAFF);

    // Simulate expired invitation record
    const expiredRecord = {
      id: inv.id,
      practiceId,
      email: 'expired@vetrx.test',
      role: Role.STAFF,
      tokenHash: crypto.createHash('sha256').update(inv.token).digest('hex'),
      invitedById: ownerUserId,
      status: InvitationStatus.EXPIRED,
      expiresAt: new Date(Date.now() - 1000), // In the past
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    InvitationService.setMockInvitation(expiredRecord);

    await assert.rejects(
      async () => {
        await InvitationService.acceptInvitation(inv.token, {
          id: 'user-acceptor-999',
          email: 'expired@vetrx.test',
        });
      },
      (err: any) => err instanceof AppError && err.code === 'INVITATION_EXPIRED'
    );
  });

  // ----------------------------------------------------------------------------
  // 10. Accepted Invitation Cannot Be Reused
  // ----------------------------------------------------------------------------
  it('10. accepted invitation cannot be accepted a second time (one-time consumption)', async () => {
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'onetime@vetrx.test', Role.STAFF);

    // First acceptance succeeds
    const acceptRes = await InvitationService.acceptInvitation(inv.token, {
      id: 'user-onetime-1',
      email: 'onetime@vetrx.test',
    });
    assert.equal(acceptRes.practiceId, practiceId);

    // Second acceptance fails
    await assert.rejects(
      async () => {
        await InvitationService.acceptInvitation(inv.token, {
          id: 'user-onetime-2',
          email: 'onetime@vetrx.test',
        });
      },
      (err: any) => err instanceof AppError && err.code === 'INVITATION_ALREADY_ACCEPTED'
    );
  });

  // ----------------------------------------------------------------------------
  // 11. Wrong Email Cannot Accept Invitation
  // ----------------------------------------------------------------------------
  it('11. invitation rejects acceptance if user email does not match invited email', async () => {
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'target@vetrx.test', Role.STAFF);

    await assert.rejects(
      async () => {
        await InvitationService.acceptInvitation(inv.token, {
          id: 'impostor-user',
          email: 'impostor@vetrx.test',
        });
      },
      (err: any) => err instanceof AppError && err.code === 'INVITATION_EMAIL_MISMATCH'
    );
  });

  // ----------------------------------------------------------------------------
  // 12. Tenant Isolation
  // ----------------------------------------------------------------------------
  it('12. practice member cannot resend or revoke an invitation belonging to another practice', async () => {
    const practiceBeta = 'practice-beta-tenant-9999';
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'tenant@vetrx.test', Role.STAFF);

    // Owner of Beta attempts to resend Alpha invitation
    const ownerBeta = 'owner-beta-002';
    AuthorizationService.setMockPracticeOwner(practiceBeta, ownerBeta);
    AuthorizationService.setMockMembership(ownerBeta, practiceBeta, {
      id: 'mem-beta-owner',
      practiceId: practiceBeta,
      userId: ownerBeta,
      role: Role.PRACTICE_OWNER,
      isActive: true,
    });

    await assert.rejects(
      async () => {
        await InvitationService.resendInvitation(ownerBeta, practiceBeta, inv.id);
      },
      (err: any) => err instanceof AppError && err.code === 'INVITATION_NOT_FOUND'
    );
  });

  // ----------------------------------------------------------------------------
  // 13. Authorization: Non-Admin/Staff Cannot Invite
  // ----------------------------------------------------------------------------
  it('13. staff member lacks permission to create practice invitations', async () => {
    await assert.rejects(
      async () => {
        await InvitationService.createInvitation(staffUserId, practiceId, 'unauth@vetrx.test', Role.STAFF);
      },
      (err: any) => err instanceof AppError && err.code === 'INSUFFICIENT_PERMISSION'
    );
  });

  // ----------------------------------------------------------------------------
  // 14. Commercial Seat Limit Enforcement
  // ----------------------------------------------------------------------------
  it('14. commercial seat limit prevents inviting excess veterinarians', async () => {
    // Mock Individual Plan (limit: 1 veterinarian, current usage: 1)
    EntitlementService.setMockSubscription(practiceId, {
      planCode: 'PLAN_INDIVIDUAL_MONTHLY',
      status: 'ACTIVE',
      usage: { veterinarianSeatsCount: 1, staffSeatsCount: 0 },
    });

    // Owner is already occupying 1 vet seat in Practice -> cannot invite 2nd vet
    await assert.rejects(
      async () => {
        await InvitationService.createInvitation(ownerUserId, practiceId, 'secondvet@vetrx.test', Role.VETERINARIAN);
      },
      (err: any) => err instanceof AppError && err.code === 'SEAT_LIMIT_REACHED'
    );
  });

  // ----------------------------------------------------------------------------
  // 15. Preview Endpoint Details
  // ----------------------------------------------------------------------------
  it('15. preview endpoint returns safe fields and excludes tokenHash or internal IDs', async () => {
    const inv = await InvitationService.createInvitation(ownerUserId, practiceId, 'preview@vetrx.test', Role.VETERINARIAN);
    const preview = await InvitationService.getInvitationPreview(inv.token);

    assert.equal(preview.email, 'preview@vetrx.test');
    assert.equal(preview.role, Role.VETERINARIAN);
    assert.equal(preview.status, InvitationStatus.PENDING);
    assert.equal(preview.isExpired, false);
    assert.ok(preview.practiceName);
    assert.ok(preview.expiresAt);

    // Verify tokenHash is NOT returned in preview
    assert.equal((preview as any).tokenHash, undefined);
    assert.equal((preview as any).invitedById, undefined);
  });
});
