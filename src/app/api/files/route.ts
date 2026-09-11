import { requireAccessIdentity } from "@/server/access";
import { cloudflareEnv } from "@/server/cloudflare-runtime";

export async function GET(request: Request) {
  try {
    const env = await cloudflareEnv();
    await requireAccessIdentity(request, env);
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !env.FILES) return new Response("File not found", { status: 404 });
    const object = await env.FILES.get(key);
    if (!object) return new Response("File not found", { status: 404 });
    return new Response(object.body as unknown as globalThis.ReadableStream, { headers: { "content-type": object.httpMetadata?.contentType || "application/octet-stream", "cache-control": "private, max-age=300" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return new Response("Unable to read file", { status: 500 });
  }
}
