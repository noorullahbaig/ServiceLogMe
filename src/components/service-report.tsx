"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import type { Organization, ServiceNote } from "@/lib/types";
import {
  acceptanceStatement,
  calculateLineAmount,
  formatCurrency,
} from "@/lib/domain";
import "./report.css";

type ReportProps = {
  note: ServiceNote;
  organization: Organization;
  field?: boolean;
};
type ReportActionsProps = ReportProps & { context?: "detail" | "report" };

function currency(value: string, organization: Organization) {
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

function lineAmount(quantity: string, rate: string) {
  return calculateLineAmount(quantity, rate);
}

async function waitForPrintableAssets() {
  await document.fonts?.ready;
  const pending = Array.from(document.images).filter(
    (image) => !image.complete,
  );
  await Promise.all(
    pending.map(
      (image) =>
        new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener(
            "error",
            () => reject(new Error("A report image could not be loaded.")),
            { once: true },
          );
        }),
    ),
  );
  if (Array.from(document.images).some((image) => !image.naturalWidth))
    throw new Error("A report image could not be loaded.");
}

function Value({ children }: { children?: React.ReactNode }) {
  return <span>{children || "—"}</span>;
}

export function ReportActions({
  note,
  organization,
  field = false,
  context = "report",
}: ReportActionsProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      const { downloadReport } = await import("@/lib/report-pdf");
      await downloadReport(note, organization);
    } catch (cause) {
      console.error(cause);
      setError("The PDF could not be generated. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function handlePrint() {
    setError("");
    try {
      await waitForPrintableAssets();
      window.print();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The report could not be prepared for printing.",
      );
    }
  }

  const reportHref = `${field ? "/field" : ""}/reports/${note.id}`;

  return (
    <div className="report-actions" aria-label="Report actions">
      {context === "detail" && (
        <a className="btn btn-secondary" href={reportHref}>
          <FileText size={16} aria-hidden="true" /> View report
        </a>
      )}
      {context === "detail" ? (
        <a
          className="btn btn-secondary"
          href={`${reportHref}?print=1`}
          target="_blank"
          rel="noreferrer"
        >
          <Printer size={16} aria-hidden="true" /> Print report
        </a>
      ) : (
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => void handlePrint()}
        >
          <Printer size={16} aria-hidden="true" /> Print
        </button>
      )}
      <button
        className="btn btn-primary"
        type="button"
        onClick={handleDownload}
        disabled={downloading}
      >
        <Download size={16} aria-hidden="true" />{" "}
        {downloading ? "Preparing PDF…" : "Download PDF"}
      </button>
      {error && (
        <p className="report-action-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Narrative({ label, children }: { label: string; children: string }) {
  return (
    <div className="report-narrative">
      <h3>{label}</h3>
      <p>{children || "—"}</p>
    </div>
  );
}

export function ServiceReport({
  note,
  organization,
  field = false,
}: ReportProps) {
  const [printError, setPrintError] = useState("");
  const staffAttested = note.finalization_type === "STAFF_ATTESTED";
  const hasBilling = note.billing_enabled !== false;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("print") !== "1")
      return;
    void waitForPrintableAssets()
      .then(() => window.print())
      .catch((cause) =>
        setPrintError(
          cause instanceof Error
            ? cause.message
            : "The report could not be prepared for printing.",
        ),
      );
  }, []);
  return (
    <div className="service-report-layout">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {staffAttested ? "Internal item record" : "Customer service report"}
          </p>
          <div className="report-title-line">
            <h1 className="page-title">{note.service_number}</h1>
            <span className="badge badge-success">Completed</span>
          </div>
          <p className="muted">
            {staffAttested
              ? "A finalized internal record with staff attestation."
              : "A finalized record of service and customer acceptance."}
          </p>
        </div>
        <ReportActions
          note={note}
          organization={organization}
          field={field}
          context="report"
        />
      </header>
      {printError && (
        <p className="report-action-error" role="alert">
          {printError}
        </p>
      )}

      <article
        className="service-report-screen"
        aria-label={`Service report ${note.service_number}`}
      >
        <header className="report-brand-header">
          <div className="report-brand">
            <div className="report-brand-mark" aria-hidden="true">
              SL
            </div>
            <div>
              <h2>{organization.name}</h2>
              <p>{organization.address}</p>
              <p>
                {[organization.phone, organization.email]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="report-identity">
            <p className="eyebrow">Service report</p>
            <strong className="mono">{note.service_number}</strong>
          </div>
        </header>

        <section className="report-meta-strip" aria-label="Service information">
          <div>
            <span>Service date</span>
            <strong>{date(note.service_date)}</strong>
          </div>
          <div>
            <span>Service time</span>
            <strong>{note.service_time || "—"}</strong>
          </div>
          <div>
            <span>Person in charge</span>
            <strong>{note.person_in_charge_name_snapshot || "—"}</strong>
          </div>
          <div>
            <span>Employee ID</span>
            <strong>{note.person_in_charge_employee_id_snapshot || "—"}</strong>
          </div>
        </section>

        <section className="report-two-column">
          <div className="report-block">
            <p className="report-section-kicker">{staffAttested ? "Item" : "Customer"}</p>
            <h2>{staffAttested ? note.item_name_snapshot || "—" : note.customer_name_snapshot || "—"}</h2>
            <dl className="report-definition-list">
              {staffAttested ? <>
                <div><dt>Reference</dt><dd className="mono"><Value>{note.item_reference_snapshot}</Value></dd></div>
                <div><dt>Event location</dt><dd><Value>{note.location_snapshot}</Value></dd></div>
              </> : <>
              <div>
                <dt>Contact</dt>
                <dd>
                  <Value>{note.contact_name_snapshot}</Value>
                  {note.contact_position_snapshot && (
                    <small>{note.contact_position_snapshot}</small>
                  )}
                </dd>
              </div>
              <div>
                <dt>Telephone</dt>
                <dd>
                  <Value>
                    {[
                      note.contact_mobile_snapshot,
                      note.contact_office_snapshot,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </Value>
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <Value>{note.contact_email_snapshot}</Value>
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  <Value>{note.customer_address_snapshot}</Value>
                </dd>
              </div>
              </>}
            </dl>
          </div>
          <div className="report-block report-job-summary">
            <p className="report-section-kicker">Service</p>
            <h2>{note.job_title || "—"}</h2>
            <p className="muted">
              Handled by {note.person_in_charge_name_snapshot || "—"}
            </p>
            <p className="muted">
              {note.person_in_charge_job_title_snapshot || "Service employee"}
            </p>
          </div>
        </section>

        <section className="report-section">
          <div className="report-section-heading">
            <span>01</span>
            <h2>Service record</h2>
          </div>
          <div className="report-narrative-grid">
            <Narrative label="Reported issue">{note.job_description}</Narrative>
            <Narrative label="Work performed">{note.work_performed}</Narrative>
            <Narrative label="Result / remarks">
              {note.result_remarks}
            </Narrative>
            <Narrative label="Additional notes">
              {note.additional_notes}
            </Narrative>
          </div>
        </section>

        {hasBilling && <>
        <section className="report-section">
          <div className="report-section-heading">
            <span>02</span>
            <h2>Labor</h2>
          </div>
          <div className="report-table-wrap">
            <table className="report-table report-labor-table">
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
                      <td>{item.name}</td>
                      <td>
                        {item.classification}
                        <small>{item.notes}</small>
                      </td>
                      <td className="numeric">{item.hours}</td>
                      <td className="numeric">
                        {currency(item.rate, organization)}
                      </td>
                      <td className="numeric">
                        {currency(
                          lineAmount(item.hours, item.rate),
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
                    {currency(note.labor_total, organization)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="report-section">
          <div className="report-section-heading">
            <span>03</span>
            <h2>Materials</h2>
          </div>
          <div className="report-table-wrap">
            <table className="report-table report-material-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Part number</th>
                  <th className="numeric">Quantity</th>
                  <th className="numeric">Unit amount</th>
                  <th className="numeric">Amount</th>
                </tr>
              </thead>
              <tbody>
                {note.materials.length ? (
                  note.materials.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td className="mono">{item.part_number || "—"}</td>
                      <td className="numeric">{item.quantity}</td>
                      <td className="numeric">
                        {currency(item.unit_amount, organization)}
                      </td>
                      <td className="numeric">
                        {currency(
                          lineAmount(item.quantity, item.unit_amount),
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
                    {currency(note.material_total, organization)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="report-section">
          <div className="report-section-heading">
            <span>04</span>
            <h2>Additional charges</h2>
          </div>
          <div className="report-table-wrap report-table-compact">
            <table className="report-table report-charge-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="numeric">Amount</th>
                </tr>
              </thead>
              <tbody>
                {note.charges.length ? (
                  note.charges.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td className="numeric">
                        {currency(item.amount, organization)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="empty-row">
                      No additional charges
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td>Additional charges total</td>
                  <td className="numeric">
                    {currency(note.additional_charge_total, organization)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
        </>}

        <section className="report-section">
          <div className="report-section-heading">
            <span>{hasBilling ? "05" : "02"}</span>
            <h2>{staffAttested ? "Record photos" : "Service photos"}</h2>
          </div>
          {note.photos.length ? (
            <div className="report-photo-grid">
              {note.photos.map((photo) => (
                <figure key={photo.id} className="report-photo">
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

        {hasBilling && <section className="report-section report-financial-area">
          <div>
            <div className="report-section-heading">
              <span>06</span>
              <h2>Payment information</h2>
            </div>
            <dl className="report-definition-list report-payment-list">
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
                <dd>
                  <Value>{note.payment_method}</Value>
                </dd>
              </div>
              <div>
                <dt>Terms</dt>
                <dd>
                  <Value>{note.payment_terms}</Value>
                </dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd className="mono">
                  <Value>{note.payment_reference}</Value>
                </dd>
              </div>
              <div>
                <dt>Remarks</dt>
                <dd>
                  <Value>{note.payment_remarks}</Value>
                </dd>
              </div>
            </dl>
          </div>
          <div className="report-totals-card">
            <p className="report-section-kicker">Financial summary</p>
            <dl>
              <div>
                <dt>Labor</dt>
                <dd>{currency(note.labor_total, organization)}</dd>
              </div>
              <div>
                <dt>Materials</dt>
                <dd>{currency(note.material_total, organization)}</dd>
              </div>
              <div>
                <dt>Additional charges</dt>
                <dd>{currency(note.additional_charge_total, organization)}</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{currency(note.subtotal, organization)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>− {currency(note.discount_amount, organization)}</dd>
              </div>
              <div>
                <dt>Tax ({Number(note.tax_rate) || 0}%)</dt>
                <dd>{currency(note.tax_amount, organization)}</dd>
              </div>
              <div className="report-grand-total">
                <dt>Total</dt>
                <dd>{currency(note.grand_total, organization)}</dd>
              </div>
            </dl>
          </div>
        </section>}

        <section className="report-section report-acceptance">
          <div className="report-section-heading">
            <span>{hasBilling ? "07" : "03"}</span>
            <h2>{staffAttested ? "Staff attestation" : "Customer acceptance"}</h2>
          </div>
          {staffAttested ? <>
            <p>This internal record was attested by the staff member responsible for the event.</p>
            <p className="report-empty-state">Attested {date(note.staff_attested_at || note.completed_at || note.updated_at, true)}</p>
          </> : <>
          <p>{acceptanceStatement}</p>
          {note.signature ? (
            <div className="report-signature">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={note.signature.image}
                alt={`Signature of ${note.signature.signer_name}`}
              />
              <div>
                <strong>{note.signature.signer_name}</strong>
                <span>
                  {note.signature.signer_position || "Customer representative"}
                </span>
                <small>Signed {date(note.signature.signed_at, true)}</small>
              </div>
            </div>
          ) : (
            <p className="report-empty-state">
              No customer signature recorded.
            </p>
          )}
          </>}
        </section>

        <footer className="report-screen-footer">
          <span>{organization.name}</span>
          <span className="mono">{note.service_number}</span>
          <span>
            Completed {date(note.completed_at || note.updated_at, true)}
          </span>
        </footer>
      </article>
    </div>
  );
}
