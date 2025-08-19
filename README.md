# Zoho Products Demo (NestJS) + Algolia Search

A minimal, production‑minded demo that shows how to:

- Authorize with **Zoho OAuth 2.0** and store tokens in cookies/DB
- Perform **CRUD on Zoho CRM Products** via the Records API
- Mirror Zoho records into a local database using **TypeORM**
- Expose clean REST endpoints with **Swagger** docs
- **NEW:** Full‑text product search with **Algolia v5** (indexing on CRUD, faceting, pagination, optional AI features)

---

## 0) What’s New (Algolia)

- **AlgoliaModule**: global module that provides an Algolia **v5 client** and centralized **index names** via DI tokens.
- **ProductsIndexer**: maps the `Product` entity → Algolia record; supports `configure`, `upsert`, `remove`, and `search`. Uses v5 methods (`saveObject`, `searchSingleIndex`, `setSettings({ indexSettings })`).
- **ProductsService**: calls indexer on **create/update/delete** (best‑effort; DB+Zoho remain source of truth).
- **ProductsController**: `GET /products/search` with **`q`**, **pagination** (`page`, `limit`).
- **Index settings**: `searchableAttributes` (`name`, `manufacturer`, `sku`, `code`, `description`) and `attributesForFaceting` (e.g., `inStock`, `filterOnly(sku)`).

---

## 1) Architecture Overview

```
client (Swagger UI / browser)
    ↕ cookies (zoho_access_token, zoho_api_domain)
NestJS
├─ AuthModule
│  ├─ AuthService (OAuth authorize, token exchange/refresh)
│  └─ AuthController (/auth/zoho, /auth/zoho/redirect, /auth/zoho/callback)
├─ ProductsModule
│  ├─ ProductsService (Zoho CRUD + local mirror + Algolia sync)
│  ├─ ProductsIndexer (Algolia v5: configure/upsert/remove/search)
│  └─ ProductsController (extract cookies → pass Zoho ctx; adds /products/search)
├─ Algolia (infra)
│  └─ AlgoliaModule (provides Algolia client + index names)
└─ Config (Joi‑validated env; zoho.config.ts, algolia.config.ts, db.config.ts)
```

**Token model**

- `zoho_access_token` → **HttpOnly** cookie (short‑lived)
- `zoho_api_domain` → HttpOnly cookie (so requests target the correct Zoho DC)
- `refresh_token` → **server‑side only** (DB), not in cookies

> In dev, we simplify by setting only `zoho_access_token` and `zoho_api_domain` cookies; you can extend the callback to persist `refresh_token`.

---

## 2) Prerequisites

- **Node.js 18+** (native `fetch`)
- **PostgreSQL** (or adjust `DB_TYPE`/options for MySQL)
- A **Zoho account** with access to Zoho CRM and permission to create an OAuth client
- An **Algolia application** (App ID + **Write** key; **Search** key optional for server calls)

---

## 3) Environment Variables (.env)

Create a `.env` file in the project root. All vars are validated at startup via **Joi**.

```bash
# --- Zoho ---
ZOHOSA_ACCOUNTS=https://accounts.zoho.sa
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REDIRECT_URI=http://localhost:3000/auth/zoho/callback
ZOHO_SCOPES=ZohoCRM.modules.products.ALL,ZohoCRM.settings.fields.READ

# --- Database (Postgres example) ---
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_DATABASE=products

# --- Algolia ---
ALGOLIA_APP_ID=YourAppID
ALGOLIA_APP_NAME=shop               # used for index naming
ALGOLIA_WRITE_KEY=xxxxx_write       # server‑side only
ALGOLIA_SEARCH_KEY=xxxxx_search     # optional; server search or Recommend API
# Optional explicit names; otherwise auto‑named: <env>_<app>_<domain>_<v>
ALGOLIA_PRODUCTS_INDEX=dev_shop_products_v1
ALGOLIA_ORDERS_INDEX=dev_shop_orders_v1
```

> **Validation tip:** use `Joi.string().required().min(1)` (or `.not().empty()`) for env vars to avoid empty values.

---

## 4) Install & Run

```bash
# 1) Install deps
pnpm install

# 2) Run in dev (http://localhost:3000)
pnpm run start:dev
```

In `main.ts`, make sure **cookie‑parser** is enabled:

```ts
import * as cookieParser from 'cookie-parser';
app.use(cookieParser());
```

Swagger UI is typically served at **`/api`**.

---

## 5) Configure Zoho OAuth Client

1. Open Zoho **API Console** (region‑specific).
2. **Add Client** → type **Server‑based**.
3. Set **Authorized Redirect URI** to `ZOHO_REDIRECT_URI`.
4. Copy **Client ID** and **Client Secret** into your `.env`.
5. Use the scopes from the `.env`.

Multi‑DC note: use the `api_domain` returned by Zoho; this demo assumes `.sa` for simplicity.

---

## 6) Algolia Integration

### 6.1 Module & Config

- `algolia.config.ts` exposes `appID`, `appName`, `writeKey`, `searchKey` via `registerAs('algolia')`.
- `AlgoliaModule` (global) provides:
  - `ALGOLIA_CLIENT`: v5 client from `algoliasearch(appID, writeKey)`.
  - `ALGOLIA_INDEX_NAMES`: centralized `{ products }` index names (explicit via env or auto‑named `env_app_domain_vX`).

**Why global?** Client is shared infra; each domain keeps its own mapping/indexing logic.

### 6.2 ProductsIndexer (v5)

- `configure()` sets relevance & facets:
  - `searchableAttributes`: `['name','manufacturer','sku','code','description']`
  - `attributesForFaceting`: `['inStock','filterOnly(sku)','filterOnly(zohoId)','searchable(manufacturer)']`

- `upsert(product)`: uses `saveObject({ indexName, body })` with a clean mapping (`unitPrice` numeric, derived `inStock`).
- `remove(id)`: `deleteObject({ indexName, objectID })`
- `search(q, page, hitsPerPage)`: `searchSingleIndex({ indexName, searchParams })`

> **v5 differences:** No `initIndex`; use top‑level client methods: `setSettings({ indexSettings })`, `saveObject(s)`, `searchSingleIndex`, etc.

### 6.3 Service/Controller Changes

- **ProductsService**: after DB+Zoho success, calls `indexer.upsert`. On delete, calls `indexer.remove`.
- **ProductsController**: new endpoint

```
GET /products/search?q=<text>&page=<1-based>&limit=<n>
```

**Pagination:** API is 1‑based; Algolia is 0‑based (we translate internally).

**How `q` works:** free‑text across `searchableAttributes` with prefix/typo tolerance and attribute priority. Use **filters** (not `q`) for structured constraints (e.g., `inStock:true`).

### 6.4 Recommended: Algolia AI Features

- **NeuralSearch**: hybrid semantic + keyword. Enable in dashboard; add `mode: 'neuralSearch'` to `searchParams` or set as default.
- **Dynamic Re‑Ranking**: boosts top results using **Insights** (click/conversion) events. Requires sending events from your UI.
- **AI Synonyms**: dashboard suggests synonyms; you review/accept.
- **Recommend**: related/bought‑together/trending via the Recommend API.

> Start with NeuralSearch + Insights for the biggest wins with minimal code.

---

## 7) API Summary (Products)

- `POST /products` → Create in Zoho, save locally, **index** in Algolia
- `PATCH /products/:id` → Update in Zoho (if linked), update locally, **re‑index**
- `DELETE /products/:id` → Delete in Zoho (if linked), remove locally, **delete from Algolia**
- `GET /products/:id` → Read local product by UUID
- `GET /products` → Paginated local list
- `GET /products/search` → **Algolia search** with `q`, `page`, `limit`

**Auth cookies required** for Zoho‑touching routes: `zoho_access_token`, `zoho_api_domain`.

---

## 8) Testing / Sample Data

### 8.1 Example payloads

See `products/test-data.json` (10 products)

### 8.2 Example search

```
GET /products/search?q=mouse&page=1&limit=20
```

**Response highlights**

- `hits`: matching products
- `_highlightResult`: HTML‑escaped highlights for display
- `page`, `hitsPerPage`, `nbHits`

---

## 9) Pros & Cons of Algolia (for this app)

**Pros**

- Excellent default search UX: fast, typo‑tolerant, prefix matching, attribute weighting.
- Strong faceting/filtering for “shop‑style” UIs.
- Optional AI features (NeuralSearch, re‑ranking, Recommend) that compound value with traffic.
- Hosted, multi‑region infra → low ops burden.

**Cons**

- Pricing/plan limits (records, operations, record size). Keep records lean and monitor usage.
- Denormalization required (no joins): you must shape search‑ready docs.
- AI features require **Insights events** for best results.
- Vendor‑specific query model & features (lock‑in to Algolia semantics).
- v5 API shape differs from v4, requires updated method calls.

---

## 10) Production Checklist

- [ ] HTTPS; cookies `Secure`, proper `SameSite`.
- [ ] Validate **CSRF state** with a server‑side cookie/signed state.
- [ ] Persist and rotate Zoho **refresh_token**; implement token refresh.
- [ ] Handle Zoho rate limits (429) and transient 5xx with retries/backoff.
- [ ] Replace `synchronize=true` with migrations; least‑privilege DB creds.
- [ ] Algolia: protect **Write key**, only use **Search key** on client; consider **secured API keys** for per‑user filtering.
- [ ] Emit **Insights** (click/conversion) to enable AI re‑ranking/recommendations.
- [ ] Monitor index size/ops; trim oversized attributes, store media as URLs.
