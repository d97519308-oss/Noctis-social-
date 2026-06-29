import { UserModel } from '../models/User';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { query } from '../database/connection';

export class AuthService {
  static generateToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );
  }

  static generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || 'refresh_secret',
      { expiresIn: '7d' }
    );
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static async register(data: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(data.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const existingUsername = await UserModel.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('Username already taken');
    }

    // Create user
    const user = await UserModel.create(data);

    // Generate tokens
    const accessToken = this.generateToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return { user: this.sanitizeUser(user), accessToken, refreshToken };
  }

  static async login(email: string, password: string): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    const user = await UserModel.findByEmailWithPassword(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await UserModel.verifyPassword(email, password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await UserModel.update(user.id, { lastLogin: new Date() });

    // Generate tokens
    const accessToken = this.generateToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    return { user: this.sanitizeUser(user), accessToken, refreshToken };
  }

  static async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret') as any;
      const isValid = await this.verifyRefreshToken(decoded.userId, refreshToken);

      if (!isValid) {
        throw new Error('Invalid refresh token');
      }

      const accessToken = this.generateToken(decoded.userId);
      const newRefreshToken = this.generateRefreshToken(decoded.userId);

      await this.storeRefreshToken(decoded.userId, newRefreshToken);

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  private static async storeRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(
      `INSERT INTO session_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), userId, tokenHash, expiresAt]
    );
  }

  private static async verifyRefreshToken(userId: string, token: string): Promise<boolean> {
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');

    const result = await query(
      `SELECT id FROM session_tokens
       WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW() AND revoked = FALSE`,
      [userId, tokenHash]
    );

    return result.rows.length > 0;
  }

  private static sanitizeUser(user: any): any {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
