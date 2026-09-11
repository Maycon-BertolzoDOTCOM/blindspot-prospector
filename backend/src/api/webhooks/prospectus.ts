import { Router } from 'express';
import { getDb } from '../../db/client.js';
import axios from 'axios';

export const webhooksRouter = Router();

const WEBHOOK_URL = process.env.PROSPECTUS_WEBHOOK_URL || 'http://localhost:8000/enrich';
const WEBHOOK_SECRET = process.env.PROSPECTUS_WEBHOOK_SECRET || '';

/**
 * POST /webhook/prospectus — fire-and-forget webhook to Prospectus-Kernel
 * Called when a high-score lead is created (score ≥ 70)
 */
webhooksRouter.post('/prospectus', async (req, res) => {
  const { lead_id, phone, business_name, cnpj, city, state, score } = req.body;

  if (!lead_id || !phone) {
    return res.status(400).json({ error: 'lead_id and phone are required' });
  }

  const payload = {
    lead_id,
    phone,
    business_name: business_name || '',
    cnpj: cnpj || '',
    city: city || '',
    state: state || '',
    score: score || 0,
    source: 'blindspot-prospector',
    timestamp: new Date().toISOString(),
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (WEBHOOK_SECRET) {
      headers['Authorization'] = `Bearer ${WEBHOOK_SECRET}`;
    }

    // Fire-and-forget — don't await
    axios.post(WEBHOOK_URL, payload, {
      headers,
      timeout: 10000,
    }).catch(err => {
      console.warn(`[webhook] Prospectus-Kernel call failed: ${err.message}`);
    });

    res.json({ queued: true, target: WEBHOOK_URL });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /webhook/test — test webhook connectivity
 */
webhooksRouter.post('/test', async (_req, res) => {
  try {
    const resp = await axios.get(WEBHOOK_URL.replace(/\/enrich$/, '/'), {
      timeout: 5000,
    });
    res.json({ reachable: true, status: resp.status });
  } catch (err: any) {
    res.json({ reachable: false, error: err.message });
  }
});
