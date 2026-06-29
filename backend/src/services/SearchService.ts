import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

esClient.info().then(() => {
  console.log('✅ Connected to Elasticsearch');
}).catch((err) => {
  console.error('❌ Elasticsearch error:', err);
});

export class SearchService {
  static async indexPost(postId: string, data: any): Promise<void> {
    try {
      await esClient.index({
        index: 'posts',
        id: postId,
        document: {
          ...data,
          indexed_at: new Date(),
        },
      });
    } catch (error) {
      console.error('Index post error:', error);
    }
  }

  static async indexUser(userId: string, data: any): Promise<void> {
    try {
      await esClient.index({
        index: 'users',
        id: userId,
        document: {
          ...data,
          indexed_at: new Date(),
        },
      });
    } catch (error) {
      console.error('Index user error:', error);
    }
  }

  static async searchPosts(query: string, from: number = 0, size: number = 20): Promise<any[]> {
    try {
      const result = await esClient.search({
        index: 'posts',
        from,
        size,
        query: {
          multi_match: {
            query,
            fields: ['content^2', 'hashtags', 'user_name'],
            fuzziness: 'AUTO',
          },
        },
      });

      return result.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error('Search posts error:', error);
      return [];
    }
  }

  static async searchUsers(query: string, from: number = 0, size: number = 20): Promise<any[]> {
    try {
      const result = await esClient.search({
        index: 'users',
        from,
        size,
        query: {
          multi_match: {
            query,
            fields: ['username^3', 'first_name', 'last_name', 'bio'],
            fuzziness: 'AUTO',
          },
        },
      });

      return result.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error('Search users error:', error);
      return [];
    }
  }

  static async deletePost(postId: string): Promise<void> {
    try {
      await esClient.delete({
        index: 'posts',
        id: postId,
      });
    } catch (error) {
      console.error('Delete post error:', error);
    }
  }

  static async deleteUser(userId: string): Promise<void> {
    try {
      await esClient.delete({
        index: 'users',
        id: userId,
      });
    } catch (error) {
      console.error('Delete user error:', error);
    }
  }
}

export default esClient;
