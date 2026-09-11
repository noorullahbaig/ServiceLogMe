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
  return profiles.map((profile) => insert("profiles", ["id", "organization_id", "full_name", "employee_id", "job_title", "email", "mobile", "role", "status", "created_at", "updated_at"], [profile.id, profile.organization_id, profile.full_name, profile.employee_id, profile.job_title, profile.email, profile.mobile, profile.role, profile.status, "2026-09-11T00:00:00.000Z", "2026-09-11T00:00:00.000Z"]));
}
function customerRow(customer: Customer) {
  return insert("customers", ["id", "organization_id", "name", "contact_name", "contact_position", "mobile", "office", "email", "address", "notes", "created_at", "updated_at"], [customer.id, customer.organization_id, customer.name, customer.contact_name, customer.contact_position, customer.mobile, customer.office, customer.email, customer.address, customer.notes, customer.created_at, customer.created_at]);
}
function noteRow(note: ServiceNote) {
  return insert("service_notes", ["id", "organization_id", "service_number", "status", "revision", "job_title", "job_description", "work_performed", "result_remarks", "additional_notes", "service_date", "service_time", "person_in_charge_id", "person_in_charge_name_snapshot", "person_in_charge_job_title_snapshot", "person_in_charge_employee_id_snapshot", "customer_id", "customer_name_snapshot", "contact_name_snapshot", "contact_position_snapshot", "contact_mobile_snapshot", "contact_office_snapshot", "contact_email_snapshot", "customer_address_snapshot", "payment_status", "payment_method", "payment_terms", "payment_reference", "payment_remarks", "labor_total", "material_total", "additional_charge_total", "subtotal", "discount_amount", "tax_rate", "tax_amount", "grand_total", "signer_name_draft", "signer_position_draft", "created_at", "updated_at", "completed_at"], [note.id, note.organization_id, note.service_number, note.status, note.revision, note.job_title, note.job_description, note.work_performed, note.result_remarks, note.additional_notes, note.service_date, note.service_time, note.person_in_charge_id, note.person_in_charge_name_snapshot, note.person_in_charge_job_title_snapshot, note.person_in_charge_employee_id_snapshot, note.customer_id || null, note.customer_name_snapshot, note.contact_name_snapshot, note.contact_position_snapshot, note.contact_mobile_snapshot, note.contact_office_snapshot, note.contact_email_snapshot, note.customer_address_snapshot, note.payment_status, note.payment_method, note.payment_terms, note.payment_reference, note.payment_remarks, note.labor_total, note.material_total, note.additional_charge_total, note.subtotal, note.discount_amount, note.tax_rate, note.tax_amount, note.grand_total, note.signer_name_draft || null, note.signer_position_draft || null, note.created_at, note.updated_at, note.completed_at]);
}
function noteChildren(note: ServiceNote) {
  return [
    ...note.labor.map((item, position) => insert("labor_items", ["id", "organization_id", "note_id", "employee_id", "name", "classification", "hours", "rate", "notes", "position"], [item.id, note.organization_id, note.id, item.employee_id || null, item.name, item.classification, item.hours, item.rate, item.notes, position])),
    ...note.materials.map((item, position) => insert("material_items", ["id", "organization_id", "note_id", "description", "part_number", "quantity", "unit_amount", "photo_id", "position"], [item.id, note.organization_id, note.id, item.description, item.part_number, item.quantity, item.unit_amount, item.photo_id || null, position])),
    ...note.charges.map((item, position) => insert("charges", ["id", "organization_id", "note_id", "description", "amount", "position"], [item.id, note.organization_id, note.id, item.description, item.amount, position])),
    note.signature ? insert("signatures", ["note_id", "organization_id", "signer_name", "signer_position", "object_key", "image", "signed_at"], [note.id, note.organization_id, note.signature.signer_name, note.signature.signer_position, null, note.signature.image, note.signature.signed_at]) : "",
  ].filter(Boolean);
}

function seedSql() {
  const workspace = createDevelopmentWorkspace();
  workspace.profile.email = "sarah@servicelogme.app";
  workspace.employees[0].email = workspace.profile.email;
  workspace.employees[1].email = "amir@servicelogme.app";
  const profiles = workspace.employees;
  const lines = [
    "PRAGMA foreign_keys = ON;",
    insert("organizations", ["id", "name", "email", "phone", "address", "currency", "timezone", "created_at", "updated_at"], [workspace.organization.id, workspace.organization.name, workspace.organization.email, workspace.organization.phone, workspace.organization.address, workspace.organization.currency, workspace.organization.timezone, "2026-09-11T00:00:00.000Z", "2026-09-11T00:00:00.000Z"]),
    ...profileRows(profiles),
    insert("users", ["id", "profile_id", "organization_id", "email", "password_hash", "password_salt", "active", "created_at", "updated_at"], ["user-sarah", workspace.profile.id, workspace.organization.id, "sarah@servicelogme.app", hash.admin, "sarah-salt", 1, "2026-09-11T00:00:00.000Z", "2026-09-11T00:00:00.000Z"]),
    insert("users", ["id", "profile_id", "organization_id", "email", "password_hash", "password_salt", "active", "created_at", "updated_at"], ["user-amir", workspace.employees[1].id, workspace.organization.id, "amir@servicelogme.app", hash.field, "amir-salt", 1, "2026-09-11T00:00:00.000Z", "2026-09-11T00:00:00.000Z"]),
    ...workspace.customers.map(customerRow),
    ...workspace.notes.flatMap((note) => [noteRow(note), ...noteChildren(note)]),
  ];
  return `${lines.join("\n")}\n`;
}

const args = process.argv.slice(2);
const database = args[args.indexOf("--database") + 1];
if (!database) throw new Error("Usage: npm run seed:d1 -- --database <name> [--env staging] [--remote]");
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
  await run("npx", wranglerArgs, { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 });
} finally {
  await rm(directory, { recursive: true, force: true });
}
