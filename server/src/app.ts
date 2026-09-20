import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import { authRouter } from './auth/auth.controller.js';
import { practiceRouter } from './practice/practice.controller.js';
import { healthRouter } from './health/health.controller.js';
import { clinicalRouter } from './clinical/clinical.controller.js';
import { commercialRouter } from './commercial/commercial.controller.js';
import type { AuthenticatedRequest } from './types/index.js';

export function createApp() {
  const app = express();

  // Trust reverse proxy (e.g. NGINX on VPS)
  app.set('trust proxy', 1);

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS Configuration (Strict Origins Only)
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl) in dev
        if (!origin && env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked for origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Body Parsing & Size Limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Request ID & Logging Middleware
  app.use((req, res, next) => {
    const authReq = req as AuthenticatedRequest;
    authReq.id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', authReq.id);

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`, {
        requestId: authReq.id,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
      });
    });

    next();
  });

  // Apply General Rate Limiting to /api
  app.use('/api', apiRateLimiter);

  // Mount API Endpoints
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/practice', practiceRouter);
  app.use('/api/commercial', commercialRouter);
  app.use('/api', clinicalRouter);

  // 404 Catch-All
  app.use((req, res, next) => {
    next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
