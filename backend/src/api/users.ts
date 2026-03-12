import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import * as queries from '../db/queries';

const PasswordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character');

const router = Router();

router.get('/', authMiddleware, rbac('admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await queries.listUsers();
    res.json(rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
      res.status(400).json({ error: 'username, email, password, and role are required' });
      return;
    }
    const pwResult = PasswordSchema.safeParse(password);
    if (!pwResult.success) {
      res.status(400).json({ error: pwResult.error.issues[0].message });
      return;
    }
    if (!['admin', 'operator', 'viewer'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await queries.createUser(username, email, passwordHash, role);
    await queries.insertAuditLog(req.user!.id, 'user_created', `User ${rows[0].id}`, req.ip || null);
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Username or email already exists' });
      return;
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const fields: Record<string, unknown> = {};
    if (req.body.role) fields.role = req.body.role;
    if (req.body.email) fields.email = req.body.email;
    if (req.body.password) {
      const pwResult = PasswordSchema.safeParse(req.body.password);
      if (!pwResult.success) {
        res.status(400).json({ error: pwResult.error.issues[0].message });
        return;
      }
      fields.password_hash = await bcrypt.hash(req.body.password, 12);
    }

    const { rows } = await queries.updateUser(id, fields);
    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    await queries.insertAuditLog(req.user!.id, 'user_updated', `User ${id}`, req.ip || null);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authMiddleware, rbac('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user!.id) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }
    await queries.deleteUser(id);
    await queries.insertAuditLog(req.user!.id, 'user_deleted', `User ${id}`, req.ip || null);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/audit', authMiddleware, rbac('admin'), async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await queries.queryAuditLog();
    res.json(rows);
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
