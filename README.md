# Blindspot Prospector

> **B2B lead mining — WhatsApp-active businesses invisible on Google Maps.**

Blindspot Prospector inverte a lógica tradicional de prospecção: em vez de buscar empresas no Google Maps e depois verificar se têm WhatsApp, ele parte da base de CNPJs, valida presença ativa no WhatsApp e confirma a **ausência** no Google Maps — encontrando o ponto cego da concorrência.

**Custo total: < R$ 30/mês.** Zero proxies. Zero serviços pagos de scraping.

---

## A Rota Invertida (Caixa-Preta)

```
CNPJ Dump (Kaggle)
       ↓
  Gerar telefones (DID blocks 0000-9999)
       ↓
  ┌──────────────────────┐
  │ WhatsApp Validation  │  ← HEAD → wa.me/{phone} + Range GET og:title
  │ ~3ms, zero custo     │     Rejeita "Compartilhar" (tela de share = sem conta)
  └──────────────────────┘
       ↓  (apenas números com WhatsApp)
  ┌──────────────────────┐
  │ Google Places Check  │  ← findPlaceFromText + fields=place_id
  │ $0.00/request        │     IDs-Only tier — binário: existe ou não
  └──────────────────────┘
       ↓  (sem presença no Google Maps)
  ┌──────────────────────┐
  │ Scorer (0-100)       │  Capital Social + Tempo + Porte + CNAE
  └──────────────────────┘
       ↓  (score ≥ 70)
  ┌──────────────────────┐
  │ Webhook → Prospectus │  Enriquecimento automático
  └──────────────────────┘
```

### Os 3 princípios da Caixa-Preta

| Princípio | Como funciona | Custo |
|-----------|---------------|-------|
| **Zero-Cost Profiling** | `HEAD https://wa.me/{phone}` retorna 200 se existe conta ativa. `GET` com `Range: bytes=0-4000` extrai `og:title` (nome do negócio) | $0.00 (~3ms por request) |
| **Abstração de Entropia** | Bombardamento numérico: blocos DID fixos (ex: `551198XXX0000`–`551198XXX9999`) + dump de CNPJs + geração procedural de sufixos | $0.00 ( CPU only) |
| **Teste Binário de 1-Bit** | Google Places `findPlaceFromText` com `fields=place_id` — retorna place_id (existe) ou vazio (não existe). Sem details, sem photos, sem custo | $0.00 (IDs-Only tier) |

---

## Quick Start

### Pré-requisitos

- Node.js 20+
- npm ou pnpm
- Dump de CNPJs (SQLite) — [Kaggle: jurandifranca/receita-federal-cnpj](https://www.kaggle.com/datasets/jurandifranca/receita-federal-cnpj) (57M+ registros, gratuito)

### Instalação

```bash
git clone https://github.com/Maycon-BertolzoDOTCOM/blindspot-prospector.git
cd blindspot-prospector
npm install
```

### Configuração

```bash
cp .env.example .env
# Edite .env com suas chaves de Google Places (mínimo 1)
```

### Rodar

```bash
# Modo desenvolvimento (API + hot reload)
npm run dev

# Acessar o painel
open http://localhost:3001
```

### Scan via CLI

```bash
# Scan completo (CNPJ → WhatsApp → Google → Leads)
npm run cli -- --vertical marmoraria --state SP --limit 1000

# Scan com filtros específicos
npm run cli -- --cnaes 2330300,4742700 --city São Paulo --limit 500
```

---

## API Reference

Todas as rotas são prefixadas com `/api`.

### Health Check

```
GET /health
```

```json
{
  "status": "ok",
  "version": "0.1.0",
  "leads": 1234,
  "scanJobs": 5,
  "uptime": 3600.5
}
```

### Leads

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/leads` | Lista leads com paginação e filtros |
| `GET` | `/api/leads/:id` | Detalhe de um lead |
| `PATCH` | `/api/leads/:id` | Atualiza status (`NEW` → `CONTACTED` → `CLOSED`) |
| `DELETE` | `/api/leads/:id` | Remove lead |

**Query params para `GET /api/leads`:**
- `page` (default: 1)
- `limit` (default: 50, max: 200)
- `status` — `NEW`, `CONTACTED`, `CLOSED`
- `minScore` — filtro por score mínimo
- `state` — UF (ex: `SP`)
- `whatsapp` — `true`/`false`
- `googlePlace` — `true`/`false`
- `search` — busca por nome/CNPJ/telefone

### Scans

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/scans` | Dispara um novo scan |
| `GET` | `/api/scans` | Lista jobs de scan |
| `GET` | `/api/scans/:id` | Detalhe de um job |

**Body para `POST /api/scans`:**

```json
{
  "vertical": "marmoraria",
  "state": "SP",
  "city": "São Paulo",
  "cnaes": ["2330300", "4742700"],
  "limit": 500
}
```

### Export

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/export/csv` | Exporta leads como CSV |
| `GET` | `/api/export/json` | Exporta leads como JSON |

**Query params:** mesmos do `/api/leads` (status, minScore, state, etc.)

### Webhook

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/webhook/prospectus` | Recebe enriquecimento do Prospectus-Kernel |
| `GET` | `/webhook/test` | Testa conectividade com Prospectus-Kernel |

---

## Sistema de Scoring (0–100)

| Critério | Pontos | Regras |
|----------|--------|--------|
| **Capital Social** | 0–50 | ≥ R$ 1M = 50pts, ≥ R$ 500K = 40pts, ≥ R$ 100K = 30pts, ≥ R$ 50K = 20pts, ≥ R$ 10K = 10pts, resto = 2pts |
| **Tempo Ativo** | 0–20 | ≥ 10 anos = 20pts, ≥ 5 anos = 15pts, ≥ 2 anos = 10pts, ≥ 1 ano = 5pts, resto = 2pts |
| **Porte** | 0–15 | Grande = 15pts, EPP/DEMAIS = 8–10pts, ME = 5pts, MEI = 2pts |
| **CNAE Premium** | 0–15 | Marmoraria/Loja de Pisos/Construção Civil = 15pts, Relacionados = 12pts, Genérico = 3pts |

**Lead qualifies when score ≥ 70** — webhook dispara automaticamente.

---

## Verticals Alvo

| Vertical | CNAE | Descrição |
|----------|------|-----------|
| Marmoraria | `2330300` | Fabricação de artigos de mármore e granito |
| Loja de Pisos | `4742700` | Comércio varejista de pisos e revestimentos |
| Construção Civil | `4330401` | Obras de alvenaria |
| Serviços de Construção | `4399103` | Serviços especializados de construção civil |
| Materiais de Construção | `4753200` | Lojas de materiais de construção |

---

## Estrutura do Projeto

```
blindspot-prospector/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── server.ts          # Express app (port 3001)
│   │   │   ├── routes/
│   │   │   │   ├── leads.ts       # CRUD de leads
│   │   │   │   ├── scans.ts       # Disparo e listagem de scans
│   │   │   │   └── export.ts      # Export CSV/JSON
│   │   │   └── webhooks/
│   │   │       └── prospectus.ts  # Webhook fire-and-forget
│   │   ├── scanner/
│   │   │   ├── cnpj-loader.ts     # Ingestão de CNPJs + extração de telefones
│   │   │   ├── whatsapp-check.ts  # Validação HEAD + og:title
│   │   │   ├── google-check.ts    # Google Places 1-bit (IDs-Only)
│   │   │   ├── scorer.ts          # Scoring 0-100
│   │   │   └── orchestrator.ts    # Pipeline completo
│   │   ├── cache/
│   │   │   └── negative-cache.ts  # Cache 30 dias (node-cache)
│   │   ├── db/
│   │   │   ├── client.ts          # better-sqlite3 singleton
│   │   │   └── schema.sql         # Schema SQLite
│   │   └── cli/
│   │       └── scan.ts            # CLI entry point
│   ├── tests/
│   │   ├── scorer.test.ts
│   │   ├── negative-cache.test.ts
│   │   ├── whatsapp-check.test.ts
│   │   ├── benchmark-whatsapp.ts
│   │   └── benchmark-google.ts
│   └── data/
│       ├── mining.db              # Leads + ScanJobs (auto-created)
│       └── cnpj.db                # Dump de CNPJs (fornecido pelo usuário)
├── frontend/
│   └── index.html                 # Painel Tailwind (Vidal)
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Configuração (.env)

| Variável | Default | Descrição |
|----------|---------|-----------|
| `GOOGLE_PLACES_KEY_1` | — | Chave API Google Places (obrigatório, mínimo 1) |
| `GOOGLE_PLACES_KEY_2` | — | Chave API Google Places (pool round-robin) |
| `GOOGLE_PLACES_KEY_3` | — | Chave API Google Places (pool round-robin) |
| `PORT` | `3001` | Porta do servidor Express |
| `CNPJ_DB_PATH` | `./data/cnpj.db` | Caminho do dump de CNPJs (SQLite) |
| `CNAE_TARGETS` | `2330300,4742700,4330401` | CNAEs-alvo separados por vírgula |
| `TARGET_STATE` | `SP` | UF alvo para pré-filtro |
| `MAX_CONCURRENT_PHONES` | `10` | Paralelismo na validação WhatsApp |
| `WHATSAPP_RATE_LIMIT_MS` | `100` | Delay entre requests WhatsApp (ms) |
| `NEGATIVE_CACHE_TTL_DAYS` | `30` | TTL do cache de números negativos |
| `PROSPECTUS_WEBHOOK_URL` | `http://localhost:8000/enrich` | URL do Prospectus-Kernel |
| `PROSPECTUS_WEBHOOK_SECRET` | — | Secret para autenticação HMAC |

---

## Tech Stack

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| **Runtime** | Node.js 20 + TypeScript 5 | Performance, type safety, ecosystem |
| **API** | Express 4 | Simplicidade, sem overhead |
| **Database** | SQLite (better-sqlite3) | Zero config, portável, WAL mode |
| **Cache** | node-cache | In-memory 30 dias, ~500K keys |
| **Concurrency** | p-limit | Controle de paralelismo |
| **HTTP** | axios | Client com timeout, interceptors |
| **Frontend** | HTML + Tailwind CDN | Zero build step, leve |
| **Tests** | vitest | Rápido, ESM-native |

---

## Roadmap

| Fase | Status | Descrição |
|------|--------|-----------|
| **Fase 0 — Foundation** | ✅ Pronto | DB schema, CNPJ loader, scaffold |
| **Fase 1 — MVP Tático** | ✅ Pronto | WhatsApp check, Google Places, scorer, orchestrator, API, frontend |
| **Fase 2 — Otimizações** | ✅ Pronto | Negative cache 30d, circuit breaker Google, benchmark sandbox |
| **Fase 3 — Integrações** | 🔜 Próximo | Prospectus-Kernel webhook, Nominatim geocoding, SQLite cache |
| **Deploy** | ⏳ Futuro | Hosting, domínio, .env produção |

---

## Benchmarks

```bash
# Benchmark WhatsApp (compara métodos de validação)
npm run benchmark:whatsapp

# Benchmark Google Places (custo e latência)
npm run benchmark:google
```

**Resultados esperados:**
- WhatsApp HEAD: ~3ms por request, zero custo
- WhatsApp Range + og:title: ~5-10ms, extrai nome do negócio
- Google Places IDs-Only: ~200ms, $0.00/request

---

## Custos Estimados

| Item | Custo/mês | Notas |
|------|-----------|-------|
| Google Places API | $0.00 | IDs-Only tier: 1000 requests grátis/dia |
| CNPJ dump | $0.00 | Kaggle, gratuito |
| WhatsApp validation | $0.00 | wa.me HEAD/GET, sem proxy |
| Hosting | ~R$ 15-30 | VPS básica ou Railway/Render |
| **Total** | **< R$ 30** | |

## Licença

MIT
