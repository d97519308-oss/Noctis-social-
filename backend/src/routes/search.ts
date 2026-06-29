import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

// Search posts
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { q, limit = '20', offset = '0' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const result = await query(
      `SELECT id, user_id, content, image_urls, video_urls, like_count, comment_count, repost_count,
              visibility, is_edited, created_at
       FROM posts
       WHERE (content ILIKE $1) AND deleted_at IS NULL AND visibility = 'public'
       ORDER BY (like_count + comment_count) DESC
       LIMIT $2 OFFSET $3`,
      [`%${q}%`, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search hashtags
router.get('/hashtags', async (req: Request, res: Response) => {
  try {
    const { q, limit = '20', offset = '0' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const result = await query(
      `SELECT id, tag, post_count, created_at
       FROM hashtags
       WHERE tag ILIKE $1
       ORDER BY post_count DESC
       LIMIT $2 OFFSET $3`,
      [`%${q}%`, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get trending hashtags
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const { limit = '20' } = req.query;

    const result = await query(
      `SELECT id, tag, post_count, last_used_at
       FROM hashtags
       WHERE last_used_at > NOW() - INTERVAL '7 days'
       ORDER BY post_count DESC
       LIMIT $1`,
      [parseInt(limit as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
