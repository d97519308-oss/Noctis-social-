import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

// Get notifications
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit = '20', offset = '0', unreadOnly = 'false' } = req.query;

    let sqlUnread = '';
    if (unreadOnly === 'true') {
      sqlUnread = 'AND is_read = false';
    }

    const result = await query(
      `SELECT id, user_id, actor_id, type, post_id, comment_id, content, is_read, created_at
       FROM notifications
       WHERE user_id = $1 ${sqlUnread}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), parseInt(offset as string)]
    );

    const unreadCount = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      notifications: result.rows,
      unreadCount: unreadCount.rows[0].count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.post('/:notificationId/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as any).user.userId;

    const result = await query(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, actor_id, type, post_id, comment_id, content, is_read, created_at`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.post('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    await query(
      `UPDATE notifications SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete notification
router.delete('/:notificationId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as any).user.userId;

    await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );

    res.json({ message: 'Notification deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
