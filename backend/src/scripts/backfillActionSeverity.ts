import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/db/connect.js";
import { backfillActionSeverity } from "@/services/invoice/recomputeActionSeverity.js";
import { logger, runWithLogContext } from "@/utils/logger.js";

async function run() {
  await runWithLogContext(randomUUID(), async () => {
    await connectToDatabase();
    const tenantId = process.env.BACKFILL_TENANT_ID?.trim() || undefined;
    const batchSize = process.env.BACKFILL_BATCH_SIZE
      ? Math.max(1, Math.floor(Number(process.env.BACKFILL_BATCH_SIZE)))
      : undefined;

    const result = await backfillActionSeverity({
      tenantId,
      batchSize,
      onBatch: (progress) => {
        logger.info("Backfill progress", { ...progress });
      }
    });

    logger.info("Backfill complete", { ...result, tenantId: tenantId ?? "all" });
    process.exit(0);
  });
}

run().catch((error) => {
  logger.error("Backfill failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
