import express from 'express';
import cors from 'cors';
import { getDb, closeDb } from '../db/client.js';
import { leadsRouter } from './routes/leads.js';
import { scansRouter } from './routes/scans.js';
import { exportRouter } from './routes/export.js';
import { webhooksRouter } from './webhooks/prospectus.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  const db = getDb();
  const leadCount = db.prepare('SELECT COUNT(*) as n FROM leads').get() as any;
  const jobCount = db.prepare('SELECT COUNT(*) as n FROM scan_jobs').get() as any;

  res.json({
    status: 'ok',
    version: '0.1.0',
    leads: leadCount?.n || 0,
    scanJobs: jobCount?.n || 0,
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/leads', leadsRouter);
app.use('/api/scans', scansRouter);
app.use('/api/export', exportRouter);
app.use('/webhook', webhooksRouter);

// Start server
const server = app.listen(PORT, () => {
  console.log(`[blindspot-prospector] API running on http://localhost:${PORT}`);
  console.log(`[blindspot-prospector] Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[blindspot-prospector] Shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

export { app };
