# Benchmark Corpus (31 invoices)

This corpus was assembled from public invoice samples discovered via web search to stress-test OCR + extraction confidence.

- Total files: 31
- PDF: 11
- PNG: 4
- JPEG: 16

## Sources
- `invoice2data` sample invoices (mixed countries/vendors):
  - https://github.com/invoice-x/invoice2data/tree/master/tests/compare
- `invoice_dataset` invoice JPEG corpus (multiple invoice layout models):
  - https://github.com/mouadhamri/invoice_dataset

Per-file source links are in `sample-invoices/benchmark/SOURCES.csv`.

## Layout
- Ingestion input folder: `sample-invoices/benchmark/inbox`
- Ground-truth (invoice2data): `sample-invoices/benchmark/ground-truth/invoice2data`
- Ground-truth (invoice_dataset XML): `sample-invoices/benchmark/ground-truth/invoice_dataset`

## Run benchmark
From repo root:

```bash
docker compose up -d mongo
OCR_PROVIDER=tesseract \
INGESTION_SOURCES=folder \
FOLDER_SOURCE_PATH="$(pwd)/sample-invoices/benchmark/inbox" \
MONGO_URI="mongodb://127.0.0.1:27017/invoice_processor" \
yarn workspace invoice-processor-backend benchmark:corpus
```

The command prints JSON with status distribution, confidence summary, low-confidence samples, and invoice2data amount-mapping accuracy.
