import { cloudflareEnv } from "./cloudflare-runtime";
import { calculateTotals, canAccessNote, completionErrors } from "@/lib/domain";
import type {
  AuditEvent,
  Customer,
  Labor,
  Material,
  Charge,
  Organization,
  Profile,
  ServiceNote,
  Signature,
  WorkspaceData,
} from "@/lib/types";
import type { AccessIdentity } from "./access";

type Row = Record<string, unknown>;
let env = {} as Cloudflare.Env;

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const text = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) => Number(value ?? 0);

function profileFromRow(row: Row): Profile {
  return {
    id: text(row.id), organization_id: text(row.organization_id),
    full_name: text(row.full_name), employee_id: text(row.employee_id),
    job_title: text(row.job_title), email: text(row.email), mobile: text(row.mobile),
    role: text(row.role) as Profile["role"], status: text(row.status) as Profile["status"],
  };
}

function organizationFromRow(row: Row): Organization {
  return {
    id: text(row.id), name: text(row.name), email: text(row.email), phone: text(row.phone),
    address: text(row.address), currency: text(row.currency), timezone: text(row.timezone),
  };
}

function customerFromRow(row: Row): Customer {
  return {
    id: text(row.id), organization_id: text(row.organization_id), name: text(row.name),
    contact_name: text(row.contact_name), contact_position: text(row.contact_position),
    mobile: text(row.mobile), office: text(row.office), email: text(row.email),
    address: text(row.address), notes: text(row.notes), created_at: text(row.created_at),
  };
}

function signatureFromRow(row: Row | undefined): Signature | null {
  if (!row) return null;
  return { signer_name: text(row.signer_name), signer_position: text(row.signer_position),
    image: text(row.image), signed_at: text(row.signed_at) };
}

async function all<T extends Row = Row>(sql: string, ...values: unknown[]) {
  const result = await env.DB.prepare(sql).bind(...values).all<T>();
  return (result.results ?? []) as T[];
}

async function one<T extends Row = Row>(sql: string, ...values: unknown[]) {
  return (await env.DB.prepare(sql).bind(...values).first<T>()) ?? undefined;
}

async function identityProfile(identity: AccessIdentity): Promise<Profile> {
  let row = await one("SELECT * FROM profiles WHERE lower(email) = ? AND status = 'ACTIVE' LIMIT 1", identity.email);
  if (!row && env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase() === identity.email) {
    const organizationId = id(), profileId = identity.subject || id(), timestamp = now();
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO organizations (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(organizationId, env.BOOTSTRAP_ORGANIZATION_NAME || "ServiceLOGME", identity.email, timestamp, timestamp),
      env.DB.prepare("INSERT OR IGNORE INTO profiles (id, organization_id, full_name, employee_id, email, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'ADMIN', 'ACTIVE', ?, ?)")
        .bind(profileId, organizationId, identity.name, `ADMIN-${profileId.slice(0, 8)}`, identity.email, timestamp, timestamp),
    ]);
    row = await one("SELECT * FROM profiles WHERE id = ?", profileId);
  }
  if (!row) throw new Response("No active ServiceLOGME profile is assigned to this account", { status: 403 });
  return profileFromRow(row);
}

async function childRows(noteId: string, organizationId: string) {
  const [labor, materials, charges, photos, signature] = await Promise.all([
    all("SELECT * FROM labor_items WHERE note_id = ? AND organization_id = ? ORDER BY position", noteId, organizationId),
    all("SELECT * FROM material_items WHERE note_id = ? AND organization_id = ? ORDER BY position", noteId, organizationId),
    all("SELECT * FROM charges WHERE note_id = ? AND organization_id = ? ORDER BY position", noteId, organizationId),
    all("SELECT * FROM photos WHERE note_id = ? AND organization_id = ? ORDER BY created_at", noteId, organizationId),
    one("SELECT * FROM signatures WHERE note_id = ? AND organization_id = ?", noteId, organizationId),
  ]);
  return {
    labor: labor.map((r) => ({ id: text(r.id), employee_id: text(r.employee_id) || undefined, name: text(r.name), classification: text(r.classification), hours: text(r.hours), rate: text(r.rate), notes: text(r.notes) } satisfies Labor)),
    materials: materials.map((r) => ({ id: text(r.id), description: text(r.description), part_number: text(r.part_number), quantity: text(r.quantity), unit_amount: text(r.unit_amount), photo_id: text(r.photo_id) || undefined } satisfies Material)),
    charges: charges.map((r) => ({ id: text(r.id), description: text(r.description), amount: text(r.amount) } satisfies Charge)),
    photos: photos.map((r) => ({ id: text(r.id), url: text(r.url) || `/api/files?key=${encodeURIComponent(text(r.object_key))}`, category: text(r.category) as ServiceNote["photos"][number]["category"], caption: text(r.caption), created_at: text(r.created_at), name: text(r.name) })),
    signature: signatureFromRow(signature),
  };
}

async function noteFromRow(row: Row): Promise<ServiceNote> {
  const children = await childRows(text(row.id), text(row.organization_id));
  return {
    id: text(row.id), organization_id: text(row.organization_id), service_number: text(row.service_number),
    status: text(row.status) as ServiceNote["status"], revision: num(row.revision),
    job_title: text(row.job_title), job_description: text(row.job_description), work_performed: text(row.work_performed),
    result_remarks: text(row.result_remarks), additional_notes: text(row.additional_notes), service_date: text(row.service_date), service_time: text(row.service_time),
    person_in_charge_id: text(row.person_in_charge_id), person_in_charge_name_snapshot: text(row.person_in_charge_name_snapshot), person_in_charge_job_title_snapshot: text(row.person_in_charge_job_title_snapshot), person_in_charge_employee_id_snapshot: text(row.person_in_charge_employee_id_snapshot),
    customer_id: text(row.customer_id), customer_name_snapshot: text(row.customer_name_snapshot), contact_name_snapshot: text(row.contact_name_snapshot), contact_position_snapshot: text(row.contact_position_snapshot), contact_mobile_snapshot: text(row.contact_mobile_snapshot), contact_office_snapshot: text(row.contact_office_snapshot), contact_email_snapshot: text(row.contact_email_snapshot), customer_address_snapshot: text(row.customer_address_snapshot),
    payment_status: text(row.payment_status) as ServiceNote["payment_status"], payment_method: text(row.payment_method), payment_terms: text(row.payment_terms), payment_reference: text(row.payment_reference), payment_remarks: text(row.payment_remarks),
    labor_total: text(row.labor_total), material_total: text(row.material_total), additional_charge_total: text(row.additional_charge_total), subtotal: text(row.subtotal), discount_amount: text(row.discount_amount), tax_rate: text(row.tax_rate), tax_amount: text(row.tax_amount), grand_total: text(row.grand_total),
    labor: children.labor, materials: children.materials, charges: children.charges, photos: children.photos,
    signer_name_draft: text(row.signer_name_draft) || undefined, signer_position_draft: text(row.signer_position_draft) || undefined, signature: children.signature,
    created_at: text(row.created_at), updated_at: text(row.updated_at), completed_at: text(row.completed_at) || null,
  };
}

async function rowsForWorkspace(profile: Profile) {
  const [organization, employees, customers, notes, events] = await Promise.all([
    one("SELECT * FROM organizations WHERE id = ?", profile.organization_id),
    all("SELECT * FROM profiles WHERE organization_id = ? ORDER BY full_name", profile.organization_id),
    all("SELECT * FROM customers WHERE organization_id = ? ORDER BY name", profile.organization_id),
    all("SELECT * FROM service_notes WHERE organization_id = ? ORDER BY updated_at DESC", profile.organization_id),
    all("SELECT * FROM audit_events WHERE organization_id = ? ORDER BY created_at DESC", profile.organization_id),
  ]);
  if (!organization) throw new Response("Organization not found", { status: 500 });
  return { organization: organizationFromRow(organization), employees: employees.map(profileFromRow), customers: customers.map(customerFromRow), notes: await Promise.all(notes.map(noteFromRow)), events: events.map((r) => ({ id: text(r.id), note_id: text(r.note_id), service_number: text(r.service_number), actor_name: text(r.actor_name), type: text(r.type) as AuditEvent["type"], created_at: text(r.created_at) })) };
}

export async function readWorkspace(identity: AccessIdentity): Promise<WorkspaceData> {
  env = await cloudflareEnv();
  const profile = await identityProfile(identity);
  return { profile, ...(await rowsForWorkspace(profile)) };
}

export async function createNote(identity: AccessIdentity): Promise<ServiceNote> {
  env = await cloudflareEnv();
  const profile = await identityProfile(identity);
  const timestamp = now(), noteId = id();
  const prefix = `SL-${new Date().getFullYear()}-`;
  const latest = await one("SELECT service_number FROM service_notes WHERE organization_id = ? AND service_number LIKE ? ORDER BY service_number DESC LIMIT 1", profile.organization_id, `${prefix}%`);
  const sequence = latest ? num(text(latest.service_number).slice(prefix.length)) + 1 : 1;
  const serviceNumber = `${prefix}${String(sequence).padStart(6, "0")}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO service_notes (id, organization_id, service_number, status, revision, service_date, service_time, person_in_charge_id, person_in_charge_name_snapshot, person_in_charge_job_title_snapshot, person_in_charge_employee_id_snapshot, payment_status, created_at, updated_at) VALUES (?, ?, ?, 'DRAFT', 0, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?)").bind(noteId, profile.organization_id, serviceNumber, timestamp.slice(0, 10), timestamp.slice(11, 16), profile.id, profile.full_name, profile.job_title, profile.employee_id, timestamp, timestamp),
    env.DB.prepare("INSERT INTO audit_events (id, organization_id, note_id, service_number, actor_name, type, created_at) VALUES (?, ?, ?, ?, ?, 'SERVICE_NOTE_CREATED', ?)").bind(id(), profile.organization_id, noteId, serviceNumber, profile.full_name, timestamp),
  ]);
  const row = await one("SELECT * FROM service_notes WHERE id = ? AND organization_id = ?", noteId, profile.organization_id);
  if (!row) throw new Response("Could not create service note", { status: 500 });
  return noteFromRow(row);
}

async function assertNote(identity: AccessIdentity, input: ServiceNote) {
  const profile = await identityProfile(identity);
  const row = await one("SELECT * FROM service_notes WHERE id = ? AND organization_id = ?", input.id, profile.organization_id);
  if (!row) throw new Response("This Service Note is not available", { status: 404 });
  const current = await noteFromRow(row);
  if (!canAccessNote(profile, current)) throw new Response("This Service Note is not available", { status: 403 });
  return { profile, row, current };
}

async function uploadDataUrl(value: string, key: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return { key: "", url: value };
  if (!env.FILES) throw new Response("File storage is not configured", { status: 503 });
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: match[1] } });
  return { key, url: `/api/files?key=${encodeURIComponent(key)}` };
}

async function replaceChildren(note: ServiceNote, profile: Profile) {
  const statements = [
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
    const itemId = item.id || id();
    const stored = await uploadDataUrl(item.url, `notes/${profile.organization_id}/${note.id}/${itemId}`);
    statements.push(env.DB.prepare("INSERT INTO photos (id, organization_id, note_id, object_key, url, category, caption, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(itemId, profile.organization_id, note.id, stored.key, stored.url, item.category, item.caption, item.name, item.created_at || now()));
  }
  if (note.signature) {
    const stored = await uploadDataUrl(note.signature.image, `notes/${profile.organization_id}/${note.id}/signature-${note.revision}`);
    statements.push(env.DB.prepare("INSERT INTO signatures (note_id, organization_id, signer_name, signer_position, object_key, image, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(note.id, profile.organization_id, note.signature.signer_name, note.signature.signer_position, stored.key || null, stored.url, note.signature.signed_at));
  }
  return statements;
}

export async function saveNote(identity: AccessIdentity, input: ServiceNote, complete = false): Promise<ServiceNote> {
  env = await cloudflareEnv();
  const { profile, current } = await assertNote(identity, input);
  if (current.status === "COMPLETED") throw new Response("Completed Service Notes are read-only", { status: 409 });
  if (current.revision !== input.revision) throw new Response("This Service Note changed in another tab. Reload the saved record before editing again.", { status: 409 });
  const customer = input.customer_id ? await one("SELECT * FROM customers WHERE id = ? AND organization_id = ?", input.customer_id, profile.organization_id) : undefined;
  if (input.customer_id && !customer) throw new Response("Select a customer in this organization", { status: 422 });
  const updated = { ...input, ...calculateTotals(input), organization_id: profile.organization_id, status: complete ? "COMPLETED" as const : "DRAFT" as const, revision: current.revision + 1, updated_at: now(), completed_at: complete ? now() : null };
  if (customer) {
    updated.customer_name_snapshot = text(customer.name);
    updated.contact_name_snapshot = text(customer.contact_name);
    updated.contact_position_snapshot = text(customer.contact_position);
    updated.contact_mobile_snapshot = text(customer.mobile);
    updated.contact_office_snapshot = text(customer.office);
    updated.contact_email_snapshot = text(customer.email);
    updated.customer_address_snapshot = text(customer.address);
  } else {
    updated.customer_name_snapshot = "";
    updated.contact_name_snapshot = "";
    updated.contact_position_snapshot = "";
    updated.contact_mobile_snapshot = "";
    updated.contact_office_snapshot = "";
    updated.contact_email_snapshot = "";
    updated.customer_address_snapshot = "";
  }
  if (complete) {
    const errors = completionErrors(updated);
    if (errors.length) throw new Response(JSON.stringify({ message: errors.join("\n"), errors }), { status: 422, headers: { "content-type": "application/json" } });
    if (updated.signature) updated.signature.signed_at = updated.updated_at;
  }
  const eventType = complete ? "SERVICE_NOTE_COMPLETED" : "SERVICE_NOTE_UPDATED";
  const statements = await replaceChildren(updated, profile);
  statements.push(env.DB.prepare("UPDATE service_notes SET status = ?, revision = ?, job_title = ?, job_description = ?, work_performed = ?, result_remarks = ?, additional_notes = ?, service_date = ?, service_time = ?, customer_id = ?, customer_name_snapshot = ?, contact_name_snapshot = ?, contact_position_snapshot = ?, contact_mobile_snapshot = ?, contact_office_snapshot = ?, contact_email_snapshot = ?, customer_address_snapshot = ?, payment_status = ?, payment_method = ?, payment_terms = ?, payment_reference = ?, payment_remarks = ?, labor_total = ?, material_total = ?, additional_charge_total = ?, subtotal = ?, discount_amount = ?, tax_rate = ?, tax_amount = ?, grand_total = ?, signer_name_draft = ?, signer_position_draft = ?, updated_at = ?, completed_at = ? WHERE id = ? AND organization_id = ? AND revision = ?").bind(updated.status, updated.revision, updated.job_title, updated.job_description, updated.work_performed, updated.result_remarks, updated.additional_notes, updated.service_date, updated.service_time, updated.customer_id || null, updated.customer_name_snapshot, updated.contact_name_snapshot, updated.contact_position_snapshot, updated.contact_mobile_snapshot, updated.contact_office_snapshot, updated.contact_email_snapshot, updated.customer_address_snapshot, updated.payment_status, updated.payment_method, updated.payment_terms, updated.payment_reference, updated.payment_remarks, updated.labor_total, updated.material_total, updated.additional_charge_total, updated.subtotal, updated.discount_amount, updated.tax_rate, updated.tax_amount, updated.grand_total, updated.signer_name_draft || null, updated.signer_position_draft || null, updated.updated_at, updated.completed_at, updated.id, profile.organization_id, current.revision));
  statements.push(env.DB.prepare("INSERT INTO audit_events (id, organization_id, note_id, service_number, actor_name, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id(), profile.organization_id, updated.id, updated.service_number, profile.full_name, eventType, updated.updated_at));
  await env.DB.batch(statements);
  const saved = await one("SELECT * FROM service_notes WHERE id = ? AND organization_id = ?", updated.id, profile.organization_id);
  if (!saved) throw new Response("Could not save service note", { status: 500 });
  return noteFromRow(saved);
}

export async function saveCustomer(identity: AccessIdentity, input: Omit<Customer, "id" | "organization_id" | "created_at"> & { id?: string }): Promise<Customer> {
  env = await cloudflareEnv();
  const profile = await identityProfile(identity);
  if (!input.name.trim()) throw new Response("Customer name is required", { status: 422 });
  const existing = input.id ? await one("SELECT * FROM customers WHERE id = ? AND organization_id = ?", input.id, profile.organization_id) : undefined;
  if (input.id && !existing) throw new Response("Customer not found", { status: 404 });
  const customerId = text(existing?.id) || id(), timestamp = text(existing?.created_at) || now();
  await env.DB.prepare("INSERT INTO customers (id, organization_id, name, contact_name, contact_position, mobile, office, email, address, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, contact_name = excluded.contact_name, contact_position = excluded.contact_position, mobile = excluded.mobile, office = excluded.office, email = excluded.email, address = excluded.address, notes = excluded.notes, updated_at = excluded.updated_at").bind(customerId, profile.organization_id, input.name, input.contact_name, input.contact_position, input.mobile, input.office, input.email, input.address, input.notes, timestamp, now()).run();
  const row = await one("SELECT * FROM customers WHERE id = ? AND organization_id = ?", customerId, profile.organization_id);
  if (!row) throw new Response("Could not save customer", { status: 500 });
  return customerFromRow(row);
}

export async function saveEmployee(identity: AccessIdentity, input: Profile) {
  env = await cloudflareEnv();
  const profile = await identityProfile(identity);
  if (profile.role !== "ADMIN" || profile.status !== "ACTIVE") throw new Response("Administrator access is required", { status: 403 });
  if (!input.full_name.trim() || !input.employee_id.trim() || !input.email.trim()) throw new Response("Name, employee ID and email are required", { status: 422 });
  await env.DB.prepare("UPDATE profiles SET full_name = ?, employee_id = ?, job_title = ?, email = ?, mobile = ?, role = ?, status = ?, updated_at = ? WHERE id = ? AND organization_id = ?").bind(input.full_name, input.employee_id, input.job_title, input.email.toLowerCase(), input.mobile, input.role, input.status, now(), input.id, profile.organization_id).run();
}

export async function saveOrganization(identity: AccessIdentity, input: Organization) {
  env = await cloudflareEnv();
  const profile = await identityProfile(identity);
  if (profile.role !== "ADMIN") throw new Response("Administrator access is required", { status: 403 });
  if (!input.name.trim()) throw new Response("Organization name is required", { status: 422 });
  await env.DB.prepare("UPDATE organizations SET name = ?, email = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?").bind(input.name, input.email, input.phone, input.address, now(), profile.organization_id).run();
}
