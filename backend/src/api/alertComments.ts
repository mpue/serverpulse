import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../config/db';

const router = Router();

// GET /api/alert-comments/:eventId
router.get('/:eventId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const { rows } = await pool.query(
      `SELECT ac.*, u.username FROM alert_comments ac
       LEFT JOIN users u ON ac.user_id = u.id
       WHERE ac.alert_event_id = $1 ORDER BY ac.created_at ASC`,
      [eventId],
    );
    res.json(rows);
  } catch (err) {
    console.error('List alert comments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/alert-comments/:eventId
router.post('/:eventId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const { content } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'content is required' });
      return;
    }
    const { rows } = await pool.query(
      'INSERT INTO alert_comments (alert_event_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [eventId, req.user!.id, content.trim()],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create alert comment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/alert-comments/comment/:id — delete own comment
router.delete('/comment/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    await pool.query(
      'DELETE FROM alert_comments WHERE id = $1 AND user_id = $2',
      [id, req.user!.id],
    );
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('Delete alert comment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
