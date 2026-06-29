import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { query } from '../database/connection';
import { randomUUID } from 'crypto';

const router = Router();

// Create report
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reportedUserId, reportedPostId, reportType, description } = req.body;
    const reporterId = (req as any).user.userId;

    if (!reportType) {
      return res.status(400).json({ error: 'Report type required' });
    }

    if (!reportedUserId && !reportedPostId) {
      return res.status(400).json({ error: 'Must report a user or post' });
    }

    const id = randomUUID();
    const result = await query(
      `INSERT INTO reports (id, reporter_id, reported_user_id, reported_post_id, report_type, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, reporter_id, reported_user_id, reported_post_id, report_type, description, status, created_at`,
      [id, reporterId, reportedUserId, reportedPostId, reportType, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's reports (admin only - placeholder)
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status = 'pending', limit = '20', offset = '0' } = req.query;

    const result = await query(
      `SELECT id, reporter_id, reported_user_id, reported_post_id, report_type, description, status, created_at
       FROM reports
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update report status (admin only - placeholder)
router.put('/:reportId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    const result = await query(
      `UPDATE reports SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, reporter_id, reported_user_id, reported_post_id, report_type, description, status, updated_at`,
      [status, reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
