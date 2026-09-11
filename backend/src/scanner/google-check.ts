import axios from 'axios';

const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';

interface KeyState {
  key: string;
  failCount: number;
  disabledUntil: number; // timestamp
}

let _keys: KeyState[] = [];
let _currentIndex = 0;

const CIRCUIT_BREAKER_THRESHOLD = 3;   // failures before disabling
const CIRCUIT_BREAKER_COOLDOWN = 60_000; // 60s cooldown

/**
 * Initialize the Google Places key pool from env vars.
 */
export function initGooglePool(): void {
  const rawKeys = [
    process.env.GOOGLE_PLACES_KEY_1,
    process.env.GOOGLE_PLACES_KEY_2,
    process.env.GOOGLE_PLACES_KEY_3,
  ].filter(Boolean) as string[];

  _keys = rawKeys.map(key => ({
    key,
    failCount: 0,
    disabledUntil: 0,
  }));

  if (_keys.length === 0) {
    console.warn('[google-check] No Google Places API keys configured');
  }
}

/**
 * Get the next available key (round-robin, skip disabled).
 */
function getNextKey(): string | null {
  if (_keys.length === 0) return null;

  const now = Date.now();

  for (let i = 0; i < _keys.length; i++) {
    const idx = (_currentIndex + i) % _keys.length;
    const ks = _keys[idx];

    if (ks.disabledUntil <= now) {
      _currentIndex = (idx + 1) % _keys.length;
      return ks.key;
    }
  }

  // All keys disabled — check if any can be re-enabled
  for (const ks of _keys) {
    if (ks.disabledUntil <= now) {
      ks.failCount = 0;
      ks.disabledUntil = 0;
      return ks.key;
    }
  }

  return null; // all in cooldown
}

/**
 * Record success for a key.
 */
function recordSuccess(key: string): void {
  const ks = _keys.find(k => k.key === key);
  if (ks) {
    ks.failCount = 0;
    ks.disabledUntil = 0;
  }
}

/**
 * Record failure for a key — circuit breaker.
 */
function recordFailure(key: string): void {
  const ks = _keys.find(k => k.key === key);
  if (ks) {
    ks.failCount++;
    if (ks.failCount >= CIRCUIT_BREAKER_THRESHOLD) {
      ks.disabledUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
      console.warn(`[google-check] Key ...${key.slice(-6)} disabled for ${CIRCUIT_BREAKER_COOLDOWN / 1000}s`);
    }
  }
}

export interface GoogleCheckResult {
  query: string;
  found: boolean;
  placeId?: string;
  cost: 0; // IDs-Only tier is $0.00
  latencyMs: number;
  keyUsed?: string;
}

/**
 * Binary Google Places check: does this business exist on Google Maps?
 *
 * Uses IDs-Only tier ($0.00/request) with findPlaceFromText.
 * Returns found/not-found — no details fetched.
 */
export async function checkGooglePlaces(query: string): Promise<GoogleCheckResult> {
  const start = Date.now();
  const key = getNextKey();

  if (!key) {
    return {
      query,
      found: false,
      cost: 0,
      latencyMs: Date.now() - start,
    };
  }

  try {
    const resp = await axios.get(PLACES_URL, {
      params: {
        input: query,
        inputtype: 'textquery',
        fields: 'place_id', // IDs-Only — $0.00
        key,
      },
      timeout: 5000,
    });

    if (resp.status === 429) {
      recordFailure(key);
      return {
        query,
        found: false,
        cost: 0,
        latencyMs: Date.now() - start,
        keyUsed: key.slice(-6),
      };
    }

    const candidates = resp.data?.candidates || [];

    if (candidates.length > 0) {
      recordSuccess(key);
      return {
        query,
        found: true,
        placeId: candidates[0].place_id,
        cost: 0,
        latencyMs: Date.now() - start,
        keyUsed: key.slice(-6),
      };
    }

    recordSuccess(key);
    return {
      query,
      found: false,
      cost: 0,
      latencyMs: Date.now() - start,
      keyUsed: key.slice(-6),
    };

  } catch (err: any) {
    recordFailure(key);
    return {
      query,
      found: false,
      cost: 0,
      latencyMs: Date.now() - start,
      keyUsed: key.slice(-6),
    };
  }
}

/**
 * Pool status for monitoring.
 */
export function googlePoolStatus(): {
  totalKeys: number;
  activeKeys: number;
  disabledKeys: number;
} {
  const now = Date.now();
  const active = _keys.filter(k => k.disabledUntil <= now).length;
  return {
    totalKeys: _keys.length,
    activeKeys: active,
    disabledKeys: _keys.length - active,
  };
}
