I now have a comprehensive understanding of the entire Tally integration. Let me compile the full audit report.

---

# LedgerBuddy Tally Integration Audit Report

## 1. Executive Summary

**Integration Health Score: 5 out of 10**

**Justification**: LedgerBuddy has a competent Purchase Voucher generator that correctly handles the XML envelope structure, GST intra-state/inter-state bifurcation, TDS deduction, TCS receivable, and configurable ledger names. The voucher XML it produces will import into Tally Prime for straightforward purchase recording scenarios. However, the integration is narrow in scope -- it addresses only one of the five voucher types needed for a complete accounts payable workflow. Critical structural gaps include the use of `LEDGERENTRIES.LIST` where Tally expects `ALLLEDGERENTRIES.LIST` for most real-world imports, absence of `REFERENCE` and `EFFECTIVEDATE` fields that Tally uses for bill tracking and aging, no master data (ledger/vendor) creation or validation, no `BILLALLOCATIONS.LIST` for credit-term tracking, no Payment Voucher generation, no Debit Note or Journal Voucher support, and no inventory-mode line-item voucher generation. The XML will work with Tally in non-invoice mode for simple two-party entries, but will fail or produce incomplete data for GST return filing, bill-by-bill reconciliation, and payment settlement.

---

## 2. Current Implementation Review

### 2.1 `backend/src/services/export/tallyExporter/xml.ts` (XML Builder)

**What it does correctly:**
- The `<ENVELOPE>` structure is syntactically valid for Tally XML import: `<ENVELOPE>` -> `<HEADER>` + `<BODY>` -> `<DESC>` (with `SVCURRENTCOMPANY`) + `<DATA>` -> `<TALLYMESSAGE>`.
- `TALLYREQUEST` is set to `Import`, `TYPE` to `Data`, `ID` to `Vouchers` -- all correct for voucher import.
- `xmlns:UDF="TallyUDF"` namespace on `TALLYMESSAGE` is present (needed for user-defined fields).
- XML escaping and decoding functions are correct.
- Date formatting (`YYYYMMDD`) matches Tally's date format.
- The response parser correctly reads `CREATED`, `ALTERED`, `ERRORS`, `LASTVCHID`, and `LINEERROR` tags.
- Amount formatting uses the `minorUnitsToMajorString` utility which handles currency-specific decimal places.

**Structural issues:**
1. The voucher uses `LEDGERENTRIES.LIST` instead of `ALLLEDGERENTRIES.LIST`. In Tally Prime/ERP 9, the import data tag for ledger entries inside a voucher is `ALLLEDGERENTRIES.LIST`. The tag `LEDGERENTRIES.LIST` will work in some Tally versions when `ISINVOICE` is set to `No`, but is not the canonical form. For invoice-mode vouchers (where `ISINVOICE` is `Yes`), the correct tag is `ALLLEDGERENTRIES.LIST`.
2. `ISINVOICE` is hardcoded to `No` (line 116 in xml.ts). For proper GST invoice tracking, supplier invoice recording, and bill-by-bill reconciliation, this should be `Yes`. When `ISINVOICE` is `No`, Tally treats it as a simple accounting entry without bill tracking -- meaning no aging, no bill settlement via Payment Voucher, and no GST return data.
3. Missing `REFERENCE` tag -- Tally uses `<REFERENCE>` to store the supplier invoice number for bill-by-bill tracking. Without it, payment allocation (matching payments to invoices) is impossible.
4. Missing `EFFECTIVEDATE` -- Tally uses this for the date from which the credit period is calculated.
5. Missing `GUID` -- Tally uses GUIDs for deduplication on re-import. Without it, re-importing the same XML creates duplicate vouchers.
6. Missing `BILLALLOCATIONS.LIST` inside the party ledger entry. This is required when `ISINVOICE` is `Yes` to track outstanding bills.
7. No `BASICBUYERNAME` or address fields for GST compliance.
8. No `GSTREGISTRATIONTYPE` on the party entry.

### 2.2 `backend/src/services/export/tallyExporter.ts` (Orchestrator)

**What it does correctly:**
- Validates that vendor name is not "Unknown Vendor" or empty.
- Validates that invoice number is not a MongoDB ObjectId hex string.
- Falls back to OCR-derived amounts when parsed amount is missing.
- Handles TDS by reading from `compliance.tds` and overriding `amountMinor` with `netPayableMinor`.
- Handles TCS by reading from `compliance.tcs`.
- Overrides `purchaseLedgerName` with `compliance.glCode.name` when available.
- Posts to Tally with retry (1 retry for network errors).
- Parses Tally's import response and reports per-invoice success/failure.

**Issues:**
1. Invoices are sent one-at-a-time in `exportInvoices()` (the loop at line 70 sends each invoice as its own HTTP POST). The batch `buildTallyBatchImportXml` is only used for file generation, not for the live export path. This means N invoices = N HTTP requests, which is slow and does not take advantage of Tally's batch import.
2. The `buildVoucherInput` function reads `compliance` by casting to `unknown` then to a manual type. This is fragile and bypasses TypeScript's type system.
3. When TDS is present, `input.amountMinor` is overwritten to `netPayableMinor` (line 297). This is correct for the party ledger amount (what you owe the vendor), but the purchase ledger entry still uses the full invoice amount. The accounting entry is:
   - Dr. Purchase: full amount (correct)
   - Cr. Vendor: net payable (correct)
   - Cr. TDS Payable: TDS amount (correct)
   This balances correctly. Good.
4. When TCS is present, TCS is added to the party total (line 107): `partyTotalMinor = amountMinor + tcsAmountMinor`. The entries are:
   - Cr. Vendor: invoice + TCS (correct -- you owe more because of TCS collected by vendor)
   - Dr. Purchase: invoice amount (correct)
   - Dr. TCS Receivable: TCS amount (correct)
   This balances correctly. Good.

### 2.3 `backend/src/services/export/tallyExporter/amountResolution.ts`

Sound implementation. Falls back from parsed amount to OCR-extracted amount. Uses `normalizeMinorUnits` (truncates to integer) and `isPositiveMinorUnits` for validation.

### 2.4 `backend/src/services/export/exportService.ts`

**What it does correctly:**
- Queries only `APPROVED` invoices for export.
- Creates `ExportBatch` records for audit trail.
- Updates invoice status to `EXPORTED` on success.
- For file generation, stores the XML file in S3/MinIO and marks invoices as exported.
- Uses `bulkWrite` for efficient status updates in the file generation path.
- Export history with pagination.

**Issues:**
1. The `select({ ocrText: 0 })` projection on line 44 excludes `ocrText` from the query result. But `resolveInvoiceTotalAmountMinor` in the exporter uses `invoice.ocrText` as a fallback. This means the OCR fallback path in the live export flow will always receive `undefined` for `ocrText`, making it unreachable. The file generation path at line 142 has the same issue.

### 2.5 `backend/src/services/export/tenantExportConfigResolver.ts`

Clean 3-tier fallback: tenant config -> system defaults -> environment variables. Works for all configurable ledger names.

### 2.6 `backend/src/models/integration/TenantExportConfig.ts`

Straightforward Mongoose model. Stores per-tenant Tally ledger name overrides. No issues.

### 2.7 `backend/src/routes/export/export.ts`

Clean REST API. Four endpoints: POST export (live), POST download (file), GET history, GET download by batch ID. Proper auth and capability checks.

### 2.8 `backend/src/types/invoice.ts`

Rich type system with GST breakdown, line items with HSN/SAC, TDS/TCS compliance data, GL codes, cost centers, and risk signals. The data model supports more than the Tally exporter currently uses.

---

## 3. Tally XML Contract Reference

### 3.A Envelope Structure

Every Tally XML import request uses this structure:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>        <!-- or "All Masters" for master data -->
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>Company Name</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <!-- VOUCHER or LEDGER or GROUP elements here -->
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

For master data, `<ID>` is set to `All Masters` instead of `Vouchers`.

### 3.B Purchase Voucher (Correct Full Structure)

This is what LedgerBuddy should generate for a purchase invoice with GST and TDS:

```xml
<VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Accounting Voucher View">
  <DATE>20260315</DATE>
  <EFFECTIVEDATE>20260315</EFFECTIVEDATE>
  <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
  <VOUCHERNUMBER>INV-2026-001</VOUCHERNUMBER>
  <REFERENCE>INV-2026-001</REFERENCE>
  <NARRATION>Purchase from Vendor ABC | LedgerBuddy Ref: 507f1f77bcf86cd799439011</NARRATION>
  <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
  <ISINVOICE>Yes</ISINVOICE>
  <PARTYLEDGERNAME>Vendor ABC Pvt Ltd</PARTYLEDGERNAME>
  <PARTYGSTIN>29ABCDE1234F1Z5</PARTYGSTIN>
  <BASICBUYERNAME>Your Company Name</BASICBUYERNAME>
  <PLACEOFSUPPLY>Karnataka</PLACEOFSUPPLY>
  <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>

  <!-- Party (Creditor) Entry -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Vendor ABC Pvt Ltd</LEDGERNAME>
    <GSTCLASS/>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
    <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
    <AMOUNT>-98000.00</AMOUNT>
    <BILLALLOCATIONS.LIST>
      <NAME>INV-2026-001</NAME>
      <BILLTYPE>New Ref</BILLTYPE>
      <AMOUNT>-98000.00</AMOUNT>
    </BILLALLOCATIONS.LIST>
  </ALLLEDGERENTRIES.LIST>

  <!-- Purchase/Expense Ledger Entry -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Purchase</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>100000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <!-- CGST Input Credit -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Input CGST</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>9000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <!-- SGST Input Credit -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Input SGST</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>9000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <!-- TDS Payable (deducted at source) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>TDS Payable - 194C</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-20000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

Key differences from LedgerBuddy's current output:
- `ALLLEDGERENTRIES.LIST` instead of `LEDGERENTRIES.LIST`
- `ISINVOICE` is `Yes` instead of `No`
- `REFERENCE` tag present (matches `VOUCHERNUMBER` for supplier bill tracking)
- `EFFECTIVEDATE` present
- `BILLALLOCATIONS.LIST` inside the party entry with `BILLTYPE` = `New Ref`
- `PLACEOFSUPPLY` for GST compliance
- `BASICBUYERNAME` for the purchasing entity

### 3.C Payment Voucher

For recording payment against a purchase invoice:

```xml
<VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">
  <DATE>20260401</DATE>
  <EFFECTIVEDATE>20260401</EFFECTIVEDATE>
  <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
  <VOUCHERNUMBER>PAY-2026-001</VOUCHERNUMBER>
  <NARRATION>Payment to Vendor ABC for INV-2026-001</NARRATION>
  <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>

  <!-- Bank Ledger (Credit - money going out) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>HDFC Bank A/c</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-98000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <!-- Vendor Ledger (Debit - settling the liability) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Vendor ABC Pvt Ltd</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>98000.00</AMOUNT>
    <BILLALLOCATIONS.LIST>
      <NAME>INV-2026-001</NAME>
      <BILLTYPE>Agst Ref</BILLTYPE>
      <AMOUNT>98000.00</AMOUNT>
    </BILLALLOCATIONS.LIST>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

Key points:
- `BILLTYPE` is `Agst Ref` (Against Reference) -- this settles the outstanding bill created by the Purchase Voucher.
- The `NAME` in `BILLALLOCATIONS.LIST` must exactly match the `REFERENCE` in the original Purchase Voucher.
- For partial payments, the amount in `BILLALLOCATIONS.LIST` is the partial amount, and multiple payments can reference the same bill.
- Bank ledger has `ISDEEMEDPOSITIVE=Yes` with negative amount (money flowing out of bank).

### 3.D Journal Voucher

For TDS provision, adjustments, and write-offs:

```xml
<VOUCHER VCHTYPE="Journal" ACTION="Create" OBJVIEW="Accounting Voucher View">
  <DATE>20260331</DATE>
  <VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>
  <VOUCHERNUMBER>JV-2026-001</VOUCHERNUMBER>
  <NARRATION>TDS provision adjustment for Q4 FY2025-26</NARRATION>

  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>TDS Payable - 194C</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <AMOUNT>20000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>TDS Receivable</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-20000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

### 3.E Debit Note

For purchase returns or vendor credit notes:

```xml
<VOUCHER VCHTYPE="Debit Note" ACTION="Create" OBJVIEW="Accounting Voucher View">
  <DATE>20260320</DATE>
  <EFFECTIVEDATE>20260320</EFFECTIVEDATE>
  <VOUCHERTYPENAME>Debit Note</VOUCHERTYPENAME>
  <VOUCHERNUMBER>DN-2026-001</VOUCHERNUMBER>
  <REFERENCE>DN-2026-001</REFERENCE>
  <NARRATION>Purchase return against INV-2026-001</NARRATION>
  <ISINVOICE>Yes</ISINVOICE>
  <PARTYLEDGERNAME>Vendor ABC Pvt Ltd</PARTYLEDGERNAME>

  <!-- Vendor (Debit - reducing liability) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Vendor ABC Pvt Ltd</LEDGERNAME>
    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
    <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
    <AMOUNT>11800.00</AMOUNT>
    <BILLALLOCATIONS.LIST>
      <NAME>INV-2026-001</NAME>
      <BILLTYPE>Agst Ref</BILLTYPE>
      <AMOUNT>11800.00</AMOUNT>
    </BILLALLOCATIONS.LIST>
  </ALLLEDGERENTRIES.LIST>

  <!-- Purchase Returns (Credit) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Purchase Returns</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-10000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <!-- Reverse GST -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Input CGST</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-900.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Input SGST</LEDGERNAME>
    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
    <AMOUNT>-900.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

### 3.F Master Data -- Ledger Creation

Before importing vouchers that reference a ledger, that ledger must exist in Tally. The XML for creating a ledger:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>All Masters</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>Company Name</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="Vendor ABC Pvt Ltd" ACTION="Create">
          <NAME>Vendor ABC Pvt Ltd</NAME>
          <PARENT>Sundry Creditors</PARENT>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <OPENINGBALANCE>0</OPENINGBALANCE>
          <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
          <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
          <GSTIN>29ABCDE1234F1Z5</GSTIN>
          <LEDSTATENAME>Karnataka</LEDSTATENAME>
          <PANIT>ABCDE1234F</PANIT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <AFFECTSSTOCK>No</AFFECTSSTOCK>
        </LEDGER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

Key attributes:
- `PARENT` determines the ledger group: `Sundry Creditors` for vendors, `Purchase Accounts` for purchase ledgers, `Duties & Taxes` for GST/TDS ledgers, `Bank Accounts` for bank ledgers.
- `ISBILLWISEON=Yes` enables bill-by-bill tracking on the ledger.
- `GSTREGISTRATIONTYPE` can be `Regular`, `Composition`, `Unregistered`, `Consumer`.
- `LEDSTATENAME` is the state name for GST place-of-supply determination.

### 3.G GST-Specific Structures

**Tally GST Ledger Naming Convention**: Tally uses duty ledgers under the parent group `Duties & Taxes`. Common names:
- `Input CGST` (parent: `Duties & Taxes`, type of duty: `GST`, tax type: `Central Tax`)
- `Input SGST` (parent: `Duties & Taxes`, type of duty: `GST`, tax type: `State Tax`)
- `Input IGST` (parent: `Duties & Taxes`, type of duty: `GST`, tax type: `Integrated Tax`)
- `Cess` (parent: `Duties & Taxes`, type of duty: `GST`, tax type: `Cess`)

**HSN/SAC in Vouchers**: When using inventory allocation mode (`ALLINVENTORYENTRIES.LIST`), each stock item can carry `HSNCODE` or `SERVICETAXDETAILS.LIST` with SAC. LedgerBuddy extracts HSN/SAC per line item but the current exporter does not use this data at all.

**Reverse Charge Mechanism (RCM)**: For unregistered vendor purchases above threshold, GST is payable by the buyer under RCM. Tally handles this with `<ISAGAINSTFORM>Yes</ISAGAINSTFORM>` and `GSTREGISTRATIONTYPE=Unregistered` on the vendor ledger. LedgerBuddy has no RCM support.

### 3.H TDS-Specific Structures

Tally supports TDS natively with these fields:
- `TDSAPPLICABLE` on the expense ledger entry
- `TDSPAYMENTTYPE` (specifies the payment category)
- `TDSDEDUCTEETYPE` (Company, Individual, HUF, etc.)
- Link to TDS nature of payment (194C, 194J, 194H, etc.)

LedgerBuddy currently maps TDS as a simple separate ledger entry (`TDS Payable - {section}`), which will produce the correct accounting result but will not populate Tally's TDS statutory module. This means the TDS data will not appear in Tally's Form 26Q generation or TDS return filing features.

---

## 4. Gap Analysis

### Gap 1: `LEDGERENTRIES.LIST` vs `ALLLEDGERENTRIES.LIST`

**Current**: LedgerBuddy uses `<LEDGERENTRIES.LIST>` for all ledger entries inside the voucher.

**Required**: Tally's canonical import format uses `<ALLLEDGERENTRIES.LIST>`. While `LEDGERENTRIES.LIST` may work in some configurations (particularly when `ISINVOICE=No`), using `ALLLEDGERENTRIES.LIST` is the universally accepted form that works across Tally ERP 9 and Tally Prime.

**Impact**: Import may succeed in some Tally installations but fail in others, particularly Tally Prime with strict schema validation. Vendors who have customized voucher types may see failures.

**Fix complexity**: Low -- a find-and-replace of the tag name in `xml.ts`.

### Gap 2: `ISINVOICE` Hardcoded to `No`

**Current**: Line 116 in `xml.ts`: `<ISINVOICE>No</ISINVOICE>`.

**Required**: For purchase invoices that need bill tracking, GST filing, and payment settlement, `ISINVOICE` must be `Yes`.

**Impact**: Critical. With `ISINVOICE=No`:
- No bill-by-bill tracking in Tally -- cannot match payments to invoices.
- GST data is not linked to the voucher for GSTR-2A/2B reconciliation.
- Aging analysis in Tally shows nothing.
- Payment vouchers cannot reference the invoice as an outstanding bill.
- Effectively, the imported data is an opaque accounting entry with no audit trail in Tally's statutory compliance modules.

**Fix complexity**: Low to change the flag, but requires Gap 3 (BILLALLOCATIONS) to be implemented simultaneously.

### Gap 3: Missing `BILLALLOCATIONS.LIST`

**Current**: The party ledger entry has no bill allocation data.

**Required**: When `ISINVOICE=Yes`, the party ledger entry must contain a `BILLALLOCATIONS.LIST` with `BILLTYPE=New Ref` and `NAME` equal to the invoice reference. Without this, Tally cannot track the bill as outstanding.

**Impact**: Critical. Without bill allocations, Tally has no concept of "which invoice is this entry for." Payment matching, aging, and outstanding reports all break.

**Fix complexity**: Medium -- requires adding the `BILLALLOCATIONS.LIST` sub-element to the party ledger entry, with the bill name matching the `REFERENCE` tag.

### Gap 4: Missing `REFERENCE` Tag

**Current**: No `<REFERENCE>` tag in the voucher.

**Required**: `<REFERENCE>` should contain the supplier's invoice number (same as `VOUCHERNUMBER` for purchase vouchers). This is the bill name that appears in outstanding reports and is referenced by Payment Vouchers when settling.

**Impact**: High. Without `REFERENCE`, bill-by-bill settlement is impossible even if `ISINVOICE` and `BILLALLOCATIONS` are added.

**Fix complexity**: Low -- add one line: `<REFERENCE>${voucherNumber}</REFERENCE>`.

### Gap 5: Missing `EFFECTIVEDATE`

**Current**: Only `<DATE>` is present.

**Required**: `<EFFECTIVEDATE>` determines credit period start. Usually same as `DATE` for purchase vouices but can differ for dated-ahead invoices.

**Impact**: Medium. Credit period calculations in Tally will default to the voucher date, which is usually correct. But for invoices where the due date implies a different effective date, Tally's aging will be inaccurate.

**Fix complexity**: Low -- add `<EFFECTIVEDATE>${formatTallyDate(input.date)}</EFFECTIVEDATE>`.

### Gap 6: No Master Data / Ledger Pre-creation

**Current**: LedgerBuddy assumes all referenced ledgers already exist in Tally. If a vendor name appears for the first time, the import will fail with "Ledger does not exist."

**Required**: Before importing vouchers, LedgerBuddy should either:
1. Pre-create ledgers for new vendors (using the master data import XML).
2. Query Tally for existing ledgers and create missing ones.
3. Use Tally's `ALLOWCREATION` flag (`<ALLOWCREATION>Yes</ALLOWCREATION>` in `STATICVARIABLES`) to auto-create ledgers on import -- but this creates them under "Primary" without proper classification.

**Impact**: Critical for new vendor scenarios. The first export for any new vendor will fail. The error message from Tally ("Ledger does not exist") is captured correctly by LedgerBuddy's response parser, but the user must then manually create the ledger in Tally and re-export.

**Fix complexity**: High -- requires a new "vendor sync" subsystem.

### Gap 7: No `PLACEOFSUPPLY` for GST

**Current**: GST amounts are exported but `PLACEOFSUPPLY` is not set.

**Required**: Tally uses `PLACEOFSUPPLY` to determine whether a transaction is inter-state (IGST) or intra-state (CGST+SGST). Without it, Tally may not correctly classify the GST for return filing.

**Impact**: Medium. The GST amounts will import correctly as ledger entries, but Tally's GST return module may not auto-populate GSTR-2 correctly because it cannot determine the place of supply from the voucher data.

**Fix complexity**: Medium -- requires extracting/mapping the vendor's state from GSTIN (first 2 digits = state code) and adding a state code -> state name lookup.

### Gap 8: No Inventory / Line Item Mode

**Current**: All vouchers use "Accounting Voucher View" with aggregate amounts. Line items extracted from invoices (description, HSN/SAC, quantity, rate) are discarded during export.

**Required**: For detailed purchase tracking and HSN/SAC-level GST reporting, Tally supports `ALLINVENTORYENTRIES.LIST` inside the voucher for line-item detail. This is how the purchase register in Tally shows per-item details.

**Impact**: Medium. The aggregate amounts are correct for accounting, but item-level detail is lost. HSN-wise summary for GSTR-1/2 filing in Tally will not be available. Inventory tracking (if the tenant uses it) is impossible.

**Fix complexity**: High -- requires a complete alternate voucher generation path with `ALLINVENTORYENTRIES.LIST`, stock item creation, and HSN/SAC mapping.

### Gap 9: No Payment Voucher Generation

**Current**: Only Purchase Vouchers are generated. No way to record payments.

**Required**: When an invoice is paid (through bank reconciliation or manual marking), LedgerBuddy should be able to generate a Payment Voucher to record the settlement in Tally.

**Impact**: High for end-to-end workflow. Without Payment Vouchers, the vendor's outstanding balance in Tally never reduces, making the accounts payable subledger useless.

**Fix complexity**: High -- new voucher type builder, bank ledger configuration, bill allocation against existing references.

### Gap 10: No Debit Note or Journal Voucher Support

**Current**: Only Purchase Vouchers.

**Required**: Debit Notes for credit notes from vendors and purchase returns. Journal Vouchers for TDS adjustments, year-end provisions, and reclassification entries.

**Impact**: Medium. For the MVP, purchase-only is acceptable. These become important when LedgerBuddy handles the full invoice lifecycle including disputes and adjustments.

**Fix complexity**: Medium per voucher type -- similar structure to Purchase Voucher with different `VCHTYPE` and reversed signs.

### Gap 11: `ocrText` Excluded from Export Query

**Current**: `exportService.ts` line 44 and line 142 both use `select({ ocrText: 0 })`, excluding OCR text from the query result. But the exporter's `resolveInvoiceTotalAmountMinor` falls back to `invoice.ocrText` when `parsed.totalAmountMinor` is missing.

**Required**: Either include `ocrText` in the query, or remove the OCR fallback path from the exporter (since exports should only happen for approved invoices that should already have validated amounts).

**Impact**: Low in practice (approved invoices should have amounts), but creates a dead code path and misleading error messages if amounts are missing.

**Fix complexity**: Low -- either remove `select({ ocrText: 0 })` or remove the OCR fallback in the exporter.

### Gap 12: No GUID for Deduplication

**Current**: No `GUID` on vouchers.

**Required**: Tally uses GUIDs to identify vouchers for update/deduplication. Without a GUID, re-importing the same XML creates duplicate vouchers in Tally. The `ACTION="Create"` will always create a new voucher.

**Impact**: Medium. If a user accidentally re-exports, duplicate entries appear in Tally. There is no idempotency.

**Fix complexity**: Medium -- generate a deterministic GUID from invoice ID + tenant ID, and use `ACTION="Create"` for first export, `ACTION="Alter"` for re-export.

### Gap 13: No Multi-Currency Support

**Current**: Amounts are formatted using the invoice's currency for decimal places, but no Tally currency tags are emitted.

**Required**: For foreign currency invoices, Tally needs `<CURRENCYNAME>` on the voucher and `<FOREIGNCURRENCYNAME>`, `<EXCHANGERATE>`, and `<FOREIGNAMOUNT>` on ledger entries. Without these, all amounts are treated as the company's base currency.

**Impact**: Medium for users with foreign currency invoices. The amounts will import at face value in the base currency, which is incorrect for multi-currency accounting.

**Fix complexity**: Medium -- requires exchange rate data and additional XML tags.

### Gap 14: TDS Not Using Tally Statutory Module

**Current**: TDS is recorded as a simple ledger entry (Dr/Cr to "TDS Payable - {section}").

**Required**: For Tally's TDS statutory reporting to work (Form 26Q, TDS returns), the voucher should use Tally's built-in TDS structure with `TDSAPPLICABLE`, `TDSPAYMENTTYPE`, `TDSDEDUCTEETYPE` on the expense ledger entry.

**Impact**: Medium. The accounting entry is correct, but Tally's TDS compliance module will not auto-generate TDS returns from these vouchers. The user would need to manually enter TDS details in Tally.

**Fix complexity**: High -- requires understanding the tenant's TDS deductee type, mapping LedgerBuddy's TDS sections to Tally's nature-of-payment categories, and adding statutory fields.

---

## 5. Vendor Sync Specification

### 5.1 Fetch Vendors from Tally (Export Request)

To list all ledgers under "Sundry Creditors" (vendors):

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sundry Creditors Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>Company Name</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sundry Creditors Ledgers" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FILTER>IsSundryCr</FILTER>
            <FETCH>NAME, PARENT, OPENINGBALANCE, GSTIN, LEDSTATENAME, PANIT, CLOSINGBALANCE</FETCH>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="IsSundryCr">
            $Parent = "Sundry Creditors"
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
    <DATA/>
  </BODY>
</ENVELOPE>
```

This uses Tally's TDL (Tally Definition Language) collection mechanism to fetch filtered ledger data. The response will contain:

```xml
<ENVELOPE>
  <BODY>
    <COLLECTION>
      <LEDGER>
        <NAME>Vendor ABC Pvt Ltd</NAME>
        <PARENT>Sundry Creditors</PARENT>
        <OPENINGBALANCE>0</OPENINGBALANCE>
        <GSTIN>29ABCDE1234F1Z5</GSTIN>
        <LEDSTATENAME>Karnataka</LEDSTATENAME>
        <PANIT>ABCDE1234F</PANIT>
        <CLOSINGBALANCE>-98000.00</CLOSINGBALANCE>
      </LEDGER>
      <!-- More ledgers... -->
    </COLLECTION>
  </BODY>
</ENVELOPE>
```

### 5.2 Create Vendor in Tally

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>All Masters</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>Company Name</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="Vendor Name" ACTION="Create">
          <NAME>Vendor Name</NAME>
          <PARENT>Sundry Creditors</PARENT>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <OPENINGBALANCE>0</OPENINGBALANCE>
          <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
          <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
          <GSTIN>29ABCDE1234F1Z5</GSTIN>
          <LEDSTATENAME>Karnataka</LEDSTATENAME>
          <PANIT>ABCDE1234F</PANIT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <AFFECTSSTOCK>No</AFFECTSSTOCK>
          <MAILINGNAME>Vendor Name</MAILINGNAME>
          <ADDRESS.LIST>
            <ADDRESS>123 Business Street</ADDRESS>
            <ADDRESS>Bangalore, Karnataka 560001</ADDRESS>
          </ADDRESS.LIST>
        </LEDGER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

### 5.3 Detect Vendor Existence Before Export

Strategy: Before exporting a batch of invoices, collect all unique vendor names. Send a Tally export request to fetch all Sundry Creditor ledgers. Compare names. For any vendor not found in Tally, either:

1. **Auto-create** the ledger using the import XML above (populated with GSTIN, PAN, state from the invoice data).
2. **Report to user** that the vendor does not exist and export will fail for those invoices.

The recommended approach is option 1 with a configuration flag (`autoCreateVendors: boolean`) on `TenantExportConfig`.

### 5.4 Conflict Resolution

When a vendor exists in Tally with different data (e.g., different GSTIN):
- **Do not overwrite** Tally's master data silently.
- Log a warning and include it in the export result.
- Optionally: use `ACTION="Alter"` with a user confirmation step.
- The vendor name in LedgerBuddy (extracted from the invoice) may not exactly match the ledger name in Tally. A fuzzy matching strategy (normalized case, trimmed whitespace, common abbreviations like "Pvt" vs "Private") should be used.

---

## 6. Payment Voucher Specification

### 6.1 Data Requirements

To generate a Payment Voucher, LedgerBuddy needs:
- **Bank ledger name**: configurable per tenant (e.g., "HDFC Bank A/c", "SBI Current A/c").
- **Invoice reference**: the `REFERENCE` value from the original Purchase Voucher (same as invoice number).
- **Payment amount**: may be full or partial.
- **Payment date**: from bank statement reconciliation or manual entry.
- **Payment mode**: cheque, NEFT, RTGS, UPI (for narration).
- **Transaction reference**: UTR number or cheque number.

### 6.2 Configuration Model Changes

Add to `TenantExportConfig`:
```
tallyBankLedger: String     // e.g., "HDFC Bank A/c"
tallyPaymentVoucherType: String  // defaults to "Payment"
```

Add to `env.ts`:
```
TALLY_BANK_LEDGER: z.string().default("Bank Account")
```

### 6.3 XML Generation

The Payment Voucher XML structure is documented in section 3.C above. Key considerations:
- `BILLALLOCATIONS.LIST` with `BILLTYPE=Agst Ref` and `NAME` matching the original invoice's `REFERENCE`.
- For partial payments, only the partial amount appears in `BILLALLOCATIONS.LIST`.
- For payments covering multiple invoices, multiple `BILLALLOCATIONS.LIST` entries under the vendor ledger.
- TDS already deducted at purchase time does not appear again in the payment voucher (the payment amount is already net of TDS).

### 6.4 Integration with Bank Reconciliation

LedgerBuddy already has a reconciliation data model (`compliance.reconciliation.bankTransactionId`). When a bank transaction is matched to an invoice:
1. Mark the invoice as reconciled.
2. Queue a Payment Voucher generation (or batch it).
3. Export the Payment Voucher to Tally.
4. Update the invoice's export record with the payment voucher reference.

---

## 7. Recommended Implementation Order

### Phase 1: Fix Critical Import Correctness (Estimated: 1-2 days)

1. **Change `LEDGERENTRIES.LIST` to `ALLLEDGERENTRIES.LIST`** in `xml.ts`. Update all tests.
2. **Change `ISINVOICE` from `No` to `Yes`**.
3. **Add `REFERENCE` tag** = voucherNumber.
4. **Add `EFFECTIVEDATE` tag** = same as DATE.
5. **Add `BILLALLOCATIONS.LIST`** inside the party ledger entry with `BILLTYPE=New Ref` and bill name = voucherNumber.

These five changes make the Purchase Voucher complete for bill-tracking in Tally. After this phase, imported vouchers will appear in Tally's outstanding reports, aging analysis, and can be settled by Payment Vouchers (created manually in Tally for now).

Files to modify:
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/export/tallyExporter/xml.ts`
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/export/tallyExporter.test.ts`

### Phase 2: Vendor Pre-validation and Auto-creation (Estimated: 3-5 days)

1. Add a Tally client service (`TallyClient`) that can send export/import requests to Tally's HTTP endpoint.
2. Implement vendor ledger fetch (TDL collection query).
3. Implement vendor ledger creation (master data import).
4. Add `autoCreateVendors` flag to `TenantExportConfig`.
5. Before voucher export, check vendor existence and auto-create if enabled.
6. Add GST ledger and TDS ledger pre-creation if they do not exist.

### Phase 3: GST Compliance Enhancement (Estimated: 2-3 days)

1. Add `PLACEOFSUPPLY` to the voucher (derived from vendor GSTIN state code).
2. Add a state code -> state name lookup table.
3. Add `GSTREGISTRATIONTYPE` to auto-created vendor ledgers.
4. Add `BASICBUYERNAME` from company config.

### Phase 4: Payment Voucher Generation (Estimated: 3-5 days)

1. Add bank ledger configuration to `TenantExportConfig`.
2. Implement `buildTallyPaymentVoucherPayload` in `xml.ts`.
3. Add payment export trigger (manual or from bank reconciliation match).
4. Add Payment Voucher export route.
5. Track payment export status on the invoice model.

### Phase 5: Deduplication and Re-export Safety (Estimated: 1-2 days)

1. Generate deterministic GUIDs for vouchers.
2. Track export status per voucher (first export vs re-export).
3. Use `ACTION="Alter"` for re-exports with GUID matching.

### Phase 6: Advanced Features (Estimated: 5-10 days)

1. Line-item / inventory allocation mode with HSN/SAC.
2. Tally statutory TDS integration (TDS deductee type, nature of payment).
3. Multi-currency support.
4. Journal Voucher and Debit Note generation.
5. Batch import optimization (send all vouchers in one HTTP request in the live export path).

---

### Critical Files for Implementation

- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/export/tallyExporter/xml.ts` - Core XML builder that needs ALLLEDGERENTRIES, ISINVOICE, REFERENCE, EFFECTIVEDATE, and BILLALLOCATIONS fixes
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/export/tallyExporter.ts` - Orchestrator that needs vendor pre-validation, batch export optimization, and payment voucher support
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/export/tallyExporter.test.ts` - Comprehensive test suite (1270+ lines) that must be updated for every XML structural change
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/models/integration/TenantExportConfig.ts` - Config model that needs bank ledger and autoCreateVendors fields for Phase 2-4
- `/Users/abhimanyusingh/IdeaProjects/Invoice Processor/backend/src/services/export/exportService.ts` - Export orchestrator with the ocrText exclusion bug and where payment voucher export flow needs to be added