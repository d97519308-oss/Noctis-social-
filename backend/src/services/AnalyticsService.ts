import { query } from '../database/connection';

export class AnalyticsService {
  static async trackEvent(userId: string, action: string, resourceType: string, resourceId: string): Promise<void> {
    try {
      await query(
        `INSERT INTO activity_logs (id, user_id, action, resource_type, resource_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
        [userId, action, resourceType, resourceId]
      );
    } catch (error) {
      console.error('Track event error:', error);
    }
  }

  static async getUserStats(userId: string): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          u.id,
          u.username,
          u.post_count,
          u.follower_count,
          u.following_count,
          COUNT(DISTINCT CASE WHEN p.user_id = u.id THEN p.id END) as total_posts,
          COUNT(DISTINCT CASE WHEN l.user_id = u.id THEN l.id END) as total_likes_given,
          COUNT(DISTINCT CASE WHEN c.user_id = u.id THEN c.id END) as total_comments,
          SUM(CASE WHEN p.user_id = u.id THEN p.like_count ELSE 0 END) as total_likes_received
        FROM users u
        LEFT JOIN posts p ON u.id = p.user_id
        LEFT JOIN likes l ON u.id = l.user_id
        LEFT JOIN comments c ON u.id = c.user_id
        WHERE u.id = $1
        GROUP BY u.id`,
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Get user stats error:', error);
      return null;
    }
  }

  static async getPlatformStats(): Promise<any> {
    try {
      const result = await query(
        `SELECT 
          COUNT(DISTINCT u.id) as total_users,
          COUNT(DISTINCT p.id) as total_posts,
          COUNT(DISTINCT c.id) as total_comments,
          COUNT(DISTINCT l.id) as total_likes,
          COUNT(DISTINCT CASE WHEN u.created_at > NOW() - INTERVAL '1 day' THEN u.id END) as new_users_today,
          COUNT(DISTINCT CASE WHEN u.last_login > NOW() - INTERVAL '1 day' THEN u.id END) as active_users_today
        FROM users u
        LEFT JOIN posts p ON TRUE
        LEFT JOIN comments c ON TRUE
        LEFT JOIN likes l ON TRUE`
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Get platform stats error:', error);
      return null;
    }
  }

  static async getTopPosts(limit: number = 10): Promise<any[]> {
    try {
      const result = await query(
        `SELECT 
          p.id,
          p.user_id,
          u.username,
          p.content,
          p.like_count,
          p.comment_count,
          p.repost_count,
          p.created_at,
          (p.like_count * 2 + p.comment_count * 3 + p.repost_count * 5) as engagement
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.deleted_at IS NULL
        ORDER BY engagement DESC
        LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Get top posts error:', error);
      return [];
    }
  }

  static async getTopUsers(limit: number = 10): Promise<any[]> {
    try {
      const result = await query(
        `SELECT 
          u.id,
          u.username,
          u.follower_count,
          u.following_count,
          u.post_count,
          COUNT(DISTINCT p.id) as posts_count,
          SUM(p.like_count) as total_likes_received
        FROM users u
        LEFT JOIN posts p ON u.id = p.user_id
        WHERE u.is_active = true
        GROUP BY u.id
        ORDER BY u.follower_count DESC
        LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      console.error('Get top users error:', error);
      return [];
    }
  }
}
