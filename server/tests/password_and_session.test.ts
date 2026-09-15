import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PasswordService } from '../src/lib/password.js';
import { SessionService } from '../src/auth/session.service.js';

describe('Password & Security Service Tests', () => {
  it('validates password strength according to policy', () => {
    // Too short
    assert.strictEqual(PasswordService.validatePasswordStrength('short1').isValid, false);
    // No number
    assert.strictEqual(PasswordService.validatePasswordStrength('alllettersonly').isValid, false);
    // No letters
    assert.strictEqual(PasswordService.validatePasswordStrength('1234567890').isValid, false);
    // Common weak password
    assert.strictEqual(PasswordService.validatePasswordStrength('password').isValid, false);
    assert.strictEqual(PasswordService.validatePasswordStrength('12345678').isValid, false);

    // Valid passwords
    assert.strictEqual(PasswordService.validatePasswordStrength('SecurePass2026!').isValid, true);
    assert.strictEqual(PasswordService.validatePasswordStrength('vetrxDoctor#99').isValid, true);
  });

  it('hashes password with bcrypt and verifies correctly', async () => {
    const raw = 'SuperSecret123!';
    const hash = await PasswordService.hashPassword(raw);

    assert.notStrictEqual(hash, raw);
    assert.strictEqual(hash.startsWith('$2'), true); // bcrypt format

    const isValid = await PasswordService.verifyPassword(raw, hash);
    assert.strictEqual(isValid, true);

    const isWrong = await PasswordService.verifyPassword('WrongSecret123!', hash);
    assert.strictEqual(isWrong, false);
  });
});

describe('Session Security & Token Management Tests', () => {
  it('generates secure 64-character hex raw token and SHA-256 hash', () => {
    const rawToken = SessionService.generateRawToken();
    assert.strictEqual(rawToken.length, 64);

    const hash = SessionService.hashToken(rawToken);
    assert.strictEqual(hash.length, 64);
    assert.notStrictEqual(rawToken, hash);

    // Re-hashing produces same SHA-256 digest
    assert.strictEqual(SessionService.hashToken(rawToken), hash);
  });
});
