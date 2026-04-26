/**
 * @jest-environment jsdom
 */
import { getInvoicePreviewUrl } from "@/api/invoices";
import { MissingActiveClientOrgError } from "@/api/errors";

jest.mock("@/api/client", () => ({
  apiClient: {},
  authenticatedUrl: jest.fn(
    (path: string, params?: Record<string, unknown>) => {
      const search = params
        ? `?${new URLSearchParams(
            Object.entries(params).map(([k, v]) => [k, String(v)])
          ).toString()}`
        : "";
      return `https://api.example.com${path}${search}&authToken=tok`;
    }
  ),
  safeNum: (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback,
  stripNulls: (v: unknown) => v
}));

jest.mock("@/api/tenantStorage", () => ({
  readActiveTenantId: jest.fn()
}));

jest.mock("@/hooks/useActiveClientOrg", () => ({
  readActiveClientOrgId: jest.fn(),
  ACTIVE_CLIENT_ORG_QUERY_PARAM: "clientOrgId"
}));

const { authenticatedUrl } = jest.requireMock("@/api/client") as {
  authenticatedUrl: jest.Mock;
};
const { readActiveTenantId } = jest.requireMock("@/api/tenantStorage") as {
  readActiveTenantId: jest.Mock;
};
const { readActiveClientOrgId } = jest.requireMock(
  "@/hooks/useActiveClientOrg"
) as { readActiveClientOrgId: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("api/invoices — getInvoicePreviewUrl", () => {
  it("constructs the nested-shape preview URL after #220 BE migration", () => {
    readActiveTenantId.mockReturnValue("tenant-1");
    readActiveClientOrgId.mockReturnValue("org-9");
    const url = getInvoicePreviewUrl("inv-abc", 2);
    expect(authenticatedUrl).toHaveBeenCalledWith(
      "/tenants/tenant-1/clientOrgs/org-9/invoices/inv-abc/preview",
      { page: 2 }
    );
    expect(url).toContain(
      "/tenants/tenant-1/clientOrgs/org-9/invoices/inv-abc/preview"
    );
  });

  it("defaults page to 1 and clamps non-positive page values", () => {
    readActiveTenantId.mockReturnValue("tenant-1");
    readActiveClientOrgId.mockReturnValue("org-9");
    getInvoicePreviewUrl("inv-abc");
    expect(authenticatedUrl).toHaveBeenLastCalledWith(
      "/tenants/tenant-1/clientOrgs/org-9/invoices/inv-abc/preview",
      { page: 1 }
    );
    getInvoicePreviewUrl("inv-abc", 0);
    expect(authenticatedUrl).toHaveBeenLastCalledWith(
      "/tenants/tenant-1/clientOrgs/org-9/invoices/inv-abc/preview",
      { page: 1 }
    );
  });

  it("rounds fractional page numbers to the nearest integer", () => {
    readActiveTenantId.mockReturnValue("tenant-1");
    readActiveClientOrgId.mockReturnValue("org-9");
    getInvoicePreviewUrl("inv-abc", 3.6);
    expect(authenticatedUrl).toHaveBeenLastCalledWith(
      "/tenants/tenant-1/clientOrgs/org-9/invoices/inv-abc/preview",
      { page: 4 }
    );
  });

  it("throws MissingActiveClientOrgError when tenantId is unset (mirrors interceptor guard)", () => {
    readActiveTenantId.mockReturnValue(null);
    readActiveClientOrgId.mockReturnValue("org-9");
    expect(() => getInvoicePreviewUrl("inv-abc")).toThrow(
      MissingActiveClientOrgError
    );
    expect(authenticatedUrl).not.toHaveBeenCalled();
  });

  it("throws MissingActiveClientOrgError when clientOrgId is unset", () => {
    readActiveTenantId.mockReturnValue("tenant-1");
    readActiveClientOrgId.mockReturnValue(null);
    expect(() => getInvoicePreviewUrl("inv-abc")).toThrow(
      MissingActiveClientOrgError
    );
    expect(authenticatedUrl).not.toHaveBeenCalled();
  });
});
