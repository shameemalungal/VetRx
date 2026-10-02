import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthenticatedIdentity, IdentityProvider } from '../types/index.js';

export interface PkceCodes {
  codeVerifier: string;
  codeChallenge: string;
}

export class GoogleOAuthProvider implements IdentityProvider {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = env.GOOGLE_CALLBACK_URL || '';
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  /**
   * Generates standard RFC 7636 PKCE code_verifier and S256 code_challenge.
   */
  generatePkcePair(): PkceCodes {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /**
   * Constructs the Google OAuth authorization URL with optional PKCE challenge.
   */
  getAuthorizationUrl(state: string, codeChallenge?: string): string {
    if (!this.isConfigured()) {
      throw new AppError(
        500,
        'OAUTH_NOT_CONFIGURED',
        'Google OAuth credentials are not configured on this server.'
      );
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });

    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for tokens and validates ID token claims.
   */
  async handleCallback(code: string, codeVerifier?: string): Promise<AuthenticatedIdentity> {
    if (!this.isConfigured()) {
      throw new AppError(
        500,
        'OAUTH_NOT_CONFIGURED',
        'Google OAuth credentials are not configured on this server.'
      );
    }

    // 1. Exchange authorization code for tokens
    const bodyParams = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    if (codeVerifier) {
      bodyParams.set('code_verifier', codeVerifier);
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams,
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      logger.error('Google token exchange failed', { status: tokenResponse.status, error: errBody });
      throw new AppError(400, 'OAUTH_TOKEN_EXCHANGE_FAILED', 'Failed to exchange authorization code with Google.');
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string; id_token?: string };

    // 2. Validate ID Token if present (OpenID Connect validation)
    let idTokenClaims: Record<string, unknown> | null = null;
    if (tokenData.id_token) {
      try {
        const parts = tokenData.id_token.split('.');
        if (parts.length === 3) {
          idTokenClaims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          
          // Verify Issuer
          const iss = idTokenClaims?.iss;
          if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
            throw new Error(`Invalid ID token issuer: ${iss}`);
          }

          // Verify Audience
          const aud = idTokenClaims?.aud;
          if (aud !== this.clientId) {
            throw new Error(`ID token audience mismatch: ${aud}`);
          }

          // Verify Expiration
          const exp = typeof idTokenClaims?.exp === 'number' ? idTokenClaims.exp : 0;
          const nowSec = Math.floor(Date.now() / 1000);
          if (exp < nowSec) {
            throw new Error(`ID token expired at ${exp}, current: ${nowSec}`);
          }
        }
      } catch (err: unknown) {
        logger.error('Google ID token validation failed', { error: err instanceof Error ? err.message : String(err) });
        throw new AppError(400, 'INVALID_ID_TOKEN', 'Google ID token signature or claims validation failed.');
      }
    }

    // 3. Fetch verified user profile using access token
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new AppError(400, 'OAUTH_USERINFO_FAILED', 'Failed to fetch user profile from Google.');
    }

    const profile = (await userInfoResponse.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
      email_verified?: boolean;
    };

    if (!profile.sub || !profile.email) {
      throw new AppError(400, 'INVALID_OAUTH_PAYLOAD', 'Google response missing essential identity attributes.');
    }

    // Cross-verify sub with ID token sub if ID token was decoded
    if (idTokenClaims && idTokenClaims.sub && idTokenClaims.sub !== profile.sub) {
      throw new AppError(400, 'OAUTH_SUBJECT_MISMATCH', 'User profile subject mismatch with ID token.');
    }

    return {
      provider: 'google',
      providerUserId: profile.sub,
      email: profile.email.toLowerCase().trim(),
      name: profile.name || profile.email.split('@')[0],
      avatarUrl: profile.picture,
      emailVerified: Boolean(profile.email_verified ?? idTokenClaims?.email_verified ?? false),
    };
  }
}

export const googleOAuthProvider = new GoogleOAuthProvider();
