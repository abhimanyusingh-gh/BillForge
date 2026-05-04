export const DATATABLE_HEADER_SELECTION_STATE = {
  ALL: "all",
  NONE: "none",
  INDETERMINATE: "indeterminate"
} as const;

export type DataTableHeaderSelectionState =
  (typeof DATATABLE_HEADER_SELECTION_STATE)[keyof typeof DATATABLE_HEADER_SELECTION_STATE];

export const EMPTY_SELECTION: ReadonlySet<string> = new Set<string>();

export function getSelectableRowKeys<TRow>(
  rows: ReadonlyArray<TRow>,
  getRowKey: (row: TRow) => string,
  isRowSelectable?: (row: TRow) => boolean
): ReadonlyArray<string> {
  if (!isRowSelectable) return rows.map((row) => getRowKey(row));
  const keys: string[] = [];
  for (const row of rows) {
    if (isRowSelectable(row)) keys.push(getRowKey(row));
  }
  return keys;
}

export function computeHeaderState(
  selectableKeys: ReadonlyArray<string>,
  selected: ReadonlySet<string>
): DataTableHeaderSelectionState {
  if (selectableKeys.length === 0) return DATATABLE_HEADER_SELECTION_STATE.NONE;
  let count = 0;
  for (const key of selectableKeys) if (selected.has(key)) count += 1;
  if (count === 0) return DATATABLE_HEADER_SELECTION_STATE.NONE;
  if (count === selectableKeys.length) return DATATABLE_HEADER_SELECTION_STATE.ALL;
  return DATATABLE_HEADER_SELECTION_STATE.INDETERMINATE;
}

export function toggleRow(
  current: ReadonlySet<string>,
  rowKey: string
): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(rowKey)) next.delete(rowKey);
  else next.add(rowKey);
  return next;
}

export function toggleAll(
  current: ReadonlySet<string>,
  selectableKeys: ReadonlyArray<string>,
  headerState: DataTableHeaderSelectionState
): ReadonlySet<string> {
  const next = new Set(current);
  if (headerState === DATATABLE_HEADER_SELECTION_STATE.ALL) {
    for (const key of selectableKeys) next.delete(key);
  } else {
    for (const key of selectableKeys) next.add(key);
  }
  return next;
}
