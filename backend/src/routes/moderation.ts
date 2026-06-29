import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

interface ModerationAction {
  id: string;
  targetUserId: string;
  actionType: 'ban' | 'suspend' | 'warn' | 'content_removal';
  reason: string;
  duration?: number;
  createdBy: string;
  createdAt: Date;
}

// Flag content for review
router.post('/flag-content', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { postId, reason } = req.body;
    const userId = (req as any).user.userId;

    if (!postId || !reason) {
      return res.status(400).json({ error: 'Post ID and reason required' });
    }

    // Create a report
    const reportId = randomUUID();
    await query(
      `INSERT INTO reports (id, reporter_id, reported_post_id, report_type, description, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [reportId, userId, postId, 'content_violation', reason, 'pending']
    );

    res.json({ message: 'Content flagged for review', reportId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get moderation queue
router.get('/queue', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status = 'pending', limit = '20', offset = '0' } = req.query;

    const result = await query(
      `SELECT r.id, r.reporter_id, r.reported_user_id, r.reported_post_id, r.report_type, 
              r.description, r.status, r.created_at, u.username as reporter_name, p.content
       FROM reports r
       LEFT JOIN users u ON r.reporter_id = u.id
       LEFT JOIN posts p ON r.reported_post_id = p.id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove content
router.post('/remove-content/:postId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { reason } = req.body;

    await query(
      `UPDATE posts SET deleted_at = NOW() WHERE id = $1`,
      [postId]
    );

    // Log moderation action
    await query(
      `INSERT INTO activity_logs (id, user_id, action, resource_type, resource_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [randomUUID(), (req as any).user.userId, 'content_removed', 'post', postId]
    );

    res.json({ message: 'Content removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Suspend user
router.post('/suspend-user/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body;

    await query(
      `UPDATE users SET is_active = false WHERE id = $1`,
      [userId]
    );

    res.json({ message: 'User suspended' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ban user
router.post('/ban-user/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    // Delete all user content and relationships
    await query(`UPDATE posts SET deleted_at = NOW() WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM follows WHERE follower_id = $1 OR following_id = $1`, [userId]);
    await query(`DELETE FROM messages WHERE sender_id = $1 OR recipient_id = $1`, [userId]);
    await query(`UPDATE users SET is_active = false WHERE id = $1`, [userId]);

    res.json({ message: 'User banned' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user moderation history
router.get('/user/:userId/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `SELECT id, user_id, action, resource_type, resource_id, created_at
       FROM activity_logs
       WHERE user_id = $1 AND action LIKE '%removed%'
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
