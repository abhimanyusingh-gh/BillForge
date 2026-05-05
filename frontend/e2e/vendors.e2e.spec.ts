import { expect, test } from "@playwright/test";
import { loginViaUI } from "./helpers/login";

function freshGstin(): string {
  const stamp = (Date.now() % 100000).toString().padStart(5, "0");
  return `27ZZZZZ${stamp}A1Z5`;
}

function freshPan(): string {
  const stamp = (Date.now() % 10000).toString().padStart(4, "0");
  return `ZZZZZ${stamp}A`;
}

test.describe("vendors flow", () => {
  test("nav into vendors list renders the page header + table + thin toolbar", async ({ page }) => {
    await loginViaUI(page);

    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);
    await expect(page.getByRole("heading", { name: "Vendors" })).toBeVisible();
    await expect(page.getByRole("search")).toBeVisible();
    await expect(page.getByLabel("Search vendors")).toBeVisible();
    await expect(page.locator("table.lbtable")).toBeVisible();
    await expect(page.locator("table.lbtable thead")).toContainText("Section");
    await expect(page.locator("table.lbtable thead")).toContainText("Tally");
    await expect(page.locator("table.lbtable thead")).toContainText("FY 25-26 TDS");
  });

  test("search box filters list against real BE seeded data", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);

    const rows = page.locator("table.lbtable tbody tr.vendor-row");
    await expect(rows.first()).toBeVisible();
    const initialCount = await rows.count();
    expect(initialCount).toBeGreaterThan(1);

    const searchInput = page.getByLabel("Search vendors");
    await searchInput.fill("Sprinto");
    await searchInput.press("Enter");

    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(/Sprinto/);

    await searchInput.fill("");
    await searchInput.press("Enter");

    await expect(rows).toHaveCount(initialCount);
  });

  test("clicking a row activates side-pane preview", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);

    const rows = page.locator("table.lbtable tbody tr.vendor-row");
    await expect(rows.first()).toBeVisible();

    await rows.first().click();
    await expect(page.locator("tr.row-active")).toHaveCount(1);
    await expect(page.locator(".vendor-side-card")).toBeVisible();
    await expect(page.getByRole("button", { name: /Open full vendor/ })).toBeVisible();
  });

  test("opens vendor detail when Enter is pressed on a row", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);

    const rows = page.locator("table.lbtable tbody tr.vendor-row");
    await expect(rows.first()).toBeVisible();

    await rows.first().focus();
    await rows.first().press("Enter");
    await expect(page).toHaveURL(/#\/vendors\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 3, name: /Vendor information/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /Section 197 certificate/ })).toBeVisible();
  });

  test("merge dialog opens from detail and can be cancelled", async ({ page }) => {
    await loginViaUI(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    const rows = page.locator("table.lbtable tbody tr.vendor-row");
    await expect(rows.first()).toBeVisible();

    await rows.first().focus();
    await rows.first().press("Enter");
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
    const pan = freshPan();

    await page.getByRole("button", { name: /New vendor/ }).click();
    const dialog = page.getByRole("dialog", { name: /New vendor/ });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("PAN").fill(pan);
    await dialog.getByLabel("GSTIN").fill(gstin);
    await dialog.getByLabel("Vendor name").fill(vendorName);

    await dialog.getByRole("button", { name: /Create vendor/ }).click();

    await expect(page).toHaveURL(/#\/vendors\/[^/]+$/, { timeout: 15_000 });

    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);
    await expect(page.locator("table.lbtable tbody")).toContainText(vendorName);
  });
});
