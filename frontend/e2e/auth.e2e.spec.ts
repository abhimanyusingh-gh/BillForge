import { expect, test } from "@playwright/test";

test.describe("Login flow", () => {
  test("renders the brand panel and form on /#/login", async ({ page }) => {
    await page.goto("/#/login");
    await expect(page.getByRole("heading", { name: "Sign in to LedgerBuddy" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByText("From inbox to")).toBeVisible();
  });

  test("submits credentials and lands on the authenticated placeholder", async ({ page }) => {
    await page.route("**/api/auth/token", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "test-token-123" })
      });
    });
    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "user-1", email: "user@firm.in", role: "tenant" },
          tenant: { id: "tenant-1", name: "Acme CA", mode: "test" },
          flags: { must_change_password: false, requires_tenant_setup: false }
        })
      });
    });

    await page.goto("/#/login");
    await page.getByLabel("Work email").fill("user@firm.in");
    await page.getByLabel("Password").fill("Demo-Pass-2026!");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText("Signed in. Pages will land here as they're built.")).toBeVisible();
  });
});
