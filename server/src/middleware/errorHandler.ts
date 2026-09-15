import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { ApiErrorResponse, AuthenticatedRequest } from '../types/index.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const requestId = authReq.id;

  // 1. Handled App Errors
  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, {
      code: err.code,
      status: err.statusCode,
      requestId,
      url: req.originalUrl,
    });

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        details: err.details,
      },
    } satisfies ApiErrorResponse);
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedDetails = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));

    logger.warn('Validation error', { details: formattedDetails, requestId, url: req.originalUrl });

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload.',
        requestId,
        details: formattedDetails,
      },
    } satisfies ApiErrorResponse);
    return;
  }

  // 3. Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      logger.warn('Prisma unique constraint violation', {
        target: err.meta?.target,
        requestId,
      });

      res.status(409).json({
        error: {
          code: 'RESOURCE_CONFLICT',
          message: 'A record with this identifier or email already exists.',
          requestId,
        },
      } satisfies ApiErrorResponse);
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Requested record was not found.',
          requestId,
        },
      } satisfies ApiErrorResponse);
      return;
    }
  }

  // 4. Unhandled Internal Server Errors
  const errorObj = err instanceof Error ? err : new Error(String(err));
  logger.error('Unhandled server error', {
    name: errorObj.name,
    message: errorObj.message,
    stack: env.NODE_ENV !== 'production' ? errorObj.stack : undefined,
    requestId,
    url: req.originalUrl,
  });

  const response: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred. Please try again later.'
          : errorObj.message,
      requestId,
    },
  };

  res.status(500).json(response);
}
