import { useCallback, type MouseEvent, type RefObject } from "react";

interface UseInvoiceListPanelDividerArgs {
  contentRef: RefObject<HTMLElement>;
  listPanelPercent: number;
  setListPanelPercent: (value: number) => void;
  persistPercent: (value: number) => void;
}

const DIVIDER_MIN_PERCENT = 25;
const DIVIDER_MAX_PERCENT = 75;

export function useInvoiceListPanelDivider({
  contentRef,
  listPanelPercent,
  setListPanelPercent,
  persistPercent
}: UseInvoiceListPanelDividerArgs) {
  return useCallback((e: MouseEvent) => {
    e.preventDefault();
    const container = contentRef.current;
    if (!container) return;
    const startX = e.clientX;
    const startPercent = listPanelPercent;
    const containerWidth = container.getBoundingClientRect().width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: globalThis.MouseEvent) => {
      const delta = ev.clientX - startX;
      const pctDelta = (delta / containerWidth) * 100;
      setListPanelPercent(Math.min(DIVIDER_MAX_PERCENT, Math.max(DIVIDER_MIN_PERCENT, startPercent + pctDelta)));
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      persistPercent(listPanelPercent);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [contentRef, listPanelPercent, setListPanelPercent, persistPercent]);
}
