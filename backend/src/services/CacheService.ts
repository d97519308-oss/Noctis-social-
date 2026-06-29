import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  static async set<T>(key: string, value: T, expiresIn: number = 3600): Promise<void> {
    try {
      await redis.setex(key, expiresIn, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidate pattern error:', error);
    }
  }

  static async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await redis.incrby(key, amount);
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  static async setHash(key: string, field: string, value: any): Promise<void> {
    try {
      await redis.hset(key, field, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set hash error:', error);
    }
  }

  static async getHash(key: string, field: string): Promise<any> {
    try {
      const data = await redis.hget(key, field);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get hash error:', error);
      return null;
    }
  }

  static async getAllHash(key: string): Promise<Record<string, any>> {
    try {
      const data = await redis.hgetall(key);
      const result: Record<string, any> = {};
      for (const [field, value] of Object.entries(data)) {
        result[field] = JSON.parse(value as string);
      }
      return result;
    } catch (error) {
      console.error('Cache get all hash error:', error);
      return {};
    }
  }

  static async lpush(key: string, ...values: any[]): Promise<number> {
    try {
      return await redis.lpush(key, ...values.map(v => JSON.stringify(v)));
    } catch (error) {
      console.error('Cache lpush error:', error);
      return 0;
    }
  }

  static async lrange(key: string, start: number = 0, end: number = -1): Promise<any[]> {
    try {
      const data = await redis.lrange(key, start, end);
      return data.map(item => JSON.parse(item));
    } catch (error) {
      console.error('Cache lrange error:', error);
      return [];
    }
  }
}

export default redis;
