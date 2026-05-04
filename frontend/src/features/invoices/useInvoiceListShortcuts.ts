import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { isInvoiceApprovable, isInvoiceExportable } from "@/lib/common/selection";
import type { Invoice } from "@/types";

interface UseInvoiceListShortcutsArgs {
  popupInvoiceId: string | null;
  confirmDialogOpen: boolean;
  showShortcutsHelp: boolean;
  filteredInvoices: ReadonlyArray<Invoice>;
  activeId: string | null;
  selectedIds: ReadonlyArray<string>;
  detailsPanelVisible: boolean;
  canApproveInvoices: boolean;
  canExportToTally: boolean;
  setActiveId: (id: string | null) => void;
  setDetailsPanelVisible: (visible: boolean) => void;
  setPopupInvoiceId: (id: string | null) => void;
  setShowShortcutsHelp: (open: boolean) => void;
  clearSelection: () => void;
  isRiskSignalsExpanded: (id: string) => boolean;
  toggleRiskSignalsExpanded: (id: string) => void;
  handleApproveSingle: (id: string) => Promise<boolean>;
  handleExportSingle: (id: string) => Promise<boolean>;
  announceShortcut: (message: string) => void;
}

export function useInvoiceListShortcuts({
  popupInvoiceId,
  confirmDialogOpen,
  showShortcutsHelp,
  filteredInvoices,
  activeId,
  selectedIds,
  detailsPanelVisible,
  canApproveInvoices,
  canExportToTally,
  setActiveId,
  setDetailsPanelVisible,
  setPopupInvoiceId,
  setShowShortcutsHelp,
  clearSelection,
  isRiskSignalsExpanded,
  toggleRiskSignalsExpanded,
  handleApproveSingle,
  handleExportSingle,
  announceShortcut
}: UseInvoiceListShortcutsArgs) {
  useKeyboardShortcuts({
    enabled: !popupInvoiceId && !confirmDialogOpen && !showShortcutsHelp,
    onMoveDown: () => {
      const idx = filteredInvoices.findIndex((inv) => inv._id === activeId);
      const next = filteredInvoices[idx + 1];
      if (next) {
        setActiveId(next._id);
        setDetailsPanelVisible(true);
        requestAnimationFrame(() => {
          document.querySelector(`[data-invoice-id="${next._id}"]`)?.scrollIntoView({ block: "nearest" });
        });
        announceShortcut(`Focused invoice ${next.attachmentName}`);
      }
    },
    onMoveUp: () => {
      const idx = filteredInvoices.findIndex((inv) => inv._id === activeId);
      const prev = filteredInvoices[idx - 1];
      if (prev) {
        setActiveId(prev._id);
        setDetailsPanelVisible(true);
        requestAnimationFrame(() => {
          document.querySelector(`[data-invoice-id="${prev._id}"]`)?.scrollIntoView({ block: "nearest" });
        });
        announceShortcut(`Focused invoice ${prev.attachmentName}`);
      }
    },
    onToggleExpand: () => {
      if (!activeId) return;
      const willExpand = !isRiskSignalsExpanded(activeId);
      toggleRiskSignalsExpanded(activeId);
      announceShortcut(willExpand ? "Expanded risk signals" : "Collapsed risk signals");
    },
    onOpenDetail: () => { if (activeId) setPopupInvoiceId(activeId); },
    onApprove: () => {
      if (!activeId) return;
      const inv = filteredInvoices.find((i) => i._id === activeId);
      if (!inv || !isInvoiceApprovable(inv) || !canApproveInvoices) return;
      announceShortcut(`Approving invoice ${inv.attachmentName}`);
      void handleApproveSingle(activeId).then((ok) => {
        announceShortcut(ok ? `Approved invoice ${inv.attachmentName}` : `Failed to approve invoice ${inv.attachmentName}`);
      });
    },
    onExport: () => {
      if (!activeId) return;
      const inv = filteredInvoices.find((i) => i._id === activeId);
      if (!inv || !isInvoiceExportable(inv) || !canExportToTally) return;
      announceShortcut(`Exporting invoice ${inv.attachmentName}`);
      void handleExportSingle(activeId).then((ok) => {
        announceShortcut(ok ? `Exported invoice ${inv.attachmentName}` : `Failed to export invoice ${inv.attachmentName}`);
      });
    },
    onEscape: () => {
      if (selectedIds.length > 0) { clearSelection(); return; }
      if (detailsPanelVisible) { setDetailsPanelVisible(false); }
    },
    onShowHelp: () => setShowShortcutsHelp(true)
  });
}
