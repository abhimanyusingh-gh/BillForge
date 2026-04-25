import mongoose from "mongoose";
import { buildAllJsonSchemas, MINOR_FIELD_REGISTRY } from "@/db/jsonSchemaValidators.js";

type Db = mongoose.mongo.Db;

export const ValidationAction = {
  Warn: "warn",
  Error: "error"
} as const;
export type ValidationAction = (typeof ValidationAction)[keyof typeof ValidationAction];

export const ValidationLevel = {
  Strict: "strict",
  Moderate: "moderate",
  Off: "off"
} as const;
export type ValidationLevel = (typeof ValidationLevel)[keyof typeof ValidationLevel];

const NAMESPACE_EXISTS_CODE = 48;

interface ApplyOptions {
  action?: ValidationAction;
  level?: ValidationLevel;
  log?: (event: string, details?: Record<string, unknown>) => void;
}

interface ApplyResult {
  modelName: string;
  collectionName: string;
  ok: boolean;
  action: ValidationAction;
  level: ValidationLevel;
  errorMessage?: string;
}

export async function applyMinorFieldValidators(
  db: Db,
  options: ApplyOptions = {}
): Promise<ApplyResult[]> {
  const action: ValidationAction = options.action ?? ValidationAction.Warn;
  const level: ValidationLevel = options.level ?? ValidationLevel.Strict;
  const log = options.log ?? (() => {});

  const specs = buildAllJsonSchemas();
  const results: ApplyResult[] = [];

  for (const { modelName, jsonSchema } of specs) {
    const model = mongoose.models[modelName];
    if (!model) {
      const msg = `model not registered: ${modelName}`;
      log("db.validators.skip", { modelName, reason: msg });
      results.push({ modelName, collectionName: "", ok: false, action, level, errorMessage: msg });
      continue;
    }
    const collectionName = model.collection.name;

    try {
      try {
        await db.createCollection(collectionName);
      } catch (err) {
        const code = (err as { code?: number } | undefined)?.code;
        if (code !== NAMESPACE_EXISTS_CODE) throw err;
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

export const REGISTERED_MODEL_NAMES = MINOR_FIELD_REGISTRY.map((s) => s.modelName);
