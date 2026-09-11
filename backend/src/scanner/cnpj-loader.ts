import { getDb } from '../db/client.js';

export interface CnpjRecord {
  cnpj: string;
  razao_social: string;
  cnae: string;
  capital_social: number;
  porte: string;
  uf: string;
  municipio: string;
  bairro: string;
  ddd: string;
  telefone1: string;
  telefone2: string;
  situacao_cadastral: string;
  data_abertura: string;
}

/**
 * Extract phone numbers from a CNPJ record.
 * Returns normalized E.164 numbers (55 + DDD + number).
 */
export function extractPhones(record: CnpjRecord): string[] {
  const phones: string[] = [];

  for (const raw of [record.telefone1, record.telefone2]) {
    if (!raw) continue;

    // Normalize: remove spaces, dashes, parens, dots
    const digits = raw.replace(/[\s\-\(\)\.]/g, '');

    // Skip if too short (< 8 digits) or too long (> 13 digits with country code)
    if (digits.length < 8 || digits.length > 13) continue;

    let phone: string;

    if (digits.startsWith('55') && digits.length >= 12) {
      // Already has country code
      phone = digits;
    } else if (digits.length === 8 || digits.length === 9) {
      // Local number — need DDD from record
      phone = `55${record.ddd}${digits}`;
    } else if (digits.length === 10 || digits.length === 11) {
      // DDD + number — add country code
      phone = `55${digits}`;
    } else {
      continue;
    }

    // Validate E.164: 55 + 2 digit DDD + 8-9 digit number = 12-13 digits
    if (phone.length >= 12 && phone.length <= 13 && phone.startsWith('55')) {
      phones.push(phone);
    }
  }

  return [...new Set(phones)]; // deduplicate
}

/**
 * Load CNPJ records from the dump DB, filtered by CNAE + state + situacao.
 */
export function loadCnpjs(options: {
  cnaes?: string[];
  state?: string;
  city?: string;
  limit?: number;
  offset?: number;
} = {}): CnpjRecord[] {
  const db = getDb(process.env.CNPJ_DB_PATH);

  const conditions: string[] = ["situacao_cadastral = 'ATIVA'"];
  const params: any[] = [];

  if (options.cnaes && options.cnaes.length > 0) {
    const placeholders = options.cnaes.map(() => '?').join(',');
    conditions.push(`cnae_fiscal_principal IN (${placeholders})`);
    params.push(...options.cnaes);
  }

  if (options.state) {
    conditions.push('uf = ?');
    params.push(options.state.toUpperCase());
  }

  if (options.city) {
    conditions.push('municipio LIKE ?');
    params.push(`%${options.city}%`);
  }

  const limit = Math.min(options.limit || 1000, 10000);
  const offset = options.offset || 0;

  const sql = `
    SELECT
      cnpj,
      razao_social,
      cnae_fiscal_principal AS cnae,
      capital_social,
      porte,
      uf,
      municipio AS cidade,
      bairro,
      ddd,
      telefone1,
      telefone2,
      situacao_cadastral,
      data_abertura
    FROM empresas
    WHERE ${conditions.join(' AND ')}
    ORDER BY capital_social DESC
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);

  try {
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => ({
      cnpj: row.cnpj || '',
      razao_social: row.razao_social || '',
      cnae: row.cnae || '',
      capital_social: parseFloat(row.capital_social) || 0,
      porte: row.porte || '',
      uf: row.uf || '',
      municipio: row.cidade || '',
      bairro: row.bairro || '',
      ddd: row.ddd || '',
      telefone1: row.telefone1 || '',
      telefone2: row.telefone2 || '',
      situacao_cadastral: row.situacao_cadastral || '',
      data_abertura: row.data_abertura || '',
    }));
  } catch (err: any) {
    // Table might not exist yet — return empty
    console.warn(`[cnpj-loader] Query failed (table missing?): ${err.message}`);
    return [];
  }
}

/**
 * Count total CNPJs matching filters.
 */
export function countCnpjs(options: {
  cnaes?: string[];
  state?: string;
  city?: string;
} = {}): number {
  const db = getDb(process.env.CNPJ_DB_PATH);

  const conditions: string[] = ["situacao_cadastral = 'ATIVA'"];
  const params: any[] = [];

  if (options.cnaes && options.cnaes.length > 0) {
    const placeholders = options.cnaes.map(() => '?').join(',');
    conditions.push(`cnae_fiscal_principal IN (${placeholders})`);
    params.push(...options.cnaes);
  }

  if (options.state) {
    conditions.push('uf = ?');
    params.push(options.state.toUpperCase());
  }

  if (options.city) {
    conditions.push('municipio LIKE ?');
    params.push(`%${options.city}%`);
  }

  const sql = `SELECT COUNT(*) as total FROM empresas WHERE ${conditions.join(' AND ')}`;

  try {
    const row = db.prepare(sql).get(...params) as any;
    return row?.total || 0;
  } catch {
    return 0;
  }
}
