import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { pool } from '../config/db';
import * as queries from '../db/queries';

const router = Router();

// GET /api/servers — list all servers
router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, last_seen_at, status, metadata, created_at FROM servers ORDER BY name',
    );
    res.json(rows);
  } catch (err) {
    console.error('List servers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers — register a new server (admin only), returns plain-text token
router.post('/', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(plainToken, 10);
    const { rows } = await pool.query(
      'INSERT INTO servers (name, agent_token) VALUES ($1, $2) RETURNING id, name, status, created_at',
      [name, tokenHash],
    );
    await queries.insertAuditLog(req.user!.id, 'server_registered', `Server ${rows[0].id}: ${name}`, req.ip || null);
    res.status(201).json({ ...rows[0], agentToken: plainToken });
  } catch (err) {
    console.error('Register server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/servers/:id
router.delete('/:id', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM servers WHERE id = $1', [id]);
    await queries.insertAuditLog(req.user!.id, 'server_deleted', `Server ${id}`, req.ip || null);
    res.json({ message: 'Server deleted' });
  } catch (err) {
    console.error('Delete server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/servers/:id — update server name/metadata
router.put('/:id', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name } = req.body;
    const { rows } = await pool.query(
      'UPDATE servers SET name = COALESCE($1, name) WHERE id = $2 RETURNING id, name, status, last_seen_at, metadata, created_at',
      [name, id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Update server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
