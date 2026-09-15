import { env } from '../config/env.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'sessiontoken',
  'sessiontokenhash',
  'cookie',
  'authorization',
  'google_client_secret',
  'secret',
  'clientsecret',
]);

function maskSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitive(item, depth + 1));
  }
  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
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
