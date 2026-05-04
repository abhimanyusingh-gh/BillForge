/**
 * @jest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import {
  DataTable,
  DATATABLE_DENSITY,
  DATATABLE_SORT_CYCLE,
  DATATABLE_SORT_DIRECTION,
  DATATABLE_ALIGN,
  type DataTableColumn,
  type DataTableSort
} from "@/components/ds/DataTable";

interface InvoiceRow {
  id: string;
  number: string;
  amount: number;
}

const ROWS: ReadonlyArray<InvoiceRow> = [
  { id: "i1", number: "INV-001", amount: 100 },
  { id: "i2", number: "INV-002", amount: 250 }
];

const COLUMNS: ReadonlyArray<DataTableColumn<InvoiceRow>> = [
  {
    id: "number",
    header: "Invoice #",
    sortable: true,
    render: (row) => row.number
  },
  {
    id: "amount",
    header: "Amount",
    sortable: true,
    align: DATATABLE_ALIGN.RIGHT,
    width: "8rem",
    render: (row) => row.amount.toString()
  },
  {
    id: "actions",
    header: "Actions",
    render: () => <button type="button">Open</button>
  }
];

function getRowKey(row: InvoiceRow): string {
  return row.id;
}

describe("ds/DataTable", () => {
  it("renders headers and rows with values from columns and rows", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowKey={getRowKey} />);
    expect(screen.getByRole("columnheader", { name: /Invoice #/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Amount/ })).toBeInTheDocument();
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("250")).toBeInTheDocument();
  });

  it("invokes onSortChange with ascending when an unsorted column header is clicked", async () => {
    const user = userEvent.setup();
    const onSortChange = jest.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByTestId("lb-datatable-th-number"));
    expect(onSortChange).toHaveBeenCalledWith({
      id: "number",
      direction: DATATABLE_SORT_DIRECTION.ASC
    });
  });

  it("toggles ascending → descending → ascending when the same column is clicked repeatedly", async () => {
    const user = userEvent.setup();
    const onSortChange = jest.fn();
    const sortBy: DataTableSort = { id: "number", direction: DATATABLE_SORT_DIRECTION.ASC };
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        sortBy={sortBy}
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByTestId("lb-datatable-th-number"));
    expect(onSortChange).toHaveBeenLastCalledWith({
      id: "number",
      direction: DATATABLE_SORT_DIRECTION.DESC
    });
  });

  it("does not render a sort button for non-sortable columns", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowKey={getRowKey} />);
    expect(screen.queryByTestId("lb-datatable-th-actions")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Actions/ })).toBeInTheDocument();
  });

  it("sets aria-sort=ascending|descending|none on sortable headers based on sortBy", () => {
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        sortBy={{ id: "number", direction: DATATABLE_SORT_DIRECTION.ASC }}
      />
    );
    expect(screen.getByRole("columnheader", { name: /Invoice #/ })).toHaveAttribute(
      "aria-sort",
      "ascending"
    );
    expect(screen.getByRole("columnheader", { name: /Amount/ })).toHaveAttribute(
      "aria-sort",
      "none"
    );
    rerender(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        sortBy={{ id: "amount", direction: DATATABLE_SORT_DIRECTION.DESC }}
      />
    );
    expect(screen.getByRole("columnheader", { name: /Amount/ })).toHaveAttribute(
      "aria-sort",
      "descending"
    );
  });

  it("applies compact density by default and switches to comfortable when requested", () => {
    const { container, rerender } = render(
      <DataTable columns={COLUMNS} rows={ROWS} getRowKey={getRowKey} />
    );
    expect(container.querySelector(".lb-datatable-density-compact")).not.toBeNull();
    rerender(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        density={DATATABLE_DENSITY.COMFORTABLE}
      />
    );
    expect(container.querySelector(".lb-datatable-density-comfortable")).not.toBeNull();
  });

  it("applies the sticky-header class when stickyHeader is true", () => {
    const { container } = render(
      <DataTable columns={COLUMNS} rows={ROWS} getRowKey={getRowKey} stickyHeader />
    );
    expect(container.querySelector(".lb-datatable-sticky")).not.toBeNull();
  });

  it("renders the loading row when loading is true and suppresses data rows", () => {
    render(
      <DataTable columns={COLUMNS} rows={ROWS} getRowKey={getRowKey} loading />
    );
    expect(screen.getByTestId("lb-datatable-loading")).toBeInTheDocument();
    expect(screen.queryByText("INV-001")).not.toBeInTheDocument();
  });

  it("renders the error row with the error text and suppresses data rows", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        error="Network down"
      />
    );
    const cell = screen.getByTestId("lb-datatable-error");
    expect(cell).toHaveTextContent("Network down");
    expect(screen.queryByText("INV-001")).not.toBeInTheDocument();
  });

  it("renders the empty row with custom emptyText when rows is empty", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={[]}
        getRowKey={getRowKey}
        emptyText="No invoices"
      />
    );
    const cell = screen.getByTestId("lb-datatable-empty");
    expect(cell).toHaveTextContent("No invoices");
  });

  it("uses getRowKey to produce stable keys (no React duplicate-key warnings under re-render)", () => {
    const warnSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <DataTable columns={COLUMNS} rows={ROWS} getRowKey={getRowKey} />
    );
    rerender(
      <DataTable columns={COLUMNS} rows={[...ROWS]} getRowKey={getRowKey} />
    );
    const keyWarnings = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes("unique \"key\"")
    );
    expect(keyWarnings).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it("delegates body rendering to the renderRows slot when provided", () => {
    const renderRows = jest.fn(({ rows }: { rows: ReadonlyArray<InvoiceRow> }) => (
      <div data-testid="custom-body">{rows.length} rows</div>
    ));
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        renderRows={renderRows}
      />
    );
    expect(renderRows).toHaveBeenCalled();
    expect(screen.getByTestId("custom-body")).toHaveTextContent("2 rows");
  });

  it("provides a renderRow helper to the renderRows slot that emits a full <tr>", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        renderRows={({ rows, renderRow }) => (
          <table>
            <tbody data-testid="slot-tbody">
              {rows.map((row, idx) => renderRow(row, idx))}
            </tbody>
          </table>
        )}
      />
    );
    const tbody = screen.getByTestId("slot-tbody");
    expect(within(tbody).getAllByTestId("lb-datatable-row")).toHaveLength(2);
    expect(within(tbody).getByText("INV-001")).toBeInTheDocument();
  });

  it("renders an a11y caption (visually hidden) when caption is provided", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        caption="Invoices for FY 2025-26"
      />
    );
    expect(screen.getByText("Invoices for FY 2025-26")).toBeInTheDocument();
  });

  it("clears sort (calls onSortChange with undefined) on the third click when sortCycle is asc-desc-null", async () => {
    const user = userEvent.setup();
    const onSortChange = jest.fn();
    const sortBy: DataTableSort = { id: "number", direction: DATATABLE_SORT_DIRECTION.DESC };
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        sortBy={sortBy}
        sortCycle={DATATABLE_SORT_CYCLE.ASC_DESC_NULL}
        onSortChange={onSortChange}
      />
    );
    await user.click(screen.getByTestId("lb-datatable-th-number"));
    expect(onSortChange).toHaveBeenLastCalledWith(undefined);
  });

  it("renders a single <table> with <thead> and <tbody> when renderRows is not provided (single-table mode)", () => {
    const { container } = render(
      <DataTable columns={COLUMNS} rows={ROWS} getRowKey={getRowKey} />
    );
    const tables = container.querySelectorAll("table");
    expect(tables).toHaveLength(1);
    const table = tables[0]!;
    expect(table.querySelector("thead")).not.toBeNull();
    const tbody = table.querySelector("tbody");
    expect(tbody).not.toBeNull();
    expect(within(tbody!).getAllByTestId("lb-datatable-row")).toHaveLength(2);
    expect(table.querySelector("colgroup")).not.toBeNull();
  });

  it("invokes onRowClick with the clicked row when a row is clicked", async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        onRowClick={onRowClick}
      />
    );
    await user.click(screen.getByText("INV-001"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]![0]).toEqual(ROWS[0]);
  });

  it("applies is-active class only to the row whose key matches activeRowId", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        activeRowId="i2"
      />
    );
    const rows = screen.getAllByTestId("lb-datatable-row");
    expect(rows[0]).not.toHaveClass("is-active");
    expect(rows[1]).toHaveClass("is-active");
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
  });

  it("composes per-row className from getRowClassName with the default row class", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        getRowClassName={(row) => (row.amount > 200 ? "row-exported" : undefined)}
      />
    );
    const rows = screen.getAllByTestId("lb-datatable-row");
    expect(rows[0]).toHaveClass("lb-datatable-row");
    expect(rows[0]).not.toHaveClass("row-exported");
    expect(rows[1]).toHaveClass("lb-datatable-row");
    expect(rows[1]).toHaveClass("row-exported");
  });

  it("applies per-row HTML attributes from getRowAttributes onto the <tr>", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        getRowAttributes={(row) => ({ "data-invoice-id": row.id })}
      />
    );
    const rows = screen.getAllByTestId("lb-datatable-row");
    expect(rows[0]).toHaveAttribute("data-invoice-id", "i1");
    expect(rows[1]).toHaveAttribute("data-invoice-id", "i2");
  });

  it("renders no checkbox column when selectable is false (default)", () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} getRowKey={getRowKey} />);
    expect(screen.queryByTestId("lb-datatable-select-all")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lb-datatable-select-row-i1")).not.toBeInTheDocument();
  });

  it("renders header + per-row checkboxes and emits selection updates when selectable", async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        selectable
        selectedRowIds={new Set<string>()}
        onSelectionChange={onSelectionChange}
      />
    );
    const rowCheckbox = screen.getByTestId("lb-datatable-select-row-i1");
    await user.click(rowCheckbox);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(Array.from(onSelectionChange.mock.calls[0]![0] as Set<string>)).toEqual(["i1"]);
  });

  it("header checkbox shows none/indeterminate/all states based on selection size", () => {
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        selectable
        selectedRowIds={new Set<string>()}
        onSelectionChange={jest.fn()}
      />
    );
    let header = screen.getByTestId("lb-datatable-select-all") as HTMLInputElement;
    expect(header.checked).toBe(false);
    expect(header.indeterminate).toBe(false);

    rerender(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        selectable
        selectedRowIds={new Set<string>(["i1"])}
        onSelectionChange={jest.fn()}
      />
    );
    header = screen.getByTestId("lb-datatable-select-all") as HTMLInputElement;
    expect(header.checked).toBe(false);
    expect(header.indeterminate).toBe(true);

    rerender(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        selectable
        selectedRowIds={new Set<string>(["i1", "i2"])}
        onSelectionChange={jest.fn()}
      />
    );
    header = screen.getByTestId("lb-datatable-select-all") as HTMLInputElement;
    expect(header.checked).toBe(true);
    expect(header.indeterminate).toBe(false);
  });

  it("header checkbox toggle selects all when none/partial and clears all when all selected", async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    const { rerender } = render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        selectable
        selectedRowIds={new Set<string>()}
        onSelectionChange={onSelectionChange}
      />
    );
    await user.click(screen.getByTestId("lb-datatable-select-all"));
    expect(Array.from(onSelectionChange.mock.calls[0]![0] as Set<string>).sort()).toEqual([
      "i1",
      "i2"
    ]);

    onSelectionChange.mockClear();
    rerender(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        selectable
        selectedRowIds={new Set<string>(["i1", "i2"])}
        onSelectionChange={onSelectionChange}
      />
    );
    await user.click(screen.getByTestId("lb-datatable-select-all"));
    expect(Array.from(onSelectionChange.mock.calls[0]![0] as Set<string>)).toEqual([]);
  });

  it("isRowSelectable disables the per-row checkbox and excludes it from select-all", async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        selectable
        selectedRowIds={new Set<string>()}
        onSelectionChange={onSelectionChange}
        isRowSelectable={(row) => row.id !== "i2"}
      />
    );
    expect(screen.getByTestId("lb-datatable-select-row-i2")).toBeDisabled();
    await user.click(screen.getByTestId("lb-datatable-select-all"));
    expect(Array.from(onSelectionChange.mock.calls[0]![0] as Set<string>)).toEqual(["i1"]);
  });

  it("row checkbox click does not bubble to onRowClick", async () => {
    const user = userEvent.setup();
    const onRowClick = jest.fn();
    const onSelectionChange = jest.fn();
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        onRowClick={onRowClick}
        selectable
        selectedRowIds={new Set<string>()}
        onSelectionChange={onSelectionChange}
      />
    );
    await user.click(screen.getByTestId("lb-datatable-select-row-i1"));
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("threads row-interaction props through renderRow in renderRows mode", () => {
    render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={getRowKey}
        activeRowId="i1"
        getRowAttributes={(row) => ({ "data-invoice-id": row.id })}
        getRowClassName={(row) => (row.id === "i2" ? "row-exported" : undefined)}
        renderRows={({ rows, renderRow }) => (
          <table>
            <tbody data-testid="slot-tbody">
              {rows.map((row, idx) => renderRow(row, idx))}
            </tbody>
          </table>
        )}
      />
    );
    const tbody = screen.getByTestId("slot-tbody");
    const rows = within(tbody).getAllByTestId("lb-datatable-row");
    expect(rows[0]).toHaveClass("is-active");
    expect(rows[0]).toHaveAttribute("data-invoice-id", "i1");
    expect(rows[1]).toHaveClass("row-exported");
    expect(rows[1]).toHaveAttribute("data-invoice-id", "i2");
  });

  it("supports a custom row type via the generic parameter (compile-time)", () => {
    interface VendorRow {
      readonly _id: string;
      readonly name: string;
    }
    const cols: ReadonlyArray<DataTableColumn<VendorRow>> = [
      { id: "name", header: "Name", render: (row) => row.name }
    ];
    const rows: ReadonlyArray<VendorRow> = [{ _id: "v1", name: "Acme" }];
    render(
      <DataTable<VendorRow>
        columns={cols}
        rows={rows}
        getRowKey={(row) => row._id}
      />
    );
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });
});
