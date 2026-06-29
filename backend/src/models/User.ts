import { query } from '../database/connection';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  location?: string;
  website?: string;
  birthDate?: Date;
  isVerified: boolean;
  isActive: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  static async create(data: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(data.password, 12);

    const result = await query(
      `INSERT INTO users (id, username, email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, first_name, last_name, bio, profile_image_url, cover_image_url,
                 location, website, birth_date, is_verified, is_active, follower_count, following_count,
                 post_count, last_login, created_at, updated_at`,
      [id, data.username, data.email, passwordHash, data.firstName, data.lastName]
    );

    return this.mapRow(result.rows[0]);
  }

  static async findById(id: string): Promise<User | null> {
    const result = await query(
      `SELECT id, username, email, first_name, last_name, bio, profile_image_url, cover_image_url,
              location, website, birth_date, is_verified, is_active, follower_count, following_count,
              post_count, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    return result.rows.length ? this.mapRow(result.rows[0]) : null;
  }

  static async findByUsername(username: string): Promise<User | null> {
    const result = await query(
      `SELECT id, username, email, first_name, last_name, bio, profile_image_url, cover_image_url,
              location, website, birth_date, is_verified, is_active, follower_count, following_count,
              post_count, last_login, created_at, updated_at
       FROM users WHERE username = $1`,
      [username]
    );

    return result.rows.length ? this.mapRow(result.rows[0]) : null;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const result = await query(
      `SELECT id, username, email, first_name, last_name, bio, profile_image_url, cover_image_url,
              location, website, birth_date, is_verified, is_active, follower_count, following_count,
              post_count, last_login, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );

    return result.rows.length ? this.mapRow(result.rows[0]) : null;
  }

  static async findByEmailWithPassword(email: string): Promise<(User & { passwordHash: string }) | null> {
    const result = await query(
      `SELECT id, username, email, password_hash, first_name, last_name, bio, profile_image_url,
              cover_image_url, location, website, birth_date, is_verified, is_active, follower_count,
              following_count, post_count, last_login, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );

    return result.rows.length ? this.mapRowWithPassword(result.rows[0]) : null;
  }

  static async update(id: string, data: Partial<User>): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'passwordHash' && value !== undefined) {
        const columnName = this.camelToSnake(key);
        updates.push(`${columnName} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      return this.findById(id) as Promise<User>;
    }

    const result = await query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING id, username, email, first_name, last_name, bio, profile_image_url, cover_image_url,
                 location, website, birth_date, is_verified, is_active, follower_count, following_count,
                 post_count, last_login, created_at, updated_at`,
      values
    );

    return this.mapRow(result.rows[0]);
  }

  static async verifyPassword(email: string, password: string): Promise<boolean> {
    const user = await this.findByEmailWithPassword(email);
    if (!user) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  static async incrementFollowerCount(userId: string): Promise<void> {
    await query(
      'UPDATE users SET follower_count = follower_count + 1 WHERE id = $1',
      [userId]
    );
  }

  static async decrementFollowerCount(userId: string): Promise<void> {
    await query(
      'UPDATE users SET follower_count = GREATEST(0, follower_count - 1) WHERE id = $1',
      [userId]
    );
  }

  static async incrementFollowingCount(userId: string): Promise<void> {
    await query(
      'UPDATE users SET following_count = following_count + 1 WHERE id = $1',
      [userId]
    );
  }

  static async decrementFollowingCount(userId: string): Promise<void> {
    await query(
      'UPDATE users SET following_count = GREATEST(0, following_count - 1) WHERE id = $1',
      [userId]
    );
  }

  static async getFollowers(userId: string, limit: number = 20, offset: number = 0): Promise<User[]> {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.bio, u.profile_image_url,
              u.cover_image_url, u.location, u.website, u.birth_date, u.is_verified, u.is_active,
              u.follower_count, u.following_count, u.post_count, u.last_login, u.created_at, u.updated_at
       FROM users u
       INNER JOIN follows f ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => this.mapRow(row));
  }

  static async getFollowing(userId: string, limit: number = 20, offset: number = 0): Promise<User[]> {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.bio, u.profile_image_url,
              u.cover_image_url, u.location, u.website, u.birth_date, u.is_verified, u.is_active,
              u.follower_count, u.following_count, u.post_count, u.last_login, u.created_at, u.updated_at
       FROM users u
       INNER JOIN follows f ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => this.mapRow(row));
  }

  static async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const result = await query(
      'SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1',
      [followerId, followingId]
    );
    return result.rows.length > 0;
  }

  private static mapRow(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      bio: row.bio,
      profileImageUrl: row.profile_image_url,
      coverImageUrl: row.cover_image_url,
      location: row.location,
      website: row.website,
      birthDate: row.birth_date,
      isVerified: row.is_verified,
      isActive: row.is_active,
      followerCount: row.follower_count,
      followingCount: row.following_count,
      postCount: row.post_count,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapRowWithPassword(row: any): User & { passwordHash: string } {
    return {
      ...this.mapRow(row),
      passwordHash: row.password_hash,
    };
  }

  private static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
