import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("workspace language", () => {
  it("keeps sign-in language product-focused", async () => {
    const page = await readFile(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
    expect(page.toLowerCase()).not.toMatch(/demo|trial|sample|simulation|temporary|reset/);
  });
});
