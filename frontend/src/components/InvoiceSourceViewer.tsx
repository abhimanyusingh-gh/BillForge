import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getInvoiceSourceHighlights, type SourceFieldKey } from "../sourceHighlights";
import type { Invoice } from "../types";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5;

interface InvoiceSourceViewerProps {
  invoice: Invoice;
  overlayUrlByField: Partial<Record<SourceFieldKey, string>>;
  resolvePreviewUrl?: (page: number) => string;
}

export function InvoiceSourceViewer({ invoice, overlayUrlByField, resolvePreviewUrl }: InvoiceSourceViewerProps) {
  const highlights = useMemo(() => getInvoiceSourceHighlights(invoice), [invoice]);
  const canUsePreviewFallback = typeof resolvePreviewUrl === "function";
  const defaultPreviewUrl = canUsePreviewFallback ? resolvePreviewUrl?.(1) : undefined;
  const hasDefaultPreview = typeof defaultPreviewUrl === "string" && defaultPreviewUrl.trim().length > 0;
  const availableHighlights = useMemo(
    () =>
      highlights.filter((highlight) => {
        const overlayUrl = overlayUrlByField[highlight.fieldKey];
        if (overlayUrl) {
          return true;
        }
        if (!resolvePreviewUrl || !canUsePreviewFallback) {
          return false;
        }
        return resolvePreviewUrl(highlight.page).trim().length > 0;
      }),
    [canUsePreviewFallback, highlights, overlayUrlByField, resolvePreviewUrl]
  );
  const [activeFieldKey, setActiveFieldKey] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + e.deltaY * -0.005)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const scrollToBox = useCallback((bboxNormalized: [number, number, number, number]) => {
    const container = containerRef.current;
    if (!container) return;
    const [, top, , ] = bboxNormalized;
    const imgHeight = container.scrollHeight;
    const targetTop = top * imgHeight - container.clientHeight * 0.3;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, []);

  const handleChipClick = useCallback(
    (fieldKey: string, bboxNormalized: [number, number, number, number]) => {
      setActiveFieldKey(fieldKey);
      requestAnimationFrame(() => scrollToBox(bboxNormalized));
    },
    [scrollToBox]
  );

  useEffect(() => {
    if (availableHighlights.length === 0) {
      setActiveFieldKey("");
      return;
    }

    if (!availableHighlights.some((highlight) => highlight.fieldKey === activeFieldKey)) {
      setActiveFieldKey(availableHighlights[0].fieldKey);
    }
  }, [activeFieldKey, availableHighlights]);

  useEffect(() => {
    setZoom(1);
  }, [activeFieldKey]);

  if (availableHighlights.length === 0) {
    return (
      <div className="source-viewer-card">
        <div className="source-viewer-head">
          <h3>Source Preview</h3>
          <p className="muted">
            No extracted value highlights are available yet. Use the source document for manual verification.
          </p>
        </div>
        {hasDefaultPreview ? (
          <div className="source-preview-wrap">
            <div className="source-preview-image" ref={containerRef}>
              <div className="source-preview-canvas" style={{ transform: `scale(${zoom})` }}>
                <img src={defaultPreviewUrl} alt={`Source preview for ${invoice.attachmentName}`} loading="lazy" />
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">Source preview is unavailable for this invoice.</p>
        )}
      </div>
    );
  }

  const activeHighlight =
    availableHighlights.find((highlight) => highlight.fieldKey === activeFieldKey) ?? availableHighlights[0];
  const activeOverlayUrl = overlayUrlByField[activeHighlight.fieldKey];
  const activePreviewUrl = canUsePreviewFallback ? resolvePreviewUrl?.(activeHighlight.page) : undefined;
  const activeImageUrl = activeOverlayUrl ?? activePreviewUrl;
  if (!activeImageUrl) {
    return (
      <div className="source-viewer-card">
        <div className="source-viewer-head">
          <h3>Value Source Highlights</h3>
          <p className="muted">Select a field to see where the value was read from.</p>
        </div>
        <p className="muted">Source preview is unavailable for the selected highlight.</p>
      </div>
    );
  }
  const renderClientSideBox = !activeOverlayUrl;
  const [x1, y1, x2, y2] = activeHighlight.bboxNormalized;
  const boxStyle = {
    left: `${x1 * 100}%`,
    top: `${y1 * 100}%`,
    width: `${Math.max(0, x2 - x1) * 100}%`,
    height: `${Math.max(0, y2 - y1) * 100}%`
  };

  return (
    <div className="source-viewer-card">
      <div className="source-viewer-head">
        <h3>Value Source Highlights</h3>
        <p className="muted">Select a field to see where the value was read from.</p>
      </div>

      <div className="source-highlight-list">
        {availableHighlights.map((highlight) => {
          const isActive = highlight.fieldKey === activeHighlight.fieldKey;
          return (
            <button
              key={`${highlight.fieldKey}:${highlight.page}`}
              type="button"
              className={`source-highlight-chip ${isActive ? "source-highlight-chip-active" : ""}`}
              onClick={() => handleChipClick(highlight.fieldKey, highlight.bboxNormalized)}
            >
              <span>{highlight.label}: {highlight.value}</span>
              <small>page {highlight.page}</small>
            </button>
          );
        })}
      </div>

      <div className="source-preview-wrap">
        <div className="source-preview-image" ref={containerRef}>
          <div className="source-preview-canvas" style={{ transform: `scale(${zoom})` }}>
            <img src={activeImageUrl} alt={`Source overlay for ${activeHighlight.label} in ${invoice.attachmentName}`} loading="lazy" />
            {renderClientSideBox ? <div className="source-preview-box" style={boxStyle} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
