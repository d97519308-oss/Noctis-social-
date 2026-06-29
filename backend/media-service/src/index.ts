import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
app.use(express.json());

const port = process.env.MEDIA_PORT || 3006;

interface MediaFile {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: Date;
}

const mediaFiles: Map<string, MediaFile> = new Map();

// Upload Media
app.post('/upload', (req: Request, res: Response) => {
  try {
    const { userId, fileName, fileType, fileSize, url, thumbnailUrl } = req.body;

    if (!userId || !fileName || !fileType) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const id = `media_${Date.now()}`;
    const media: MediaFile = {
      id,
      userId,
      fileName,
      fileType,
      fileSize: fileSize || 0,
      url,
      thumbnailUrl,
      uploadedAt: new Date()
    };

    mediaFiles.set(id, media);
    res.status(201).json(media);
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get Media
app.get('/media/:mediaId', (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    const media = mediaFiles.get(mediaId);

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    res.json(media);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get media' });
  }
});

// Get User Media
app.get('/user/:userId/media', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const userMedia = Array.from(mediaFiles.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .slice(Number(offset), Number(offset) + Number(limit));

    res.json(userMedia);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get media' });
  }
});

// Delete Media
app.delete('/media/:mediaId', (req: Request, res: Response) => {
  try {
    const { mediaId } = req.params;
    const media = mediaFiles.get(mediaId);

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    mediaFiles.delete(mediaId);
    res.json({ message: 'Media deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

app.listen(port, () => {
  console.log(`🎬 Media Service running on port ${port}`);
});

export default app;
