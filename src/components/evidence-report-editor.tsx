"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  FileUp,
  Image as ImageIcon,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type {
  Customer,
  EvidencePhotoUploadMetadata,
  Organization,
  Photo,
  ServiceNote,
} from "@/lib/types";
import {
  completionReadiness,
  conditionLabels,
  customerSnapshot,
  evidenceAcknowledgementStatement,
} from "@/lib/domain";
import { SignaturePad } from "./signature-pad";
import "./evidence-report.css";

type Props = {
  note: ServiceNote;
  customers: Customer[];
  organization: Organization;
  field?: boolean;
  onSave: (note: ServiceNote) => Promise<ServiceNote>;
  onComplete: (note: ServiceNote) => Promise<ServiceNote>;
  onCreateCustomer: (
    customer: Omit<Customer, "id" | "organization_id" | "created_at"> & {
      id?: string;
    },
  ) => Promise<Customer>;
  onUploadPhoto: (
    reportId: string,
    file: File,
    metadata: EvidencePhotoUploadMetadata,
  ) => Promise<Photo>;
  onDeletePhoto: (reportId: string, photoId: string) => Promise<void>;
  onDone: (note: ServiceNote) => void;
};

export default function EvidenceReportEditor({
  note,
  customers,
  organization,
  onSave,
  onComplete,
  onCreateCustomer,
  onUploadPhoto,
  onDeletePhoto,
  onDone,
}: Props) {
  const [draft, setDraft] = useState(note);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">(
    "saved",
  );
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [acknowledgement, setAcknowledgement] = useState(
    Boolean(
      note.acknowledgement_enabled || note.signature || note.signer_name_draft,
    ),
  );
  const [gps, setGps] = useState<
    Pick<
      EvidencePhotoUploadMetadata,
      "gps_latitude" | "gps_longitude" | "gps_accuracy" | "gps_device_timestamp"
    >
  >({});
  const [gpsAttempted, setGpsAttempted] = useState(false);
  const [quickCreate, setQuickCreate] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    contact_number: "",
    contact_name: "",
  });
  const current = useRef(draft);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    current.current = draft;
  }, [draft]);

  function patch(values: Partial<ServiceNote>) {
    setDraft((value) => ({ ...value, ...values }));
    setSaveState("dirty");
    setError("");
  }

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const saved = await onSave(current.current);
        setDraft(saved);
        setSaveState("saved");
      } catch (cause) {
        setSaveState("dirty");
        setError(
          cause instanceof Error
            ? cause.message
            : "The draft could not be saved.",
        );
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [saveState, onSave]);

  async function saveNow() {
    setSaveState("saving");
    setError("");
    try {
      const saved = await onSave(current.current);
      setDraft(saved);
      setSaveState("saved");
    } catch (cause) {
      setSaveState("dirty");
      setError(
        cause instanceof Error
          ? cause.message
          : "The draft could not be saved.",
      );
    }
  }

  function selectCustomer(id: string) {
    const customer = customers.find((value) => value.id === id);
    if (!customer) {
      patch({
        customer_id: "",
        customer_name_snapshot: "",
        contact_number_snapshot: "",
      });
      return;
    }
    patch(customerSnapshot(customer));
  }
  async function createCustomer() {
    if (!newCustomer.name.trim() || !newCustomer.contact_number.trim()) {
      setError("Customer name and contact number are required.");
      return;
    }
    try {
      const saved = await onCreateCustomer({
        name: newCustomer.name.trim(),
        contact_number: newCustomer.contact_number.trim(),
        contact_name: newCustomer.contact_name.trim(),
        contact_position: "",
        mobile: newCustomer.contact_number.trim(),
        office: "",
        email: "",
        address: "",
        notes: "",
      });
      patch(customerSnapshot(saved));
      setQuickCreate(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The customer could not be created.",
      );
    }
  }

  function requestGps() {
    if (gpsAttempted || !navigator.geolocation) return;
    setGpsAttempted(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) =>
        setGps({
          gps_latitude: coords.latitude,
          gps_longitude: coords.longitude,
          gps_accuracy: coords.accuracy,
          gps_device_timestamp: new Date(timestamp).toISOString(),
        }),
      () => {},
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
    );
  }

  async function receivePhoto(
    file: File | undefined,
    source: EvidencePhotoUploadMetadata["source"],
  ) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const photo = await onUploadPhoto(draft.id, file, { source, ...gps });
      patch({ photos: [...current.current.photos, photo] });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The photo could not be stored.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(photo: Photo) {
    try {
      await onDeletePhoto(draft.id, photo.id);
      patch({
        photos: current.current.photos.filter((value) => value.id !== photo.id),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The photo could not be removed.",
      );
    }
  }

  async function submit() {
    const readiness = completionReadiness(draft);
    if (!readiness.ready) {
      setValidation(readiness.errors);
      document
        .getElementById(`report-section-${readiness.firstIncomplete?.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setValidation([]);
    setError("");
    try {
      const completed = await onComplete(draft);
      setDraft(completed);
      onDone(completed);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The report could not be submitted.",
      );
    }
  }

  const input = (key: keyof ServiceNote) => ({
    value: String(draft[key] ?? ""),
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => patch({ [key]: event.target.value }),
  });

  return (
    <div className="evidence-editor">
      <header className="page-header evidence-editor-header">
        <div>
          <p className="eyebrow">
            Evidence report ·{" "}
            <span className="mono">{draft.service_number}</span>
          </p>
          <h1 className="page-title">Create report</h1>
          <p className="page-subtitle">
            Record what was received, where it was stored, and its visible
            condition.
          </p>
        </div>
        <div className="evidence-editor-actions">
          <span role="status" className="save-status">
            {saveState === "saved"
              ? "All changes saved"
              : saveState === "saving"
                ? "Saving…"
                : "Unsaved changes"}
          </span>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void saveNow()}
          >
            <Save /> Save draft
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void submit()}
          >
            <Check /> Submit report
          </button>
        </div>
      </header>
      {(error || validation.length > 0) && (
        <div className="error-message" role="alert">
          <div>
            {error || (
              <>
                <strong>Complete these fields before submitting:</strong>
                <ul>
                  {validation.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
      <div className="evidence-form">
        <section id="report-section-customer" className="editor-card">
          <div className="editor-card-heading">
            <span>1</span>
            <div>
              <h2>Customer</h2>
              <p>Who owns or supplied the item.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field field-wide">
              Customer / company name{" "}
              <select
                className="select"
                aria-label="Customer / company name"
                value={draft.customer_id}
                onChange={(e) => selectCustomer(e.target.value)}
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-wide">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setQuickCreate(!quickCreate)}
              >
                + Quick-create customer
              </button>
            </div>
            {quickCreate && (
              <div className="quick-customer field-wide">
                <label className="field">
                  Company name{" "}
                  <input
                    className="input"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, name: e.target.value })
                    }
                  />
                </label>
                <label className="field">
                  Contact number{" "}
                  <input
                    className="input"
                    type="tel"
                    value={newCustomer.contact_number}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        contact_number: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="field">
                  Contact person{" "}
                  <input
                    className="input"
                    value={newCustomer.contact_name}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        contact_name: e.target.value,
                      })
                    }
                  />
                </label>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => void createCustomer()}
                >
                  Save customer
                </button>
              </div>
            )}
            <label className="field">
              Contact number{" "}
              <input
                className="input"
                type="tel"
                {...input("contact_number_snapshot")}
              />
            </label>
            <label className="field">
              Contact person{" "}
              <input className="input" {...input("contact_name_snapshot")} />
            </label>
            <label className="field">
              Customer email{" "}
              <input
                className="input"
                type="email"
                {...input("contact_email_snapshot")}
              />
            </label>
            <label className="field field-wide">
              Customer address{" "}
              <textarea
                className="textarea"
                rows={2}
                {...input("customer_address_snapshot")}
              />
            </label>
          </div>
        </section>
        <section className="editor-card">
          <div className="editor-card-heading">
            <span>2</span>
            <div>
              <h2>References</h2>
              <p>Optional documents used to find this report later.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              Invoice number{" "}
              <input className="input" {...input("invoice_number")} />
            </label>
            <label className="field">
              Delivery number{" "}
              <input className="input" {...input("delivery_number")} />
            </label>
          </div>
        </section>
        <section id="report-section-item" className="editor-card">
          <div className="editor-card-heading">
            <span>3</span>
            <div>
              <h2>Item</h2>
              <p>One item or one homogeneous lot per report.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field field-wide">
              Item description{" "}
              <input className="input" {...input("item_name_snapshot")} />
            </label>
            <label className="field">
              Quantity{" "}
              <input
                className="input"
                inputMode="decimal"
                {...input("quantity")}
              />
            </label>
            <label className="field">
              Item identifier / reference{" "}
              <input className="input" {...input("item_reference_snapshot")} />
            </label>
            <label className="field">
              Brand / manufacturer{" "}
              <input className="input" {...input("brand")} />
            </label>
            <label className="field">
              Model <input className="input" {...input("model")} />
            </label>
            <label className="field">
              Total declared value{" "}
              <input
                className="input"
                inputMode="decimal"
                {...input("declared_total_value")}
                onChange={(e) =>
                  patch({
                    declared_total_value: e.target.value,
                    declared_currency:
                      e.target.value && !draft.declared_currency
                        ? organization.currency
                        : draft.declared_currency,
                  })
                }
              />
            </label>
            {draft.declared_total_value && (
              <label className="field">
                Currency{" "}
                <input
                  className="input"
                  maxLength={3}
                  {...input("declared_currency")}
                  onChange={(e) =>
                    patch({ declared_currency: e.target.value.toUpperCase() })
                  }
                />
              </label>
            )}
          </div>
        </section>
        <section id="report-section-condition" className="editor-card">
          <div className="editor-card-heading">
            <span>4</span>
            <div>
              <h2>Location &amp; condition</h2>
              <p>Describe the item as it enters storage.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field field-wide">
              Location{" "}
              <input
                className="input"
                placeholder="Warehouse, bay, rack or holding area"
                {...input("location_snapshot")}
              />
            </label>
            <label className="field field-wide">
              Condition{" "}
              <select className="select" {...input("condition_code")}>
                <option value="">Select condition</option>
                {Object.entries(conditionLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {draft.condition_code !== "NO_VISIBLE_ISSUE" && (
              <label className="field field-wide">
                Condition remarks{" "}
                <textarea
                  className="textarea"
                  rows={3}
                  {...input("condition_remarks")}
                />
              </label>
            )}
          </div>
        </section>
        <section id="report-section-photos" className="editor-card">
          <div className="editor-card-heading">
            <span>5</span>
            <div>
              <h2>Evidence photos</h2>
              <p>
                At least one successfully stored original is required. GPS adds
                context when available.
              </p>
            </div>
          </div>
          <input
            ref={cameraInput}
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) =>
              void receivePhoto(e.target.files?.[0], "CAMERA_CAPTURE")
            }
          />
          <input
            ref={uploadInput}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(e) =>
              void receivePhoto(e.target.files?.[0], "FILE_UPLOAD")
            }
          />
          <div className="photo-actions">
            <button
              className="btn btn-primary"
              type="button"
              disabled={uploading}
              onClick={() => {
                requestGps();
                cameraInput.current?.click();
              }}
            >
              <Camera /> {uploading ? "Storing photo…" : "Take photo"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={uploading}
              onClick={() => uploadInput.current?.click()}
            >
              <FileUp /> Upload existing photo
            </button>
          </div>
          {draft.photos.length ? (
            <div className="evidence-photo-grid">
              {draft.photos.map((photo) => (
                <figure key={photo.id}>
                  <img
                    src={photo.url}
                    alt={photo.caption || photo.name || "Evidence photo"}
                  />
                  <figcaption>
                    <input
                      className="input"
                      aria-label={`Caption for ${photo.name}`}
                      placeholder="Optional caption"
                      value={photo.caption}
                      onChange={(e) =>
                        patch({
                          photos: current.current.photos.map((value) =>
                            value.id === photo.id
                              ? { ...value, caption: e.target.value }
                              : value,
                          ),
                        })
                      }
                    />
                    <small>
                      {photo.uploaded_by_name_snapshot} ·{" "}
                      {new Date(photo.created_at).toLocaleString("en-MY")}
                    </small>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => void removePhoto(photo)}
                    >
                      <Trash2 /> Remove
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="photo-empty">
              <ImageIcon />
              <p>No evidence photos stored yet.</p>
            </div>
          )}
        </section>
        <section className="editor-card">
          <div className="editor-card-heading">
            <span>6</span>
            <div>
              <h2>Notes</h2>
              <p>Optional context that is not captured above.</p>
            </div>
          </div>
          <label className="field">
            Additional notes{" "}
            <textarea
              className="textarea"
              rows={4}
              {...input("additional_notes")}
            />
          </label>
        </section>
        <section id="report-section-acceptance" className="editor-card">
          <div className="editor-card-heading">
            <span>7</span>
            <div>
              <h2>Optional acknowledgement</h2>
              <p>
                A customer representative does not need to be present to submit
                the report.
              </p>
            </div>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              aria-label="Add customer acknowledgement"
              checked={acknowledgement}
              onChange={(e) => {
                setAcknowledgement(e.target.checked);
                patch({
                  acknowledgement_enabled: e.target.checked,
                  ...(!e.target.checked
                    ? { signer_name_draft: "", signature: null }
                    : {}),
                });
              }}
            />
            <span>Add customer acknowledgement</span>
          </label>
          {acknowledgement && (
            <div className="acknowledgement-panel">
              <p>{evidenceAcknowledgementStatement}</p>
              <label className="field">
                Signer name{" "}
                <input
                  className="input"
                  value={
                    draft.signer_name_draft ||
                    draft.signature?.signer_name ||
                    ""
                  }
                  onChange={(e) =>
                    patch({
                      signer_name_draft: e.target.value,
                      signature: null,
                    })
                  }
                />
              </label>
              <SignaturePad
                value={draft.signature?.image || null}
                onClear={() => patch({ signature: null })}
                onConfirm={(image) =>
                  patch({
                    signature: {
                      image,
                      signer_name:
                        current.current.signer_name_draft?.trim() || "",
                      signer_position: "",
                      signed_at: "",
                    },
                  })
                }
              />
            </div>
          )}
        </section>
        <section className="editor-card review-card">
          <div className="editor-card-heading">
            <span>8</span>
            <div>
              <h2>Review &amp; submit</h2>
              <p>
                The final report uses the server receipt time and becomes
                read-only.
              </p>
            </div>
          </div>
          <div className="review-summary">
            <ShieldCheck />
            <p>
              <strong>
                {draft.item_name_snapshot || "Item description pending"}
              </strong>
              <br />
              {draft.customer_name_snapshot || "Customer pending"} ·{" "}
              {draft.location_snapshot || "Location pending"}
              <br />
              {draft.photos.length} evidence photo
              {draft.photos.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            className="btn btn-primary submit-report"
            type="button"
            onClick={() => void submit()}
          >
            <Check /> Submit report
          </button>
        </section>
      </div>
    </div>
  );
}
