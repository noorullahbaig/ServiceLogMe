"use client";

import {
  CalendarDays,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import type { Organization, ServiceNote } from "@/lib/types";
import {
  acceptanceStatement,
  calculateLineAmount,
  formatCurrency,
} from "@/lib/domain";
import { ReportActions } from "./service-report";
import "./report.css";

type NoteDetailProps = {
  note: ServiceNote;
  organization: Organization;
  field?: boolean;
};

function money(value: string, organization: Organization) {
  return formatCurrency(value, organization.currency || "MYR");
}

function date(value: string, withTime = false) {
  if (!value) return "—";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(parsed);
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="detail-text-block">
      <h3>{title}</h3>
      <p>{value || "—"}</p>
    </div>
  );
}

function DetailHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="detail-section-heading">
      <h2>{children}</h2>
    </div>
  );
}

export function NoteDetail({
  note,
  organization,
  field = false,
}: NoteDetailProps) {
  return (
    <div className="note-detail-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Completed service note</p>
          <div className="report-title-line">
            <h1 className="page-title">{note.service_number}</h1>
            <span className="badge badge-success">
              <CheckCircle2 size={13} aria-hidden="true" /> Completed
            </span>
          </div>
          <p className="muted">{note.job_title}</p>
        </div>
        <ReportActions
          note={note}
          organization={organization}
          field={field}
          context="detail"
        />
      </header>

      <div className="note-detail-layout">
        <main className="note-detail-main">
          <section className="detail-card">
            <DetailHeading>Service</DetailHeading>
            <div className="detail-service-title">
              <span className="eyebrow">Job title</span>
              <strong>{note.job_title || "—"}</strong>
            </div>
            <div className="detail-text-grid">
              <TextBlock title="Reported issue" value={note.job_description} />
              <TextBlock title="Work performed" value={note.work_performed} />
              <TextBlock title="Result / remarks" value={note.result_remarks} />
              <TextBlock
                title="Additional notes"
                value={note.additional_notes}
              />
            </div>
          </section>

          <section className="detail-card">
            <DetailHeading>Labor</DetailHeading>
            <div className="detail-table-wrap">
              <table className="detail-table detail-labor-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Classification / notes</th>
                    <th className="numeric">Hours</th>
                    <th className="numeric">Rate</th>
                    <th className="numeric">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {note.labor.length ? (
                    note.labor.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td>
                          {item.classification}
                          <small>{item.notes}</small>
                        </td>
                        <td className="numeric">{item.hours}</td>
                        <td className="numeric">
                          {money(item.rate, organization)}
                        </td>
                        <td className="numeric">
                          {money(
                            calculateLineAmount(item.hours, item.rate),
                            organization,
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        No labor recorded
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Labor total</td>
                    <td className="numeric">
                      {money(note.labor_total, organization)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="detail-card">
            <DetailHeading>Materials</DetailHeading>
            <div className="detail-table-wrap">
              <table className="detail-table detail-material-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Part number</th>
                    <th className="numeric">Qty</th>
                    <th className="numeric">Unit amount</th>
                    <th className="numeric">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {note.materials.length ? (
                    note.materials.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.description}</strong>
                        </td>
                        <td className="mono">{item.part_number || "—"}</td>
                        <td className="numeric">{item.quantity}</td>
                        <td className="numeric">
                          {money(item.unit_amount, organization)}
                        </td>
                        <td className="numeric">
                          {money(
                            calculateLineAmount(
                              item.quantity,
                              item.unit_amount,
                            ),
                            organization,
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        No materials recorded
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Materials total</td>
                    <td className="numeric">
                      {money(note.material_total, organization)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="detail-card">
            <DetailHeading>Additional charges</DetailHeading>
            <div className="detail-charge-list">
              {note.charges.length ? (
                note.charges.map((charge) => (
                  <div key={charge.id}>
                    <span>{charge.description}</span>
                    <strong>{money(charge.amount, organization)}</strong>
                  </div>
                ))
              ) : (
                <p className="report-empty-state">
                  No additional charges recorded.
                </p>
              )}
              <div className="detail-charge-total">
                <span>Total</span>
                <strong>
                  {money(note.additional_charge_total, organization)}
                </strong>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <DetailHeading>Photos</DetailHeading>
            {note.photos.length ? (
              <div className="detail-photo-grid">
                {note.photos.map((photo) => (
                  <figure key={photo.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption || photo.name || "Service photo"}
                    />
                    <figcaption>
                      <span className="badge">{photo.category}</span>
                      <strong>{photo.caption || photo.name}</strong>
                      <small>{date(photo.created_at, true)}</small>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="report-empty-state">No service photos recorded.</p>
            )}
          </section>

          <section className="detail-card detail-financial-grid">
            <div>
              <DetailHeading>Payment</DetailHeading>
              <dl className="detail-definition-list">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span
                      className={`badge ${note.payment_status === "PAID" ? "badge-success" : "badge-warning"}`}
                    >
                      {note.payment_status === "PAID" ? "Paid" : "Unpaid"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Method</dt>
                  <dd>{note.payment_method || "—"}</dd>
                </div>
                <div>
                  <dt>Terms</dt>
                  <dd>{note.payment_terms || "—"}</dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd className="mono">{note.payment_reference || "—"}</dd>
                </div>
                <div>
                  <dt>Remarks</dt>
                  <dd>{note.payment_remarks || "—"}</dd>
                </div>
              </dl>
            </div>
            <div className="detail-total-panel">
              <span className="eyebrow">Financial summary</span>
              <dl>
                <div>
                  <dt>Labor</dt>
                  <dd>{money(note.labor_total, organization)}</dd>
                </div>
                <div>
                  <dt>Materials</dt>
                  <dd>{money(note.material_total, organization)}</dd>
                </div>
                <div>
                  <dt>Additional charges</dt>
                  <dd>{money(note.additional_charge_total, organization)}</dd>
                </div>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{money(note.subtotal, organization)}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>− {money(note.discount_amount, organization)}</dd>
                </div>
                <div>
                  <dt>Tax ({Number(note.tax_rate) || 0}%)</dt>
                  <dd>{money(note.tax_amount, organization)}</dd>
                </div>
                <div className="detail-grand-total">
                  <dt>Grand total</dt>
                  <dd>{money(note.grand_total, organization)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="detail-card">
            <DetailHeading>Customer acceptance</DetailHeading>
            <p className="detail-acceptance-copy">{acceptanceStatement}</p>
            {note.signature ? (
              <div className="detail-signature">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={note.signature.image}
                  alt={`Signature of ${note.signature.signer_name}`}
                />
                <div>
                  <strong>{note.signature.signer_name}</strong>
                  <span>
                    {note.signature.signer_position ||
                      "Customer representative"}
                  </span>
                  <small>Signed {date(note.signature.signed_at, true)}</small>
                </div>
              </div>
            ) : (
              <p className="report-empty-state">
                No customer signature recorded.
              </p>
            )}
          </section>
        </main>

        <aside className="note-context-rail" aria-label="Service note context">
          <section>
            <p className="eyebrow">Customer</p>
            <h2>{note.customer_name_snapshot || "—"}</h2>
            <div className="context-contact">
              <span>
                <UserRound size={15} />
                {note.contact_name_snapshot || "—"}
                {note.contact_position_snapshot && (
                  <small>{note.contact_position_snapshot}</small>
                )}
              </span>
              <span>
                <Phone size={15} />
                {[note.contact_mobile_snapshot, note.contact_office_snapshot]
                  .filter(Boolean)
                  .join(" / ") || "—"}
              </span>
              <span>
                <Mail size={15} />
                {note.contact_email_snapshot || "—"}
              </span>
              <span>
                <MapPin size={15} />
                {note.customer_address_snapshot || "—"}
              </span>
            </div>
          </section>
          <section>
            <p className="eyebrow">Person in charge</p>
            <h2>{note.person_in_charge_name_snapshot || "—"}</h2>
            <p>{note.person_in_charge_job_title_snapshot || "—"}</p>
            <p className="mono muted">
              {note.person_in_charge_employee_id_snapshot || "—"}
            </p>
          </section>
          <section>
            <p className="eyebrow">Dates</p>
            <dl className="context-dates">
              <div>
                <dt>
                  <CalendarDays size={15} />
                  Service
                </dt>
                <dd>
                  {date(note.service_date)} · {note.service_time || "—"}
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{date(note.created_at, true)}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{date(note.completed_at || "", true)}</dd>
              </div>
            </dl>
          </section>
          <section className="context-report-card">
            <p className="eyebrow">Final report</p>
            <p>
              The signed customer report includes all recorded service and
              financial details.
            </p>
            <a
              className="btn btn-primary"
              href={`${field ? "/field" : ""}/reports/${note.id}`}
            >
              View report
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
}
