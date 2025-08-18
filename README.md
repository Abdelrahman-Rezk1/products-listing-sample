# Zoho Products Demo (NestJS)

A minimal, production‑minded demo that shows how to:

- Authorize with **Zoho OAuth 2.0** and store tokens in cookies/DB
- Perform **CRUD on Zoho CRM Products** via the Records API
- Mirror Zoho records into a local database using **TypeORM**
- Expose clean REST endpoints with **Swagger** docs

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
│  ├─ ProductsService (calls Zoho using access token; mirrors to DB)
│  └─ ProductsController (extracts cookies → passes Zoho ctx)
├─ Config (Joi-validated env; zoho.config.ts, db.config.ts)
└─ TypeORM (Postgres by default; synchronize=true for dev)
```

**Token model**

- `zoho_access_token` → **HttpOnly** cookie (short‑lived)
- `zoho_api_domain` → HttpOnly cookie (so requests target the correct Zoho DC)
- `refresh_token` → **server-side only** (DB), not in cookies

> In dev, we simplify by setting only `zoho_access_token` and `zoho_api_domain` cookies; you can extend the callback to persist `refresh_token`.

---

## 2) Prerequisites

- **Node.js 18+** (native `fetch`)
- **PostgreSQL** (or adjust `DB_TYPE`/options for MySQL)
- A **Zoho account** with access to Zoho CRM and permission to create an OAuth client

---

## 3) Environment Variables (.env)

Create a `.env` file in the project root. All vars are validated at startup via **Joi**.

```bash
# --- Zoho ---
ZOHOSA_ACCOUNTS=https://accounts.zoho.sa           # Your Accounts domain (KSA example)
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
# Optional: DB_SYNC=true | false (defaults true in db.config.ts)
```

### Multi‑DC note

If you serve users in multiple Zoho data centers (US/EU/IN/SA/etc.), always use the `api_domain` returned by Zoho for API calls and consider starting auth on `https://accounts.zoho.com` to discover the user’s DC. This demo assumes `.sa` for simplicity.

---

## 4) Install & Run

```bash
# 1) Install deps
pnpm install

# 2) Run in dev (http://localhost:3000)
pnpm run start:dev
```

In `main.ts`, ensure **cookie‑parser** is enabled:

```ts
import * as cookieParser from 'cookie-parser';
app.use(cookieParser());
```

Swagger UI is typically served at **`/api`** (e.g., `http://localhost:3000/api`).

---

## 5) Configure Zoho OAuth Client

1. Open Zoho **API Console** (region‑specific, e.g., `api-console.zoho.sa`).
2. **Add Client** → type **Server‑based**.
3. Set **Authorized Redirect URI** to your value (e.g., `http://localhost:3000/auth/zoho/callback`).
4. Copy **Client ID** and **Client Secret** into your `.env`.
5. Use scopes from the `.env` above (Products CRUD + fields).

> In dev you can also register `http://localhost:3000` origins/URIs.

---

## 6) OAuth Flow (Swagger‑friendly)

Because Swagger cannot follow cross‑origin redirects, the demo provides two ways to begin auth:

### A) Swagger‑friendly (returns URL as JSON)

1. Open **GET `/auth/zoho`** in Swagger.
2. Provide a `state` (e.g., `dev-state`).
3. **Execute** → copy the returned `url`.
4. Paste the URL in a **new browser tab** and complete Zoho login/consent.
5. Zoho redirects to `ZOHO_REDIRECT_URI` (your `/auth/zoho/callback`), which sets:
   - `zoho_access_token` (HttpOnly cookie)
   - optionally `zoho_api_domain` (HttpOnly cookie)

### B) Direct browser redirect

- Navigate to **`/auth/zoho/redirect?state=dev-state`** in your browser to jump straight to Zoho (not recommended from Swagger).

> Security: for production, re‑enable CSRF‐safe `state` cookie validation. The simplified dev flow treats `state` as a normal query param.

---

## 7) Products API (local mirror → Zoho)

The controller extracts cookies and passes a **Zoho auth context** to the service. The service:

- Calls Zoho **/crm/v8/Products** endpoints with `Authorization: Zoho-oauthtoken <access>`
- Mirrors the created/updated product to the local DB (stores `zohoId`)

### Endpoints

- `POST /products` → Create in Zoho, then save locally
- `PATCH /products/:id` → Update in Zoho (if linked), then update locally
- `GET /products/:id` → Read local product by UUID
- `GET /products` → Paginated local list
- `DELETE /products/:id` → Delete from Zoho (if linked), then remove locally

### DTOs & Mapping

- Local create/update DTOs: `CreateProductDTO`, `UpdateProductDTO`
- Zoho payload DTOs: `ZohoProductRecordDto`, `ZohoProductPayloadDto`
- Mapping (example): `name → Product_Name`, `unitPrice → Unit_Price`, `qtyInStock → Qty_in_Stock`, etc.

---

## 8) Running the Demo (Quick Path)

1. **Fill `.env`** (Zoho + DB)
2. **Start DB** (e.g., Postgres) and ensure the credentials match your `.env`.
3. `npm run start:dev`
4. Open **Swagger** → **GET `/auth/zoho`** with `state=dev-state` → copy URL → open in a new tab → approve.
5. After callback sets cookies, call:
   - **POST `/products`** with body:

     ```json
     {
       "name": "Wireless Keyboard",
       "description": "Slim 2.4GHz wireless keyboard",
       "unitPrice": 49.99,
       "sku": "KB-123",
       "qtyInStock": 100
     }
     ```

   - Observe created record mirrored with a `zohoId`.

> If you test with a REST client instead of a browser, include the cookies manually:
> `Cookie: zoho_access_token=...; zoho_api_domain=...`

---

## 9) Troubleshooting

- **`invalid_redirect_uri`** → Ensure the redirect URI in the console **exactly** matches `.env` and the authorize request.
- **Swagger shows “Failed to fetch”** on `/auth/zoho/redirect` → Use the Swagger‑friendly `GET /auth/zoho` flow.
- **401 from Zoho** → Access token expired or missing cookie. Re‑run the OAuth step. In prod, store `refresh_token` and implement refresh.
- **Wrong API base** → Always use the **`api_domain`** returned by Zoho (cookie `zoho_api_domain`).
- **DB schema** → The demo sets `synchronize=true` for convenience. For prod, turn off and use migrations.

---

## 10) Production Checklist

- [ ] Use HTTPS; set cookies with `Secure`, appropriate `SameSite`.
- [ ] Validate **CSRF state** with a server‑side cookie or signed state (JWT), not a bare query string.
- [ ] Persist **refresh_token** per user/tenant and implement refresh on 401.
- [ ] Handle Zoho rate limits and 429/5xx retries with backoff.
- [ ] Replace `synchronize=true` with migrations; restrict DB credentials.
- [ ] Add request logging and structured error handling for Zoho API failures.

---
