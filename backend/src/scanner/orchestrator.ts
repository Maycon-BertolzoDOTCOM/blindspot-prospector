import pLimit from 'p-limit';
import { getDb } from '../db/client.js';
import { loadCnpjs, countCnpjs, extractPhones, type CnpjRecord } from './cnpj-loader.js';
import { checkWhatsApp, type WhatsAppResult } from './whatsapp-check.js';
import { checkGooglePlaces, initGooglePool, type GoogleCheckResult } from './google-check.js';
import { scoreLead, getTargetCnaes, type ScoringOutput } from './scorer.js';

const CONCURRENT_LIMIT = parseInt(process.env.MAX_CONCURRENT_PHONES || '10', 10);
const RATE_LIMIT_MS = parseInt(process.env.WHATSAPP_RATE_LIMIT_MS || '100', 10);

export interface ScanOptions {
  vertical?: string;
  state?: string;
  city?: string;
  cnaes?: string[];
  limit?: number;
}

export interface ScanJob {
  id: number;
  vertical: string;
  state: string;
  status: 'running' | 'completed' | 'failed';
  totalCnpjs: number;
  phonesGenerated: number;
  whatsappValid: number;
  googleFound: number;
  leadsCreated: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ScanResult {
  job: ScanJob;
  leads: LeadResult[];
}

export interface LeadResult {
  phone: string;
  businessName?: string;
  cnpj?: string;
  city?: string;
  state?: string;
  hasWhatsApp: boolean;
  hasGooglePlace: boolean;
  score: number;
  scoring: ScoringOutput;
}

/**
 * Start a full scan pipeline:
 * 1. Load CNPJs from dump (filtered by CNAE + state)
 * 2. Generate phone numbers
 * 3. Check WhatsApp (HEAD + Range)
 * 4. Check Google Places (binary)
 * 5. Score leads
 * 6. Persist to DB
 */
export async function runScan(options: ScanOptions = {}): Promise<ScanResult> {
  initGooglePool();

  const cnaes = options.cnaes || getTargetCnaes();
  const state = options.state || process.env.TARGET_STATE || 'SP';
  const limit = options.limit || 1000;
  const vertical = options.vertical || 'default';

  const db = getDb();

  // Create scan job
  const jobResult = db.prepare(`
    INSERT INTO scan_jobs (vertical, state, cnae_filter, status)
    VALUES (?, ?, ?, 'running')
  `).run(vertical, state, cnaes.join(','));

  const jobId = jobResult.lastInsertRowid as number;

  const updateJob = db.prepare(`
    UPDATE scan_jobs
    SET total_cnpjs = ?, phones_generated = ?, whatsapp_valid = ?,
        google_found = ?, leads_created = ?, status = ?, error = ?,
        completed_at = datetime('now')
    WHERE id = ?
  `);

  const insertLead = db.prepare(`
    INSERT OR IGNORE INTO leads
    (phone, cnpj, business_name, city, state, cnae, capital_social, porte,
     has_whatsapp, has_google_place, score, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const leads: LeadResult[] = [];

  try {
    // Step 1: Load CNPJs
    const records = loadCnpjs({ cnaes, state, city: options.city, limit });
    const totalCnpjs = records.length;

    // Step 2: Extract phone numbers
    const phonesWithRecords: { phone: string; record: CnpjRecord }[] = [];
    for (const rec of records) {
      const phones = extractPhones(rec);
      for (const phone of phones) {
        phonesWithRecords.push({ phone, record: rec });
      }
    }

    const phonesGenerated = phonesWithRecords.length;
    let whatsappValid = 0;
    let googleFound = 0;
    let leadsCreated = 0;

    // Step 3+4: Check WhatsApp + Google (concurrent, rate-limited)
    const limit_fn = pLimit(CONCURRENT_LIMIT);
    const rateLimit = pLimit(1); // serial rate limiter

    const checkTasks = phonesWithRecords.map(({ phone, record }) =>
      limit_fn(async () => {
        // Rate limiting
        await new Promise(resolve => rateLimit(() => setTimeout(resolve, RATE_LIMIT_MS)));

        // WhatsApp check
        const waResult: WhatsAppResult = await checkWhatsApp(phone);

        if (!waResult.hasWhatsApp) {
          return null; // skip — no WhatsApp
        }

        whatsappValid++;

        // Google Places check (only if WhatsApp is valid)
        const query = record.razao_social
          ? `${record.razao_social}, ${record.municipio}, ${record.uf}`
          : `${phone}`;

        const gpResult: GoogleCheckResult = await checkGooglePlaces(query);

        if (gpResult.found) {
          googleFound++;
          return null; // skip — already on Google Maps
        }

        // Step 5: Score
        const scoring = scoreLead({
          capital_social: record.capital_social,
          data_abertura: record.data_abertura,
          porte: record.porte,
          cnae: record.cnae,
          has_whatsapp: true,
          has_google_place: false,
        });

        const lead: LeadResult = {
          phone,
          businessName: waResult.businessName || record.razao_social,
          cnpj: record.cnpj,
          city: record.municipio,
          state: record.uf,
          hasWhatsApp: true,
          hasGooglePlace: false,
          score: scoring.score,
          scoring,
        };

        // Step 6: Persist
        insertLead.run(
          lead.phone,
          lead.cnpj || null,
          lead.businessName || null,
          lead.city || null,
          lead.state || null,
          record.cnae || null,
          record.capital_social || null,
          record.porte || null,
          1, // has_whatsapp
          0, // has_google_place
          lead.score,
          'cnpj_dump'
        );

        leadsCreated++;
        leads.push(lead);

        return lead;
      })
    );

    await Promise.all(checkTasks);

    // Mark job completed
    updateJob.run(
      totalCnpjs, phonesGenerated, whatsappValid,
      googleFound, leadsCreated, 'completed', null, jobId
    );

    return {
      job: {
        id: jobId,
        vertical,
        state,
        status: 'completed',
        totalCnpjs,
        phonesGenerated,
        whatsappValid,
        googleFound,
        leadsCreated,
        startedAt: new Date().toISOString(),
      },
      leads,
    };

  } catch (err: any) {
    updateJob.run(0, 0, 0, 0, 0, 'failed', err.message, jobId);

    return {
      job: {
        id: jobId,
        vertical,
        state,
        status: 'failed',
        totalCnpjs: 0,
        phonesGenerated: 0,
        whatsappValid: 0,
        googleFound: 0,
        leadsCreated: 0,
        startedAt: new Date().toISOString(),
        error: err.message,
      },
      leads: [],
    };
  }
}
