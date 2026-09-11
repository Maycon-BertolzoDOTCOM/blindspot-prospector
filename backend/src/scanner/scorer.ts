/**
 * Lead scoring — 0 to 100.
 *
 * Criteria:
 * - Capital Social (50pts): higher capital = more established
 * - Time active (20pts): years since opening
 * - Porte (15pts): MEI < PE < ME < EPP < Grande
 * - CNAE Premium (15pts): target verticals get max score
 */

const CNAE_PREMIUM = new Set([
  '2330300',  // Marmoraria
  '4742700',  // Loja de pisos/revestimentos
  '4330401',  // Construção civil
  '4399103',  // Serviços de construção civil
  '4399199',  // Outros serviços especializados
  '4753200',  // Loja de materiais de construção
]);

const PORTE_SCORES: Record<string, number> = {
  'MEI': 2,
  'ME': 5,
  'EPP': 8,
  'DEMAIS': 10,
  'GRANDE': 15,
};

export interface ScoringInput {
  capital_social?: number;
  data_abertura?: string;
  porte?: string;
  cnae?: string;
  has_whatsapp?: boolean;
  has_google_place?: boolean;
}

export interface ScoringOutput {
  score: number;
  breakdown: {
    capital: number;
    time: number;
    porte: number;
    cnae: number;
  };
  factors: string[];
}

/**
 * Score a lead from 0 to 100.
 */
export function scoreLead(input: ScoringInput): ScoringOutput {
  const factors: string[] = [];
  let capital = 0;
  let time = 0;
  let porte = 0;
  let cnaeScore = 0;

  // === Capital Social (50pts) ===
  const cs = input.capital_social || 0;
  if (cs >= 1_000_000) {
    capital = 50;
    factors.push('capital_alto');
  } else if (cs >= 500_000) {
    capital = 40;
    factors.push('capital_medio_alto');
  } else if (cs >= 100_000) {
    capital = 30;
    factors.push('capital_medio');
  } else if (cs >= 50_000) {
    capital = 20;
    factors.push('capital_baixo_medio');
  } else if (cs >= 10_000) {
    capital = 10;
    factors.push('capital_baixo');
  } else {
    capital = 2;
    factors.push('capital_minimo');
  }

  // === Time active (20pts) ===
  if (input.data_abertura) {
    try {
      const opened = new Date(input.data_abertura);
      const yearsDiff = (Date.now() - opened.getTime()) / (365.25 * 86400000);

      if (yearsDiff >= 10) {
        time = 20;
        factors.push('empresa_estabelecida');
      } else if (yearsDiff >= 5) {
        time = 15;
        factors.push('empresa_madura');
      } else if (yearsDiff >= 2) {
        time = 10;
        factors.push('empresa_jovem');
      } else if (yearsDiff >= 1) {
        time = 5;
        factors.push('empresa_nova');
      } else {
        time = 2;
        factors.push('empresa_recente');
      }
    } catch {
      time = 5;
    }
  }

  // === Porte (15pts) ===
  const porteRaw = (input.porte || '').toUpperCase().trim();
  porte = PORTE_SCORES[porteRaw] || 5;
  if (porte >= 10) factors.push('porte_grande');
  else if (porte >= 5) factors.push('porte_medio');
  else factors.push('porte_pequeno');

  // === CNAE Premium (15pts) ===
  const cnae = (input.cnae || '').replace(/\D/g, '');
  if (CNAE_PREMIUM.has(cnae)) {
    cnaeScore = cnae === '2330300' ? (factors.push('cnae_marmoraria'), 15)
      : cnae === '4742700' ? (factors.push('cnae_pisos'), 15)
      : cnae === '4330401' ? (factors.push('cnae_construcao'), 15)
      : (factors.push('cnae_relacionado'), 12);
  } else {
    cnaeScore = 3;
    factors.push('cnae_generico');
  }

  const score = Math.min(100, capital + time + porte + cnaeScore);

  return {
    score,
    breakdown: { capital, time, porte, cnae: cnaeScore },
    factors,
  };
}

/**
 * Get default CNAE targets from env or fallback.
 */
export function getTargetCnaes(): string[] {
  const raw = process.env.CNAE_TARGETS || '2330300,4742700,4330401';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
