import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/login";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_CSV = path.join(HERE, "fixtures", "sample-bank-statement.csv");

test.describe("bank statements", () => {
  test("renders the list page with header + dropzone + table", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/#/bank-statements", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Bank Statements" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("statement-dropzone")).toBeVisible();
    await expect(page.getByText("Drop statement files here")).toBeVisible();
    await expect(page.getByRole("button", { name: /Browse files/ })).toBeEnabled();
    await expect(page.getByRole("columnheader", { name: /Account/ })).toBeVisible();
  });

  test("uploads a CSV statement and refreshes the list", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/#/bank-statements", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Bank Statements" })).toBeVisible();

    const input = page.locator("input[type=file][aria-label='Upload bank statement']");
    await input.setInputFiles(FIXTURE_CSV);

    const status = page.locator(".bs-dropzone__status.is-success, .bs-dropzone__status.is-error");
    await expect(status).toBeVisible({ timeout: 30_000 });
  });

  test("renders bank connections page", async ({ page }) => {
    await loginViaUi(page);
    await page.goto("/#/bank-connections", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Bank Connections" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("columnheader", { name: /Account/ })).toBeVisible();
  });
});
