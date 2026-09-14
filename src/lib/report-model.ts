import { conditionLabels, evidenceAcknowledgementStatement } from "./domain";
import type { EvidenceReport, Organization, ServiceNote } from "./types";

type Identity = { name: string; email: string; phone: string; address: string };

export type EvidenceReportViewModel = {
  kind: "EVIDENCE_REPORT";
  number: string;
  status: ServiceNote["status"];
  createdAt: string;
  completedAt: string | null;
  timezone: string;
  organization: Identity;
  employee: { name: string; employeeId: string; jobTitle: string };
  customer: { name: string; contactNumber: string; contactPerson: string; email: string; address: string };
  references: { invoiceNumber: string; deliveryNumber: string };
  item: { description: string; identifier: string; quantity: string; brand: string; model: string; totalValue: string; currency: string };
  location: string;
  condition: { code: string; label: string; remarks: string };
  photos: ServiceNote["photos"];
  notes: string;
  acknowledgement: null | { statement: string; signerName: string; signedAt: string; image: string };
  sections: string[];
};

export type LegacyReportViewModel = {
  kind: "LEGACY_SERVICE";
  number: string;
  note: ServiceNote;
  organization: Identity;
};

export type ReportViewModel = EvidenceReportViewModel | LegacyReportViewModel;

export function buildReportViewModel(note: EvidenceReport, organization: Organization): EvidenceReportViewModel;
export function buildReportViewModel(note: ServiceNote, organization: Organization): ReportViewModel;
export function buildReportViewModel(
  note: ServiceNote,
  organization: Organization,
): ReportViewModel {
  const currentOrganization = {
    name: organization.name,
    email: organization.email,
    phone: organization.phone,
    address: organization.address,
  };
  if (note.schema_version !== 2)
    return {
      kind: "LEGACY_SERVICE",
      number: note.service_number,
      note,
      organization: currentOrganization,
    };
  const acknowledgement = note.signature
    ? {
        statement:
          note.acknowledgement_text_snapshot || evidenceAcknowledgementStatement,
        signerName: note.signature.signer_name,
        signedAt: note.signature.signed_at,
        image: note.signature.image,
      }
    : null;
  return {
    kind: "EVIDENCE_REPORT",
    number: note.service_number,
    status: note.status,
    createdAt: note.created_at,
    completedAt: note.completed_at,
    timezone: note.organization_timezone_snapshot || organization.timezone,
    organization: {
      name: note.organization_name_snapshot || organization.name,
      email: note.organization_email_snapshot || organization.email,
      phone: note.organization_phone_snapshot || organization.phone,
      address: note.organization_address_snapshot || organization.address,
    },
    employee: {
      name: note.person_in_charge_name_snapshot,
      employeeId: note.person_in_charge_employee_id_snapshot,
      jobTitle: note.person_in_charge_job_title_snapshot,
    },
    customer: {
      name: note.customer_name_snapshot,
      contactNumber: note.contact_number_snapshot || "",
      contactPerson: note.contact_name_snapshot,
      email: note.contact_email_snapshot,
      address: note.customer_address_snapshot,
    },
    references: {
      invoiceNumber: note.invoice_number || "",
      deliveryNumber: note.delivery_number || "",
    },
    item: {
      description: note.item_name_snapshot || "",
      identifier: note.item_reference_snapshot || "",
      quantity: note.quantity || "1",
      brand: note.brand || "",
      model: note.model || "",
      totalValue: note.declared_total_value || "",
      currency: note.declared_currency || "",
    },
    location: note.location_snapshot || "",
    condition: {
      code: note.condition_code || "",
      label: note.condition_code ? conditionLabels[note.condition_code] : "",
      remarks: note.condition_remarks || "",
    },
    photos: note.photos,
    notes: note.additional_notes,
    acknowledgement,
    sections: [
      "customer",
      "references",
      "item",
      "location-condition",
      "photos",
      ...(note.additional_notes ? ["notes"] : []),
      ...(acknowledgement ? ["acknowledgement"] : []),
    ],
  };
}
