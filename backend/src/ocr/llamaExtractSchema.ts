export const INVOICE_EXTRACT_SCHEMA = {
  invoice_number: { type: "string", description: "The invoice identifier assigned by the supplier/seller. May be labeled 'Invoice No', 'Invoice Number', 'Document No', 'Bill No', or 'Ref No'. Extract only the alphanumeric identifier, not any surrounding labels." },
  vendor_name: { type: "string", description: "The name of the company or individual who ISSUED (supplied/sold) this invoice — the seller or service provider. This is typically in a 'Name of Supplier', 'From', or header section. Do NOT use the buyer, recipient, or 'Bill To' party name." },
  invoice_date: { type: "string", description: "Invoice creation date in YYYY-MM-DD format. May be labeled 'Dated', 'Invoice Date', 'Date', or appear as a column header 'Date' with the value in the adjacent cell. Extract the actual date value (e.g. 2026-03-26), never the label text itself." },
  due_date: { type: "string", description: "Payment due date in YYYY-MM-DD format. The document label may say 'Due Date', 'Payment Due', or 'Due' — extract the actual date value, never the label text." },
  currency: { type: "string", description: "ISO currency code e.g. INR, USD" },
  total_amount: { type: "number", description: "The final grand total amount payable AFTER all taxes are included. Typically labeled 'Total Value Including Tax', 'Grand Total', 'Total Amount', or 'Invoice Total'. This is the largest amount and includes GST/IGST/VAT. Do NOT use the pre-tax subtotal, transaction value, or taxable value." },
  subtotal: { type: "number", description: "The pre-tax subtotal or taxable value before GST/tax is added. May be labeled 'Taxable Value', 'Transaction Value', 'Sub Total', or 'Net Amount'." },
  tax_amount: { type: "number", description: "Total tax amount (sum of all GST components: CGST + SGST + IGST + cess)." },
  gstin: { type: "string", description: "GST identification number of the vendor/supplier (15-character alphanumeric). Look in the supplier/seller section, not the buyer section." },
  pan: { type: "string", description: "PAN number of the vendor/supplier (10-character alphanumeric). Look in the supplier/seller section." },
};
