import { CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import type { EvidenceReportViewModel } from "@/lib/report-model";
import { formatCurrency } from "@/lib/domain";

function when(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
function Optional({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return value ? (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : ""}>{value}</dd>
    </div>
  ) : null;
}
export function EvidenceReportView({
  model,
}: {
  model: EvidenceReportViewModel;
}) {
  return (
    <article
      className="service-report-screen evidence-report-view"
      aria-label={`Evidence report ${model.number}`}
    >
      <header className="report-brand-header">
        <div className="report-brand">
          <div className="report-brand-mark" aria-hidden="true">
            SL
          </div>
          <div>
            <h2>{model.organization.name}</h2>
            {model.organization.address && <p>{model.organization.address}</p>}
            <p>
              {[model.organization.phone, model.organization.email]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="report-identity">
          <p className="eyebrow">Evidence report</p>
          <strong className="mono">{model.number}</strong>
          <span className="badge badge-success">
            <CheckCircle2 size={12} /> Completed
          </span>
        </div>
      </header>
      <section className="report-meta-strip">
        <div>
          <span>Report created</span>
          <strong>{when(model.createdAt, model.timezone)}</strong>
        </div>
        <div>
          <span>Submitted</span>
          <strong>
            {model.completedAt ? when(model.completedAt, model.timezone) : "—"}
          </strong>
        </div>
        <div>
          <span>Person in charge</span>
          <strong>{model.employee.name}</strong>
        </div>
        <div>
          <span>Employee ID</span>
          <strong>{model.employee.employeeId}</strong>
        </div>
      </section>
      <section className="report-two-column">
        <div className="report-block">
          <p className="report-section-kicker">Customer</p>
          <h2>{model.customer.name}</h2>
          <dl className="report-definition-list">
            <Optional
              label="Contact number"
              value={model.customer.contactNumber}
            />
            <Optional
              label="Contact person"
              value={model.customer.contactPerson}
            />
            <Optional label="Email" value={model.customer.email} />
            <Optional label="Address" value={model.customer.address} />
          </dl>
        </div>
        <div className="report-block">
          <p className="report-section-kicker">References</p>
          <dl className="report-definition-list">
            <Optional
              label="Invoice number"
              value={model.references.invoiceNumber}
              mono
            />
            <Optional
              label="Delivery number"
              value={model.references.deliveryNumber}
              mono
            />
            <Optional
              label="Item identifier"
              value={model.item.identifier}
              mono
            />
            {!model.references.invoiceNumber &&
              !model.references.deliveryNumber &&
              !model.item.identifier && (
                <p className="report-empty-state">No references recorded.</p>
              )}
          </dl>
        </div>
      </section>
      <section className="report-block evidence-item-block">
        <p className="report-section-kicker">Item or homogeneous lot</p>
        <h2>{model.item.description}</h2>
        <dl className="report-definition-list report-inline-details">
          <Optional label="Quantity" value={model.item.quantity} />
          <Optional label="Brand / manufacturer" value={model.item.brand} />
          <Optional label="Model" value={model.item.model} />
          {model.item.totalValue && (
            <Optional
              label="Declared total value"
              value={formatCurrency(model.item.totalValue, model.item.currency)}
            />
          )}
        </dl>
      </section>
      <section className="report-two-column">
        <div className="report-block">
          <p className="report-section-kicker">
            <MapPin size={14} /> Storage location
          </p>
          <h2>{model.location}</h2>
        </div>
        <div className="report-block">
          <p className="report-section-kicker">Recorded condition</p>
          <h2>{model.condition.label}</h2>
          {model.condition.remarks && (
            <p className="report-condition-remarks">
              {model.condition.remarks}
            </p>
          )}
        </div>
      </section>
      <section className="report-block">
        <p className="report-section-kicker">Photo evidence</p>
        <div className="detail-photo-grid">
          {model.photos.map((photo, index) => (
            <figure key={photo.id}>
              <img
                src={photo.url}
                alt={photo.caption || `Evidence photo ${index + 1}`}
              />
              <figcaption>
                <strong>
                  {photo.caption || `Evidence photo ${index + 1}`}
                </strong>
                <small>
                  Uploaded {when(photo.created_at, model.timezone)}
                  {photo.uploaded_by_name_snapshot
                    ? ` · ${photo.uploaded_by_name_snapshot}`
                    : ""}
                </small>
                {photo.gps_latitude != null && photo.gps_longitude != null && (
                  <small>
                    GPS context: {photo.gps_latitude.toFixed(6)},{" "}
                    {photo.gps_longitude.toFixed(6)}
                    {photo.gps_accuracy
                      ? ` (±${Math.round(photo.gps_accuracy)} m)`
                      : ""}
                  </small>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      {model.notes && (
        <section className="report-block">
          <p className="report-section-kicker">Additional notes</p>
          <p className="report-condition-remarks">{model.notes}</p>
        </section>
      )}
      {model.acknowledgement && (
        <section className="report-block">
          <p className="report-section-kicker">Customer acknowledgement</p>
          <p>{model.acknowledgement.statement}</p>
          <div className="detail-signature">
            <img
              src={model.acknowledgement.image}
              alt={`Signature of ${model.acknowledgement.signerName}`}
            />
            <strong>{model.acknowledgement.signerName}</strong>
            <small>
              {when(model.acknowledgement.signedAt, model.timezone)}
            </small>
          </div>
        </section>
      )}
      <footer className="report-integrity-note">
        <ShieldCheck />
        <p>
          This report records the item’s documented condition and storage
          context at submission. Original evidence files are retained separately
          from the display copies.
        </p>
      </footer>
    </article>
  );
}
