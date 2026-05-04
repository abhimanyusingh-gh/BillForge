/**
 * @jest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import {
  DataTable,
  DATATABLE_DENSITY,
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
