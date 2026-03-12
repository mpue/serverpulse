import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../config/db';
import * as queries from '../db/queries';

const router = Router();

const SetupSchema = z.object({
  username: z.string().min(4).max(50),
  email: z.string().email(),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  appName: z.string().min(1).max(100).default('ServerPulse'),
  timezone: z.string().default('UTC'),
});

// GET /api/setup/status — check if setup is needed
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM users WHERE role = 'admin'",
    );
    const setupRequired = parseInt(result.rows[0].count, 10) === 0;
    res.json({ setupRequired });
  } catch {
    res.json({ setupRequired: true });
  }
});

// POST /api/setup — create initial admin and app settings
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check no admin exists yet
    const adminCheck = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM users WHERE role = 'admin'",
    );
    if (parseInt(adminCheck.rows[0].count, 10) > 0) {
      res.status(403).json({ error: 'Setup already completed.' });
      return;
    }

    const parsed = SetupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
      return;
    }

    const { username, email, password, appName, timezone } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    await queries.createUser(username, email, passwordHash, 'admin');

    // Save app settings
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ('app_name', $1), ('timezone', $2), ('setup_completed', 'true')
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [appName, timezone],
    );

    res.status(201).json({ message: 'Setup complete' });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
