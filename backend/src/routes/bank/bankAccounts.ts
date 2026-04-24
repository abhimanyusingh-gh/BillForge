import { getAuth } from "@/types/auth.js";
import { Router } from "express";
import { requireCap } from "@/auth/requireCapability.js";
import { BankAccountModel } from "@/models/bank/BankAccount.js";
import type { IBankConnectionService } from "@/services/bank/anumati/IBankConnectionService.js";
import { BANK_ACCOUNT_STATUS } from "@/types/bankAccount.js";
import {
  findClientOrgIdsForTenant,
  findClientOrgIdByIdForTenant
} from "@/services/auth/tenantScope.js";

export function createBankAccountsRouter(bankService: IBankConnectionService) {
  const router = Router();

  router.get("/bank/accounts", requireCap("canManageConnections"), async (req, res, next) => {
    try {
      const { tenantId } = getAuth(req);
      const clientOrgIds = await findClientOrgIdsForTenant(tenantId);
      const accounts = await BankAccountModel.find({ clientOrgId: { $in: clientOrgIds } })
        .sort({ createdAt: -1 })
        .lean();
      res.json({
        items: accounts.map((a) => ({
          _id: a._id.toString(),
          clientOrgId: String(a.clientOrgId),
          status: a.status,
          aaAddress: a.aaAddress,
          displayName: a.displayName,
          bankName: a.bankName,
          maskedAccNumber: a.maskedAccNumber,
          balanceMinor: a.balanceMinor,
          currency: a.currency,
          balanceFetchedAt: a.balanceFetchedAt,
          lastErrorReason: a.lastErrorReason,
          createdAt: a.createdAt
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/bank/accounts", requireCap("canManageConnections"), async (req, res, next) => {
    try {
      const { tenantId, userId } = getAuth(req);
      const aaAddress = typeof req.body?.aaAddress === "string" ? req.body.aaAddress.trim() : "";
      const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
      const clientOrgIdRaw = typeof req.body?.clientOrgId === "string" ? req.body.clientOrgId.trim() : "";

      if (!aaAddress) {
        res.status(400).json({ message: "aaAddress is required." });
        return;
      }
      if (!clientOrgIdRaw) {
        res.status(400).json({ message: "clientOrgId is required." });
        return;
      }
      const ownedClientOrgId = await findClientOrgIdByIdForTenant(clientOrgIdRaw, tenantId);
      if (!ownedClientOrgId) {
        res.status(403).json({ message: "clientOrgId does not belong to this tenant." });
        return;
      }

      const account = await BankAccountModel.create({
        clientOrgId: ownedClientOrgId,
        createdByUserId: userId,
        aaAddress,
        displayName: displayName || aaAddress,
        status: BANK_ACCOUNT_STATUS.PENDING_CONSENT
      });

      const result = await bankService.initiateConsent({
        tenantId,
        userId,
        aaAddress,
        displayName: displayName || aaAddress,
        bankAccountId: account._id.toString()
      });

      res.status(201).json({ _id: account._id.toString(), redirectUrl: result.redirectUrl });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/bank/accounts/:id", requireCap("canManageConnections"), async (req, res, next) => {
    try {
      const { tenantId } = getAuth(req);
      const clientOrgIds = await findClientOrgIdsForTenant(tenantId);
      const account = await BankAccountModel.findOne({
        _id: req.params.id,
        clientOrgId: { $in: clientOrgIds }
      });
      if (!account) {
        res.status(404).json({ message: "Bank account not found." });
        return;
      }
      await bankService.revokeConsent(account._id.toString());
      await BankAccountModel.deleteOne({ _id: account._id });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post("/bank/accounts/:id/refresh", requireCap("canManageConnections"), async (req, res, next) => {
    try {
      const { tenantId } = getAuth(req);
      const clientOrgIds = await findClientOrgIdsForTenant(tenantId);
      const account = await BankAccountModel.findOne({
        _id: req.params.id,
        clientOrgId: { $in: clientOrgIds }
      });
      if (!account) {
        res.status(404).json({ message: "Bank account not found." });
        return;
      }
      const result = await bankService.fetchFiData(account._id.toString());
      res.json({
        balanceMinor: result.balanceMinor,
        bankName: result.bankName,
        maskedAccNumber: result.maskedAccNumber,
        balanceFetchedAt: result.balanceFetchedAt
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
