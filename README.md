# Atlas Product Hub

A complete sellable-product hub for downloadable FiveM website products.

## Stack
- Frontend: static HTML/CSS/vanilla JS, upload `/frontend` to cPanel `public_html`
- Backend: Node.js Express, deploy `/backend` to Railway
- Database: PostgreSQL, run `/database/schema.sql`

## Setup

### 1. Database
Create a PostgreSQL database on Railway. Open the SQL console and run:

```sql
-- paste database/schema.sql here
```

### 2. Backend
```bash
cd backend
npm install
cp ../.env.example .env
# Fill DATABASE_URL, JWT_SECRET, CORS_ORIGIN, and admin seed values
npm run db:seed-admin
npm start
```

Railway start command:
```bash
npm start
```

### 3. Frontend
Upload the contents of `/frontend` to cPanel.

Edit `/frontend/assets/js/config.js` and replace:
```js
http://localhost:3000
```
with your Railway backend URL, or run this once in the browser console:
```js
localStorage.setItem('ATLAS_API_BASE', 'https://your-backend.up.railway.app')
```

## License Verification API
Your sold product backends should call:

```http
POST /api/license/verify
Content-Type: application/json
```

Request:
```json
{
  "license_key": "ATLAS-XXXXXX-XXXXXX-XXXXXX-XXXXXX",
  "product_id": "atlas-cad",
  "domain": "customer-domain.com",
  "ip": "1.2.3.4",
  "version": "1.0.0"
}
```

Response:
```json
{
  "valid": true,
  "reason": "valid",
  "product": { "id": "atlas-cad", "name": "Atlas CAD Website", "version": "1.0.0" },
  "activation_status": "created",
  "max_activations": 1,
  "current_activations": 1
}
```

## Included Pages

Public:
- Home
- Products
- Product details
- Login
- Register

Customer:
- Dashboard
- My Licenses
- Activations
- Downloads
- Marketplace
- Invoices
- Support
- Tools
- Account settings

Admin:
- Admin dashboard
- Manage products
- Manage customers
- Manage licenses
- Generate license keys
- Revoke/disable licenses via API endpoint
- Manage downloads
- View activations
- View invoices

## Important API Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/products`
- `GET /api/customer/summary`
- `GET /api/customer/licenses`
- `GET /api/customer/downloads`
- `GET /api/admin/summary`
- `POST /api/admin/products`
- `POST /api/admin/licenses/generate`
- `PATCH /api/admin/licenses/:id/status`
- `POST /api/license/verify`

## Next Production Upgrades
This is ready to run as a strong MVP. Before selling at scale, add payment-provider webhooks, server-side ZIP streaming, email delivery, password reset, and polished CRUD modals for every admin table.
