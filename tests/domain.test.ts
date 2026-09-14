import { describe, it, expect } from "vitest";
import {
  calculateTotals,
  calculateLineAmount,
  completionErrors,
  completionReadiness,
  canAccessNote,
  customerSnapshot,
  formatCurrency,
  isCompletedRecord,
  searchableNoteText,
  evidenceAcknowledgementStatement,
} from "../src/lib/domain";
import { buildReportViewModel } from "../src/lib/report-model";
import type { ServiceNote, Profile, Customer } from "../src/lib/types";
describe("financial rules", () => {
  it("calculates rounded lines then discount and tax", () => {
    expect(
      calculateTotals({
        labor: [
          {
            id: "1",
            name: "Amir",
            classification: "Technician",
            hours: "2.5",
            rate: "80",
            notes: "",
          },
        ],
        materials: [
          {
            id: "1",
            description: "Regulator",
            part_number: "",
            quantity: "1",
            unit_amount: "325",
          },
        ],
        charges: [{ id: "1", description: "Travel", amount: "50" }],
        discount_amount: "25",
        tax_rate: "6",
      }),
    ).toEqual({
      labor_total: "200.00",
      material_total: "325.00",
      additional_charge_total: "50.00",
      subtotal: "575.00",
      discount_amount: "25.00",
      tax_rate: "6",
      tax_amount: "33.00",
      grand_total: "583.00",
    });
  });
  it("avoids binary currency rounding errors", () => {
    expect(
      calculateTotals({
        labor: [],
        materials: [
          {
            id: "1",
            description: "Parts",
            part_number: "",
            quantity: "3",
            unit_amount: "0.335",
          },
        ],
        charges: [],
        discount_amount: "0",
        tax_rate: "0",
      }).grand_total,
    ).toBe("1.01");
  });
  it("uses the same half-up rounding for displayed line amounts", () =>
    expect(calculateLineAmount("0.7", "0.65")).toBe("0.46"));
  it("formats shared currency values for reports", () =>
    expect(formatCurrency("0.46", "MYR")).toBe("RM\u00a00.46"));
  it("rejects discount above subtotal", () =>
    expect(() =>
      calculateTotals({
        labor: [],
        materials: [],
        charges: [],
        discount_amount: "1",
        tax_rate: "0",
      }),
    ).toThrow());
  it("rejects negative charges", () =>
    expect(() =>
      calculateTotals({
        labor: [],
        materials: [],
        charges: [{ id: "x", description: "X", amount: "-1" }],
        discount_amount: "0",
        tax_rate: "0",
      }),
    ).toThrow());
});
describe("completion", () => {
  const note = {
    job_title: "Compressor inspection",
    service_date: "2026-09-09",
    service_time: "09:00",
    person_in_charge_id: "p",
    customer_id: "c",
    customer_name_snapshot: "Engineering Co",
    contact_mobile_snapshot: "+60123456789",
    work_performed: "Inspected regulator and pressure tested assembly.",
    payment_status: "UNPAID",
    payment_method: "",
    signature: {
      signer_name: "Ahmad",
      signer_position: "Manager",
      image: "data:image/png;base64,a",
      signed_at: "2026-09-09T09:00:00Z",
    },
  } as ServiceNote;
  it("accepts a complete unpaid note without a payment method or optional lines", () =>
    expect(completionErrors(note)).toEqual([]));
  it("requires a method for paid records", () =>
    expect(
      completionErrors({ ...note, payment_status: "PAID" }).join(" "),
    ).toMatch(/Payment method/));
  it("rejects impossible calendar dates and unknown payment methods", () => {
    expect(
      completionErrors({ ...note, service_date: "2026-02-31" }).join(" "),
    ).toMatch(/valid service date/i);
    expect(
      completionErrors({
        ...note,
        payment_status: "PAID",
        payment_method: "Cheque",
      }).join(" "),
    ).toMatch(/valid payment method/i);
  });
  it("requires a real signature", () =>
    expect(completionErrors({ ...note, signature: null }).join(" ")).toMatch(
      /signature/i,
    ));
  it("accepts a persisted signature file reference", () =>
    expect(
      completionErrors({
        ...note,
        signature: {
          ...note.signature!,
          image: "/api/files/signature-1",
          file_id: "signature-1",
        },
      }),
    ).toEqual([]));
  it("rejects missing core service information", () =>
    expect(
      completionErrors({ ...note, job_title: " ", work_performed: "" }),
    ).toHaveLength(2));
  it("returns ordered readiness with field and step targets", () => {
    const readiness = completionReadiness({
      ...note,
      customer_id: "",
      work_performed: "",
      signature: null,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.firstIncomplete).toMatchObject({
      id: "customer",
      step: 1,
      fieldId: "customer",
    });
    expect(readiness.requirements.map((item) => item.id)).toEqual([
      "service",
      "customer",
      "work",
      "payment",
      "acceptance",
    ]);
  });
  it("recognizes completion routes only for persisted signed records", () => {
    expect(isCompletedRecord(note)).toBe(false);
    expect(isCompletedRecord({ ...note, status: "COMPLETED" })).toBe(true);
    expect(
      isCompletedRecord({ ...note, status: "COMPLETED", signature: null }),
    ).toBe(false);
  });
  it("allows a staff-attested inspection without billing or customer acknowledgement", () => {
    const inspection = {
      ...note,
      record_type: "INSPECTION",
      customer_id: "",
      customer_name_snapshot: "",
      contact_mobile_snapshot: "",
      billing_enabled: false,
      payment_status: "UNPAID",
      finalization_type: "STAFF_ATTESTED",
      signature: null,
      item_name_snapshot: "Cummins QSK19 engine",
      item_reference_snapshot: "ENG-CUM-4821",
      location_snapshot: "Bay B12",
    } as ServiceNote;

    expect(completionErrors(inspection)).toEqual([]);
  });
});

describe("evidence report v2", () => {
  const evidence = {
    ...createEvidenceReportFixture(),
  } as ServiceNote;

  it("requires the evidence fields and at least one stored original photo", () => {
    const errors = completionErrors({
      ...evidence,
      customer_name_snapshot: "",
      contact_number_snapshot: "",
      item_name_snapshot: "",
      quantity: "0",
      location_snapshot: "",
      condition_code: "",
      photos: [],
    });

    expect(errors.join("\n")).toMatch(/customer/i);
    expect(errors.join("\n")).toMatch(/contact number/i);
    expect(errors.join("\n")).toMatch(/item description/i);
    expect(errors.join("\n")).toMatch(/quantity/i);
    expect(errors.join("\n")).toMatch(/location/i);
    expect(errors.join("\n")).toMatch(/condition/i);
    expect(errors.join("\n")).toMatch(/evidence photo/i);
  });

  it("requires remarks for every condition except no visible issue", () => {
    expect(
      completionErrors({
        ...evidence,
        condition_code: "DAMAGED",
        condition_remarks: "",
      }).join(" "),
    ).toMatch(/condition remarks/i);
    expect(
      completionErrors({
        ...evidence,
        condition_code: "NO_VISIBLE_ISSUE",
        condition_remarks: "",
      }),
    ).toEqual([]);
  });

  it("requires currency only when a declared value is entered", () => {
    expect(
      completionErrors({
        ...evidence,
        declared_total_value: "1200",
        declared_currency: "",
      }).join(" "),
    ).toMatch(/currency/i);
    expect(
      completionErrors({
        ...evidence,
        declared_total_value: "",
        declared_currency: "",
      }),
    ).toEqual([]);
  });

  it("accepts no acknowledgement but rejects a partial acknowledgement", () => {
    expect(completionErrors({ ...evidence, signature: null })).toEqual([]);
    expect(
      completionErrors({
        ...evidence,
        acknowledgement_enabled: true,
        signer_name_draft: "",
        signature: null,
      }).join(" "),
    ).toMatch(/signer name.*signature/i);
    expect(
      completionErrors({
        ...evidence,
        signer_name_draft: "Lee",
        signature: null,
      }).join(" "),
    ).toMatch(/signature/i);
  });

  it("builds the single authoritative evidence report projection", () => {
    const model = buildReportViewModel(evidence, {
      id: "org",
      name: "Current Organization Name",
      email: "current@example.com",
      phone: "123",
      address: "Current address",
      currency: "MYR",
      timezone: "Asia/Kuala_Lumpur",
    });

    expect(model.kind).toBe("EVIDENCE_REPORT");
    if (model.kind !== "EVIDENCE_REPORT") throw new Error("Expected evidence projection");
    expect(model.organization.name).toBe("Stored Organization");
    expect(model.item.description).toBe("Hydraulic pump assembly");
    expect(model.condition.label).toBe("No visible issue");
    expect(model.sections).not.toContain("service");
    expect(model.acknowledgement).toBeNull();
  });

  it("uses evidence wording rather than service acceptance wording", () => {
    expect(evidenceAcknowledgementStatement).toMatch(/item.*condition/i);
    expect(evidenceAcknowledgementStatement).not.toMatch(/service.*performed/i);
  });
});

function createEvidenceReportFixture() {
  return {
    id: "report-1",
    organization_id: "org",
    service_number: "SL-2026-000201",
    schema_version: 2,
    status: "DRAFT",
    revision: 0,
    customer_id: "customer-1",
    customer_name_snapshot: "Atlas Warehousing",
    contact_number_snapshot: "+60 12 300 4000",
    contact_name_snapshot: "Aminah",
    contact_email_snapshot: "ops@atlas.example",
    customer_address_snapshot: "Shah Alam",
    item_name_snapshot: "Hydraulic pump assembly",
    item_reference_snapshot: "HP-2048",
    quantity: "1",
    brand: "Bosch Rexroth",
    model: "A10VSO",
    invoice_number: "INV-100",
    delivery_number: "DO-200",
    declared_total_value: "",
    declared_currency: "",
    location_snapshot: "Receiving Bay 2",
    condition_code: "NO_VISIBLE_ISSUE",
    condition_remarks: "",
    additional_notes: "",
    organization_name_snapshot: "Stored Organization",
    organization_email_snapshot: "stored@example.com",
    organization_phone_snapshot: "456",
    organization_address_snapshot: "Stored address",
    organization_timezone_snapshot: "Asia/Kuala_Lumpur",
    person_in_charge_id: "employee-1",
    person_in_charge_name_snapshot: "Nur Aisyah",
    person_in_charge_job_title_snapshot: "Warehouse Executive",
    person_in_charge_employee_id_snapshot: "EMP-1",
    photos: [
      {
        id: "photo-1",
        url: "/api/report-photos/photo-1/derivative",
        original_url: "/api/report-photos/photo-1/original",
        original_sha256: "a".repeat(64),
        source: "CAMERA_CAPTURE",
        category: "OTHER",
        caption: "Front view",
        created_at: "2026-09-13T10:00:00Z",
        uploaded_by_name_snapshot: "Nur Aisyah",
        name: "pump.jpg",
      },
    ],
    signature: null,
    signer_name_draft: "",
    acknowledgement_text_snapshot: "",
    job_title: "",
    job_description: "",
    work_performed: "",
    result_remarks: "",
    service_date: "",
    service_time: "",
    contact_position_snapshot: "",
    contact_mobile_snapshot: "",
    contact_office_snapshot: "",
    payment_status: "UNPAID",
    payment_method: "",
    payment_terms: "",
    payment_reference: "",
    payment_remarks: "",
    labor: [],
    materials: [],
    charges: [],
    labor_total: "0.00",
    material_total: "0.00",
    additional_charge_total: "0.00",
    subtotal: "0.00",
    discount_amount: "0.00",
    tax_rate: "0",
    tax_amount: "0.00",
    grand_total: "0.00",
    created_at: "2026-09-13T09:30:00Z",
    updated_at: "2026-09-13T10:00:00Z",
    completed_at: null,
  };
}

it("indexes item references and narrative evidence for retrieval", () => {
  const note = {
    service_number: "SL-2026-000201",
    item_name_snapshot: "Cummins QSK19 engine",
    item_reference_snapshot: "ENG-CUM-4821",
    job_title: "Intake condition record",
    work_performed: "Corrosion observed on the sump.",
    result_remarks: "Stored pending owner instructions.",
    photos: [{ caption: "Lifting eye dent", name: "before.jpg" }],
  } as ServiceNote;

  expect(searchableNoteText(note)).toContain("eng-cum-4821");
  expect(searchableNoteText(note)).toContain("lifting eye dent");
});
it("restricts employees to own organization and own records", () => {
  const p = {
    id: "p",
    organization_id: "o",
    role: "EMPLOYEE",
    status: "ACTIVE",
  } as Profile;
  const n = { person_in_charge_id: "p", organization_id: "o" } as ServiceNote;
  expect(canAccessNote(p, n)).toBe(true);
  expect(canAccessNote(p, { ...n, organization_id: "other" })).toBe(false);
  expect(canAccessNote(p, { ...n, person_in_charge_id: "other" })).toBe(false);
  expect(canAccessNote({ ...p, status: "INACTIVE" }, n)).toBe(false);
  expect(
    canAccessNote(
      { ...p, role: "ADMIN" },
      { ...n, person_in_charge_id: "other" },
    ),
  ).toBe(true);
});
it("copies customer values without retaining a mutable master reference", () => {
  const c = {
    id: "1",
    name: "Atlas",
    contact_name: "Ali",
    mobile: "123",
    address: "Kuala Lumpur",
  } as Customer;
  const snapshot = customerSnapshot(c);
  c.name = "Renamed";
  expect(snapshot).toMatchObject({
    customer_name_snapshot: "Atlas",
    contact_mobile_snapshot: "123",
  });
});
