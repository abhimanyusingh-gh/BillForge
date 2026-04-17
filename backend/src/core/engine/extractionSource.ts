export const EXTRACTION_SOURCE = {
  SLM: "slm",
  SLM_DIRECT: "slm-direct",
  LLAMA_EXTRACT: "llamaextract",
  SLM_CHUNKED: "slm-chunked",
  SLM_GENERIC: "slm-generic",
  SLM_INVOICE_TABLE: "slm-invoice_table",
  SLM_RECEIPT_STATEMENT: "slm-receipt_statement",
} as const;

export type ExtractionSource = (typeof EXTRACTION_SOURCE)[keyof typeof EXTRACTION_SOURCE];
