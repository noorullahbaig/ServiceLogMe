import { describe, expect, it } from "vitest";
import { validateMediaUpload } from "../src/server/media";

describe("D1 media storage boundaries", () => {
  it("accepts supported image bytes within the server limit", () => {
    expect(validateMediaUpload("image/jpeg", 350_000, "photo")).toEqual({
      contentType: "image/jpeg",
      maxBytes: 450_000,
    });
  });

  it("rejects unsupported media and oversized payloads", () => {
    expect(() => validateMediaUpload("application/pdf", 10, "photo")).toThrow(/image/i);
    expect(() => validateMediaUpload("image/jpeg", 450_001, "photo")).toThrow(/large/i);
    expect(() => validateMediaUpload("image/png", 150_001, "signature")).toThrow(/signature/i);
  });
});
