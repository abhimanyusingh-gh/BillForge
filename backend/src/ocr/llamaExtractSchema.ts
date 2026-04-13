export const INVOICE_EXTRACT_SCHEMA = {
  invoice_number: { type: "string", description: "Invoice or bill number" },
  vendor_name: { type: "string", description: "Company or vendor issuing the invoice" },
  invoice_date: { type: "string", description: "Invoice date (YYYY-MM-DD)" },
  due_date: { type: "string", description: "Payment due date (YYYY-MM-DD)" },
  currency: { type: "string", description: "ISO currency code e.g. INR, USD" },
  total_amount: { type: "number", description: "Grand total payable amount (numeric)" },
  subtotal: { type: "number", description: "Pre-tax subtotal" },
  tax_amount: { type: "number", description: "Total tax amount" },
  gstin: { type: "string", description: "GST identification number of the vendor" },
  pan: { type: "string", description: "PAN number of the vendor" },
};
