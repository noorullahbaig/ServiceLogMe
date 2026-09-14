PRAGMA foreign_keys = ON;

-- The previous records were development/service-oriented data and are intentionally
-- retired as part of the approved evidence-report cutover. Identity and auth remain.
DELETE FROM audit_events;
DELETE FROM signatures;
DELETE FROM photos;
DELETE FROM charges;
DELETE FROM material_items;
DELETE FROM labor_items;
DELETE FROM service_notes;
DELETE FROM tracked_items;
DELETE FROM customers;
DELETE FROM stored_files;

ALTER TABLE customers ADD COLUMN contact_number TEXT NOT NULL DEFAULT '';

ALTER TABLE service_notes ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1
  CHECK (schema_version IN (1, 2));
ALTER TABLE service_notes ADD COLUMN contact_number_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN invoice_number TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN delivery_number TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN quantity TEXT NOT NULL DEFAULT '1';
ALTER TABLE service_notes ADD COLUMN brand TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN model TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN declared_total_value TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN declared_currency TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN condition_code TEXT NOT NULL DEFAULT ''
  CHECK (condition_code IN ('', 'NO_VISIBLE_ISSUE', 'EXISTING_WEAR_DAMAGE', 'DAMAGED', 'UNABLE_TO_FULLY_INSPECT', 'OTHER'));
ALTER TABLE service_notes ADD COLUMN condition_remarks TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN organization_name_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN organization_email_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN organization_phone_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN organization_address_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN organization_timezone_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN acknowledgement_text_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN acknowledgement_enabled INTEGER NOT NULL DEFAULT 0
  CHECK (acknowledgement_enabled IN (0, 1));

CREATE TABLE IF NOT EXISTS report_photo_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id TEXT NOT NULL REFERENCES service_notes(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES profiles(id),
  uploader_name_snapshot TEXT NOT NULL,
  original_object_key TEXT NOT NULL UNIQUE,
  original_content_type TEXT NOT NULL,
  original_byte_size INTEGER NOT NULL CHECK (original_byte_size > 0 AND original_byte_size <= 30000000),
  original_filename TEXT NOT NULL DEFAULT '',
  original_sha256 TEXT NOT NULL CHECK (length(original_sha256) = 64),
  derivative_object_key TEXT,
  derivative_content_type TEXT,
  derivative_byte_size INTEGER,
  derivative_sha256 TEXT,
  source_intent TEXT NOT NULL CHECK (source_intent IN ('CAMERA_CAPTURE', 'FILE_UPLOAD')),
  caption TEXT NOT NULL DEFAULT '',
  server_uploaded_at TEXT NOT NULL,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy REAL,
  gps_device_timestamp TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_report_photo_evidence_report
  ON report_photo_evidence(organization_id, report_id, position);
CREATE INDEX IF NOT EXISTS idx_reports_created
  ON service_notes(organization_id, schema_version, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_customer
  ON service_notes(organization_id, schema_version, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_employee
  ON service_notes(organization_id, schema_version, person_in_charge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_invoice
  ON service_notes(organization_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_reports_delivery
  ON service_notes(organization_id, delivery_number);
CREATE INDEX IF NOT EXISTS idx_reports_item_reference
  ON service_notes(organization_id, item_reference_snapshot);

CREATE VIRTUAL TABLE IF NOT EXISTS report_search USING fts5(
  report_id UNINDEXED,
  organization_id UNINDEXED,
  service_number,
  customer_name,
  contact_number,
  item_description,
  item_reference,
  invoice_number,
  delivery_number,
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS report_search_insert AFTER INSERT ON service_notes
WHEN NEW.schema_version = 2
BEGIN
  INSERT INTO report_search VALUES (NEW.id, NEW.organization_id, NEW.service_number,
    NEW.customer_name_snapshot, NEW.contact_number_snapshot, NEW.item_name_snapshot,
    NEW.item_reference_snapshot, NEW.invoice_number, NEW.delivery_number);
END;
CREATE TRIGGER IF NOT EXISTS report_search_update AFTER UPDATE ON service_notes
WHEN NEW.schema_version = 2
BEGIN
  DELETE FROM report_search WHERE report_id = OLD.id;
  INSERT INTO report_search VALUES (NEW.id, NEW.organization_id, NEW.service_number,
    NEW.customer_name_snapshot, NEW.contact_number_snapshot, NEW.item_name_snapshot,
    NEW.item_reference_snapshot, NEW.invoice_number, NEW.delivery_number);
END;
CREATE TRIGGER IF NOT EXISTS report_search_delete AFTER DELETE ON service_notes
BEGIN
  DELETE FROM report_search WHERE report_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS report_photo_evidence_update_guard
BEFORE UPDATE ON report_photo_evidence
WHEN EXISTS (SELECT 1 FROM service_notes WHERE id = OLD.report_id AND status = 'COMPLETED')
BEGIN
  SELECT RAISE(ABORT, 'completed report evidence is immutable');
END;

CREATE TRIGGER IF NOT EXISTS report_photo_evidence_delete_guard
BEFORE DELETE ON report_photo_evidence
WHEN EXISTS (SELECT 1 FROM service_notes WHERE id = OLD.report_id AND status = 'COMPLETED')
BEGIN
  SELECT RAISE(ABORT, 'completed report evidence is immutable');
END;
