import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import * as queries from '../db/queries';

const AlertRuleSchema = z.object({
  name: z.string().min(1).max(100),
  processName: z.string().min(1).max(255),
  metric: z.enum(['cpu', 'memory', 'missing', 'restarts']),
  operator: z.enum(['>', '<', '=']),
  threshold: z.number().min(0).max(100),
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  cooldownSeconds: z.number().int().min(60).max(86400).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  channels: z.array(z.object({ type: z.string(), target: z.string() })).max(10).optional(),
});

const UpdateAlertRuleSchema = AlertRuleSchema.partial();

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await queries.listAlertRules();
    res.json(rows);
  } catch (err) {
    console.error('List alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, rbac('admin', 'operator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = AlertRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    const { rows } = await queries.createAlertRule(req.user!.id, parsed.data);
    await queries.insertAuditLog(req.user!.id, 'alert_rule_created', `Rule ${rows[0].id}`, req.ip || null);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, rbac('admin', 'operator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid alert rule ID' });
      return;
    }
    const parsed = UpdateAlertRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }
    const { rows } = await queries.updateAlertRule(id, parsed.data);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Alert rule not found' });
      return;
    }
    await queries.insertAuditLog(req.user!.id, 'alert_rule_updated', `Rule ${id}`, req.ip || null);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, rbac('admin', 'operator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await queries.deleteAlertRule(id);
    await queries.insertAuditLog(req.user!.id, 'alert_rule_deleted', `Rule ${id}`, req.ip || null);
    res.json({ message: 'Alert rule deleted' });
  } catch (err) {
    console.error('Delete alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      severity: req.query.severity as string | undefined,
    };
    const { rows } = await queries.queryAlertEvents(filters);
    res.json(rows);
  } catch (err) {
    console.error('Alert history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/history/:id/ack', authMiddleware, rbac('admin', 'operator'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await queries.acknowledgeAlertEvent(id, req.user!.id);
    res.json({ message: 'Alert acknowledged' });
  } catch (err) {
    console.error('Acknowledge alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
