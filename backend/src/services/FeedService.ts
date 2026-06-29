import { query } from '../database/connection';
import { CacheService } from './CacheService';

interface FeedItem {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  content: string;
  imageUrls?: string[];
  videoUrls?: string[];
  likeCount: number;
  commentCount: number;
  repostCount: number;
  timestamp: Date;
  score: number;
}

export class FeedService {
  static async generateFeed(userId: string, limit: number = 20, offset: number = 0): Promise<FeedItem[]> {
    const cacheKey = `feed:${userId}:${offset}:${limit}`;
    const cached = await CacheService.get<FeedItem[]>(cacheKey);

    if (cached) {
      return cached;
    }

    // Get following list
    const following = await query(
      `SELECT following_id FROM follows WHERE follower_id = $1`,
      [userId]
    );

    const followingIds = following.rows.map(r => r.following_id);

    // Build feed from posts of people user follows + own posts
    const result = await query(
      `SELECT 
        p.id,
        p.user_id,
        u.username,
        u.profile_image_url,
        p.content,
        p.image_urls,
        p.video_urls,
        p.like_count,
        p.comment_count,
        p.repost_count,
        p.created_at,
        CASE 
          WHEN p.user_id = $1 THEN 100
          WHEN p.like_count > 50 THEN 80
          WHEN p.like_count > 10 THEN 60
          WHEN p.comment_count > 5 THEN 50
          ELSE 40
        END as score
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE (p.user_id IN (${followingIds.map((_, i) => `$${i + 2}`).join(',')}) OR p.user_id = $1)
        AND p.deleted_at IS NULL
        AND p.visibility IN ('public', 'followers')
      ORDER BY score DESC, p.created_at DESC
      LIMIT $${followingIds.length + 2} OFFSET $${followingIds.length + 3}`,
      [userId, ...followingIds, limit, offset]
    );

    const feed: FeedItem[] = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.username,
      userImage: row.profile_image_url,
      content: row.content,
      imageUrls: row.image_urls,
      videoUrls: row.video_urls,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      repostCount: row.repost_count,
      timestamp: row.created_at,
      score: row.score,
    }));

    // Cache for 5 minutes
    await CacheService.set(cacheKey, feed, 300);

    return feed;
  }

  static async getTrendingFeed(limit: number = 20, offset: number = 0): Promise<FeedItem[]> {
    const cacheKey = `trending_feed:${offset}:${limit}`;
    const cached = await CacheService.get<FeedItem[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await query(
      `SELECT 
        p.id,
        p.user_id,
        u.username,
        u.profile_image_url,
        p.content,
        p.image_urls,
        p.video_urls,
        p.like_count,
        p.comment_count,
        p.repost_count,
        p.created_at,
        (p.like_count * 2 + p.comment_count * 3 + p.repost_count * 5) as engagement_score
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.deleted_at IS NULL 
        AND p.visibility = 'public'
        AND p.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY engagement_score DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const feed: FeedItem[] = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.username,
      userImage: row.profile_image_url,
      content: row.content,
      imageUrls: row.image_urls,
      videoUrls: row.video_urls,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      repostCount: row.repost_count,
      timestamp: row.created_at,
      score: row.engagement_score,
    }));

    // Cache for 10 minutes
    await CacheService.set(cacheKey, feed, 600);

    return feed;
  }

  static async invalidateFeed(userId: string): Promise<void> {
    await CacheService.invalidatePattern(`feed:${userId}:*`);
    await CacheService.invalidatePattern(`trending_feed:*`);
  }
}
