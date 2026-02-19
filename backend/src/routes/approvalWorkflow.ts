import { Router } from "express";
import type { ApprovalWorkflowService } from "../services/approvalWorkflowService.js";
import { requireTenantAdmin, requireNotViewer } from "../auth/middleware.js";
import { requireAuth } from "../auth/requireAuth.js";

export function createApprovalWorkflowRouter(workflowService: ApprovalWorkflowService) {
  const router = Router();
  router.use(requireAuth);

  router.get("/admin/approval-workflow", requireTenantAdmin, async (req, res, next) => {
    try {
      const config = await workflowService.getWorkflowConfig(req.authContext!.tenantId);
      res.json(config ?? { enabled: false, mode: "simple", simpleConfig: { requireManagerReview: false, requireFinalSignoff: false }, steps: [] });
    } catch (error) {
      next(error);
    }
  });

  router.put("/admin/approval-workflow", requireTenantAdmin, async (req, res, next) => {
    try {
      const context = req.authContext!;
      const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : false;
      const mode = req.body?.mode === "advanced" ? "advanced" : "simple";
      const simpleConfig = {
        requireManagerReview: typeof req.body?.simpleConfig?.requireManagerReview === "boolean" ? req.body.simpleConfig.requireManagerReview : false,
        requireFinalSignoff: typeof req.body?.simpleConfig?.requireFinalSignoff === "boolean" ? req.body.simpleConfig.requireFinalSignoff : false
      };
      const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];

      const result = await workflowService.saveWorkflowConfig(
        context.tenantId,
        { enabled, mode, simpleConfig, steps },
        context.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/invoices/:id/workflow-approve", requireNotViewer, async (req, res, next) => {
    try {
      const result = await workflowService.approveStep(req.params.id, req.authContext!);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/invoices/:id/workflow-reject", requireNotViewer, async (req, res, next) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (!reason) {
        res.status(400).json({ message: "Rejection reason is required." });
        return;
      }
      await workflowService.rejectStep(req.params.id, reason, req.authContext!);
      res.json({ rejected: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
