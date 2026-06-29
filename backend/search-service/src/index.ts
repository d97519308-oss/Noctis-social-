import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
app.use(express.json());

const port = process.env.SEARCH_PORT || 3007;

interface SearchIndex {
  id: string;
  type: 'user' | 'post' | 'hashtag';
  content: string;
  metadata: any;
}

const searchIndex: SearchIndex[] = [];

// Index Content
app.post('/index', (req: Request, res: Response) => {
  try {
    const { id, type, content, metadata } = req.body;

    if (!id || !type || !content) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    // Remove existing index
    const existingIndex = searchIndex.findIndex(s => s.id === id);
    if (existingIndex >= 0) {
      searchIndex.splice(existingIndex, 1);
    }

    searchIndex.push({
      id,
      type,
      content: content.toLowerCase(),
      metadata
    });

    res.json({ message: 'Content indexed' });
  } catch (error) {
    res.status(500).json({ error: 'Indexing failed' });
  }
});

// Search
app.get('/search', (req: Request, res: Response) => {
  try {
    const { q, type, limit = 20, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    let results = searchIndex.filter(item => {
      const matchesQuery = item.content.includes(String(q).toLowerCase());
      const matchesType = !type || item.type === type;
      return matchesQuery && matchesType;
    });

    const total = results.length;
    results = results.slice(Number(offset), Number(offset) + Number(limit));

    res.json({ results, total, query: q });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Delete Index
app.delete('/index/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const index = searchIndex.findIndex(s => s.id === id);

    if (index < 0) {
      return res.status(404).json({ error: 'Index not found' });
    }

    searchIndex.splice(index, 1);
    res.json({ message: 'Index deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete index' });
  }
});

app.listen(port, () => {
  console.log(`🔍 Search Service running on port ${port}`);
});

export default app;
