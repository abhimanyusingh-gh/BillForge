import { useMemo, useState } from "react";
import { Badge } from "@/components/ds/Badge";
import {
  DataTable,
  DATATABLE_DENSITY,
  DATATABLE_SORT_DIRECTION,
  type DataTableColumn,
  type DataTableSort
} from "@/components/ds";
import { fmtInr } from "@/features/overview/OverviewDashboardUtils";
import type { TdsLiabilityVendorBucket } from "@/api/reports";

const TDS_TABLE_COLUMN = {
  vendor: "vendor",
  section: "section",
  cumulativeBaseMinor: "cumulativeBaseMinor",
  cumulativeTdsMinor: "cumulativeTdsMinor",
  invoiceCount: "invoiceCount",
  threshold: "threshold"
} as const;

type TdsTableColumnId = (typeof TDS_TABLE_COLUMN)[keyof typeof TDS_TABLE_COLUMN];

interface TdsLiabilityTableProps {
  rows: TdsLiabilityVendorBucket[];
  isFiltered: boolean;
  onClearFilters?: () => void;
  onSelectVendor?: (vendorFingerprint: string) => void;
}

function compareRows(
  a: TdsLiabilityVendorBucket,
  b: TdsLiabilityVendorBucket,
  sort: DataTableSort
): number {
  const direction = sort.direction === DATATABLE_SORT_DIRECTION.ASC ? 1 : -1;
  switch (sort.id as TdsTableColumnId) {
    case TDS_TABLE_COLUMN.vendor:
      return a.vendorFingerprint.localeCompare(b.vendorFingerprint) * direction;
    case TDS_TABLE_COLUMN.section:
      return a.section.localeCompare(b.section) * direction;
    case TDS_TABLE_COLUMN.cumulativeBaseMinor:
      return (a.cumulativeBaseMinor - b.cumulativeBaseMinor) * direction;
    case TDS_TABLE_COLUMN.cumulativeTdsMinor:
      return (a.cumulativeTdsMinor - b.cumulativeTdsMinor) * direction;
    case TDS_TABLE_COLUMN.invoiceCount:
      return (a.invoiceCount - b.invoiceCount) * direction;
    case TDS_TABLE_COLUMN.threshold: {
      const aCrossed = a.thresholdCrossedAt ? 1 : 0;
      const bCrossed = b.thresholdCrossedAt ? 1 : 0;
      return (aCrossed - bCrossed) * direction;
    }
    default:
      return 0;
  }
}

function buildColumns(
  onSelectVendor?: (vendorFingerprint: string) => void
): ReadonlyArray<DataTableColumn<TdsLiabilityVendorBucket>> {
  return [
    {
      id: TDS_TABLE_COLUMN.vendor,
      header: "Vendor",
      sortable: true,
      render: (row) =>
        onSelectVendor ? (
          <button
            type="button"
            className="tds-vendor-link"
            onClick={() => onSelectVendor(row.vendorFingerprint)}
            data-testid={`tds-vendor-link-${row.vendorFingerprint}`}
          >
            {row.vendorFingerprint}
          </button>
        ) : (
          row.vendorFingerprint
        )
    },
    {
      id: TDS_TABLE_COLUMN.section,
      header: "Section",
      sortable: true,
      width: "6rem",
      render: (row) => <span className="lb-mono tds-section-cell">{row.section}</span>
    },
    {
      id: TDS_TABLE_COLUMN.cumulativeBaseMinor,
      header: "Cumulative Base",
      sortable: true,
      align: "right",
      render: (row) => <span className="lb-num">{fmtInr(row.cumulativeBaseMinor)}</span>
    },
    {
      id: TDS_TABLE_COLUMN.cumulativeTdsMinor,
      header: "Cumulative TDS",
      sortable: true,
      align: "right",
      render: (row) => <span className="lb-num">{fmtInr(row.cumulativeTdsMinor)}</span>
    },
    {
      id: TDS_TABLE_COLUMN.invoiceCount,
      header: "Invoices",
      sortable: true,
      align: "right",
      width: "5rem",
      render: (row) => <span className="lb-num">{row.invoiceCount}</span>
    },
    {
      id: TDS_TABLE_COLUMN.threshold,
      header: "Threshold",
      sortable: true,
      width: "8rem",
      render: (row) => {
        const crossed = row.thresholdCrossedAt !== null;
        return crossed ? (
          <Badge tone="danger" size="sm" icon="warning" title={`Threshold crossed on ${row.thresholdCrossedAt ?? ""}`}>
            Crossed
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm" icon="check" title="Threshold not yet crossed">
            Below
          </Badge>
        );
      }
    }
  ];
}

export function TdsLiabilityTable({ rows, isFiltered, onClearFilters, onSelectVendor }: TdsLiabilityTableProps) {
  const [sort, setSort] = useState<DataTableSort>({
    id: TDS_TABLE_COLUMN.cumulativeTdsMinor,
    direction: DATATABLE_SORT_DIRECTION.DESC
  });

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => compareRows(a, b, sort));
    return copy;
  }, [rows, sort]);

  const columns = useMemo(() => buildColumns(onSelectVendor), [onSelectVendor]);

  if (rows.length === 0) {
    return isFiltered ? (
      <div className="tds-table-empty" data-testid="tds-table-zero-result">
        <p>No vendors match the current filter.</p>
        {onClearFilters ? (
          <button type="button" className="app-button app-button-secondary" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
    ) : (
      <div className="tds-table-empty" data-testid="tds-table-empty">
        <p>No TDS-bearing invoices recorded for this financial year yet.</p>
      </div>
    );
  }

  return (
    <div className="tds-liability-table-wrap" data-testid="tds-liability-table">
      <DataTable<TdsLiabilityVendorBucket>
        columns={columns}
        rows={sortedRows}
        getRowKey={(row) => `${row.vendorFingerprint}::${row.section}`}
        density={DATATABLE_DENSITY.COMPACT}
        sortBy={sort}
        onSortChange={(next) => {
          if (next) setSort(next);
        }}
        getRowAttributes={(row) => ({
          "data-testid": "tds-row",
          ...(row.thresholdCrossedAt !== null ? { "data-threshold-crossed": "true" } : {})
        })}
        caption="TDS liability by vendor and section"
        testId="tds-liability-data-table"
      />
    </div>
  );
}
