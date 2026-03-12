import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { pool } from '../config/db';
import * as queries from '../db/queries';

const router = Router();

const WebhookPayloadSchema = z.object({
  event: z.enum(['deployment.started', 'deployment.finished', 'maintenance.start', 'maintenance.end', 'custom']),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  severity: z.enum(['info', 'warning']).optional(),
  suppressAlertsMinutes: z.number().int().min(0).max(1440).optional(),
  metadata: z.record(z.string()).optional(),
});

// ---------- Admin: manage webhooks ----------

// GET /api/webhooks — list all webhooks (admin)
router.get('/', authMiddleware, rbac('admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, enabled, created_at FROM webhooks ORDER BY name',
    );
    res.json(rows);
  } catch (err) {
    console.error('List webhooks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webhooks — create a new webhook (admin), returns secret
router.post('/', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const secret = crypto.randomBytes(32).toString('hex');
    const { rows } = await pool.query(
      'INSERT INTO webhooks (name, secret, created_by) VALUES ($1, $2, $3) RETURNING id, name, enabled, created_at',
      [name, secret, req.user!.id],
    );
    await queries.insertAuditLog(req.user!.id, 'webhook_created', `Webhook ${rows[0].id}: ${name}`, req.ip || null);
    res.status(201).json({ ...rows[0], secret });
  } catch (err) {
    console.error('Create webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM webhooks WHERE id = $1', [id]);
    await queries.insertAuditLog(req.user!.id, 'webhook_deleted', `Webhook ${id}`, req.ip || null);
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    console.error('Delete webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Ingest endpoint (public, Bearer token auth) ----------

// POST /api/webhooks/ingest/:webhookId
router.post('/ingest/:webhookId', async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookId = parseInt(req.params.webhookId, 10);
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing webhook secret' });
      return;
    }
    const providedSecret = authHeader.slice(7);

    // Look up webhook
    const { rows: webhooks } = await pool.query(
      'SELECT * FROM webhooks WHERE id = $1 AND enabled = TRUE',
      [webhookId],
    );
    if (webhooks.length === 0) {
      res.status(404).json({ error: 'Webhook not found or disabled' });
      return;
    }

    // Constant-time comparison
    const expected = Buffer.from(webhooks[0].secret);
    const provided = Buffer.from(providedSecret);
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      res.status(403).json({ error: 'Invalid webhook secret' });
      return;
    }

    // Validate payload
    const parsed = WebhookPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }

    const { event, title, description, severity, suppressAlertsMinutes, metadata } = parsed.data;

    // Store event
    await pool.query(
      `INSERT INTO webhook_events (webhook_id, event_type, title, description, severity, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [webhookId, event, title, description ?? null, severity ?? 'info', metadata ? JSON.stringify(metadata) : null],
    );

    // If suppress alerts requested, create a temporary maintenance window
    if (suppressAlertsMinutes && suppressAlertsMinutes > 0) {
      const now = new Date();
      const endsAt = new Date(now.getTime() + suppressAlertsMinutes * 60000);
      await pool.query(
        `INSERT INTO maintenance_windows (name, starts_at, ends_at, created_by)
         VALUES ($1, $2, $3, (SELECT id FROM users WHERE role = 'admin' LIMIT 1))`,
        [`Webhook: ${title}`, now, endsAt],
      );
    }

    res.status(201).json({ message: 'Event received' });
  } catch (err) {
    console.error('Webhook ingest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhooks/events — list recent webhook events (auth required)
router.get('/events', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
    const { rows } = await pool.query(
      'SELECT we.*, w.name as webhook_name FROM webhook_events we JOIN webhooks w ON we.webhook_id = w.id ORDER BY we.created_at DESC LIMIT $1',
      [limit],
    );
    res.json(rows);
  } catch (err) {
    console.error('List webhook events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
