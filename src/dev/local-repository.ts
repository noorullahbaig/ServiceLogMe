import type { WorkspaceRepository } from "@/lib/repository";
import type {
  WorkspaceData,
  ServiceNote,
  Customer,
  Profile,
  Organization,
  TrackedItem,
  EvidencePhotoUploadMetadata,
  Photo,
} from "@/lib/types";
import { calculateTotals, completionErrors, canAccessNote, evidenceAcknowledgementStatement } from "@/lib/domain";
import { emptyNote } from "./fixtures";

/** Development adapter only. This is local persistence, never authentication or a multi-user backend. */
export class LocalWorkspaceRepository implements WorkspaceRepository {
  private db?: Promise<IDBDatabase>;
  constructor(
    public name: string,
    private initial: WorkspaceData,
  ) {}
  private open() {
    return (this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("workspace");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new Error(
            "Local storage could not be opened. Check your browser storage settings.",
          ),
        );
    }));
  }
  private async transact<T>(
    operation: (data: WorkspaceData) => T,
    write = true,
  ): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("workspace", write ? "readwrite" : "readonly"),
        store = tx.objectStore("workspace");
      let result: T;
      let failure: unknown;
      const get = store.get("data");
      get.onsuccess = () => {
        try {
          const data: WorkspaceData =
            get.result ?? structuredClone(this.initial);
          result = operation(data);
          if (write) store.put(data, "data");
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () =>
        reject(
          failure ??
            new Error(
              "Changes could not be saved. Your browser storage may be full.",
            ),
        );
      tx.onerror = () => {
        failure ??= tx.error;
      };
    });
  }
  async read() {
    return this.transact((data) => {
      const fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAA8AgMAAABeNR0CAAAADFBMVEVMaXEQEhcQEhcQEhcxjKKgAAAABHRSTlMA+UmeP4pkygAAAAlwSFlzAAALEwAACxMBAJqcGAAAAXRJREFUSMftVTtug0AQHS9ysUEolY+wJUpFnyO48BgXCHEEl1YqLrFK6zJKClf0XGJTcwlLrqLs10GALKYO06zEztvZ92b2AbDEEku4eLlRERFiTYQIxCMRojq+pyFWOl/RbrbWtxKvJIhsAfiWBMmNaAWJis3+pkASK/CGAsla25uWAHl3tar5CLZzjOZIFpcu9+CQcyTL3GAlfrx244zPj8GF8Lr/Yx8o9ROuiLdBO5gy2TIUDRuXzq0N6ugG7RCaBgszHFTmmPu1PH+pctCOSG/yQzjCD6ZEtHrb7Bj72pt2ywqa8I0f/QutTXFI3UPN+mXMUKX55f6EI1cuKYDlNTB18if0IIVVDe/t8I3ZaMLyBE1eD1QJh6Y9SewsM8M9wUkzWB0nZ43b4grLqZEfjWFmriLsSfHPlBWsR4/dNkY+sA1RT9Vlj8zpecxu22vsTJvVzEVFs0C6A2rqVJ8F8dZQ3ZzT/xmgCioCnshFlvgX8QuXblWyw6TTfQAAAABJRU5ErkJggg==";
      for(const note of data.notes)if(note.signature?.image.startsWith("data:image/svg+xml"))note.signature.image=fallback;
      return structuredClone(data);
    });
  }
  async createNote() {
    return this.transact((data) => {
      if (data.profile.status !== "ACTIVE")
        throw new Error("This employee profile is inactive.");
      const year = new Date().getFullYear(),
        prefix = `SL-${year}-`,
        last = data.notes
          .filter((n) => n.service_number.startsWith(prefix))
          .reduce(
            (max, n) =>
              Math.max(max, Number(n.service_number.slice(prefix.length))),
            0,
          );
      const note = emptyNote(
        data.profile,
        `${prefix}${String(last + 1).padStart(6, "0")}`,
        data.organization,
      );
      data.notes.unshift(note);
      this.event(data, note, "SERVICE_NOTE_CREATED");
      return structuredClone(note);
    });
  }
  private event(
    data: WorkspaceData,
    n: ServiceNote,
    type: WorkspaceData["events"][number]["type"],
  ) {
    data.events.push({
      id: crypto.randomUUID(),
      note_id: n.id,
      service_number: n.service_number,
      actor_name: data.profile.full_name,
      type,
      created_at: new Date().toISOString(),
    });
  }
  async saveNote(input: ServiceNote, complete = false) {
    return this.transact((data) => {
      const index = data.notes.findIndex((n) => n.id === input.id),
        saved = data.notes[index];
      if (!saved || !canAccessNote(data.profile, saved))
        throw new Error("This Report is not available.");
      if (saved.status === "COMPLETED")
        throw new Error("Completed Reports are read-only.");
      if (saved.revision !== input.revision)
        throw new Error(
          "This Report changed in another tab. Reload the saved record before editing again.",
        );
      const customer = input.customer_id
        ? data.customers.find(
            (c) =>
              c.id === input.customer_id &&
              c.organization_id === saved.organization_id,
          )
        : null;
      if (input.customer_id && !customer)
        throw new Error("Select a customer in this organization.");
      const note = {
        ...structuredClone(input),
        ...calculateTotals(input),
        id: saved.id,
        organization_id: saved.organization_id,
        service_number: saved.service_number,
        person_in_charge_id: saved.person_in_charge_id,
        person_in_charge_name_snapshot: saved.person_in_charge_name_snapshot,
        person_in_charge_job_title_snapshot:
          saved.person_in_charge_job_title_snapshot,
        person_in_charge_employee_id_snapshot:
          saved.person_in_charge_employee_id_snapshot,
        created_at: saved.created_at,
        status: "DRAFT" as ServiceNote["status"],
        completed_at: null as string | null,
        updated_at: new Date().toISOString(),
        revision: saved.revision + 1,
      };
      if (complete) {
        if (note.schema_version === 2) {
          const owner = data.employees.find((employee) => employee.id === note.person_in_charge_id);
          Object.assign(note, {
            organization_name_snapshot: data.organization.name,
            organization_email_snapshot: data.organization.email,
            organization_phone_snapshot: data.organization.phone,
            organization_address_snapshot: data.organization.address,
            organization_timezone_snapshot: data.organization.timezone,
            ...(owner ? {
              person_in_charge_name_snapshot: owner.full_name,
              person_in_charge_job_title_snapshot: owner.job_title,
              person_in_charge_employee_id_snapshot: owner.employee_id,
            } : {}),
          });
        }
        const errors = completionErrors(note);
        if (errors.length) throw new Error(errors.join("\n"));
        note.status = "COMPLETED";
        note.completed_at = note.updated_at;
        if (note.schema_version === 2) {
          note.acknowledgement_text_snapshot = note.signature ? evidenceAcknowledgementStatement : "";
          note.signer_name_draft = undefined;
        } else if (note.finalization_type === "STAFF_ATTESTED") {
          note.staff_attested_at = note.updated_at;
        } else if (note.signature) {
          note.signature.signed_at = note.updated_at;
        }
      }
      data.notes[index] = note;
      this.event(
        data,
        note,
        complete ? "SERVICE_NOTE_COMPLETED" : "SERVICE_NOTE_UPDATED",
      );
      return structuredClone(note);
    });
  }
  async saveCustomer(
    input: Omit<Customer, "id" | "organization_id" | "created_at"> & {
      id?: string;
    },
  ) {
    return this.transact((data) => {
      if (!input.name.trim()) throw new Error("Customer name is required.");
      const existing = input.id
        ? data.customers.find((c) => c.id === input.id)
        : undefined;
      if (input.id && !existing) throw new Error("Customer not found.");
      const customer: Customer = {
        ...input,
        id: existing?.id ?? crypto.randomUUID(),
        organization_id: data.profile.organization_id,
        created_at: existing?.created_at ?? new Date().toISOString(),
      };
      if (existing) data.customers[data.customers.indexOf(existing)] = customer;
      else data.customers.push(customer);
      return structuredClone(customer);
    });
  }
  async saveTrackedItem(
    input: Omit<TrackedItem, "id" | "organization_id" | "created_at" | "updated_at"> & {
      id?: string;
    },
  ) {
    return this.transact((data) => {
      const name = input.name.trim(), reference = input.reference.trim();
      if (!name || !reference)
        throw new Error("Item name and reference are required.");
      const items = data.tracked_items ?? (data.tracked_items = []);
      const duplicate = items.find(
        (item) =>
          item.reference.toLowerCase() === reference.toLowerCase() &&
          item.id !== input.id,
      );
      if (duplicate) throw new Error("An item with this reference already exists.");
      const existing = input.id ? items.find((item) => item.id === input.id) : undefined;
      const timestamp = new Date().toISOString();
      const saved: TrackedItem = {
        id: existing?.id ?? crypto.randomUUID(),
        organization_id: data.profile.organization_id,
        name,
        reference,
        customer_id: input.customer_id || undefined,
        created_at: existing?.created_at ?? timestamp,
        updated_at: timestamp,
      };
      const index = items.findIndex((item) => item.id === saved.id);
      if (index < 0) items.push(saved);
      else items[index] = saved;
      return structuredClone(saved);
    });
  }
  async saveEmployee(input: Profile) {
    return this.transact((data) => {
      if (data.profile.role !== "ADMIN" || data.profile.status !== "ACTIVE")
        throw new Error("Administrator access is required.");
      if (input.id === data.profile.id && input.status === "INACTIVE")
        throw new Error("You cannot deactivate your own employee profile.");
      if (
        !input.full_name.trim() ||
        !input.employee_id.trim() ||
        !input.email.trim()
      )
        throw new Error("Name, employee ID and email are required.");
      if (
        data.employees.some(
          (e) =>
            e.id !== input.id &&
            (e.email.toLowerCase() === input.email.toLowerCase() ||
              e.employee_id === input.employee_id),
        )
      )
        throw new Error("An employee already has this email or employee ID.");
      const i = data.employees.findIndex((e) => e.id === input.id);
      if (i < 0) throw new Error("Employee profile not found.");
      const employee = {
        ...input,
        organization_id: data.profile.organization_id,
      };
      const activeAdmins = data.employees.filter((e) =>
        e.id === employee.id
          ? employee.role === "ADMIN" && employee.status === "ACTIVE"
          : e.role === "ADMIN" && e.status === "ACTIVE",
      );
      if (!activeAdmins.length)
        throw new Error(
          "The last active administrator cannot be demoted or deactivated.",
        );
      data.employees[i] = employee;
      if (employee.id === data.profile.id) data.profile = employee;
    });
  }
  async saveOrganization(input: Organization) {
    return this.transact((data) => {
      if (data.profile.role !== "ADMIN")
        throw new Error("Administrator access is required.");
      if (!input.name.trim()) throw new Error("Organization name is required.");
      data.organization = {
        ...input,
        id: data.organization.id,
        currency: "MYR",
        timezone: "Asia/Kuala_Lumpur",
      };
    });
  }
  async uploadEvidencePhoto(
    _reportId: string,
    file: File,
    metadata: EvidencePhotoUploadMetadata,
  ): Promise<Photo> {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("The photo could not be read."));
      reader.readAsDataURL(file);
    });
    return {
      id: crypto.randomUUID(),
      url: dataUrl,
      original_url: dataUrl,
      original_sha256: sha256,
      derivative_sha256: sha256,
      source: metadata.source,
      uploaded_by_id: this.initial.profile.id,
      uploaded_by_name_snapshot: this.initial.profile.full_name,
      category: "OTHER",
      caption: metadata.caption ?? "",
      created_at: new Date().toISOString(),
      name: file.name,
      gps_latitude: metadata.gps_latitude,
      gps_longitude: metadata.gps_longitude,
      gps_accuracy: metadata.gps_accuracy,
      gps_device_timestamp: metadata.gps_device_timestamp,
    };
  }
  async deleteEvidencePhoto() {}
}
