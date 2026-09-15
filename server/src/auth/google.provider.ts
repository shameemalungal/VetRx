import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthenticatedIdentity, IdentityProvider } from '../types/index.js';

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

  getAuthorizationUrl(state: string): string {
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

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<AuthenticatedIdentity> {
    if (!this.isConfigured()) {
      throw new AppError(
        500,
        'OAUTH_NOT_CONFIGURED',
        'Google OAuth credentials are not configured on this server.'
      );
    }

    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      logger.error('Google token exchange failed', { status: tokenResponse.status, error: errBody });
      throw new AppError(400, 'OAUTH_TOKEN_EXCHANGE_FAILED', 'Failed to exchange authorization code with Google.');
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string; id_token: string };

    // 2. Fetch verified user profile using access token
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

    return {
      provider: 'google',
      providerUserId: profile.sub,
      email: profile.email.toLowerCase().trim(),
      name: profile.name || profile.email.split('@')[0],
      avatarUrl: profile.picture,
      emailVerified: Boolean(profile.email_verified),
    };
  }
}

export const googleOAuthProvider = new GoogleOAuthProvider();
