import { type Page } from "@playwright/test";

interface LoginPersona {
  email: string;
  password: string;
}

export const DEFAULT_PERSONA: LoginPersona = {
  email: process.env.E2E_LOGIN_EMAIL ?? "tenant-admin-1@local.test",
  password: process.env.E2E_LOGIN_PASSWORD ?? "DemoPass!1"
};

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

export async function loginViaUI(page: Page, persona: LoginPersona = DEFAULT_PERSONA): Promise<void> {
  await gotoLogin(page);
  await page.getByLabel("Work email").fill(persona.email);
  await page.getByLabel("Password").fill(persona.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.locator("aside.app-sidebar").waitFor({ state: "visible", timeout: 20_000 });
}

export async function gotoLoginPage(page: Page): Promise<void> {
  await gotoLogin(page);
}
