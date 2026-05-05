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

async function signIn(page: Page): Promise<void> {
  await gotoLogin(page);
  await page.getByLabel("Work email").fill(loginEmail);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.locator("aside.app-sidebar").waitFor({ state: "visible", timeout: 20_000 });
}

test.describe("Chrome shell", () => {
  test("renders the sidebar and topnav after sign-in", async ({ page }) => {
    await signIn(page);
    await expect(page.locator("aside.app-sidebar")).toBeVisible();
    await expect(page.locator("header.app-topnav")).toBeVisible();
    await expect(page.getByRole("button", { name: /Overview/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Invoices/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Inbox Routing/ })).toBeVisible();
  });

  test("navigates between placeholder pages via sidebar clicks", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/#\/vendors$/);
    await expect(page.getByRole("heading", { name: "Vendors" })).toBeVisible();
    await page.getByRole("button", { name: /Payments/ }).click();
    await expect(page).toHaveURL(/#\/payments$/);
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  });

  test("toggles theme via the avatar menu", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("button", { name: /^Dark$/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("opens the realm palette with cmd-K and lists client orgs", async ({ page }) => {
    await signIn(page);
    await page.keyboard.press("Meta+k");
    await expect(page.getByRole("dialog", { name: "Client org switcher" })).toBeVisible();
    await expect(page.getByLabel("Search client orgs")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Client org switcher" })).not.toBeVisible();
  });

  test("signs out from the avatar menu", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in to LedgerBuddy" })).toBeVisible();
  });
});
