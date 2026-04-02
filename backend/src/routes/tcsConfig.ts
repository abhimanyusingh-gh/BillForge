import { Router } from "express";
import { TenantTcsConfigModel } from "../models/TenantTcsConfig.js";
import { requireAuth } from "../auth/requireAuth.js";
import { requireCap } from "../auth/requireCapability.js";
import { ActiveTenantRoles, normalizeTenantRole } from "../models/TenantUserRole.js";
import type { Request, Response, NextFunction } from "express";

const VALID_ROLES = new Set<string>(ActiveTenantRoles);

function requireTcsModifyAccess(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.authContext!.tenantId;
  const role = req.authContext!.role;

  TenantTcsConfigModel.findOne({ tenantId }).lean().then((config) => {
    const allowed = config?.tcsModifyRoles ?? ActiveTenantRoles;
    const normalizedRole = normalizeTenantRole(role);
    if ((allowed as string[]).includes(normalizedRole)) {
      next();
    } else {
      res.status(403).json({ message: "Your role is not permitted to modify TCS configuration.", code: "tcs_modify_denied" });
    }
  }).catch(next);
}

export function createTcsConfigRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get("/admin/tcs-config", async (req, res, next) => {
    try {
      const tenantId = req.authContext!.tenantId;
      let config = await TenantTcsConfigModel.findOne({ tenantId }).lean();
      if (!config) {
        const created = await TenantTcsConfigModel.create({ tenantId, updatedBy: req.authContext!.userId });
        res.json(created.toObject());
        return;
      }
      res.json(config);
    } catch (error) { next(error); }
  });

  router.put("/admin/tcs-config", requireTcsModifyAccess, async (req, res, next) => {
    try {
      const tenantId = req.authContext!.tenantId;
      const { ratePercent, effectiveFrom, reason, enabled } = req.body;

      if (typeof ratePercent !== "number" || ratePercent < 0 || ratePercent > 100) {
        res.status(400).json({ message: "ratePercent must be a number between 0 and 100." });
        return;
      }

      if (typeof effectiveFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || isNaN(Date.parse(effectiveFrom))) {
        res.status(400).json({ message: "effectiveFrom must be a valid date string in YYYY-MM-DD format." });
        return;
      }

      if (typeof enabled !== "boolean") {
        res.status(400).json({ message: "enabled must be a boolean." });
        return;
      }

      const existing = await TenantTcsConfigModel.findOne({ tenantId }).lean();
      const previousRate = existing?.ratePercent ?? 0;
      const previousEffectiveFrom = existing?.effectiveFrom ?? effectiveFrom;

      const historyEntry = {
        previousRate,
        newRate: ratePercent,
        changedBy: req.authContext!.userId,
        changedByName: req.authContext!.email ?? req.authContext!.userId,
        changedAt: new Date(),
        reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
        effectiveFrom: previousEffectiveFrom
      };

      const updated = await TenantTcsConfigModel.findOneAndUpdate(
        { tenantId },
        {
          $set: { ratePercent, effectiveFrom, enabled, updatedBy: req.authContext!.userId },
          $push: { history: { $each: [historyEntry], $position: 0 } }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      res.json(updated!.toObject());
    } catch (error) { next(error); }
  });

  router.put("/admin/tcs-config/roles", requireCap("canConfigureCompliance"), async (req, res, next) => {
    try {
      const tenantId = req.authContext!.tenantId;
      const { tcsModifyRoles } = req.body;

      if (!Array.isArray(tcsModifyRoles)) {
        res.status(400).json({ message: "tcsModifyRoles must be an array." });
        return;
      }

      const invalidRoles = tcsModifyRoles.filter((r: unknown) => typeof r !== "string" || !VALID_ROLES.has(r));
      if (invalidRoles.length > 0) {
        res.status(400).json({ message: `Invalid roles: ${invalidRoles.join(", ")}` });
        return;
      }

      const updated = await TenantTcsConfigModel.findOneAndUpdate(
        { tenantId },
        { $set: { tcsModifyRoles } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      res.json(updated!.toObject());
    } catch (error) { next(error); }
  });

  router.get("/admin/tcs-config/history", async (req, res, next) => {
    try {
      const tenantId = req.authContext!.tenantId;
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = 20;
      const skip = (page - 1) * limit;

      const config = await TenantTcsConfigModel.findOne({ tenantId }).lean();
      const history = config?.history ?? [];
      const total = history.length;
      const items = history.slice(skip, skip + limit);

      res.json({ items, page, limit, total });
    } catch (error) { next(error); }
  });

  return router;
}
