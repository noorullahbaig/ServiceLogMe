import type { WorkspaceRepository } from "./repository";
import type { Customer, EvidencePhotoUploadMetadata, Organization, Photo, Profile, ReportPage, ReportQuery, ServiceNote, StoredMediaRef, TrackedItem, WorkspaceData } from "./types";

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
  async listReports(query: ReportQuery): Promise<ReportPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    const response = await fetch(`/api/reports?${params}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ message: response.statusText })) as ReportPage & { message?: string };
    if (!response.ok) throw new Error(payload.message || "Unable to list Reports");
    return payload;
  }
  createNote() { return call<ServiceNote>({ action: "create-note" }); }
  saveNote(note: ServiceNote, complete = false) { return call<ServiceNote>({ action: "save-note", note, complete }); }
  saveCustomer(customer: Omit<Customer, "id" | "organization_id" | "created_at"> & { id?: string }) { return call<Customer>({ action: "save-customer", customer }); }
  saveTrackedItem(item: Omit<TrackedItem, "id" | "organization_id" | "created_at" | "updated_at"> & { id?: string }) { return call<TrackedItem>({ action: "save-tracked-item", item }); }
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
  async uploadEvidencePhoto(reportId: string, file: File, metadata: EvidencePhotoUploadMetadata): Promise<Photo> {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const headers = new Headers({ "content-type": file.type || "application/octet-stream", "x-content-sha256": checksum, "x-photo-source": metadata.source, "x-original-filename": encodeURIComponent(file.name) });
    if (metadata.gps_latitude != null) headers.set("x-gps-latitude", String(metadata.gps_latitude));
    if (metadata.gps_longitude != null) headers.set("x-gps-longitude", String(metadata.gps_longitude));
    if (metadata.gps_accuracy != null) headers.set("x-gps-accuracy", String(metadata.gps_accuracy));
    if (metadata.gps_device_timestamp) headers.set("x-gps-device-timestamp", metadata.gps_device_timestamp);
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/photos`, { method: "POST", headers, body: bytes });
    const payload = await response.json().catch(() => ({ message: response.statusText })) as Photo & { message?: string };
    if (!response.ok) throw new Error(payload.message || "Unable to store evidence photo");
    return payload;
  }
  async deleteEvidencePhoto(_reportId: string, photoId: string) {
    const response = await fetch(`/api/report-photos/${encodeURIComponent(photoId)}/original`, { method: "DELETE" });
    if (!response.ok) { const payload = await response.json().catch(() => ({})) as { message?: string }; throw new Error(payload.message || "Unable to remove evidence photo"); }
  }
}
