PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tracked_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id),
  name TEXT NOT NULL,
  reference TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, reference)
);

ALTER TABLE service_notes ADD COLUMN record_type TEXT NOT NULL DEFAULT 'SERVICE'
  CHECK (record_type IN ('RECEIPT', 'INSPECTION', 'SERVICE', 'HANDOVER'));
ALTER TABLE service_notes ADD COLUMN tracked_item_id TEXT REFERENCES tracked_items(id);
ALTER TABLE service_notes ADD COLUMN item_name_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN item_reference_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN location_snapshot TEXT NOT NULL DEFAULT '';
ALTER TABLE service_notes ADD COLUMN billing_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (billing_enabled IN (0, 1));
ALTER TABLE service_notes ADD COLUMN finalization_type TEXT NOT NULL DEFAULT 'CUSTOMER_ACKNOWLEDGED'
  CHECK (finalization_type IN ('STAFF_ATTESTED', 'CUSTOMER_ACKNOWLEDGED'));
ALTER TABLE service_notes ADD COLUMN staff_attested_at TEXT;

CREATE INDEX IF NOT EXISTS idx_tracked_items_org_reference
  ON tracked_items(organization_id, reference);
CREATE INDEX IF NOT EXISTS idx_service_notes_item_reference
  ON service_notes(organization_id, item_reference_snapshot, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_notes_tracked_item
  ON service_notes(organization_id, tracked_item_id, completed_at DESC);
