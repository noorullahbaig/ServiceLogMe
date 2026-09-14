"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { initials, shortDate } from "@/lib/domain";
import type {
  Customer,
  Organization,
  Profile,
  ServiceNote,
  WorkspaceData,
} from "@/lib/types";
import "./directories.css";

type CustomerInput = Omit<Customer, "id" | "organization_id" | "created_at"> & {
  id?: string;
};
type SaveCustomer = (input: CustomerInput) => Promise<Customer>;

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Changes could not be saved. Please try again.";
}

function locationLabel(address: string) {
  const lines = address
    .split(/\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
  const places = lines.filter(
    (part) => part.toLowerCase() !== "malaysia" && !/^\d/.test(part),
  );
  return places.at(-1) ?? lines.at(-1) ?? "No address";
}

function notesForCustomer(notes: ServiceNote[], customerId: string) {
  return notes
    .filter((note) => note.customer_id === customerId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function StatusMessage({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`dir-feedback dir-feedback-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {tone === "success" ? (
        <CheckCircle2 aria-hidden="true" />
      ) : (
        <AlertCircle aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}

function DirectoryDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dir-dialog-overlay" />
        <Dialog.Content className="dir-dialog-content">
          <div className="dir-dialog-heading">
            <div>
              <Dialog.Title className="dir-dialog-title">{title}</Dialog.Title>
              <Dialog.Description className="dir-dialog-description">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                className="icon-button"
                type="button"
                aria-label="Close dialog"
              >
                <X aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const blankCustomer: CustomerInput = {
  name: "",
  contact_name: "",
  contact_position: "",
  mobile: "",
  office: "",
  contact_number: "",
  email: "",
  address: "",
  notes: "",
};

function CustomerEditor({
  customer,
  open,
  onOpenChange,
  onSave,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: SaveCustomer;
}) {
  const id = useId();
  const [form, setForm] = useState<CustomerInput>(blankCustomer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    // The dialog receives a different record while it remains mounted; clear
    // its editable copy only when that record is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(
      customer
        ? {
            id: customer.id,
            name: customer.name,
            contact_name: customer.contact_name,
            contact_position: customer.contact_position,
            mobile: customer.mobile,
            office: customer.office,
            contact_number:
              customer.contact_number || customer.mobile || customer.office,
            email: customer.email,
            address: customer.address,
            notes: customer.notes,
          }
        : blankCustomer,
    );
    setError("");
  }, [customer, open]);

  function update(field: keyof CustomerInput, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, name: form.name.trim() });
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DirectoryDialog
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      title={customer ? "Edit customer" : "Add customer"}
      description="Keep the report contact and address details current."
    >
      <form onSubmit={submit} className="dir-form">
        <div className="dir-form-grid">
          <label className="field dir-form-full" htmlFor={`${id}-name`}>
            <span>Company or customer name</span>
            <input
              id={`${id}-name`}
              className="input"
              required
              autoComplete="organization"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
            />
          </label>
          <label className="field" htmlFor={`${id}-contact`}>
            <span>Primary contact</span>
            <input
              id={`${id}-contact`}
              className="input"
              autoComplete="name"
              value={form.contact_name}
              onChange={(event) => update("contact_name", event.target.value)}
            />
          </label>
          <label className="field" htmlFor={`${id}-phone`}>
            <span>Contact number</span>
            <input
              id={`${id}-phone`}
              className="input"
              type="tel"
              autoComplete="tel"
              value={form.contact_number || ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contact_number: event.target.value,
                  mobile: event.target.value,
                  office: "",
                }))
              }
            />
          </label>
          <label className="field dir-form-full" htmlFor={`${id}-email`}>
            <span>Email</span>
            <input
              id={`${id}-email`}
              className="input"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </label>
          <label className="field dir-form-full" htmlFor={`${id}-address`}>
            <span>Address</span>
            <textarea
              id={`${id}-address`}
              className="textarea"
              rows={3}
              autoComplete="street-address"
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
            />
          </label>
          <label className="field dir-form-full" htmlFor={`${id}-notes`}>
            <span>Directory notes</span>
            <textarea
              id={`${id}-notes`}
              className="textarea"
              rows={3}
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
            />
          </label>
        </div>
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
        <div className="dir-dialog-actions">
          <Dialog.Close asChild>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={saving}
            >
              Cancel
            </button>
          </Dialog.Close>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? "Saving…" : "Save customer"}
          </button>
        </div>
      </form>
    </DirectoryDialog>
  );
}

export function Customers({
  data,
  onSaveCustomer,
}: {
  data: WorkspaceData;
  onSaveCustomer: SaveCustomer;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Customer | null | undefined>(
    undefined,
  );
  const [feedback, setFeedback] = useState("");
  const customers = data.customers;

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [
        customer.name,
        customer.contact_name,
        customer.contact_position,
        customer.contact_number || customer.mobile || customer.office,
        customer.email,
        customer.address,
      ].some((value) => value.toLocaleLowerCase().includes(term)),
    );
  }, [customers, query]);

  const completed = data.notes.filter((note) => note.status === "COMPLETED");

  async function save(input: CustomerInput) {
    const saved = await onSaveCustomer(input);
    setFeedback(`${saved.name} saved.`);
    return saved;
  }

  return (
    <div className="dir-page">
      <header className="page-header dir-page-header">
        <div>
          <p className="eyebrow">Customer directory</p>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">
            Contacts, locations and complete report history.
          </p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setEditing(null)}
        >
          <Plus aria-hidden="true" /> Add customer
        </button>
      </header>

      <div className="dir-summary" aria-label="Customer summary">
        <div className="dir-summary-item">
          <strong>{customers.length}</strong>
          <span>Customers</span>
        </div>
        <div className="dir-summary-item">
          <strong>{completed.length}</strong>
          <span>Completed reports</span>
        </div>
        <div className="dir-summary-item">
          <strong>
            {data.notes.reduce((total, note) => total + note.photos.length, 0)}
          </strong>
          <span>Evidence photos</span>
        </div>
      </div>

      <div className="dir-toolbar">
        <label className="dir-search">
          <Search aria-hidden="true" />
          <span className="dir-sr-only">Search customers</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, contact, phone or location"
          />
        </label>
        <span className="dir-result-count" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
        </span>
      </div>

      {feedback && <StatusMessage tone="success">{feedback}</StatusMessage>}

      <div className="table-wrap dir-table-wrap">
        <table className="data-table dir-table">
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Primary contact</th>
              <th scope="col">Phone</th>
              <th scope="col">Location</th>
              <th scope="col">Reports</th>
              <th scope="col">Last report</th>
              <th scope="col">
                <span className="dir-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => {
              const history = notesForCustomer(data.notes, customer.id);
              return (
                <tr key={customer.id}>
                  <td>
                    <Link
                      className="dir-primary-link"
                      href={`/customers/${customer.id}`}
                    >
                      <span className="avatar dir-avatar">
                        {initials(customer.name)}
                      </span>
                      <span>
                        <strong>{customer.name}</strong>
                        <small>{customer.email || "No email recorded"}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="dir-cell-main">
                      {customer.contact_name || "Not recorded"}
                    </span>
                    <small>{customer.contact_position}</small>
                  </td>
                  <td className="mono dir-nowrap">
                    {customer.contact_number ||
                      customer.mobile ||
                      customer.office ||
                      "—"}
                  </td>
                  <td>{locationLabel(customer.address)}</td>
                  <td>{history.length}</td>
                  <td className="dir-nowrap">
                    {history[0]
                      ? shortDate(history[0].created_at)
                      : "No report yet"}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Edit ${customer.name}`}
                      onClick={() => setEditing(customer)}
                    >
                      <Pencil aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="dir-empty">
            <Building2 aria-hidden="true" />
            <strong>No customers found</strong>
            <span>
              {query
                ? "Try a different name, contact, phone or location."
                : "Add the first customer to start a reusable report record."}
            </span>
          </div>
        )}
      </div>

      <CustomerEditor
        customer={editing ?? null}
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        onSave={save}
      />
    </div>
  );
}

export function CustomerDetail({
  customer,
  data,
  onSaveCustomer,
}: {
  customer: Customer;
  data: WorkspaceData;
  onSaveCustomer: SaveCustomer;
}) {
  const [editing, setEditing] = useState(false);
  const [record, setRecord] = useState(customer);
  const [feedback, setFeedback] = useState("");

  const history = notesForCustomer(data.notes, record.id);
  const completed = history.filter((note) => note.status === "COMPLETED");

  async function save(input: CustomerInput) {
    const saved = await onSaveCustomer(input);
    setRecord(saved);
    setFeedback("Customer details saved.");
    return saved;
  }

  return (
    <div className="dir-page">
      <Link href="/customers" className="dir-back">
        <ArrowLeft aria-hidden="true" /> Customers
      </Link>
      <header className="page-header dir-page-header dir-detail-header">
        <div className="dir-customer-heading">
          <span className="avatar dir-avatar dir-avatar-large">
            {initials(record.name)}
          </span>
          <div>
            <p className="eyebrow">Customer record</p>
            <h1 className="page-title">{record.name}</h1>
            <p className="page-subtitle">
              Added {shortDate(record.created_at)}
            </p>
          </div>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setEditing(true)}
        >
          <Pencil aria-hidden="true" /> Edit customer
        </button>
      </header>

      {feedback && <StatusMessage tone="success">{feedback}</StatusMessage>}

      <div className="dir-summary" aria-label="Customer report summary">
        <div className="dir-summary-item">
          <strong>{history.length}</strong>
          <span>Reports</span>
        </div>
        <div className="dir-summary-item">
          <strong>{completed.length}</strong>
          <span>Completed</span>
        </div>
        <div className="dir-summary-item">
          <strong>
            {history.reduce((total, note) => total + note.photos.length, 0)}
          </strong>
          <span>Evidence photos</span>
        </div>
      </div>

      <div className="dir-detail-grid">
        <section
          className="dir-section"
          aria-labelledby="customer-contact-heading"
        >
          <div className="dir-section-heading">
            <div>
              <h2 id="customer-contact-heading">Contact information</h2>
              <p>Primary report contact.</p>
            </div>
          </div>
          <dl className="dir-definition-grid">
            <div>
              <dt>
                <UserRound aria-hidden="true" /> Primary contact
              </dt>
              <dd>
                {record.contact_name || "Not recorded"}
                {record.contact_position && (
                  <small>{record.contact_position}</small>
                )}
              </dd>
            </div>
            <div>
              <dt>
                <Phone aria-hidden="true" /> Contact number
              </dt>
              <dd>
                {record.contact_number || record.mobile || record.office ? (
                  <a
                    href={`tel:${record.contact_number || record.mobile || record.office}`}
                  >
                    {record.contact_number || record.mobile || record.office}
                  </a>
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
            <div>
              <dt>
                <Mail aria-hidden="true" /> Email
              </dt>
              <dd>
                {record.email ? (
                  <a href={`mailto:${record.email}`}>{record.email}</a>
                ) : (
                  "Not recorded"
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="dir-section"
          aria-labelledby="customer-site-heading"
        >
          <div className="dir-section-heading">
            <div>
              <h2 id="customer-site-heading">Address details</h2>
              <p>Address and operational notes used on reports.</p>
            </div>
          </div>
          <div className="dir-site-grid">
            <div className="dir-address">
              <h3>
                <MapPin aria-hidden="true" /> Address
              </h3>
              <p>{record.address || "No address recorded."}</p>
            </div>
            <div className="dir-address">
              <h3>Directory notes</h3>
              <p>{record.notes || "No customer notes recorded."}</p>
            </div>
          </div>
        </section>
      </div>

      <section
        className="dir-section dir-history"
        aria-labelledby="service-history-heading"
      >
        <div className="dir-section-heading">
          <div>
            <h2 id="service-history-heading">Report history</h2>
            <p>Every evidence report recorded for this customer.</p>
          </div>
          <span className="dir-result-count">{history.length} records</span>
        </div>
        <div className="table-wrap dir-table-wrap">
          <table className="data-table dir-table">
            <thead>
              <tr>
                <th scope="col">Report number</th>
                <th scope="col">Report date</th>
                <th scope="col">Item description</th>
                <th scope="col">Item reference</th>
                <th scope="col">Person in charge</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="dir-sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((note) => (
                <tr key={note.id}>
                  <td>
                    <Link
                      className="dir-text-link mono"
                      href={`/service-notes/${note.id}`}
                    >
                      {note.service_number}
                    </Link>
                  </td>
                  <td className="dir-nowrap">{shortDate(note.created_at)}</td>
                  <td>
                    <span className="dir-cell-main">
                      {note.item_name_snapshot || "Item not described"}
                    </span>
                  </td>
                  <td className="mono">
                    {note.item_reference_snapshot || "—"}
                  </td>
                  <td>{note.person_in_charge_name_snapshot}</td>
                  <td>
                    <span
                      className={`badge ${note.status === "COMPLETED" ? "badge-success" : "badge-neutral"}`}
                    >
                      {note.status === "COMPLETED" ? "Completed" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <Link
                      className="icon-button"
                      aria-label={`Open ${note.service_number}`}
                      href={`/service-notes/${note.id}`}
                    >
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <div className="dir-empty">
              <BriefcaseBusiness aria-hidden="true" />
              <strong>No report history</strong>
              <span>Reports for this customer will appear here.</span>
            </div>
          )}
        </div>
      </section>

      <CustomerEditor
        customer={record}
        open={editing}
        onOpenChange={setEditing}
        onSave={save}
      />
    </div>
  );
}

function EmployeeEditor({
  employee,
  open,
  onOpenChange,
  onSave,
}: {
  employee: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (profile: Profile) => Promise<void>;
}) {
  const id = useId();
  const [form, setForm] = useState(employee);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(employee);
    setError("");
  }, [employee, open]);

  function update<K extends keyof Profile>(field: K, value: Profile[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        full_name: form.full_name.trim(),
        employee_id: form.employee_id.trim(),
      });
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DirectoryDialog
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      title="Edit employee"
      description="Update the employee directory record and access status."
    >
      <form onSubmit={submit} className="dir-form">
        <div className="dir-form-grid">
          <label className="field dir-form-full" htmlFor={`${id}-full-name`}>
            <span>Full name</span>
            <input
              id={`${id}-full-name`}
              className="input"
              required
              autoComplete="name"
              value={form.full_name}
              onChange={(event) => update("full_name", event.target.value)}
            />
          </label>
          <label className="field" htmlFor={`${id}-employee-id`}>
            <span>Employee ID</span>
            <input
              id={`${id}-employee-id`}
              className="input mono"
              required
              value={form.employee_id}
              onChange={(event) => update("employee_id", event.target.value)}
            />
          </label>
          <label className="field" htmlFor={`${id}-job-title`}>
            <span>Job title</span>
            <input
              id={`${id}-job-title`}
              className="input"
              required
              value={form.job_title}
              onChange={(event) => update("job_title", event.target.value)}
            />
          </label>
          <label
            className="field dir-form-full"
            htmlFor={`${id}-employee-email`}
          >
            <span>Email</span>
            <input
              id={`${id}-employee-email`}
              className="input"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </label>
          <label
            className="field dir-form-full"
            htmlFor={`${id}-employee-mobile`}
          >
            <span>Mobile number</span>
            <input
              id={`${id}-employee-mobile`}
              className="input"
              type="tel"
              autoComplete="tel"
              value={form.mobile}
              onChange={(event) => update("mobile", event.target.value)}
            />
          </label>
          <label className="field" htmlFor={`${id}-role`}>
            <span>Role</span>
            <select
              id={`${id}-role`}
              className="select"
              value={form.role}
              onChange={(event) =>
                update("role", event.target.value as Profile["role"])
              }
            >
              <option value="EMPLOYEE">Employee</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </label>
          <label className="field" htmlFor={`${id}-status`}>
            <span>Status</span>
            <select
              id={`${id}-status`}
              className="select"
              value={form.status}
              onChange={(event) =>
                update("status", event.target.value as Profile["status"])
              }
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </div>
        {error && <StatusMessage tone="error">{error}</StatusMessage>}
        <div className="dir-dialog-actions">
          <Dialog.Close asChild>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={saving}
            >
              Cancel
            </button>
          </Dialog.Close>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? "Saving…" : "Save employee"}
          </button>
        </div>
      </form>
    </DirectoryDialog>
  );
}

export function Employees({
  data,
  onSaveEmployee,
}: {
  data: WorkspaceData;
  onSaveEmployee: (profile: Profile) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [feedback, setFeedback] = useState("");
  const employees = data.employees;

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return employees;
    return employees.filter((employee) =>
      [
        employee.full_name,
        employee.employee_id,
        employee.job_title,
        employee.email,
        employee.mobile,
        employee.role,
        employee.status,
      ].some((value) => value.toLocaleLowerCase().includes(term)),
    );
  }, [employees, query]);

  async function save(profile: Profile) {
    await onSaveEmployee(profile);
    setFeedback(`${profile.full_name} saved.`);
  }

  const active = employees.filter(
    (employee) => employee.status === "ACTIVE",
  ).length;
  const admins = employees.filter(
    (employee) => employee.role === "ADMIN",
  ).length;

  return (
    <div className="dir-page">
      <header className="page-header dir-page-header">
        <div>
          <p className="eyebrow">Team directory</p>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">
            Employee identity, roles and workspace access status.
          </p>
        </div>
      </header>
      <div className="dir-summary" aria-label="Employee summary">
        <div className="dir-summary-item">
          <strong>{employees.length}</strong>
          <span>Employees</span>
        </div>
        <div className="dir-summary-item">
          <strong>{active}</strong>
          <span>Active</span>
        </div>
        <div className="dir-summary-item">
          <strong>{admins}</strong>
          <span>Administrators</span>
        </div>
      </div>
      <div className="dir-toolbar">
        <label className="dir-search">
          <Search aria-hidden="true" />
          <span className="dir-sr-only">Search employees</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, employee ID, role or contact"
          />
        </label>
        <span className="dir-result-count" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "employee" : "employees"}
        </span>
      </div>
      {feedback && <StatusMessage tone="success">{feedback}</StatusMessage>}
      <div className="table-wrap dir-table-wrap">
        <table className="data-table dir-table">
          <thead>
            <tr>
              <th scope="col">Employee</th>
              <th scope="col">Employee ID</th>
              <th scope="col">Job title</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="dir-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((employee) => (
              <tr key={employee.id}>
                <td>
                  <div className="dir-person">
                    <span className="avatar dir-avatar">
                      {initials(employee.full_name)}
                    </span>
                    <span>
                      <strong>{employee.full_name}</strong>
                      <small>{employee.mobile || "No mobile recorded"}</small>
                    </span>
                  </div>
                </td>
                <td className="mono dir-nowrap">{employee.employee_id}</td>
                <td>{employee.job_title}</td>
                <td>
                  <a
                    className="dir-text-link"
                    href={`mailto:${employee.email}`}
                  >
                    {employee.email}
                  </a>
                </td>
                <td>
                  <span
                    className={`badge ${employee.role === "ADMIN" ? "badge-info" : "badge-neutral"}`}
                  >
                    {employee.role === "ADMIN" ? "Administrator" : "Employee"}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${employee.status === "ACTIVE" ? "badge-success" : "badge-neutral"}`}
                  >
                    {employee.status === "ACTIVE" ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Edit ${employee.full_name}`}
                    onClick={() => setEditing(employee)}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="dir-empty">
            <UserRound aria-hidden="true" />
            <strong>No employees found</strong>
            <span>Try a different name, employee ID, role or contact.</span>
          </div>
        )}
      </div>
      {editing && (
        <EmployeeEditor
          employee={editing}
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

export function Settings({
  data,
  onSaveOrganization,
}: {
  data: WorkspaceData;
  onSaveOrganization: (organization: Organization) => Promise<void>;
}) {
  const id = useId();
  const [organization, setOrganization] = useState(data.organization);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const dirty =
    JSON.stringify(organization) !== JSON.stringify(data.organization);

  function update(field: keyof Organization, value: string) {
    setOrganization((current) => ({ ...current, [field]: value }));
    setMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await onSaveOrganization({
        ...organization,
        name: organization.name.trim(),
      });
      setMessage({ tone: "success", text: "Organization settings saved." });
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dir-page">
      <header className="page-header dir-page-header">
        <div>
          <p className="eyebrow">Workspace administration</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Organization details frozen into submitted reports.
          </p>
        </div>
      </header>
      <div className="dir-settings-layout">
        <section
          className="dir-section dir-settings-form"
          aria-labelledby="organization-heading"
        >
          <div className="dir-section-heading">
            <div>
              <h2 id="organization-heading">Organization</h2>
              <p>
                Keep the business and contact information shown in the workspace
                current.
              </p>
            </div>
          </div>
          <form className="dir-form" onSubmit={submit}>
            <div className="dir-form-grid">
              <label
                className="field dir-form-full"
                htmlFor={`${id}-organization-name`}
              >
                <span>Organization name</span>
                <input
                  id={`${id}-organization-name`}
                  className="input"
                  required
                  autoComplete="organization"
                  value={organization.name}
                  onChange={(event) => update("name", event.target.value)}
                />
              </label>
              <label className="field" htmlFor={`${id}-organization-email`}>
                <span>Email</span>
                <input
                  id={`${id}-organization-email`}
                  className="input"
                  required
                  type="email"
                  autoComplete="email"
                  value={organization.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </label>
              <label className="field" htmlFor={`${id}-organization-phone`}>
                <span>Phone</span>
                <input
                  id={`${id}-organization-phone`}
                  className="input"
                  type="tel"
                  autoComplete="tel"
                  value={organization.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </label>
              <label
                className="field dir-form-full"
                htmlFor={`${id}-organization-address`}
              >
                <span>Business address</span>
                <textarea
                  id={`${id}-organization-address`}
                  className="textarea"
                  rows={4}
                  autoComplete="street-address"
                  value={organization.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </label>
            </div>
            {message && (
              <StatusMessage tone={message.tone}>{message.text}</StatusMessage>
            )}
            <div className="dir-settings-actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || !dirty}
                aria-busy={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>
        <aside
          className="dir-workspace-facts"
          aria-labelledby="workspace-details-heading"
        >
          <h2 id="workspace-details-heading">Workspace details</h2>
          <dl>
            <div>
              <dt>Currency</dt>
              <dd className="mono">{organization.currency}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{organization.timezone}</dd>
            </div>
            <div>
              <dt>Organization ID</dt>
              <dd className="mono">{organization.id}</dd>
            </div>
          </dl>
          <p>Currency and timezone are fixed for this local workspace.</p>
        </aside>
      </div>
    </div>
  );
}

export function FieldProfile({ data }: { data: WorkspaceData }) {
  const profile = data.profile;
  return (
    <div className="dir-page dir-profile-page">
      <header className="page-header dir-page-header">
        <div>
          <p className="eyebrow">Employee identity</p>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">
            The identity attached to new reports in this workspace.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-secondary">
          Desktop workspace <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <section className="dir-profile-identity" aria-labelledby="profile-name">
        <span className="avatar dir-avatar dir-profile-avatar">
          {initials(profile.full_name)}
        </span>
        <div>
          <h2 id="profile-name">{profile.full_name}</h2>
          <p>{profile.job_title}</p>
          <div className="dir-profile-badges">
            <span
              className={`badge ${profile.status === "ACTIVE" ? "badge-success" : "badge-neutral"}`}
            >
              {profile.status === "ACTIVE" ? "Active" : "Inactive"}
            </span>
            <span
              className={`badge ${profile.role === "ADMIN" ? "badge-info" : "badge-neutral"}`}
            >
              {profile.role === "ADMIN" ? "Administrator" : "Employee"}
            </span>
          </div>
        </div>
      </section>
      <section
        className="dir-section"
        aria-labelledby="profile-details-heading"
      >
        <div className="dir-section-heading">
          <div>
            <h2 id="profile-details-heading">Profile details</h2>
            <p>These values are stored with your employee record.</p>
          </div>
        </div>
        <dl className="dir-definition-grid dir-profile-details">
          <div>
            <dt>
              <ShieldCheck aria-hidden="true" /> Employee ID
            </dt>
            <dd className="mono">{profile.employee_id}</dd>
          </div>
          <div>
            <dt>
              <BriefcaseBusiness aria-hidden="true" /> Job title
            </dt>
            <dd>{profile.job_title}</dd>
          </div>
          <div>
            <dt>
              <Mail aria-hidden="true" /> Email
            </dt>
            <dd>
              {profile.email ? (
                <a href={`mailto:${profile.email}`}>{profile.email}</a>
              ) : (
                "Not recorded"
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Phone aria-hidden="true" /> Mobile
            </dt>
            <dd>
              {profile.mobile ? (
                <a href={`tel:${profile.mobile}`}>{profile.mobile}</a>
              ) : (
                "Not recorded"
              )}
            </dd>
          </div>
          <div>
            <dt>
              <Building2 aria-hidden="true" /> Organization
            </dt>
            <dd>{data.organization.name}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
