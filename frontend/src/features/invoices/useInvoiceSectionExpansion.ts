import { useCallback, useEffect, useRef, useState } from "react";

interface UseInvoiceSectionExpansionArgs {
  popupInvoiceId: string | null;
  activeId: string | null;
  setPopupInvoiceId: (id: string | null) => void;
}

interface UseInvoiceSectionExpansionResult {
  sectionExpanded: Record<string, boolean>;
  setSection: (key: string, value: boolean | ((prev: boolean) => boolean)) => void;
  popupRef: React.RefObject<HTMLElement>;
}

export function useInvoiceSectionExpansion({
  popupInvoiceId,
  activeId,
  setPopupInvoiceId
}: UseInvoiceSectionExpansionArgs): UseInvoiceSectionExpansionResult {
  const popupRef = useRef<HTMLElement>(null);
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({
    popupExtractedFields: true,
    activeExtractedFields: true
  });

  const setSection = useCallback((key: string, value: boolean | ((prev: boolean) => boolean)) => {
    setSectionExpanded((prev) => {
      const resolved = typeof value === "function" ? value(!!prev[key]) : value;
      return { ...prev, [key]: resolved };
    });
  }, []);

  useEffect(() => {
    if (!popupInvoiceId) {
      return;
    }
    setSectionExpanded((prev) => ({ ...prev, popupSourcePreview: false, popupExtractedFields: true, popupLineItems: false }));
  }, [popupInvoiceId]);

  useEffect(() => {
    setSectionExpanded((prev) => ({ ...prev, activeSourcePreview: false, activeExtractedFields: true, activeLineItems: false }));
  }, [activeId]);

  useEffect(() => {
    if (!popupInvoiceId) {
      return undefined;
    }

    popupRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPopupInvoiceId(null);
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleEsc);
    };
  }, [popupInvoiceId, setPopupInvoiceId]);

  return { sectionExpanded, setSection, popupRef };
}
