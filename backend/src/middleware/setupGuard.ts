import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/db';

export const setupGuard = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // Always allow setup and health endpoints
  if (req.path.startsWith('/api/setup') || req.path === '/api/health') {
    next();
    return;
  }

  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM users WHERE role = 'admin'",
    );
    if (parseInt(result.rows[0].count, 10) === 0) {
      res.status(503).json({ error: 'Application not configured.', setupRequired: true });
      return;
    }
  } catch {
    // Table might not exist yet during first migration — let through
  }

  next();
};
