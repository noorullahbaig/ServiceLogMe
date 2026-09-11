import { authenticate, createSession } from "@/server/auth";
import { cloudflareEnv } from "@/server/cloudflare-runtime";

function failure(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email.trim() || !password)
      return failure("INVALID_CREDENTIALS", "Enter your email and password.", 422);
    const env = await cloudflareEnv();
    const userId = await authenticate(email, password, request, env.DB);
    if (!userId) return failure("INVALID_CREDENTIALS", "The email or password is not correct.", 401);
    return Response.json(
      { ok: true },
      { headers: { "set-cookie": await createSession(userId, env.DB, new URL(request.url).protocol === "https:") } },
    );
  } catch (error) {
    console.error(error);
    return failure("AUTHENTICATION_UNAVAILABLE", "Sign in is temporarily unavailable.", 503);
  }
}

