import mongoose from "mongoose";
import { connectToDatabase, disconnectFromDatabase } from "@/db/connect.js";
import {
  applyMinorFieldValidators,
  ValidationAction,
  ValidationLevel
} from "@/db/applyJsonSchemaValidators.js";
import { logger } from "@/utils/logger.js";

const VALIDATOR_MIGRATION_ID = "minor_field_jsonschema_validators_v1";

function parseAction(argv: string[]): ValidationAction {
  const flag = argv.find((a) => a.startsWith("--action="));
  if (!flag) return ValidationAction.Warn;
  const value = flag.split("=")[1];
  if (value !== ValidationAction.Warn && value !== ValidationAction.Error) {
    throw new Error(
      `invalid --action value: ${value}. Expected '${ValidationAction.Warn}' or '${ValidationAction.Error}'.`
    );
  }
  return value;
}

async function run(): Promise<void> {
  const action = parseAction(process.argv.slice(2));
  await connectToDatabase({ skipBootstrap: true });

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("mongoose connection returned no db handle");
  }

  const results = await applyMinorFieldValidators(db, {
    action,
    level: ValidationLevel.Strict,
    log: (event, details) => logger.info(event, details)
  });

  const failed = results.filter((r) => !r.ok);

  await db.collection("migrations").updateOne(
    { _id: VALIDATOR_MIGRATION_ID } as never,
    {
      $set: {
        _id: VALIDATOR_MIGRATION_ID,
        appliedAt: new Date(),
        action,
        level: ValidationLevel.Strict,
        source: "cli"
      }
    } as never,
    { upsert: true }
  );

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
