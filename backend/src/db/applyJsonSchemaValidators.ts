/**
 * BE-0 — idempotent applier for `$jsonSchema` `*Minor` validators.
 *
 * Uses `collMod` (which replaces validators on each call, making re-runs safe).
 * Does NOT touch data — no `updateMany`, no backfills. On first deploy the
 * validator is installed with `validationAction: 'warn'` so legacy offenders
 * (if any) surface in logs without rejecting the write. After a warning-free
 * window the operator can flip to `'error'` by re-running with the
 * `ERROR` action (see `applyMinorFieldValidators` options).
 *
 * Integration points:
 *   - `backend/src/db/connect.ts` — runs once per process boot, recorded in the
 *     `migrations` collection under `_id: 'minor_field_jsonschema_validators_v1'`.
 *   - `backend/src/scripts/applyMinorFieldValidators.ts` — standalone CLI for
 *     operators who want to (re-)apply or flip to `error` action ahead of a
 *     Mongoose deploy.
 */

import type { Db } from "mongodb";
import mongoose from "mongoose";
import { buildAllJsonSchemas, MINOR_FIELD_REGISTRY } from "@/db/jsonSchemaValidators.js";

export type ValidationAction = "warn" | "error";
export type ValidationLevel = "strict" | "moderate" | "off";

export interface ApplyOptions {
  /** Default `warn` — flip to `error` only once logs show zero offenders. */
  action?: ValidationAction;
  /** Default `strict` — validates all inserts + updates; `moderate` would only validate inserts and updates to currently-valid docs. */
  level?: ValidationLevel;
  /** Optional logger (defaults to console for the CLI; dep-injected in the bootstrap). */
  log?: (event: string, details?: Record<string, unknown>) => void;
}

export interface ApplyResult {
  modelName: string;
  collectionName: string;
  ok: boolean;
  action: ValidationAction;
  level: ValidationLevel;
  errorMessage?: string;
}

/**
 * Apply `$jsonSchema` validators to every collection in `MINOR_FIELD_REGISTRY`.
 *
 * Idempotency: `collMod` replaces the validator in place. Calling this twice with
 * the same options is a no-op at the data layer (same validator doc, same
 * action, same level). Calling with different options replaces the previous
 * configuration — intentional, so operators can flip `warn`→`error` without a
 * separate migration.
 */
export async function applyMinorFieldValidators(
  db: Db,
  options: ApplyOptions = {}
): Promise<ApplyResult[]> {
  const action: ValidationAction = options.action ?? "warn";
  const level: ValidationLevel = options.level ?? "strict";
  const log = options.log ?? (() => {});

  const specs = buildAllJsonSchemas();
  const results: ApplyResult[] = [];

  for (const { modelName, jsonSchema } of specs) {
    const model = mongoose.models[modelName];
    if (!model) {
      // Mongoose model not registered — this should never happen in the backend
      // runtime (models are imported side-effect-wise) but guard anyway.
      const msg = `model not registered: ${modelName}`;
      log("db.validators.skip", { modelName, reason: msg });
      results.push({ modelName, collectionName: "", ok: false, action, level, errorMessage: msg });
      continue;
    }
    const collectionName = model.collection.name;

    try {
      // Ensure the collection exists before collMod — createCollection is a
      // no-op when the collection is already there, but throws
      // `NamespaceExists` (48). We swallow that specific code.
      try {
        await db.createCollection(collectionName);
      } catch (err) {
        const code = (err as { code?: number } | undefined)?.code;
        if (code !== 48) throw err;
      }

      await db.command({
        collMod: collectionName,
        validator: { $jsonSchema: jsonSchema },
        validationLevel: level,
        validationAction: action
      });

      log("db.validators.applied", { modelName, collectionName, action, level });
      results.push({ modelName, collectionName, ok: true, action, level });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log("db.validators.failed", { modelName, collectionName, action, level, error: errorMessage });
      results.push({ modelName, collectionName, ok: false, action, level, errorMessage });
    }
  }

  return results;
}

/** Exposed for tests / introspection. */
export const REGISTERED_MODEL_NAMES = MINOR_FIELD_REGISTRY.map((s) => s.modelName);
