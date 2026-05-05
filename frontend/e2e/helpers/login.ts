import { type Page } from "@playwright/test";

const DEFAULT_EMAIL = process.env.E2E_LOGIN_EMAIL ?? "tenant-admin-1@local.test";
const DEFAULT_PASSWORD = process.env.E2E_LOGIN_PASSWORD ?? "DemoPass!1";

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

export async function loginViaUi(
  page: Page,
  email: string = DEFAULT_EMAIL,
  password: string = DEFAULT_PASSWORD
): Promise<void> {
  await gotoLogin(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.locator("aside.app-sidebar").waitFor({ state: "visible", timeout: 20_000 });
}
