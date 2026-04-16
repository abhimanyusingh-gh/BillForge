import type { OcrBlock, OcrPageImage } from "@/core/interfaces/OcrProvider.js";
import type { SinglePassDocumentDefinition, ExtractionSchema } from "@/core/engine/DocumentDefinition.js";
import { DOC_TYPE } from "@/core/engine/DocumentDefinition.js";
import type { ValidationResult } from "@/core/engine/types.js";
import { LLAMA_EXTRACT_INVOICE_SCHEMA } from "@/ai/schemas/invoice/llamaExtractInvoiceSchema.js";
import type {
  InvoiceExtractionData,
  InvoiceFieldKey,
  InvoiceFieldProvenance,
  InvoiceLineItemProvenance,
  ParsedInvoiceData
} from "@/types/invoice.js";
import { validateInvoiceFields } from "@/ai/extractors/invoice/deterministicValidation.js";
import { parseLlamaExtractFields, buildFieldProvenanceFromExtract } from "@/ai/extractors/invoice/adapters/LlamaExtractAdapter.js";
import { normalizeInvoiceFields } from "@/ai/extractors/invoice/normalizeInvoiceFields.js";

export interface InvoiceSlmOutput {
  parsed: ParsedInvoiceData;
  tokens: number;
  issues: string[];
  changedFields: string[];
  fieldConfidence?: Partial<Record<InvoiceFieldKey, number>>;
  fieldProvenance?: Partial<Record<InvoiceFieldKey, InvoiceFieldProvenance>>;
  lineItemProvenance: InvoiceLineItemProvenance[];
  classification?: InvoiceExtractionData["classification"];
}

export class InvoiceDocumentDefinition implements SinglePassDocumentDefinition<InvoiceSlmOutput> {
  readonly docType = DOC_TYPE.INVOICE;
  readonly extractionSchema: ExtractionSchema = LLAMA_EXTRACT_INVOICE_SCHEMA as ExtractionSchema;

  canChunk(): boolean {
    return false;
  }

  buildPrompt(text: string, _blocks: OcrBlock[], _pageImages: OcrPageImage[]): string {
    return text;
  }

  parseOutput(raw: string | Record<string, unknown>): InvoiceSlmOutput {
    if (typeof raw === "string") {
      return this.parseFromVerifierResult(raw);
    }
    return this.parseFromExtractFields(raw);
  }

  private parseFromVerifierResult(rawJson: string): InvoiceSlmOutput {
    let parsedData: ParsedInvoiceData | undefined;
    try {
      parsedData = JSON.parse(rawJson) as ParsedInvoiceData;
    } catch {
      parsedData = undefined;
    }

    if (!parsedData || Object.keys(parsedData).length === 0) {
      return {
        parsed: {},
        tokens: 0,
        issues: ["SLM verification failed. Falling back to OCR heuristics."],
        changedFields: [],
        lineItemProvenance: []
      };
    }

    const normalizedParsed = normalizeInvoiceFields(parsedData);
    const parsed = Object.keys(normalizedParsed).length > 0 ? normalizedParsed : {};

    return {
      parsed,
      tokens: 0,
      issues: [],
      changedFields: [],
      lineItemProvenance: []
    };
  }

  private parseFromExtractFields(fields: Record<string, unknown>): InvoiceSlmOutput {
    const parsed = parseLlamaExtractFields(fields);

    const rawProvenance = fields["__extract_provenance__"];
    const fieldProvenance = buildFieldProvenanceFromExtract(rawProvenance);

    return {
      parsed,
      tokens: 0,
      issues: [],
      changedFields: [],
      lineItemProvenance: [],
      ...(fieldProvenance ? { fieldProvenance } : {})
    };
  }

  validateOutput(output: InvoiceSlmOutput): ValidationResult {
    return validateInvoiceFields({ parsed: output.parsed });
  }
}
