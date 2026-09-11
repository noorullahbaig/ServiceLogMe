import { requireUser } from "@/server/auth";
import { cloudflareEnv } from "@/server/cloudflare-runtime";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const env = await cloudflareEnv();
  const user = await requireUser(request, env.DB);
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT content, content_type AS contentType, byte_size AS byteSize FROM stored_files WHERE id = ? AND organization_id = ? LIMIT 1").bind(id, user.organizationId).first<{ content: number[]; contentType: string; byteSize: number }>();
  if (!row?.content) return new Response("File not found", { status: 404 });
  const content = new Uint8Array(row.content);
  return new Response(content, { headers: { "content-type": row.contentType, "content-length": String(row.byteSize), "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
}

export async function DELETE(request: Request, context: Context) {
  const env = await cloudflareEnv();
  const user = await requireUser(request, env.DB);
  const { id } = await context.params;
  await env.DB.prepare("DELETE FROM stored_files WHERE id = ? AND organization_id = ? AND uploaded_by = ? AND attached_at IS NULL").bind(id, user.organizationId, user.profileId).run();
  return Response.json({ ok: true });
}
