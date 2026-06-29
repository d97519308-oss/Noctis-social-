import WebSocket, { Server as WebSocketServer } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

interface WSUser {
  userId: string;
  ws: WebSocket;
}

const activeUsers: Map<string, WebSocket> = new Map();

export function initializeWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    const token = new URL(`http://localhost${req.url}`).searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
      const userId = decoded.userId;

      activeUsers.set(userId, ws);
      console.log(`✅ User ${userId} connected`);

      // Handle incoming messages
      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data);
          handleWebSocketMessage(userId, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        activeUsers.delete(userId);
        console.log(`❌ User ${userId} disconnected`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    } catch (error) {
      ws.close(1008, 'Invalid token');
    }
  });
}

async function handleWebSocketMessage(userId: string, message: any) {
  const { type, recipientId, content, postId, commentId } = message;

  switch (type) {
    case 'message':
      await handleDirectMessage(userId, recipientId, content);
      break;
    case 'typing':
      await handleTypingIndicator(userId, recipientId);
      break;
    case 'like':
      await handleLike(userId, postId);
      break;
    case 'comment':
      await handleComment(userId, postId, content);
      break;
    default:
      console.log('Unknown message type:', type);
  }
}

async function handleDirectMessage(senderId: string, recipientId: string, content: string) {
  const messageId = randomUUID();

  // Save to database
  await query(
    `INSERT INTO messages (id, sender_id, recipient_id, content, attachment_urls)
     VALUES ($1, $2, $3, $4, $5)`,
    [messageId, senderId, recipientId, content, []]
  );

  // Send to recipient if online
  const recipientWs = activeUsers.get(recipientId);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(JSON.stringify({
      type: 'message',
      senderId,
      content,
      messageId,
      timestamp: new Date().toISOString(),
    }));
  }

  // Send notification
  await query(
    `INSERT INTO notifications (id, user_id, actor_id, type, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), recipientId, senderId, 'message', 'sent you a message']
  );
}

async function handleTypingIndicator(userId: string, recipientId: string) {
  const recipientWs = activeUsers.get(recipientId);
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    recipientWs.send(JSON.stringify({
      type: 'typing',
      userId,
      timestamp: new Date().toISOString(),
    }));
  }
}

async function handleLike(userId: string, postId: string) {
  const likeId = randomUUID();

  await query(
    `INSERT INTO likes (id, user_id, post_id) VALUES ($1, $2, $3)`,
    [likeId, userId, postId]
  );

  await query('UPDATE posts SET like_count = like_count + 1 WHERE id = $1', [postId]);

  // Get post owner and send notification
  const post = await query('SELECT user_id FROM posts WHERE id = $1', [postId]);
  if (post.rows.length > 0 && post.rows[0].user_id !== userId) {
    const postOwnerId = post.rows[0].user_id;
    const ownerWs = activeUsers.get(postOwnerId);

    if (ownerWs && ownerWs.readyState === WebSocket.OPEN) {
      ownerWs.send(JSON.stringify({
        type: 'like',
        userId,
        postId,
        timestamp: new Date().toISOString(),
      }));
    }

    await query(
      `INSERT INTO notifications (id, user_id, actor_id, type, post_id, content)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), postOwnerId, userId, 'like', postId, 'liked your post']
    );
  }
}

async function handleComment(userId: string, postId: string, content: string) {
  const commentId = randomUUID();

  await query(
    `INSERT INTO comments (id, post_id, user_id, content, image_urls)
     VALUES ($1, $2, $3, $4, $5)`,
    [commentId, postId, userId, content, []]
  );

  await query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1', [postId]);

  // Get post owner and send notification
  const post = await query('SELECT user_id FROM posts WHERE id = $1', [postId]);
  if (post.rows.length > 0 && post.rows[0].user_id !== userId) {
    const postOwnerId = post.rows[0].user_id;
    const ownerWs = activeUsers.get(postOwnerId);

    if (ownerWs && ownerWs.readyState === WebSocket.OPEN) {
      ownerWs.send(JSON.stringify({
        type: 'comment',
        userId,
        postId,
        commentId,
        content,
        timestamp: new Date().toISOString(),
      }));
    }

    await query(
      `INSERT INTO notifications (id, user_id, actor_id, type, post_id, comment_id, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), postOwnerId, userId, 'comment', postId, commentId, 'commented on your post']
    );
  }
}

export function broadcastToUser(userId: string, message: any) {
  const ws = activeUsers.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function getActiveUsersCount(): number {
  return activeUsers.size;
}
