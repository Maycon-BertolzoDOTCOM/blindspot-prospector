import { Router } from 'express';
import { getDb } from '../../db/client.js';

export const exportRouter = Router();

// GET /api/export/csv — export leads as CSV
exportRouter.get('/csv', (req, res) => {
  const db = getDb();

  const {
    status,
    min_score,
    state,
    limit = '1000',
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
  if (state) {
    conditions.push('state = ?');
    params.push(state.toUpperCase());
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 1000), 10000);

  const rows = db.prepare(`
    SELECT
      id, phone, cnpj, business_name, city, state, cnae,
      capital_social, porte, has_whatsapp, has_google_place,
      score, status, source, created_at
    FROM leads ${where}
    ORDER BY score DESC
    LIMIT ?
  `).all(...params, limitNum) as any[];

  // Build CSV
  const headers = [
    'ID', 'Phone', 'CNPJ', 'Business Name', 'City', 'State', 'CNAE',
    'Capital Social', 'Porte', 'WhatsApp', 'Google Place', 'Score',
    'Status', 'Source', 'Created At',
  ];

  const csvLines = [headers.join(',')];

  for (const row of rows) {
    csvLines.push([
      row.id,
      row.phone,
      row.cnpj || '',
      `"${(row.business_name || '').replace(/"/g, '""')}"`,
      row.city || '',
      row.state || '',
      row.cnae || '',
      row.capital_social || 0,
      row.porte || '',
      row.has_whatsapp ? 'YES' : 'NO',
      row.has_google_place ? 'YES' : 'NO',
      row.score,
      row.status,
      row.source || '',
      row.created_at || '',
    ].join(','));
  }

  const csv = csvLines.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads_${Date.now()}.csv"`);
  res.send(csv);
});

// GET /api/export/json — export leads as JSON
exportRouter.get('/json', (req, res) => {
  const db = getDb();

  const { status, min_score, state, limit = '1000' } = req.query as Record<string, string>;

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
  if (state) {
    conditions.push('state = ?');
    params.push(state.toUpperCase());
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 1000), 10000);

  const rows = db.prepare(`
    SELECT * FROM leads ${where}
    ORDER BY score DESC
    LIMIT ?
  `).all(...params, limitNum);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="leads_${Date.now()}.json"`);
  res.json(rows);
});
