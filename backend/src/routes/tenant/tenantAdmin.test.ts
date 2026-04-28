import { createTenantAdminRouter } from "@/routes/tenant/tenantAdmin.ts";
import type { TenantAdminService } from "@/services/tenant/tenantAdminService.ts";
import type { TenantInviteService } from "@/services/tenant/tenantInviteService.ts";

jest.mock("@/auth/requireCapability.ts", () => ({
  requireCap: (capabilityName: string) => {
    const middleware = (_req: unknown, _res: unknown, next: Function) => next();
    (middleware as unknown as { __capability: string }).__capability = capabilityName;
    return middleware;
  }
}));

type RouterStack = {
  stack: {
    route?: {
      path: string;
      methods: Record<string, boolean>;
      stack: { handle: { __capability?: string } }[];
    };
  }[];
};

function findGuardCapability(router: RouterStack, method: string, path: string): string | undefined {
  for (const layer of router.stack) {
    if (layer.route?.path === path && layer.route.methods[method]) {
      for (const entry of layer.route.stack) {
        if (entry.handle.__capability) return entry.handle.__capability;
      }
    }
  }
  return undefined;
}

describe("tenantAdmin route guards", () => {
  const router = createTenantAdminRouter(
    {} as unknown as TenantAdminService,
    {} as unknown as TenantInviteService
  ) as unknown as RouterStack;

  describe("/admin/mailboxes/* routes are gated on canManageMailboxes", () => {
    it.each([
      ["get", "/admin/mailboxes"],
      ["post", "/admin/mailboxes/:id/assign"],
      ["delete", "/admin/mailboxes/:id/assign/:userId"],
      ["delete", "/admin/mailboxes/:id"],
    ])("%s %s", (method, path) => {
      expect(findGuardCapability(router, method, path)).toBe("canManageMailboxes");
    });
  });

  describe("/admin/users/* routes remain gated on canManageUsers", () => {
    it.each([
      ["get", "/admin/users"],
      ["post", "/admin/users/invite"],
      ["post", "/admin/users/:userId/role"],
      ["patch", "/admin/users/:userId/enabled"],
      ["delete", "/admin/users/:userId"],
      ["get", "/admin/users/:userId/viewer-scope"],
      ["put", "/admin/users/:userId/viewer-scope"],
    ])("%s %s", (method, path) => {
      expect(findGuardCapability(router, method, path)).toBe("canManageUsers");
    });
  });
});
