import { getAuth } from "@/types/auth.js";
import { Router } from "express";
import { TENANT_URL_PATHS } from "@/routes/urls/tenantUrls.js";
import { TenantAssignableRoles, type TenantAssignableRole } from "@/models/core/TenantUserRole.js";
import type { TenantAdminService } from "@/services/tenant/tenantAdminService.js";
import type { TenantInviteService } from "@/services/tenant/tenantInviteService.js";
import { requireCap } from "@/auth/requireCapability.js";
import { toValidObjectId } from "@/utils/validation.js";

export function createTenantAdminRouter(tenantAdminService: TenantAdminService, inviteService: TenantInviteService) {
  const router = Router();

  router.get(TENANT_URL_PATHS.adminUsers, requireCap("canManageUsers"), async (request, response, next) => {
    try {
      const users = await tenantAdminService.listTenantUsers(getAuth(request).tenantId);
      response.json({ items: users });
    } catch (error) {
      next(error);
    }
  });

  router.post(TENANT_URL_PATHS.adminUsersInvite, requireCap("canManageUsers"), async (request, response, next) => {
    try {
      const context = getAuth(request);
      const email = typeof request.body?.email === "string" ? request.body.email : "";
      const invite = await inviteService.createInvite({
        tenantId: context.tenantId,
        invitedByUserId: context.userId,
        email
      });
      response.status(201).json(invite);
    } catch (error) {
      next(error);
    }
  });

  router.post(TENANT_URL_PATHS.adminUserRole, requireCap("canManageUsers"), async (request, response, next) => {
    try {
      if (!toValidObjectId(request.params.userId)) {
        response.status(400).json({ message: "Invalid userId." });
        return;
      }
      const role = typeof request.body?.role === "string" ? request.body.role : "";
      if (!TenantAssignableRoles.includes(role as TenantAssignableRole)) {
        response.status(400).json({ message: "Invalid role." });
        return;
      }
      await tenantAdminService.assignRole({
        tenantId: getAuth(request).tenantId,
        userId: request.params.userId,
        role: role as TenantAssignableRole,
        actingUserId: getAuth(request).userId
      });
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.patch(TENANT_URL_PATHS.adminUserEnabled, requireCap("canManageUsers"), async (request, response, next) => {
    try {
      const enabled = request.body?.enabled;
      if (typeof enabled !== "boolean") {
        response.status(400).json({ message: "enabled must be a boolean.", code: "tenant_invalid_input" });
        return;
      }
      await tenantAdminService.setUserEnabled({
        tenantId: getAuth(request).tenantId,
        userId: request.params.userId,
        enabled,
        actingUserId: getAuth(request).userId
      });
      response.json({ userId: request.params.userId, enabled });
    } catch (error) {
      next(error);
    }
  });

  router.delete(TENANT_URL_PATHS.adminUserById, requireCap("canManageUsers"), async (request, response, next) => {
    try {
      await tenantAdminService.removeUser({
        tenantId: getAuth(request).tenantId,
        userId: request.params.userId
      });
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get(TENANT_URL_PATHS.adminMailboxesList, requireCap("canManageMailboxes"), async (request, response, next) => {
    try {
      const items = await tenantAdminService.listMailboxes(getAuth(request).tenantId);
      response.json({ items });
    } catch (error) {
      next(error);
    }
  });

  router.post(TENANT_URL_PATHS.adminMailboxAssign, requireCap("canManageMailboxes"), async (request, response, next) => {
    try {
      const userId = typeof request.body?.userId === "string" ? request.body.userId : "";
      if (!userId) {
        response.status(400).json({ message: "userId is required." });
        return;
      }
      await tenantAdminService.assignMailbox(getAuth(request).tenantId, request.params.id, userId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.delete(TENANT_URL_PATHS.adminMailboxUnassign, requireCap("canManageMailboxes"), async (request, response, next) => {
    try {
      await tenantAdminService.removeMailboxAssignment(getAuth(request).tenantId, request.params.id, request.params.userId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.delete(TENANT_URL_PATHS.adminMailboxDelete, requireCap("canManageMailboxes"), async (request, response, next) => {
    try {
      await tenantAdminService.deleteMailbox(getAuth(request).tenantId, request.params.id);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get(TENANT_URL_PATHS.adminUserViewerScope, requireCap("canManageUsers"), async (request, response, next) => {
    try {
      const result = await tenantAdminService.getViewerScope(getAuth(request).tenantId, request.params.userId);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.put(TENANT_URL_PATHS.adminUserViewerScope, requireCap("canManageUsers"), async (request, response, next) => {
    try {
      if (!toValidObjectId(request.params.userId)) {
        response.status(400).json({ message: "Invalid userId." });
        return;
      }
      const visibleUserIds = Array.isArray(request.body?.visibleUserIds)
        ? request.body.visibleUserIds.filter((id: unknown) => typeof id === "string" && toValidObjectId(id))
        : [];
      const result = await tenantAdminService.setViewerScope(getAuth(request).tenantId, request.params.userId, visibleUserIds);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
