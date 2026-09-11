import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("D1 schema", () => {
  it("defines the organization-scoped ServiceLOGME data model", async () => {
    const sql = await readFile("migrations/0001_initial_schema.sql", "utf8");

    for (const table of [
      "organizations",
      "profiles",
      "customers",
      "service_notes",
      "labor_items",
      "material_items",
      "charges",
      "photos",
      "signatures",
      "audit_events",
    ]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    }

    expect(sql).toContain("UNIQUE (organization_id, employee_id)");
    expect(sql).toContain("UNIQUE (organization_id, service_number)");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_service_notes_org_status");
    expect(sql).toContain("PRAGMA foreign_keys = ON");
  });
});
