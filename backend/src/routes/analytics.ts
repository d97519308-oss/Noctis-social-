import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AnalyticsService } from '../services/AnalyticsService';

const router = Router();

// Get user stats
router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const stats = await AnalyticsService.getUserStats(userId);

    if (!stats) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get platform stats (admin only)
router.get('/platform/stats', async (req: Request, res: Response) => {
  try {
    const stats = await AnalyticsService.getPlatformStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get top posts
router.get('/posts/top', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;

    const posts = await AnalyticsService.getTopPosts(parseInt(limit as string));
    res.json(posts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get top users
router.get('/users/top', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;

    const users = await AnalyticsService.getTopUsers(parseInt(limit as string));
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Track event
router.post('/events', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { action, resourceType, resourceId } = req.body;

    if (!action || !resourceType) {
      return res.status(400).json({ error: 'Action and resourceType required' });
    }

    await AnalyticsService.trackEvent(userId, action, resourceType, resourceId);
    res.json({ message: 'Event tracked' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
