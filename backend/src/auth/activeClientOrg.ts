import type { NextFunction, Request, Response } from "express";
import type { Types } from "mongoose";
import { findClientOrgIdByIdForTenant } from "@/services/auth/tenantScope.js";
import { getAuth } from "@/types/auth.js";

declare module "express-serve-static-core" {
  interface Request {
    activeClientOrgId?: Types.ObjectId;
  }
}

function extractClientOrgId(req: Request): string {
  const header = req.header("x-client-org-id");
  if (typeof header === "string" && header.trim().length > 0) return header.trim();
  const q = req.query?.clientOrgId;
  if (typeof q === "string" && q.trim().length > 0) return q.trim();
  const params = req.params?.clientOrgId;
  if (typeof params === "string" && params.trim().length > 0) return params.trim();
  return "";
}

export async function requireActiveClientOrg(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { tenantId } = getAuth(req);
    const raw = extractClientOrgId(req);
    if (!raw) {
      res.status(400).json({ error: "clientOrgId required and must belong to tenant" });
      return;
    }
    const owned = await findClientOrgIdByIdForTenant(raw, tenantId);
    if (!owned) {
      res.status(400).json({ error: "clientOrgId required and must belong to tenant" });
      return;
    }
    req.activeClientOrgId = owned;
    next();
  } catch (error) {
    next(error);
  }
}
