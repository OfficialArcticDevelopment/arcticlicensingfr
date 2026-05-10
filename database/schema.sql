CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(180) UNIQUE NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Website',
  type VARCHAR(80) NOT NULL DEFAULT 'Digital Product',
  price_cents INTEGER NOT NULL DEFAULT 0,
  short_description TEXT,
  description TEXT,
  image_url TEXT,
  version VARCHAR(40) NOT NULL DEFAULT '1.0.0',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key VARCHAR(80) UNIQUE NOT NULL,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','disabled','expired')),
  max_activations INTEGER NOT NULL DEFAULT 1,
  domain_lock TEXT,
  ip_lock TEXT,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  domain TEXT,
  ip TEXT,
  version VARCHAR(40),
  fingerprint TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','revoked')),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (license_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version VARCHAR(40) NOT NULL DEFAULT '1.0.0',
  file_name VARCHAR(220) NOT NULL,
  file_url TEXT NOT NULL,
  changelog TEXT,
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(80) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  product_id VARCHAR(64) REFERENCES products(id) ON DELETE SET NULL,
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','pending','refunded','cancelled')),
  provider VARCHAR(60) DEFAULT 'manual',
  provider_reference VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  priority VARCHAR(30) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(140) NOT NULL,
  target_type VARCHAR(80),
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_product ON licenses(product_id);
CREATE INDEX IF NOT EXISTS idx_activations_license ON license_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_downloads_product ON downloads(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);

INSERT INTO products (id, name, slug, category, type, price_cents, short_description, description, image_url, version, status)
VALUES
('atlas-cad', 'Atlas CAD Website', 'atlas-cad-website', 'CAD', 'Website Files', 7999, 'Modern FiveM CAD website starter package.', 'A sellable CAD website product with polished dark UI, responsive pages, and license verification support.', '../assets/img/product-placeholder.svg', '1.0.0', 'active'),
('atlas-community', 'Atlas Community Hub', 'atlas-community-hub', 'Community', 'Website Files', 5999, 'Full FiveM community website hub.', 'A professional server hub for departments, applications, rules, staff, announcements, and server information.', '../assets/img/product-placeholder.svg', '1.0.0', 'active'),
('atlas-deptpanel', 'Atlas Department Panel', 'atlas-department-panel', 'Department', 'Website Files', 6999, 'Department management dashboard for FiveM servers.', 'Manage rosters, trainings, applications, subdivisions, announcements, and department documents.', '../assets/img/product-placeholder.svg', '1.0.0', 'active')
ON CONFLICT (id) DO NOTHING;
