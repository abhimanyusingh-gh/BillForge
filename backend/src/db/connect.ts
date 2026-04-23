import mongoose from "mongoose";
import { loadRuntimeManifest } from "@/core/runtimeManifest.js";
import { logger } from "@/utils/logger.js";
import { seedDefaultGlCodes } from "@/services/compliance/seedGlCodes.js";
import { TenantModel } from "@/models/core/Tenant.js";
import { GlCodeMasterModel } from "@/models/compliance/GlCodeMaster.js";
import { applyMinorFieldValidators } from "@/db/applyJsonSchemaValidators.js";
// BE-0: Ensure every model with `*Minor` fields is registered before the
// validator migration runs (see `jsonSchemaValidators.ts` registry).
import "@/models/invoice/Invoice.js";
import "@/models/bank/BankAccount.js";
import "@/models/bank/BankTransaction.js";
import "@/models/core/TenantUserRole.js";
import "@/models/integration/TenantComplianceConfig.js";
import "@/models/compliance/TdsRateTable.js";

let connectionPromise: Promise<void> | null = null;

export async function connectToDatabase() {
  if (connectionPromise) return connectionPromise;
  connectionPromise = doConnect();
  return connectionPromise;
}

async function doConnect() {
  const runtimeManifest = loadRuntimeManifest();
  await mongoose.connect(runtimeManifest.database.uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    const db = mongoose.connection.db;
    if (db) {
      const migrations = db.collection("migrations");
      const migrationName = "cleanup_gmailMessageId_v1";
      const already = await migrations.findOne({ _id: migrationName } as never);
      if (!already) {
        const col = db.collection("invoices");
        const cleanResult = await col.updateMany(
          { gmailMessageId: null },
          { $unset: { gmailMessageId: "" } }
        );
        if (cleanResult.modifiedCount > 0) {
          logger.info("db.migration.gmailMessageId.cleanup", { modified: cleanResult.modifiedCount });
        }
        try {
          await col.dropIndex("tenantId_1_gmailMessageId_1");
          logger.info("db.migration.gmailMessageId.index.dropped");
        } catch {
        }
        await mongoose.model("Invoice").syncIndexes();
        await migrations.insertOne({ _id: migrationName, appliedAt: new Date() } as never);
        logger.info("db.migration.recorded", { name: migrationName });
      }
    }
  } catch (err) {
    logger.warn("db.migration.gmailMessageId.failed", {
      error: err instanceof Error ? err.message : String(err)
    });
  }

  try {
    const db = mongoose.connection.db;
    if (db) {
      const migrations = db.collection("migrations");
      const glMigrationName = "seed_default_gl_codes_v1";
      const alreadyRan = await migrations.findOne({ _id: glMigrationName } as never);
      if (!alreadyRan) {
        const tenants = await TenantModel.find({}, { _id: 1 }).lean();
        let totalCreated = 0;
        let totalSkipped = 0;
        for (const tenant of tenants) {
          const tenantId = String(tenant._id);
          const existingCount = await GlCodeMasterModel.countDocuments({ tenantId });
          if (existingCount === 0) {
            const result = await seedDefaultGlCodes(tenantId);
            totalCreated += result.created;
            totalSkipped += result.skipped;
          }
        }
        if (totalCreated > 0) {
          logger.info("db.migration.glCodes.seeded", { totalCreated, totalSkipped, tenants: tenants.length });
        }
        await migrations.insertOne({ _id: glMigrationName, appliedAt: new Date() } as never);
        logger.info("db.migration.recorded", { name: glMigrationName });
      }
    }
  } catch (err) {
    logger.warn("db.migration.glCodes.failed", {
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // BE-0: install `$jsonSchema` defence-in-depth validators on every collection
  // with `*Minor` fields (Phase 0.4, implements C-001). Idempotent — `collMod`
  // replaces the previous validator on each run. First rollout uses
  // `validationAction: 'warn'` so any legacy non-integer minor values surface
  // in Mongo logs without rejecting the write; a follow-up PR will flip to
  // `'error'` once logs are clean.
  try {
    const db = mongoose.connection.db;
    if (db) {
      const migrations = db.collection("migrations");
      const validatorMigrationName = "minor_field_jsonschema_validators_v1";
      const previouslyApplied = await migrations.findOne({ _id: validatorMigrationName } as never);
      const results = await applyMinorFieldValidators(db, {
        action: "warn",
        level: "strict",
        log: (event, details) => logger.info(event, details)
      });
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        logger.warn("db.migration.minorValidators.partial", {
          failed: failed.map((r) => ({ modelName: r.modelName, error: r.errorMessage }))
        });
      }
      if (!previouslyApplied) {
        await migrations.insertOne({ _id: validatorMigrationName, appliedAt: new Date() } as never);
        logger.info("db.migration.recorded", { name: validatorMigrationName });
      }
    }
  } catch (err) {
    logger.warn("db.migration.minorValidators.failed", {
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

export async function disconnectFromDatabase() {
  if (!connectionPromise) {
    return;
  }
  await mongoose.disconnect();
  connectionPromise = null;
}
