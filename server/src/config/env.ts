import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env if present
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Session Security
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters').default('development_secret_do_not_use_in_production_12345'),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  COOKIE_NAME: z.string().default('vetrx_session'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().optional().default('http://localhost:4000/api/auth/google/callback'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(20),

  // Transactional Email (Brevo / SMTP)
  EMAIL_ENABLED: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase() === 'true' || val.trim() === '1' : Boolean(val)),
    z.boolean()
  ).default(false),
  EMAIL_FROM: z.string().default('supportvetrx@gmail.com'),
  EMAIL_FROM_NAME: z.string().default('VetRx'),
  BREVO_API_KEY: z.string().optional().default(''),
  APP_BASE_URL: z.string().default('https://vetrx.brightbase.in'),
});

export type EnvConfig = z.infer<typeof envSchema>;

function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error('FATAL: Environment validation failed:\n' + errorDetails);
    process.exit(1);
  }

  const env = result.data;

  // Additional strict production validation
  if (env.NODE_ENV === 'production') {
    if (env.SESSION_SECRET.length < 32) {
      console.error('FATAL: In production, SESSION_SECRET must be at least 32 characters long.');
      process.exit(1);
    }
    if (env.SESSION_SECRET.includes('development_secret')) {
      console.error('FATAL: Production cannot use default development session secret.');
      process.exit(1);
    }
    if (env.EMAIL_ENABLED && (!env.BREVO_API_KEY || env.BREVO_API_KEY.trim() === '')) {
      console.error('FATAL: In production with EMAIL_ENABLED=true, BREVO_API_KEY must be provided.');
      process.exit(1);
    }
  }

  return env;
}

export const env = parseEnv();
