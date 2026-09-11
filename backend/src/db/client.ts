import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (_db) return _db;

  const resolvedPath = dbPath || process.env.CNPJ_DB_PATH || './data/mining.db';
  _db = new Database(resolvedPath);

  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('cache_size = -64000'); // 64MB
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');

  // Init schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  _db.exec(schema);

  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
