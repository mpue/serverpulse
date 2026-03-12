import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../config/db';

const router = Router();

// GET /api/layouts — list user's layouts
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM dashboard_layouts WHERE user_id = $1 ORDER BY is_default DESC, name ASC',
      [req.user!.id],
    );
    res.json(rows);
  } catch (err) {
    console.error('List layouts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/layouts — create layout
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, layout, isDefault } = req.body;
    if (!name || !layout) {
      res.status(400).json({ error: 'name and layout are required' });
      return;
    }
    // If setting as default, unset other defaults
    if (isDefault) {
      await pool.query(
        'UPDATE dashboard_layouts SET is_default = FALSE WHERE user_id = $1',
        [req.user!.id],
      );
    }
    const { rows } = await pool.query(
      'INSERT INTO dashboard_layouts (user_id, name, layout, is_default) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user!.id, name, JSON.stringify(layout), isDefault ?? false],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create layout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/layouts/:id — update layout
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, layout, isDefault } = req.body;
    if (isDefault) {
      await pool.query(
        'UPDATE dashboard_layouts SET is_default = FALSE WHERE user_id = $1',
        [req.user!.id],
      );
    }
    const { rows } = await pool.query(
      `UPDATE dashboard_layouts SET name = COALESCE($1, name), layout = COALESCE($2, layout),
       is_default = COALESCE($3, is_default), updated_at = NOW()
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name, layout ? JSON.stringify(layout) : null, isDefault, id, req.user!.id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Layout not found' });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Update layout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/layouts/:id
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query('DELETE FROM dashboard_layouts WHERE id = $1 AND user_id = $2', [id, req.user!.id]);
    res.json({ message: 'Layout deleted' });
  } catch (err) {
    console.error('Delete layout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
