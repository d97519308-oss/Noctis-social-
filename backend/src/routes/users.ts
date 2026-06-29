import { Router, Request, Response } from 'express';
import { UserModel } from '../models/User';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

// Get user profile
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by username
router.get('/username/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user = await UserModel.findByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.put('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { firstName, lastName, bio, location, website, profileImageUrl, coverImageUrl } = req.body;

    const updated = await UserModel.update(userId, {
      firstName,
      lastName,
      bio,
      location,
      website,
      profileImageUrl,
      coverImageUrl,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user
router.get('/me/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Follow user
router.post('/:userId/follow', authMiddleware, async (req: Request, res: Response) => {
  try {
    const followerId = (req as any).user.userId;
    const { userId: followingId } = req.params;

    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if already following
    const isFollowing = await UserModel.isFollowing(followerId, followingId);
    if (isFollowing) {
      return res.status(400).json({ error: 'Already following' });
    }

    // Add follow relationship
    await query(
      `INSERT INTO follows (id, follower_id, following_id) VALUES ($1, $2, $3)`,
      [randomUUID(), followerId, followingId]
    );

    // Update counts
    await UserModel.incrementFollowingCount(followerId);
    await UserModel.incrementFollowerCount(followingId);

    // Create notification
    await query(
      `INSERT INTO notifications (id, user_id, actor_id, type, content)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), followingId, followerId, 'follow', 'started following you']
    );

    res.json({ message: 'Following' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unfollow user
router.delete('/:userId/follow', authMiddleware, async (req: Request, res: Response) => {
  try {
    const followerId = (req as any).user.userId;
    const { userId: followingId } = req.params;

    // Check if following
    const isFollowing = await UserModel.isFollowing(followerId, followingId);
    if (!isFollowing) {
      return res.status(400).json({ error: 'Not following' });
    }

    // Remove follow relationship
    await query(
      `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );

    // Update counts
    await UserModel.decrementFollowingCount(followerId);
    await UserModel.decrementFollowerCount(followingId);

    res.json({ message: 'Unfollowed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get followers
router.get('/:userId/followers', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const followers = await UserModel.getFollowers(
      userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json(followers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get following
router.get('/:userId/following', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const following = await UserModel.getFollowing(
      userId,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json(following);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Block user
router.post('/:userId/block', authMiddleware, async (req: Request, res: Response) => {
  try {
    const blockerId = (req as any).user.userId;
    const { userId: blockedId } = req.params;
    const { reason } = req.body;

    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check if already blocked
    const blocked = await query(
      `SELECT id FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );

    if (blocked.rows.length > 0) {
      return res.status(400).json({ error: 'Already blocked' });
    }

    // Block user
    await query(
      `INSERT INTO blocks (id, blocker_id, blocked_id, reason) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), blockerId, blockedId, reason]
    );

    res.json({ message: 'User blocked' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unblock user
router.delete('/:userId/block', authMiddleware, async (req: Request, res: Response) => {
  try {
    const blockerId = (req as any).user.userId;
    const { userId: blockedId } = req.params;

    await query(
      `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );

    res.json({ message: 'User unblocked' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search users
router.get('/search/query', async (req: Request, res: Response) => {
  try {
    const { q, limit = '20', offset = '0' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const result = await query(
      `SELECT id, username, email, first_name, last_name, profile_image_url, bio, follower_count
       FROM users
       WHERE (username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
       AND is_active = true
       ORDER BY follower_count DESC
       LIMIT $2 OFFSET $3`,
      [`%${q}%`, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
