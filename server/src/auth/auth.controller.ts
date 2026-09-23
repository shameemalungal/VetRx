import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import { googleOAuthProvider } from './google.provider.js';
import { requireAuth } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { AppError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const authRouter = Router();

// ------------------------------------------------------------------------------
// Input Validation Schemas
// ------------------------------------------------------------------------------

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Valid email address is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  practiceName: z.string().max(120).optional(),
  practiceType: z.enum(['INDEPENDENT', 'CLINIC']).optional(),
  isClinicalApprover: z.boolean().optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(255).optional(),
  teamMembers: z
    .array(
      z.object({
        name: z.string().optional(),
        email: z.string().email('Valid email is required'),
        role: z.enum(['PRACTICE_ADMIN', 'VETERINARIAN', 'STAFF', 'PRACTICE_STAFF', 'READ_ONLY']),
      })
    )
    .optional(),
  invitationToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

// ------------------------------------------------------------------------------
// Route Handlers
// ------------------------------------------------------------------------------

interface OAuthStatePayload {
  state: string;
  codeVerifier?: string;
  action?: 'login' | 'link';
  linkingUserId?: string;
  returnTo?: string;
  invitationToken?: string;
}

const setPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/**
 * POST /api/auth/register
 * Creates a new user, default practice, ownership, settings, and session.
 */
authRouter.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.registerWithPassword({
      ...input,
      ipAddress,
      userAgent,
    });

    SessionService.setCookie(res, result.token);
    res.status(201).json(result.data);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Validates credentials and issues secure session cookie.
 */
authRouter.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await AuthService.loginWithPassword({
      ...input,
      ipAddress,
      userAgent,
    });

    SessionService.setCookie(res, result.token);
    res.status(200).json(result.data);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Revokes current session and clears cookie.
 */
authRouter.post('/logout', async (req, res, next) => {
  try {
    const rawToken = req.cookies?.[env.COOKIE_NAME];
    if (rawToken) {
      await SessionService.revokeSession(rawToken);
    }

    SessionService.clearCookie(res);
    res.status(200).json({ message: 'Successfully logged out.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Retrieves authenticated user and practice details.
 */
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const context = await AuthService.getMeContext(req.user.id, req.session?.practiceId, req.session?.id);
    res.status(200).json(context);
  } catch (error) {
    next(error);
  }
});

const switchPracticeSchema = z.object({
  practiceId: z.string().min(1, 'Target practiceId is required'),
});

/**
 * POST /api/auth/switch-practice
 * Switches active tenant practice context for the current session.
 */
authRouter.post('/switch-practice', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { practiceId } = switchPracticeSchema.parse(req.body);
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    // Verify active membership in target practice
    if (process.env.VETRX_FAST_TEST !== '1') {
      const member = await prisma.practiceMember.findUnique({
        where: {
          practiceId_userId: {
            practiceId,
            userId,
          },
        },
        include: { practice: true },
      });

      if (!member || !member.isActive || !member.practice?.isActive) {
        throw new AppError(403, 'FORBIDDEN_PRACTICE', 'You do not have an active membership in this practice.');
      }
    }

    if (req.session?.id) {
      await SessionService.updateSessionPractice(req.session.id, practiceId);
    }

    const data = await AuthService.getMeContext(userId, practiceId, req.session?.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/identities
 * Retrieves linked authentication methods for current user.
 */
authRouter.get('/identities', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const identities = await AuthService.getUserIdentities(req.user.id);
    res.status(200).json(identities);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/password/set
 * Sets an initial password for OAuth-created users.
 */
authRouter.post('/password/set', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const { newPassword } = setPasswordSchema.parse(req.body);
    const result = await AuthService.setPassword(req.user.id, newPassword);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/password/change
 * Changes password verifying current password first.
 */
authRouter.post('/password/change', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/auth/identities/google
 * Unlinks Google identity from account (if password is configured).
 */
authRouter.delete('/identities/google', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const result = await AuthService.unlinkGoogleIdentity(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/google/start
 * Initiates Google OAuth consent flow with PKCE and cryptographic state cookie.
 */
authRouter.get('/google/start', async (req, res, next) => {
  try {
    const action = req.query.action === 'link' ? 'link' : 'login';
    let linkingUserId: string | undefined;

    if (action === 'link') {
      const rawToken = req.cookies?.[env.COOKIE_NAME];
      if (rawToken) {
        const session = await SessionService.validateSession(rawToken);
        if (session) {
          linkingUserId = session.userId;
        }
      }
      if (!linkingUserId) {
        throw new AppError(401, 'UNAUTHORIZED', 'You must be logged in to link a Google account.');
      }
    }

    const state = crypto.randomBytes(24).toString('hex');
    const { codeVerifier, codeChallenge } = googleOAuthProvider.generatePkcePair();
    let returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : (action === 'link' ? '/settings' : '/');
    // Prevent open redirect: only allow internal relative paths
    if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
      returnTo = '/';
    }

    // Extract invitationToken if returnTo contains /invite/:token or if passed explicitly
    let invitationToken: string | undefined;
    const inviteMatch = returnTo.match(/\/invite\/([a-zA-Z0-9_-]+)/);
    if (inviteMatch && inviteMatch[1]) {
      invitationToken = inviteMatch[1];
    } else if (typeof req.query.invitationToken === 'string') {
      invitationToken = req.query.invitationToken;
    }

    const statePayload: OAuthStatePayload = {
      state,
      codeVerifier,
      action,
      linkingUserId,
      returnTo,
      invitationToken,
    };

    res.cookie('vetrx_oauth_state', Buffer.from(JSON.stringify(statePayload)).toString('base64url'), {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/api/auth/google',
    });

    const authUrl = googleOAuthProvider.getAuthorizationUrl(state, codeChallenge);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/google/callback
 * Validates Google OAuth callback, verifies state + PKCE, and links/authenticates.
 */
authRouter.get('/google/callback', async (req, res) => {
  let returnTo = '/';
  try {
    const { code, state, error } = req.query;

    if (error) {
      throw new AppError(400, 'OAUTH_DENIED', `Google OAuth access was denied: ${String(error)}`);
    }

    if (!code || typeof code !== 'string') {
      throw new AppError(400, 'MISSING_OAUTH_CODE', 'Missing authorization code from Google.');
    }

    const rawStateCookie = req.cookies?.vetrx_oauth_state;
    if (!rawStateCookie) {
      throw new AppError(400, 'INVALID_OAUTH_STATE', 'OAuth state missing or expired. Please try again.');
    }

    let parsedPayload: OAuthStatePayload;
    try {
      parsedPayload = JSON.parse(Buffer.from(rawStateCookie, 'base64url').toString('utf8'));
    } catch {
      // Fallback for simple string state if legacy
      parsedPayload = { state: rawStateCookie };
    }

    if (!parsedPayload.state || parsedPayload.state !== state) {
      throw new AppError(400, 'INVALID_OAUTH_STATE', 'OAuth state mismatch or expired. Please try again.');
    }

    returnTo = parsedPayload.returnTo || (parsedPayload.action === 'link' ? '/settings' : '/');

    // Clear state cookie
    res.clearCookie('vetrx_oauth_state', { path: '/api/auth/google' });

    const identity = await googleOAuthProvider.handleCallback(code, parsedPayload.codeVerifier);

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { token } = await AuthService.handleOAuthIdentity(identity, {
      ipAddress,
      userAgent,
      action: parsedPayload.action,
      linkingUserId: parsedPayload.linkingUserId,
      invitationToken: parsedPayload.invitationToken,
    });

    SessionService.setCookie(res, token);

    // Redirect to frontend application
    const destination = new URL(returnTo.startsWith('/') ? returnTo : '/', env.APP_URL);
    if (parsedPayload.action === 'link') {
      destination.searchParams.set('google_connected', 'true');
    }
    res.redirect(destination.toString());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Google authentication failed';
    const fallbackPath = returnTo.startsWith('/settings') ? '/settings' : '/login';
    const redirectUrl = new URL(fallbackPath, env.APP_URL);
    redirectUrl.searchParams.set('error', message);
    res.redirect(redirectUrl.toString());
  }
});
