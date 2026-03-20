import { Router } from "express";
import { BankAccountModel } from "../models/BankAccount.js";
import type { IBankConnectionService } from "../services/anumati/IBankConnectionService.js";
import { logger } from "../utils/logger.js";

export function createBankWebhooksRouter(bankService: IBankConnectionService) {
  const router = Router();

  router.get("/bank/aa-callback", async (req, res) => {
    const ecres = typeof req.query.ecres === "string" ? req.query.ecres : undefined;
    const iv = typeof req.query.iv === "string" ? req.query.iv : undefined;
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";

    try {
      await bankService.handleConsentCallback({ sessionId, success: true, ecres, iv });
    } catch (error) {
      logger.error("bank.aa-callback.error", { sessionId, error: error instanceof Error ? error.message : String(error) });
    }

    res.redirect(302, "/");
  });

  router.get("/bank/mock-callback", async (req, res) => {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
    const success = req.query.success !== "false";

    try {
      await bankService.handleConsentCallback({ sessionId, success });
    } catch (error) {
      logger.error("bank.mock-callback.error", { sessionId, error: error instanceof Error ? error.message : String(error) });
    }

    res.redirect(302, "/");
  });

  router.post("/bank/consent-notify", async (req, res) => {
    try {
      await bankService.handleConsentNotify(req.body);
      res.status(200).json({ status: "ok" });
    } catch (error) {
      logger.error("bank.consent-notify.error", { error: error instanceof Error ? error.message : String(error) });
      res.status(200).json({ status: "ok" });
    }
  });

  router.post("/bank/fi-notify", async (req, res) => {
    try {
      await bankService.handleFiNotify(req.body);
      res.status(200).json({ status: "ok" });
    } catch (error) {
      logger.error("bank.fi-notify.error", { error: error instanceof Error ? error.message : String(error) });
      res.status(200).json({ status: "ok" });
    }
  });

  return router;
}
