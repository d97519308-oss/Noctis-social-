import { Router, Request, Response } from 'express';
import { PostModel } from '../models/Post';
import { authMiddleware } from '../middleware/auth';
import { randomUUID } from 'crypto';
import { query } from '../database/connection';

const router = Router();

// Create post
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content, imageUrls, videoUrls, visibility } = req.body;
    const userId = (req as any).user.userId;

    if (!content) {
      return res.status(400).json({ error: 'Content required' });
    }

    const post = await PostModel.create({
      userId,
      content,
      imageUrls,
      videoUrls,
      visibility,
    });

    res.status(201).json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get post by ID
router.get('/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = await PostModel.findById(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user posts
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const posts = await PostModel.getByUser(
      userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get feed
router.get('/feed/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit = '20', offset = '0' } = req.query;

    const posts = await PostModel.getFeed(
      userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get trending posts
router.get('/trending/posts', async (req: Request, res: Response) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const posts = await PostModel.getTrending(
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Like post
router.post('/:postId/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const likeId = randomUUID();
    await query(
      `INSERT INTO likes (id, user_id, post_id) VALUES ($1, $2, $3)`,
      [likeId, userId, postId]
    );

    await PostModel.incrementLikes(postId);

    res.json({ message: 'Post liked' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unlike post
router.delete('/:postId/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    await query(
      `DELETE FROM likes WHERE user_id = $1 AND post_id = $2`,
      [userId, postId]
    );

    await PostModel.decrementLikes(postId);

    res.json({ message: 'Like removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update post
router.put('/:postId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { content, visibility } = req.body;
    const userId = (req as any).user.userId;

    const post = await PostModel.findById(postId);
    if (!post || post.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await PostModel.update(postId, { content, visibility });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete post
router.delete('/:postId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user.userId;

    const post = await PostModel.findById(postId);
    if (!post || post.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await PostModel.delete(postId);
    res.json({ message: 'Post deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
