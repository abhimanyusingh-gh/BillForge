import { expect, test, type Page } from "@playwright/test";

const loginEmail = process.env.E2E_LOGIN_EMAIL ?? "tenant-admin-1@local.test";
const loginPassword = process.env.E2E_LOGIN_PASSWORD ?? "DemoPass!1";

async function gotoLogin(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      await page.goto("/#/login", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Sign in to LedgerBuddy" }).waitFor({
        state: "visible",
        timeout: 2000
      });
      return;
    } catch {
      await page.waitForTimeout(2000);
    }
  }
  throw new Error("Login page never rendered; backend or frontend is not ready.");
}

async function fillCredentials(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
}

async function clickSignIn(page: Page): Promise<void> {
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("Login flow", () => {
  test("renders the brand panel and form on /#/login", async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByRole("heading", { name: "Sign in to LedgerBuddy" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeEnabled();
    await expect(page.getByText("From inbox to")).toBeVisible();
  });

  test("rejects invalid credentials entered through the UI", async ({ page }) => {
    await gotoLogin(page);
    await fillCredentials(page, loginEmail, "definitely-wrong-password");
    await clickSignIn(page);

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });

  test("signs in with seeded credentials entered through the UI", async ({ page }) => {
    await gotoLogin(page);
    await fillCredentials(page, loginEmail, loginPassword);
    await clickSignIn(page);

    await expect(page.getByText("Signed in. Pages will land here as they're built.")).toBeVisible({
      timeout: 20_000
    });
    await expect(page).not.toHaveURL(/#\/login$/);
  });
});
