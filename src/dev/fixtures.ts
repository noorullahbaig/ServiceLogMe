import type {
  Customer,
  Organization,
  Profile,
  ServiceNote,
  WorkspaceData,
} from "@/lib/types";
import { calculateTotals, customerSnapshot } from "@/lib/domain";

const zeroTotals = calculateTotals({
  labor: [], materials: [], charges: [], discount_amount: "0", tax_rate: "0",
});

export function emptyNote(
  profile: WorkspaceData["profile"],
  number: string,
  organization?: Organization,
): ServiceNote {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), organization_id: profile.organization_id,
    service_number: number, schema_version: 2, status: "DRAFT", revision: 0,
    item_name_snapshot: "", item_reference_snapshot: "", location_snapshot: "",
    contact_number_snapshot: "", invoice_number: "", delivery_number: "",
    quantity: "1", brand: "", model: "", declared_total_value: "",
    declared_currency: "", condition_code: "", condition_remarks: "",
    organization_name_snapshot: organization?.name ?? "",
    organization_email_snapshot: organization?.email ?? "",
    organization_phone_snapshot: organization?.phone ?? "",
    organization_address_snapshot: organization?.address ?? "",
    organization_timezone_snapshot: organization?.timezone ?? "Asia/Kuala_Lumpur",
    acknowledgement_text_snapshot: "", acknowledgement_enabled: false, billing_enabled: false,
    finalization_type: "STAFF_ATTESTED", job_title: "", job_description: "",
    work_performed: "", result_remarks: "", additional_notes: "",
    service_date: "", service_time: "", person_in_charge_id: profile.id,
    person_in_charge_name_snapshot: profile.full_name,
    person_in_charge_job_title_snapshot: profile.job_title,
    person_in_charge_employee_id_snapshot: profile.employee_id,
    customer_id: "", customer_name_snapshot: "", contact_name_snapshot: "",
    contact_position_snapshot: "", contact_mobile_snapshot: "",
    contact_office_snapshot: "", contact_email_snapshot: "",
    customer_address_snapshot: "", payment_status: "UNPAID", payment_method: "",
    payment_terms: "", payment_reference: "", payment_remarks: "",
    labor: [], materials: [], charges: [], photos: [], signature: null,
    created_at: now, updated_at: now, completed_at: null, ...zeroTotals,
  };
}

const evidencePixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export function createDevelopmentWorkspace(): WorkspaceData {
  const organization: Organization = {
    id: "org-meridian", name: "Meridian Warehouse Operations",
    email: "audit@meridian.example", phone: "+60 3 7728 4600",
    address: "18, Jalan SS 21/35, Damansara Utama\n47400 Petaling Jaya, Selangor",
    currency: "MYR", timezone: "Asia/Kuala_Lumpur",
  };
  const now = new Date();
  const profile: Profile = {
    id: "employee-sarah", organization_id: organization.id, full_name: "Sarah Lim",
    employee_id: "EMP-0001", job_title: "Warehouse Operations Manager",
    email: "sarah@meridian.example", mobile: "+60 12 380 4820",
    role: "ADMIN", status: "ACTIVE",
  };
  const employees: Profile[] = [profile, {
    ...profile, id: "employee-amir", full_name: "Amir Malik", employee_id: "EMP-0018",
    job_title: "Receiving Officer", email: "amir@meridian.example",
    mobile: "+60 12 558 0913", role: "EMPLOYEE",
  }, {
    ...profile, id: "employee-nur", full_name: "Nur Aisyah", employee_id: "EMP-0024",
    job_title: "Inventory Controller", email: "nur@meridian.example",
    mobile: "+60 17 562 1904", role: "EMPLOYEE",
  }];
  const customerRows = [
    ["customer-atlas", "Atlas Engineering Sdn Bhd", "Ahmad Rahman", "+60 12 345 6780", "logistics@atlas.example", "18, Jalan Perindustrian U1\nShah Alam, Selangor"],
    ["customer-oakwood", "Oakwood Manufacturing", "Jason Lee", "+60 16 902 4418", "dispatch@oakwood.example", "7, Jalan Teknologi 3\nPetaling Jaya, Selangor"],
    ["customer-nexus", "Nexus Industrial Solutions", "Ravi Kumar", "+60 19 440 1288", "warehouse@nexus.example", "16, Jalan Puteri 5/8\nPuchong, Selangor"],
  ];
  const customers: Customer[] = customerRows.map((row, index) => ({
    id: row[0], organization_id: organization.id, name: row[1],
    contact_name: row[2], contact_position: index === 0 ? "Logistics Manager" : "Dispatch Supervisor",
    contact_number: row[3], mobile: row[3], office: "", email: row[4], address: row[5],
    notes: "", created_at: now.toISOString(),
  }));
  const examples = [
    { customer: customers[0], employee: employees[1], item: "Sealed cartons of variable-frequency drives", reference: "VFD-ATLAS-2409", invoice: "INV-88421", delivery: "DO-10984", quantity: "12", location: "Warehouse A · Receiving Bay 2 · Rack A-04", condition: "NO_VISIBLE_ISSUE" as const, remarks: "", caption: "Outer cartons and security seals on arrival", daysAgo: 0, draft: false },
    { customer: customers[1], employee: employees[2], item: "Palletised stainless-steel pump housings", reference: "PH-SS316-B7", invoice: "", delivery: "DO-77102", quantity: "8", location: "Warehouse B · Quarantine Zone Q-03", condition: "EXISTING_WEAR_DAMAGE" as const, remarks: "One crate has a crushed upper-right corner; contents not unpacked.", caption: "Crushed corner visible before storage", daysAgo: 1, draft: false },
    { customer: customers[2], employee: employees[1], item: "Industrial control cabinet", reference: "NXS-CC-00819", invoice: "INV-33018", delivery: "", quantity: "1", location: "Warehouse A · Oversize Holding Area", condition: "UNABLE_TO_FULLY_INSPECT" as const, remarks: "Cabinet remains export-wrapped; only external packaging was inspected.", caption: "Export wrapping before placement in holding area", daysAgo: 2, draft: true },
  ];
  const notes = examples.map((example, index) => {
    const timestamp = new Date(now); timestamp.setDate(timestamp.getDate() - example.daysAgo);
    const note = emptyNote(example.employee, `SL-${timestamp.getFullYear()}-${String(301 - index).padStart(6, "0")}`, organization);
    const photoId = `evidence-photo-${index + 1}`;
    return {
      ...note, id: `report-${301 - index}`, ...customerSnapshot(example.customer),
      contact_number_snapshot: example.customer.contact_number,
      item_name_snapshot: example.item, item_reference_snapshot: example.reference,
      invoice_number: example.invoice, delivery_number: example.delivery,
      quantity: example.quantity, location_snapshot: example.location,
      condition_code: example.condition, condition_remarks: example.remarks,
      additional_notes: index === 1 ? "Retained in quarantine pending customer instruction." : "",
      photos: [{ id: photoId, url: evidencePixel, original_url: evidencePixel,
        original_sha256: "431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460", derivative_sha256: "431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460",
        source: "CAMERA_CAPTURE" as const, uploaded_by_id: example.employee.id,
        uploaded_by_name_snapshot: example.employee.full_name, category: "OTHER" as const,
        caption: example.caption, created_at: timestamp.toISOString(), name: `warehouse-evidence-${index + 1}.png` }],
      status: example.draft ? "DRAFT" as const : "COMPLETED" as const,
      revision: example.draft ? 2 : 3, created_at: timestamp.toISOString(),
      updated_at: timestamp.toISOString(), completed_at: example.draft ? null : timestamp.toISOString(),
    } satisfies ServiceNote;
  });
  return { organization, profile, employees, customers, tracked_items: [], notes, events: [] };
}
