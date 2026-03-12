import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { pool } from '../config/db';
import * as queries from '../db/queries';

const router = Router();

const MaintenanceWindowSchema = z.object({
  name: z.string().min(1).max(200),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  serverId: z.number().int().nullable().optional(),
  processName: z.string().max(255).nullable().optional(),
  recurring: z.string().max(100).nullable().optional(),
});

// GET /api/maintenance — list all windows
router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT mw.*, u.username as created_by_name FROM maintenance_windows mw LEFT JOIN users u ON mw.created_by = u.id ORDER BY starts_at DESC',
    );
    res.json(rows);
  } catch (err) {
    console.error('List maintenance windows error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/maintenance
router.post('/', authMiddleware, rbac('operator', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = MaintenanceWindowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    const { name, startsAt, endsAt, serverId, processName, recurring } = parsed.data;
    const { rows } = await pool.query(
      `INSERT INTO maintenance_windows (name, starts_at, ends_at, server_id, process_name, recurring, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, startsAt, endsAt, serverId ?? null, processName ?? null, recurring ?? null, req.user!.id],
    );
    await queries.insertAuditLog(req.user!.id, 'maintenance_created', `Window ${rows[0].id}`, req.ip || null);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create maintenance window error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/maintenance/:id
router.delete('/:id', authMiddleware, rbac('operator', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM maintenance_windows WHERE id = $1', [id]);
    await queries.insertAuditLog(req.user!.id, 'maintenance_deleted', `Window ${id}`, req.ip || null);
    res.json({ message: 'Maintenance window deleted' });
  } catch (err) {
    console.error('Delete maintenance window error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: check if a process/server is in maintenance now
export async function isInMaintenanceWindow(
  serverId: number | null,
  processName: string | null,
): Promise<boolean> {
  const now = new Date();
  const result = await pool.query(
    `SELECT id FROM maintenance_windows
     WHERE starts_at <= $1 AND ends_at >= $1
       AND (server_id IS NULL OR server_id = $2)
       AND (process_name IS NULL OR process_name = $3)
     LIMIT 1`,
    [now, serverId, processName],
  );
  return (result.rowCount ?? 0) > 0;
}

export default router;
