import { buildNested } from "@/api/urls/buildNested";

// Tally export endpoints — realm-scoped (mounted under `clientOrgRouter` in
// `app.ts` via `createExportRouter`). Per-realm Tally batch generation +
// per-batch download + per-realm history. The legacy direct-trigger
// `POST /exports/tally` (single-shot generate-and-download) is intentionally
// not exposed here — the FE uses the two-step flow (start -> result blob)
// only.
export const exportUrls = {
  tallyDownloadStart: (): string => buildNested("/exports/tally/download"),
  tallyDownloadResult: (batchId: string): string =>
    buildNested(`/exports/tally/download/${encodeURIComponent(batchId)}`),
  tallyHistory: (): string => buildNested("/exports/tally/history")
};
