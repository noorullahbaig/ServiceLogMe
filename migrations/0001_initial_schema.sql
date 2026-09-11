PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'MYR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kuala_Lumpur',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  job_title TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  mobile TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, employee_id),
  UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_position TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  office TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_notes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'COMPLETED')),
  revision INTEGER NOT NULL DEFAULT 0,
  job_title TEXT NOT NULL DEFAULT '',
  job_description TEXT NOT NULL DEFAULT '',
  work_performed TEXT NOT NULL DEFAULT '',
  result_remarks TEXT NOT NULL DEFAULT '',
  additional_notes TEXT NOT NULL DEFAULT '',
  service_date TEXT NOT NULL DEFAULT '',
  service_time TEXT NOT NULL DEFAULT '',
  person_in_charge_id TEXT NOT NULL REFERENCES profiles(id),
  person_in_charge_name_snapshot TEXT NOT NULL DEFAULT '',
  person_in_charge_job_title_snapshot TEXT NOT NULL DEFAULT '',
  person_in_charge_employee_id_snapshot TEXT NOT NULL DEFAULT '',
  customer_id TEXT REFERENCES customers(id),
  customer_name_snapshot TEXT NOT NULL DEFAULT '',
  contact_name_snapshot TEXT NOT NULL DEFAULT '',
  contact_position_snapshot TEXT NOT NULL DEFAULT '',
  contact_mobile_snapshot TEXT NOT NULL DEFAULT '',
  contact_office_snapshot TEXT NOT NULL DEFAULT '',
  contact_email_snapshot TEXT NOT NULL DEFAULT '',
  customer_address_snapshot TEXT NOT NULL DEFAULT '',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('PAID', 'UNPAID')),
  payment_method TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  payment_reference TEXT NOT NULL DEFAULT '',
  payment_remarks TEXT NOT NULL DEFAULT '',
  labor_total TEXT NOT NULL DEFAULT '0',
  material_total TEXT NOT NULL DEFAULT '0',
  additional_charge_total TEXT NOT NULL DEFAULT '0',
  subtotal TEXT NOT NULL DEFAULT '0',
  discount_amount TEXT NOT NULL DEFAULT '0',
  tax_rate TEXT NOT NULL DEFAULT '0',
  tax_amount TEXT NOT NULL DEFAULT '0',
  grand_total TEXT NOT NULL DEFAULT '0',
  signer_name_draft TEXT,
  signer_position_draft TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (organization_id, service_number)
);

CREATE TABLE IF NOT EXISTS labor_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL REFERENCES service_notes(id) ON DELETE CASCADE,
  employee_id TEXT,
  name TEXT NOT NULL,
  classification TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT '0',
  rate TEXT NOT NULL DEFAULT '0',
  notes TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS material_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL REFERENCES service_notes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  part_number TEXT NOT NULL DEFAULT '',
  quantity TEXT NOT NULL DEFAULT '0',
  unit_amount TEXT NOT NULL DEFAULT '0',
  photo_id TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS charges (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL REFERENCES service_notes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount TEXT NOT NULL DEFAULT '0',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL REFERENCES service_notes(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signatures (
  note_id TEXT PRIMARY KEY REFERENCES service_notes(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_position TEXT NOT NULL DEFAULT '',
  object_key TEXT,
  image TEXT NOT NULL,
  signed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL REFERENCES service_notes(id) ON DELETE CASCADE,
  service_number TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('SERVICE_NOTE_CREATED', 'SERVICE_NOTE_UPDATED', 'SERVICE_NOTE_COMPLETED')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_org_status ON profiles(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_service_notes_org_status ON service_notes(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_service_notes_org_updated ON service_notes(organization_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_service_notes_org_customer ON service_notes(organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_service_notes_org_employee ON service_notes(organization_id, person_in_charge_id);
CREATE INDEX IF NOT EXISTS idx_labor_items_note ON labor_items(note_id, position);
CREATE INDEX IF NOT EXISTS idx_material_items_note ON material_items(note_id, position);
CREATE INDEX IF NOT EXISTS idx_charges_note ON charges(note_id, position);
CREATE INDEX IF NOT EXISTS idx_photos_note ON photos(note_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_note ON audit_events(note_id, created_at);
