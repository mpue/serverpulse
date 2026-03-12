import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { pool } from '../config/db';

const router = Router();

// GET /api/reports/metrics/csv?monitorId=X&from=...&to=...
router.get('/metrics/csv', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const monitorId = parseInt(req.query.monitorId as string, 10);
    const from = req.query.from as string || new Date(Date.now() - 7 * 86400000).toISOString();
    const to = req.query.to as string || new Date().toISOString();

    if (isNaN(monitorId)) {
      res.status(400).json({ error: 'monitorId is required' });
      return;
    }

    const { rows } = await pool.query(
      'SELECT collected_at, value, labels FROM metrics WHERE monitor_id = $1 AND collected_at >= $2 AND collected_at <= $3 ORDER BY collected_at ASC',
      [monitorId, from, to],
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="metrics_${monitorId}_${Date.now()}.csv"`);
    res.write('timestamp,value,labels\n');
    for (const row of rows) {
      res.write(`${row.collected_at},${row.value},"${JSON.stringify(row.labels ?? {}).replace(/"/g, '""')}"\n`);
    }
    res.end();
  } catch (err) {
    console.error('Metrics CSV export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/alerts/csv?from=...&to=...
router.get('/alerts/csv', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const from = req.query.from as string || new Date(Date.now() - 7 * 86400000).toISOString();
    const to = req.query.to as string || new Date().toISOString();

    const { rows } = await pool.query(
      `SELECT ae.fired_at, ae.resolved_at, ae.metric_value, ae.acknowledged,
              ar.name as rule_name, ar.severity
       FROM alert_events ae JOIN alert_rules ar ON ae.rule_id = ar.id
       WHERE ae.fired_at >= $1 AND ae.fired_at <= $2
       ORDER BY ae.fired_at DESC`,
      [from, to],
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="alerts_${Date.now()}.csv"`);
    res.write('fired_at,resolved_at,rule_name,severity,metric_value,acknowledged\n');
    for (const row of rows) {
      res.write(`${row.fired_at},${row.resolved_at ?? ''},${row.rule_name},${row.severity},${row.metric_value},${row.acknowledged}\n`);
    }
    res.end();
  } catch (err) {
    console.error('Alerts CSV export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/summary — JSON summary for dashboard/PDF
router.get('/summary', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [alerts, monitors] = await Promise.all([
      pool.query(
        `SELECT ar.severity, COUNT(*) as count FROM alert_events ae
         JOIN alert_rules ar ON ae.rule_id = ar.id WHERE ae.fired_at >= $1 GROUP BY ar.severity`,
        [since],
      ),
      pool.query('SELECT COUNT(*) as count FROM monitors WHERE enabled = TRUE'),
    ]);

    res.json({
      period: { from: since, to: new Date().toISOString(), days },
      alertsBySeverity: alerts.rows,
      activeMonitors: parseInt(monitors.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Report summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Scheduled Reports CRUD ----------
router.get('/schedules', authMiddleware, rbac('operator', 'admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query('SELECT * FROM report_schedules ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('List report schedules error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/schedules', authMiddleware, rbac('operator', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, config, cronExpr, recipients, enabled } = req.body;
    if (!name || !type || !config || !cronExpr || !recipients?.length) {
      res.status(400).json({ error: 'name, type, config, cronExpr, and recipients are required' });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO report_schedules (name, type, config, cron_expr, recipients, enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, type, JSON.stringify(config), cronExpr, recipients, enabled ?? true, req.user!.id],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create report schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/schedules/:id', authMiddleware, rbac('operator', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM report_schedules WHERE id = $1', [id]);
    res.json({ message: 'Schedule deleted' });
  } catch (err) {
    console.error('Delete report schedule error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
