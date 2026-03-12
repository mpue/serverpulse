import { Request, Response, NextFunction } from 'express';

interface AppError extends Error {
  status?: number;
  expose?: boolean;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  const message = err.expose ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
}
