import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  sessionCookie,
} from "../src/server/auth";

describe("first-party authentication", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("ServiceLOGME#Office", "sarah-salt");

    expect(hash).not.toContain("ServiceLOGME");
    expect(await verifyPassword("ServiceLOGME#Office", hash, "sarah-salt")).toBe(true);
    expect(await verifyPassword("wrong-password", hash, "sarah-salt")).toBe(false);
  });

  it("creates a secure session cookie with the required browser protections", () => {
    const cookie = sessionCookie("opaque-token", true, 86400);

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=86400");
  });
});
