import { describe, it, expect } from "vitest";
import type { Organization, ServiceNote } from "@/lib/types";

function createOrg(): Organization {
  return {
    id: "org_123",
    name: "Test Organization",
    email: "test@example.com",
    phone: "555-0100",
    address: "123 Main St",
    timezone: "America/New_York",
    currency: "USD",
  };
}

function createV1DraftNote(): ServiceNote {
  return {
    id: "note_v1_draft",
    organization_id: "org_123",
    service_number: "SL-2024-000001",
    status: "DRAFT",
    revision: 0,
    schema_version: 1,
    job_title: "Legacy Service Note",
    job_description: "",
    work_performed: "",
    result_remarks: "",
    additional_notes: "",
    service_date: "",
    service_time: "",
    person_in_charge_id: "prof_123",
    person_in_charge_name_snapshot: "Tech User",
    person_in_charge_job_title_snapshot: "Technician",
    person_in_charge_employee_id_snapshot: "EMP001",
    customer_id: "",
    customer_name_snapshot: "",
    contact_name_snapshot: "",
    contact_position_snapshot: "",
    contact_mobile_snapshot: "",
    contact_office_snapshot: "",
    contact_email_snapshot: "",
    customer_address_snapshot: "",
    payment_status: "UNPAID",
    payment_method: "",
    payment_terms: "",
    payment_reference: "",
    payment_remarks: "",
    labor_total: "0",
    material_total: "0",
    additional_charge_total: "0",
    subtotal: "0",
    discount_amount: "0",
    tax_rate: "0",
    tax_amount: "0",
    grand_total: "0",
    item_name_snapshot: "",
    item_reference_snapshot: "",
    location_snapshot: "",
    created_at: "2024-01-01T10:00:00Z",
    updated_at: "2024-01-01T10:00:00Z",
    contact_number_snapshot: "",
    invoice_number: "",
    delivery_number: "",
    quantity: "1",
    brand: "",
    model: "",
    declared_total_value: "",
    declared_currency: "",
    condition_code: "",
    condition_remarks: "",
    organization_name_snapshot: "",
    organization_email_snapshot: "",
    organization_phone_snapshot: "",
    organization_address_snapshot: "",
    organization_timezone_snapshot: "",
    acknowledgement_text_snapshot: "",
    acknowledgement_enabled: false,
    labor: [],
    materials: [],
    charges: [],
    photos: [],
    audit_events: [],
    tracked_items: [],
  } as any;
}

function createV1CompletedNote(): ServiceNote {
  return {
    ...createV1DraftNote(),
    id: "note_v1_completed",
    status: "COMPLETED",
    revision: 1,
    job_title: "Completed Legacy Service",
    work_performed: "Fixed the issue",
  } as any;
}

function createV2DraftNote(): ServiceNote {
  return {
    ...createV1DraftNote(),
    id: "note_v2_draft",
    service_number: "EVD-001",
    schema_version: 2,
    customer_name_snapshot: "John Doe",
    item_name_snapshot: "Laptop Computer",
    item_reference_snapshot: "SN-12345",
    location_snapshot: "Warehouse A",
    contact_number_snapshot: "555-1234",
    invoice_number: "INV-001",
    delivery_number: "DEL-001",
    quantity: "1",
    brand: "Dell",
    model: "XPS 15",
    declared_total_value: "1500",
    declared_currency: "USD",
    condition_code: "NO_VISIBLE_ISSUE",
    condition_remarks: "",
  } as any;
}

function createV2CompletedNote(): ServiceNote {
  return {
    ...createV2DraftNote(),
    id: "note_v2_completed",
    status: "COMPLETED",
    revision: 1,
  } as any;
}

describe("v1/v2 routing logic", () => {
  it("correctly identifies schema versions", () => {
    const v1Draft = createV1DraftNote();
    const v1Completed = createV1CompletedNote();
    const v2Draft = createV2DraftNote();
    const v2Completed = createV2CompletedNote();

    expect(v1Draft.schema_version).toBe(1);
    expect(v1Completed.schema_version).toBe(1);
    expect(v2Draft.schema_version).toBe(2);
    expect(v2Completed.schema_version).toBe(2);
  });

  it("v1 draft notes should use legacy editor", () => {
    const note = createV1DraftNote();
    const shouldUseLegacyEditor = note.status === "DRAFT" && note.schema_version !== 2;
    const shouldUseEvidenceEditor = note.status === "DRAFT" && note.schema_version === 2;
    expect(shouldUseLegacyEditor).toBe(true);
    expect(shouldUseEvidenceEditor).toBe(false);
  });

  it("v2 draft notes should use evidence editor", () => {
    const note = createV2DraftNote();
    const shouldUseLegacyEditor = note.status === "DRAFT" && note.schema_version !== 2;
    const shouldUseEvidenceEditor = note.status === "DRAFT" && note.schema_version === 2;
    expect(shouldUseLegacyEditor).toBe(false);
    expect(shouldUseEvidenceEditor).toBe(true);
  });

  it("v1 completed notes should use legacy renderer", () => {
    const note = createV1CompletedNote();
    const shouldUseEvidenceView = note.schema_version === 2;
    const shouldUseLegacyView = note.schema_version !== 2;
    expect(shouldUseEvidenceView).toBe(false);
    expect(shouldUseLegacyView).toBe(true);
  });

  it("v2 completed notes should use evidence renderer", () => {
    const note = createV2CompletedNote();
    const shouldUseEvidenceView = note.schema_version === 2;
    const shouldUseLegacyView = note.schema_version !== 2;
    expect(shouldUseEvidenceView).toBe(true);
    expect(shouldUseLegacyView).toBe(false);
  });
});
