import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
app.use(express.json());

const port = process.env.FEED_PORT || 3003;

interface Post {
  id: string;
  userId: string;
  content: string;
  image?: string;
  video?: string;
  likes: number;
  comments: number;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
}

const posts: Map<string, Post> = new Map();
const userFeeds: Map<string, string[]> = new Map();

// Create Post
app.post('/posts', (req: Request, res: Response) => {
  try {
    const { userId, content, image, video } = req.body;

    if (!userId || !content) {
      return res.status(400).json({ error: 'UserId and content required' });
    }

    const id = `post_${Date.now()}`;
    const post: Post = {
      id,
      userId,
      content,
      image,
      video,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    posts.set(id, post);

    // Add to user feed
    if (!userFeeds.has(userId)) {
      userFeeds.set(userId, []);
    }
    userFeeds.get(userId)!.unshift(id);

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get Feed
app.get('/feed/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const feed = userFeeds.get(userId) || [];
    const paginatedPostIds = feed.slice(Number(offset), Number(offset) + Number(limit));
    const feedPosts = paginatedPostIds.map(id => posts.get(id)).filter(Boolean);

    res.json({ posts: feedPosts, total: feed.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

// Get Post
app.get('/posts/:postId', (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = posts.get(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get post' });
  }
});

// Like Post
app.post('/posts/:postId/like', (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = posts.get(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.likes++;
    posts.set(postId, post);
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// Delete Post
app.delete('/posts/:postId', (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = posts.get(postId);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    posts.delete(postId);
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

app.listen(port, () => {
  console.log(`📰 Feed Service running on port ${port}`);
});

export default app;
