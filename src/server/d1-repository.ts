import { calculateTotals, canAccessNote, completionErrors } from "@/lib/domain";
import type { AuditEvent, Charge, Customer, Labor, Material, Organization, Profile, ServiceNote, Signature, WorkspaceData } from "@/lib/types";
import type { D1Database } from "@cloudflare/workers-types";
import type { AuthenticatedUser } from "./auth";
import { validateMediaUpload } from "./media";

type Row = Record<string, unknown>;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const text = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) => Number(value ?? 0);

function profileFromRow(row: Row): Profile {
  return { id: text(row.id), organization_id: text(row.organization_id), full_name: text(row.full_name), employee_id: text(row.employee_id), job_title: text(row.job_title), email: text(row.email), mobile: text(row.mobile), role: text(row.role) as Profile["role"], status: text(row.status) as Profile["status"] };
}
function organizationFromRow(row: Row): Organization {
  return { id: text(row.id), name: text(row.name), email: text(row.email), phone: text(row.phone), address: text(row.address), currency: text(row.currency), timezone: text(row.timezone) };
}
function customerFromRow(row: Row): Customer {
  return { id: text(row.id), organization_id: text(row.organization_id), name: text(row.name), contact_name: text(row.contact_name), contact_position: text(row.contact_position), mobile: text(row.mobile), office: text(row.office), email: text(row.email), address: text(row.address), notes: text(row.notes), created_at: text(row.created_at) };
}
function signatureFromRow(row: Row | undefined): Signature | null {
  if (!row) return null;
  return { signer_name: text(row.signer_name), signer_position: text(row.signer_position), image: text(row.image), signed_at: text(row.signed_at), file_id: text(row.file_id) || undefined };
}
async function all<T extends Row = Row>(db: D1Database, sql: string, ...values: unknown[]) {
  const result = await db.prepare(sql).bind(...values).all<T>();
  return (result.results ?? []) as T[];
}
async function one<T extends Row = Row>(db: D1Database, sql: string, ...values: unknown[]) {
  return (await db.prepare(sql).bind(...values).first<T>()) ?? undefined;
}
async function profileForUser(user: AuthenticatedUser, db: D1Database) {
  const row = await one(db, "SELECT * FROM profiles WHERE id = ? AND organization_id = ? AND status = 'ACTIVE'", user.profileId, user.organizationId);
  if (!row) throw new Response(JSON.stringify({ code: "PROFILE_UNAVAILABLE", message: "Your workspace profile is unavailable." }), { status: 403, headers: { "content-type": "application/json" } });
  return profileFromRow(row);
}
async function childRows(noteId: string, organizationId: string, db: D1Database) {
  const [labor, materials, charges, photos, signature] = await Promise.all([
    all(db, "SELECT * FROM labor_items WHERE note_id = ? AND organization_id = ? ORDER BY position", noteId, organizationId),
    all(db, "SELECT * FROM material_items WHERE note_id = ? AND organization_id = ? ORDER BY position", noteId, organizationId),
    all(db, "SELECT * FROM charges WHERE note_id = ? AND organization_id = ? ORDER BY position", noteId, organizationId),
    all(db, "SELECT * FROM photos WHERE note_id = ? AND organization_id = ? ORDER BY created_at", noteId, organizationId),
    one(db, "SELECT * FROM signatures WHERE note_id = ? AND organization_id = ?", noteId, organizationId),
  ]);
  return {
    labor: labor.map((r) => ({ id: text(r.id), employee_id: text(r.employee_id) || undefined, name: text(r.name), classification: text(r.classification), hours: text(r.hours), rate: text(r.rate), notes: text(r.notes) } satisfies Labor)),
    materials: materials.map((r) => ({ id: text(r.id), description: text(r.description), part_number: text(r.part_number), quantity: text(r.quantity), unit_amount: text(r.unit_amount), photo_id: text(r.photo_id) || undefined } satisfies Material)),
    charges: charges.map((r) => ({ id: text(r.id), description: text(r.description), amount: text(r.amount) } satisfies Charge)),
    photos: photos.map((r) => ({ id: text(r.id), url: text(r.url) || `/api/files/${encodeURIComponent(text(r.file_id || r.object_key))}`, category: text(r.category) as ServiceNote["photos"][number]["category"], caption: text(r.caption), created_at: text(r.created_at), name: text(r.name), file_id: text(r.file_id) || undefined })),
    signature: signatureFromRow(signature),
  };
}
async function noteFromRow(row: Row, db: D1Database): Promise<ServiceNote> {
  const children = await childRows(text(row.id), text(row.organization_id), db);
  return { id: text(row.id), organization_id: text(row.organization_id), service_number: text(row.service_number), status: text(row.status) as ServiceNote["status"], revision: num(row.revision), job_title: text(row.job_title), job_description: text(row.job_description), work_performed: text(row.work_performed), result_remarks: text(row.result_remarks), additional_notes: text(row.additional_notes), service_date: text(row.service_date), service_time: text(row.service_time), person_in_charge_id: text(row.person_in_charge_id), person_in_charge_name_snapshot: text(row.person_in_charge_name_snapshot), person_in_charge_job_title_snapshot: text(row.person_in_charge_job_title_snapshot), person_in_charge_employee_id_snapshot: text(row.person_in_charge_employee_id_snapshot), customer_id: text(row.customer_id), customer_name_snapshot: text(row.customer_name_snapshot), contact_name_snapshot: text(row.contact_name_snapshot), contact_position_snapshot: text(row.contact_position_snapshot), contact_mobile_snapshot: text(row.contact_mobile_snapshot), contact_office_snapshot: text(row.contact_office_snapshot), contact_email_snapshot: text(row.contact_email_snapshot), customer_address_snapshot: text(row.customer_address_snapshot), payment_status: text(row.payment_status) as ServiceNote["payment_status"], payment_method: text(row.payment_method), payment_terms: text(row.payment_terms), payment_reference: text(row.payment_reference), payment_remarks: text(row.payment_remarks), labor_total: text(row.labor_total), material_total: text(row.material_total), additional_charge_total: text(row.additional_charge_total), subtotal: text(row.subtotal), discount_amount: text(row.discount_amount), tax_rate: text(row.tax_rate), tax_amount: text(row.tax_amount), grand_total: text(row.grand_total), labor: children.labor, materials: children.materials, charges: children.charges, photos: children.photos, signer_name_draft: text(row.signer_name_draft) || undefined, signer_position_draft: text(row.signer_position_draft) || undefined, signature: children.signature, created_at: text(row.created_at), updated_at: text(row.updated_at), completed_at: text(row.completed_at) || null };
}
async function rowsForWorkspace(profile: Profile, db: D1Database) {
  const [organization, employees, customers, notes, events] = await Promise.all([
    one(db, "SELECT * FROM organizations WHERE id = ?", profile.organization_id),
    all(db, "SELECT * FROM profiles WHERE organization_id = ? ORDER BY full_name", profile.organization_id),
    all(db, "SELECT * FROM customers WHERE organization_id = ? ORDER BY name", profile.organization_id),
    all(db, "SELECT * FROM service_notes WHERE organization_id = ? ORDER BY updated_at DESC", profile.organization_id),
    all(db, "SELECT * FROM audit_events WHERE organization_id = ? ORDER BY created_at DESC", profile.organization_id),
  ]);
  if (!organization) throw new Error("Organization not found");
  return { organization: organizationFromRow(organization), employees: employees.map(profileFromRow), customers: customers.map(customerFromRow), notes: await Promise.all(notes.map((row) => noteFromRow(row, db))), events: events.map((r) => ({ id: text(r.id), note_id: text(r.note_id), service_number: text(r.service_number), actor_name: text(r.actor_name), type: text(r.type) as AuditEvent["type"], created_at: text(r.created_at) })) };
}
export async function readWorkspace(user: AuthenticatedUser, env: Cloudflare.Env): Promise<WorkspaceData> {
  const profile = await profileForUser(user, env.DB);
  return { profile, ...(await rowsForWorkspace(profile, env.DB)) };
}
export async function createNote(user: AuthenticatedUser, env: Cloudflare.Env): Promise<ServiceNote> {
  const profile = await profileForUser(user, env.DB);
  const timestamp = now(), noteId = id(), prefix = `SL-${new Date().getFullYear()}-`;
  const latest = await one(env.DB, "SELECT service_number FROM service_notes WHERE organization_id = ? AND service_number LIKE ? ORDER BY service_number DESC LIMIT 1", profile.organization_id, `${prefix}%`);
  const sequence = latest ? num(text(latest.service_number).slice(prefix.length)) + 1 : 1;
  const serviceNumber = `${prefix}${String(sequence).padStart(6, "0")}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO service_notes (id, organization_id, service_number, status, revision, service_date, service_time, person_in_charge_id, person_in_charge_name_snapshot, person_in_charge_job_title_snapshot, person_in_charge_employee_id_snapshot, payment_status, created_at, updated_at) VALUES (?, ?, ?, 'DRAFT', 0, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?)").bind(noteId, profile.organization_id, serviceNumber, timestamp.slice(0, 10), timestamp.slice(11, 16), profile.id, profile.full_name, profile.job_title, profile.employee_id, timestamp, timestamp),
    env.DB.prepare("INSERT INTO audit_events (id, organization_id, note_id, service_number, actor_name, type, created_at) VALUES (?, ?, ?, ?, ?, 'SERVICE_NOTE_CREATED', ?)").bind(id(), profile.organization_id, noteId, serviceNumber, profile.full_name, timestamp),
  ]);
  const row = await one(env.DB, "SELECT * FROM service_notes WHERE id = ? AND organization_id = ?", noteId, profile.organization_id);
  if (!row) throw new Error("Could not create service note");
  return noteFromRow(row, env.DB);
}
async function assertNote(user: AuthenticatedUser, input: ServiceNote, db: D1Database) {
  const profile = await profileForUser(user, db);
  const row = await one(db, "SELECT * FROM service_notes WHERE id = ? AND organization_id = ?", input.id, profile.organization_id);
  if (!row) throw new Response(JSON.stringify({ code: "NOTE_NOT_FOUND", message: "This Service Note is not available." }), { status: 404, headers: { "content-type": "application/json" } });
  const current = await noteFromRow(row, db);
  if (!canAccessNote(profile, current)) throw new Response(JSON.stringify({ code: "FORBIDDEN", message: "This Service Note is not available." }), { status: 403, headers: { "content-type": "application/json" } });
  return { profile, current };
}
function dataUrlBytes(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], bytes: Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0)) };
}
async function storeDataUrl(value: string, purpose: "photo" | "signature", user: AuthenticatedUser, db: D1Database) {
  const parsed = dataUrlBytes(value);
  if (!parsed) return { fileId: "", url: value };
  validateMediaUpload(parsed.contentType, parsed.bytes.byteLength, purpose);
  const fileId = id(), timestamp = now();
  const buffer = parsed.bytes.buffer.slice(parsed.bytes.byteOffset, parsed.bytes.byteOffset + parsed.bytes.byteLength) as ArrayBuffer;
  const checksum = await crypto.subtle.digest("SHA-256", buffer);
  const checksumHex = [...new Uint8Array(checksum)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  await db.prepare("INSERT INTO stored_files (id, organization_id, storage_driver, object_key, content, content_type, byte_size, checksum, uploaded_by, created_at) VALUES (?, ?, 'D1', ?, ?, ?, ?, ?, ?, ?)").bind(fileId, user.organizationId, `d1:${fileId}`, buffer, parsed.contentType, parsed.bytes.byteLength, checksumHex, user.profileId, timestamp).run();
  return { fileId, url: `/api/files/${fileId}` };
}
async function existingMediaRef(fileId: string | undefined, value: string, user: AuthenticatedUser, db: D1Database, purpose: "photo" | "signature") {
  if (!fileId) return null;
  const row = await one(db, "SELECT id, content_type, byte_size FROM stored_files WHERE id = ? AND organization_id = ?", fileId, user.organizationId);
  if (!row) throw new Response(JSON.stringify({ code: "FILE_NOT_FOUND", message: "The uploaded file is no longer available." }), { status: 422, headers: { "content-type": "application/json" } });
  validateMediaUpload(text(row.content_type), num(row.byte_size), purpose);
  return { fileId, url: value };
}
async function replaceChildren(note: ServiceNote, profile: Profile, user: AuthenticatedUser, env: Cloudflare.Env) {
  const statements = [
    env.DB.prepare("UPDATE stored_files SET attached_at = NULL WHERE organization_id = ? AND (id IN (SELECT file_id FROM photos WHERE note_id = ? AND organization_id = ?) OR id IN (SELECT file_id FROM signatures WHERE note_id = ? AND organization_id = ?))").bind(profile.organization_id, note.id, profile.organization_id, note.id, profile.organization_id),
    env.DB.prepare("DELETE FROM labor_items WHERE note_id = ? AND organization_id = ?").bind(note.id, profile.organization_id),
    env.DB.prepare("DELETE FROM material_items WHERE note_id = ? AND organization_id = ?").bind(note.id, profile.organization_id),
    env.DB.prepare("DELETE FROM charges WHERE note_id = ? AND organization_id = ?").bind(note.id, profile.organization_id),
    env.DB.prepare("DELETE FROM photos WHERE note_id = ? AND organization_id = ?").bind(note.id, profile.organization_id),
    env.DB.prepare("DELETE FROM signatures WHERE note_id = ? AND organization_id = ?").bind(note.id, profile.organization_id),
  ];
  note.labor.forEach((item, position) => statements.push(env.DB.prepare("INSERT INTO labor_items (id, organization_id, note_id, employee_id, name, classification, hours, rate, notes, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(item.id || id(), profile.organization_id, note.id, item.employee_id || null, item.name, item.classification, item.hours, item.rate, item.notes, position)));
  note.materials.forEach((item, position) => statements.push(env.DB.prepare("INSERT INTO material_items (id, organization_id, note_id, description, part_number, quantity, unit_amount, photo_id, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(item.id || id(), profile.organization_id, note.id, item.description, item.part_number, item.quantity, item.unit_amount, item.photo_id || null, position)));
  note.charges.forEach((item, position) => statements.push(env.DB.prepare("INSERT INTO charges (id, organization_id, note_id, description, amount, position) VALUES (?, ?, ?, ?, ?, ?)").bind(item.id || id(), profile.organization_id, note.id, item.description, item.amount, position)));
  for (const item of note.photos) {
    const stored = await existingMediaRef(item.file_id, item.url, user, env.DB, "photo") ?? await storeDataUrl(item.url, "photo", user, env.DB);
    if (stored.fileId) statements.push(env.DB.prepare("UPDATE stored_files SET attached_at = ? WHERE id = ? AND organization_id = ?").bind(now(), stored.fileId, profile.organization_id));
    statements.push(env.DB.prepare("INSERT INTO photos (id, organization_id, note_id, object_key, url, file_id, category, caption, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(item.id || id(), profile.organization_id, note.id, stored.fileId ? `d1:${stored.fileId}` : "inline", stored.url, stored.fileId || null, item.category, item.caption, item.name, item.created_at || now()));
  }
  if (note.signature) {
    const stored = await existingMediaRef(note.signature.file_id, note.signature.image, user, env.DB, "signature") ?? await storeDataUrl(note.signature.image, "signature", user, env.DB);
    if (stored.fileId) statements.push(env.DB.prepare("UPDATE stored_files SET attached_at = ? WHERE id = ? AND organization_id = ?").bind(now(), stored.fileId, profile.organization_id));
    statements.push(env.DB.prepare("INSERT INTO signatures (note_id, organization_id, signer_name, signer_position, object_key, image, file_id, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(note.id, profile.organization_id, note.signature.signer_name, note.signature.signer_position, stored.fileId ? `d1:${stored.fileId}` : null, stored.url, stored.fileId || null, note.signature.signed_at));
  }
  return statements;
}
export async function saveNote(user: AuthenticatedUser, input: ServiceNote, complete: boolean, env: Cloudflare.Env): Promise<ServiceNote> {
  const { profile, current } = await assertNote(user, input, env.DB);
  if (current.status === "COMPLETED") throw new Response(JSON.stringify({ code: "NOTE_COMPLETED", message: "Completed Service Notes are read-only." }), { status: 409, headers: { "content-type": "application/json" } });
  if (current.revision !== input.revision) throw new Response(JSON.stringify({ code: "REVISION_CONFLICT", message: "This Service Note changed in another tab. Reload the saved record before editing again.", currentRevision: current.revision }), { status: 409, headers: { "content-type": "application/json" } });
  const customer = input.customer_id ? await one(env.DB, "SELECT * FROM customers WHERE id = ? AND organization_id = ?", input.customer_id, profile.organization_id) : undefined;
  if (input.customer_id && !customer) throw new Response(JSON.stringify({ code: "CUSTOMER_NOT_FOUND", message: "Select a customer in this organization." }), { status: 422, headers: { "content-type": "application/json" } });
  const updated = { ...input, ...calculateTotals(input), organization_id: profile.organization_id, status: complete ? "COMPLETED" as const : "DRAFT" as const, revision: current.revision + 1, updated_at: now(), completed_at: complete ? now() : null };
  Object.assign(updated, customer ? { customer_name_snapshot: text(customer.name), contact_name_snapshot: text(customer.contact_name), contact_position_snapshot: text(customer.contact_position), contact_mobile_snapshot: text(customer.mobile), contact_office_snapshot: text(customer.office), contact_email_snapshot: text(customer.email), customer_address_snapshot: text(customer.address) } : { customer_name_snapshot: "", contact_name_snapshot: "", contact_position_snapshot: "", contact_mobile_snapshot: "", contact_office_snapshot: "", contact_email_snapshot: "", customer_address_snapshot: "" });
  if (complete) {
    const errors = completionErrors(updated);
    if (errors.length) throw new Response(JSON.stringify({ code: "VALIDATION_FAILED", message: errors.join("\n"), errors }), { status: 422, headers: { "content-type": "application/json" } });
    if (updated.signature) updated.signature.signed_at = updated.updated_at;
  }
  const eventType = complete ? "SERVICE_NOTE_COMPLETED" : "SERVICE_NOTE_UPDATED";
  const statements = [env.DB.prepare("UPDATE service_notes SET status = ?, revision = ?, job_title = ?, job_description = ?, work_performed = ?, result_remarks = ?, additional_notes = ?, service_date = ?, service_time = ?, customer_id = ?, customer_name_snapshot = ?, contact_name_snapshot = ?, contact_position_snapshot = ?, contact_mobile_snapshot = ?, contact_office_snapshot = ?, contact_email_snapshot = ?, customer_address_snapshot = ?, payment_status = ?, payment_method = ?, payment_terms = ?, payment_reference = ?, payment_remarks = ?, labor_total = ?, material_total = ?, additional_charge_total = ?, subtotal = ?, discount_amount = ?, tax_rate = ?, tax_amount = ?, grand_total = ?, signer_name_draft = ?, signer_position_draft = ?, updated_at = ?, completed_at = ? WHERE id = ? AND organization_id = ?").bind(updated.status, updated.revision, updated.job_title, updated.job_description, updated.work_performed, updated.result_remarks, updated.additional_notes, updated.service_date, updated.service_time, updated.customer_id || null, updated.customer_name_snapshot, updated.contact_name_snapshot, updated.contact_position_snapshot, updated.contact_mobile_snapshot, updated.contact_office_snapshot, updated.contact_email_snapshot, updated.customer_address_snapshot, updated.payment_status, updated.payment_method, updated.payment_terms, updated.payment_reference, updated.payment_remarks, updated.labor_total, updated.material_total, updated.additional_charge_total, updated.subtotal, updated.discount_amount, updated.tax_rate, updated.tax_amount, updated.grand_total, updated.signer_name_draft || null, updated.signer_position_draft || null, updated.updated_at, updated.completed_at, updated.id, profile.organization_id)];
  statements.push(...await replaceChildren(updated, profile, user, env));
  statements.push(env.DB.prepare("INSERT INTO audit_events (id, organization_id, note_id, service_number, actor_name, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id(), profile.organization_id, updated.id, updated.service_number, profile.full_name, eventType, updated.updated_at));
  await env.DB.batch(statements);
  const saved = await one(env.DB, "SELECT * FROM service_notes WHERE id = ? AND organization_id = ?", updated.id, profile.organization_id);
  if (!saved) throw new Error("Could not save Service Note");
  return noteFromRow(saved, env.DB);
}
export async function saveCustomer(user: AuthenticatedUser, input: Omit<Customer, "id" | "organization_id" | "created_at"> & { id?: string }, env: Cloudflare.Env): Promise<Customer> {
  const profile = await profileForUser(user, env.DB);
  if (!input.name.trim()) throw new Response(JSON.stringify({ code: "VALIDATION_FAILED", message: "Customer name is required." }), { status: 422, headers: { "content-type": "application/json" } });
  const existing = input.id ? await one(env.DB, "SELECT * FROM customers WHERE id = ? AND organization_id = ?", input.id, profile.organization_id) : undefined;
  if (input.id && !existing) throw new Response(JSON.stringify({ code: "CUSTOMER_NOT_FOUND", message: "Customer not found." }), { status: 404, headers: { "content-type": "application/json" } });
  const customerId = text(existing?.id) || id(), timestamp = text(existing?.created_at) || now();
  await env.DB.prepare("INSERT INTO customers (id, organization_id, name, contact_name, contact_position, mobile, office, email, address, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, contact_name = excluded.contact_name, contact_position = excluded.contact_position, mobile = excluded.mobile, office = excluded.office, email = excluded.email, address = excluded.address, notes = excluded.notes, updated_at = excluded.updated_at").bind(customerId, profile.organization_id, input.name, input.contact_name, input.contact_position, input.mobile, input.office, input.email, input.address, input.notes, timestamp, now()).run();
  const row = await one(env.DB, "SELECT * FROM customers WHERE id = ? AND organization_id = ?", customerId, profile.organization_id);
  if (!row) throw new Error("Could not save customer");
  return customerFromRow(row);
}
export async function saveEmployee(user: AuthenticatedUser, input: Profile, env: Cloudflare.Env) {
  const profile = await profileForUser(user, env.DB);
  if (profile.role !== "ADMIN") throw new Response(JSON.stringify({ code: "FORBIDDEN", message: "Administrator access is required." }), { status: 403, headers: { "content-type": "application/json" } });
  if (!input.full_name.trim() || !input.employee_id.trim() || !input.email.trim()) throw new Response(JSON.stringify({ code: "VALIDATION_FAILED", message: "Name, employee ID and email are required." }), { status: 422, headers: { "content-type": "application/json" } });
  await env.DB.prepare("UPDATE profiles SET full_name = ?, employee_id = ?, job_title = ?, email = ?, mobile = ?, role = ?, status = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(input.full_name, input.employee_id, input.job_title, input.email.toLowerCase(), input.mobile, input.role, input.status, now(), input.id, profile.organization_id).run();
}
export async function saveOrganization(user: AuthenticatedUser, input: Organization, env: Cloudflare.Env) {
  const profile = await profileForUser(user, env.DB);
  if (profile.role !== "ADMIN") throw new Response(JSON.stringify({ code: "FORBIDDEN", message: "Administrator access is required." }), { status: 403, headers: { "content-type": "application/json" } });
  if (!input.name.trim()) throw new Response(JSON.stringify({ code: "VALIDATION_FAILED", message: "Organization name is required." }), { status: 422, headers: { "content-type": "application/json" } });
  await env.DB.prepare("UPDATE organizations SET name = ?, email = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?").bind(input.name, input.email, input.phone, input.address, now(), profile.organization_id).run();
}
