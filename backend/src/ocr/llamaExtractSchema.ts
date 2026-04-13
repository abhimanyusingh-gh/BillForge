export const INVOICE_EXTRACT_SCHEMA = {
  invoice_number: { type: "string", description: "Invoice or bill number" },
  vendor_name: { type: "string", description: "Company or vendor issuing the invoice" },
  invoice_date: { type: "string", description: "Invoice creation date in YYYY-MM-DD format. The document label may say 'Dated', 'Invoice Date', or 'Date' — extract the actual date value (e.g. 2026-02-18), never the label text itself." },
  due_date: { type: "string", description: "Payment due date in YYYY-MM-DD format. The document label may say 'Due Date', 'Payment Due', or 'Due' — extract the actual date value, never the label text." },
  currency: { type: "string", description: "ISO currency code e.g. INR, USD" },
  total_amount: { type: "number", description: "Grand total payable amount (numeric)" },
  subtotal: { type: "number", description: "Pre-tax subtotal" },
  tax_amount: { type: "number", description: "Total tax amount" },
  gstin: { type: "string", description: "GST identification number of the vendor" },
  pan: { type: "string", description: "PAN number of the vendor" },
};
