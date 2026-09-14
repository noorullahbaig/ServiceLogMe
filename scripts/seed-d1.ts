import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createDevelopmentWorkspace } from "../src/dev/fixtures";
import type { Customer, Profile, ServiceNote } from "../src/lib/types";

const run = promisify(execFile);
const hash = {
  admin: "da61b37c708857c0554194bc4f1d41a878060f35ff4eaa1662afd992c57bbd7b",
  field: "23904c9724f916481144443ce580496f819882e5ed803c1b8c2f55d66f3f38a5",
};

function sqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}
function insert(table: string, columns: string[], values: unknown[]) {
  return `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${values.map(sqlValue).join(", ")});`;
}
function profileRows(profiles: Profile[]) {
  return profiles.map((profile) =>
    insert(
      "profiles",
      [
        "id",
        "organization_id",
        "full_name",
        "employee_id",
        "job_title",
        "email",
        "mobile",
        "role",
        "status",
        "created_at",
        "updated_at",
      ],
      [
        profile.id,
        profile.organization_id,
        profile.full_name,
        profile.employee_id,
        profile.job_title,
        profile.email,
        profile.mobile,
        profile.role,
        profile.status,
        "2026-09-11T00:00:00.000Z",
        "2026-09-11T00:00:00.000Z",
      ],
    ),
  );
}
function customerRow(customer: Customer) {
  return insert(
    "customers",
    [
      "id",
      "organization_id",
      "name",
      "contact_name",
      "contact_position",
      "mobile",
      "office",
      "contact_number",
      "email",
      "address",
      "notes",
      "created_at",
      "updated_at",
    ],
    [
      customer.id,
      customer.organization_id,
      customer.name,
      customer.contact_name,
      customer.contact_position,
      customer.mobile,
      customer.office,
      customer.contact_number || customer.mobile || customer.office,
      customer.email,
      customer.address,
      customer.notes,
      customer.created_at,
      customer.created_at,
    ],
  );
}
function noteRow(note: ServiceNote) {
  return insert(
    "service_notes",
    [
      "id",
      "organization_id",
      "service_number",
      "schema_version",
      "status",
      "revision",
      "additional_notes",
      "person_in_charge_id",
      "person_in_charge_name_snapshot",
      "person_in_charge_job_title_snapshot",
      "person_in_charge_employee_id_snapshot",
      "customer_id",
      "customer_name_snapshot",
      "contact_name_snapshot",
      "contact_number_snapshot",
      "contact_email_snapshot",
      "customer_address_snapshot",
      "invoice_number",
      "delivery_number",
      "item_name_snapshot",
      "item_reference_snapshot",
      "quantity",
      "brand",
      "model",
      "declared_total_value",
      "declared_currency",
      "location_snapshot",
      "condition_code",
      "condition_remarks",
      "organization_name_snapshot",
      "organization_email_snapshot",
      "organization_phone_snapshot",
      "organization_address_snapshot",
      "organization_timezone_snapshot",
      "acknowledgement_enabled",
      "billing_enabled",
      "finalization_type",
      "payment_status",
      "created_at",
      "updated_at",
      "completed_at",
    ],
    [
      note.id,
      note.organization_id,
      note.service_number,
      2,
      "DRAFT",
      note.revision,
      note.additional_notes,
      note.person_in_charge_id,
      note.person_in_charge_name_snapshot,
      note.person_in_charge_job_title_snapshot,
      note.person_in_charge_employee_id_snapshot,
      note.customer_id || null,
      note.customer_name_snapshot,
      note.contact_name_snapshot,
      note.contact_number_snapshot || "",
      note.contact_email_snapshot,
      note.customer_address_snapshot,
      note.invoice_number || "",
      note.delivery_number || "",
      note.item_name_snapshot || "",
      note.item_reference_snapshot || "",
      note.quantity || "1",
      note.brand || "",
      note.model || "",
      note.declared_total_value || "",
      note.declared_currency || "",
      note.location_snapshot || "",
      note.condition_code || "",
      note.condition_remarks || "",
      note.organization_name_snapshot || "",
      note.organization_email_snapshot || "",
      note.organization_phone_snapshot || "",
      note.organization_address_snapshot || "",
      note.organization_timezone_snapshot || "",
      0,
      0,
      "STAFF_ATTESTED",
      "UNPAID",
      note.created_at,
      note.updated_at,
      null,
    ],
  );
}
function seedSql() {
  const workspace = createDevelopmentWorkspace();
  workspace.profile.email = "sarah@servicelogme.app";
  workspace.employees[0].email = workspace.profile.email;
  workspace.employees[1].email = "amir@servicelogme.app";
  const profiles = workspace.employees;
  const lines = [
    "PRAGMA foreign_keys = ON;",
    insert(
      "organizations",
      [
        "id",
        "name",
        "email",
        "phone",
        "address",
        "currency",
        "timezone",
        "created_at",
        "updated_at",
      ],
      [
        workspace.organization.id,
        workspace.organization.name,
        workspace.organization.email,
        workspace.organization.phone,
        workspace.organization.address,
        workspace.organization.currency,
        workspace.organization.timezone,
        "2026-09-11T00:00:00.000Z",
        "2026-09-11T00:00:00.000Z",
      ],
    ),
    ...profileRows(profiles),
    insert(
      "users",
      [
        "id",
        "profile_id",
        "organization_id",
        "email",
        "password_hash",
        "password_salt",
        "active",
        "created_at",
        "updated_at",
      ],
      [
        "user-sarah",
        workspace.profile.id,
        workspace.organization.id,
        "sarah@servicelogme.app",
        hash.admin,
        "sarah-salt",
        1,
        "2026-09-11T00:00:00.000Z",
        "2026-09-11T00:00:00.000Z",
      ],
    ),
    insert(
      "users",
      [
        "id",
        "profile_id",
        "organization_id",
        "email",
        "password_hash",
        "password_salt",
        "active",
        "created_at",
        "updated_at",
      ],
      [
        "user-amir",
        workspace.employees[1].id,
        workspace.organization.id,
        "amir@servicelogme.app",
        hash.field,
        "amir-salt",
        1,
        "2026-09-11T00:00:00.000Z",
        "2026-09-11T00:00:00.000Z",
      ],
    ),
    ...workspace.customers.map(customerRow),
    // Seed relevant v2 drafts. Real evidence photos must be uploaded to R2 and are
    // intentionally never fabricated by a SQL-only seed.
    ...workspace.notes.map(noteRow),
  ];
  return `${lines.join("\n")}\n`;
}

const args = process.argv.slice(2);
const database = args[args.indexOf("--database") + 1];
if (!database)
  throw new Error(
    "Usage: npm run seed:d1 -- --database <name> [--env staging] [--remote]",
  );
const envIndex = args.indexOf("--env");
const environment = envIndex >= 0 ? args[envIndex + 1] : undefined;
const configIndex = args.indexOf("--config");
const config = configIndex >= 0 ? args[configIndex + 1] : undefined;
const directory = await mkdtemp(join(tmpdir(), "servicelogme-seed-"));
const file = join(directory, "seed.sql");
await writeFile(file, seedSql(), "utf8");
try {
  const wranglerArgs = ["wrangler", "d1", "execute", database, "--file", file];
  if (args.includes("--remote")) wranglerArgs.push("--remote");
  if (environment) wranglerArgs.push("--env", environment);
  if (config) wranglerArgs.push("--config", config);
  await run("npx", wranglerArgs, {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}
