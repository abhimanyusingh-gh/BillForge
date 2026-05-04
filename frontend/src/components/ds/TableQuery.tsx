import { type ReactNode } from "react";

export const TABLE_QUERY_SORT_DIRECTION = {
  asc: "asc",
  desc: "desc"
} as const;

export type TableQuerySortDirection =
  (typeof TABLE_QUERY_SORT_DIRECTION)[keyof typeof TABLE_QUERY_SORT_DIRECTION];

export interface TableQuerySort {
  col: string;
  dir: TableQuerySortDirection;
  loading?: boolean;
}

interface FetchOverlayProps {
  isLoading: boolean;
  query?: string;
  sort?: TableQuerySort;
  kind?: ReactNode;
}

export function FetchOverlay({ isLoading, query, sort, kind = "rows" }: FetchOverlayProps) {
  if (!isLoading) return null;
  return (
    <span className="tq-fetch-overlay">
      <span className="material-symbols-outlined spin">progress_activity</span>
      {query ? (
        <>
          Searching <b>"{query}"</b> on server...
        </>
      ) : sort && sort.col ? (
        <>
          Sorting {kind} on server by <b>{sort.col}</b>{" "}
          {sort.dir === TABLE_QUERY_SORT_DIRECTION.asc ? "ascending" : "descending"}...
        </>
      ) : (
        <>Loading {kind}...</>
      )}
    </span>
  );
}
