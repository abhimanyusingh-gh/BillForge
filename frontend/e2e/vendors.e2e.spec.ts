import { expect, test } from "@playwright/test";
import { loginViaUI } from "./helpers/login";

test.describe("vendors flow", () => {
  test("nav into vendors list renders the page header + table", async ({ page }) => {
    await loginViaUI(page);

    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);
    await expect(page.getByRole("heading", { name: "Vendors" })).toBeVisible();
    await expect(page.getByRole("search")).toBeVisible();
    await expect(page.locator("table.lbtable")).toBeVisible();
  });

  test("filter status select narrows the list without errors", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);

    await page.getByLabel("Filter vendors by status").selectOption("active");
    await expect(page.locator("table.lbtable")).toBeVisible();
  });

  test("opens vendor detail when a row is present (skips when seed is empty)", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);

    const rows = page.locator("table.lbtable tbody tr.vendor-row");
    const count = await rows.count();
    test.skip(count === 0, "No vendor rows seeded; row-click flow not exercisable.");

    await rows.first().click();
    await expect(page).toHaveURL(/#\/vendors\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 3, name: /Vendor information/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /Section 197 certificate/ })).toBeVisible();
  });

  test("merge dialog opens from detail and can be cancelled (skips when seed is empty)", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    const rows = page.locator("table.lbtable tbody tr.vendor-row");
    const count = await rows.count();
    test.skip(count === 0, "No vendor rows seeded; merge flow not exercisable.");

    await rows.first().click();
    await page.getByRole("button", { name: /Merge…/ }).click();
    await expect(page.getByRole("dialog", { name: /Merge vendor into/ })).toBeVisible();
    await page.getByRole("button", { name: /Cancel/ }).click();
    await expect(page.getByRole("dialog", { name: /Merge vendor into/ })).not.toBeVisible();
  });
});
