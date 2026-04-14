import type { ChunkableDocumentDefinition } from "../../core/engine/DocumentDefinition.js";
import { DOC_TYPE } from "../../core/engine/DocumentDefinition.js";
import type { ValidationResult } from "../../core/engine/types.js";
import { BANK_STATEMENT_EXTRACT_SCHEMA, BANK_STATEMENT_CHUNK_SCHEMA } from "./bankStatementExtractSchema.js";

export interface SlmBankStatementOutput {
  bankName?: unknown;
  accountNumber?: unknown;
  accountHolder?: unknown;
  periodFrom?: unknown;
  periodTo?: unknown;
  transactions?: unknown;
}

export class BankStatementDocumentDefinition implements ChunkableDocumentDefinition<SlmBankStatementOutput> {
  readonly docType = DOC_TYPE.BANK_STATEMENT;
  readonly preferNativePdfText = true;
  readonly nativePdfTextMinLength = 100;
  readonly maxChunkChars = 8000;
  readonly chunkingStrategy = "page-based" as const;
  readonly extractionSchema = BANK_STATEMENT_EXTRACT_SCHEMA;
  readonly chunkSchema = BANK_STATEMENT_CHUNK_SCHEMA;

  parseOutput(raw: string | Record<string, unknown>): SlmBankStatementOutput {
    if (typeof raw === "object") {
      return {
        bankName: raw["bank_name"],
        accountNumber: raw["account_number"],
        accountHolder: raw["account_holder"],
        periodFrom: raw["period_from"],
        periodTo: raw["period_to"],
        transactions: Array.isArray(raw["transactions"]) ? raw["transactions"] : []
      };
    }
    return parseSlmJson(raw);
  }

  mergeChunkOutputs(chunks: SlmBankStatementOutput[]): SlmBankStatementOutput {
    if (chunks.length === 0) {
      return { transactions: [] };
    }

    const first = chunks[0];
    const allTransactions: unknown[] = [];

    for (const chunk of chunks) {
      const txns = Array.isArray(chunk.transactions) ? chunk.transactions : [];
      allTransactions.push(...txns);
    }

    return {
      bankName: first.bankName,
      accountNumber: first.accountNumber,
      accountHolder: first.accountHolder,
      periodFrom: first.periodFrom,
      periodTo: first.periodTo,
      transactions: allTransactions
    };
  }

  validateOutput(_output: SlmBankStatementOutput): ValidationResult {
    return { valid: true, issues: [] };
  }
}

function parseSlmJson(text: string): SlmBankStatementOutput {
  const trimmed = text.trim();

  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    return JSON.parse(jsonBlockMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
  }

  return JSON.parse(trimmed);
}
