import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  attachmentUrls?: string[];
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Send message
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { recipientId, content, attachmentUrls } = req.body;
    const senderId = (req as any).user.userId;

    if (!recipientId || !content) {
      return res.status(400).json({ error: 'Recipient ID and content required' });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot message yourself' });
    }

    // Check if blocked
    const blocked = await query(
      `SELECT id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [senderId, recipientId]
    );

    if (blocked.rows.length > 0) {
      return res.status(403).json({ error: 'Cannot message this user' });
    }

    const id = randomUUID();
    const result = await query(
      `INSERT INTO messages (id, sender_id, recipient_id, content, attachment_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sender_id, recipient_id, content, attachment_urls, is_read, read_at, created_at, updated_at`,
      [id, senderId, recipientId, content, attachmentUrls || []]
    );

    // Update or create conversation
    const convId = [senderId, recipientId].sort().join('_');
    const existing = await query(
      `SELECT id FROM conversations WHERE participant_1_id = LEAST($1, $2) AND participant_2_id = GREATEST($1, $2)`,
      [senderId, recipientId]
    );

    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO conversations (id, participant_1_id, participant_2_id, last_message_id)
         VALUES ($1, LEAST($2, $3), GREATEST($2, $3), $4)`,
        [randomUUID(), senderId, recipientId, id]
      );
    } else {
      await query(
        `UPDATE conversations SET last_message_id = $1, updated_at = NOW()
         WHERE participant_1_id = LEAST($2, $3) AND participant_2_id = GREATEST($2, $3)`,
        [id, senderId, recipientId]
      );
    }

    // Create notification
    await query(
      `INSERT INTO notifications (id, user_id, actor_id, type, content)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), recipientId, senderId, 'message', 'sent you a message']
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation
router.get('/conversations/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId: otherUserId } = req.params;
    const userId = (req as any).user.userId;
    const { limit = '50', offset = '0' } = req.query;

    const result = await query(
      `SELECT id, sender_id, recipient_id, content, attachment_urls, is_read, read_at, created_at, updated_at
       FROM messages
       WHERE (sender_id = $1 AND recipient_id = $2 AND deleted_by_sender = false)
          OR (sender_id = $2 AND recipient_id = $1 AND deleted_by_recipient = false)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, otherUserId, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows.reverse());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user conversations
router.get('/me/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit = '20', offset = '0' } = req.query;

    const result = await query(
      `SELECT c.id, c.participant_1_id, c.participant_2_id, c.last_message_id, c.updated_at,
              m.content as last_message_content
       FROM conversations c
       LEFT JOIN messages m ON c.last_message_id = m.id
       WHERE c.participant_1_id = $1 OR c.participant_2_id = $1
       ORDER BY c.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark as read
router.post('/:messageId/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = (req as any).user.userId;

    const result = await query(
      `UPDATE messages SET is_read = true, read_at = NOW()
       WHERE id = $1 AND recipient_id = $2
       RETURNING id, sender_id, recipient_id, content, attachment_urls, is_read, read_at, created_at, updated_at`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete message
router.delete('/:messageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = (req as any).user.userId;

    const message = await query('SELECT sender_id, recipient_id FROM messages WHERE id = $1', [messageId]);

    if (message.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const { sender_id, recipient_id } = message.rows[0];

    if (userId === sender_id) {
      await query('UPDATE messages SET deleted_by_sender = true WHERE id = $1', [messageId]);
    } else if (userId === recipient_id) {
      await query('UPDATE messages SET deleted_by_recipient = true WHERE id = $1', [messageId]);
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ message: 'Message deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
