import {
  DataTable,
  DATATABLE_ALIGN,
  DATATABLE_DENSITY,
  DATATABLE_SORT_DIRECTION,
  type DataTableColumn,
  type DataTableSort
} from "@/components/ds";
import { VirtualisedRows } from "@/components/virtualised/VirtualisedRows";
import { VendorRow } from "@/features/vendors/VendorRow";
import {
  VENDOR_SORT_DIRECTION,
  VENDOR_SORT_FIELD,
  type VendorListItemSummary,
  type VendorSortDirection,
  type VendorSortField
} from "@/types/vendor";

interface VendorTableProps {
  vendors: VendorListItemSummary[];
  sortField: VendorSortField;
  sortDirection: VendorSortDirection;
  onSortChange: (field: VendorSortField) => void;
  onView: (vendor: VendorListItemSummary) => void;
  onMerge: (vendor: VendorListItemSummary) => void;
  bodyHeightPx: number;
  rowHeightPx: number;
}

const VENDOR_COLUMN_ID = {
  NAME: VENDOR_SORT_FIELD.NAME,
  STATUS: "status",
  LAST_INVOICE: VENDOR_SORT_FIELD.LAST_INVOICE_DATE,
  FYTD_SPEND: VENDOR_SORT_FIELD.FYTD_SPEND,
  FYTD_TDS: VENDOR_SORT_FIELD.FYTD_TDS,
  ACTIONS: "actions"
} as const;

const SORTABLE_VENDOR_COLUMN_IDS: ReadonlySet<string> = new Set([
  VENDOR_COLUMN_ID.NAME,
  VENDOR_COLUMN_ID.LAST_INVOICE,
  VENDOR_COLUMN_ID.FYTD_SPEND,
  VENDOR_COLUMN_ID.FYTD_TDS
]);

const VENDOR_COLUMNS: ReadonlyArray<DataTableColumn<VendorListItemSummary>> = [
  {
    id: VENDOR_COLUMN_ID.NAME,
    header: "Vendor",
    sortable: true,
    width: "var(--vendor-col-name)"
  },
  {
    id: VENDOR_COLUMN_ID.STATUS,
    header: "Status",
    width: "var(--vendor-col-status)"
  },
  {
    id: VENDOR_COLUMN_ID.LAST_INVOICE,
    header: "Last invoice",
    sortable: true,
    align: DATATABLE_ALIGN.RIGHT,
    width: "var(--vendor-col-last-invoice)"
  },
  {
    id: VENDOR_COLUMN_ID.FYTD_SPEND,
    header: "FYTD spend",
    sortable: true,
    align: DATATABLE_ALIGN.RIGHT,
    width: "var(--vendor-col-fytd-spend)"
  },
  {
    id: VENDOR_COLUMN_ID.FYTD_TDS,
    header: "FYTD TDS",
    sortable: true,
    align: DATATABLE_ALIGN.RIGHT,
    width: "var(--vendor-col-fytd-tds)"
  },
  {
    id: VENDOR_COLUMN_ID.ACTIONS,
    header: "Actions",
    align: DATATABLE_ALIGN.RIGHT,
    width: "var(--vendor-col-actions)"
  }
];

function toDataTableSort(
  field: VendorSortField,
  direction: VendorSortDirection
): DataTableSort {
  return {
    id: field,
    direction:
      direction === VENDOR_SORT_DIRECTION.ASC
        ? DATATABLE_SORT_DIRECTION.ASC
        : DATATABLE_SORT_DIRECTION.DESC
  };
}

function isVendorSortField(id: string): id is VendorSortField {
  return SORTABLE_VENDOR_COLUMN_IDS.has(id);
}

export function VendorTable({
  vendors,
  sortField,
  sortDirection,
  onSortChange,
  onView,
  onMerge,
  bodyHeightPx,
  rowHeightPx
}: VendorTableProps) {
  return (
    <DataTable<VendorListItemSummary>
      columns={VENDOR_COLUMNS}
      rows={vendors}
      getRowKey={(vendor) => vendor._id}
      density={DATATABLE_DENSITY.COMPACT}
      stickyHeader
      sortBy={toDataTableSort(sortField, sortDirection)}
      onSortChange={(next) => {
        if (next && isVendorSortField(next.id)) onSortChange(next.id);
      }}
      caption="Vendors"
      testId="vendors-table"
      renderRows={({ rows }) => (
        <VirtualisedRows
          items={rows as VendorListItemSummary[]}
          rowHeight={rowHeightPx}
          height={bodyHeightPx}
          rowKey={(vendor) => vendor._id}
          testId="vendors-virtualised-body"
          renderRow={(vendor) => (
            <VendorRow vendor={vendor} onView={onView} onMerge={onMerge} />
          )}
        />
      )}
    />
  );
}
