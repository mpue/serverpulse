import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../config/db';

const router = Router();

// GET /api/settings — list all settings (authenticated)
router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings ORDER BY key');
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    console.error('List settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/theme — update own theme preference
router.put('/theme', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { theme } = req.body;
    if (!['light', 'dark', 'system'].includes(theme)) {
      res.status(400).json({ error: 'theme must be light, dark, or system' });
      return;
    }
    await pool.query('UPDATE users SET theme = $1 WHERE id = $2', [theme, req.user!.id]);
    res.json({ theme });
  } catch (err) {
    console.error('Update theme error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
