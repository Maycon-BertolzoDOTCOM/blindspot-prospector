import { Router } from 'express';
import { getDb } from '../../db/client.js';

export const leadsRouter = Router();

// GET /api/leads — list leads with filters
leadsRouter.get('/', (req, res) => {
  const db = getDb();

  const {
    status,
    min_score,
    max_score,
    has_whatsapp,
    has_google_place,
    state,
    cnae,
    page = '1',
    limit = '50',
    sort = 'score',
    order = 'desc',
  } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (min_score) {
    conditions.push('score >= ?');
    params.push(parseInt(min_score, 10));
  }
  if (max_score) {
    conditions.push('score <= ?');
    params.push(parseInt(max_score, 10));
  }
  if (has_whatsapp !== undefined) {
    conditions.push('has_whatsapp = ?');
    params.push(has_whatsapp === 'true' ? 1 : 0);
  }
  if (has_google_place !== undefined) {
    conditions.push('has_google_place = ?');
    params.push(has_google_place === 'true' ? 1 : 0);
  }
  if (state) {
    conditions.push('state = ?');
    params.push(state.toUpperCase());
  }
  if (cnae) {
    conditions.push('cnae = ?');
    params.push(cnae);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const allowedSorts = ['score', 'created_at', 'capital_social', 'business_name'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'score';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 200);
  const offset = (pageNum - 1) * limitNum;

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM leads ${where}`).get(...params) as any;
  const total = countRow?.total || 0;

  const rows = db.prepare(`
    SELECT * FROM leads ${where}
    ORDER BY ${sortCol} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  res.json({
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

// GET /api/leads/stats — summary stats
leadsRouter.get('/stats', (_req, res) => {
  const db = getDb();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM leads GROUP BY status
  `).all();

  const byState = db.prepare(`
    SELECT state, COUNT(*) as count FROM leads WHERE state IS NOT NULL GROUP BY state ORDER BY count DESC LIMIT 10
  `).all();

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      AVG(score) as avg_score,
      MAX(score) as max_score,
      SUM(CASE WHEN has_whatsapp = 1 THEN 1 ELSE 0 END) as whatsapp_count,
      SUM(CASE WHEN has_google_place = 1 THEN 1 ELSE 0 END) as google_count
    FROM leads
  `).get() as any;

  res.json({
    totals: {
      total: totals?.total || 0,
      avgScore: Math.round(totals?.avg_score || 0),
      maxScore: totals?.max_score || 0,
      whatsappCount: totals?.whatsapp_count || 0,
      googleCount: totals?.google_count || 0,
    },
    byStatus,
    byState,
  });
});

// GET /api/leads/:id — single lead
leadsRouter.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  res.json({ data: row });
});

// PATCH /api/leads/:id — update lead status
leadsRouter.patch('/:id', (req, res) => {
  const db = getDb();
  const { status } = req.body;

  if (!status || !['NEW', 'CONTACTED', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: NEW, CONTACTED, CLOSED' });
  }

  const result = db.prepare(`
    UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(status, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  res.json({ data: row });
});

// DELETE /api/leads/:id — delete lead
leadsRouter.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  res.json({ deleted: true, id: parseInt(req.params.id, 10) });
});
