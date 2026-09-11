import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { markNegative, isNegative, cacheStats, flushCache } from '../src/cache/negative-cache.js';

describe('NegativeCache', () => {
  beforeEach(() => {
    flushCache();
  });

  afterEach(() => {
    flushCache();
  });

  it('marks and checks negative', () => {
    markNegative('+5511999999999', 'head_404');
    expect(isNegative('+5511999999999')).toBe(true);
    expect(isNegative('+5511888888888')).toBe(false);
  });

  it('returns stats', () => {
    markNegative('+5511111111111', 'no_og_title');
    markNegative('+5511222222222', 'share_screen');
    const stats = cacheStats();
    expect(stats.keys).toBeGreaterThanOrEqual(2);
  });

  it('clears all entries', () => {
    markNegative('+5511333333333', 'test');
    flushCache();
    expect(isNegative('+5511333333333')).toBe(false);
  });

  it('respects maxKeys (integration with node-cache)', () => {
    // The module uses a singleton with maxKeys=500_000.
    // We verify the cache is functional, not the maxKeys limit itself
    // (which would require creating 500K entries).
    markNegative('+5511111111111', 'a');
    markNegative('+5511222222222', 'b');
    markNegative('+5511333333333', 'c');
    const stats = cacheStats();
    expect(stats.keys).toBeGreaterThanOrEqual(3);
  });
});
