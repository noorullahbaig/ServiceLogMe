import Decimal from "decimal.js";
import type {
  ServiceNote,
  Profile,
  Customer,
  Totals,
  Labor,
  Material,
  Charge,
  CompletionReadiness,
} from "./types";
import { paymentMethods } from "./types";
function decimal(value: string, label: string) {
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value || "0"))
    throw new Error(`${label} must be a positive number.`);
  const d = new Decimal(value || 0);
  if (!d.isFinite() || d.isNegative() || d.gt("9999999999"))
    throw new Error(`${label} is outside the allowed range.`);
  return d;
}
const round = (n: Decimal) => n.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
export const acceptanceStatement =
  "I confirm that the service described above has been performed and acknowledge the information recorded in this Service Note.";
export const evidenceAcknowledgementStatement =
  "I acknowledge that the item, information and condition shown in this report reflect what was recorded at the stated time.";
export const conditionLabels = {
  NO_VISIBLE_ISSUE: "No visible issue",
  EXISTING_WEAR_DAMAGE: "Existing wear / damage",
  DAMAGED: "Damaged",
  UNABLE_TO_FULLY_INSPECT: "Unable to fully inspect",
  OTHER: "Other",
} as const;
export function calculateLineAmount(quantity: string, rate: string) {
  return round(
    decimal(quantity, "Quantity").times(decimal(rate, "Rate")),
  ).toFixed(2);
}
export function formatCurrency(value: string | number, currency = "MYR") {
  try {
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return `${currency} ${(Number(value) || 0).toFixed(2)}`;
  }
}
export function calculateTotals(input: {
  labor: Labor[];
  materials: Material[];
  charges: Charge[];
  discount_amount: string;
  tax_rate: string;
}): Totals {
  const labor = input.labor.reduce(
    (s, l) =>
      s.plus(round(decimal(l.hours, "Hours").times(decimal(l.rate, "Rate")))),
    new Decimal(0),
  );
  const materials = input.materials.reduce(
    (s, m) =>
      s.plus(
        round(
          decimal(m.quantity, "Quantity").times(
            decimal(m.unit_amount, "Unit amount"),
          ),
        ),
      ),
    new Decimal(0),
  );
  const charges = input.charges.reduce(
    (s, c) => s.plus(round(decimal(c.amount, "Charge"))),
    new Decimal(0),
  );
  const subtotal = labor.plus(materials).plus(charges),
    discount = round(decimal(input.discount_amount, "Discount")),
    rate = decimal(input.tax_rate, "Tax rate");
  if (discount.gt(subtotal))
    throw new Error("Discount cannot exceed the subtotal.");
  if (rate.gt(100)) throw new Error("Tax rate cannot exceed 100%.");
  const tax = round(subtotal.minus(discount).times(rate).div(100)),
    total = subtotal.minus(discount).plus(tax);
  if (total.gt("9999999999.99"))
    throw new Error("Grand total exceeds the allowed amount.");
  return {
    labor_total: labor.toFixed(2),
    material_total: materials.toFixed(2),
    additional_charge_total: charges.toFixed(2),
    subtotal: subtotal.toFixed(2),
    discount_amount: discount.toFixed(2),
    tax_rate: rate.toString(),
    tax_amount: tax.toFixed(2),
    grand_total: total.toFixed(2),
  };
}
function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number),
    date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
export function isValidSignature(n: Pick<ServiceNote, "signature">) {
  return Boolean(
    n.signature?.signer_name?.trim() &&
    (n.signature.file_id || n.signature.image?.startsWith("data:image/png;base64,")),
  );
}
export function requiresCustomerAcknowledgement(
  n: Pick<ServiceNote, "finalization_type">,
) {
  return n.finalization_type !== "STAFF_ATTESTED";
}
export function searchableNoteText(n: Pick<ServiceNote, "service_number" | "item_name_snapshot" | "item_reference_snapshot" | "invoice_number" | "delivery_number" | "contact_number_snapshot" | "job_title" | "job_description" | "work_performed" | "result_remarks" | "additional_notes" | "customer_name_snapshot" | "person_in_charge_name_snapshot" | "photos">) {
  return [
    n.service_number,
    n.item_name_snapshot,
    n.item_reference_snapshot,
    n.invoice_number,
    n.delivery_number,
    n.contact_number_snapshot,
    n.customer_name_snapshot,
    n.person_in_charge_name_snapshot,
    n.job_title,
    n.job_description,
    n.work_performed,
    n.result_remarks,
    n.additional_notes,
    ...n.photos.flatMap((photo) => [photo.caption, photo.name]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
function evidenceCompletionReadiness(n: ServiceNote): CompletionReadiness {
  const customer: string[] = [],
    item: string[] = [],
    condition: string[] = [],
    photos: string[] = [],
    acceptance: string[] = [];
  if (!n.customer_name_snapshot?.trim())
    customer.push("Customer / company name is required before submitting this Report.");
  if (!n.contact_number_snapshot?.trim())
    customer.push("Contact number is required before submitting this Report.");
  if (!n.item_name_snapshot?.trim())
    item.push("Item description is required before submitting this Report.");
  try {
    const quantity = decimal(n.quantity || "", "Quantity");
    if (quantity.lte(0)) item.push("Quantity must be greater than zero.");
  } catch {
    item.push("Enter a valid quantity greater than zero.");
  }
  if (n.declared_total_value?.trim()) {
    try {
      const value = decimal(n.declared_total_value, "Total value");
      if (value.lte(0)) item.push("Total value must be greater than zero.");
    } catch {
      item.push("Enter a valid total value greater than zero.");
    }
    if (!/^[A-Z]{3}$/.test(n.declared_currency || ""))
      item.push("Currency is required when total value is entered.");
  }
  if (!n.location_snapshot?.trim())
    condition.push("Location is required before submitting this Report.");
  if (!n.condition_code || !(n.condition_code in conditionLabels))
    condition.push("Condition is required before submitting this Report.");
  else if (
    n.condition_code !== "NO_VISIBLE_ISSUE" &&
    !n.condition_remarks?.trim()
  )
    condition.push("Condition remarks are required for the selected condition.");
  if (
    !n.photos.some(
      (photo) =>
        Boolean(photo.original_url) &&
        /^[a-f0-9]{64}$/i.test(photo.original_sha256 || ""),
    )
  )
    photos.push("At least one stored evidence photo is required before submitting this Report.");
  const signerStarted = Boolean(
    n.acknowledgement_enabled || n.signer_name_draft?.trim() || n.signature?.signer_name?.trim() || n.signature,
  );
  if (signerStarted && !n.signature?.signer_name?.trim())
    acceptance.push("Signer name is required when acknowledgement is included.");
  if (signerStarted && !isValidSignature(n))
    acceptance.push("A signature is required when acknowledgement is included.");
  const requirements = [
    { id: "customer" as const, label: "Customer", step: 0, fieldId: "customer", errors: customer },
    { id: "item" as const, label: "Item", step: 2, fieldId: "item_name_snapshot", errors: item },
    { id: "condition" as const, label: "Location & condition", step: 3, fieldId: "location_snapshot", errors: condition },
    { id: "photos" as const, label: "Photos", step: 4, fieldId: "evidence-photos", errors: photos },
    { id: "acceptance" as const, label: "Acknowledgement", step: 6, fieldId: "acceptance", errors: acceptance },
  ].map((requirement) => ({ ...requirement, complete: requirement.errors.length === 0 }));
  const firstIncomplete = requirements.find((requirement) => !requirement.complete) ?? null;
  return {
    ready: firstIncomplete === null,
    requirements,
    firstIncomplete,
    errors: requirements.flatMap((requirement) => requirement.errors),
  };
}
export function completionReadiness(n: ServiceNote): CompletionReadiness {
  if (n.schema_version === 2) return evidenceCompletionReadiness(n);
  const service: string[] = [],
    customer: string[] = [],
    work: string[] = [],
    payment: string[] = [],
    acceptance: string[] = [];
  if (!n.job_title?.trim())
    service.push("Job title is required before completing this Service Note.");
  if (!n.service_date?.trim())
    service.push("Date is required before completing this Service Note.");
  else if (!validCalendarDate(n.service_date))
    service.push("Enter a valid service date.");
  if (!n.service_time?.trim())
    service.push("Time is required before completing this Service Note.");
  else if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(n.service_time))
    service.push("Enter a valid service time.");
  if (!n.person_in_charge_id?.trim())
    service.push(
      "Person in charge is required before completing this Service Note.",
    );
  const customerAcknowledgement = requiresCustomerAcknowledgement(n);
  if (customerAcknowledgement && !n.customer_id?.trim())
    customer.push("Customer is required before completing this Service Note.");
  if (
    customerAcknowledgement &&
    !(n.contact_mobile_snapshot || n.contact_office_snapshot)?.trim()
  )
    customer.push(
      "Contact number is required before completing this Service Note.",
    );
  if (!n.work_performed?.trim())
    work.push(
      "Work performed is required before completing this Service Note.",
    );
  const billingEnabled = n.billing_enabled !== false;
  if (billingEnabled && !["PAID", "UNPAID"].includes(n.payment_status))
    payment.push(
      "Payment status is required before completing this Service Note.",
    );
  if (billingEnabled && n.payment_status === "PAID" && !n.payment_method?.trim())
    payment.push("Payment method is required when payment status is Paid.");
  else if (
    billingEnabled &&
    n.payment_status === "PAID" &&
    !paymentMethods.includes(n.payment_method)
  )
    payment.push("Select a valid payment method.");
  if (customerAcknowledgement && !n.signature?.signer_name?.trim())
    acceptance.push("Signer name is required.");
  if (
    customerAcknowledgement &&
    !n.signature?.file_id &&
    !n.signature?.image?.startsWith("data:image/png;base64,")
  )
    acceptance.push(
      "Customer signature is required before completing this Service Note.",
    );
  const requirements = [
    {
      id: "service" as const,
      label: "Service information",
      step: 0,
      fieldId: "job_title",
      errors: service,
    },
    {
      id: "customer" as const,
      label: "Customer",
      step: 1,
      fieldId: "customer",
      errors: customer,
    },
    {
      id: "work" as const,
      label: "Service details",
      step: 2,
      fieldId: "work_performed",
      errors: work,
    },
    {
      id: "payment" as const,
      label: "Payment",
      step: 5,
      fieldId: "payment_status",
      errors: payment,
    },
    {
      id: "acceptance" as const,
      label: "Customer acceptance",
      step: 6,
      fieldId: "acceptance",
      errors: acceptance,
    },
  ].map((item) => ({ ...item, complete: item.errors.length === 0 }));
  const firstIncomplete = requirements.find((item) => !item.complete) ?? null,
    errors = requirements.flatMap((item) => item.errors);
  return { ready: !firstIncomplete, requirements, firstIncomplete, errors };
}
export function completionErrors(n: ServiceNote) {
  return completionReadiness(n).errors;
}
export function isCompletedRecord(n: ServiceNote) {
  if (n.schema_version === 2) return n.status === "COMPLETED";
  return n.status === "COMPLETED" &&
    (n.finalization_type === "STAFF_ATTESTED" || isValidSignature(n));
}
export function canAccessNote(p: Profile, n: ServiceNote) {
  return (
    p.status === "ACTIVE" &&
    p.organization_id === n.organization_id &&
    (p.role === "ADMIN" || p.id === n.person_in_charge_id)
  );
}
export function customerSnapshot(c: Customer) {
  return {
    customer_id: c.id,
    customer_name_snapshot: c.name,
    contact_number_snapshot: c.contact_number || c.mobile || c.office || "",
    contact_name_snapshot: c.contact_name,
    contact_position_snapshot: c.contact_position || "",
    contact_mobile_snapshot: c.mobile || "",
    contact_office_snapshot: c.office || "",
    contact_email_snapshot: c.email || "",
    customer_address_snapshot: c.address || "",
  };
}
export function money(amount: string | number) {
  return formatCurrency(amount, "MYR");
}
export function shortDate(date: string) {
  return date
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(date.length === 10 ? `${date}T12:00:00` : date))
    : "—";
}
export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
