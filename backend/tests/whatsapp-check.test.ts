import { describe, it, expect } from 'vitest';

describe('whatsapp-check', () => {
  it('module compiles', async () => {
    const mod = await import('../src/scanner/whatsapp-check.js');
    expect(mod.checkWhatsApp).toBeDefined();
    expect(typeof mod.checkWhatsApp).toBe('function');
  });

  it('checkWhatsApp rejects short phone numbers', async () => {
    const { checkWhatsApp } = await import('../src/scanner/whatsapp-check.js');
    const result = await checkWhatsApp('123');
    expect(result.hasWhatsApp).toBe(false);
    expect(result.method).toBe('head');
  });

  it('checkWhatsApp rejects empty input', async () => {
    const { checkWhatsApp } = await import('../src/scanner/whatsapp-check.js');
    const result = await checkWhatsApp('');
    expect(result.hasWhatsApp).toBe(false);
  });

  it('checkWhatsApp returns latencyMs', async () => {
    const { checkWhatsApp } = await import('../src/scanner/whatsapp-check.js');
    const result = await checkWhatsApp('11999998888');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
