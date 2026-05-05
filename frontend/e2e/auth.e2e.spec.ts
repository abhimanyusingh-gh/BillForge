import { expect, test, type APIRequestContext } from "@playwright/test";

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4100";
const loginEmail = process.env.E2E_LOGIN_EMAIL ?? "tenant-admin-1@local.test";
const loginPassword = process.env.E2E_LOGIN_PASSWORD ?? "DemoPass!1";

async function expectBackendReady(request: APIRequestContext): Promise<void> {
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const res = await request.get(`${apiBaseUrl}/health`);
      if (res.ok()) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Backend not ready at ${apiBaseUrl} after 30 seconds.`);
}

test.describe("Login flow", () => {
  test.beforeAll(async ({ request }) => {
    await expectBackendReady(request);
  });

  test("renders the brand panel and form on /#/login", async ({ page }) => {
    await page.goto("/#/login");
    await expect(page.getByRole("heading", { name: "Sign in to LedgerBuddy" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByText("From inbox to")).toBeVisible();
  });

  test("rejects invalid credentials with a real BE error", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByLabel("Work email").fill(loginEmail);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Work email")).toBeVisible();
  });

  test("submits real seeded credentials and lands on the authenticated placeholder", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByLabel("Work email").fill(loginEmail);
    await page.getByLabel("Password").fill(loginPassword);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText("Signed in. Pages will land here as they're built.")).toBeVisible({
      timeout: 20_000
    });
  });
});
