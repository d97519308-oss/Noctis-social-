import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
app.use(express.json());

const port = process.env.MESSAGING_PORT || 3004;

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  attachment?: string;
  read: boolean;
  createdAt: Date;
}

interface Conversation {
  id: string;
  participantIds: string[];
  lastMessage?: Message;
  updatedAt: Date;
}

const messages: Map<string, Message> = new Map();
const conversations: Map<string, Conversation> = new Map();

// Send Message
app.post('/messages', (req: Request, res: Response) => {
  try {
    const { senderId, recipientId, content, attachment } = req.body;

    if (!senderId || !recipientId || !content) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const id = `msg_${Date.now()}`;
    const message: Message = {
      id,
      senderId,
      recipientId,
      content,
      attachment,
      read: false,
      createdAt: new Date()
    };

    messages.set(id, message);

    // Create or update conversation
    const conversationId = [senderId, recipientId].sort().join('_');
    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, {
        id: conversationId,
        participantIds: [senderId, recipientId],
        lastMessage: message,
        updatedAt: new Date()
      });
    } else {
      const conv = conversations.get(conversationId)!;
      conv.lastMessage = message;
      conv.updatedAt = new Date();
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get Conversation
app.get('/conversations/:conversationId', (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const convMessages = Array.from(messages.values())
      .filter(m => 
        (m.senderId === conversation.participantIds[0] && m.recipientId === conversation.participantIds[1]) ||
        (m.senderId === conversation.participantIds[1] && m.recipientId === conversation.participantIds[0])
      )
      .slice(Number(offset), Number(offset) + Number(limit));

    res.json({ conversation, messages: convMessages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Get User Conversations
app.get('/conversations/user/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const userConversations = Array.from(conversations.values())
      .filter(c => c.participantIds.includes(userId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    res.json(userConversations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Mark as Read
app.post('/messages/:messageId/read', (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const message = messages.get(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.read = true;
    messages.set(messageId, message);
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

app.listen(port, () => {
  console.log(`💬 Messaging Service running on port ${port}`);
});

export default app;
