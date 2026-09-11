import type { D1Database } from "@cloudflare/workers-types";

const encoder = new TextEncoder();
export const SESSION_COOKIE = "servicelogme_session";
const PBKDF2_ITERATIONS = 100_000;

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digest(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS, salt: encoder.encode(salt) },
    key,
    256,
  );
  return hex(bits);
}

export async function verifyPassword(password: string, expected: string, salt: string) {
  const actual = await hashPassword(password, salt);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1)
    mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export function sessionCookie(token: string, secure = true, maxAge = 86_400) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export function expiredSessionCookie(secure = true) {
  return sessionCookie("", secure, 0);
}

function readCookie(request: Request) {
  const cookies = request.headers.get("Cookie") ?? "";
  const value = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return value ? decodeURIComponent(value) : null;
}

export type AuthenticatedUser = {
  id: string;
  profileId: string;
  organizationId: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

export async function currentUser(request: Request, db: D1Database): Promise<AuthenticatedUser | null> {
  const token = readCookie(request);
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.profile_id AS profileId, u.organization_id AS organizationId,
        p.full_name AS fullName, u.email, p.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN profiles p ON p.id = u.profile_id AND p.organization_id = u.organization_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1 AND p.status = 'ACTIVE'
       LIMIT 1`,
    )
    .bind(await digest(token), new Date().toISOString())
    .first<AuthenticatedUser>();
  return row ?? null;
}

export async function requireUser(request: Request, db: D1Database, role?: AuthenticatedUser["role"]) {
  const user = await currentUser(request, db);
  if (!user)
    throw new Response(JSON.stringify({ code: "AUTHENTICATION_REQUIRED", message: "Authentication required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  if (role && user.role !== role)
    throw new Response(JSON.stringify({ code: "FORBIDDEN", message: "You do not have access to this workspace." }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  return user;
}

export async function createSession(userId: string, db: D1Database, secure: boolean) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const now = new Date();
  const expires = new Date(now.getTime() + 86_400_000);
  await db
    .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, await digest(token), expires.toISOString(), now.toISOString())
    .run();
  return sessionCookie(token, secure);
}

export async function destroySession(request: Request, db: D1Database, secure: boolean) {
  const token = readCookie(request);
  if (token)
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(token)).run();
  return expiredSessionCookie(secure);
}

export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new Response(JSON.stringify({ code: "INVALID_ORIGIN", message: "Invalid request origin" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
}

export async function authenticate(email: string, password: string, request: Request, db: D1Database) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = await digest(`${normalizedEmail}|${request.headers.get("CF-Connecting-IP") ?? "unknown"}`);
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60_000).toISOString();
  const attempt = await db
    .prepare("SELECT attempts, window_started_at AS windowStartedAt FROM login_attempts WHERE key_hash = ?")
    .bind(key)
    .first<{ attempts: number; windowStartedAt: string }>();
  if (attempt && attempt.attempts >= 8 && attempt.windowStartedAt >= windowStart) return null;

  const row = await db
    .prepare("SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE lower(email) = ? AND active = 1 LIMIT 1")
    .bind(normalizedEmail)
    .first<{ id: string; passwordHash: string; passwordSalt: string }>();
  if (!row || !(await verifyPassword(password, row.passwordHash, row.passwordSalt))) {
    await db
      .prepare(
        `INSERT INTO login_attempts (key_hash, attempts, window_started_at) VALUES (?, 1, ?)
         ON CONFLICT(key_hash) DO UPDATE SET
           attempts = CASE WHEN window_started_at < ? THEN 1 ELSE attempts + 1 END,
           window_started_at = CASE WHEN window_started_at < ? THEN excluded.window_started_at ELSE window_started_at END`,
      )
      .bind(key, now.toISOString(), windowStart, windowStart)
      .run();
    return null;
  }
  await db.prepare("DELETE FROM login_attempts WHERE key_hash = ?").bind(key).run();
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now.toISOString()).run();
  return row.id;
}
