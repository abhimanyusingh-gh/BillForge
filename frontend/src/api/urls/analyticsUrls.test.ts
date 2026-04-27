/**
 * @jest-environment jsdom
 */
import { analyticsUrls } from "@/api/urls/analyticsUrls";
import { MissingActiveClientOrgError } from "@/api/errors";
import { writeActiveTenantId } from "@/api/tenantStorage";
import { setActiveClientOrgId } from "@/hooks/useActiveClientOrg";

beforeEach(() => {
  writeActiveTenantId("tenant-1");
  setActiveClientOrgId("client-1");
});

afterEach(() => {
  writeActiveTenantId(null);
  setActiveClientOrgId(null);
});

describe("api/urls/analyticsUrls — tenant-scoped routes", () => {
  it("overview resolves to the tenant-scoped analytics URL", () => {
    expect(analyticsUrls.overview()).toBe(
      "/tenants/tenant-1/analytics/overview"
    );
  });
});

describe("api/urls/analyticsUrls — missing-context guards", () => {
  it("throws MissingActiveClientOrgError when tenantId is unset", () => {
    writeActiveTenantId(null);
    expect(() => analyticsUrls.overview()).toThrow(MissingActiveClientOrgError);
  });
});
