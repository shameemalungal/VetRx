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
});

const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

// ------------------------------------------------------------------------------
// Route Handlers
// ------------------------------------------------------------------------------

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

    const context = await AuthService.getMeContext(req.user.id);
    res.status(200).json(context);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/google/start
 * Initiates Google OAuth consent flow with cryptographic state cookie.
 */
authRouter.get('/google/start', (req, res, next) => {
  try {
    const state = crypto.randomBytes(24).toString('hex');

    // Store state in short-lived HTTP-only cookie for verification
    res.cookie('vetrx_oauth_state', state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000, // 10 minutes
      path: '/api/auth/google',
    });

    const authUrl = googleOAuthProvider.getAuthorizationUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/google/callback
 * Validates Google OAuth callback, verifies state, and logs in user.
 */
authRouter.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      throw new AppError(400, 'OAUTH_DENIED', `Google OAuth access was denied: ${String(error)}`);
    }

    if (!code || typeof code !== 'string') {
      throw new AppError(400, 'MISSING_OAUTH_CODE', 'Missing authorization code from Google.');
    }

    const storedState = req.cookies?.vetrx_oauth_state;
    if (!storedState || storedState !== state) {
      throw new AppError(400, 'INVALID_OAUTH_STATE', 'OAuth state mismatch or expired. Please try again.');
    }

    // Clear state cookie
    res.clearCookie('vetrx_oauth_state', { path: '/api/auth/google' });

    const identity = await googleOAuthProvider.handleCallback(code);

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { token } = await AuthService.handleOAuthIdentity(identity, {
      ipAddress,
      userAgent,
    });

    SessionService.setCookie(res, token);

    // Redirect to frontend application root
    res.redirect(env.APP_URL);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Google authentication failed';
    const redirectUrl = new URL('/login', env.APP_URL);
    redirectUrl.searchParams.set('error', message);
    res.redirect(redirectUrl.toString());
  }
});
