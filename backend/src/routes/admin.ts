import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

interface AdminStats {
  totalUsers: number;
  totalPosts: number;
  totalReports: number;
  pendingReports: number;
  suspendedUsers: number;
  activeUsers: number;
}

// Get admin dashboard stats
router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL) as total_posts,
        (SELECT COUNT(*) FROM reports) as total_reports,
        (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
        (SELECT COUNT(*) FROM users WHERE is_active = false) as suspended_users,
        (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '24 hours') as active_users`
    );

    const stats: AdminStats = {
      totalUsers: result.rows[0].total_users,
      totalPosts: result.rows[0].total_posts,
      totalReports: result.rows[0].total_reports,
      pendingReports: result.rows[0].pending_reports,
      suspendedUsers: result.rows[0].suspended_users,
      activeUsers: result.rows[0].active_users,
    };

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users (admin)
router.get('/users', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0', isActive } = req.query;

    let whereClause = '';
    if (isActive !== undefined) {
      whereClause = `WHERE is_active = ${isActive === 'true' ? 'true' : 'false'}`;
    }

    const result = await query(
      `SELECT id, username, email, is_active, is_verified, follower_count, post_count, created_at, last_login
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify user
router.post('/users/:userId/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `UPDATE users SET is_verified = true WHERE id = $1 RETURNING *`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User verified', user: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get platform growth metrics
router.get('/metrics/growth', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users
      FROM users
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get engagement metrics
router.get('/metrics/engagement', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id END) as active_users,
        COUNT(*) as total_posts
      FROM posts
      WHERE created_at > NOW() - INTERVAL '30 days' AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
