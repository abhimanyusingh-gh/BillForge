import {
  getRoleDefaults,
  mergeCapabilitiesWithDefaults,
  applyApprovalLimitOverrides
} from "@/auth/personaDefaults.js";

describe("personaDefaults", () => {
  describe("getRoleDefaults", () => {
    it.each([
      ["ap_clerk approval limit", "ap_clerk", 10000000],
      ["senior_accountant approval limit", "senior_accountant", 100000000],
      ["TENANT_ADMIN unlimited approval limit", "TENANT_ADMIN", null],
    ])("%s", (_label, role, expected) => {
      const caps = getRoleDefaults(role as Parameters<typeof getRoleDefaults>[0]);
      expect(caps.approvalLimitMinor).toBe(expected);
    });

    it("ap_clerk defaults include canApproveInvoices=true", () => {
      expect(getRoleDefaults("ap_clerk").canApproveInvoices).toBe(true);
    });

    describe("canManageMailboxes mirrors canManageUsers per persona", () => {
      it.each([
        ["TENANT_ADMIN", true],
        ["ap_clerk", false],
        ["senior_accountant", false],
        ["ca", false],
        ["tax_specialist", false],
        ["firm_partner", true],
        ["ops_admin", true],
        ["audit_clerk", false],
        ["PLATFORM_ADMIN", false],
      ])("%s → %s", (role, expected) => {
        const caps = getRoleDefaults(role as Parameters<typeof getRoleDefaults>[0]);
        expect(caps.canManageMailboxes).toBe(expected);
        expect(caps.canManageMailboxes).toBe(caps.canManageUsers);
      });
    });
  });

  describe("applyApprovalLimitOverrides", () => {
    it.each([
      ["undefined overrides", undefined, 10000000],
      ["null overrides", null, 10000000],
      ["role not in overrides", { senior_accountant: 50000000 }, 10000000],
    ])("returns default when %s", (_label, overrides, expected) => {
      const caps = getRoleDefaults("ap_clerk");
      const result = applyApprovalLimitOverrides(caps, "ap_clerk", overrides as any);
      expect(result.approvalLimitMinor).toBe(expected);
    });

    it("applies override when role is present and preserves other capabilities", () => {
      const caps = getRoleDefaults("ap_clerk");
      const result = applyApprovalLimitOverrides(caps, "ap_clerk", { ap_clerk: 5000000 });
      expect(result.approvalLimitMinor).toBe(5000000);
      expect(result.canApproveInvoices).toBe(true);
      expect(result.canEditInvoiceFields).toBe(true);
      expect(result.canExportToTally).toBe(true);
    });

    it("applies zero override to effectively remove approval ability", () => {
      const caps = getRoleDefaults("senior_accountant");
      const result = applyApprovalLimitOverrides(caps, "senior_accountant", { senior_accountant: 0 });
      expect(result.approvalLimitMinor).toBe(0);
    });

    it("applies override for multiple roles independently", () => {
      const clerkCaps = getRoleDefaults("ap_clerk");
      const seniorCaps = getRoleDefaults("senior_accountant");
      const overrides = { ap_clerk: 15000000, senior_accountant: 250000000 };
      expect(applyApprovalLimitOverrides(clerkCaps, "ap_clerk", overrides).approvalLimitMinor).toBe(15000000);
      expect(applyApprovalLimitOverrides(seniorCaps, "senior_accountant", overrides).approvalLimitMinor).toBe(250000000);
    });
  });

  describe("mergeCapabilitiesWithDefaults", () => {
    it("returns role defaults when storedCaps is null", () => {
      const result = mergeCapabilitiesWithDefaults("ap_clerk", null);
      expect(result.approvalLimitMinor).toBe(10000000);
    });

    it("overrides specific capability from stored caps", () => {
      const result = mergeCapabilitiesWithDefaults("ap_clerk", { approvalLimitMinor: 5000000 });
      expect(result.approvalLimitMinor).toBe(5000000);
    });
  });
});
