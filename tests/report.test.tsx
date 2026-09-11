import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { ReportActions, ServiceReport } from "../src/components/service-report";
import { ReportDocument, validateReportAssets } from "../src/lib/report-pdf";
import type { Organization, ServiceNote } from "../src/lib/types";

const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwUMMAYAj4IP8cvlVgcAAAAASUVORK5CYII=";

export const reportOrganization: Organization = {
  id: "org-1",
  name: "Meridian Service Engineering",
  email: "service@meridian.example",
  phone: "+60 3-5555 0100",
  address: "18 Jalan Teknologi, 47810 Petaling Jaya, Selangor",
  currency: "MYR",
  timezone: "Asia/Kuala_Lumpur",
};

export const completedReportNote: ServiceNote = {
  id: "note-1",
  organization_id: "org-1",
  service_number: "SL-2026-000125",
  status: "COMPLETED",
  revision: 1,
  job_title: "Compressor pressure inspection",
  job_description: "Intermittent pressure loss reported on production line 2.",
  work_performed:
    "Inspected the regulator, replaced the seal kit, and pressure tested the assembly.",
  result_remarks: "Pressure remained stable at the specified operating range.",
  additional_notes:
    "Recommend a follow-up inspection during the next planned shutdown.",
  service_date: "2026-09-09",
  service_time: "09:30",
  person_in_charge_id: "employee-1",
  person_in_charge_name_snapshot: "Aina Rahman",
  person_in_charge_job_title_snapshot: "Senior Service Engineer",
  person_in_charge_employee_id_snapshot: "EMP-014",
  customer_id: "customer-1",
  customer_name_snapshot: "Atlas Manufacturing Sdn Bhd",
  contact_name_snapshot: "Daniel Lee",
  contact_position_snapshot: "Plant Manager",
  contact_mobile_snapshot: "+60 12-345 6789",
  contact_office_snapshot: "+60 3-5555 0200",
  contact_email_snapshot: "daniel@atlas.example",
  customer_address_snapshot: "27 Persiaran Industri, 40150 Shah Alam, Selangor",
  payment_status: "PAID",
  payment_method: "Bank Transfer",
  payment_terms: "Immediate",
  payment_reference: "TRX-90817",
  payment_remarks: "Received in full.",
  labor: [
    {
      id: "labor-1",
      name: "Aina Rahman",
      classification: "Senior Service Engineer",
      hours: "2.5",
      rate: "80",
      notes: "Inspection and testing",
    },
  ],
  materials: [
    {
      id: "material-1",
      description: "Seal kit",
      part_number: "SK-20",
      quantity: "1",
      unit_amount: "45",
      photo_id: "photo-1",
    },
  ],
  charges: [{ id: "charge-1", description: "Travel", amount: "50" }],
  photos: [
    {
      id: "photo-1",
      url: pixel,
      category: "AFTER",
      caption: "Assembly after pressure test",
      created_at: "2026-09-09T04:20:00Z",
      name: "assembly.png",
    },
  ],
  signature: {
    signer_name: "Daniel Lee",
    signer_position: "Plant Manager",
    image: pixel,
    signed_at: "2026-09-09T05:00:00Z",
  },
  labor_total: "200.00",
  material_total: "45.00",
  additional_charge_total: "50.00",
  subtotal: "295.00",
  discount_amount: "10.00",
  tax_rate: "6",
  tax_amount: "17.10",
  grand_total: "302.10",
  created_at: "2026-09-09T01:00:00Z",
  updated_at: "2026-09-09T05:00:00Z",
  completed_at: "2026-09-09T05:00:00Z",
};

describe("service report", () => {
  it("renders the complete customer-facing record without editable controls", () => {
    const html = renderToStaticMarkup(
      <ServiceReport
        note={completedReportNote}
        organization={reportOrganization}
      />,
    );

    expect(html).toContain("SL-2026-000125");
    expect(html).toContain("Atlas Manufacturing Sdn Bhd");
    expect(html).toContain("Inspected the regulator");
    expect(html).toContain("Seal kit");
    expect(html).toContain("TRX-90817");
    expect(html).toContain("Daniel Lee");
    expect(html).toContain("RM\u00a0302.10");
    expect(html).not.toMatch(/<(input|textarea|select)\b/);
  });

  it("generates a real PDF document from the same completed note", async () => {
    const buffer = await renderToBuffer(
      <ReportDocument
        note={completedReportNote}
        organization={reportOrganization}
      />,
    );

    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(2_000);
  });

  it("uses decimal-rounded line values and omits a misleading revision", () => {
    const html = renderToStaticMarkup(
      <ServiceReport
        note={{
          ...completedReportNote,
          labor: [
            { ...completedReportNote.labor[0], hours: "0.7", rate: "0.65" },
          ],
        }}
        organization={reportOrganization}
      />,
    );
    expect(html).toContain("RM\u00a00.46");
    expect(html).not.toContain("Revision");
  });

  it("routes detail printing through the canonical report", () => {
    const html = renderToStaticMarkup(
      <ReportActions
        note={completedReportNote}
        organization={reportOrganization}
        context="detail"
      />,
    );
    expect(html).toContain("/reports/note-1?print=1");
  });

  it("rejects a report when an image cannot be decoded", async () => {
    await expect(
      validateReportAssets(completedReportNote, async () => {
        throw new Error("decode failed");
      }),
    ).rejects.toThrow(/could not be loaded/i);
  });
});
