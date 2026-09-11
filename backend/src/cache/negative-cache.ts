import NodeCache from 'node-cache';

const TTL_DAYS = parseInt(process.env.NEGATIVE_CACHE_TTL_DAYS || '30', 10);
const TTL_SECONDS = TTL_DAYS * 86400;

let _cache: NodeCache | null = null;

function getCache(): NodeCache {
  if (!_cache) {
    _cache = new NodeCache({
      stdTTL: TTL_SECONDS,
      checkperiod: 3600,  // check every hour
      maxKeys: 500_000,   // ~500K phones
      useClones: false,    // performance
    });
  }
  return _cache;
}

/**
 * Record a phone as negative (not WhatsApp, not reachable, etc.)
 */
export function markNegative(phone: string, reason: string): void {
  getCache().set(`neg:${phone}`, reason);
}

/**
 * Check if a phone was previously marked as negative
 */
export function isNegative(phone: string): boolean {
  return getCache().has(`neg:${phone}`);
}

/**
 * Get the reason a phone was marked negative
 */
export function getNegativeReason(phone: string): string | undefined {
  return getCache().get(`neg:${phone}`);
}

/**
 * Stats for monitoring
 */
export function cacheStats(): { keys: number; hits: number; misses: number } {
  const c = getCache();
  return {
    keys: c.keys().length,
    hits: c.getStats().hits,
    misses: c.getStats().misses,
  };
}

/**
 * Flush all cached negatives
 */
export function flushCache(): void {
  getCache().flushAll();
}
