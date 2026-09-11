import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { StoredMediaRef } from "@/lib/types";
import { validateMediaUpload, type MediaPurpose } from "./media";

export interface MediaStore {
  put(input: { organizationId: string; profileId: string; bytes: ArrayBuffer; contentType: string; purpose: MediaPurpose }): Promise<StoredMediaRef>;
  get(organizationId: string, id: string): Promise<{ body: Uint8Array; contentType: string; byteSize: number } | null>;
  delete(organizationId: string, profileId: string, id: string): Promise<void>;
}

export class D1MediaStore implements MediaStore {
  constructor(private readonly db: D1Database) {}

  async put(input: { organizationId: string; profileId: string; bytes: ArrayBuffer; contentType: string; purpose: MediaPurpose }) {
    validateMediaUpload(input.contentType, input.bytes.byteLength, input.purpose);
    await this.db.prepare("DELETE FROM stored_files WHERE organization_id = ? AND attached_at IS NULL AND created_at < datetime('now', '-1 day')").bind(input.organizationId).run();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const digest = await crypto.subtle.digest("SHA-256", input.bytes);
    const checksum = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    await this.db.prepare("INSERT INTO stored_files (id, organization_id, storage_driver, object_key, content, content_type, byte_size, checksum, uploaded_by, created_at) VALUES (?, ?, 'D1', ?, ?, ?, ?, ?, ?, ?)").bind(id, input.organizationId, `d1:${id}`, input.bytes, input.contentType, input.bytes.byteLength, checksum, input.profileId, createdAt).run();
    return { id, url: `/api/files/${id}`, contentType: input.contentType, byteSize: input.bytes.byteLength };
  }

  async get(organizationId: string, id: string) {
    const row = await this.db.prepare("SELECT content, content_type AS contentType, byte_size AS byteSize FROM stored_files WHERE id = ? AND organization_id = ?").bind(id, organizationId).first<{ content: number[]; contentType: string; byteSize: number }>();
    return row?.content ? { body: new Uint8Array(row.content), contentType: row.contentType, byteSize: row.byteSize } : null;
  }

  async delete(organizationId: string, profileId: string, id: string) {
    await this.db.prepare("DELETE FROM stored_files WHERE id = ? AND organization_id = ? AND uploaded_by = ? AND attached_at IS NULL").bind(id, organizationId, profileId).run();
  }
}

export class R2MediaStore implements MediaStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(input: { organizationId: string; profileId: string; bytes: ArrayBuffer; contentType: string; purpose: MediaPurpose }) {
    validateMediaUpload(input.contentType, input.bytes.byteLength, input.purpose);
    const id = crypto.randomUUID();
    const key = `organizations/${input.organizationId}/${id}`;
    await this.bucket.put(key, input.bytes, { httpMetadata: { contentType: input.contentType } });
    return { id, url: `/api/files/${id}`, contentType: input.contentType, byteSize: input.bytes.byteLength };
  }

  async get(organizationId: string, id: string) {
    const object = await this.bucket.get(`organizations/${organizationId}/${id}`);
    if (!object) return null;
    const body = new Uint8Array(await object.arrayBuffer());
    return { body, contentType: object.httpMetadata?.contentType || "application/octet-stream", byteSize: body.byteLength };
  }
  async delete(organizationId: string, _profileId: string, id: string) {
    await this.bucket.delete(`organizations/${organizationId}/${id}`);
  }
}
