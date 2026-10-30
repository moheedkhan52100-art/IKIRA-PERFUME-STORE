# IKIRA Perfume Store

IKIRA is a React/Vite storefront with an Express API and MongoDB-backed catalog,
cart checkout, cash-on-delivery orders, and protected order management.

## Local development

Use Node.js 24. In Windows PowerShell, use `npm.cmd` if the execution policy
blocks `npm.ps1`.

1. Install dependencies from `frontend` and `backend`:

   ```powershell
   Set-Location frontend
   npm.cmd install
   Set-Location ..\backend
   npm.cmd install
   ```

2. Keep the existing `backend/.env` if one is already configured. Otherwise,
   copy `backend/.env.example` to `backend/.env`, then replace the MongoDB URI
   placeholder with the Atlas connection string. Never put production secrets
   in `.env.example`, frontend source, or any `VITE_*` variable.

3. Add local admin credentials and a separate customer session secret to
   `backend/.env`. Use a random secret of at least 32 characters for customer
   sessions. To enable order email notifications, first create a Brevo SMTP
   key and verify a sender address with Brevo. In Brevo, use the SMTP login and
   SMTP key (not your account password or an API key). Configure all SMTP
   settings together:

   ```dotenv
   ADMIN_USERNAME=your-admin-name
   ADMIN_PASSWORD=use-a-unique-password-of-at-least-16-characters
   ADMIN_SESSION_SECRET=use-a-random-secret-of-at-least-32-characters
   CUSTOMER_SESSION_SECRET=use-another-random-secret-of-at-least-32-characters
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-brevo-smtp-login
   SMTP_PASSWORD=your-brevo-smtp-key
   SMTP_FROM=your-verified-sender@example.com
   STORE_NOTIFICATION_EMAIL=the-inbox-that-should-receive-order-alerts@example.com
   ```

   Never paste the SMTP key into source code or chat; keep it only in the
   ignored `backend/.env` file or your hosting provider's secret store. Admin
   settings are required to sign into `/admin`. SMTP settings must be provided
   together; without them, new orders are saved and their store email
   notification remains queued. After saving them, restart the API and check
   `/api/health` for `"notifications":"ready"`. In production, valid MongoDB,
   admin, SMTP, and non-local browser-origin settings are required before the
   API starts.

4. Start the API and frontend in separate terminals:

   ```powershell
   # backend
   npm.cmd run dev

   # frontend
   Set-Location ..\frontend
   npm.cmd run dev
   ```

5. Open the storefront at `http://localhost:5173`. Open
   `http://localhost:5173/admin` to sign in to the protected admin dashboard.
   It includes order processing, searchable and filterable catalog management
   with per-size prices and stock, product audience categories, collections,
   fragrance families, bottle sizes, concentrations, and visibility controls,
   customer summaries, storefront links, catalog
   rating summaries, and a persistent admin activity log. Individual review
   moderation and browser-editable store credentials are not available in the
   current data model. Use the theme
   control in the storefront header or admin dashboard to switch between
   light and dark appearance; the preference is saved in the browser.
   Seed the demo catalog only when desired with `npm.cmd run seed:products` in
   `backend`.

The API defaults to port 5000. If the frontend and API use different origins,
set `CLIENT_ORIGINS` in `backend/.env` to the exact frontend origins. The API
URL can be set in `frontend/.env` as `VITE_API_BASE_URL`; it must include `/api`.

## Orders and notifications

- Guest orders use cash on delivery and free delivery.
- The API calculates prices, checks inventory, reserves stock, and saves each
  order transactionally. An idempotency key protects retries from creating
  duplicate orders.
- Admins can add, replace, preview, or remove a product's JPEG, PNG, or WebP
  image (up to 5 MB). Images are stored in MongoDB Atlas GridFS and displayed
  on storefront cards and product pages.
- Admin product edits support separate prices for each size, plus the For Her,
  For Him, and Unisex audience categories. Collections, families, bottle sizes,
  and concentrations can be selected from existing catalog values or added by
  entering a new value; storefront filter choices update from active products.
- Admins can create and delete custom product categories from the Categories
  section. Built-in audience categories remain available; a custom category
  cannot be deleted while any product is assigned to it.
- Bottle sizes can only be removed after stock is zero and no placed or
  confirmed order references that size.
- The admin activity log records product creation and edits, visibility and
  image changes, and order status changes.
- Admin sessions use signed, HTTP-only cookies. Order APIs enforce the session
  and allowlisted request origins. Do not share admin credentials.
- Order status transitions are validated. Cancelling a placed or confirmed
  order restores its reserved stock in the same MongoDB transaction.
- Store email alerts are written with each order and sent asynchronously.
  Temporary SMTP failures are recorded and retried with increasing delays.
  Cancelled orders are excluded from pending notification delivery.
- Atlas must support MongoDB transactions (a replica set or sharded cluster).

## Production deployment

Deployment configuration is platform-neutral because no hosting provider or
domain has been selected. The frontend and backend can be deployed separately,
but the browser app and API should share the same site (for example,
`shop.example.com` and `api.example.com`) for the HTTP-only `SameSite=Strict`
admin cookie to work.

### Backend service

- Build step: no compile step is required.
- Start command: `npm start` from `backend`.
- Set Node.js 24 and a provider-assigned `PORT`.
- Configure these server-side variables in the hosting provider's secret store:
  `NODE_ENV=production`, `MONGODB_URI`, `CLIENT_ORIGINS`, `ADMIN_USERNAME`,
  `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET`,
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`,
  `SMTP_FROM`, and `STORE_NOTIFICATION_EMAIL`.
- Use a unique admin password of at least 16 characters and a random session
  secret of at least 32 characters. Generate a secret locally with:

  ```powershell
  node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
  ```

- Configure Atlas network access for the backend host's outbound addresses.
  Do not use an unrestricted database network rule for production.
- Use `/api/health` for liveness and `/api/health/ready` for readiness. Readiness
  returns `503` until MongoDB, admin and customer authentication, and order
  email alerts are configured.

### Frontend static site

- Build command: `npm ci && npm run build` from `frontend`.
- Publish directory: `frontend/dist`.
- Set `VITE_API_BASE_URL` at build time to the public API URL ending in `/api`.
- Set the backend `CLIENT_ORIGINS` to the exact deployed frontend origin.
- Configure the host to rewrite unknown application paths (including `/admin`)
  to `index.html` so direct links and reloads continue to work.

### Before launch

1. Set production secrets and confirm `/api/health/ready` returns `200`.
2. Confirm the production frontend origin is allowed by the API and the cookie
   works across the selected same-site hostnames.
3. Run `npm test` in `backend`, then `npm run lint` and `npm run build` in
   `frontend`.
4. Verify catalog, admin login, order status changes, cancellation inventory
   restoration, and a real SMTP delivery using an explicitly designated test
   order and test inventory. Do not use customer orders for deployment tests.

The project is deployment-ready but has not been deployed: provider accounts,
domains, Atlas network rules, SMTP credentials, and a deliberately safe live
test order must be supplied/configured by the store owner.
