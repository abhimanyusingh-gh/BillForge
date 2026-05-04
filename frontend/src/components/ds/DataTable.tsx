import {
  useEffect,
  useId,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";

import {
  computeHeaderState,
  DATATABLE_HEADER_SELECTION_STATE,
  EMPTY_SELECTION,
  getSelectableRowKeys,
  toggleAll,
  toggleRow,
  type DataTableHeaderSelectionState
} from "./DataTableSelection";

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

const DATATABLE_ROW_STATE = {
  ACTIVE: "is-active"
} as const;

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

type DataTableRowAttributeValue = string | number;

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
  onRowClick?: (row: TRow, event: ReactMouseEvent<HTMLTableRowElement>) => void;
  activeRowId?: string;
  getRowClassName?: (row: TRow) => string | undefined;
  getRowAttributes?: (row: TRow) => Record<string, DataTableRowAttributeValue> | undefined;
  selectable?: boolean;
  selectedRowIds?: ReadonlySet<string>;
  onSelectionChange?: (selected: ReadonlySet<string>) => void;
  isRowSelectable?: (row: TRow) => boolean;
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
  columns,
  selectable
}: {
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  selectable: boolean;
}) {
  const hasAnyWidth = selectable || columns.some((c) => c.width);
  if (!hasAnyWidth) return null;
  return (
    <colgroup>
      {selectable ? <col className="lb-datatable-checkbox-col" /> : null}
      {columns.map((column) => (
        <col
          key={column.id}
          style={column.width ? { width: column.width } : undefined}
        />
      ))}
    </colgroup>
  );
}

function HeaderCheckboxCell({
  state,
  onToggle,
  disabled
}: {
  state: DataTableHeaderSelectionState;
  onToggle: () => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate =
        state === DATATABLE_HEADER_SELECTION_STATE.INDETERMINATE;
    }
  }, [state]);
  return (
    <th scope="col" className="lb-datatable-th lb-datatable-checkbox-cell">
      <input
        ref={ref}
        type="checkbox"
        aria-label="Select all"
        checked={state === DATATABLE_HEADER_SELECTION_STATE.ALL}
        disabled={disabled}
        onChange={onToggle}
        data-testid="lb-datatable-select-all"
      />
    </th>
  );
}

function RowCheckboxCell({
  rowKey,
  checked,
  disabled,
  onToggle
}: {
  rowKey: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <td
      className="lb-datatable-td lb-datatable-checkbox-cell"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        aria-label="Select row"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        data-testid={`lb-datatable-select-row-${rowKey}`}
      />
    </td>
  );
}

function composeRowClassName(
  base: string,
  isActive: boolean,
  extra: string | undefined
): string {
  let className = base;
  if (isActive) className += " " + DATATABLE_ROW_STATE.ACTIVE;
  if (extra) className += " " + extra;
  return className;
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
  onRowClick,
  activeRowId,
  getRowClassName,
  getRowAttributes,
  selectable = false,
  selectedRowIds = EMPTY_SELECTION,
  onSelectionChange,
  isRowSelectable,
  renderRows,
  testId
}: DataTableProps<TRow>) {
  const reactId = useId();
  const captionId = caption ? `${reactId}-caption` : undefined;
  const colCount = columns.length + (selectable ? 1 : 0);

  const tableClassName =
    "lb-datatable" +
    " lb-datatable-density-" +
    density +
    (stickyHeader ? " lb-datatable-sticky" : "") +
    (onRowClick ? " lb-datatable-clickable" : "");

  const selectableRowKeys = useMemo<ReadonlyArray<string>>(
    () =>
      selectable ? getSelectableRowKeys(rows, getRowKey, isRowSelectable) : [],
    [selectable, rows, getRowKey, isRowSelectable]
  );

  const headerSelectionState = computeHeaderState(selectableRowKeys, selectedRowIds);

  function toggleRowSelection(rowKey: string): void {
    if (!onSelectionChange) return;
    onSelectionChange(toggleRow(selectedRowIds, rowKey));
  }

  function toggleAllSelection(): void {
    if (!onSelectionChange) return;
    onSelectionChange(toggleAll(selectedRowIds, selectableRowKeys, headerSelectionState));
  }

  function renderRow(row: TRow, _index: number): ReactNode {
    const key = getRowKey(row);
    const isActive = activeRowId === key;
    const extraClass = getRowClassName?.(row);
    const className = composeRowClassName("lb-datatable-row", isActive, extraClass);
    const attrs = getRowAttributes?.(row);
    const handleClick = onRowClick
      ? (event: ReactMouseEvent<HTMLTableRowElement>) => onRowClick(row, event)
      : undefined;
    const selectableForRow = selectable && (isRowSelectable ? isRowSelectable(row) : true);
    return (
      <tr
        key={key}
        className={className}
        data-testid="lb-datatable-row"
        data-row-key={key}
        aria-selected={isActive || undefined}
        onClick={handleClick}
        {...(attrs ?? {})}
      >
        {selectable ? (
          <RowCheckboxCell
            rowKey={key}
            checked={selectedRowIds.has(key)}
            disabled={!selectableForRow}
            onToggle={() => toggleRowSelection(key)}
          />
        ) : null}
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
        {selectable ? (
          <HeaderCheckboxCell
            state={headerSelectionState}
            onToggle={toggleAllSelection}
            disabled={selectableRowKeys.length === 0}
          />
        ) : null}
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
          <ColGroup columns={columns} selectable={selectable} />
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
        <ColGroup columns={columns} selectable={selectable} />
        {headHtml}
        <tbody className="lb-datatable-tbody">
          {stateRow ?? rows.map((row, index) => renderRow(row, index))}
        </tbody>
      </table>
    </div>
  );
}
