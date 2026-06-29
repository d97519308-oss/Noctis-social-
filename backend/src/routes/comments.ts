import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  imageUrls?: string[];
  likeCount: number;
  isEdited: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Create comment
router.post('/posts/:postId/comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { content, imageUrls } = req.body;
    const userId = (req as any).user.userId;

    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    const id = randomUUID();
    const result = await query(
      `INSERT INTO comments (id, post_id, user_id, content, image_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, post_id, user_id, content, image_urls, like_count, is_edited, edited_at, deleted_at, created_at, updated_at`,
      [id, postId, userId, content, imageUrls || []]
    );

    // Increment comment count
    await query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1', [postId]);

    // Create notification
    const post = await query('SELECT user_id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length > 0 && post.rows[0].user_id !== userId) {
      await query(
        `INSERT INTO notifications (id, user_id, actor_id, type, post_id, content)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), post.rows[0].user_id, userId, 'comment', postId, 'commented on your post']
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get post comments
router.get('/posts/:postId/comments', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const result = await query(
      `SELECT id, post_id, user_id, content, image_urls, like_count, is_edited, edited_at, deleted_at, created_at, updated_at
       FROM comments
       WHERE post_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [postId, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update comment
router.put('/comments/:commentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = (req as any).user.userId;

    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    // Check ownership
    const comment = await query('SELECT user_id FROM comments WHERE id = $1', [commentId]);
    if (comment.rows.length === 0 || comment.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `UPDATE comments SET content = $1, is_edited = true, edited_at = NOW()
       WHERE id = $2
       RETURNING id, post_id, user_id, content, image_urls, like_count, is_edited, edited_at, deleted_at, created_at, updated_at`,
      [content, commentId]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete comment
router.delete('/comments/:commentId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    // Check ownership
    const comment = await query('SELECT user_id, post_id FROM comments WHERE id = $1', [commentId]);
    if (comment.rows.length === 0 || comment.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await query('UPDATE comments SET deleted_at = NOW() WHERE id = $1', [commentId]);

    // Decrement comment count
    await query('UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1', [
      comment.rows[0].post_id,
    ]);

    res.json({ message: 'Comment deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Like comment
router.post('/comments/:commentId/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    const likeId = randomUUID();
    await query(
      `INSERT INTO likes (id, user_id, comment_id) VALUES ($1, $2, $3)`,
      [likeId, userId, commentId]
    );

    await query('UPDATE comments SET like_count = like_count + 1 WHERE id = $1', [commentId]);

    res.json({ message: 'Comment liked' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unlike comment
router.delete('/comments/:commentId/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = (req as any).user.userId;

    await query(`DELETE FROM likes WHERE user_id = $1 AND comment_id = $2`, [userId, commentId]);

    await query('UPDATE comments SET like_count = GREATEST(0, like_count - 1) WHERE id = $1', [commentId]);

    res.json({ message: 'Like removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
