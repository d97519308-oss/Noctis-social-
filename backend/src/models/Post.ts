import { query } from '../database/connection';
import { randomUUID } from 'crypto';

export interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrls?: string[];
  videoUrls?: string[];
  likeCount: number;
  commentCount: number;
  repostCount: number;
  visibility: 'public' | 'private' | 'followers';
  isEdited: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class PostModel {
  static async create(data: {
    userId: string;
    content: string;
    imageUrls?: string[];
    videoUrls?: string[];
    visibility?: 'public' | 'private' | 'followers';
  }): Promise<Post> {
    const id = randomUUID();
    const visibility = data.visibility || 'public';

    const result = await query(
      `INSERT INTO posts (id, user_id, content, image_urls, video_urls, visibility)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, content, image_urls, video_urls, like_count, comment_count, repost_count,
                 visibility, is_edited, edited_at, deleted_at, created_at, updated_at`,
      [id, data.userId, data.content, data.imageUrls || [], data.videoUrls || [], visibility]
    );

    return this.mapRow(result.rows[0]);
  }

  static async findById(id: string): Promise<Post | null> {
    const result = await query(
      `SELECT id, user_id, content, image_urls, video_urls, like_count, comment_count, repost_count,
              visibility, is_edited, edited_at, deleted_at, created_at, updated_at
       FROM posts WHERE id = $1`,
      [id]
    );

    return result.rows.length ? this.mapRow(result.rows[0]) : null;
  }

  static async getByUser(userId: string, limit: number = 20, offset: number = 0): Promise<Post[]> {
    const result = await query(
      `SELECT id, user_id, content, image_urls, video_urls, like_count, comment_count, repost_count,
              visibility, is_edited, edited_at, deleted_at, created_at, updated_at
       FROM posts
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => this.mapRow(row));
  }

  static async getFeed(userId: string, limit: number = 20, offset: number = 0): Promise<Post[]> {
    const result = await query(
      `SELECT p.id, p.user_id, p.content, p.image_urls, p.video_urls, p.like_count, p.comment_count,
              p.repost_count, p.visibility, p.is_edited, p.edited_at, p.deleted_at, p.created_at, p.updated_at
       FROM posts p
       INNER JOIN follows f ON p.user_id = f.following_id
       WHERE f.follower_id = $1 AND p.deleted_at IS NULL AND p.visibility IN ('public', 'followers')
       UNION
       SELECT id, user_id, content, image_urls, video_urls, like_count, comment_count, repost_count,
              visibility, is_edited, edited_at, deleted_at, created_at, updated_at
       FROM posts
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => this.mapRow(row));
  }

  static async getTrending(limit: number = 20, offset: number = 0): Promise<Post[]> {
    const result = await query(
      `SELECT id, user_id, content, image_urls, video_urls, like_count, comment_count, repost_count,
              visibility, is_edited, edited_at, deleted_at, created_at, updated_at
       FROM posts
       WHERE deleted_at IS NULL AND visibility = 'public' AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY (like_count + comment_count + repost_count) DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows.map(row => this.mapRow(row));
  }

  static async update(id: string, data: Partial<Post>): Promise<Post> {
    const updates: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        const columnName = this.camelToSnake(key);
        updates.push(`${columnName} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    updates.push(`is_edited = true`);
    updates.push(`edited_at = NOW()`);

    const result = await query(
      `UPDATE posts SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING id, user_id, content, image_urls, video_urls, like_count, comment_count, repost_count,
                 visibility, is_edited, edited_at, deleted_at, created_at, updated_at`,
      values
    );

    return this.mapRow(result.rows[0]);
  }

  static async delete(id: string): Promise<void> {
    await query(
      'UPDATE posts SET deleted_at = NOW() WHERE id = $1',
      [id]
    );
  }

  static async incrementLikes(postId: string): Promise<void> {
    await query(
      'UPDATE posts SET like_count = like_count + 1 WHERE id = $1',
      [postId]
    );
  }

  static async decrementLikes(postId: string): Promise<void> {
    await query(
      'UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id = $1',
      [postId]
    );
  }

  static async incrementComments(postId: string): Promise<void> {
    await query(
      'UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1',
      [postId]
    );
  }

  static async decrementComments(postId: string): Promise<void> {
    await query(
      'UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1',
      [postId]
    );
  }

  private static mapRow(row: any): Post {
    return {
      id: row.id,
      userId: row.user_id,
      content: row.content,
      imageUrls: row.image_urls,
      videoUrls: row.video_urls,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      repostCount: row.repost_count,
      visibility: row.visibility,
      isEdited: row.is_edited,
      editedAt: row.edited_at,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
