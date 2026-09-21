import crypto from 'crypto';
import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export class SessionService {
  /**
   * Hashes a raw session token using SHA-256.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a cryptographically secure random token (32 bytes hex).
   */
  static generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Creates a new session in the database and returns the raw token.
   */
  static async createSession(params: {
    userId: string;
    practiceId?: string | null;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    const rawToken = this.generateRawToken();
    const sessionTokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.SESSION_TTL_DAYS);

    await prisma.session.create({
      data: {
        userId: params.userId,
        practiceId: params.practiceId || null,
        sessionTokenHash,
        expiresAt,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });

    logger.debug('Session created for user', { userId: params.userId, practiceId: params.practiceId });
    return rawToken;
  }

  /**
   * Updates the active practice context for a session.
   */
  static async updateSessionPractice(sessionId: string, practiceId: string): Promise<void> {
    await prisma.session.update({
      where: { id: sessionId },
      data: { practiceId },
    });
    logger.debug('Session practice context updated', { sessionId, practiceId });
  }

  /**
   * Validates a raw session token against the database.
   * Returns active session and associated user if valid, otherwise null.
   */
  static async validateSession(rawToken: string) {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const sessionTokenHash = this.hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { sessionTokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            emailVerified: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) return null;

    // Check revocation
    if (session.revokedAt) {
      logger.debug('Rejected revoked session', { sessionId: session.id });
      return null;
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      logger.debug('Rejected expired session', { sessionId: session.id });
      return null;
    }

    // Check if user account is active
    if (!session.user || !session.user.isActive) {
      logger.debug('Rejected session for inactive user', { userId: session.userId });
      return null;
    }

    // Update lastUsedAt asynchronously (sliding touch)
    prisma.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => logger.warn('Failed to update session lastUsedAt', { error: String(err) }));

    return session;
  }

  /**
   * Revokes a session by raw token.
   */
  static async revokeSession(rawToken: string): Promise<void> {
    if (!rawToken) return;

    const sessionTokenHash = this.hashToken(rawToken);
    try {
      await prisma.session.updateMany({
        where: { sessionTokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      logger.debug('Session revoked successfully');
    } catch (err) {
      logger.warn('Error while revoking session', { error: String(err) });
    }
  }

  /**
   * Attaches the secure session cookie to the response.
   */
  static setCookie(res: Response, rawToken: string): void {
    const isProd = env.NODE_ENV === 'production';
    res.cookie(env.COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  /**
   * Clears the session cookie.
   */
  static clearCookie(res: Response): void {
    const isProd = env.NODE_ENV === 'production';
    res.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  }
}
