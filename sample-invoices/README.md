# Sample Invoices Folder

Drop invoice files in `sample-invoices/inbox/` to test local folder-based ingestion.

Supported file types:
- `.pdf`
- `.jpg`
- `.jpeg`
- `.png`

This folder is used by local development and end-to-end test workflows.

For larger OCR/extraction validation, use:
- `sample-invoices/benchmark/inbox/` (31-file mixed corpus)
- `sample-invoices/benchmark/SOURCES.csv` (per-file source URLs)
