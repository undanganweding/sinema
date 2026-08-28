import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { apiRouter } from './routes';

dotenv.config();

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API router mounted under /api
  app.use('/api', apiRouter);

  // Fallback handler for serverless environments where /api might be stripped by the router
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/assets')) {
      return apiRouter(req, res, next);
    }
    next();
  });

  // Global server error handling
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      error: err?.message || 'Internal Server Error',
    });
  });

  return app;
}
