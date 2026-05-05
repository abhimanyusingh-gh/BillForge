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

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await gotoLogin(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("auth flow", () => {
  test("renders the brand panel and form on /#/login", async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByRole("heading", { name: "Sign in to LedgerBuddy" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeEnabled();
    await expect(page.getByText("From inbox to")).toBeVisible();
  });

  test("invalid credentials surface backend error", async ({ page }) => {
    await loginViaUi(page, loginEmail, "definitely-wrong-password");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page).toHaveURL(/#\/login$/);
  });

  test("successful login lands on workspace shell + sidebar/topnav render", async ({ page }) => {
    await loginViaUi(page, loginEmail, loginPassword);

    await page.locator("aside.app-sidebar").waitFor({ state: "visible", timeout: 20_000 });
    await expect(page).not.toHaveURL(/#\/login$/);

    await expect(page.locator("aside.app-sidebar")).toBeVisible();
    await expect(page.locator("header.app-topnav")).toBeVisible();
    await expect(page.getByText("LedgerBuddy")).toBeVisible();
    await expect(page.getByRole("button", { name: /Switch client org/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Overview/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Invoices/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Inbox Routing/ })).toBeVisible();

    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);
    await expect(page.getByRole("button", { name: /Vendors/ })).toHaveAttribute("aria-current", "page");
  });

  test("theme toggle in avatar menu sets data-theme + persists across reload", async ({ page }) => {
    await loginViaUi(page, loginEmail, loginPassword);
    await page.locator("aside.app-sidebar").waitFor({ state: "visible", timeout: 20_000 });

    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("button", { name: /^Dark$/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await page.locator("aside.app-sidebar").waitFor({ state: "visible", timeout: 20_000 });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("⌘K opens client-org switcher palette + Esc closes", async ({ page }) => {
    await loginViaUi(page, loginEmail, loginPassword);
    await page.locator("aside.app-sidebar").waitFor({ state: "visible", timeout: 20_000 });

    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Client org switcher" })).toBeVisible();
    await expect(page.getByLabel("Search client orgs")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Client org switcher" })).not.toBeVisible();
  });

  test("sign out from avatar menu returns to login", async ({ page }) => {
    await loginViaUi(page, loginEmail, loginPassword);
    await page.locator("aside.app-sidebar").waitFor({ state: "visible", timeout: 20_000 });

    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in to LedgerBuddy" })).toBeVisible();
  });
});
