import { useCallback, useMemo } from "react";
import {
  DATATABLE_SORT_DIRECTION,
  type ComboboxOption,
  type DataTableColumn,
  type DataTableSort
} from "@/components/ds";
import { isInvoiceSelectable } from "@/lib/common/selection";
import { buildInvoiceColumns } from "@/features/invoices/invoiceColumns";
import type { Invoice } from "@/types";

interface EditingListCell {
  invoiceId: string;
  field: string;
}

interface UseInvoiceListTableBindingsArgs {
  selectedIds: ReadonlyArray<string>;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  setSortColumn: (col: string) => void;
  setSortDirection: React.Dispatch<React.SetStateAction<"asc" | "desc">>;
  filteredInvoices: ReadonlyArray<Invoice>;
  toggleSelection: (invoice: Invoice) => void;
  removeFromSelection: (ids: string[]) => void;
  editingListCell: EditingListCell | null;
  editListValue: string;
  setEditListValue: React.Dispatch<React.SetStateAction<string>>;
  setEditingListCell: React.Dispatch<React.SetStateAction<EditingListCell | null>>;
  handleSaveListCell: () => Promise<void>;
  setPopupInvoiceId: (id: string | null) => void;
  glCodeEditingInvoiceId: string | null;
  setGlCodeEditingInvoiceId: React.Dispatch<React.SetStateAction<string | null>>;
  tenantGlComboOptions: ReadonlyArray<ComboboxOption<string>>;
  handleTableGlCodeSelect: (invoiceId: string, glCode: string, glName: string) => Promise<void>;
  handleTableGlCodeClear: (invoiceId: string) => Promise<void>;
  ingestingIds: Set<string>;
  canApproveInvoices: boolean;
  canRetryInvoices: boolean;
  canDeleteInvoices: boolean;
  handleApproveSingle: (id: string) => Promise<boolean>;
  handleRetrySingle: (id: string) => Promise<void>;
  handleDeleteSingle: (id: string, fileName: string) => void;
}

interface UseInvoiceListTableBindingsResult {
  selectedRowKeys: ReadonlySet<string>;
  dataTableSort: DataTableSort | null;
  handleDataTableSortChange: (next: DataTableSort | undefined) => void;
  handleSelectionChange: (next: ReadonlySet<string>) => void;
  invoiceColumns: ReadonlyArray<DataTableColumn<Invoice>>;
}

export function useInvoiceListTableBindings({
  selectedIds,
  sortColumn,
  sortDirection,
  setSortColumn,
  setSortDirection,
  filteredInvoices,
  toggleSelection,
  removeFromSelection,
  editingListCell,
  editListValue,
  setEditListValue,
  setEditingListCell,
  handleSaveListCell,
  setPopupInvoiceId,
  glCodeEditingInvoiceId,
  setGlCodeEditingInvoiceId,
  tenantGlComboOptions,
  handleTableGlCodeSelect,
  handleTableGlCodeClear,
  ingestingIds,
  canApproveInvoices,
  canRetryInvoices,
  canDeleteInvoices,
  handleApproveSingle,
  handleRetrySingle,
  handleDeleteSingle
}: UseInvoiceListTableBindingsArgs): UseInvoiceListTableBindingsResult {
  const selectedRowKeys = useMemo<ReadonlySet<string>>(() => new Set(selectedIds), [selectedIds]);

  const dataTableSort = useMemo<DataTableSort | null>(() => {
    if (!sortColumn) return null;
    return {
      id: sortColumn,
      direction:
        sortDirection === "asc" ? DATATABLE_SORT_DIRECTION.ASC : DATATABLE_SORT_DIRECTION.DESC
    };
  }, [sortColumn, sortDirection]);

  const handleDataTableSortChange = useCallback(
    (next: DataTableSort | undefined) => {
      if (!next) return;
      if (sortColumn === next.id) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return;
      }
      setSortColumn(next.id);
      setSortDirection(next.direction === DATATABLE_SORT_DIRECTION.ASC ? "asc" : "desc");
    },
    [sortColumn, setSortColumn, setSortDirection]
  );

  const handleSelectionChange = useCallback(
    (next: ReadonlySet<string>) => {
      const additions: Invoice[] = [];
      const removals: string[] = [];
      for (const invoice of filteredInvoices) {
        const wasSelected = selectedRowKeys.has(invoice._id);
        const isSelected = next.has(invoice._id);
        if (isSelected && !wasSelected && isInvoiceSelectable(invoice)) {
          additions.push(invoice);
        } else if (!isSelected && wasSelected) {
          removals.push(invoice._id);
        }
      }
      for (const invoice of additions) toggleSelection(invoice);
      if (removals.length > 0) removeFromSelection(removals);
    },
    [filteredInvoices, selectedRowKeys, toggleSelection, removeFromSelection]
  );

  const invoiceColumns = useMemo(() => buildInvoiceColumns({
    editingListCell,
    editListValue,
    setEditListValue,
    setEditingListCell,
    handleSaveListCell,
    setPopupInvoiceId,
    glCodeEditingInvoiceId,
    setGlCodeEditingInvoiceId,
    tenantGlComboOptions,
    handleTableGlCodeSelect,
    handleTableGlCodeClear,
    ingestingIds,
    canApproveInvoices,
    canRetryInvoices,
    canDeleteInvoices,
    handleApproveSingle,
    handleRetrySingle,
    handleDeleteSingle
  }), [
    editingListCell,
    editListValue,
    glCodeEditingInvoiceId,
    tenantGlComboOptions,
    ingestingIds,
    canApproveInvoices,
    canRetryInvoices,
    canDeleteInvoices
  ]);

  return { selectedRowKeys, dataTableSort, handleDataTableSortChange, handleSelectionChange, invoiceColumns };
}
