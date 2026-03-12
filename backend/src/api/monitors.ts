import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import * as queries from '../db/queries';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await queries.listMonitors();
    res.json(rows);
  } catch (err) {
    console.error('List monitors error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, rbac('admin', 'operator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, config, intervalSeconds, retentionDays } = req.body;
    if (!name || !type || !config) {
      res.status(400).json({ error: 'name, type, and config are required' });
      return;
    }
    const { rows } = await queries.createMonitor(
      req.user!.id, name, type, config,
      intervalSeconds || 60, retentionDays || 90
    );
    await queries.insertAuditLog(req.user!.id, 'monitor_created', `Monitor ${rows[0].id}`, req.ip || null);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create monitor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, rbac('admin', 'operator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await queries.updateMonitor(id, req.body);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Monitor not found' });
      return;
    }
    await queries.insertAuditLog(req.user!.id, 'monitor_updated', `Monitor ${id}`, req.ip || null);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update monitor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, rbac('admin', 'operator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await queries.deleteMonitor(id);
    await queries.insertAuditLog(req.user!.id, 'monitor_deleted', `Monitor ${id}`, req.ip || null);
    res.json({ message: 'Monitor deleted' });
  } catch (err) {
    console.error('Delete monitor error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
