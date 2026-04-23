/**
 * BE-0 — standalone CLI to (re-)apply the `$jsonSchema` validators on every
 * collection with `*Minor` fields.
 *
 * Usage:
 *   ENV=local yarn tsx src/scripts/applyMinorFieldValidators.ts           # warn (default)
 *   ENV=local yarn tsx src/scripts/applyMinorFieldValidators.ts --action=error
 *
 * The `--action=error` flag flips the collection-level `validationAction` from
 * `warn` to `error`, causing the DB to reject writes that violate the integer
 * contract. Run this only after a warn-only window has shown zero offenders
 * in production logs.
 *
 * Idempotent: re-running is a no-op when the action/level are unchanged.
 * Safe to wire into deploy pipelines.
 */

import mongoose from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "@/db/connect.js";
import { applyMinorFieldValidators, type ValidationAction } from "@/db/applyJsonSchemaValidators.js";
import { logger } from "@/utils/logger.js";

function parseAction(argv: string[]): ValidationAction {
  const flag = argv.find((a) => a.startsWith("--action="));
  if (!flag) return "warn";
  const value = flag.split("=")[1];
  if (value !== "warn" && value !== "error") {
    throw new Error(`invalid --action value: ${value}. Expected 'warn' or 'error'.`);
  }
  return value;
}

async function run(): Promise<void> {
  const action = parseAction(process.argv.slice(2));
  await connectToDatabase();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("mongoose connection returned no db handle");
  }

  const results = await applyMinorFieldValidators(db, {
    action,
    level: "strict",
    log: (event, details) => logger.info(event, details)
  });

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ action, total: results.length, failed: failed.length, results }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run()
  .catch((err) => {
    console.error("applyMinorFieldValidators failed:", err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
