import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  clickTab,
  expectBackendReady,
  loginPassword,
  loginViaUI,
  logoutViaUI,
  openInvoiceDetailsByFile,
  PERSONAS,
  setInvoicePageSize,
  uploadFilesViaUI,
  waitForInvoiceStatusByFile
} from "./helpers";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const inboxDir = path.join(projectRoot, "sample-invoices/inbox");
const tempUploadDir = path.join(projectRoot, ".local-run/playwright-workflow");

function createTempUploadCopy(sourceFileName: string, label: string): { sourcePath: string; uploadPath: string; uploadFileName: string } {
  fs.mkdirSync(tempUploadDir, { recursive: true });
  const sourcePath = path.join(inboxDir, sourceFileName);
  const uploadFileName = `${Date.now()}-${label}-${sourceFileName}`;
  const uploadPath = path.join(tempUploadDir, uploadFileName);
  fs.copyFileSync(sourcePath, uploadPath);
  return { sourcePath, uploadPath, uploadFileName };
}

test.describe.serial("Invoice workflow via UI", () => {
  test.beforeAll(async ({ request }) => {
    await expectBackendReady(request);
  });

  test("tenant admin configures a two-step approval workflow through the UI", async ({ page }) => {
    await loginViaUI(page, PERSONAS.tenantAdmin.email, loginPassword);
    await clickTab(page, "Tenant Config");

    const heading = page.getByRole("heading", { name: "Approval Workflow" });
    await expect(heading).toBeVisible({ timeout: 10_000 });
    await heading.scrollIntoViewIfNeeded();

    const requireWorkflow = page.getByLabel("Require approval workflow");
    if (!(await requireWorkflow.isChecked())) {
      await requireWorkflow.check();
    }

    const managerReview = page.getByLabel("Require manager review");
    if (!(await managerReview.isChecked())) {
      await managerReview.check();
    }

    const finalSignoff = page.getByLabel("Require final sign-off");
    if (await finalSignoff.isChecked()) {
      await finalSignoff.uncheck();
    }

    const saveButton = page.getByRole("button", { name: "Save Workflow" });
    if (await saveButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await saveButton.click();
      await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
    }

    await logoutViaUI(page);
  });

  test("invoice moves from review to awaiting approval after AP clerk approval", async ({ page }) => {
    const upload = createTempUploadCopy("INV-FY2526-939.pdf", "workflow-await");

    await loginViaUI(page, PERSONAS.tenantAdmin.email, loginPassword);
    await clickTab(page, "Invoices");
    await setInvoicePageSize(page, 100);
    await uploadFilesViaUI(page, [upload.uploadPath]);
    await waitForInvoiceStatusByFile(page, upload.uploadFileName, /Processed|Needs Review/, 240_000);
    await logoutViaUI(page);

    await loginViaUI(page, PERSONAS.apClerk1.email, loginPassword);
    await clickTab(page, "Invoices");
    await setInvoicePageSize(page, 100);

    const row = page.locator("table tbody tr").filter({ has: page.getByRole("button", { name: upload.uploadFileName, exact: true }) }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.locator("button.row-action-approve").click();

    await waitForInvoiceStatusByFile(page, upload.uploadFileName, /Step 2|Awaiting Approval/, 120_000);
    await logoutViaUI(page);
  });

  test("tenant admin completes the current workflow step through the detail panel", async ({ page }) => {
    const upload = createTempUploadCopy("10-Claud-04-03-Abhi.pdf", "workflow-approve");

    await loginViaUI(page, PERSONAS.tenantAdmin.email, loginPassword);
    await clickTab(page, "Invoices");
    await setInvoicePageSize(page, 100);
    await uploadFilesViaUI(page, [upload.uploadPath]);
    await waitForInvoiceStatusByFile(page, upload.uploadFileName, /Processed|Needs Review/, 240_000);
    await logoutViaUI(page);

    await loginViaUI(page, PERSONAS.apClerk1.email, loginPassword);
    await clickTab(page, "Invoices");
    await setInvoicePageSize(page, 100);
    const clerkRow = page.locator("table tbody tr").filter({ has: page.getByRole("button", { name: upload.uploadFileName, exact: true }) }).first();
    await expect(clerkRow).toBeVisible({ timeout: 30_000 });
    await clerkRow.locator("button.row-action-approve").click();
    await waitForInvoiceStatusByFile(page, upload.uploadFileName, /Step 2|Awaiting Approval/, 120_000);
    await logoutViaUI(page);

    await loginViaUI(page, PERSONAS.tenantAdmin.email, loginPassword);
    await clickTab(page, "Invoices");
    await setInvoicePageSize(page, 100);
    await openInvoiceDetailsByFile(page, upload.uploadFileName);
    await page.getByRole("button", { name: "Approve Current Step" }).click();
    await waitForInvoiceStatusByFile(page, upload.uploadFileName, /Approved/, 120_000);
    await logoutViaUI(page);
  });

  test("tenant admin can reject the current workflow step through the detail panel", async ({ page }) => {
    const upload = createTempUploadCopy("11-Claud-Sai-05-03.pdf", "workflow-reject");

    await loginViaUI(page, PERSONAS.tenantAdmin.email, loginPassword);
    await clickTab(page, "Invoices");
    await setInvoicePageSize(page, 100);
    await uploadFilesViaUI(page, [upload.uploadPath]);
    await waitForInvoiceStatusByFile(page, upload.uploadFileName, /Processed|Needs Review/, 240_000);
    await logoutViaUI(page);

    await loginViaUI(page, PERSONAS.apClerk1.email, loginPassword);
    await clickTab(page, "Invoices");
    await setInvoicePageSize(page, 100);
    const clerkRow = page.locator("table tbody tr").filter({ has: page.getByRole("button", { name: upload.uploadFileName, exact: true }) }).first();
    await expect(clerkRow).toBeVisible({ timeout: 30_000 });
    await clerkRow.locator("button.row-action-approve").click();
    await waitForInvoiceStatusByFile(page, upload.uploadFileName, /Step 2|Awaiting Approval/, 120_000);
    await logoutViaUI(page);

    await loginViaUI(page, PERSONAS.tenantAdmin.email, loginPassword);
    await clickTab(page, "Invoices");
    await setInvoicePageSize(page, 100);
    await openInvoiceDetailsByFile(page, upload.uploadFileName);
    await page.getByRole("button", { name: "Reject Current Step" }).click();
    await page.getByRole("button", { name: "Reject Step" }).click();
    await waitForInvoiceStatusByFile(page, upload.uploadFileName, /Needs Review/, 120_000);
    await logoutViaUI(page);
  });
});
