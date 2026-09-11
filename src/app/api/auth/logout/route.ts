import { destroySession } from "@/server/auth";
import { cloudflareEnv } from "@/server/cloudflare-runtime";

export async function POST(request: Request) {
  const env = await cloudflareEnv();
  const secure = new URL(request.url).protocol === "https:";
  return Response.json({ ok: true }, { headers: { "set-cookie": await destroySession(request, env.DB, secure) } });
}

