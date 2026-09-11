import axios, { AxiosError } from 'axios';
import { isNegative, markNegative } from '../cache/negative-cache.js';

const WA_URL = 'https://wa.me';
const OG_TITLE_REGEX = /<meta\s+property="og:title"\s+content="([^"]*?)"/i;
const SHARE_REJECT = /compartilhar|share|forward/i;

const client = axios.create({
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  },
  maxRedirects: 5,
  validateStatus: (status) => status < 500,
});

export interface WhatsAppResult {
  phone: string;
  hasWhatsApp: boolean;
  businessName?: string;
  method: 'head' | 'range_og_title';
  latencyMs: number;
  cached?: boolean;
}

/**
 * Check if a phone number has an active WhatsApp account.
 *
 * Strategy:
 * 1. Check negative cache first (30-day TTL)
 * 2. HEAD request to wa.me/{phone} → 200 = exists
 * 3. If exists, GET with Range header → parse og:title
 * 4. Reject if og:title contains "Compartilhar" (Share screen = no account)
 */
export async function checkWhatsApp(phone: string): Promise<WhatsAppResult> {
  const start = Date.now();

  // 0. Reject obviously invalid phones (need at least 10 digits for a Brazilian number)
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return {
      phone,
      hasWhatsApp: false,
      method: 'head',
      latencyMs: Date.now() - start,
    };
  }

  // 1. Negative cache check
  if (isNegative(phone)) {
    return {
      phone,
      hasWhatsApp: false,
      method: 'head',
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  try {
    // 2. HEAD request — fast existence check
    const headResp = await client.head(`${WA_URL}/${phone}`, {
      timeout: 5000,
      maxRedirects: 3,
    });

    if (headResp.status === 404 || headResp.status === 406) {
      markNegative(phone, 'head_404');
      return {
        phone,
        hasWhatsApp: false,
        method: 'head',
        latencyMs: Date.now() - start,
      };
    }

    // 3. GET with Range header → extract og:title
    const getResp = await client.get(`${WA_URL}/${phone}`, {
      headers: {
        'Range': 'bytes=0-4000',
      },
      timeout: 5000,
    });

    const html = typeof getResp.data === 'string' ? getResp.data : String(getResp.data);
    const match = OG_TITLE_REGEX.exec(html);

    if (!match) {
      // No og:title found — likely a share screen (no account)
      markNegative(phone, 'no_og_title');
      return {
        phone,
        hasWhatsApp: false,
        method: 'range_og_title',
        latencyMs: Date.now() - start,
      };
    }

    const title = match[1].trim();

    // 4. Reject share screens
    if (SHARE_REJECT.test(title)) {
      markNegative(phone, 'share_screen');
      return {
        phone,
        hasWhatsApp: false,
        businessName: title,
        method: 'range_og_title',
        latencyMs: Date.now() - start,
      };
    }

    // Valid WhatsApp account — og:title is the business/account name
    return {
      phone,
      hasWhatsApp: true,
      businessName: title,
      method: 'range_og_title',
      latencyMs: Date.now() - start,
    };

  } catch (err: any) {
    const status = (err as AxiosError).response?.status;

    if (status === 429) {
      // Rate limited — don't cache, just report
      return {
        phone,
        hasWhatsApp: false,
        method: 'head',
        latencyMs: Date.now() - start,
      };
    }

    if (status === 404 || status === 406) {
      markNegative(phone, `http_${status}`);
      return {
        phone,
        hasWhatsApp: false,
        method: 'head',
        latencyMs: Date.now() - start,
      };
    }

    // Network error — don't cache
    return {
      phone,
      hasWhatsApp: false,
      method: 'head',
      latencyMs: Date.now() - start,
    };
  }
}
