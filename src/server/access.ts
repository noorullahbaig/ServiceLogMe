import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AccessIdentity {
  email: string;
  name: string;
  subject: string;
}

export async function requireAccessIdentity(
  request: Request,
  config: Pick<CloudflareEnv, "CLOUDFLARE_ACCESS_ISSUER" | "CLOUDFLARE_ACCESS_AUD">,
): Promise<AccessIdentity> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new Response("Authentication required", { status: 401 });
  if (!config.CLOUDFLARE_ACCESS_ISSUER || !config.CLOUDFLARE_ACCESS_AUD)
    throw new Response("Access is not configured", { status: 503 });

  const issuer = config.CLOUDFLARE_ACCESS_ISSUER.replace(/\/$/, "");
  const certs = createRemoteJWKSet(
    new URL(`${issuer}/cdn-cgi/access/certs`),
  );
  try {
    const { payload } = await jwtVerify(token, certs, {
      issuer,
      audience: config.CLOUDFLARE_ACCESS_AUD,
    });
    const email = typeof payload.email === "string" ? payload.email : "";
    if (!email) throw new Error("Access token has no email claim");
    return {
      email: email.toLowerCase(),
      name:
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : email,
      subject: typeof payload.sub === "string" ? payload.sub : email,
    };
  } catch {
    throw new Response("Invalid authentication token", { status: 401 });
  }
}
