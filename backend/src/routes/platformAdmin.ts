import { Router } from "express";
import { requirePlatformAdmin } from "../auth/middleware.js";
import type { PlatformAdminService } from "../services/platformAdminService.js";

export function createPlatformAdminRouter(platformAdminService: PlatformAdminService) {
  const router = Router();

  router.get("/platform/tenants/usage", requirePlatformAdmin, async (_request, response, next) => {
    try {
      const items = await platformAdminService.listTenantUsageOverview();
      response.json({ items });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
