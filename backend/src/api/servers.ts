import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { pool } from '../config/db';
import { encryptSecret } from '../config/crypto';
import * as queries from '../db/queries';

const router = Router();

// GET /api/servers — list all servers
router.get('/', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, last_seen_at, status, allowed_ip, token_rotated_at, metadata, created_at FROM servers ORDER BY name',
    );
    res.json(rows);
  } catch (err) {
    console.error('List servers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers — register a new server (admin only), returns plain-text secret ONCE
router.post('/', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, allowedIp } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const plainSecret = crypto.randomBytes(32).toString('hex');
    const { encrypted, iv, authTag } = encryptSecret(plainSecret);

    const { rows } = await pool.query(
      `INSERT INTO servers (name, agent_token_enc, token_iv, token_auth_tag, allowed_ip, agent_token)
       VALUES ($1, $2, $3, $4, $5, 'encrypted')
       RETURNING id, name, status, allowed_ip, created_at`,
      [name, encrypted, iv, authTag, allowedIp || null],
    );

    await queries.insertAuditLog(req.user!.id, 'server_registered', `Server ${rows[0].id}: ${name}`, req.ip || null);
    res.status(201).json({ ...rows[0], agentSecret: plainSecret });
  } catch (err) {
    console.error('Register server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/servers/:id/rotate — rotate agent secret (admin only), returns new secret ONCE
router.post('/:id/rotate', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const plainSecret = crypto.randomBytes(32).toString('hex');
    const { encrypted, iv, authTag } = encryptSecret(plainSecret);

    const { rows } = await pool.query(
      `UPDATE servers SET agent_token_enc = $1, token_iv = $2, token_auth_tag = $3, token_rotated_at = NOW()
       WHERE id = $4 RETURNING id, name`,
      [encrypted, iv, authTag, id],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    await queries.insertAuditLog(req.user!.id, 'server_token_rotated', `Server ${id}: ${rows[0].name}`, req.ip || null);
    res.json({ message: 'Secret rotated', agentSecret: plainSecret });
  } catch (err) {
    console.error('Rotate server token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/servers/:id — update server name, allowed IP
router.put('/:id', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, allowedIp } = req.body;
    const { rows } = await pool.query(
      `UPDATE servers SET name = COALESCE($1, name), allowed_ip = $2
       WHERE id = $3 RETURNING id, name, status, last_seen_at, allowed_ip, token_rotated_at, metadata, created_at`,
      [name, allowedIp !== undefined ? (allowedIp || null) : null, id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }
    await queries.insertAuditLog(req.user!.id, 'server_updated', `Server ${id}`, req.ip || null);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update server error:', err);
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

export default router;
