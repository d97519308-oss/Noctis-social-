import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { FeedService } from '../services/FeedService';
import { CacheService } from '../services/CacheService';

const router = Router();

// Get personalized feed
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit = '20', offset = '0' } = req.query;

    const feed = await FeedService.generateFeed(
      userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({ posts: feed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get trending feed
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const { limit = '20', offset = '0' } = req.query;

    const feed = await FeedService.getTrendingFeed(
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({ posts: feed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
