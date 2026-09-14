import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("D1 schema", () => {
  it("defines the organization-scoped ServiceLOGME data model", async () => {
    const sql = await readFile("migrations/0001_initial_schema.sql", "utf8");
    const authSql = await readFile("migrations/0002_auth_and_media.sql", "utf8");
    const traceabilitySql = await readFile(
      "migrations/0003_item_traceability.sql",
      "utf8",
    );
    const evidenceSql = await readFile(
      "migrations/0004_evidence_report_v2.sql",
      "utf8",
    );
    const completeSql = `${sql}\n${authSql}\n${traceabilitySql}\n${evidenceSql}`;

    for (const table of [
      "organizations",
      "profiles",
      "users",
      "sessions",
      "login_attempts",
      "customers",
      "tracked_items",
      "service_notes",
      "labor_items",
      "material_items",
      "charges",
      "photos",
      "signatures",
      "stored_files",
      "audit_events",
      "report_photo_evidence",
    ]) {
      expect(completeSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }

    expect(sql).toContain("UNIQUE (organization_id, employee_id)");
    expect(sql).toContain("UNIQUE (organization_id, service_number)");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_service_notes_org_status");
    expect(completeSql).toContain("idx_service_notes_item_reference");
    expect(evidenceSql).toContain("schema_version");
    expect(evidenceSql).toContain("condition_code");
    expect(evidenceSql).toContain("original_sha256");
    expect(evidenceSql).toContain("DELETE FROM service_notes");
    expect(evidenceSql).toContain("report_photo_evidence_update_guard");
    expect(evidenceSql).toContain("CREATE VIRTUAL TABLE IF NOT EXISTS report_search USING fts5");
    expect(sql).toContain("PRAGMA foreign_keys = ON");
  });
});
