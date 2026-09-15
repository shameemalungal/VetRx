import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const healthRouter = Router();

/**
 * GET /api/health
 * Liveness probe: Confirms backend HTTP server is up and responsive.
 */
healthRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/ready
 * Readiness probe: Confirms PostgreSQL connectivity via active query.
 */
healthRouter.get('/ready', async (req, res) => {
  try {
    // Perform light database ping
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Readiness check failed: Database unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});
