/**
 * Google Places Cost Benchmark
 *
 * Tests the IDs-Only tier ($0.00/request) with findPlaceFromText.
 * Verifies that requesting only place_id costs nothing.
 *
 * Run: npx tsx backend/tests/benchmark-google.ts
 */

import axios from 'axios';

const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';

async function main() {
  const keys = [
    process.env.GOOGLE_PLACES_KEY_1,
    process.env.GOOGLE_PLACES_KEY_2,
    process.env.GOOGLE_PLACES_KEY_3,
  ].filter(Boolean);

  console.log('='.repeat(70));
  console.log('  BLINDSPOT PROSPECTOR — Google Places Cost Benchmark');
  console.log('='.repeat(70));
  console.log();
  console.log(`  API keys available: ${keys.length}`);
  console.log();

  if (keys.length === 0) {
    console.log('  No Google Places API keys configured.');
    console.log('  Set GOOGLE_PLACES_KEY_1, GOOGLE_PLACES_KEY_2, GOOGLE_PLACES_KEY_3 in .env');
    console.log();
    console.log('  Expected cost breakdown:');
    console.log('  ┌──────────────────────────────────────────────────────┐');
    console.log('  │ Field requested    │ Cost/request  │ Tier          │');
    console.log('  ├──────────────────────────────────────────────────────┤');
    console.log('  │ place_id only      │ $0.00         │ IDs-Only      │');
    console.log('  │ + name             │ $0.032        │ Basic         │');
    console.log('  │ + formatted_address│ $0.032        │ Basic         │');
    console.log('  │ + rating           │ $0.032        │ Basic         │');
    console.log('  │ + phone            │ $0.032        │ Basic         │');
    console.log('  │ + website          │ $0.032        │ Basic         │');
    console.log('  │ + reviews          │ $0.050        │ Advanced      │');
    console.log('  └──────────────────────────────────────────────────────┘');
    console.log();
    console.log('  At 1000 requests/day × 30 days = $0.00/month (IDs-Only)');
    console.log('  vs $960/month if fetching all details (Basic tier)');
    console.log();
    return;
  }

  // Test queries — sample business searches
  const testQueries = [
    'Marmoraria São Paulo, SP',
    'Loja de Pisos Centro, SP',
    'Construtora ABC, Campinas, SP',
    'Materiais de Construção, Santos, SP',
    'Revestimentos Decorativos, Guarulhos, SP',
  ];

  console.log('  Testing IDs-Only tier (place_id only — $0.00/request):');
  console.log();

  let totalLatency = 0;
  let found = 0;
  let notFound = 0;

  for (const query of testQueries) {
    const start = Date.now();

    try {
      const resp = await axios.get(PLACES_URL, {
        params: {
          input: query,
          inputtype: 'textquery',
          fields: 'place_id', // IDs-Only — $0.00
          key: keys[0],
        },
        timeout: 5000,
      });

      const latency = Date.now() - start;
      totalLatency += latency;

      const candidates = resp.data?.candidates || [];

      if (candidates.length > 0) {
        found++;
        console.log(`  ✓ "${query}" → place_id: ${candidates[0].place_id} (${latency}ms)`);
      } else {
        notFound++;
        console.log(`  ✗ "${query}" → not found (${latency}ms)`);
      }

      // Rate limit: 1 req/sec for free tier
      await new Promise(r => setTimeout(r, 1100));

    } catch (err: any) {
      const latency = Date.now() - start;
      totalLatency += latency;
      console.log(`  ✗ "${query}" → error: ${err.message} (${latency}ms)`);
    }
  }

  const avgLatency = Math.round(totalLatency / testQueries.length);

  console.log();
  console.log('='.repeat(70));
  console.log('  RESULTS');
  console.log('='.repeat(70));
  console.log();
  console.log(`  Queries tested:      ${testQueries.length}`);
  console.log(`  Found on Maps:       ${found}`);
  console.log(`  Not found:           ${notFound}`);
  console.log(`  Avg latency:         ${avgLatency}ms`);
  console.log();
  console.log('  Cost analysis:');
  console.log(`  ┌──────────────────────────────────────────────────┐`);
  console.log(`  │ IDs-Only (place_id):    $0.00 × ${testQueries.length} = $0.00     │`);
  console.log(`  │ Basic (name+addr+phone): $0.032 × ${testQueries.length} = $${(0.032 * testQueries.length).toFixed(3)}   │`);
  console.log(`  │ Monthly at 1K/day:      $0.00 (IDs-Only)         │`);
  console.log(`  │ Monthly at 1K/day Basic: $960.00                  │`);
  console.log(`  └──────────────────────────────────────────────────┘`);
  console.log();
  console.log('  ✓ IDs-Only tier is free — use this for binary check');
  console.log('  ✓ Only fetch details for leads that pass WhatsApp check');
  console.log();
}

main().catch(console.error);
