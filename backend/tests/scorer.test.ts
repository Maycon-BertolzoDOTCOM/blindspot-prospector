import { describe, it, expect } from 'vitest';
import { scoreLead, getTargetCnaes } from '../src/scanner/scorer.js';

describe('scorer', () => {
  it('returns 0 for empty input', () => {
    const result = scoreLead({});
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown).toHaveProperty('capital');
    expect(result.breakdown).toHaveProperty('time');
    expect(result.breakdown).toHaveProperty('porte');
    expect(result.breakdown).toHaveProperty('cnae');
  });

  it('scores capital_social correctly', () => {
    expect(scoreLead({ capital_social: 2_000_000 }).breakdown.capital).toBe(50);
    expect(scoreLead({ capital_social: 600_000 }).breakdown.capital).toBe(40);
    expect(scoreLead({ capital_social: 150_000 }).breakdown.capital).toBe(30);
    expect(scoreLead({ capital_social: 60_000 }).breakdown.capital).toBe(20);
    expect(scoreLead({ capital_social: 15_000 }).breakdown.capital).toBe(10);
    expect(scoreLead({ capital_social: 500 }).breakdown.capital).toBe(2);
  });

  it('scores time active correctly', () => {
    const yearsAgo = (y: number) => new Date(Date.now() - y * 365.25 * 86400000).toISOString().slice(0, 10);

    expect(scoreLead({ data_abertura: yearsAgo(12) }).breakdown.time).toBe(20);
    expect(scoreLead({ data_abertura: yearsAgo(7) }).breakdown.time).toBe(15);
    expect(scoreLead({ data_abertura: yearsAgo(3) }).breakdown.time).toBe(10);
    expect(scoreLead({ data_abertura: yearsAgo(1) }).breakdown.time).toBe(5);
    expect(scoreLead({ data_abertura: yearsAgo(0.3) }).breakdown.time).toBe(2);
  });

  it('scores porte correctly', () => {
    expect(scoreLead({ porte: 'GRANDE' }).breakdown.porte).toBe(15);
    expect(scoreLead({ porte: 'DEMAIS' }).breakdown.porte).toBe(10);
    expect(scoreLead({ porte: 'EPP' }).breakdown.porte).toBe(8);
    expect(scoreLead({ porte: 'ME' }).breakdown.porte).toBe(5);
    expect(scoreLead({ porte: 'MEI' }).breakdown.porte).toBe(2);
  });

  it('scores premium CNAEs at max', () => {
    const marmoraria = scoreLead({ cnae: '2330300' });
    expect(marmoraria.breakdown.cnae).toBe(15);
    expect(marmoraria.factors).toContain('cnae_marmoraria');

    const pisos = scoreLead({ cnae: '4742700' });
    expect(pisos.breakdown.cnae).toBe(15);
    expect(pisos.factors).toContain('cnae_pisos');

    const construcao = scoreLead({ cnae: '4330401' });
    expect(construcao.breakdown.cnae).toBe(15);
    expect(construcao.factors).toContain('cnae_construcao');
  });

  it('scores related CNAEs at 12', () => {
    const related = scoreLead({ cnae: '4399103' });
    expect(related.breakdown.cnae).toBe(12);
    expect(related.factors).toContain('cnae_relacionado');
  });

  it('scores generic CNAEs at 3', () => {
    const generic = scoreLead({ cnae: '9999999' });
    expect(generic.breakdown.cnae).toBe(3);
    expect(generic.factors).toContain('cnae_generico');
  });

  it('never exceeds 100', () => {
    const result = scoreLead({
      capital_social: 5_000_000,
      data_abertura: '2000-01-01',
      porte: 'GRANDE',
      cnae: '2330300',
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('strips non-digits from CNAE', () => {
    const result = scoreLead({ cnae: '233.030-0' });
    expect(result.breakdown.cnae).toBe(15);
  });

  it('getTargetCnaes returns defaults', () => {
    const targets = getTargetCnaes();
    expect(targets).toContain('2330300');
    expect(targets).toContain('4742700');
    expect(targets).toContain('4330401');
  });
});
