import { env as workerEnv } from "cloudflare:workers";

class MockR2Bucket {
  constructor(private db: any) {}
  async head(key: string) {
    const row = await this.db.prepare("SELECT content_type FROM report_mock_r2_objects WHERE key = ?").bind(key).first();
    if (!row) return null;
    return {
      size: 100,
      uploaded: new Date(),
      httpMetadata: { contentType: row.content_type },
    };
  }
  async get(key: string) {
    const row = await this.db.prepare("SELECT content, content_type FROM report_mock_r2_objects WHERE key = ?").bind(key).first();
    if (!row) return null;
    const body = new Uint8Array(row.content);
    return {
      body,
      size: body.length,
      httpMetadata: { contentType: row.content_type },
      arrayBuffer: async () => body.buffer,
    };
  }
  async put(key: string, value: any, options: any) {
    let bytes: Uint8Array;
    if (value instanceof ReadableStream) {
      // Consume the stream (for simulation we will ignore the actual content and generate a small SVG)
      try { await new Response(value).arrayBuffer(); } catch (e) {}
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="24" text-anchor="middle" dominant-baseline="middle">Simulated Photo</text></svg>`;
      bytes = new TextEncoder().encode(svg);
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="24" text-anchor="middle" dominant-baseline="middle">Simulated Photo</text></svg>`;
      bytes = new TextEncoder().encode(svg);
    }
    const contentType = options?.httpMetadata?.contentType || "image/svg+xml";
    await this.db.prepare("INSERT INTO report_mock_r2_objects (key, content, content_type, uploaded_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET content = excluded.content, content_type = excluded.content_type, uploaded_at = excluded.uploaded_at").bind(key, bytes, contentType, new Date().toISOString()).run();
    return {
      size: bytes.length,
      uploaded: new Date(),
      httpMetadata: { contentType },
    };
  }
  async delete(key: string | string[]) {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      await this.db.prepare("DELETE FROM report_mock_r2_objects WHERE key = ?").bind(k).run();
    }
  }
}

export type ExtendedEnv = Cloudflare.Env & { REPORT_MEDIA: any };

export async function cloudflareEnv(): Promise<ExtendedEnv> {
  const env = workerEnv as any;
  if (!env.REPORT_MEDIA) {
    env.REPORT_MEDIA = new MockR2Bucket(env.DB);
  }
  return env as ExtendedEnv;
}
