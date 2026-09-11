-- Blindspot Prospector schema

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  business_name TEXT,
  city TEXT,
  state TEXT,
  cnae TEXT,
  capital_social REAL,
  porte TEXT,
  has_whatsapp INTEGER NOT NULL DEFAULT 0,
  has_google_place INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','CONTACTED','CLOSED')),
  source TEXT NOT NULL DEFAULT 'cnpj_dump',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads(has_whatsapp);
CREATE INDEX IF NOT EXISTS idx_leads_google ON leads(has_google_place);
CREATE INDEX IF NOT EXISTS idx_leads_cnae ON leads(cnae);
CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state);

CREATE TABLE IF NOT EXISTS scan_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vertical TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT,
  cnae_filter TEXT,
  total_cnpjs INTEGER NOT NULL DEFAULT 0,
  phones_generated INTEGER NOT NULL DEFAULT 0,
  whatsapp_valid INTEGER NOT NULL DEFAULT 0,
  google_found INTEGER NOT NULL DEFAULT 0,
  leads_created INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS negative_cache (
  phone TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- TTL index for negative cache cleanup
CREATE INDEX IF NOT EXISTS idx_negative_cache_checked ON negative_cache(checked_at);
