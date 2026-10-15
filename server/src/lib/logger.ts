import { env } from '../config/env.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'sessiontoken',
  'sessiontokenhash',
  'cookie',
  'authorization',
  'google_client_secret',
  'secret',
  'clientsecret',
  'token',
  'invitationtoken',
  'invitation_token',
  'verificationtoken',
  'verification_token',
  'verificationcode',
  'verification_code',
  'code',
  'apikey',
  'api_key',
  'credentials',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
]);

/**
 * Sanitizes URLs by redacting sensitive query parameters (tokens, passwords, keys).
 */
export function sanitizeUrl(url?: string): string {
  if (!url) return '';
  try {
    const [path, queryString] = url.split('?');
    if (!queryString) return path;
    const params = new URLSearchParams(queryString);
    for (const key of Array.from(params.keys())) {
      const lowerKey = key.toLowerCase();
      if (
        SENSITIVE_KEYS.has(lowerKey) ||
        lowerKey.includes('token') ||
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('password') ||
        lowerKey.includes('code')
      ) {
        params.set(key, '[REDACTED]');
      }
    }
    const sanitizedQuery = params.toString();
    return sanitizedQuery ? `${path}?${sanitizedQuery}` : path;
  } catch {
    return url.split('?')[0] || '';
  }
}

function maskSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.includes('?') && (obj.startsWith('/') || obj.startsWith('http://') || obj.startsWith('https://'))) {
      return sanitizeUrl(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitive(item, depth + 1));
  }
  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = k.toLowerCase();
      if (
        SENSITIVE_KEYS.has(lowerKey) ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('key')
      ) {
        masked[k] = '***REDACTED***';
      } else {
        masked[k] = maskSensitive(v, depth + 1);
      }
    }
    return masked;
  }
  return obj;
}

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta ? maskSensitive(meta) : undefined;

    if (env.NODE_ENV === 'production') {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...(sanitizedMeta as Record<string, unknown> || {}),
      });
    } else {
      const metaStr = sanitizedMeta ? ` ${JSON.stringify(sanitizedMeta)}` : '';
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      return `${prefix} ${message}${metaStr}`;
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(this.formatMessage('error', message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
