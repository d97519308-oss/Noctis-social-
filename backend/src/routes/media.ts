import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

// Upload media
router.post('/upload', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { fileName, fileType, fileSize, storagePath, mimeType, width, height, duration, thumbnailPath } = req.body;
    const userId = (req as any).user.userId;

    if (!fileName || !fileType || !storagePath) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const id = randomUUID();
    const result = await query(
      `INSERT INTO media_files (id, user_id, file_type, file_name, file_size_bytes, storage_path, mime_type, width, height, duration_seconds, thumbnail_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, user_id, file_type, file_name, file_size_bytes, storage_path, mime_type, width, height, duration_seconds, thumbnail_path, is_public, created_at`,
      [id, userId, fileType, fileName, fileSize || 0, storagePath, mimeType, width, height, duration, thumbnailPath]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get media file
router.get('/:mediaId', async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;

    const result = await query(
      `SELECT id, user_id, file_type, file_name, file_size_bytes, storage_path, mime_type, width, height, duration_seconds, thumbnail_path, is_public, created_at
       FROM media_files
       WHERE id = $1 AND is_public = true`,
      [mediaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user media
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const result = await query(
      `SELECT id, user_id, file_type, file_name, file_size_bytes, storage_path, mime_type, width, height, duration_seconds, thumbnail_path, is_public, created_at
       FROM media_files
       WHERE user_id = $1 AND is_public = true
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's own media
router.get('/me/media', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { limit = '50', offset = '0' } = req.query;

    const result = await query(
      `SELECT id, user_id, file_type, file_name, file_size_bytes, storage_path, mime_type, width, height, duration_seconds, thumbnail_path, is_public, created_at
       FROM media_files
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete media
router.delete('/:mediaId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    const userId = (req as any).user.userId;

    const media = await query('SELECT user_id FROM media_files WHERE id = $1', [mediaId]);

    if (media.rows.length === 0 || media.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await query('DELETE FROM media_files WHERE id = $1', [mediaId]);

    res.json({ message: 'Media deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
