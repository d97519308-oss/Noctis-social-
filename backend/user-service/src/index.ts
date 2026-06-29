import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
app.use(express.json());

const port = process.env.USER_PORT || 3002;

interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  bio: string;
  avatar: string;
  followerCount: number;
  followingCount: number;
  createdAt: Date;
}

const users: Map<string, UserProfile> = new Map();

// Get User Profile
app.get('/users/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = users.get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Create User Profile
app.post('/users', (req: Request, res: Response) => {
  try {
    const { id, email, username, firstName, lastName, bio, avatar } = req.body;

    const user: UserProfile = {
      id,
      email,
      username,
      firstName,
      lastName,
      bio: bio || '',
      avatar: avatar || '',
      followerCount: 0,
      followingCount: 0,
      createdAt: new Date()
    };

    users.set(id, user);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update User Profile
app.put('/users/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = users.get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updated = { ...user, ...req.body };
    users.set(userId, updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Follow User
app.post('/users/:userId/follow/:targetId', (req: Request, res: Response) => {
  try {
    const { userId, targetId } = req.params;
    const user = users.get(userId);
    const target = users.get(targetId);

    if (!user || !target) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.followingCount++;
    target.followerCount++;

    users.set(userId, user);
    users.set(targetId, target);

    res.json({ message: 'Follow successful' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

app.listen(port, () => {
  console.log(`���� User Service running on port ${port}`);
});

export default app;
