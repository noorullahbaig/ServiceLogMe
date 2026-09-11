"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Camera,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
  Pencil,
  UserRound,
  FileText,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import {
  acceptanceStatement,
  calculateTotals,
  completionErrors,
  completionReadiness,
  customerSnapshot,
  formatCurrency,
} from "@/lib/domain";
import type {
  ServiceNote,
  Customer,
  Profile,
  Labor,
  Material,
  Charge,
  Photo,
  PhotoCategory,
  TrackedItem,
} from "@/lib/types";
import { paymentMethods, paymentTerms } from "@/lib/types";
import { SignaturePad } from "./signature-pad";
import "./editor.css";

type NewCustomer = Omit<Customer, "id" | "organization_id" | "created_at">;
type Props = {
  note: ServiceNote;
  customers: Customer[];
  employees: Profile[];
  trackedItems?: TrackedItem[];
  field?: boolean;
  onSave: (note: ServiceNote) => Promise<ServiceNote>;
  onComplete: (note: ServiceNote) => Promise<ServiceNote>;
  onCreateCustomer: (customer: NewCustomer) => Promise<Customer>;
  onCreateTrackedItem: (item: Omit<TrackedItem, "id" | "organization_id" | "created_at" | "updated_at">) => Promise<TrackedItem>;
  onDone: (note: ServiceNote) => void;
};
type ItemDialog =
  | { kind: "labor"; value: Labor }
  | { kind: "material"; value: Material }
  | { kind: "charge"; value: Charge };
type Upload = { id: string; file: File; error: string; busy: boolean };
const money = (value: string) => formatCurrency(value);
const steps = [
  "Details",
  "Customer",
  "Service",
  "Labor & materials",
  "Photos",
  "Payment",
  "Review",
];
const emptyCustomer: NewCustomer = {
  name: "",
  contact_name: "",
  contact_position: "",
  mobile: "",
  office: "",
  email: "",
  address: "",
  notes: "",
};
const photoCategories: PhotoCategory[] = [
  "BEFORE",
  "SERVICE",
  "MATERIAL",
  "AFTER",
  "OTHER",
];

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span className="required-mark"> *</span>}
      </span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => returnFocus.current?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="editor-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="editor-dialog-inner">
        <header>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export default function NoteEditor({
  note,
  customers,
  employees,
  trackedItems = [],
  field = false,
  onSave,
  onComplete,
  onCreateCustomer,
  onCreateTrackedItem,
  onDone,
}: Props) {
  const [draft, setDraft] = useState(note);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<string[]>([]);
  const [signatureNotice, setSignatureNotice] = useState(false);
  const [signer, setSigner] = useState(
    note.signature?.signer_name || note.signer_name_draft || "",
  );
  const [position, setPosition] = useState(
    note.signature?.signer_position || note.signer_position_draft || "",
  );
  const [itemDialog, setItemDialog] = useState<ItemDialog | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [customerDialog, setCustomerDialog] = useState(false);
  const [itemBusy, setItemBusy] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>(emptyCustomer);
  const [customerBusy, setCustomerBusy] = useState(false);
  const [extraCustomers, setExtraCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const alertRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(note);
  const changeVersion = useRef(0);
  const savedVersion = useRef(0);
  const flushPromise = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    if (error || validation.length)
      alertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error, validation]);
  const photoInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const editorTop = useRef<HTMLDivElement>(null);
  const allCustomers = useMemo(
    () => [
      ...customers,
      ...extraCustomers.filter(
        (c) => !customers.some((existing) => existing.id === c.id),
      ),
    ],
    [customers, extraCustomers],
  );
  const calculated = useMemo(() => {
    try {
      return { totals: calculateTotals(draft), error: "" };
    } catch (e) {
      return {
        totals: null,
        error:
          e instanceof Error
            ? e.message
            : "Check amounts, quantities, discount and tax.",
      };
    }
  }, [draft]);
  const total = calculated.totals;
  function patch(
    changes:
      Partial<ServiceNote> | ((current: ServiceNote) => Partial<ServiceNote>),
    keepSignature = false,
  ) {
    setDraft((current) => {
      const next = typeof changes === "function" ? changes(current) : changes;
      if (current.signature && !keepSignature) setSignatureNotice(true);
      const updated = {
        ...current,
        ...next,
        ...(!keepSignature ? { signature: null } : {}),
      };
      draftRef.current = updated;
      return updated;
    });
    changeVersion.current += 1;
    setSaveState("Unsaved changes");
    setError("");
    setValidation([]);
  }
  function input(key: keyof ServiceNote, placeholder?: string, type = "text") {
    return (
      <input
        id={String(key)}
        className="input"
        type={type}
        value={String(draft[key] ?? "")}
        placeholder={placeholder}
        onChange={(event) => patch({ [key]: event.target.value })}
      />
    );
  }
  function textarea(key: keyof ServiceNote, placeholder: string, rows = 3) {
    return (
      <textarea
        id={String(key)}
        className="textarea"
        rows={rows}
        value={String(draft[key] ?? "")}
        placeholder={placeholder}
        onChange={(event) => patch({ [key]: event.target.value })}
      />
    );
  }
  const flushDraft = useCallback(async () => {
    if (flushPromise.current) return flushPromise.current;
    flushPromise.current = (async () => {
      try {
        while (savedVersion.current < changeVersion.current) {
          const version = changeVersion.current,
            current = draftRef.current;
          let totals;
          try {
            totals = calculateTotals(current);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Check the financial values.",
            );
            setSaveState("Save failed");
            return false;
          }
          setSaveState("Saving…");
          const result = await onSave({ ...current, ...totals });
          savedVersion.current = version;
          setDraft((latest) => {
            const next =
              changeVersion.current === version
                ? result
                : {
                    ...latest,
                    revision: result.revision,
                    updated_at: result.updated_at,
                  };
            draftRef.current = next;
            return next;
          });
        }
        setSaveState("All changes saved");
        setError("");
        return true;
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Your changes could not be saved. Please try again.",
        );
        setSaveState("Save failed");
        return false;
      } finally {
        flushPromise.current = null;
      }
    })();
    return flushPromise.current;
  }, [onSave]);
  useEffect(() => {
    if (saveState !== "Unsaved changes") return;
    const timer = window.setTimeout(() => {
      void flushDraft();
    }, 750);
    return () => window.clearTimeout(timer);
  }, [draft, saveState, flushDraft]);
  useEffect(() => {
    const dirty = () =>
      savedVersion.current < changeVersion.current ||
      saveState === "Save failed";
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        !dirty() ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = (event.target as Element | null)?.closest(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        !target ||
        target.target === "_blank" ||
        target.origin !== window.location.origin
      )
        return;
      event.preventDefault();
      void flushDraft().then((saved) => {
        if (saved) window.location.assign(target.href);
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [flushDraft, saveState]);
  const readiness = useMemo(
    () => completionReadiness({ ...draft, ...(total || {}) }),
    [draft, total],
  );
  const customerAcknowledgement = draft.finalization_type !== "STAFF_ATTESTED";
  async function save(complete = false) {
    setError("");
    if (calculated.error) {
      setError(calculated.error);
      return;
    }
    if (uploads.some((u) => u.busy || u.error)) {
      setError("Finish adding photos or remove failed photos before saving.");
      return;
    }
    if (!complete) {
      await flushDraft();
      return;
    }
    const flushed = await flushDraft();
    if (!flushed) return;
    const current = {
      ...draftRef.current,
      ...calculateTotals(draftRef.current),
    };
    const errors = completionErrors(current);
    if (errors.length) {
      setValidation(errors);
      const first = completionReadiness(current).firstIncomplete;
      window.setTimeout(
        () => document.getElementById(first?.fieldId || "")?.focus(),
        0,
      );
      return;
    }
    setBusy(true);
    try {
      const result = await onComplete(current);
      draftRef.current = result;
      setDraft(result);
      setSaveState("All changes saved");
      onDone(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Your changes could not be saved. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function moveStep(next: number) {
    if (next === 6) {
      const first = readiness.requirements.find(
        (item) => item.id !== "acceptance" && !item.complete,
      );
      if (first) {
        setValidation(first.errors);
        setStep(first.step);
        window.setTimeout(
          () => document.getElementById(first.fieldId)?.focus(),
          0,
        );
        return;
      }
    }
    setStep(next);
    editorTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  useEffect(() => {
    if (field && step === 6) {
      document.body.classList.add("customer-signing");
      return () => document.body.classList.remove("customer-signing");
    }
  }, [field, step]);
  const completion = readiness.requirements.map((item) => ({
    name: item.label,
    ok: item.complete,
    fieldId: item.fieldId,
  }));
  const hasBilling = draft.billing_enabled !== false;
  const fieldSteps = hasBilling ? steps : steps.filter((_, index) => index !== 5);
  const visibleStepNumber = fieldSteps.indexOf(steps[step]) + 1;
  const previousFieldStep = !hasBilling && step === 6 ? 4 : step - 1;
  const nextFieldStep = !hasBilling && step === 4 ? 6 : step + 1;
  function openItem(
    kind: ItemDialog["kind"],
    existing?: Labor | Material | Charge,
  ) {
    setDialogError("");
    if (kind === "labor")
      setItemDialog({
        kind,
        value: (existing as Labor) || {
          id: crypto.randomUUID(),
          name: "",
          classification: "",
          hours: "",
          rate: "",
          notes: "",
        },
      });
    if (kind === "material")
      setItemDialog({
        kind,
        value: (existing as Material) || {
          id: crypto.randomUUID(),
          description: "",
          part_number: "",
          quantity: "1",
          unit_amount: "",
        },
      });
    if (kind === "charge")
      setItemDialog({
        kind,
        value: (existing as Charge) || {
          id: crypto.randomUUID(),
          description: "",
          amount: "",
        },
      });
  }
  function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!itemDialog) return;
    const normalized =
      itemDialog.kind === "labor"
        ? { ...itemDialog.value, name: itemDialog.value.name.trim() }
        : itemDialog.kind === "material"
          ? {
              ...itemDialog.value,
              description: itemDialog.value.description.trim(),
              unit_amount: itemDialog.value.unit_amount || "0",
            }
          : {
              ...itemDialog.value,
              description: itemDialog.value.description.trim(),
            };
    if (
      ("name" in normalized && !normalized.name) ||
      ("description" in normalized && !normalized.description)
    ) {
      setDialogError(
        "Enter a " +
          (itemDialog.kind === "labor" ? "worker name." : "description."),
      );
      return;
    }
    const key =
      itemDialog.kind === "labor"
        ? "labor"
        : itemDialog.kind === "material"
          ? "materials"
          : "charges";
    const rows = [...draft[key]] as (Labor | Material | Charge)[];
    const index = rows.findIndex((row) => row.id === normalized.id);
    if (index < 0) rows.push(normalized);
    else rows[index] = normalized;
    const next = { ...draft, [key]: rows };
    try {
      calculateTotals(next);
      patch({ [key]: rows });
      setItemDialog(null);
    } catch (e) {
      setDialogError(
        e instanceof Error ? e.message : "Check the amounts entered.",
      );
    }
  }
  async function createCustomer(event: React.FormEvent) {
    event.preventDefault();
    setCustomerBusy(true);
    setDialogError("");
    try {
      const result = await onCreateCustomer({
        ...newCustomer,
        name: newCustomer.name.trim(),
      });
      setExtraCustomers((current) => [...current, result]);
      patch({ ...customerSnapshot(result), customer_id: result.id });
      setCustomerDialog(false);
      setNewCustomer(emptyCustomer);
    } catch (e) {
      setDialogError(
        e instanceof Error
          ? e.message
          : "Customer could not be saved. Please try again.",
      );
    } finally {
      setCustomerBusy(false);
    }
  }
  async function saveTrackedItem() {
    const name = draft.item_name_snapshot?.trim() || "";
    const reference = draft.item_reference_snapshot?.trim() || "";
    if (!name || !reference) {
      setError("Enter an item name and reference before saving it for later.");
      return;
    }
    setItemBusy(true);
    try {
      const item = await onCreateTrackedItem({
        name,
        reference,
        customer_id: draft.customer_id || undefined,
      });
      patch({
        tracked_item_id: item.id,
        item_name_snapshot: item.name,
        item_reference_snapshot: item.reference,
      });
      setSaveState("Item saved for future records");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The item could not be saved.");
    } finally {
      setItemBusy(false);
    }
  }
  async function processUpload(upload: Upload) {
    setUploads((current) =>
      current.map((u) =>
        u.id === upload.id ? { ...u, busy: true, error: "" } : u,
      ),
    );
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(upload.file.type))
        throw new Error("Choose a JPEG, PNG or WebP image.");
      if (upload.file.size > 30 * 1024 * 1024)
        throw new Error(
          "This image is too large. Choose one smaller than 30 MB.",
        );
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("The image could not be read. Try again."));
        reader.readAsDataURL(upload.file);
      });
      const url = await new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const factor = Math.min(1, 1600 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * factor);
          canvas.height = Math.round(image.height * factor);
          const ctx = canvas.getContext("2d");
          if (!ctx)
            return reject(
              new Error(
                "This image could not be prepared. Choose another file.",
              ),
            );
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          let quality = 0.82;
          let compressed = canvas.toDataURL("image/jpeg", quality);
          while (compressed.length > 470_000 && quality > 0.45) {
            quality -= 0.08;
            compressed = canvas.toDataURL("image/jpeg", quality);
          }
          if (compressed.length > 470_000)
            return reject(new Error("This image is too large after compression."));
          resolve(compressed);
        };
        image.onerror = () =>
          reject(
            new Error("This image could not be opened. Choose another file."),
          );
        image.src = data;
      });
      const photo: Photo = {
        id: upload.id,
        url,
        category: "SERVICE",
        caption: "",
        created_at: new Date(
          upload.file.lastModified || Date.now(),
        ).toISOString(),
        name: upload.file.name,
      };
      patch((current) => ({ photos: [...current.photos, photo] }));
      setUploads((current) => current.filter((u) => u.id !== upload.id));
    } catch (e) {
      setUploads((current) =>
        current.map((u) =>
          u.id === upload.id
            ? {
                ...u,
                busy: false,
                error: e instanceof Error ? e.message : "Could not add photo.",
              }
            : u,
        ),
      );
    }
  }
  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      busy: true,
      error: "",
    }));
    setUploads((current) => [...current, ...next]);
    next.forEach((upload) => void processUpload(upload));
  }
  function section(
    index: number,
    title: string,
    subtitle: string,
    body: ReactNode,
    action?: ReactNode,
  ) {
    if (field && step !== index) return null;
    const sectionId = `note-section-${title
      .toLowerCase()
      .replace(/[^a-z]+/g, "-")
      .replace(/(^-|-$)/g, "")}`;
    return (
      <section className="editor-section" id={sectionId}>
        <div className="editor-section-heading">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          {action}
        </div>
        {body}
      </section>
    );
  }
  function totalsBlock() {
    return (
      <div className="editor-totals">
        <div>
          <span>Labor</span>
          <span>{money(total?.labor_total || draft.labor_total)}</span>
        </div>
        <div>
          <span>Materials</span>
          <span>{money(total?.material_total || draft.material_total)}</span>
        </div>
        <div>
          <span>Additional charges</span>
          <span>
            {money(
              total?.additional_charge_total || draft.additional_charge_total,
            )}
          </span>
        </div>
        <div className="totals-subtotal">
          <span>Subtotal</span>
          <span>{money(total?.subtotal || draft.subtotal)}</span>
        </div>
        <div>
          <span>Discount</span>
          <span>− {money(draft.discount_amount || "0")}</span>
        </div>
        <div>
          <span>Tax ({draft.tax_rate || "0"}%)</span>
          <span>{money(total?.tax_amount || draft.tax_amount)}</span>
        </div>
        <div className="totals-grand">
          <span>Grand total</span>
          <strong>{money(total?.grand_total || draft.grand_total)}</strong>
        </div>
      </div>
    );
  }
  const itemValue = itemDialog?.value;
  const setItem = (changes: object) =>
    setItemDialog((current) =>
      current
        ? ({
            ...current,
            value: { ...current.value, ...changes },
          } as ItemDialog)
        : null,
    );
  return (
    <div
      ref={editorTop}
      className={`note-editor ${field ? "field-note-editor" : ""} ${field && step === 6 ? "acceptance-mode" : ""}`}
    >
      {!(field && step === 6) && (
        <>
          <div className="editor-breadcrumb">
            <Link href={field ? "/field" : "/service-notes"}>
              {field ? "My service notes" : "Service Notes"}
            </Link>
            <ChevronRight size={13} />
            <span>{draft.service_number}</span>
          </div>
          <header className="editor-page-header">
            <div>
              <div className="editor-heading-line">
                <h1>
                  {note.job_title ? "Edit Service Note" : "New Service Note"}
                </h1>
                <span className="badge badge-draft">Draft</span>
              </div>
              <p className="muted">
                {field
                  ? "Capture a clear, complete record for the item."
                  : "Capture the work. Keep every detail in one place."}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Save size={16} />
              )}
              Save draft
            </button>
          </header>
        </>
      )}
      {field && step !== 6 && (
        <div className="field-step-header">
          <div className="field-step-meta">
            <span className="field-step-counter">
              Step {visibleStepNumber} of {fieldSteps.length}
            </span>
            <strong className="field-step-title">{steps[step]}</strong>
          </div>
          <div
            className="field-step-track"
            role="tablist"
            aria-label="Workflow progress"
          >
            {fieldSteps.map((name) => {
              const index = steps.indexOf(name);
              const isCurrent = index === step;
              const isDone = index < step;
              return (
                <button
                  type="button"
                  key={name}
                  className={`field-step-btn ${
                    isCurrent ? "current" : isDone ? "done" : ""
                  }`}
                  aria-label={`Go to ${name}`}
                  title={name}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => moveStep(index)}
                >
                  <span className="field-step-bar" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {field && step === 6 && (
        <div className="acceptance-header">
          <span className="acceptance-brand">
            <FileText size={23} />
            ServiceLOGME
          </span>
          <h1>{customerAcknowledgement ? "Customer acceptance" : "Staff attestation"}</h1>
          <p>
            {customerAcknowledgement
              ? "Review the completed service details, then sign to confirm the record."
              : "Review the completed internal record, then attest that the captured evidence is accurate."}
          </p>
        </div>
      )}
      <div className="editor-layout">
        <fieldset className="editor-workspace" disabled={busy}>
          {section(
            0,
            "Service information",
            "The essentials for this service visit.",
            <>
              <div className="editor-form-grid">
                <Field label="Record type" required>
                  <select
                    id="record_type"
                    className="select"
                    value={draft.record_type || "SERVICE"}
                    onChange={(event) =>
                      patch({
                        record_type: event.target.value as ServiceNote["record_type"],
                        billing_enabled: event.target.value === "SERVICE",
                        finalization_type:
                          event.target.value === "SERVICE" || event.target.value === "HANDOVER"
                            ? "CUSTOMER_ACKNOWLEDGED"
                            : "STAFF_ATTESTED",
                      })
                    }
                  >
                    <option value="RECEIPT">Receipt / storage</option>
                    <option value="INSPECTION">Inspection</option>
                    <option value="SERVICE">Service / repair</option>
                    <option value="HANDOVER">Handover</option>
                  </select>
                </Field>
                <Field label="Record title" required>
                  {input("job_title", "e.g. Engine intake condition record")}
                </Field>
                <div className="editor-form-grid">
                  <Field label="Service date" required>
                    {input("service_date", undefined, "date")}
                  </Field>
                  <Field label="Time" required>
                  {input("service_time", undefined, "time")}
                  </Field>
                </div>
              </div>
              <div className="item-context">
                <div className="editor-section-heading compact-heading">
                  <div>
                    <h2>Item</h2>
                    <p>Use a stable reference so its history can be found later.</p>
                  </div>
                </div>
                <div className="editor-form-grid">
                  <Field label="Saved item">
                    <select
                      className="select"
                      value={draft.tracked_item_id || ""}
                      onChange={(event) => {
                        const item = trackedItems.find((candidate) => candidate.id === event.target.value);
                        patch(item ? {
                          tracked_item_id: item.id,
                          item_name_snapshot: item.name,
                          item_reference_snapshot: item.reference,
                        } : { tracked_item_id: "" });
                      }}
                    >
                      <option value="">Enter an item below</option>
                      {trackedItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.reference} · {item.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Item name">
                    {input("item_name_snapshot", "e.g. Cummins QSK19 engine")}
                  </Field>
                  <Field label="Item reference">
                    {input("item_reference_snapshot", "Serial number or asset tag")}
                  </Field>
                  <Field label="Event location">
                    {input("location_snapshot", "e.g. Bay B12")}
                  </Field>
                </div>
                {!draft.tracked_item_id && (
                  <button type="button" className="btn btn-secondary" disabled={itemBusy} onClick={() => void saveTrackedItem()}>
                    {itemBusy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}
                    Save item for future records
                  </button>
                )}
              </div>
              <div className="person-in-charge">
                <span className="person-avatar">
                  {draft.person_in_charge_name_snapshot
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("") || <UserRound size={19} />}
                </span>
                <div>
                  <span className="person-label">PERSON IN CHARGE</span>
                  <strong>{draft.person_in_charge_name_snapshot}</strong>
                  <span>
                    {draft.person_in_charge_job_title_snapshot}
                    <span className="text-dot">·</span>
                    {draft.person_in_charge_employee_id_snapshot}
                  </span>
                </div>
                <ShieldCheck size={17} className="muted" />
              </div>
            </>,
          )}
          {section(
            1,
            customerAcknowledgement ? "Customer" : "Customer (optional)",
            customerAcknowledgement
              ? "Select the customer and review the contact who will acknowledge this record."
              : "Add an owner or customer when one is relevant to this internal record.",
            <>
              <div className="customer-selection">
                <Field label="Find customer">
                  <input
                    className="input"
                    placeholder="Search customers…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </Field>
                <Field label="Customer" required={customerAcknowledgement}>
                  <select
                    id="customer"
                    className="select"
                    value={draft.customer_id}
                    onChange={(event) => {
                      const customer = allCustomers.find(
                        (c) => c.id === event.target.value,
                      );
                      if (customer)
                        patch({
                          ...customerSnapshot(customer),
                          customer_id: customer.id,
                        });
                      else
                        patch({ customer_id: "", customer_name_snapshot: "" });
                    }}
                  >
                    <option value="">Select a customer</option>
                    {allCustomers
                      .filter(
                        (c) =>
                          c.id === draft.customer_id ||
                          `${c.name} ${c.contact_name}`
                            .toLowerCase()
                            .includes(customerSearch.toLowerCase()),
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              {draft.customer_id && (
                <div className="editor-form-grid customer-contact-fields">
                  <Field label="Contact person">
                    {input("contact_name_snapshot", "Full name")}
                  </Field>
                  <Field label="Position">
                    {input("contact_position_snapshot", "Contact position")}
                  </Field>
                  <Field
                    label="Mobile number"
                    hint={customerAcknowledgement ? "A mobile or office number is required for customer acknowledgement." : undefined}
                  >
                    {input("contact_mobile_snapshot", "+60", "tel")}
                  </Field>
                  <Field label="Office number">
                    {input("contact_office_snapshot", "Office number", "tel")}
                  </Field>
                  <Field label="Email">
                    {input(
                      "contact_email_snapshot",
                      "contact@company.com",
                      "email",
                    )}
                  </Field>
                  <Field label="Address">
                    {textarea(
                      "customer_address_snapshot",
                      "Service address",
                      2,
                    )}
                  </Field>
                </div>
              )}
            </>,
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDialogError("");
                setCustomerDialog(true);
              }}
            >
              <Plus size={15} />
              Add customer
            </button>,
          )}
          {section(
            2,
            "Service details",
            "Document the issue, the work and the outcome.",
            <>
              <Field label="Reported issue">
                {textarea("job_description", "What did the customer report?")}
              </Field>
              <Field label="Work performed" required>
                {textarea(
                  "work_performed",
                  "Describe the inspections, repairs or service completed.",
                  4,
                )}
              </Field>
              <div className="editor-form-grid">
                <Field label="Result / remarks">
                  {textarea(
                    "result_remarks",
                    "Record the outcome and recommendations.",
                  )}
                </Field>
                <Field label="Additional notes">
                  {textarea(
                    "additional_notes",
                    "Any other details for this visit.",
                  )}
                </Field>
              </div>
            </>,
          )}
          {section(
            3,
            "Labor",
            "Record the people and time behind the work.",
            <>
              {draft.labor.length ? (
                <div className="editor-line-table">
                  <div className="line-table-head">
                    <span>Worker</span>
                    <span>Hours × rate</span>
                    <span>Amount</span>
                    <span />
                  </div>
                  {draft.labor.map((row) => (
                    <div className="line-table-row" key={row.id}>
                      <div>
                        <strong>{row.name}</strong>
                        <small>
                          {row.classification || "Labor"}
                          {row.notes && ` · ${row.notes}`}
                        </small>
                      </div>
                      <span>
                        {row.hours} × {money(row.rate)}
                      </span>
                      <strong>
                        {money(
                          calculateTotals({
                            labor: [row],
                            materials: [],
                            charges: [],
                            discount_amount: "0",
                            tax_rate: "0",
                          }).labor_total,
                        )}
                      </strong>
                      <div className="line-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Edit labor for ${row.name}`}
                          onClick={() => openItem("labor", row)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove labor for ${row.name}`}
                          onClick={() =>
                            patch({
                              labor: draft.labor.filter(
                                (item) => item.id !== row.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="line-empty">
                  No labor recorded. Add a worker’s hours and rate.
                </div>
              )}
            </>,
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => openItem("labor")}
            >
              <Plus size={15} />
              Add labor
            </button>,
          )}
          {section(
            3,
            "Materials",
            "Parts and supplies used during the service.",
            <>
              {draft.materials.length ? (
                <div className="editor-line-table">
                  <div className="line-table-head">
                    <span>Material</span>
                    <span>Quantity × unit</span>
                    <span>Amount</span>
                    <span />
                  </div>
                  {draft.materials.map((row) => (
                    <div className="line-table-row" key={row.id}>
                      <div>
                        <strong>{row.description}</strong>
                        <small>{row.part_number || "No part number"}</small>
                        {row.photo_id &&
                          draft.photos.find((p) => p.id === row.photo_id) && (
                            <img
                              className="material-thumb"
                              src={
                                draft.photos.find((p) => p.id === row.photo_id)
                                  ?.url
                              }
                              alt={row.description}
                            />
                          )}
                      </div>
                      <span>
                        {row.quantity} × {money(row.unit_amount || "0")}
                      </span>
                      <strong>
                        {money(
                          calculateTotals({
                            labor: [],
                            materials: [row],
                            charges: [],
                            discount_amount: "0",
                            tax_rate: "0",
                          }).material_total,
                        )}
                      </strong>
                      <div className="line-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Edit ${row.description}`}
                          onClick={() => openItem("material", row)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove ${row.description}`}
                          onClick={() =>
                            patch({
                              materials: draft.materials.filter(
                                (item) => item.id !== row.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="line-empty">
                  No materials added. Record parts and supplies as needed.
                </div>
              )}
            </>,
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => openItem("material")}
            >
              <Plus size={15} />
              Add material
            </button>,
          )}
          {section(
            4,
            "Photos",
            "A visual record of your work, before and after.",
            <>
              <input
                hidden
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                hidden
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              {!draft.photos.length && !uploads.length && (
                <button
                  type="button"
                  className="photo-dropzone"
                  onClick={() => photoInput.current?.click()}
                >
                  <span className="photo-upload-icon">
                    <ImagePlus size={22} />
                  </span>
                  <strong>Add photos from this visit</strong>
                  <span>JPEG, PNG or WebP · Up to 30 MB per image</span>
                  <span className="photo-choose">
                    Choose photos <ArrowRight size={14} />
                  </span>
                </button>
              )}
              <div className="photo-grid">
                {draft.photos.map((photo) => (
                  <div className="photo-entry" key={photo.id}>
                    <div className="photo-image">
                      <img src={photo.url} alt={photo.caption || photo.name} />
                      <button
                        type="button"
                        className="photo-remove icon-button"
                        aria-label={`Remove photo ${photo.name}`}
                        onClick={() =>
                          patch((current) => ({
                            photos: current.photos.filter(
                              (p) => p.id !== photo.id,
                            ),
                            materials: current.materials.map((m) =>
                              m.photo_id === photo.id
                                ? { ...m, photo_id: undefined }
                                : m,
                            ),
                          }))
                        }
                      >
                        <X size={15} />
                      </button>
                      <span>
                        <Check size={11} />
                        Added
                      </span>
                    </div>
                    <select
                      className="select"
                      aria-label={`Category for ${photo.name}`}
                      value={photo.category}
                      onChange={(event) =>
                        patch((current) => ({
                          photos: current.photos.map((p) =>
                            p.id === photo.id
                              ? {
                                  ...p,
                                  category: event.target.value as PhotoCategory,
                                }
                              : p,
                          ),
                        }))
                      }
                    >
                      {photoCategories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                    <input
                      className="input"
                      aria-label={`Caption for ${photo.name}`}
                      placeholder="Add a caption…"
                      value={photo.caption}
                      onChange={(event) =>
                        patch((current) => ({
                          photos: current.photos.map((p) =>
                            p.id === photo.id
                              ? { ...p, caption: event.target.value }
                              : p,
                          ),
                        }))
                      }
                    />
                    <small className="muted">
                      {new Date(photo.created_at).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                ))}
                {uploads.map((upload) => (
                  <div className="upload-state" key={upload.id}>
                    {upload.busy ? (
                      <LoaderCircle className="spin" size={20} />
                    ) : (
                      <AlertCircle size={20} />
                    )}
                    <strong>{upload.file.name}</strong>
                    <span>{upload.busy ? "Adding photo…" : upload.error}</span>
                    {!upload.busy && (
                      <div>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => void processUpload(upload)}
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() =>
                            setUploads((current) =>
                              current.filter((u) => u.id !== upload.id),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>,
            <div className="photo-add-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => cameraInput.current?.click()}
              >
                <Camera size={15} />
                {field ? "Take photo" : "Camera"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => photoInput.current?.click()}
              >
                <Plus size={15} />
                {field ? "Library" : "Add photos"}
              </button>
            </div>,
          )}
          {section(
            field ? 3 : 5,
            "Additional charges",
            "Travel, parking or other service expenses.",
            <>
              {draft.charges.length ? (
                <div className="editor-line-table charge-table">
                  {draft.charges.map((row) => (
                    <div className="line-table-row" key={row.id}>
                      <strong>{row.description}</strong>
                      <strong>{money(row.amount)}</strong>
                      <div className="line-actions">
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Edit ${row.description}`}
                          onClick={() => openItem("charge", row)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={`Remove ${row.description}`}
                          onClick={() =>
                            patch({
                              charges: draft.charges.filter(
                                (item) => item.id !== row.id,
                              ),
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="line-empty">No additional charges.</div>
              )}
            </>,
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => openItem("charge")}
            >
              <Plus size={15} />
              Add charge
            </button>,
          )}
          {draft.billing_enabled !== false && section(
            5,
            "Financial summary",
            "Review charges, discount and tax.",
            <div className="financial-grid">
              <div className="editor-form-grid">
                <Field label="Discount (RM)">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.discount_amount}
                    onChange={(event) =>
                      patch({ discount_amount: event.target.value })
                    }
                  />
                </Field>
                <Field label="Tax rate (%)">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.001"
                    value={draft.tax_rate}
                    onChange={(event) =>
                      patch({ tax_rate: event.target.value })
                    }
                  />
                </Field>
                {calculated.error && (
                  <p className="editor-error" role="alert">
                    {calculated.error}
                  </p>
                )}
              </div>
              {totalsBlock()}
            </div>,
          )}
          {draft.billing_enabled !== false && section(
            5,
            "Payment",
            "Record how and when this service is paid.",
            <>
              <div className="field">
                <span id="payment-status-label">
                  Payment status<span className="required-mark"> *</span>
                </span>
                <div
                  id="payment_status"
                  className="payment-status-picker"
                  role="group"
                  aria-labelledby="payment-status-label"
                  tabIndex={-1}
                >
                  {(["UNPAID", "PAID"] as const).map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={
                        draft.payment_status === status ? "selected" : ""
                      }
                      aria-pressed={draft.payment_status === status}
                      onClick={() => patch({ payment_status: status })}
                    >
                      {draft.payment_status === status ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <Circle size={17} />
                      )}{" "}
                      {status === "PAID" ? "Paid" : "Unpaid"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="editor-form-grid">
                {draft.payment_status === "PAID" && (
                  <Field label="Payment method" required>
                    <select
                      className="select"
                      value={draft.payment_method}
                      onChange={(event) =>
                        patch({ payment_method: event.target.value })
                      }
                    >
                      <option value="">Select method</option>
                      {paymentMethods.map((method) => (
                        <option key={method}>{method}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Payment terms">
                  <select
                    className="select"
                    value={
                      paymentTerms.includes(draft.payment_terms)
                        ? draft.payment_terms
                        : "Custom"
                    }
                    onChange={(event) =>
                      patch({ payment_terms: event.target.value })
                    }
                  >
                    {paymentTerms.map((term) => (
                      <option key={term}>{term}</option>
                    ))}
                  </select>
                </Field>
                {(!paymentTerms.includes(draft.payment_terms) ||
                  draft.payment_terms === "Custom") && (
                  <Field label="Custom terms">
                    <input
                      className="input"
                      placeholder="Enter payment terms"
                      value={
                        draft.payment_terms === "Custom"
                          ? ""
                          : draft.payment_terms
                      }
                      onChange={(e) => patch({ payment_terms: e.target.value })}
                    />
                  </Field>
                )}
                <Field label="Reference number">
                  {input(
                    "payment_reference",
                    "Transaction or receipt reference",
                  )}
                </Field>
                <Field label="Payment remarks">
                  {textarea("payment_remarks", "Optional payment details", 2)}
                </Field>
              </div>
            </>,
          )}
          {section(
            6,
            field
              ? customerAcknowledgement
                ? "Review & sign"
                : "Review & attest"
              : customerAcknowledgement
                ? "Customer acceptance"
                : "Staff attestation",
            field
              ? customerAcknowledgement
                ? "Your signature confirms the service record below."
                : "Confirm that this internal record is complete and accurate."
              : customerAcknowledgement
                ? "Ask the customer to review and acknowledge this service."
                : "A staff member confirms this internal record before it is completed.",
            <>
              {field && (
                <div className="acceptance-review">
                  <span className="mono">{draft.service_number}</span>
                  <h2>
                    {draft.customer_name_snapshot || "Customer not selected"}
                  </h2>
                  <p>{draft.job_title || "Service title required"}</p>
                  <div>
                    <span>Work performed</span>
                    <p>
                      {draft.work_performed ||
                        "Record the work performed before completing this note."}
                    </p>
                  </div>
                  {draft.billing_enabled !== false && (
                    <footer>
                      <span>Total amount</span>
                      <strong>
                        {money(total?.grand_total || draft.grand_total)}
                      </strong>
                    </footer>
                  )}
                </div>
              )}
              {customerAcknowledgement ? <>
              <p className="acceptance-statement">{acceptanceStatement}</p>
              <div className="editor-form-grid">
                <Field label="Signer name" required>
                  <input
                    id="acceptance"
                    className="input"
                    placeholder="Full name"
                    value={signer}
                    onChange={(event) => {
                      setSigner(event.target.value);
                      patch({ signer_name_draft: event.target.value });
                    }}
                  />
                </Field>
                <Field label="Position">
                  <input
                    id="signer_position"
                    className="input"
                    placeholder="e.g. Maintenance manager"
                    value={position}
                    onChange={(event) => {
                      setPosition(event.target.value);
                      patch({ signer_position_draft: event.target.value });
                    }}
                  />
                </Field>
              </div>
              {signatureNotice && !draft.signature && (
                <p className="signature-notice">
                  <AlertCircle size={15} />
                  The service record changed. Please confirm a new signature.
                </p>
              )}
              <SignaturePad
                value={draft.signature?.image || null}
                onClear={() => patch({ signature: null }, true)}
                onConfirm={(image) => {
                  if (!signer.trim()) {
                    setError(
                      "Enter the signer’s full name before confirming the signature.",
                    );
                    return;
                  }
                  patch(
                    {
                      signature: {
                        signer_name: signer.trim(),
                        signer_position: position.trim(),
                        image,
                        signed_at: new Date().toISOString(),
                      },
                      signer_name_draft: signer.trim(),
                      signer_position_draft: position.trim(),
                    },
                    true,
                  );
                  setSignatureNotice(false);
                  setError("");
                }}
              />
              {draft.signature && (
                <p className="signature-timestamp">
                  Signed by {draft.signature.signer_name} ·{" "}
                  {new Date(draft.signature.signed_at).toLocaleString("en-MY", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
              </> : <div className="staff-attestation">
                <ShieldCheck size={20} />
                <div>
                  <strong>Staff attestation</strong>
                  <p>You are confirming that this internal record accurately describes the item, location, observations, and evidence captured during the event.</p>
                </div>
              </div>}
            </>,
          )}
        </fieldset>
        {!field && (
          <aside className="editor-summary">
            <div className="summary-top">
              <span className="eyebrow">Service note</span>
              <strong className="mono">{draft.service_number}</strong>
              <span className="badge badge-draft">Draft</span>
            </div>
            <div className="completion-heading">
              <span>Completion</span>
              <span>{completion.filter((c) => c.ok).length} of {completion.length}</span>
            </div>
            <div className="completion-track">
              <span
                style={{
                  width: `${(completion.filter((c) => c.ok).length / completion.length) * 100}%`,
                }}
              />
            </div>
            <div className="completion-checks">
              {completion.map((item) => (
                <a
                  href={`#note-section-${item.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  key={item.name}
                  className={item.ok ? "is-complete" : ""}
                >
                  {item.ok ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <span>{item.name}</span>
                </a>
              ))}
            </div>
            {draft.billing_enabled !== false ? (
              <div className="summary-total">
                <span>Grand total</span>
                <strong>{money(total?.grand_total || draft.grand_total)}</strong>
                <small>
                  MYR · {draft.payment_status === "PAID" ? "Paid" : "Unpaid"}
                </small>
              </div>
            ) : (
              <div className="summary-total summary-total-internal">
                <span>Internal record</span>
                <strong>No billing</strong>
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void save()}
            >
              <Save size={15} />
              Save draft
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !readiness.ready}
              onClick={() => void save(true)}
            >
              {busy ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Check size={15} />
              )}
              Complete service note
            </button>
            {!readiness.ready && (
              <p className="summary-requirements">
                {readiness.errors.length} requirement
                {readiness.errors.length === 1 ? "" : "s"} remaining. Start with{" "}
                <a
                  href={`#note-section-${readiness.firstIncomplete?.label
                    .toLowerCase()
                    .replace(/[^a-z]+/g, "-")}`}
                >
                  {readiness.firstIncomplete?.label.toLowerCase()}
                </a>
                .
              </p>
            )}
            <p className="summary-footnote">
              Completed notes are signed records and can no longer be edited.
            </p>
            {saveState && (
              <p className="editor-save-state" role="status">
                {saveState === "All changes saved" && <Check size={13} />}{" "}
                {saveState}
              </p>
            )}
          </aside>
        )}
      </div>
      {(error || validation.length > 0) && (
        <div ref={alertRef} className="editor-alert" role="alert">
          <AlertCircle size={18} />
          <div>
            {error ? (
              <p>{error}</p>
            ) : (
              <>
                <strong>A few details still need your attention</strong>
                <ul>
                  {validation.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => {
              setError("");
              setValidation([]);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {field && (
        <footer className="field-editor-footer">
          <div className="field-footer-meta">
            <span>
              {step === 6
                ? readiness.ready
                  ? "Ready for completion"
                  : readiness.firstIncomplete?.id === "acceptance"
                    ? "Signature required"
                    : `${readiness.firstIncomplete?.label || "Details"} required`
                : saveState || "Draft service note"}
            </span>
            {hasBilling && (
              <strong>{money(total?.grand_total || draft.grand_total)}</strong>
            )}
          </div>
          <div>
            {step > 0 ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => moveStep(previousFieldStep)}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            ) : (
              <Link className="btn btn-secondary" href="/field">
                <ArrowLeft size={16} />
                Exit
              </Link>
            )}
            {step < 6 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => moveStep(nextFieldStep)}
              >
                Continue
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !readiness.ready}
                onClick={() => void save(true)}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}
                Complete service note
              </button>
            )}
          </div>
        </footer>
      )}
      {itemDialog && itemValue && (
        <Modal
          title={
            draft[
              itemDialog.kind === "labor"
                ? "labor"
                : itemDialog.kind === "material"
                  ? "materials"
                  : "charges"
            ].some((item) => item.id === itemValue.id)
              ? `Edit ${itemDialog.kind}`
              : `Add ${itemDialog.kind}`
          }
          description="Enter the details for this service note."
          onClose={() => setItemDialog(null)}
        >
          <form onSubmit={saveItem}>
            <div className="editor-dialog-fields">
              {itemDialog.kind === "labor" && (
                <>
                  <Field label="Employee">
                    <select
                      className="select"
                      value={itemDialog.value.employee_id || ""}
                      onChange={(event) => {
                        const employee = employees.find(
                          (p) => p.id === event.target.value,
                        );
                        setItem(
                          employee
                            ? {
                                employee_id: employee.id,
                                name: employee.full_name,
                                classification: employee.job_title,
                              }
                            : { employee_id: undefined },
                        );
                      }}
                    >
                      <option value="">Manual entry / external worker</option>
                      {employees
                        .filter((p) => p.status === "ACTIVE")
                        .map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.full_name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Worker name" required>
                    <input
                      className="input"
                      required
                      value={itemDialog.value.name}
                      onChange={(e) => setItem({ name: e.target.value })}
                    />
                  </Field>
                  <Field label="Classification">
                    <input
                      className="input"
                      value={itemDialog.value.classification}
                      onChange={(e) =>
                        setItem({ classification: e.target.value })
                      }
                    />
                  </Field>
                  <div className="editor-form-grid">
                    <Field label="Hours" required>
                      <input
                        className="input"
                        type="number"
                        min="0.001"
                        step="0.001"
                        required
                        value={itemDialog.value.hours}
                        onChange={(e) => setItem({ hours: e.target.value })}
                      />
                    </Field>
                    <Field label="Hourly rate (RM)" required>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={itemDialog.value.rate}
                        onChange={(e) => setItem({ rate: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <textarea
                      className="textarea"
                      rows={2}
                      value={itemDialog.value.notes}
                      onChange={(e) => setItem({ notes: e.target.value })}
                    />
                  </Field>
                </>
              )}
              {itemDialog.kind === "material" && (
                <>
                  <Field label="Description" required>
                    <input
                      className="input"
                      required
                      value={itemDialog.value.description}
                      onChange={(e) => setItem({ description: e.target.value })}
                    />
                  </Field>
                  <Field label="Part number">
                    <input
                      className="input"
                      value={itemDialog.value.part_number}
                      onChange={(e) => setItem({ part_number: e.target.value })}
                    />
                  </Field>
                  <div className="editor-form-grid">
                    <Field label="Quantity" required>
                      <input
                        className="input"
                        type="number"
                        min="0.001"
                        step="0.001"
                        required
                        value={itemDialog.value.quantity}
                        onChange={(e) => setItem({ quantity: e.target.value })}
                      />
                    </Field>
                    <Field label="Unit amount (RM)">
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={itemDialog.value.unit_amount}
                        onChange={(e) =>
                          setItem({ unit_amount: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  {draft.photos.length > 0 && (
                    <Field label="Material photo">
                      <select
                        className="select"
                        value={itemDialog.value.photo_id || ""}
                        onChange={(e) =>
                          setItem({ photo_id: e.target.value || undefined })
                        }
                      >
                        <option value="">No photo</option>
                        {draft.photos.map((photo) => (
                          <option value={photo.id} key={photo.id}>
                            {photo.caption || photo.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </>
              )}
              {itemDialog.kind === "charge" && (
                <>
                  <Field label="Description" required>
                    <input
                      className="input"
                      required
                      placeholder="e.g. Travel or parking"
                      value={itemDialog.value.description}
                      onChange={(e) => setItem({ description: e.target.value })}
                    />
                  </Field>
                  <Field label="Amount (RM)" required>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={itemDialog.value.amount}
                      onChange={(e) => setItem({ amount: e.target.value })}
                    />
                  </Field>
                </>
              )}
              {dialogError && (
                <p className="editor-error" role="alert">
                  {dialogError}
                </p>
              )}
            </div>
            <footer>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setItemDialog(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save {itemDialog.kind}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {customerDialog && (
        <Modal
          title="Add customer"
          description="Save a customer and use their details in this note."
          onClose={() => {
            if (!customerBusy) setCustomerDialog(false);
          }}
        >
          <form onSubmit={createCustomer}>
            <fieldset disabled={customerBusy} className="editor-dialog-fields">
              <Field label="Company / customer name" required>
                <input
                  className="input"
                  required
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer((current) => ({
                      ...current,
                      name: e.target.value,
                    }))
                  }
                />
              </Field>
              <div className="editor-form-grid">
                {(
                  [
                    ["contact_name", "Contact person"],
                    ["contact_position", "Position"],
                    ["mobile", "Mobile number"],
                    ["office", "Office number"],
                    ["email", "Email"],
                  ] as const
                ).map(([key, label]) => (
                  <Field label={label} key={key}>
                    <input
                      className="input"
                      type={
                        key === "email"
                          ? "email"
                          : key === "mobile" || key === "office"
                            ? "tel"
                            : "text"
                      }
                      value={newCustomer[key]}
                      onChange={(e) =>
                        setNewCustomer((current) => ({
                          ...current,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label="Address">
                <textarea
                  className="textarea"
                  rows={2}
                  value={newCustomer.address}
                  onChange={(e) =>
                    setNewCustomer((current) => ({
                      ...current,
                      address: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Notes">
                <textarea
                  className="textarea"
                  rows={2}
                  value={newCustomer.notes}
                  onChange={(e) =>
                    setNewCustomer((current) => ({
                      ...current,
                      notes: e.target.value,
                    }))
                  }
                />
              </Field>
              {dialogError && (
                <p className="editor-error" role="alert">
                  {dialogError}
                </p>
              )}
            </fieldset>
            <footer>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={customerBusy}
                onClick={() => setCustomerDialog(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={customerBusy}
              >
                {customerBusy && <LoaderCircle className="spin" size={15} />}
                Create customer
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
