import { type ExtendedEnv } from "./cloudflare-runtime";
import {
  calculateTotals,
  canAccessNote,
  completionErrors,
  evidenceAcknowledgementStatement,
} from "@/lib/domain";
import type {
  AuditEvent,
  Charge,
  Customer,
  Labor,
  Material,
  Organization,
  Profile,
  ReportPage,
  ReportQuery,
  ServiceNote,
  Signature,
  TrackedItem,
  WorkspaceData,
} from "@/lib/types";
import type { D1Database } from "@cloudflare/workers-types";
import type { AuthenticatedUser } from "./auth";
import { validateMediaUpload } from "./media";
import { CloudflareEvidenceImageProcessor } from "./evidence-image-processor";

type Row = Record<string, unknown>;
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const text = (value: unknown) => (typeof value === "string" ? value : "");
const num = (value: unknown) => Number(value ?? 0);

function profileFromRow(row: Row): Profile {
  return {
    id: text(row.id),
    organization_id: text(row.organization_id),
    full_name: text(row.full_name),
    employee_id: text(row.employee_id),
    job_title: text(row.job_title),
    email: text(row.email),
    mobile: text(row.mobile),
    role: text(row.role) as Profile["role"],
    status: text(row.status) as Profile["status"],
  };
}
function organizationFromRow(row: Row): Organization {
  return {
    id: text(row.id),
    name: text(row.name),
    email: text(row.email),
    phone: text(row.phone),
    address: text(row.address),
    currency: text(row.currency),
    timezone: text(row.timezone),
  };
}
function customerFromRow(row: Row): Customer {
  return {
    id: text(row.id),
    organization_id: text(row.organization_id),
    name: text(row.name),
    contact_name: text(row.contact_name),
    contact_position: text(row.contact_position),
    contact_number:
      text(row.contact_number) || text(row.mobile) || text(row.office),
    mobile: text(row.mobile),
    office: text(row.office),
    email: text(row.email),
    address: text(row.address),
    notes: text(row.notes),
    created_at: text(row.created_at),
  };
}
function trackedItemFromRow(row: Row): TrackedItem {
  return {
    id: text(row.id),
    organization_id: text(row.organization_id),
    customer_id: text(row.customer_id) || undefined,
    name: text(row.name),
    reference: text(row.reference),
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}
function signatureFromRow(row: Row | undefined): Signature | null {
  if (!row) return null;
  return {
    signer_name: text(row.signer_name),
    signer_position: text(row.signer_position),
    image: text(row.image),
    signed_at: text(row.signed_at),
    file_id: text(row.file_id) || undefined,
  };
}
async function all<T extends Row = Row>(
  db: D1Database,
  sql: string,
  ...values: unknown[]
) {
  const result = await db
    .prepare(sql)
    .bind(...values)
    .all<T>();
  return (result.results ?? []) as T[];
}
async function one<T extends Row = Row>(
  db: D1Database,
  sql: string,
  ...values: unknown[]
) {
  return (
    (await db
      .prepare(sql)
      .bind(...values)
      .first<T>()) ?? undefined
  );
}
async function profileForUser(user: AuthenticatedUser, db: D1Database) {
  const row = await one(
    db,
    "SELECT * FROM profiles WHERE id = ? AND organization_id = ? AND status = 'ACTIVE'",
    user.profileId,
    user.organizationId,
  );
  if (!row)
    throw new Response(
      JSON.stringify({
        code: "PROFILE_UNAVAILABLE",
        message: "Your workspace profile is unavailable.",
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  return profileFromRow(row);
}
async function childRows(
  noteId: string,
  organizationId: string,
  db: D1Database,
) {
  const [labor, materials, charges, photos, evidencePhotos, signature] =
    await Promise.all([
      all(
        db,
        "SELECT * FROM labor_items WHERE note_id = ? AND organization_id = ? ORDER BY position",
        noteId,
        organizationId,
      ),
      all(
        db,
        "SELECT * FROM material_items WHERE note_id = ? AND organization_id = ? ORDER BY position",
        noteId,
        organizationId,
      ),
      all(
        db,
        "SELECT * FROM charges WHERE note_id = ? AND organization_id = ? ORDER BY position",
        noteId,
        organizationId,
      ),
      all(
        db,
        "SELECT * FROM photos WHERE note_id = ? AND organization_id = ? ORDER BY created_at",
        noteId,
        organizationId,
      ),
      all(
        db,
        "SELECT * FROM report_photo_evidence WHERE report_id = ? AND organization_id = ? ORDER BY position, server_uploaded_at",
        noteId,
        organizationId,
      ),
      one(
        db,
        "SELECT * FROM signatures WHERE note_id = ? AND organization_id = ?",
        noteId,
        organizationId,
      ),
    ]);
  return {
    labor: labor.map(
      (r) =>
        ({
          id: text(r.id),
          employee_id: text(r.employee_id) || undefined,
          name: text(r.name),
          classification: text(r.classification),
          hours: text(r.hours),
          rate: text(r.rate),
          notes: text(r.notes),
        }) satisfies Labor,
    ),
    materials: materials.map(
      (r) =>
        ({
          id: text(r.id),
          description: text(r.description),
          part_number: text(r.part_number),
          quantity: text(r.quantity),
          unit_amount: text(r.unit_amount),
          photo_id: text(r.photo_id) || undefined,
        }) satisfies Material,
    ),
    charges: charges.map(
      (r) =>
        ({
          id: text(r.id),
          description: text(r.description),
          amount: text(r.amount),
        }) satisfies Charge,
    ),
    photos: evidencePhotos.length
      ? evidencePhotos.map((r) => ({
          id: text(r.id),
          url: `/api/report-photos/${encodeURIComponent(text(r.id))}/${text(r.derivative_object_key) ? "derivative" : "original"}`,
          original_url: `/api/report-photos/${encodeURIComponent(text(r.id))}/original`,
          original_sha256: text(r.original_sha256),
          derivative_sha256: text(r.derivative_sha256) || undefined,
          source: text(
            r.source_intent,
          ) as ServiceNote["photos"][number]["source"],
          uploaded_by_id: text(r.uploader_id),
          uploaded_by_name_snapshot: text(r.uploader_name_snapshot),
          category: "OTHER" as const,
          caption: text(r.caption),
          created_at: text(r.server_uploaded_at),
          name: text(r.original_filename),
          gps_latitude:
            r.gps_latitude == null ? undefined : num(r.gps_latitude),
          gps_longitude:
            r.gps_longitude == null ? undefined : num(r.gps_longitude),
          gps_accuracy:
            r.gps_accuracy == null ? undefined : num(r.gps_accuracy),
          gps_device_timestamp: text(r.gps_device_timestamp) || undefined,
        }))
      : photos.map((r) => ({
          id: text(r.id),
          url:
            text(r.url) ||
            `/api/files/${encodeURIComponent(text(r.file_id || r.object_key))}`,
          category: text(
            r.category,
          ) as ServiceNote["photos"][number]["category"],
          caption: text(r.caption),
          created_at: text(r.created_at),
          name: text(r.name),
          file_id: text(r.file_id) || undefined,
        })),
    signature: signatureFromRow(signature),
  };
}
async function noteFromRow(row: Row, db: D1Database): Promise<ServiceNote> {
  const children = await childRows(text(row.id), text(row.organization_id), db);
  return {
    id: text(row.id),
    organization_id: text(row.organization_id),
    service_number: text(row.service_number),
    schema_version: (num(row.schema_version) || 1) as 1 | 2,
    status: text(row.status) as ServiceNote["status"],
    revision: num(row.revision),
    record_type: text(row.record_type) as ServiceNote["record_type"],
    tracked_item_id: text(row.tracked_item_id) || undefined,
    item_name_snapshot: text(row.item_name_snapshot),
    item_reference_snapshot: text(row.item_reference_snapshot),
    location_snapshot: text(row.location_snapshot),
    contact_number_snapshot: text(row.contact_number_snapshot),
    invoice_number: text(row.invoice_number),
    delivery_number: text(row.delivery_number),
    quantity: text(row.quantity) || "1",
    brand: text(row.brand),
    model: text(row.model),
    declared_total_value: text(row.declared_total_value),
    declared_currency: text(row.declared_currency),
    condition_code: text(row.condition_code) as ServiceNote["condition_code"],
    condition_remarks: text(row.condition_remarks),
    organization_name_snapshot: text(row.organization_name_snapshot),
    organization_email_snapshot: text(row.organization_email_snapshot),
    organization_phone_snapshot: text(row.organization_phone_snapshot),
    organization_address_snapshot: text(row.organization_address_snapshot),
    organization_timezone_snapshot: text(row.organization_timezone_snapshot),
    acknowledgement_text_snapshot: text(row.acknowledgement_text_snapshot),
    acknowledgement_enabled: Boolean(num(row.acknowledgement_enabled)),
    billing_enabled: Boolean(num(row.billing_enabled)),
    finalization_type: text(
      row.finalization_type,
    ) as ServiceNote["finalization_type"],
    staff_attested_at: text(row.staff_attested_at) || undefined,
    job_title: text(row.job_title),
    job_description: text(row.job_description),
    work_performed: text(row.work_performed),
    result_remarks: text(row.result_remarks),
    additional_notes: text(row.additional_notes),
    service_date: text(row.service_date),
    service_time: text(row.service_time),
    person_in_charge_id: text(row.person_in_charge_id),
    person_in_charge_name_snapshot: text(row.person_in_charge_name_snapshot),
    person_in_charge_job_title_snapshot: text(
      row.person_in_charge_job_title_snapshot,
    ),
    person_in_charge_employee_id_snapshot: text(
      row.person_in_charge_employee_id_snapshot,
    ),
    customer_id: text(row.customer_id),
    customer_name_snapshot: text(row.customer_name_snapshot),
    contact_name_snapshot: text(row.contact_name_snapshot),
    contact_position_snapshot: text(row.contact_position_snapshot),
    contact_mobile_snapshot: text(row.contact_mobile_snapshot),
    contact_office_snapshot: text(row.contact_office_snapshot),
    contact_email_snapshot: text(row.contact_email_snapshot),
    customer_address_snapshot: text(row.customer_address_snapshot),
    payment_status: text(row.payment_status) as ServiceNote["payment_status"],
    payment_method: text(row.payment_method),
    payment_terms: text(row.payment_terms),
    payment_reference: text(row.payment_reference),
    payment_remarks: text(row.payment_remarks),
    labor_total: text(row.labor_total),
    material_total: text(row.material_total),
    additional_charge_total: text(row.additional_charge_total),
    subtotal: text(row.subtotal),
    discount_amount: text(row.discount_amount),
    tax_rate: text(row.tax_rate),
    tax_amount: text(row.tax_amount),
    grand_total: text(row.grand_total),
    labor: children.labor,
    materials: children.materials,
    charges: children.charges,
    photos: children.photos,
    signer_name_draft: text(row.signer_name_draft) || undefined,
    signer_position_draft: text(row.signer_position_draft) || undefined,
    signature: children.signature,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
    completed_at: text(row.completed_at) || null,
  };
}
async function rowsForWorkspace(profile: Profile, db: D1Database) {
  const [organization, employees, customers, trackedItems, noteRows, events] =
    await Promise.all([
      one(
        db,
        "SELECT * FROM organizations WHERE id = ?",
        profile.organization_id,
      ),
      all(
        db,
        "SELECT * FROM profiles WHERE organization_id = ? ORDER BY full_name",
        profile.organization_id,
      ),
      all(
        db,
        "SELECT * FROM customers WHERE organization_id = ? ORDER BY name",
        profile.organization_id,
      ),
      all(
        db,
        "SELECT * FROM tracked_items WHERE organization_id = ? ORDER BY reference",
        profile.organization_id,
      ),
      all(
        db,
        `SELECT * FROM service_notes WHERE organization_id = ? ${profile.role === "ADMIN" ? "" : "AND person_in_charge_id = ?"} ORDER BY updated_at DESC`,
        ...(profile.role === "ADMIN"
          ? [profile.organization_id]
          : [profile.organization_id, profile.id]),
      ),
      all(
        db,
        `SELECT * FROM audit_events WHERE organization_id = ? ${profile.role === "ADMIN" ? "" : "AND note_id IN (SELECT id FROM service_notes WHERE organization_id = ? AND person_in_charge_id = ?)"} ORDER BY created_at DESC`,
        ...(profile.role === "ADMIN"
          ? [profile.organization_id]
          : [profile.organization_id, profile.organization_id, profile.id]),
      ),
    ]);
  if (!organization) throw new Error("Organization not found");
  return {
    organization: organizationFromRow(organization),
    employees: employees.map(profileFromRow),
    customers: customers.map(customerFromRow),
    tracked_items: trackedItems.map(trackedItemFromRow),
    notes: await Promise.all(noteRows.map((row) => noteFromRow(row, db))),
    events: events.map((r) => ({
      id: text(r.id),
      note_id: text(r.note_id),
      service_number: text(r.service_number),
      actor_name: text(r.actor_name),
      type: text(r.type) as AuditEvent["type"],
      created_at: text(r.created_at),
    })),
  };
}
export async function readWorkspace(
  user: AuthenticatedUser,
  env: ExtendedEnv,
): Promise<WorkspaceData> {
  const profile = await profileForUser(user, env.DB);
  return { profile, ...(await rowsForWorkspace(profile, env.DB)) };
}
export async function listReports(
  user: AuthenticatedUser,
  query: ReportQuery,
  env: ExtendedEnv,
): Promise<ReportPage> {
  const profile = await profileForUser(user, env.DB);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const page = Math.max(1, Number(query.page) || 1);
  const conditions = ["n.organization_id = ?", "n.schema_version = 2"];
  const values: unknown[] = [profile.organization_id];
  if (profile.role !== "ADMIN") {
    conditions.push("n.person_in_charge_id = ?");
    values.push(profile.id);
  }
  if (query.status === "DRAFT" || query.status === "COMPLETED") {
    conditions.push("n.status = ?");
    values.push(query.status);
  }
  if (query.employee) {
    conditions.push("n.person_in_charge_id = ?");
    values.push(query.employee);
  }
  if (query.customer) {
    conditions.push("n.customer_id = ?");
    values.push(query.customer);
  }
  if (query.from) {
    conditions.push("substr(n.created_at, 1, 10) >= ?");
    values.push(query.from);
  }
  if (query.to) {
    conditions.push("substr(n.created_at, 1, 10) <= ?");
    values.push(query.to);
  }
  let join = "";
  const terms =
    (query.q || "")
      .trim()
      .toLowerCase()
      .match(/[\p{L}\p{N}_-]+/gu)
      ?.slice(0, 8) || [];
  if (terms.length) {
    join =
      "JOIN report_search ON report_search.report_id = n.id AND report_search.organization_id = n.organization_id";
    conditions.push("report_search MATCH ?");
    values.push(
      terms.map((term) => `\"${term.replaceAll('"', '""')}\"*`).join(" AND "),
    );
  }
  const where = conditions.join(" AND ");
  const count = await one<{ total: number }>(
    env.DB,
    `SELECT COUNT(*) AS total FROM service_notes n ${join} WHERE ${where}`,
    ...values,
  );
  const rows = await all(
    env.DB,
    `SELECT n.* FROM service_notes n ${join} WHERE ${where} ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`,
    ...values,
    pageSize,
    (page - 1) * pageSize,
  );
  return {
    reports: await Promise.all(rows.map((row) => noteFromRow(row, env.DB))),
    total: Number(count?.total || 0),
    page,
    pageSize,
  };
}
export async function createNote(
  user: AuthenticatedUser,
  env: ExtendedEnv,
): Promise<ServiceNote> {
  const profile = await profileForUser(user, env.DB);
  const timestamp = now(),
    noteId = id(),
    prefix = `SL-${new Date().getFullYear()}-`;
  const organization = await one(
    env.DB,
    "SELECT * FROM organizations WHERE id = ?",
    profile.organization_id,
  );
  if (!organization) throw new Error("Organization not found");
  const latest = await one(
    env.DB,
    "SELECT service_number FROM service_notes WHERE organization_id = ? AND service_number LIKE ? ORDER BY service_number DESC LIMIT 1",
    profile.organization_id,
    `${prefix}%`,
  );
  const sequence = latest
    ? num(text(latest.service_number).slice(prefix.length)) + 1
    : 1;
  const serviceNumber = `${prefix}${String(sequence).padStart(6, "0")}`;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO service_notes (id, organization_id, service_number, schema_version, status, revision, quantity, billing_enabled, finalization_type, person_in_charge_id, person_in_charge_name_snapshot, person_in_charge_job_title_snapshot, person_in_charge_employee_id_snapshot, organization_name_snapshot, organization_email_snapshot, organization_phone_snapshot, organization_address_snapshot, organization_timezone_snapshot, payment_status, created_at, updated_at) VALUES (?, ?, ?, 2, 'DRAFT', 0, '1', 0, 'STAFF_ATTESTED', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?)",
    ).bind(
      noteId,
      profile.organization_id,
      serviceNumber,
      profile.id,
      profile.full_name,
      profile.job_title,
      profile.employee_id,
      text(organization.name),
      text(organization.email),
      text(organization.phone),
      text(organization.address),
      text(organization.timezone),
      timestamp,
      timestamp,
    ),
    env.DB.prepare(
      "INSERT INTO audit_events (id, organization_id, note_id, service_number, actor_name, type, created_at) VALUES (?, ?, ?, ?, ?, 'SERVICE_NOTE_CREATED', ?)",
    ).bind(
      id(),
      profile.organization_id,
      noteId,
      serviceNumber,
      profile.full_name,
      timestamp,
    ),
  ]);
  const row = await one(
    env.DB,
    "SELECT * FROM service_notes WHERE id = ? AND organization_id = ?",
    noteId,
    profile.organization_id,
  );
  if (!row) throw new Error("Could not create Report");
  return noteFromRow(row, env.DB);
}
async function assertNote(
  user: AuthenticatedUser,
  input: ServiceNote,
  db: D1Database,
) {
  const profile = await profileForUser(user, db);
  const row = await one(
    db,
    "SELECT * FROM service_notes WHERE id = ? AND organization_id = ?",
    input.id,
    profile.organization_id,
  );
  if (!row)
    throw new Response(
      JSON.stringify({
        code: "NOTE_NOT_FOUND",
        message: "This Service Note is not available.",
      }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  const current = await noteFromRow(row, db);
  if (!canAccessNote(profile, current))
    throw new Response(
      JSON.stringify({
        code: "FORBIDDEN",
        message: "This Service Note is not available.",
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  return { profile, current };
}
function dataUrlBytes(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    bytes: Uint8Array.from(atob(match[2]), (character) =>
      character.charCodeAt(0),
    ),
  };
}
async function storeDataUrl(
  value: string,
  purpose: "photo" | "signature",
  user: AuthenticatedUser,
  db: D1Database,
) {
  const parsed = dataUrlBytes(value);
  if (!parsed) return { fileId: "", url: value };
  validateMediaUpload(parsed.contentType, parsed.bytes.byteLength, purpose);
  const fileId = id(),
    timestamp = now();
  const buffer = parsed.bytes.buffer.slice(
    parsed.bytes.byteOffset,
    parsed.bytes.byteOffset + parsed.bytes.byteLength,
  ) as ArrayBuffer;
  const checksum = await crypto.subtle.digest("SHA-256", buffer);
  const checksumHex = [...new Uint8Array(checksum)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  await db
    .prepare(
      "INSERT INTO stored_files (id, organization_id, storage_driver, object_key, content, content_type, byte_size, checksum, uploaded_by, created_at) VALUES (?, ?, 'D1', ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      fileId,
      user.organizationId,
      `d1:${fileId}`,
      buffer,
      parsed.contentType,
      parsed.bytes.byteLength,
      checksumHex,
      user.profileId,
      timestamp,
    )
    .run();
  return { fileId, url: `/api/files/${fileId}` };
}
async function existingMediaRef(
  fileId: string | undefined,
  value: string,
  user: AuthenticatedUser,
  db: D1Database,
  purpose: "photo" | "signature",
) {
  if (!fileId) return null;
  const row = await one(
    db,
    "SELECT id, content_type, byte_size FROM stored_files WHERE id = ? AND organization_id = ?",
    fileId,
    user.organizationId,
  );
  if (!row)
    throw new Response(
      JSON.stringify({
        code: "FILE_NOT_FOUND",
        message: "The uploaded file is no longer available.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  validateMediaUpload(text(row.content_type), num(row.byte_size), purpose);
  return { fileId, url: value };
}
async function replaceChildren(
  note: ServiceNote,
  profile: Profile,
  user: AuthenticatedUser,
  env: ExtendedEnv,
) {
  const statements = [
    env.DB.prepare(
      "UPDATE stored_files SET attached_at = NULL WHERE organization_id = ? AND (id IN (SELECT file_id FROM photos WHERE note_id = ? AND organization_id = ?) OR id IN (SELECT file_id FROM signatures WHERE note_id = ? AND organization_id = ?))",
    ).bind(
      profile.organization_id,
      note.id,
      profile.organization_id,
      note.id,
      profile.organization_id,
    ),
    env.DB.prepare(
      "DELETE FROM labor_items WHERE note_id = ? AND organization_id = ?",
    ).bind(note.id, profile.organization_id),
    env.DB.prepare(
      "DELETE FROM material_items WHERE note_id = ? AND organization_id = ?",
    ).bind(note.id, profile.organization_id),
    env.DB.prepare(
      "DELETE FROM charges WHERE note_id = ? AND organization_id = ?",
    ).bind(note.id, profile.organization_id),
    env.DB.prepare(
      "DELETE FROM photos WHERE note_id = ? AND organization_id = ?",
    ).bind(note.id, profile.organization_id),
    env.DB.prepare(
      "DELETE FROM signatures WHERE note_id = ? AND organization_id = ?",
    ).bind(note.id, profile.organization_id),
  ];
  note.labor.forEach((item, position) =>
    statements.push(
      env.DB.prepare(
        "INSERT INTO labor_items (id, organization_id, note_id, employee_id, name, classification, hours, rate, notes, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        item.id || id(),
        profile.organization_id,
        note.id,
        item.employee_id || null,
        item.name,
        item.classification,
        item.hours,
        item.rate,
        item.notes,
        position,
      ),
    ),
  );
  note.materials.forEach((item, position) =>
    statements.push(
      env.DB.prepare(
        "INSERT INTO material_items (id, organization_id, note_id, description, part_number, quantity, unit_amount, photo_id, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        item.id || id(),
        profile.organization_id,
        note.id,
        item.description,
        item.part_number,
        item.quantity,
        item.unit_amount,
        item.photo_id || null,
        position,
      ),
    ),
  );
  note.charges.forEach((item, position) =>
    statements.push(
      env.DB.prepare(
        "INSERT INTO charges (id, organization_id, note_id, description, amount, position) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(
        item.id || id(),
        profile.organization_id,
        note.id,
        item.description,
        item.amount,
        position,
      ),
    ),
  );
  for (const item of note.photos) {
    const stored =
      (await existingMediaRef(item.file_id, item.url, user, env.DB, "photo")) ??
      (await storeDataUrl(item.url, "photo", user, env.DB));
    if (stored.fileId)
      statements.push(
        env.DB.prepare(
          "UPDATE stored_files SET attached_at = ? WHERE id = ? AND organization_id = ?",
        ).bind(now(), stored.fileId, profile.organization_id),
      );
    statements.push(
      env.DB.prepare(
        "INSERT INTO photos (id, organization_id, note_id, object_key, url, file_id, category, caption, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        item.id || id(),
        profile.organization_id,
        note.id,
        stored.fileId ? `d1:${stored.fileId}` : "inline",
        stored.url,
        stored.fileId || null,
        item.category,
        item.caption,
        item.name,
        item.created_at || now(),
      ),
    );
  }
  if (note.signature) {
    const stored =
      (await existingMediaRef(
        note.signature.file_id,
        note.signature.image,
        user,
        env.DB,
        "signature",
      )) ??
      (await storeDataUrl(note.signature.image, "signature", user, env.DB));
    if (stored.fileId)
      statements.push(
        env.DB.prepare(
          "UPDATE stored_files SET attached_at = ? WHERE id = ? AND organization_id = ?",
        ).bind(now(), stored.fileId, profile.organization_id),
      );
    statements.push(
      env.DB.prepare(
        "INSERT INTO signatures (note_id, organization_id, signer_name, signer_position, object_key, image, file_id, signed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        note.id,
        profile.organization_id,
        note.signature.signer_name,
        note.signature.signer_position,
        stored.fileId ? `d1:${stored.fileId}` : null,
        stored.url,
        stored.fileId || null,
        note.signature.signed_at,
      ),
    );
  }
  return statements;
}

// Compute a deterministic hash of watermark-relevant context
// This ensures derivatives are only reused when they match the current report state
function derivativeContextHash(
  reportNumber: string,
  uploadedAt: string,
  employeeName: string,
  location: string,
  gpsLatitude: number | null,
  gpsLongitude: number | null,
): string {
  const context = JSON.stringify({
    reportNumber,
    uploadedAt,
    employeeName,
    location,
    gps: gpsLatitude != null && gpsLongitude != null
      ? { lat: gpsLatitude, lng: gpsLongitude }
      : null,
  });
  // Simple deterministic hash (for integrity, not security)
  let hash = 0;
  for (let i = 0; i < context.length; i++) {
    hash = ((hash << 5) - hash) + context.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

async function finalizeEvidencePhotos(
  report: ServiceNote,
  env: ExtendedEnv,
) {
  const processor = new CloudflareEvidenceImageProcessor(env.IMAGES);
  const rows = await all(
    env.DB,
    "SELECT * FROM report_photo_evidence WHERE report_id = ? AND organization_id = ? ORDER BY position, server_uploaded_at",
    report.id,
    report.organization_id,
  );
  if (!rows.length) return;
  
  const location = report.location_snapshot || "Location not recorded";
  const employeeName = report.person_in_charge_name_snapshot;
  const reportNumber = report.service_number;
  
  for (const row of rows) {
    const original = await env.REPORT_MEDIA.get(text(row.original_object_key));
    if (!original || !/^[a-f0-9]{64}$/i.test(text(row.original_sha256)))
      throw new Response(
        JSON.stringify({
          code: "EVIDENCE_UNAVAILABLE",
          message:
            "An original evidence photo is unavailable. Retry the upload before submitting.",
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      );
    
    const uploaded = new Intl.DateTimeFormat("en-MY", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: report.organization_timezone_snapshot || "UTC",
    }).format(new Date(text(row.server_uploaded_at)));
    
    // Compute context hash for this derivative
    const contextHash = derivativeContextHash(
      reportNumber,
      uploaded,
      employeeName,
      location,
      row.gps_latitude != null ? num(row.gps_latitude) : null,
      row.gps_longitude != null ? num(row.gps_longitude) : null,
    );
    
    // Check if existing derivative matches current watermark context
    const existingDerivativeKey = text(row.derivative_object_key);
    if (existingDerivativeKey) {
      // Derivative key encodes context hash to ensure integrity
      if (existingDerivativeKey.includes(`-${contextHash}.jpg`)) {
        if (await env.REPORT_MEDIA.head(existingDerivativeKey)) {
          // Derivative exists and matches current context - reuse it
          continue;
        }
      }
      // Stale derivative exists - will be replaced
    }
    
    const derivative = await processor.createDerivative(original.body, {
      reportNumber,
      uploadedAt: uploaded,
      employeeName,
      location,
      ...(row.gps_latitude != null && row.gps_longitude != null
        ? { gps: { latitude: num(row.gps_latitude), longitude: num(row.gps_longitude) } }
        : {}),
    });
    
    // Include context hash in derivative key to prevent stale reuse
    const derivativeKey = `reports/${report.organization_id}/${report.id}/derivatives/${text(row.id)}-${contextHash}.jpg`;
    await env.REPORT_MEDIA.put(derivativeKey, derivative.bytes, {
      sha256: derivative.sha256,
      httpMetadata: { contentType: derivative.contentType },
    });
    await env.DB.prepare(
      "UPDATE report_photo_evidence SET derivative_object_key = ?, derivative_content_type = ?, derivative_byte_size = ?, derivative_sha256 = ? WHERE id = ? AND report_id = ? AND organization_id = ?",
    )
      .bind(
        derivativeKey,
        derivative.contentType,
        derivative.bytes.byteLength,
        derivative.sha256,
        text(row.id),
        report.id,
        report.organization_id,
      )
      .run();
  }
}

async function saveEvidenceNote(
  user: AuthenticatedUser,
  input: ServiceNote,
  complete: boolean,
  env: ExtendedEnv,
) {
  let { profile, current } = await assertNote(user, input, env.DB);
  if (current.status === "COMPLETED") {
    if (complete) return current;
    throw new Response(
      JSON.stringify({
        code: "REPORT_COMPLETED",
        message: "Completed Reports are read-only.",
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }
  if (current.revision !== input.revision)
    throw new Response(
      JSON.stringify({
        code: "REVISION_CONFLICT",
        message:
          "This Report changed in another tab. Reload the saved record before editing again.",
        currentRevision: current.revision,
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  if (
    input.labor.length ||
    input.materials.length ||
    input.charges.length ||
    input.job_title ||
    input.job_description ||
    input.work_performed ||
    input.result_remarks ||
    input.tracked_item_id ||
    input.record_type ||
    input.payment_method ||
    input.payment_reference ||
    input.payment_remarks ||
    input.payment_terms ||
    input.billing_enabled
  )
    throw new Response(
      JSON.stringify({
        code: "LEGACY_FIELDS_REJECTED",
        message:
          "Service, labour, material and payment fields are not accepted by evidence reports.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  const customer = input.customer_id
    ? await one(
        env.DB,
        "SELECT id FROM customers WHERE id = ? AND organization_id = ?",
        input.customer_id,
        profile.organization_id,
      )
    : undefined;
  if (input.customer_id && !customer)
    throw new Response(
      JSON.stringify({
        code: "CUSTOMER_NOT_FOUND",
        message: "Select a customer in this organization.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  const timestamp = now();
  const updated: ServiceNote = {
    ...current,
    customer_id: input.customer_id,
    customer_name_snapshot: input.customer_name_snapshot.trim(),
    contact_number_snapshot: input.contact_number_snapshot?.trim() || "",
    contact_name_snapshot: input.contact_name_snapshot.trim(),
    contact_email_snapshot: input.contact_email_snapshot.trim(),
    customer_address_snapshot: input.customer_address_snapshot.trim(),
    invoice_number: input.invoice_number?.trim() || "",
    delivery_number: input.delivery_number?.trim() || "",
    item_name_snapshot: input.item_name_snapshot?.trim() || "",
    item_reference_snapshot: input.item_reference_snapshot?.trim() || "",
    quantity: input.quantity?.trim() || "",
    brand: input.brand?.trim() || "",
    model: input.model?.trim() || "",
    declared_total_value: input.declared_total_value?.trim() || "",
    declared_currency: input.declared_currency?.trim().toUpperCase() || "",
    location_snapshot: input.location_snapshot?.trim() || "",
    condition_code: input.condition_code,
    condition_remarks: input.condition_remarks?.trim() || "",
    additional_notes: input.additional_notes.trim(),
    acknowledgement_enabled: Boolean(input.acknowledgement_enabled),
    signer_name_draft: input.signer_name_draft?.trim() || undefined,
    signature: input.signature
      ? {
          ...input.signature,
          signer_name: input.signature.signer_name.trim(),
          signer_position: "",
          signed_at: "",
        }
      : null,
    photos: current.photos,
    status: "DRAFT",
    revision: current.revision + 1,
    updated_at: timestamp,
    completed_at: null,
  };
  if (complete) {
    const [organization, owner] = await Promise.all([
      one(env.DB, "SELECT * FROM organizations WHERE id = ?", profile.organization_id),
      one(env.DB, "SELECT * FROM profiles WHERE id = ? AND organization_id = ? AND status = 'ACTIVE'", current.person_in_charge_id, profile.organization_id),
    ]);
    if (!organization || !owner) throw new Response(JSON.stringify({ code: "IDENTITY_UNAVAILABLE", message: "The organization or responsible employee is unavailable." }), { status: 422, headers: { "content-type": "application/json" } });
    Object.assign(updated, {
      organization_name_snapshot: text(organization.name), organization_email_snapshot: text(organization.email),
      organization_phone_snapshot: text(organization.phone), organization_address_snapshot: text(organization.address),
      organization_timezone_snapshot: text(organization.timezone), person_in_charge_name_snapshot: text(owner.full_name),
      person_in_charge_job_title_snapshot: text(owner.job_title), person_in_charge_employee_id_snapshot: text(owner.employee_id),
    });
    const errors = completionErrors(updated);
    if (errors.length)
      throw new Response(
        JSON.stringify({
          code: "VALIDATION_FAILED",
          message: errors.join("\n"),
          errors,
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      );
    await finalizeEvidencePhotos(updated, env);
    ({ profile, current } = await assertNote(user, input, env.DB));
    if (current.revision !== input.revision)
      throw new Response(
        JSON.stringify({
          code: "REVISION_CONFLICT",
          message:
            "This Report changed while evidence was being prepared. Reload and submit again.",
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      );
    updated.status = "COMPLETED";
    updated.completed_at = now();
    updated.updated_at = updated.completed_at;
    updated.signature = updated.signature
      ? { ...updated.signature, signed_at: updated.completed_at }
      : null;
    updated.acknowledgement_text_snapshot = updated.signature
      ? evidenceAcknowledgementStatement
      : "";
    updated.signer_name_draft = undefined;
  }
  const captionStatements = input.photos.map((photo) =>
    env.DB.prepare(
      "UPDATE report_photo_evidence SET caption = ? WHERE id = ? AND report_id = ? AND organization_id = ?",
    ).bind(
      photo.caption || "",
      photo.id,
      updated.id,
      profile.organization_id,
    ),
  );
  const statements = [
    ...captionStatements,
    env.DB.prepare(
      "UPDATE service_notes SET status = ?, revision = ?, customer_id = ?, customer_name_snapshot = ?, contact_number_snapshot = ?, contact_name_snapshot = ?, contact_email_snapshot = ?, customer_address_snapshot = ?, invoice_number = ?, delivery_number = ?, item_name_snapshot = ?, item_reference_snapshot = ?, quantity = ?, brand = ?, model = ?, declared_total_value = ?, declared_currency = ?, location_snapshot = ?, condition_code = ?, condition_remarks = ?, additional_notes = ?, organization_name_snapshot = ?, organization_email_snapshot = ?, organization_phone_snapshot = ?, organization_address_snapshot = ?, organization_timezone_snapshot = ?, person_in_charge_name_snapshot = ?, person_in_charge_job_title_snapshot = ?, person_in_charge_employee_id_snapshot = ?, acknowledgement_text_snapshot = ?, acknowledgement_enabled = ?, signer_name_draft = ?, updated_at = ?, completed_at = ? WHERE id = ? AND organization_id = ? AND revision = ? AND status = 'DRAFT'",
    ).bind(
      updated.status,
      updated.revision,
      updated.customer_id || null,
      updated.customer_name_snapshot,
      updated.contact_number_snapshot || "",
      updated.contact_name_snapshot,
      updated.contact_email_snapshot,
      updated.customer_address_snapshot,
      updated.invoice_number || "",
      updated.delivery_number || "",
      updated.item_name_snapshot || "",
      updated.item_reference_snapshot || "",
      updated.quantity || "",
      updated.brand || "",
      updated.model || "",
      updated.declared_total_value || "",
      updated.declared_currency || "",
      updated.location_snapshot || "",
      updated.condition_code || "",
      updated.condition_remarks || "",
      updated.additional_notes,
      updated.organization_name_snapshot || "",
      updated.organization_email_snapshot || "",
      updated.organization_phone_snapshot || "",
      updated.organization_address_snapshot || "",
      updated.organization_timezone_snapshot || "",
      updated.person_in_charge_name_snapshot,
      updated.person_in_charge_job_title_snapshot,
      updated.person_in_charge_employee_id_snapshot,
      updated.acknowledgement_text_snapshot || "",
      updated.acknowledgement_enabled ? 1 : 0,
      updated.signer_name_draft || null,
      updated.updated_at,
      updated.completed_at,
      updated.id,
      profile.organization_id,
      current.revision,
    ),
  ];
  const signatureInput = {
    ...updated,
    labor: [],
    materials: [],
    charges: [],
    photos: [],
  };
  statements.push(
    ...(await replaceChildren(signatureInput, profile, user, env)),
  );
  
  // Execute the update statements first
  const batchResults = await env.DB.batch(statements);
  
  // The main UPDATE statement is at index captionStatements.length
  const updateResult = batchResults[captionStatements.length];
  
  // Verify the UPDATE actually modified the row
  // If rowsWritten is 0, the WHERE clause didn't match (revision conflict or already completed)
  if (!updateResult || (updateResult.meta?.changes ?? 0) === 0) {
    // Re-fetch to determine what happened
    const currentState = await one(
      env.DB,
      "SELECT status, revision FROM service_notes WHERE id = ? AND organization_id = ?",
      updated.id,
      profile.organization_id,
    );
    
    if (!currentState) {
      throw new Error("Report disappeared during save");
    }
    
    if (text(currentState.status) === "COMPLETED" && complete) {
      // Already completed - return current state (idempotent)
      const saved = await one(
        env.DB,
        "SELECT * FROM service_notes WHERE id = ? AND organization_id = ?",
        updated.id,
        profile.organization_id,
      );
      if (!saved) throw new Error("Could not retrieve Report");
      return noteFromRow(saved, env.DB);
    }
    
    // Revision conflict
    throw new Response(
      JSON.stringify({
        code: "REVISION_CONFLICT",
        message:
          "This Report changed while being saved. Reload and try again.",
        currentRevision: num(currentState.revision),
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }
  
  // UPDATE succeeded - now insert the audit event
  await env.DB.prepare(
    "INSERT INTO audit_events (id, organization_id, note_id, service_number, actor_name, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(
    id(),
    profile.organization_id,
    updated.id,
    updated.service_number,
    profile.full_name,
    complete ? "SERVICE_NOTE_COMPLETED" : "SERVICE_NOTE_UPDATED",
    updated.updated_at,
  ).run();
  
  const saved = await one(
    env.DB,
    "SELECT * FROM service_notes WHERE id = ? AND organization_id = ?",
    updated.id,
    profile.organization_id,
  );
  if (!saved) throw new Error("Could not save Report");
  return noteFromRow(saved, env.DB);
}

export async function saveNote(
  user: AuthenticatedUser,
  input: ServiceNote,
  complete: boolean,
  env: ExtendedEnv,
): Promise<ServiceNote> {
  if (input.schema_version === 2)
    return saveEvidenceNote(user, input, complete, env);
  const { profile, current } = await assertNote(user, input, env.DB);
  if (current.status === "COMPLETED")
    throw new Response(
      JSON.stringify({
        code: "NOTE_COMPLETED",
        message: "Completed Service Notes are read-only.",
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  if (current.revision !== input.revision)
    throw new Response(
      JSON.stringify({
        code: "REVISION_CONFLICT",
        message:
          "This Service Note changed in another tab. Reload the saved record before editing again.",
        currentRevision: current.revision,
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  const customer = input.customer_id
    ? await one(
        env.DB,
        "SELECT * FROM customers WHERE id = ? AND organization_id = ?",
        input.customer_id,
        profile.organization_id,
      )
    : undefined;
  if (input.customer_id && !customer)
    throw new Response(
      JSON.stringify({
        code: "CUSTOMER_NOT_FOUND",
        message: "Select a customer in this organization.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  const trackedItem = input.tracked_item_id
    ? await one(
        env.DB,
        "SELECT * FROM tracked_items WHERE id = ? AND organization_id = ?",
        input.tracked_item_id,
        profile.organization_id,
      )
    : undefined;
  if (input.tracked_item_id && !trackedItem)
    throw new Response(
      JSON.stringify({
        code: "ITEM_NOT_FOUND",
        message: "Select an item in this organization.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  const updated = {
    ...input,
    ...calculateTotals(input),
    organization_id: profile.organization_id,
    status: complete ? ("COMPLETED" as const) : ("DRAFT" as const),
    revision: current.revision + 1,
    updated_at: now(),
    completed_at: complete ? now() : null,
  };
  if (trackedItem)
    Object.assign(updated, {
      item_name_snapshot: text(trackedItem.name),
      item_reference_snapshot: text(trackedItem.reference),
    });
  if (!customer)
    Object.assign(updated, {
      customer_name_snapshot: "",
      contact_name_snapshot: "",
      contact_position_snapshot: "",
      contact_mobile_snapshot: "",
      contact_office_snapshot: "",
      contact_email_snapshot: "",
      customer_address_snapshot: "",
    });
  if (complete) {
    const errors = completionErrors(updated);
    if (errors.length)
      throw new Response(
        JSON.stringify({
          code: "VALIDATION_FAILED",
          message: errors.join("\n"),
          errors,
        }),
        { status: 422, headers: { "content-type": "application/json" } },
      );
    if (updated.finalization_type === "STAFF_ATTESTED")
      updated.staff_attested_at = updated.updated_at;
    else if (updated.signature)
      updated.signature.signed_at = updated.updated_at;
  }
  const eventType = complete
    ? "SERVICE_NOTE_COMPLETED"
    : "SERVICE_NOTE_UPDATED";
  const statements = [
    env.DB.prepare(
      "UPDATE service_notes SET status = ?, revision = ?, record_type = ?, tracked_item_id = ?, item_name_snapshot = ?, item_reference_snapshot = ?, location_snapshot = ?, billing_enabled = ?, finalization_type = ?, staff_attested_at = ?, job_title = ?, job_description = ?, work_performed = ?, result_remarks = ?, additional_notes = ?, service_date = ?, service_time = ?, customer_id = ?, customer_name_snapshot = ?, contact_name_snapshot = ?, contact_position_snapshot = ?, contact_mobile_snapshot = ?, contact_office_snapshot = ?, contact_email_snapshot = ?, customer_address_snapshot = ?, payment_status = ?, payment_method = ?, payment_terms = ?, payment_reference = ?, payment_remarks = ?, labor_total = ?, material_total = ?, additional_charge_total = ?, subtotal = ?, discount_amount = ?, tax_rate = ?, tax_amount = ?, grand_total = ?, signer_name_draft = ?, signer_position_draft = ?, updated_at = ?, completed_at = ? WHERE id = ? AND organization_id = ?",
    ).bind(
      updated.status,
      updated.revision,
      updated.record_type || "SERVICE",
      updated.tracked_item_id || null,
      updated.item_name_snapshot || "",
      updated.item_reference_snapshot || "",
      updated.location_snapshot || "",
      updated.billing_enabled === false ? 0 : 1,
      updated.finalization_type || "CUSTOMER_ACKNOWLEDGED",
      updated.staff_attested_at || null,
      updated.job_title,
      updated.job_description,
      updated.work_performed,
      updated.result_remarks,
      updated.additional_notes,
      updated.service_date,
      updated.service_time,
      updated.customer_id || null,
      updated.customer_name_snapshot,
      updated.contact_name_snapshot,
      updated.contact_position_snapshot,
      updated.contact_mobile_snapshot,
      updated.contact_office_snapshot,
      updated.contact_email_snapshot,
      updated.customer_address_snapshot,
      updated.payment_status,
      updated.payment_method,
      updated.payment_terms,
      updated.payment_reference,
      updated.payment_remarks,
      updated.labor_total,
      updated.material_total,
      updated.additional_charge_total,
      updated.subtotal,
      updated.discount_amount,
      updated.tax_rate,
      updated.tax_amount,
      updated.grand_total,
      updated.signer_name_draft || null,
      updated.signer_position_draft || null,
      updated.updated_at,
      updated.completed_at,
      updated.id,
      profile.organization_id,
    ),
  ];
  statements.push(...(await replaceChildren(updated, profile, user, env)));
  statements.push(
    env.DB.prepare(
      "INSERT INTO audit_events (id, organization_id, note_id, service_number, actor_name, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      id(),
      profile.organization_id,
      updated.id,
      updated.service_number,
      profile.full_name,
      eventType,
      updated.updated_at,
    ),
  );
  await env.DB.batch(statements);
  const saved = await one(
    env.DB,
    "SELECT * FROM service_notes WHERE id = ? AND organization_id = ?",
    updated.id,
    profile.organization_id,
  );
  if (!saved) throw new Error("Could not save Service Note");
  return noteFromRow(saved, env.DB);
}
export async function saveCustomer(
  user: AuthenticatedUser,
  input: Omit<Customer, "id" | "organization_id" | "created_at"> & {
    id?: string;
  },
  env: ExtendedEnv,
): Promise<Customer> {
  const profile = await profileForUser(user, env.DB);
  if (!input.name.trim())
    throw new Response(
      JSON.stringify({
        code: "VALIDATION_FAILED",
        message: "Customer name is required.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  const existing = input.id
    ? await one(
        env.DB,
        "SELECT * FROM customers WHERE id = ? AND organization_id = ?",
        input.id,
        profile.organization_id,
      )
    : undefined;
  if (input.id && !existing)
    throw new Response(
      JSON.stringify({
        code: "CUSTOMER_NOT_FOUND",
        message: "Customer not found.",
      }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  const customerId = text(existing?.id) || id(),
    timestamp = text(existing?.created_at) || now();
  await env.DB.prepare(
    "INSERT INTO customers (id, organization_id, name, contact_name, contact_position, mobile, office, contact_number, email, address, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, contact_name = excluded.contact_name, contact_position = excluded.contact_position, mobile = excluded.mobile, office = excluded.office, contact_number = excluded.contact_number, email = excluded.email, address = excluded.address, notes = excluded.notes, updated_at = excluded.updated_at",
  )
    .bind(
      customerId,
      profile.organization_id,
      input.name,
      input.contact_name,
      input.contact_position,
      input.mobile,
      input.office,
      input.contact_number || input.mobile || input.office || "",
      input.email,
      input.address,
      input.notes,
      timestamp,
      now(),
    )
    .run();
  const row = await one(
    env.DB,
    "SELECT * FROM customers WHERE id = ? AND organization_id = ?",
    customerId,
    profile.organization_id,
  );
  if (!row) throw new Error("Could not save customer");
  return customerFromRow(row);
}
export async function saveTrackedItem(
  user: AuthenticatedUser,
  input: Omit<
    TrackedItem,
    "id" | "organization_id" | "created_at" | "updated_at"
  > & { id?: string },
  env: ExtendedEnv,
): Promise<TrackedItem> {
  const profile = await profileForUser(user, env.DB);
  const name = input.name.trim(),
    reference = input.reference.trim();
  if (!name || !reference)
    throw new Response(
      JSON.stringify({
        code: "VALIDATION_FAILED",
        message: "Item name and reference are required.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  const existing = input.id
    ? await one(
        env.DB,
        "SELECT * FROM tracked_items WHERE id = ? AND organization_id = ?",
        input.id,
        profile.organization_id,
      )
    : undefined;
  if (input.id && !existing)
    throw new Response(
      JSON.stringify({ code: "ITEM_NOT_FOUND", message: "Item not found." }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  const itemId = text(existing?.id) || id(),
    timestamp = now();
  try {
    await env.DB.prepare(
      "INSERT INTO tracked_items (id, organization_id, customer_id, name, reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET customer_id = excluded.customer_id, name = excluded.name, reference = excluded.reference, updated_at = excluded.updated_at",
    )
      .bind(
        itemId,
        profile.organization_id,
        input.customer_id || null,
        name,
        reference,
        text(existing?.created_at) || timestamp,
        timestamp,
      )
      .run();
  } catch (cause) {
    if (cause instanceof Error && /unique/i.test(cause.message))
      throw new Response(
        JSON.stringify({
          code: "ITEM_REFERENCE_EXISTS",
          message: "An item with this reference already exists.",
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      );
    throw cause;
  }
  const row = await one(
    env.DB,
    "SELECT * FROM tracked_items WHERE id = ? AND organization_id = ?",
    itemId,
    profile.organization_id,
  );
  if (!row) throw new Error("Could not save item");
  return trackedItemFromRow(row);
}
export async function saveEmployee(
  user: AuthenticatedUser,
  input: Profile,
  env: ExtendedEnv,
) {
  const profile = await profileForUser(user, env.DB);
  if (profile.role !== "ADMIN")
    throw new Response(
      JSON.stringify({
        code: "FORBIDDEN",
        message: "Administrator access is required.",
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  if (
    !input.full_name.trim() ||
    !input.employee_id.trim() ||
    !input.email.trim()
  )
    throw new Response(
      JSON.stringify({
        code: "VALIDATION_FAILED",
        message: "Name, employee ID and email are required.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  await env.DB.prepare(
    "UPDATE profiles SET full_name = ?, employee_id = ?, job_title = ?, email = ?, mobile = ?, role = ?, status = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
  )
    .bind(
      input.full_name,
      input.employee_id,
      input.job_title,
      input.email.toLowerCase(),
      input.mobile,
      input.role,
      input.status,
      now(),
      input.id,
      profile.organization_id,
    )
    .run();
}
export async function saveOrganization(
  user: AuthenticatedUser,
  input: Organization,
  env: ExtendedEnv,
) {
  const profile = await profileForUser(user, env.DB);
  if (profile.role !== "ADMIN")
    throw new Response(
      JSON.stringify({
        code: "FORBIDDEN",
        message: "Administrator access is required.",
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  if (!input.name.trim())
    throw new Response(
      JSON.stringify({
        code: "VALIDATION_FAILED",
        message: "Organization name is required.",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  await env.DB.prepare(
    "UPDATE organizations SET name = ?, email = ?, phone = ?, address = ?, updated_at = ? WHERE id = ?",
  )
    .bind(
      input.name,
      input.email,
      input.phone,
      input.address,
      now(),
      profile.organization_id,
    )
    .run();
}
