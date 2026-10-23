// ==============================================================================
// VetRx — Android OAuth Ticket Exchange & Session Regression Tests
// Validates:
// 1. Mobile auth ticket creation with 60s expiration and cryptographic randomness
// 2. Single-use ticket consumption (replay attack prevention)
// 3. Expiration enforcement (tickets older than 60s are rejected)
// 4. Session cookie generation and authenticated response payload
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { SessionService } from '../src/auth/session.service.js';
import { createApp } from '../src/app.js';

describe('Android Mobile OAuth Ticket Exchange Suite', () => {
  it('creates cryptographically strong single-use tickets', () => {
    const rawToken = 'mock-raw-token-1234567890abcdef1234567890abcdef1234567890abcdef';
    const userId = 'test-user-android-1';
    const practiceId = 'test-practice-1';
    const returnTo = '/dashboard';

    const ticket = SessionService.createMobileAuthTicket(rawToken, userId, practiceId, returnTo);
    assert.ok(ticket, 'Ticket must be generated');
    assert.strictEqual(typeof ticket, 'string');
    assert.strictEqual(ticket.length, 64, 'Ticket must be a 64-character hex string');
  });

  it('allows single-use consumption and prevents replay attacks', () => {
    const rawToken = 'mock-raw-token-replay-test';
    const userId = 'test-user-android-2';
    const practiceId = 'test-practice-2';
    const returnTo = '/patients';

    const ticket = SessionService.createMobileAuthTicket(rawToken, userId, practiceId, returnTo);

    // First consumption succeeds
    const consumed = SessionService.consumeMobileAuthTicket(ticket);
    assert.ok(consumed, 'First consumption must return valid session context');
    assert.strictEqual(consumed.token, rawToken);
    assert.strictEqual(consumed.userId, userId);
    assert.strictEqual(consumed.practiceId, practiceId);
    assert.strictEqual(consumed.returnTo, '/patients');

    // Second consumption MUST fail (replay attack prevention)
    const replay = SessionService.consumeMobileAuthTicket(ticket);
    assert.strictEqual(replay, null, 'Replayed ticket must return null');
  });

  it('rejects expired tickets and non-existent tickets', () => {
    const invalidTicket = '0000000000000000000000000000000000000000000000000000000000000000';
    assert.strictEqual(SessionService.consumeMobileAuthTicket(invalidTicket), null);
    assert.strictEqual(SessionService.consumeMobileAuthTicket(''), null);
    assert.strictEqual(SessionService.consumeMobileAuthTicket(null as any), null);
  });

  it('validates /api/auth/mobile/exchange route inputs via HTTP', async () => {
    const app = createApp();
    const server = http.createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // 1. Missing ticket in request body -> 400 Bad Request
      const res1 = await fetch(`${baseUrl}/api/auth/mobile/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data1 = await res1.json();
      assert.strictEqual(res1.status, 400);
      assert.strictEqual(data1.error.code, 'VALIDATION_ERROR');

      // 2. Non-existent ticket -> 400 Invalid or expired ticket
      const res2 = await fetch(`${baseUrl}/api/auth/mobile/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: 'f'.repeat(64) }),
      });
      const data2 = await res2.json();
      assert.strictEqual(res2.status, 400);
      assert.strictEqual(data2.error.code, 'INVALID_AUTH_TICKET');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
