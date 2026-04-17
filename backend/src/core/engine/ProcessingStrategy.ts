import type { OcrBlock, OcrPageImage, OcrResult } from "@/core/interfaces/OcrProvider.js";
import type { ProcessingResult, ValidationResult } from "@/core/engine/types.js";
import type { ExtractionSource } from "@/core/engine/extractionSource.js";
import { EXTRACTION_SOURCE } from "@/core/engine/extractionSource.js";
import type { DocumentMimeType } from "@/types/mime.js";

export interface OcrStageResult {
  text: string;
  ocrResult: OcrResult;
  ocrTokens: number;
  ocrConfidence: number | undefined;
}

interface SlmDelegate<TOutput> {
  invokeSingleSlm(text: string, ocrResult: OcrResult, mimeType: DocumentMimeType): Promise<{ output: TOutput; slmTokens: number }>;
  invokeChunkedSlm(
    text: string,
    mimeType: DocumentMimeType,
    processingIssues: string[],
    onProgress?: (event: { type: "progress"; stage: "slm-chunk"; chunk: number; totalChunks: number }) => void,
  ): Promise<{ mergedOutput: TOutput; slmTokens: number }>;
  runValidation(output: TOutput, processingIssues: string[]): ValidationResult;
  parseFieldOutput(fieldsAsRecord: Record<string, unknown>): TOutput;
}

export interface ProcessingStrategy<TOutput> {
  execute(
    ocrStage: OcrStageResult,
    mimeType: DocumentMimeType,
    processingIssues: string[],
    onProgress?: (event: { type: "progress"; stage: "slm-chunk"; chunk: number; totalChunks: number }) => void,
  ): Promise<ProcessingResult<TOutput>>;
}

function buildResult<TOutput>(
  output: TOutput,
  ocrStage: OcrStageResult,
  slmTokens: number,
  strategy: ExtractionSource,
  validationResult: ValidationResult,
  processingIssues: string[],
): ProcessingResult<TOutput> {
  return {
    output,
    ocrText: ocrStage.text,
    ocrBlocks: ocrStage.ocrResult.blocks ?? [],
    ocrPageImages: ocrStage.ocrResult.pageImages ?? [],
    ocrConfidence: ocrStage.ocrConfidence,
    ocrTokens: ocrStage.ocrTokens,
    slmTokens,
    strategy,
    validationResult,
    processingIssues,
  };
}

export class FieldExtractionStrategy<TOutput> implements ProcessingStrategy<TOutput> {
  constructor(private readonly delegate: SlmDelegate<TOutput>) {}

  async execute(
    ocrStage: OcrStageResult,
    _mimeType: DocumentMimeType,
    processingIssues: string[],
  ): Promise<ProcessingResult<TOutput>> {
    const { ocrResult } = ocrStage;
    const fieldsAsRecord: Record<string, unknown> = {};
    const extractProvenance: Record<string, { page?: number; bboxNormalized?: [number, number, number, number]; confidence?: number; parsingConfidence?: number; extractionConfidence?: number }> = {};

    for (const field of ocrResult.fields!) {
      fieldsAsRecord[field.key] = field.value;
      if (field.page !== undefined || field.bboxNormalized !== undefined || field.confidence !== undefined || field.parsingConfidence !== undefined || field.extractionConfidence !== undefined) {
        extractProvenance[field.key] = {
          ...(field.page !== undefined ? { page: field.page } : {}),
          ...(field.bboxNormalized !== undefined ? { bboxNormalized: field.bboxNormalized } : {}),
          ...(field.confidence !== undefined ? { confidence: field.confidence } : {}),
          ...(field.parsingConfidence !== undefined ? { parsingConfidence: field.parsingConfidence } : {}),
          ...(field.extractionConfidence !== undefined ? { extractionConfidence: field.extractionConfidence } : {}),
        };
      }
    }
    if (ocrResult.extractedLineItems && ocrResult.extractedLineItems.length > 0) {
      fieldsAsRecord["line_items"] = ocrResult.extractedLineItems;
    }
    if (Object.keys(extractProvenance).length > 0) {
      fieldsAsRecord["__extract_provenance__"] = extractProvenance;
    }

    const output = this.delegate.parseFieldOutput(fieldsAsRecord);
    const validationResult = this.delegate.runValidation(output, processingIssues);
    return buildResult(output, ocrStage, 0, EXTRACTION_SOURCE.LLAMA_EXTRACT, validationResult, processingIssues);
  }
}

export class SinglePassProcessingStrategy<TOutput> implements ProcessingStrategy<TOutput> {
  constructor(private readonly delegate: SlmDelegate<TOutput>) {}

  async execute(
    ocrStage: OcrStageResult,
    mimeType: DocumentMimeType,
    processingIssues: string[],
  ): Promise<ProcessingResult<TOutput>> {
    const { output, slmTokens } = await this.delegate.invokeSingleSlm(ocrStage.text, ocrStage.ocrResult, mimeType);
    const validationResult = this.delegate.runValidation(output, processingIssues);
    return buildResult(output, ocrStage, slmTokens, EXTRACTION_SOURCE.SLM, validationResult, processingIssues);
  }
}

export class ChunkedProcessingStrategy<TOutput> implements ProcessingStrategy<TOutput> {
  constructor(private readonly delegate: SlmDelegate<TOutput>) {}

  async execute(
    ocrStage: OcrStageResult,
    mimeType: DocumentMimeType,
    processingIssues: string[],
    onProgress?: (event: { type: "progress"; stage: "slm-chunk"; chunk: number; totalChunks: number }) => void,
  ): Promise<ProcessingResult<TOutput>> {
    const { mergedOutput, slmTokens } = await this.delegate.invokeChunkedSlm(ocrStage.text, mimeType, processingIssues, onProgress);
    const validationResult = this.delegate.runValidation(mergedOutput, processingIssues);
    return buildResult(mergedOutput, ocrStage, slmTokens, EXTRACTION_SOURCE.SLM_CHUNKED, validationResult, processingIssues);
  }
}
