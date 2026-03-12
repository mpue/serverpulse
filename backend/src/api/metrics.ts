import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as queries from '../db/queries';

const router = Router();

router.get('/:monitorId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const monitorId = parseInt(req.params.monitorId, 10);
    const from = (req.query.from as string) || new Date(Date.now() - 3600000).toISOString();
    const to = (req.query.to as string) || new Date().toISOString();

    const { rows } = await queries.queryMetrics(monitorId, from, to);
    res.json(rows);
  } catch (err) {
    console.error('Metrics query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
