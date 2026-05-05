import { expect, test } from "@playwright/test";
import { loginViaUI } from "./helpers/login";

function freshGstin(): string {
  const stamp = (Date.now() % 100000).toString().padStart(5, "0");
  return `27ZZZZZ${stamp}A1Z5`;
}

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

  test("opens vendor detail when a row is clicked", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);

    const rows = page.locator("table.lbtable tbody tr.vendor-row");
    await expect(rows.first()).toBeVisible();

    await rows.first().click();
    await expect(page).toHaveURL(/#\/vendors\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 3, name: /Vendor information/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /Section 197 certificate/ })).toBeVisible();
  });

  test("merge dialog opens from detail and can be cancelled", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    const rows = page.locator("table.lbtable tbody tr.vendor-row");
    await expect(rows.first()).toBeVisible();

    await rows.first().click();
    await page.getByRole("button", { name: /Merge…/ }).click();
    await expect(page.getByRole("dialog", { name: /Merge vendor into/ })).toBeVisible();
    await page.getByRole("button", { name: /Cancel/ }).click();
    await expect(page.getByRole("dialog", { name: /Merge vendor into/ })).not.toBeVisible();
  });

  test("create vendor via NewVendorModal — vendor lands in list", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);

    const stamp = Date.now().toString().slice(-5);
    const vendorName = `E2E Vendor ${stamp}`;
    const gstin = freshGstin();

    await page.getByRole("button", { name: /New vendor/ }).click();
    const dialog = page.getByRole("dialog", { name: /New vendor/ });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Vendor name").fill(vendorName);
    await dialog.getByLabel("GSTIN").fill(gstin);

    await dialog.getByRole("button", { name: /Create vendor/ }).click();

    await expect(page).toHaveURL(/#\/vendors\/[^/]+$/, { timeout: 15_000 });

    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);
    await expect(page.locator("table.lbtable tbody")).toContainText(vendorName);
  });
});
