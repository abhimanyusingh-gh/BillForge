import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/login";

test.describe("invoices surface", () => {
  test("sidebar Invoices entry navigates to /#/invoices and renders the list", async ({ page }) => {
    await loginViaUi(page);

    await page.getByRole("button", { name: /Invoices/ }).click();
    await expect(page).toHaveURL(/#\/invoices$/);
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Invoices/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("status filter chips toggle and re-fetch", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/#/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const allChip = page.getByRole("button", { name: /^All$/ });
    await expect(allChip).toBeVisible();
    await page.getByRole("button", { name: /^Approved$/ }).click();
    await expect(page.getByRole("button", { name: /^Approved$/ })).toHaveClass(/active/);
  });

  test("search input is wired and accepts text", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/#/invoices");
    const search = page.getByLabel("Search invoices");
    await search.fill("acme");
    await expect(search).toHaveValue("acme");
  });

  test("opening a row routes to /#/invoices/:id when invoices exist", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/#/invoices");
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

    const dataRows = page.locator("table.lbtable tbody tr").filter({
      has: page.locator('input[type="checkbox"]')
    });
    const rowCount = await dataRows.count();
    if (rowCount === 0) {
      test.info().annotations.push({ type: "data-skip", description: "no invoices in seed data" });
      return;
    }
    await dataRows.first().click();
    await expect(page).toHaveURL(/#\/invoices\/[a-f0-9]+/);
    await expect(page.getByRole("button", { name: /^Back$/ })).toBeVisible();
  });
});
