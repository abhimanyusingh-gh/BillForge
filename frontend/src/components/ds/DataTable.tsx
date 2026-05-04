import { useId, type CSSProperties, type ReactNode } from "react";

export const DATATABLE_DENSITY = {
  COMPACT: "compact",
  COMFORTABLE: "comfortable"
} as const;

type DataTableDensity =
  (typeof DATATABLE_DENSITY)[keyof typeof DATATABLE_DENSITY];

export const DATATABLE_SORT_DIRECTION = {
  ASC: "asc",
  DESC: "desc"
} as const;

type DataTableSortDirection =
  (typeof DATATABLE_SORT_DIRECTION)[keyof typeof DATATABLE_SORT_DIRECTION];

export const DATATABLE_ALIGN = {
  LEFT: "left",
  RIGHT: "right",
  CENTER: "center"
} as const;

type DataTableAlign =
  (typeof DATATABLE_ALIGN)[keyof typeof DATATABLE_ALIGN];

export const DATATABLE_SORT_CYCLE = {
  ASC_DESC: "asc-desc",
  ASC_DESC_NULL: "asc-desc-null"
} as const;

type DataTableSortCycle =
  (typeof DATATABLE_SORT_CYCLE)[keyof typeof DATATABLE_SORT_CYCLE];

export interface DataTableSort {
  id: string;
  direction: DataTableSortDirection;
}

export interface DataTableColumn<TRow> {
  id: string;
  header: ReactNode;
  render?: (row: TRow) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: DataTableAlign;
}

interface DataTableProps<TRow> {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  rows: ReadonlyArray<TRow>;
  getRowKey: (row: TRow) => string;
  density?: DataTableDensity;
  stickyHeader?: boolean;
  sortBy?: DataTableSort | null;
  sortCycle?: DataTableSortCycle;
  onSortChange?: (sort: DataTableSort | undefined) => void;
  loading?: boolean;
  error?: string;
  emptyText?: string;
  caption?: string;
  renderRows?: (args: {
    rows: ReadonlyArray<TRow>;
    columns: ReadonlyArray<DataTableColumn<TRow>>;
    renderRow: (row: TRow, index: number) => ReactNode;
  }) => ReactNode;
  testId?: string;
}

const DEFAULT_LOADING_TEXT = "Loading...";
const DEFAULT_EMPTY_TEXT = "Nothing here yet.";

const SORT_ICON = {
  NONE: "unfold_more",
  ASC: "arrow_upward",
  DESC: "arrow_downward"
} as const;

function nextSort(
  current: DataTableSort | null | undefined,
  columnId: string,
  cycle: DataTableSortCycle
): DataTableSort | undefined {
  if (!current || current.id !== columnId) {
    return { id: columnId, direction: DATATABLE_SORT_DIRECTION.ASC };
  }
  if (current.direction === DATATABLE_SORT_DIRECTION.ASC) {
    return { id: columnId, direction: DATATABLE_SORT_DIRECTION.DESC };
  }
  if (cycle === DATATABLE_SORT_CYCLE.ASC_DESC_NULL) {
    return undefined;
  }
  return { id: columnId, direction: DATATABLE_SORT_DIRECTION.ASC };
}

function ariaSortFor(
  column: DataTableColumn<unknown>,
  sortBy: DataTableSort | null | undefined
): "ascending" | "descending" | "none" | undefined {
  if (!column.sortable) return undefined;
  if (!sortBy || sortBy.id !== column.id) return "none";
  return sortBy.direction === DATATABLE_SORT_DIRECTION.ASC
    ? "ascending"
    : "descending";
}

function alignClass(align: DataTableAlign | undefined): string {
  if (align === DATATABLE_ALIGN.RIGHT) return " lb-datatable-cell-right";
  if (align === DATATABLE_ALIGN.CENTER) return " lb-datatable-cell-center";
  return "";
}

const COL_WIDTH_VAR = "--lb-datatable-col-width";

function colWidthStyle(width: string | undefined): CSSProperties | undefined {
  if (!width) return undefined;
  return { [COL_WIDTH_VAR]: width } as CSSProperties;
}

function HeaderCell<TRow>({
  column,
  sortBy,
  sortCycle,
  onSortChange
}: {
  column: DataTableColumn<TRow>;
  sortBy: DataTableSort | null | undefined;
  sortCycle: DataTableSortCycle;
  onSortChange?: (sort: DataTableSort | undefined) => void;
}) {
  const isSorted = !!sortBy && sortBy.id === column.id;
  const sortable = column.sortable === true;
  const className = "lb-datatable-th" + alignClass(column.align);
  const ariaSort = ariaSortFor(column as DataTableColumn<unknown>, sortBy);
  const widthStyle = colWidthStyle(column.width);
  const widthClass = column.width ? " lb-datatable-th-sized" : "";

  if (!sortable) {
    return (
      <th
        scope="col"
        className={className + widthClass}
        aria-sort={ariaSort}
        style={widthStyle}
      >
        {column.header}
      </th>
    );
  }

  const icon = isSorted
    ? sortBy!.direction === DATATABLE_SORT_DIRECTION.ASC
      ? SORT_ICON.ASC
      : SORT_ICON.DESC
    : SORT_ICON.NONE;

  return (
    <th
      scope="col"
      className={className + widthClass}
      aria-sort={ariaSort}
      style={widthStyle}
    >
      <button
        type="button"
        className="lb-datatable-th-sort"
        data-testid={`lb-datatable-th-${column.id}`}
        onClick={() => onSortChange?.(nextSort(sortBy ?? null, column.id, sortCycle))}
      >
        <span className="lb-datatable-th-label">{column.header}</span>
        <span
          className={
            "material-symbols-outlined lb-datatable-th-sort-icon" +
            (isSorted ? " lb-datatable-th-sort-icon-active" : "")
          }
          aria-hidden="true"
        >
          {icon}
        </span>
      </button>
    </th>
  );
}

function StateRow({
  colSpan,
  testId,
  className,
  children
}: {
  colSpan: number;
  testId: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <tr>
      <td className={className} colSpan={colSpan} data-testid={testId}>
        {children}
      </td>
    </tr>
  );
}

function ColGroup<TRow>({
  columns
}: {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
}) {
  if (!columns.some((c) => c.width)) return null;
  return (
    <colgroup>
      {columns.map((column) => (
        <col
          key={column.id}
          style={column.width ? { width: column.width } : undefined}
        />
      ))}
    </colgroup>
  );
}

export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  density = DATATABLE_DENSITY.COMPACT,
  stickyHeader = false,
  sortBy = null,
  sortCycle = DATATABLE_SORT_CYCLE.ASC_DESC,
  onSortChange,
  loading = false,
  error,
  emptyText = DEFAULT_EMPTY_TEXT,
  caption,
  renderRows,
  testId
}: DataTableProps<TRow>) {
  const reactId = useId();
  const captionId = caption ? `${reactId}-caption` : undefined;
  const colCount = columns.length;

  const tableClassName =
    "lb-datatable" +
    " lb-datatable-density-" +
    density +
    (stickyHeader ? " lb-datatable-sticky" : "");

  function renderRow(row: TRow, _index: number): ReactNode {
    const key = getRowKey(row);
    return (
      <tr key={key} className="lb-datatable-row" data-testid="lb-datatable-row">
        {columns.map((column) => (
          <td
            key={column.id}
            className={"lb-datatable-td" + alignClass(column.align)}
          >
            {column.render ? column.render(row) : null}
          </td>
        ))}
      </tr>
    );
  }

  const stateRow = loading ? (
    <StateRow
      colSpan={colCount}
      testId="lb-datatable-loading"
      className="lb-datatable-state lb-datatable-state-loading"
    >
      {DEFAULT_LOADING_TEXT}
    </StateRow>
  ) : error ? (
    <StateRow
      colSpan={colCount}
      testId="lb-datatable-error"
      className="lb-datatable-state lb-datatable-state-error"
    >
      {error}
    </StateRow>
  ) : rows.length === 0 ? (
    <StateRow
      colSpan={colCount}
      testId="lb-datatable-empty"
      className="lb-datatable-state lb-datatable-state-empty"
    >
      {emptyText}
    </StateRow>
  ) : null;

  const headHtml = (
    <thead className="lb-datatable-thead">
      <tr>
        {columns.map((column) => (
          <HeaderCell
            key={column.id}
            column={column}
            sortBy={sortBy}
            sortCycle={sortCycle}
            onSortChange={onSortChange}
          />
        ))}
      </tr>
    </thead>
  );

  const captionHtml = caption ? (
    <caption id={captionId} className="lb-datatable-caption">
      {caption}
    </caption>
  ) : null;

  if (renderRows) {
    return (
      <div className="lb-datatable-wrap" data-testid={testId}>
        <table
          className={tableClassName}
          aria-describedby={captionId}
          aria-busy={loading || undefined}
        >
          {captionHtml}
          <ColGroup columns={columns} />
          {headHtml}
          <tbody className="lb-datatable-tbody">{stateRow}</tbody>
        </table>
        {!stateRow
          ? renderRows({ rows, columns, renderRow })
          : null}
      </div>
    );
  }

  return (
    <div className="lb-datatable-wrap" data-testid={testId}>
      <table
        className={tableClassName}
        aria-describedby={captionId}
        aria-busy={loading || undefined}
      >
        {captionHtml}
        <ColGroup columns={columns} />
        {headHtml}
        <tbody className="lb-datatable-tbody">
          {stateRow ?? rows.map((row, index) => renderRow(row, index))}
        </tbody>
      </table>
    </div>
  );
}
