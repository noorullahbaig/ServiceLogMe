import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Evidence Report v2 Migration", () => {
  it("is fully additive and preserves all legacy data", async () => {
    const sql = await readFile("migrations/0004_evidence_report_v2.sql", "utf8");

    // Must NOT contain any DELETE statements
    expect(sql).not.toContain("DELETE FROM service_notes");
    expect(sql).not.toContain("DELETE FROM customers");
    expect(sql).not.toContain("DELETE FROM photos");
    expect(sql).not.toContain("DELETE FROM signatures");
    expect(sql).not.toContain("DELETE FROM audit_events");
    expect(sql).not.toContain("DELETE FROM labor_items");
    expect(sql).not.toContain("DELETE FROM material_items");
    expect(sql).not.toContain("DELETE FROM charges");
    expect(sql).not.toContain("DELETE FROM tracked_items");
    expect(sql).not.toContain("DELETE FROM stored_files");

    // Must add schema_version column
    expect(sql).toContain("ALTER TABLE service_notes ADD COLUMN schema_version");
    expect(sql).toMatch(/schema_version INTEGER NOT NULL DEFAULT 1/);
    expect(sql).toMatch(/CHECK \(schema_version IN \(1, 2\)\)/);

    // Must add contact_number to customers
    expect(sql).toContain("ALTER TABLE customers ADD COLUMN contact_number");

    // Must backfill contact_number from legacy fields
    expect(sql).toContain("UPDATE customers");
    expect(sql).toMatch(/SET contact_number.*mobile.*office/s);
    expect(sql).toMatch(/COALESCE/);
  });

  it("adds all required v2 columns to service_notes", async () => {
    const sql = await readFile("migrations/0004_evidence_report_v2.sql", "utf8");

    const v2Columns = [
      "contact_number_snapshot",
      "invoice_number",
      "delivery_number",
      "quantity",
      "brand",
      "model",
      "declared_total_value",
      "declared_currency",
      "condition_code",
      "condition_remarks",
      "organization_name_snapshot",
      "organization_email_snapshot",
      "organization_phone_snapshot",
      "organization_address_snapshot",
      "organization_timezone_snapshot",
      "acknowledgement_text_snapshot",
      "acknowledgement_enabled",
    ];

    for (const column of v2Columns) {
      expect(sql).toContain(`ALTER TABLE service_notes ADD COLUMN ${column}`);
    }

    // Verify condition_code has proper CHECK constraint
    expect(sql).toMatch(/condition_code.*CHECK.*NO_VISIBLE_ISSUE.*EXISTING_WEAR_DAMAGE.*DAMAGED/s);
  });

  it("creates report_photo_evidence table with SHA-256 validation", async () => {
    const sql = await readFile("migrations/0004_evidence_report_v2.sql", "utf8");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS report_photo_evidence");
    expect(sql).toContain("original_object_key TEXT NOT NULL UNIQUE");
    expect(sql).toContain("original_sha256 TEXT NOT NULL CHECK (length(original_sha256) = 64)");
    expect(sql).toContain("original_byte_size INTEGER NOT NULL CHECK (original_byte_size > 0 AND original_byte_size <= 30000000)");
    expect(sql).toContain("derivative_object_key TEXT");
    expect(sql).toContain("derivative_sha256 TEXT");
    expect(sql).toMatch(/source_intent.*CHECK.*CAMERA_CAPTURE.*FILE_UPLOAD/s);
    expect(sql).toContain("gps_latitude REAL");
    expect(sql).toContain("gps_longitude REAL");
    expect(sql).toContain("gps_accuracy REAL");
    expect(sql).toContain("position INTEGER NOT NULL DEFAULT 0");
  });

  it("creates FTS5 search infrastructure for v2 reports only", async () => {
    const sql = await readFile("migrations/0004_evidence_report_v2.sql", "utf8");

    expect(sql).toContain("CREATE VIRTUAL TABLE IF NOT EXISTS report_search USING fts5");
    expect(sql).toContain("report_id UNINDEXED");
    expect(sql).toContain("organization_id UNINDEXED");
    expect(sql).toContain("service_number");
    expect(sql).toContain("customer_name");
    expect(sql).toContain("contact_number");
    expect(sql).toContain("item_description");
    expect(sql).toContain("item_reference");
    expect(sql).toContain("invoice_number");
    expect(sql).toContain("delivery_number");

    // Triggers should only index v2 reports
    expect(sql).toContain("report_search_insert");
    expect(sql).toMatch(/WHEN NEW\.schema_version = 2/);
    expect(sql).toContain("report_search_update");
    expect(sql).toContain("report_search_delete");
  });

  it("creates performance indexes for v2 queries", async () => {
    const sql = await readFile("migrations/0004_evidence_report_v2.sql", "utf8");

    const indexes = [
      "idx_report_photo_evidence_report",
      "idx_reports_created",
      "idx_reports_customer",
      "idx_reports_employee",
      "idx_reports_invoice",
      "idx_reports_delivery",
      "idx_reports_item_reference",
    ];

    for (const index of indexes) {
      expect(sql).toContain(`CREATE INDEX IF NOT EXISTS ${index}`);
    }

    // Verify schema_version is used in composite indexes
    expect(sql).toMatch(/idx_reports_created.*schema_version/s);
    expect(sql).toMatch(/idx_reports_customer.*schema_version/s);
    expect(sql).toMatch(/idx_reports_employee.*schema_version/s);
  });

  it("enforces immutability for completed evidence reports", async () => {
    const sql = await readFile("migrations/0004_evidence_report_v2.sql", "utf8");

    // Update guard
    expect(sql).toContain("report_photo_evidence_update_guard");
    expect(sql).toContain("BEFORE UPDATE ON report_photo_evidence");
    expect(sql).toMatch(/WHERE id = OLD\.report_id AND status = 'COMPLETED'/);
    expect(sql).toMatch(/RAISE\(ABORT.*immutable/);

    // Delete guard
    expect(sql).toContain("report_photo_evidence_delete_guard");
    expect(sql).toContain("BEFORE DELETE ON report_photo_evidence");
    expect(sql).toMatch(/WHERE id = OLD\.report_id AND status = 'COMPLETED'/);
  });

  it("maintains foreign key integrity", async () => {
    const sql = await readFile("migrations/0004_evidence_report_v2.sql", "utf8");

    expect(sql).toContain("PRAGMA foreign_keys = ON");
    expect(sql).toContain("REFERENCES organizations(id) ON DELETE CASCADE");
    expect(sql).toContain("REFERENCES service_notes(id) ON DELETE CASCADE");
    expect(sql).toContain("REFERENCES profiles(id)");
  });
});
