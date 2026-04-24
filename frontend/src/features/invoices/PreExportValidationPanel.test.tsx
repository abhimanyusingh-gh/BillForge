/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PreExportValidationPanel, PRE_EXPORT_VIEW } from "@/features/invoices/PreExportValidationPanel";
import type { Invoice } from "@/types";

function makeInvoice(overrides: Partial<Invoice> & { id: string }): Invoice {
  const { id, ...rest } = overrides;
  return {
    _id: id,
    tenantId: "t",
    workloadTier: "standard",
    sourceType: "upload",
    sourceKey: id,
    sourceDocumentId: id,
    attachmentName: `${id}.pdf`,
    mimeType: "application/pdf",
    receivedAt: "2026-04-20T00:00:00Z",
    confidenceScore: 80,
    confidenceTone: "green",
    autoSelectForApproval: false,
    status: "APPROVED",
    processingIssues: [],
    createdAt: "2026-04-20T00:00:00Z",
    updatedAt: "2026-04-20T00:00:00Z",
    parsed: {
      invoiceNumber: `N-${id}`,
      vendorName: `V-${id}`,
      currency: "INR",
      customerGstin: "29ABCDE1234F1Z5"
    },
    ...rest
  } as Invoice;
}

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    })
  });
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("features/invoices/PreExportValidationPanel — 4-state contract", () => {
  it("renders the loading state while validating", () => {
    render(
      <PreExportValidationPanel
        open
        invoices={[makeInvoice({ id: "a" })]}
        onCancel={() => {}}
        onConfirm={() => {}}
        onSelectInvoice={() => {}}
        loadingMs={500}
      />
    );
    const body = screen.getByTestId("pre-export-body");
    expect(body.dataset.view).toBe(PRE_EXPORT_VIEW.Loading);
    expect(screen.getByTestId("pre-export-loading")).toBeInTheDocument();
  });

  it("renders the error state with retry when initialError is set", () => {
    render(
      <PreExportValidationPanel
        open
        invoices={[makeInvoice({ id: "a" })]}
        onCancel={() => {}}
        onConfirm={() => {}}
        onSelectInvoice={() => {}}
        loadingMs={0}
        initialError
      />
    );
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("pre-export-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders the empty / all-clear confirmation when no failures", () => {
    render(
      <PreExportValidationPanel
        open
        invoices={[makeInvoice({ id: "ok" })]}
        onCancel={() => {}}
        onConfirm={() => {}}
        onSelectInvoice={() => {}}
        loadingMs={10}
      />
    );
    act(() => {
      jest.advanceTimersByTime(15);
    });
    expect(screen.getByTestId("pre-export-empty")).toHaveTextContent(/ready to export 1 invoice/i);
    expect(screen.getByTestId("pre-export-confirm")).toBeInTheDocument();
  });

  it("renders grouped failures with the export-anyway affordance", () => {
    render(
      <PreExportValidationPanel
        open
        invoices={[
          makeInvoice({
            id: "gstin-1",
            parsed: { invoiceNumber: "G1", vendorName: "V", currency: "INR", customerGstin: "" }
          }),
          makeInvoice({
            id: "risk-1",
            complianceSummary: {
              tdsSection: null,
              glCode: null,
              riskSignalCount: 1,
              riskSignalMaxSeverity: "critical"
            }
          }),
          makeInvoice({ id: "ok" })
        ]}
        onCancel={() => {}}
        onConfirm={() => {}}
        onSelectInvoice={() => {}}
        loadingMs={10}
      />
    );
    act(() => {
      jest.advanceTimersByTime(15);
    });
    const body = screen.getByTestId("pre-export-body");
    expect(body.dataset.view).toBe(PRE_EXPORT_VIEW.Data);
    expect(screen.getByTestId("pre-export-summary")).toHaveTextContent(/2 of 3 invoices/);
    expect(screen.getAllByTestId("pre-export-group")).toHaveLength(2);
    expect(screen.getByTestId("pre-export-export-anyway")).toHaveTextContent(/export anyway \(3\)/i);
  });
});

describe("features/invoices/PreExportValidationPanel — user actions", () => {
  const failingInvoices = [
    makeInvoice({
      id: "gstin-1",
      parsed: { invoiceNumber: "G1", vendorName: "V", currency: "INR", customerGstin: "" }
    }),
    makeInvoice({ id: "ok" })
  ];

  it("fires onSelectInvoice and closes on Fix-now click", () => {
    const onCancel = jest.fn();
    const onSelectInvoice = jest.fn();
    render(
      <PreExportValidationPanel
        open
        invoices={failingInvoices}
        onCancel={onCancel}
        onConfirm={() => {}}
        onSelectInvoice={onSelectInvoice}
        loadingMs={10}
      />
    );
    act(() => {
      jest.advanceTimersByTime(15);
    });
    fireEvent.click(screen.getByTestId("pre-export-fix-now"));
    expect(onSelectInvoice).toHaveBeenCalledWith("gstin-1");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("fires onConfirm on Export-anyway click and does not call cancel", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <PreExportValidationPanel
        open
        invoices={failingInvoices}
        onCancel={onCancel}
        onConfirm={onConfirm}
        onSelectInvoice={() => {}}
        loadingMs={10}
      />
    );
    act(() => {
      jest.advanceTimersByTime(15);
    });
    fireEvent.click(screen.getByTestId("pre-export-export-anyway"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("fires onConfirm from the all-clear confirmation", () => {
    const onConfirm = jest.fn();
    render(
      <PreExportValidationPanel
        open
        invoices={[makeInvoice({ id: "ok" })]}
        onCancel={() => {}}
        onConfirm={onConfirm}
        onSelectInvoice={() => {}}
        loadingMs={10}
      />
    );
    act(() => {
      jest.advanceTimersByTime(15);
    });
    fireEvent.click(screen.getByTestId("pre-export-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("fires onCancel on Cancel button click without exporting", () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <PreExportValidationPanel
        open
        invoices={failingInvoices}
        onCancel={onCancel}
        onConfirm={onConfirm}
        onSelectInvoice={() => {}}
        loadingMs={10}
      />
    );
    act(() => {
      jest.advanceTimersByTime(15);
    });
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("closes on Escape via SlideOverPanel's dismiss hook", () => {
    const onCancel = jest.fn();
    render(
      <PreExportValidationPanel
        open
        invoices={failingInvoices}
        onCancel={onCancel}
        onConfirm={() => {}}
        onSelectInvoice={() => {}}
        loadingMs={10}
      />
    );
    act(() => {
      jest.advanceTimersByTime(15);
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
