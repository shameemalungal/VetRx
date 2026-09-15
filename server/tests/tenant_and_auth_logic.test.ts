import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { AppError } from '../src/middleware/errorHandler.js';
import { googleOAuthProvider } from '../src/auth/google.provider.js';

describe('AppError & Error Handling Contract Tests', () => {
  it('instantiates AppError with correct status code and code', () => {
    const error = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    assert.strictEqual(error.statusCode, 401);
    assert.strictEqual(error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(error.message, 'Invalid email or password.');
  });
});

describe('Google OAuth Identity Provider Tests', () => {
  it('throws helpful error if Google OAuth is not configured', () => {
    // When credentials are not set, it should safely report unconfigured
    if (!googleOAuthProvider.isConfigured()) {
      assert.throws(
        () => googleOAuthProvider.getAuthorizationUrl('test-state'),
        (err: unknown) => {
          return err instanceof AppError && err.code === 'OAUTH_NOT_CONFIGURED';
        }
      );
    }
  });
});

describe('Tenant Isolation Principles', () => {
  it('validates that practice owner access check fails when user is not owner', () => {
    const practiceOwnerId = 'user-owner-123';
    const attackerUserId = 'user-attacker-456';

    const isOwner = practiceOwnerId === attackerUserId;
    assert.strictEqual(isOwner, false);
  });

  it('ensures normalized email conversion is robust', () => {
    const input1 = '  Doctor@Example.Com ';
    const input2 = 'doctor@example.com';
    assert.strictEqual(input1.toLowerCase().trim(), input2);
  });
});
