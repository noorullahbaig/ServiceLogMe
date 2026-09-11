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
} from "../src/lib/domain";
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
