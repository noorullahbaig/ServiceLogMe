export type Role = "ADMIN" | "EMPLOYEE";
export interface Profile {
  id: string;
  organization_id: string;
  full_name: string;
  employee_id: string;
  job_title: string;
  email: string;
  mobile: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
}
export interface Organization {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  currency: string;
  timezone: string;
}
export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  contact_name: string;
  contact_position: string;
  mobile: string;
  office: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
}
export interface Labor {
  id: string;
  employee_id?: string;
  name: string;
  classification: string;
  hours: string;
  rate: string;
  notes: string;
}
export interface Material {
  id: string;
  description: string;
  part_number: string;
  quantity: string;
  unit_amount: string;
  photo_id?: string;
}
export interface Charge {
  id: string;
  description: string;
  amount: string;
}
export type PhotoCategory =
  "BEFORE" | "SERVICE" | "MATERIAL" | "AFTER" | "OTHER";
export interface Photo {
  id: string;
  file_id?: string;
  url: string;
  category: PhotoCategory;
  caption: string;
  created_at: string;
  name: string;
}
export interface Signature {
  file_id?: string;
  signer_name: string;
  signer_position: string;
  image: string;
  signed_at: string;
}
export type RecordType = "RECEIPT" | "INSPECTION" | "SERVICE" | "HANDOVER";
export type FinalizationType = "STAFF_ATTESTED" | "CUSTOMER_ACKNOWLEDGED";
export interface TrackedItem {
  id: string;
  organization_id: string;
  name: string;
  reference: string;
  customer_id?: string;
  created_at: string;
  updated_at: string;
}
export interface StoredMediaRef {
  id: string;
  url: string;
  contentType: string;
  byteSize: number;
}
export interface Totals {
  labor_total: string;
  material_total: string;
  additional_charge_total: string;
  subtotal: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  grand_total: string;
}
export interface ServiceNote extends Totals {
  id: string;
  organization_id: string;
  service_number: string;
  status: "DRAFT" | "COMPLETED";
  revision: number;
  record_type?: RecordType;
  tracked_item_id?: string;
  item_name_snapshot?: string;
  item_reference_snapshot?: string;
  location_snapshot?: string;
  billing_enabled?: boolean;
  finalization_type?: FinalizationType;
  staff_attested_at?: string;
  job_title: string;
  job_description: string;
  work_performed: string;
  result_remarks: string;
  additional_notes: string;
  service_date: string;
  service_time: string;
  person_in_charge_id: string;
  person_in_charge_name_snapshot: string;
  person_in_charge_job_title_snapshot: string;
  person_in_charge_employee_id_snapshot: string;
  customer_id: string;
  customer_name_snapshot: string;
  contact_name_snapshot: string;
  contact_position_snapshot: string;
  contact_mobile_snapshot: string;
  contact_office_snapshot: string;
  contact_email_snapshot: string;
  customer_address_snapshot: string;
  payment_status: "PAID" | "UNPAID";
  payment_method: string;
  payment_terms: string;
  payment_reference: string;
  payment_remarks: string;
  labor: Labor[];
  materials: Material[];
  charges: Charge[];
  photos: Photo[];
  signer_name_draft?: string;
  signer_position_draft?: string;
  signature: Signature | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
export interface AuditEvent {
  id: string;
  note_id: string;
  service_number: string;
  actor_name: string;
  type:
    "SERVICE_NOTE_CREATED" | "SERVICE_NOTE_UPDATED" | "SERVICE_NOTE_COMPLETED";
  created_at: string;
}
export interface WorkspaceData {
  organization: Organization;
  profile: Profile;
  employees: Profile[];
  customers: Customer[];
  tracked_items?: TrackedItem[];
  notes: ServiceNote[];
  events: AuditEvent[];
}
export type CompletionRequirementId =
  "service" | "customer" | "work" | "payment" | "acceptance";
export interface CompletionRequirement {
  id: CompletionRequirementId;
  label: string;
  step: number;
  fieldId: string;
  complete: boolean;
  errors: string[];
}
export interface CompletionReadiness {
  ready: boolean;
  requirements: CompletionRequirement[];
  firstIncomplete: CompletionRequirement | null;
  errors: string[];
}
export const paymentMethods = [
  "Cash",
  "Card",
  "DuitNow",
  "FPX / Online Banking",
  "Bank Transfer",
  "Credit",
  "Other",
];
export const paymentTerms = [
  "Immediate",
  "7 Days",
  "14 Days",
  "30 Days",
  "Custom",
];
