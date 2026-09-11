import type { WorkspaceRepository } from "./repository";
import type { Customer, Organization, Profile, ServiceNote, StoredMediaRef, WorkspaceData } from "./types";

type ActionBody = { action: string; [key: string]: unknown };

async function call<T>(body: ActionBody): Promise<T> {
  const response = await fetch("/api/workspace", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ message: response.statusText })) as T & { message?: string };
  if (response.status === 401) {
    window.location.assign("/login");
    throw new Error("Authentication required");
  }
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "Workspace request failed");
  return payload as T;
}

export class CloudflareWorkspaceRepository implements WorkspaceRepository {
  async read(): Promise<WorkspaceData> {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    const payload = await response.json().catch(() => ({ message: response.statusText })) as WorkspaceData & { message?: string };
    if (response.status === 401) {
      window.location.assign("/login");
      throw new Error("Authentication required");
    }
    if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "Unable to open workspace");
    return payload as WorkspaceData;
  }
  createNote() { return call<ServiceNote>({ action: "create-note" }); }
  saveNote(note: ServiceNote, complete = false) { return call<ServiceNote>({ action: "save-note", note, complete }); }
  saveCustomer(customer: Omit<Customer, "id" | "organization_id" | "created_at"> & { id?: string }) { return call<Customer>({ action: "save-customer", customer }); }
  async saveEmployee(employee: Profile) { await call({ action: "save-employee", employee }); }
  async saveOrganization(organization: Organization) { await call({ action: "save-organization", organization }); }
  async uploadMedia(data: ArrayBuffer, contentType: string, purpose: "photo" | "signature") {
    const response = await fetch("/api/files", { method: "POST", headers: { "content-type": contentType, "x-media-purpose": purpose }, body: data });
    const payload = await response.json().catch(() => ({ message: response.statusText })) as StoredMediaRef & { message?: string };
    if (response.status === 401) { window.location.replace("/login"); throw new Error("Authentication required"); }
    if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "Unable to store media");
    return payload;
  }
  async deleteMedia(id: string) {
    const response = await fetch(`/api/files/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.status === 401) { window.location.replace("/login"); throw new Error("Authentication required"); }
    if (!response.ok) throw new Error("Unable to remove media");
  }
}
