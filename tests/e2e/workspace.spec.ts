import { test, expect } from "@playwright/test";
test("search, filter, paginate and open stored service records", async ({
  page,
}) => {
  await page.goto("/service-notes");
  await expect(
    page.getByRole("heading", { name: "Service Notes", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search service notes").fill("compressor");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Atlas Engineering");
  await page.getByLabel("Clear search").click();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByText("Showing 11–12 of 12 Service Notes"),
  ).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("DRAFT");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page
    .getByLabel("Employee", { exact: true })
    .selectOption("employee-daniel");
  await expect(page).toHaveURL(/employee=employee-daniel/);
  await page.goto("/service-notes/note-128");
  await expect(
    page.getByRole("heading", { name: "SL-2026-000128", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Air compressor service", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /save draft/i })).toHaveCount(
    0,
  );
});
test("a draft saves and survives a page reload", async ({ page }) => {
  await page.goto("/service-notes/new");
  await page.waitForURL(/\/service-notes\/[0-9a-f-]+$/);
  await page
    .getByLabel("Job title", { exact: false })
    .fill("Pump pressure inspection");
  await page
    .getByRole("button", { name: "Save draft", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Service Note saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Job title", { exact: false })).toHaveValue(
    "Pump pressure inspection",
  );
});
test("a draft completion URL returns to the editor", async ({ page }) => {
  await page.goto("/service-notes/new");
  await page.waitForURL(/\/service-notes\/[0-9a-f-]+$/);
  const draftUrl = page.url();
  await page.goto(`${draftUrl}/completed`);
  await expect(page).toHaveURL(draftUrl);
  await expect(
    page.getByRole("heading", { name: "New Service Note", exact: true }),
  ).toBeVisible();
});
test("all core views fit required viewports", async ({ page }) => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    for (const route of [
      "/dashboard",
      "/service-notes",
      "/service-notes/note-127",
      "/service-notes/note-128",
      "/reports/note-128",
      "/customers",
      "/employees",
      "/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByText("Opening your workspace…")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/playwright/${size.width}-${route.replaceAll("/", "_")}.png`,
        fullPage: true,
      });
    }
  }
  for (const size of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(size);
    for (const route of [
      "/field",
      "/field/service-notes",
      "/field/service-notes/new",
    ]) {
      await page.goto(route);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByText("Opening your workspace…")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/playwright/${size.width}-${route.replaceAll("/", "_")}.png`,
        fullPage: true,
      });
    }
  }
});
