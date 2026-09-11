import { Router } from 'express';
import { getDb } from '../../db/client.js';
import { runScan, type ScanOptions } from '../../scanner/orchestrator.js';

export const scansRouter = Router();

// POST /api/scans — trigger a new scan
scansRouter.post('/', async (req, res) => {
  const { vertical, state, city, cnaes, limit } = req.body as ScanOptions;

  const options: ScanOptions = {
    vertical: vertical || 'default',
    state: state || process.env.TARGET_STATE || 'SP',
    city,
    cnaes,
    limit: Math.min(limit || 1000, 10000),
  };

  try {
    // Run scan async — respond immediately with job ID
    const result = await runScan(options);
    res.json({ data: result });
  } catch (err: any) {
    console.error('[scans] Scan failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scans — list scan jobs
scansRouter.get('/', (_req, res) => {
  const db = getDb();

  const rows = db.prepare(`
    SELECT * FROM scan_jobs ORDER BY started_at DESC LIMIT 50
  `).all();

  res.json({ data: rows });
});

// GET /api/scans/:id — single scan job
scansRouter.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM scan_jobs WHERE id = ?').get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: 'Scan job not found' });
  }

  res.json({ data: row });
});
