import { currentUser } from "@/server/auth";
import { cloudflareEnv } from "@/server/cloudflare-runtime";

export async function GET(request: Request) {
  const env = await cloudflareEnv();
  const user = await currentUser(request, env.DB);
  if (!user) return Response.json({ code: "AUTHENTICATION_REQUIRED", message: "Authentication required" }, { status: 401 });
  return Response.json({ user });
}

