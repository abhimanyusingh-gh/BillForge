# PRD: Line Items, Bank Statement Reconciliation, TCS

> Last updated: 2026-03-30
>
> Features requested: line item extraction, bank statement parsing, auto-reconciliation, TCS configuration

---

## 1. Line Item Extraction

### Problem
Currently BillForge extracts header-level data (vendor, total, GST breakdown). It cannot verify that the total equals sum of line items, and ITC reconciliation requires line-item detail.

### Solution
Extract individual line items from invoices: description, quantity, rate, amount, HSN/SAC code, tax rate per line.

### Data Model
```typescript
ParsedInvoiceData {
  ...existing fields...
  lineItems?: Array<{
    description: string
    hsnSac?: string
    quantity?: number
    rate?: number
    amountMinor: number
    taxRate?: number
    cgstMinor?: number
    sgstMinor?: number
    igstMinor?: number
  }>
}
```

### Cross-Validation
- Sum of `lineItems[].amountMinor` should equal `subtotalMinor`
- Sum of line-item taxes should equal header-level CGST/SGST/IGST
- Mismatch → `LINE_ITEM_TOTAL_MISMATCH` risk signal

### SLM Prompt Addition
Add to the SLM instruction: "Extract line items if present. Each line item: description, quantity, rate, amountMinor (in minor units), hsnSac code, taxRate (percentage)."

---

## 2. TCS Configuration

### Problem
TCS (Tax Collected at Source) is seller-side but affects buyer reconciliation. When a vendor charges TCS on an invoice, the buyer needs to account for it.

### Solution
Tenant admin configures TCS rate (percentage) per vendor or as a default. The system extracts TCS from invoices and includes it in reconciliation math.

### Data Model
```typescript
TenantComplianceConfig {
  ...existing...
  defaultTcsRateBps: number | null  // basis points, e.g., 10 = 0.1%
}

compliance.tcs?: {
  rate: number | null       // basis points
  amountMinor: number | null
  source: "extracted" | "configured" | "manual"
}
```

### Reconciliation Math
```
Net Payable = Total - TDS + TCS
Bank entry should match Net Payable
```

---

## 3. Bank Statement Upload + Parsing

### Problem
After invoices are approved and TDS is deducted, the payment appears in the bank statement. Currently there's no way to verify that the payment was actually made.

### Solution
Allow upload of bank statements (PDF/CSV). Parse them using the same OCR+SLM pipeline but with a **different prompt** that extracts transaction entries instead of invoice fields.

### Flow
```
Upload bank statement → OCR → SLM (transaction prompt) → Extract entries → Store in BankTransaction collection
```

### Data Model
```typescript
BankTransaction {
  tenantId: string
  statementId: string
  date: string
  description: string
  reference?: string
  debitMinor?: number
  creditMinor?: number
  balanceMinor?: number
  matchedInvoiceId?: string
  matchConfidence?: number
  source: "parsed" | "csv-import"
}

BankStatement {
  tenantId: string
  fileName: string
  bankName?: string
  accountNumber?: string (masked)
  periodFrom?: string
  periodTo?: string
  uploadedAt: Date
  transactionCount: number
  matchedCount: number
  unmatchedCount: number
}
```

### SLM Prompt (Bank Statement)
```
You are a bank statement extraction engine.
Extract each transaction row: date, description, reference number, debit amount, credit amount, balance.
All amounts in minor units (paise).
Output format: {"transactions": [{"date":"","description":"","reference":"","debitMinor":0,"creditMinor":0,"balanceMinor":0}]}
```

### CSV Import
For CSV bank statements (most banks offer this), skip OCR — parse CSV directly with column mapping.

---

## 4. Auto-Reconciliation

### Problem
After bank transactions are extracted, someone must manually match each payment to an invoice.

### Solution
Auto-match bank transactions to invoices based on:
1. **Amount match**: `bank.debitMinor === invoice.compliance.tds.netPayableMinor` (within ₹1 tolerance)
2. **Date proximity**: bank transaction date within 7 days of invoice approval date
3. **Reference match**: bank description contains invoice number
4. **Vendor match**: bank description contains vendor name

### Matching Algorithm
```
For each unmatched bank debit transaction:
  1. Find invoices with status APPROVED/EXPORTED where:
     netPayableMinor matches debitMinor (±100 minor units)
  2. Score by:
     - Amount exact match: +50 points
     - Invoice number in description: +30 points
     - Vendor name in description: +20 points
     - Date within 3 days of approval: +10 points
  3. Top match with score > 50 → auto-match
  4. Matches with score 30-50 → suggest (needs review)
  5. Below 30 → unmatched
```

### Auto-Verify
When a bank transaction is matched to an invoice:
- Set `compliance.vendorBank.verifiedByStatement = true`
- Set `compliance.vendorBank.statementTransactionId = transaction._id`
- Add risk signal resolution: `BANK_PAYMENT_VERIFIED` (info)

---

## 5. UI: Bank Statements Tab

### Location
New section in the Connections tab (or its own tab: "Bank Statements")

### Layout
```
┌────────────────────────────────────────────────────────┐
│ Bank Statements                                         │
│                                                         │
│ [Upload Statement]  [Import CSV]                        │
│                                                         │
│ ┌──────────────────────────────────────────────────────┐│
│ │ Statement: HDFC_Mar2026.pdf                          ││
│ │ Period: 2026-03-01 to 2026-03-31                     ││
│ │ Transactions: 47  Matched: 38  Unmatched: 9          ││
│ └──────────────────────────────────────────────────────┘│
│                                                         │
│ Transactions                                            │
│ ┌────┬─────────────┬──────────────┬──────────┬────────┐│
│ │Date│ Description  │ Debit        │ Credit   │ Match  ││
│ ├────┼─────────────┼──────────────┼──────────┼────────┤│
│ │3/15│ NEFT-Sharma  │ ₹1,08,000   │          │ ✓ INV- ││
│ │3/16│ IMPS-Office  │ ₹25,000     │          │ ? Sugg ││
│ │3/17│ ATM Fee      │ ₹200        │          │ — N/A  ││
│ └────┴─────────────┴──────────────┴──────────┴────────┘│
└────────────────────────────────────────────────────────┘
```

### Interactions
- Click matched transaction → opens linked invoice detail
- Click suggested match → shows candidate invoices, confirm/reject
- Click unmatched → search invoices manually

---

## 6. Implementation Phases

### Phase A: Line Items (m24a)
1. Add `lineItems` to SLM prompt + ParsedInvoiceData
2. Parse line items from SLM response
3. Cross-validate subtotal + taxes
4. Display line items in invoice detail panel
5. Include line items in Tally/CSV export

### Phase B: TCS + Bank Statement Parsing (m24b)
1. Add TCS to compliance config + invoice model
2. Bank statement upload endpoint (reuse `/jobs/upload`)
3. Bank statement SLM prompt + parser
4. CSV bank statement import
5. BankTransaction + BankStatement models
6. Bank statements list/detail UI

### Phase C: Auto-Reconciliation (m24c)
1. Matching algorithm
2. Auto-verify on match
3. Reconciliation dashboard (matched/unmatched/suggested)
4. Manual match UI
5. Reconciliation status on invoice detail panel

---

## 7. Impact on Existing Features

| Feature | Change |
|---------|--------|
| SLM prompt | Add lineItems extraction instructions |
| Invoice model | Add `lineItems` array + `compliance.tcs` |
| Tally export | Include line items in voucher (optional) |
| CSV export | Add line item columns |
| Deterministic validation | Line item sum cross-check |
| Risk signals | `LINE_ITEM_TOTAL_MISMATCH`, `BANK_PAYMENT_VERIFIED`, `TCS_EXTRACTED` |
| UI detail panel | Line items table below compliance panel |
| Connections tab | Bank statements section |
