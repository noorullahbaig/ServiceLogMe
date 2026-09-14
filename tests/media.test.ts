import { describe, expect, it } from "vitest";
import { validateMediaUpload } from "../src/server/media";
import { evidenceWatermarkLines } from "../src/server/evidence-image-processor";

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

describe("evidence derivative context", () => {
  it("uses report, upload, employee, location and optional GPS only", () => {
    const text = evidenceWatermarkLines({
      reportNumber: "SL-2026-000301",
      uploadedAt: "13 Sep 2026, 21:20",
      employeeName: "Amir Malik",
      location: "Warehouse A · Rack 4",
      gps: { latitude: 3.139, longitude: 101.6869 },
    }).join(" ");
    expect(text).toContain("SL-2026-000301");
    expect(text).toContain("Uploaded");
    expect(text).toContain("Warehouse A");
    expect(text).toContain("GPS 3.139000, 101.686900");
    expect(text).not.toMatch(/contact|declared value/i);
  });
});
