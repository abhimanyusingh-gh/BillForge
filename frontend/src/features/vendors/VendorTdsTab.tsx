import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/common/EmptyState";
import {
  TDS_LIABILITY_QUERY_KEY,
  fetchTdsLiabilityReport,
  type TdsLiabilityReport,
  type TdsLiabilityVendorBucket
} from "@/api/reports";
import { determineFY, fyOptions } from "@/features/reports/fiscalYear";
import { formatMinorAmountWithCurrency } from "@/lib/common/currency";

interface VendorTdsTabProps {
  vendorFingerprint: string;
}

const FY_OPTION_COUNT = 5;

export function VendorTdsTab({ vendorFingerprint }: VendorTdsTabProps) {
  const currentFy = useMemo(() => determineFY(new Date()), []);
  const [fy, setFy] = useState<string>(currentFy);
  const fyChoices = useMemo(() => fyOptions(new Date(), FY_OPTION_COUNT), []);

  const query = useQuery<TdsLiabilityReport>({
    queryKey: [TDS_LIABILITY_QUERY_KEY, "vendor-detail", fy, vendorFingerprint],
    queryFn: () => fetchTdsLiabilityReport({ fy, vendorFingerprint }),
    staleTime: 0
  });

  return (
    <section className="section" data-testid="vendor-tds-tab">
      <div className="page-tools">
        <label className="sub">
          Financial year
          <select
            className="vendors-filter-select"
            value={fy}
            onChange={(event) => setFy(event.target.value)}
            data-testid="vendor-tds-fy-select"
          >
            {fyChoices.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      {query.isPending ? (
        <div
          className="panel-state"
          role="status"
          aria-busy="true"
          data-testid="vendor-tds-loading"
        >
          Loading TDS ledger…
        </div>
      ) : query.isError ? (
        <div className="panel-state" data-testid="vendor-tds-error">
          <EmptyState
            icon="error"
            heading="Couldn't load TDS ledger"
            description="The server didn't respond. Try again."
            action={
              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={() => void query.refetch()}
                data-testid="vendor-tds-error-retry"
              >
                Retry
              </button>
            }
          />
        </div>
      ) : query.data && query.data.byVendor.length > 0 ? (
        <VendorTdsLedgerTable
          fy={fy}
          buckets={query.data.byVendor}
        />
      ) : (
        <div className="panel-state" data-testid="vendor-tds-empty">
          <EmptyState
            icon="receipt_long"
            heading="No TDS deductions in this FY"
            description="TDS rows appear here once an invoice for this vendor crosses the section threshold."
          />
        </div>
      )}
    </section>
  );
}

interface VendorTdsLedgerTableProps {
  fy: string;
  buckets: TdsLiabilityVendorBucket[];
}

function VendorTdsLedgerTable({ fy, buckets }: VendorTdsLedgerTableProps) {
  return (
    <div className="table-wrap" data-testid="vendor-tds-table">
      <table className="lbtable">
        <thead>
          <tr>
            <th>Section</th>
            <th className="num-cell">Cumulative base</th>
            <th className="num-cell">Cumulative TDS</th>
            <th className="num-cell">Invoices</th>
            <th>Threshold</th>
            <th>Drill-down</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.section} data-testid="vendor-tds-row">
              <td className="lb-mono">{bucket.section}</td>
              <td className="num-cell">
                {formatMinorAmountWithCurrency(bucket.cumulativeBaseMinor, "INR")}
              </td>
              <td className="num-cell">
                {formatMinorAmountWithCurrency(bucket.cumulativeTdsMinor, "INR")}
              </td>
              <td className="num-cell">{bucket.invoiceCount}</td>
              <td>
                {bucket.thresholdCrossedAt ? "Crossed" : "Below"}
              </td>
              <td>
                <a
                  href={`#/reports/tds?fy=${encodeURIComponent(fy)}&section=${encodeURIComponent(bucket.section)}`}
                  data-testid="vendor-tds-drilldown-link"
                >
                  View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
