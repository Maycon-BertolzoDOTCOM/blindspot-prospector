#!/usr/bin/env node

/**
 * Blindspot Prospector CLI — trigger scans from terminal
 *
 * Usage:
 *   npx tsx backend/src/cli/scan.ts --state SP --limit 500
 *   npx tsx backend/src/cli/scan.ts --vertical marmorarias --cnae 2330300 --state SP --city "São Paulo"
 */

import { runScan, type ScanOptions } from '../scanner/orchestrator.js';
import { getDb, closeDb } from '../db/client.js';

function parseArgs(): ScanOptions {
  const args = process.argv.slice(2);
  const opts: ScanOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--state':
        opts.state = args[++i];
        break;
      case '--city':
        opts.city = args[++i];
        break;
      case '--vertical':
        opts.vertical = args[++i];
        break;
      case '--cnae':
        opts.cnaes = args[++i].split(',');
        break;
      case '--limit':
        opts.limit = parseInt(args[++i], 10);
        break;
      case '--help':
        console.log(`
Blindspot Prospector CLI

Usage: scan.ts [options]

Options:
  --state <UF>        State filter (e.g., SP, MG, RJ)
  --city <name>       City filter (partial match)
  --vertical <name>   Scan vertical name (e.g., marmorarias, pisos)
  --cnae <codes>      Comma-separated CNAE codes (default: 2330300,4742700,4330401)
  --limit <n>         Max CNPJs to process (default: 1000, max: 10000)
  --help              Show this help
        `);
        process.exit(0);
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs();
  const start = Date.now();

  console.log('='.repeat(60));
  console.log('  BLINDSPOT PROSPECTOR — Mining WhatsApp-active leads');
  console.log('='.repeat(60));
  console.log();
  console.log(`  State:    ${opts.state || 'SP'}`);
  console.log(`  City:     ${opts.city || 'all'}`);
  console.log(`  Vertical: ${opts.vertical || 'default'}`);
  console.log(`  CNAEs:    ${(opts.cnaes || ['2330300', '4742700', '4330401']).join(', ')}`);
  console.log(`  Limit:    ${opts.limit || 1000}`);
  console.log();

  try {
    const result = await runScan(opts);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log();
    console.log('='.repeat(60));
    console.log('  SCAN COMPLETE');
    console.log('='.repeat(60));
    console.log();
    console.log(`  Job ID:          #${result.job.id}`);
    console.log(`  CNPJs loaded:    ${result.job.totalCnpjs}`);
    console.log(`  Phones generated: ${result.job.phonesGenerated}`);
    console.log(`  WhatsApp valid:  ${result.job.whatsappValid}`);
    console.log(`  Google found:    ${result.job.googleFound} (excluded)`);
    console.log(`  Leads created:   ${result.job.leadsCreated}`);
    console.log(`  Time:            ${elapsed}s`);
    console.log();

    if (result.leads.length > 0) {
      console.log('  Top leads:');
      console.log('  ' + '-'.repeat(56));
      for (const lead of result.leads.slice(0, 10)) {
        console.log(`  Score ${String(lead.score).padStart(3)} | ${lead.phone} | ${lead.businessName || 'N/A'}`);
      }
      if (result.leads.length > 10) {
        console.log(`  ... and ${result.leads.length - 10} more`);
      }
    } else {
      console.log('  No leads found matching criteria.');
    }

    console.log();

    // Show DB stats
    const db = getDb();
    const stats = db.prepare('SELECT COUNT(*) as total, AVG(score) as avg_score FROM leads').get() as any;
    console.log(`  Total leads in DB: ${stats?.total || 0} (avg score: ${Math.round(stats?.avg_score || 0)})`);
    console.log();

  } catch (err: any) {
    console.error('\n  Scan failed:', err.message);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
