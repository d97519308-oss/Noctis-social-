import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
app.use(express.json());

const port = process.env.NOTIFICATION_PORT || 3005;

interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'message';
  actor: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

const notifications: Map<string, Notification[]> = new Map();

// Create Notification
app.post('/notifications', (req: Request, res: Response) => {
  try {
    const { userId, type, actor, content } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const id = `notif_${Date.now()}`;
    const notification: Notification = {
      id,
      userId,
      type,
      actor,
      content,
      read: false,
      createdAt: new Date()
    };

    if (!notifications.has(userId)) {
      notifications.set(userId, []);
    }
    notifications.get(userId)!.unshift(notification);

    res.status(201).json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Get User Notifications
app.get('/notifications/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;

    let userNotifications = notifications.get(userId) || [];
    
    if (unreadOnly === 'true') {
      userNotifications = userNotifications.filter(n => !n.read);
    }

    const paginatedNotifications = userNotifications.slice(
      Number(offset),
      Number(offset) + Number(limit)
    );

    res.json({
      notifications: paginatedNotifications,
      total: userNotifications.length,
      unread: userNotifications.filter(n => !n.read).length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark Notification as Read
app.post('/notifications/:notificationId/read', (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;

    for (const notifList of notifications.values()) {
      const notif = notifList.find(n => n.id === notificationId);
      if (notif) {
        notif.read = true;
        return res.json(notif);
      }
    }

    res.status(404).json({ error: 'Notification not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark All as Read
app.post('/notifications/:userId/read-all', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const userNotifications = notifications.get(userId);

    if (userNotifications) {
      userNotifications.forEach(n => n.read = true);
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

app.listen(port, () => {
  console.log(`🔔 Notification Service running on port ${port}`);
});

export default app;
