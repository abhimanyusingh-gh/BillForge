import { Types } from "mongoose";
import { InvoiceModel } from "@/models/invoice/Invoice.js";
import { computeActionSeverityFields, type ClassifierInput } from "@/services/invoice/actionClassifier.js";

interface BackfillProgress {
  scanned: number;
  updated: number;
}

interface BackfillOptions {
  batchSize?: number;
  tenantId?: string;
  onBatch?: (progress: BackfillProgress) => void;
}

const DEFAULT_BATCH_SIZE = 500;

export async function backfillActionSeverity(options: BackfillOptions = {}): Promise<BackfillProgress> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const filter: Record<string, unknown> = {};
  if (options.tenantId) filter.tenantId = options.tenantId;

  let cursorId: Types.ObjectId | null = null;
  const progress: BackfillProgress = { scanned: 0, updated: 0 };

  while (true) {
    const batchFilter: Record<string, unknown> = { ...filter };
    if (cursorId) batchFilter._id = { $gt: cursorId };

    const docs = await InvoiceModel.find(batchFilter)
      .sort({ _id: 1 })
      .limit(batchSize)
      .select({ status: 1, parsed: 1, export: 1, compliance: 1, actionReason: 1, actionSeverity: 1 })
      .lean();

    if (docs.length === 0) break;

    for (const doc of docs) {
      progress.scanned++;
      const fields = computeActionSeverityFields(doc as ClassifierInput);
      const stale = (doc as { actionReason?: unknown }).actionReason !== fields.actionReason
        || (doc as { actionSeverity?: unknown }).actionSeverity !== fields.actionSeverity;
      if (!stale) continue;
      await InvoiceModel.updateOne(
        { _id: (doc as { _id: Types.ObjectId })._id },
        { $set: { actionReason: fields.actionReason, actionSeverity: fields.actionSeverity } }
      );
      progress.updated++;
    }

    cursorId = (docs[docs.length - 1] as { _id: Types.ObjectId })._id;
    options.onBatch?.({ ...progress });

    if (docs.length < batchSize) break;
  }

  return progress;
}
